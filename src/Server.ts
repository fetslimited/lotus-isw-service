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
app.get('/health', (req: Request, res: Response) => {
    const redis = Redis.getInstance();
    const redisStatus = redis.getConnectionStatus();
    
    res.status(200).json({
        status: 'healthy',
        service: 'isw-service',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        redis: {
            connected: redisStatus,
            host: process.env.REDIS_HOST || '127.0.0.1',
            port: process.env.REDIS_PORT || '6379'
        }
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
