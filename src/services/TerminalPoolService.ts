import logger from '../shared/Logger';
import Redis from '../database/redis/Redis';
import TerminalPoolModel from '../database/model/TerminalPoolModel';

// Enum of supported switch names
export enum SwitchName {
  INTERSWITCH = 'INTERSWITCH'
}

/**
 * TerminalPoolService
 * Responsibilities:
 *  - Build a Redis-backed pool of ISW transacting terminal IDs from the
 *    interswitch_terminal_pool MongoDB collection
 *  - Store pool in Redis as a LIST and maintain a ROUND-ROBIN pointer using
 *    an atomic Lua script
 *  - Refresh on service start and every midnight without clearing the live
 *    list until the replacement staging list is ready (safe swap via RENAME)
 */
// Fallback TIDs used when the live Redis pool is empty or unavailable.
// Round-robined in-process (single replica — no Redis needed for fallback path).
export const FALLBACK_TIDS = [
  '2LTS0001', '2LTS0002', '2LTS0003', '2LTS0004', '2LTS0005',
  '2LTS0006', '2LTS0007', '2LTS0008', '2LTS0009',
];

class TerminalPoolService {
  private static instance: TerminalPoolService;
  private redis: Redis;

  private poolKey    = (sw: string) => `terminal_pool:${sw}:list`;
  private stagingKey = (sw: string) => `terminal_pool:${sw}:list:staging`;
  private ptrKey     = (sw: string) => `terminal_pool:${sw}:pointer`;
  private readonly LOCK_KEY = 'terminal_pool:lock:rebuild_all';
  private rebuildInProgress = false;
  private fallbackPointer   = 0;

  private constructor() {
    this.redis = Redis.getInstance();
  }

  static getInstance(): TerminalPoolService {
    if (!this.instance) {
      this.instance = new TerminalPoolService();
    }
    return this.instance;
  }

  /**
   * Load all TIDs from MongoDB into Redis.
   * Uses a staging key + RENAME for an atomic swap so the live list is
   * never empty mid-rebuild.
   */
  async buildPool(switchName: SwitchName): Promise<void> {
    const sw = switchName.toUpperCase();
    const liveKey    = this.poolKey(sw);
    const staging    = this.stagingKey(sw);
    const ptrKeyName = this.ptrKey(sw);

    logger.info(
      `[TerminalPool:buildPool] START — switch: ${sw} | ` +
      `liveKey: "${liveKey}" | stagingKey: "${staging}" | ptrKey: "${ptrKeyName}"`
    );

    if (this.rebuildInProgress) {
      logger.warn(
        '[TerminalPool:buildPool] SKIPPED — another buildPool call is already in progress. ' +
        'Concurrent rebuild prevented.'
      );
      return;
    }

    this.rebuildInProgress = true;
    logger.info('[TerminalPool:buildPool] Rebuild lock acquired');

    const startMs = Date.now();
    try {
      // --- Step 1: Query MongoDB ---
      logger.info('[TerminalPool:buildPool] Querying MongoDB interswitch_terminal_pool...');
      const docs = await TerminalPoolModel.find({}, { tid: 1, _id: 0 });
      const queryMs = Date.now() - startMs;

      if (!docs || docs.length === 0) {
        logger.warn(
          `[TerminalPool:buildPool] MongoDB returned 0 documents (query took ${queryMs}ms). ` +
          'Pool NOT updated — live key left untouched. Fallback TID will be used for transactions.'
        );
        return;
      }

      const tids = docs.map((d) => d.tid);
      logger.info(
        `[TerminalPool:buildPool] MongoDB query OK (${queryMs}ms) — ` +
        `${tids.length} TID(s) found: [${tids.join(', ')}]`
      );

      const client = this.redis.getClient();

      // --- Step 2: Clear stale staging key ---
      logger.info(`[TerminalPool:buildPool] Deleting stale staging key "${staging}"...`);
      await client.del(staging);
      logger.info(`[TerminalPool:buildPool] Staging key deleted`);

      // --- Step 3: Populate staging key ---
      logger.info(`[TerminalPool:buildPool] Writing ${tids.length} TID(s) to staging key...`);
      for (let i = 0; i < tids.length; i++) {
        await client.rPush(staging, tids[i]);
        logger.info(
          `[TerminalPool:buildPool] RPUSH [${i + 1}/${tids.length}] "${tids[i]}" → "${staging}"`
        );
      }
      logger.info(
        `[TerminalPool:buildPool] All ${tids.length} TID(s) written to staging key`
      );

      // --- Step 4: Atomic swap staging → live ---
      logger.info(
        `[TerminalPool:buildPool] Atomic RENAME "${staging}" → "${liveKey}"...`
      );
      await client.rename(staging, liveKey);
      logger.info(`[TerminalPool:buildPool] RENAME successful — live pool updated`);

      // --- Step 5: Reset round-robin pointer ---
      logger.info(`[TerminalPool:buildPool] Resetting pointer "${ptrKeyName}" to 0...`);
      await client.set(ptrKeyName, '0');
      logger.info(`[TerminalPool:buildPool] Pointer reset to 0`);

      const totalMs = Date.now() - startMs;
      logger.info(
        `[TerminalPool:buildPool] COMPLETE — ${tids.length} TID(s) in pool: ` +
        `[${tids.join(', ')}] | total time: ${totalMs}ms`
      );
    } catch (err) {
      const totalMs = Date.now() - startMs;
      logger.err(
        `[TerminalPool:buildPool] FAILED after ${totalMs}ms — ` +
        `error: ${(err as Error).message} | stack: ${(err as Error).stack}`
      );
      throw err;
    } finally {
      this.rebuildInProgress = false;
      logger.info('[TerminalPool:buildPool] Rebuild lock released');
    }
  }

