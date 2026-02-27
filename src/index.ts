/* eslint-disable no-console */
import './pre-start'; // Must be the first import
import app from './Server';
import deploySocketService from './socket/deploySocketService'
import Interswitch from './controller/switchHandlers/Interswitch';
import Upsl from './controller/switchHandlers/Upsl';
import logger from './shared/Logger';
import Redis from './database/redis/Redis';
import TerminalPoolService, { SwitchName } from './services/TerminalPoolService';
import mongoose from 'mongoose';

const socketServiceInstance = new deploySocketService()
const cron =  require('node-cron')

async function initializeApp() {
    // --- Connect Redis ---
    let redisReady = false;
    // Pre-flight: log the resolved config before attempting connection so any
    // misconfiguration (wrong host, unexpected TLS state) is visible in startup logs.
    logger.info(
        'Redis config — host: ' + (process.env.REDIS_HOST || '127.0.0.1 (default)') +
        ' | port: ' + (process.env.REDIS_PORT || '6379 (default)') +
        ' | TLS: ' + (process.env.REDIS_TLS !== undefined ? process.env.REDIS_TLS : 'not set (defaults to enabled)') +
        ' | auth: ' + (process.env.REDIS_PASSWORD ? 'configured' : 'not configured')
    );
    try {
        logger.info('Initializing Redis connection...');
        const redis = Redis.getInstance();
        await redis.connect();
        redisReady = true;
        logger.info('Redis initialized successfully');
    } catch (error: any) {
        logger.err('Failed to initialize Redis: ' + error.message);
        logger.warn('Application will continue but Redis-dependent features may not work');
    }

    // --- Connect MongoDB ---
    let mongoReady = false;
    const mongoUri = process.env.DB;
    if (!mongoUri) {
        logger.warn('DB environment variable is not set — MongoDB will not connect. ' +
            'Terminal pool seeding and CRUD operations will be unavailable.');
    } else {
        try {
            logger.info('Initializing MongoDB connection...');
            await mongoose.connect(mongoUri, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                useCreateIndex: true,
                useFindAndModify: false,
                serverSelectionTimeoutMS: 10000,
            } as any);
            mongoReady = true;
            logger.info('MongoDB initialized successfully — host: ' +
                mongoose.connection.host + ':' + mongoose.connection.port +
                ' | db: ' + mongoose.connection.name);
        } catch (error: any) {
            logger.err('Failed to initialize MongoDB: ' + error.message);
            logger.warn('Application will continue but terminal pool seeding will be unavailable');
        }
    }

    // --- Build terminal pool (requires both Redis and MongoDB) ---
    if (redisReady && mongoReady) {
        try {
            await TerminalPoolService.getInstance().buildPool(SwitchName.INTERSWITCH);
            logger.info('Terminal pool initialized successfully');
        } catch (poolErr: any) {
            logger.warn('Terminal pool build failed — fallback TID will be used: ' + poolErr.message);
        }
    } else {
        logger.warn(
            'Terminal pool skipped — ' +
            (!redisReady ? 'Redis not ready' : 'MongoDB not ready') +
            '. Fallback TID round-robin will be used for transactions.'
        );
    }

    // --- Start the HTTP server ---
    const port = Number(process.env.PORT || 3000);
    app.listen(port, () => {
        console.log('Express server started on port: ' + port);
    });

    // Deploy the plain socket service
    socketServiceInstance.runPlainSocketServer()

    // // Deploy the secure socket service
    // socketServiceInstance.runTLSSocketServer()

    // Rebuild terminal pool every midnight
    cron.schedule('0 0 * * *', async () => {
        logger.info('[CRON] Midnight terminal pool rebuild starting...');
        try {
            await TerminalPoolService.getInstance().buildPool(SwitchName.INTERSWITCH);
            logger.info('[CRON] Terminal pool rebuild complete');
        } catch (err: any) {
            logger.err('[CRON] Terminal pool rebuild failed: ' + err.message);
        }
    });
}

logger.info('isw-service build: 2026-02-17 — getExtraParams null guard applied');

// Start the application
initializeApp().catch((error) => {
    logger.err('Failed to start application: ' + error.message);
    process.exit(1);
});



