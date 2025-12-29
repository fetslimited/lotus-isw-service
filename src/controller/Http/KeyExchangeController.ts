/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Request, Response } from 'express';
import StatusCodes from 'http-status-codes';
import logger from '../../shared/Logger';
import { getSocketServerHandler } from '../../socket/deploySocketService';
import Redis from '../../database/redis/Redis';

const { OK, INTERNAL_SERVER_ERROR, SERVICE_UNAVAILABLE } = StatusCodes;

/**
 * Trigger key exchange with Interswitch
 * @param req 
 * @param res 
 * @returns 
 */
export async function triggerKeyExchange(req: Request, res: Response) {
    try {
        logger.info('Key exchange triggered via HTTP endpoint');

        const socketHandler = getSocketServerHandler();
        
        if (!socketHandler) {
            logger.err('Socket server handler not available');
            return res.status(SERVICE_UNAVAILABLE).json({
                success: false,
                message: 'Socket server handler is not initialized',
            });
        }

        // Trigger key exchange
        socketHandler.doKeyExchange();

        logger.info('Key exchange request sent successfully');

        return res.status(OK).json({
            success: true,
            message: 'Key exchange triggered successfully',
            timestamp: new Date().toISOString(),
        });

    } catch (error: any) {
        logger.err('Error triggering key exchange: ' + error.stack);
        return res.status(INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to trigger key exchange',
            error: error.message,
        });
    }
}

/**
 * Trigger echo request to Interswitch
 * @param req 
 * @param res 
 * @returns 
 */
export async function triggerEcho(req: Request, res: Response) {
    try {
        logger.info('Echo request triggered via HTTP endpoint');

        const socketHandler = getSocketServerHandler();
        
        if (!socketHandler) {
            logger.err('Socket server handler not available');
            return res.status(SERVICE_UNAVAILABLE).json({
                success: false,
                message: 'Socket server handler is not initialized',
            });
        }

        // Trigger echo
        await socketHandler.doEcho();

        logger.info('Echo request sent successfully');

        return res.status(OK).json({
            success: true,
            message: 'Echo request triggered successfully',
            timestamp: new Date().toISOString(),
        });

    } catch (error: any) {
        logger.err('Error triggering echo: ' + error.stack);
        return res.status(INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to trigger echo',
            error: error.message,
        });
    }
}

/**
 * Get socket server status
 * @param req 
 * @param res 
 * @returns 
 */
export async function getSocketStatus(req: Request, res: Response) {
    try {
        const socketHandler = getSocketServerHandler();
        const redis = Redis.getInstance();
        const redisStatus = redis.getConnectionStatus();
        
        if (!socketHandler) {
            return res.status(SERVICE_UNAVAILABLE).json({
                success: false,
                message: 'Socket server handler is not initialized',
                status: 'unavailable',
                redis: {
                    connected: redisStatus
                }
            });
        }

        return res.status(OK).json({
            success: true,
            status: 'available',
            socketClosed: socketHandler.iswSocketInstanceClosed,
            redis: {
                connected: redisStatus,
                host: process.env.REDIS_HOST || '127.0.0.1',
                port: process.env.REDIS_PORT || '6379'
            },
            timestamp: new Date().toISOString(),
        });

    } catch (error: any) {
        logger.err('Error getting socket status: ' + error.stack);
        return res.status(INTERNAL_SERVER_ERROR).json({
            success: false,
            message: 'Failed to get socket status',
            error: error.message,
        });
    }
}
