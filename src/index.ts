/* eslint-disable no-console */
import './pre-start'; // Must be the first import
import app from './Server';
import deploySocketService from './socket/deploySocketService'
import Interswitch from './controller/switchHandlers/Interswitch';
import Upsl from './controller/switchHandlers/Upsl';
import logger from './shared/Logger';
import Redis from './database/redis/Redis';

const socketServiceInstance = new deploySocketService()
const cron =  require('node-cron')

// Initialize Redis connection at startup
async function initializeApp() {
    try {
        // Connect to Redis
        logger.info('Initializing Redis connection...');
        const redis = Redis.getInstance();
        await redis.connect();
        logger.info('Redis initialized successfully');
    } catch (error: any) {
        logger.err('Failed to initialize Redis: ' + error.message);
        logger.warn('Application will continue but Redis-dependent features may not work');
    }

    // Start the HTTP server
    const port = Number(process.env.PORT || 3000);
    app.listen(port, () => {
        console.log('Express server started on port: ' + port);
    });

    // Deploy the plain socket service
    socketServiceInstance.runPlainSocketServer()

    // // Deploy the secure socket service
    // socketServiceInstance.runTLSSocketServer()
}

// Start the application
initializeApp().catch((error) => {
    logger.err('Failed to start application: ' + error.message);
    process.exit(1);
});