  /**
   * Round-robin fetch without removing elements.
   * Lua script: read LINDEX at current pointer, then increment pointer mod size.
   */
  async getNextTerminalId(switchName: SwitchName): Promise<string | null> {
    const sw         = switchName.toUpperCase();
    const liveKey    = this.poolKey(sw);
    const ptrKeyName = this.ptrKey(sw);

    logger.info(
      `[TerminalPool:getNextTerminalId] START — switch: ${sw} | ` +
      `liveKey: "${liveKey}" | ptrKey: "${ptrKeyName}"`
    );

    const client = this.redis.getClient();
    const lua = `
      local key = KEYS[1]
      local ptrKey = KEYS[2]
      local size = redis.call('LLEN', key)
      if size == 0 then return nil end
      local idx = redis.call('GET', ptrKey)
      if not idx then idx = 0 else idx = tonumber(idx) end
      local nextIdx = (idx % size)
      local value = redis.call('LINDEX', key, nextIdx)
      redis.call('SET', ptrKey, nextIdx + 1)
      return value
    `;

    try {
      // Log pre-call pool state for full traceability
      const preSize = await client.lLen(liveKey).catch(() => -1);
      const prePtr  = await client.get(ptrKeyName).catch((): null => null);
      logger.info(
        `[TerminalPool:getNextTerminalId] Pre-eval state — pool size: ${preSize}, ` +
        `current pointer: ${prePtr ?? '(unset, defaults to 0)'}`
      );

      if (preSize === 0) {
        logger.warn(
          `[TerminalPool:getNextTerminalId] Pool "${liveKey}" is EMPTY — ` +
          'Lua script will return nil. Fallback TID will be used.'
        );
      }

      const result = await client.eval(lua, {
        keys: [liveKey, ptrKeyName],
        arguments: [],
      });

      const tid = (result as string) || null;

      if (!tid) {
        logger.warn(
          `[TerminalPool:getNextTerminalId] Lua returned nil — pool empty or key missing. ` +
          `switch: ${sw} | liveKey: "${liveKey}"`
        );
        return null;
      }

      // Log post-call pointer to confirm increment
      const postPtr = await client.get(ptrKeyName).catch((): null => null);
      logger.info(
        `[TerminalPool:getNextTerminalId] SELECTED TID: "${tid}" | ` +
        `switch: ${sw} | pointer advanced to: ${postPtr ?? '(read failed)'}`
      );

      return tid;
    } catch (err) {
      logger.err(
        `[TerminalPool:getNextTerminalId] FAILED — switch: ${sw} | ` +
        `error: ${(err as Error).message} | stack: ${(err as Error).stack}`
      );
      return null;
    }
  }

  /**
   * Returns pool status — size, current pointer, and full terminal list.
   */
  async getPoolStatus(switchName: SwitchName): Promise<{
    size: number;
    pointer: number;
    terminals: string[];
  }> {
    const sw      = switchName.toUpperCase();
    const liveKey = this.poolKey(sw);
    const ptrKey  = this.ptrKey(sw);

    logger.info(`[TerminalPool:getPoolStatus] Reading status for switch: ${sw} | key: "${liveKey}"`);

    const client = this.redis.getClient();
    try {
      const [size, ptrRaw, terminals] = await Promise.all([
        client.lLen(liveKey),
        client.get(ptrKey),
        client.lRange(liveKey, 0, -1),
      ]);

      const pointer = ptrRaw ? parseInt(ptrRaw, 10) : 0;
      logger.info(
        `[TerminalPool:getPoolStatus] Result — size: ${size}, pointer: ${pointer}, ` +
        `terminals: [${terminals.join(', ')}]`
      );

      return { size, pointer, terminals };
    } catch (err) {
      logger.err(
        `[TerminalPool:getPoolStatus] FAILED — switch: ${sw} | ` +
        `error: ${(err as Error).message} | stack: ${(err as Error).stack}`
      );
      return { size: 0, pointer: 0, terminals: [] };
    }
  }

