import logger from '../shared/Logger';
import Redis from '../database/redis/Redis';

// Enum of supported switch names
export enum SwitchName {
  INTERSWITCH = 'INTERSWITCH'
}

/**
 * TerminalPoolService
 * Responsibilities:
 *  - Build an in-memory/Redis backed pool of transacting terminal IDs that satisfy criteria
 *  - Criteria: status=ACTIVE, isTerminalPrepped=true, lastTerminalPrep within current day
 *  - Store pool in Redis as a LIST and maintain a ROUND-ROBIN pointer using atomic LUA or RPOPLPUSH
 *  - Refresh on service start and every midnight without clearing pool until replacement list ready
 */
class TerminalPoolService {
  private static instance: TerminalPoolService;
  private redis: Redis;
  // Dynamic key builders (per switch)
  private poolKey = (sw: string) => `terminal_pool:${sw}:list`;
  private stagingKey = (sw: string) => `terminal_pool:${sw}:list:staging`;
  private ptrKey = (sw: string) => `terminal_pool:${sw}:pointer`;
  // maintain compatibility placeholder for any legacy lock usage (not per switch yet)
  private readonly LOCK_KEY = 'terminal_pool:lock:rebuild_all';
  private rebuildInProgress = false;

  private constructor(){
    this.redis = Redis.getInstance();
  }

  static getInstance(){
    if(!this.instance){
      this.instance = new TerminalPoolService();
    }
    return this.instance;
  }

  /**
   * Round-robin fetch without losing element. Uses pointer index modulo list length.
   * Uses Lua for atomic read+increment to avoid race under concurrency.
   */
  async getNextTerminalId(switchName: SwitchName): Promise<string | null>{
    const sw = switchName.toUpperCase();
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
      const result = await client.eval(lua, { keys: [this.poolKey(sw), this.ptrKey(sw)], arguments: [] });
      return result as string || null;
    } catch(err){
      logger.err('TerminalPoolService getNextTerminalId error: ' + (err as Error).message);
      return null;
    }
  }
}

export default TerminalPoolService;
