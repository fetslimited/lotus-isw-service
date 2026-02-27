import { getWATTimestamp } from "./utils/timezone";
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import path from 'path';
import helmet from 'helmet';

import express, { NextFunction, Request, Response } from 'express';
import StatusCodes from 'http-status-codes';
import 'express-async-errors';

import BaseRouter from './routes';
import logger from './shared/Logger';
import Redis from './database/redis/Redis';
import TerminalPoolService, { SwitchName, FALLBACK_TIDS } from './services/TerminalPoolService';
import mongoose from 'mongoose';

const app = express();
const { BAD_REQUEST } = StatusCodes;



/************************************************************************************
 *                              Set basic express settings
 ***********************************************************************************/

app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(cookieParser());

if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev', {
        skip: (req: Request) => req.url === '/health'
    }));
}

// Security
if (process.env.NODE_ENV === 'production') {
    app.use(helmet());
}

// Health check endpoint
app.get('/health', async (req: Request, res: Response) => {
    const redis = Redis.getInstance();
    const connectedFlag = redis.getConnectionStatus();

    // Live PING — confirms Redis is actually reachable right now,
    // not just that the in-memory flag believes it is.
    let pingOk = false;
    let pingError: string | null = null;
    try {
        const pong = await redis.getClient().ping();
        pingOk = pong === 'PONG';
    } catch (err: any) {
        pingError = err.message;
    }

    // Terminal pool state — what TIDs will transactions actually use?
    let poolSize = 0;
    let poolPointer: number | null = null;
    let poolTerminals: string[] = [];
    let poolError: string | null = null;
    if (pingOk) {
        try {
            const status = await TerminalPoolService.getInstance()
                .getPoolStatus(SwitchName.INTERSWITCH);
            poolSize      = status.size;
            poolPointer   = status.pointer;
            poolTerminals = status.terminals;
        } catch (err: any) {
            poolError = err.message;
        }
    }

    // MongoDB connection state
    const mongoState = mongoose.connection.readyState;
    // 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
    const mongoStateMap: Record<number, string> = {
        0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting',
    };
    const mongoConnected = mongoState === 1;

    const tidSource = (pingOk && poolSize > 0) ? 'pool' : 'fallback';

    res.status(200).json({
        status: 'healthy',
        service: 'isw-service',
        timestamp: getWATTimestamp(),
        uptime: Math.floor(process.uptime()),
        redis: {
            connected: connectedFlag,
            pingOk,
            host: process.env.REDIS_HOST || '127.0.0.1',
            port: process.env.REDIS_PORT || '6379',
            ...(pingError ? { error: pingError } : {}),
        },
        mongodb: {
            connected: mongoConnected,
            state: mongoStateMap[mongoState] ?? 'unknown',
            ...(mongoConnected ? {
                host: mongoose.connection.host,
                port: mongoose.connection.port,
                db: mongoose.connection.name,
            } : {}),
        },
        terminalPool: {
            tidSource,
            poolSize,
            poolPointer,
            poolTerminals,
            fallbackPool: FALLBACK_TIDS,
            ...(poolError ? { poolError } : {}),
        },
    });
});

// Add APIs
app.use('/api', BaseRouter);

// Print API errors
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.err(err, true);
    return res.status(BAD_REQUEST).json({
        error: err.message,
    });
});



/************************************************************************************
 *                              Serve front-end content
 ***********************************************************************************/

const viewsDir = path.join(__dirname, 'views');
app.set('views', viewsDir);
const staticDir = path.join(__dirname, 'public');
app.use(express.static(staticDir));
app.get('*', (req: Request, res: Response) => {
    res.sendFile('index.html', {root: viewsDir});
});

// Export express instance
export default app;