  /**
   * Add a single TID to MongoDB and append it to the live Redis list.
   * Does not rebuild the full list — safe to call at any time.
   */
  async addTerminal(
    switchName: SwitchName,
    tid: string
  ): Promise<{ added: boolean; message: string }> {
    const sw      = switchName.toUpperCase();
    const liveKey = this.poolKey(sw);

    logger.info(
      `[TerminalPool:addTerminal] START — TID: "${tid}" | switch: ${sw} | liveKey: "${liveKey}"`
    );

    try {
      // --- Step 1: Duplicate check ---
      logger.info(`[TerminalPool:addTerminal] Checking MongoDB for existing TID "${tid}"...`);
      const existing = await TerminalPoolModel.findOne({ tid });
      if (existing) {
        logger.warn(
          `[TerminalPool:addTerminal] DUPLICATE — TID "${tid}" already exists in MongoDB. ` +
          'No changes made to MongoDB or Redis.'
        );
        return { added: false, message: `TID '${tid}' already exists in the pool` };
      }
      logger.info(`[TerminalPool:addTerminal] TID "${tid}" not found in MongoDB — proceeding with insert`);

      // --- Step 2: Insert into MongoDB ---
      await TerminalPoolModel.create({ tid, lastUsedAt: null });
      logger.info(`[TerminalPool:addTerminal] MongoDB insert OK — TID "${tid}" persisted`);

      // --- Step 3: Append to live Redis list ---
      logger.info(`[TerminalPool:addTerminal] RPUSH "${tid}" → Redis list "${liveKey}"...`);
      const newSize = await this.redis.getClient().rPush(liveKey, tid);
      logger.info(
        `[TerminalPool:addTerminal] COMPLETE — TID "${tid}" added to ${sw} pool. ` +
        `New pool size: ${newSize}`
      );

      return { added: true, message: `TID '${tid}' added successfully` };
    } catch (err) {
      logger.err(
        `[TerminalPool:addTerminal] FAILED — TID: "${tid}" | switch: ${sw} | ` +
        `error: ${(err as Error).message} | stack: ${(err as Error).stack}`
      );
      throw err;
    }
  }

  /**
   * Remove a TID from MongoDB, then rebuild the Redis list from MongoDB.
   * Full rebuild on remove guarantees the list reflects reality exactly.
   */
  async removeTerminal(
    switchName: SwitchName,
    tid: string
  ): Promise<{ removed: boolean; message: string }> {
    const sw = switchName.toUpperCase();

    logger.info(
      `[TerminalPool:removeTerminal] START — TID: "${tid}" | switch: ${sw}`
    );

    try {
      // --- Step 1: Delete from MongoDB ---
      logger.info(`[TerminalPool:removeTerminal] Deleting TID "${tid}" from MongoDB...`);
      const result = await TerminalPoolModel.deleteOne({ tid });

      if (result.deletedCount === 0) {
        logger.warn(
          `[TerminalPool:removeTerminal] NOT FOUND — TID "${tid}" does not exist in MongoDB. ` +
          'No changes made.'
        );
        return { removed: false, message: `TID '${tid}' not found in pool` };
      }

      logger.info(
        `[TerminalPool:removeTerminal] MongoDB delete OK — TID "${tid}" removed ` +
        `(deletedCount: ${result.deletedCount}). Triggering Redis pool rebuild...`
      );

      // --- Step 2: Full Redis rebuild to sync with MongoDB ---
      await this.buildPool(switchName);

      logger.info(
        `[TerminalPool:removeTerminal] COMPLETE — TID "${tid}" removed and pool rebuilt`
      );
      return { removed: true, message: `TID '${tid}' removed and pool rebuilt` };
    } catch (err) {
      logger.err(
        `[TerminalPool:removeTerminal] FAILED — TID: "${tid}" | switch: ${sw} | ` +
        `error: ${(err as Error).message} | stack: ${(err as Error).stack}`
      );
      throw err;
    }
  }

  /**
   * Round-robin over the hardcoded fallback TID list.
   * Used when the live Redis pool is empty or unavailable.
   * Counter is in-process (safe: service runs as a single replica).
   */
  getFallbackTerminalId(): string {
    const idx = this.fallbackPointer % FALLBACK_TIDS.length;
    const tid = FALLBACK_TIDS[idx];
    this.fallbackPointer++;

    logger.warn(
      `[TerminalPool:getFallbackTerminalId] Using fallback TID — ` +
      `selected: "${tid}" | index: ${idx} | pointer now: ${this.fallbackPointer} | ` +
      `fallback pool: [${FALLBACK_TIDS.join(', ')}]`
    );

    return tid;
  }
}

export default TerminalPoolService;
