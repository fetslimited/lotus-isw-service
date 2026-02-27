import { getWATTimestamp } from '../../utils/timezone';
import { Request, Response } from 'express';
import StatusCodes from 'http-status-codes';
import logger from '../../shared/Logger';
import TerminalPoolService, { SwitchName } from '../../services/TerminalPoolService';

const { OK, BAD_REQUEST, INTERNAL_SERVER_ERROR } = StatusCodes;

/**
 * GET /api/interswitch/terminal-pool/status
 * Returns the current pool contents and round-robin pointer.
 */
export async function getPoolStatus(req: Request, res: Response) {
    logger.info('[TerminalPoolController:getPoolStatus] Request received');
    try {
        const status = await TerminalPoolService.getInstance().getPoolStatus(SwitchName.INTERSWITCH);
        logger.info(
            `[TerminalPoolController:getPoolStatus] Returning pool status — ` +
            `size: ${status.size}, pointer: ${status.pointer}, ` +
            `terminals: [${status.terminals.join(', ')}]`
        );
        return res.status(OK).json({
            success: true,
            switch: SwitchName.INTERSWITCH,
            ...status,
            timestamp: getWATTimestamp(),
        });
    } catch (error: any) {
        logger.err(
            '[TerminalPoolController:getPoolStatus] FAILED — ' +
            'error: ' + error.message + ' | stack: ' + error.stack
        );
        return res.status(INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to get terminal pool status',
            error: error.message,
        });
    }
}

/**
 * POST /api/interswitch/terminal-pool/rebuild
 * Reload Redis pool from MongoDB (safe atomic swap via staging key).
 */
export async function rebuildPool(req: Request, res: Response) {
    logger.info('[TerminalPoolController:rebuildPool] Manual rebuild triggered via HTTP endpoint');
    try {
        await TerminalPoolService.getInstance().buildPool(SwitchName.INTERSWITCH);
        const status = await TerminalPoolService.getInstance().getPoolStatus(SwitchName.INTERSWITCH);
        logger.info(
            `[TerminalPoolController:rebuildPool] Rebuild complete — ` +
            `pool size: ${status.size}, terminals: [${status.terminals.join(', ')}]`
        );
        return res.status(OK).json({
            success: true,
            message: 'Terminal pool rebuilt successfully',
            size: status.size,
            terminals: status.terminals,
            timestamp: getWATTimestamp(),
        });
    } catch (error: any) {
        logger.err(
            '[TerminalPoolController:rebuildPool] FAILED — ' +
            'error: ' + error.message + ' | stack: ' + error.stack
        );
        return res.status(INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to rebuild terminal pool',
            error: error.message,
        });
    }
}

/**
 * POST /api/interswitch/terminal-pool
 * Body: { "tid": "<ISW terminal ID>" }
 * Add a single TID to the pool (MongoDB + Redis append).
 */
export async function addTerminal(req: Request, res: Response) {
    const { tid } = req.body;
    logger.info(
        `[TerminalPoolController:addTerminal] Request received — ` +
        `body tid: "${tid ?? '(missing)'}"`
    );

    try {
        if (!tid || typeof tid !== 'string' || tid.trim() === '') {
            logger.warn(
                '[TerminalPoolController:addTerminal] Bad request — ' +
                '"tid" is missing or empty in request body'
            );
            return res.status(BAD_REQUEST).json({
                success: false,
                message: 'Request body must include a non-empty "tid" string',
            });
        }

        const trimmedTid = tid.trim();
        logger.info(`[TerminalPoolController:addTerminal] Calling addTerminal for TID: "${trimmedTid}"`);

        const result = await TerminalPoolService.getInstance()
            .addTerminal(SwitchName.INTERSWITCH, trimmedTid);

        const statusCode = result.added ? OK : BAD_REQUEST;
        logger.info(
            `[TerminalPoolController:addTerminal] Result — added: ${result.added}, ` +
            `message: "${result.message}", httpStatus: ${statusCode}`
        );

        return res.status(statusCode).json({
            success: result.added,
            message: result.message,
            timestamp: getWATTimestamp(),
        });
    } catch (error: any) {
        logger.err(
            `[TerminalPoolController:addTerminal] FAILED — TID: "${tid}" | ` +
            'error: ' + error.message + ' | stack: ' + error.stack
        );
        return res.status(INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to add terminal to pool',
            error: error.message,
        });
    }
}

/**
 * DELETE /api/interswitch/terminal-pool/:tid
 * Remove a TID from the pool (MongoDB delete + Redis rebuild).
 */
export async function removeTerminal(req: Request, res: Response) {
    const { tid } = req.params;
    logger.info(
        `[TerminalPoolController:removeTerminal] Request received — ` +
        `param tid: "${tid ?? '(missing)'}"`
    );

    try {
        if (!tid || tid.trim() === '') {
            logger.warn(
                '[TerminalPoolController:removeTerminal] Bad request — ' +
                'tid param is missing or empty'
            );
            return res.status(BAD_REQUEST).json({
                success: false,
                message: 'A non-empty TID must be provided in the URL path',
            });
        }

        const trimmedTid = tid.trim();
        logger.info(
            `[TerminalPoolController:removeTerminal] Calling removeTerminal for TID: "${trimmedTid}"`
        );

        const result = await TerminalPoolService.getInstance()
            .removeTerminal(SwitchName.INTERSWITCH, trimmedTid);

        const statusCode = result.removed ? OK : BAD_REQUEST;
        logger.info(
            `[TerminalPoolController:removeTerminal] Result — removed: ${result.removed}, ` +
            `message: "${result.message}", httpStatus: ${statusCode}`
        );

        return res.status(statusCode).json({
            success: result.removed,
            message: result.message,
            timestamp: getWATTimestamp(),
        });
    } catch (error: any) {
        logger.err(
            `[TerminalPoolController:removeTerminal] FAILED — TID: "${tid}" | ` +
            'error: ' + error.message + ' | stack: ' + error.stack
        );
        return res.status(INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to remove terminal from pool',
            error: error.message,
        });
    }
}
