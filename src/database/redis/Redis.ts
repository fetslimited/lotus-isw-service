import '../../pre-start';
import { createClient } from 'redis';

import logger from '../../shared/Logger';

class Redis{

    private static instance: Redis;
    client: any;
    private isConnected: boolean = false;
    private connectionPromise: Promise<void> | null = null;

    private constructor(){
        const tlsEnabled = process.env.REDIS_TLS !== 'false';
        const host = process.env.REDIS_HOST || '127.0.0.1';
        const port = Number(process.env.REDIS_PORT) || 6379;

        // Warn when REDIS_HOST is not explicitly set — silently defaulting to
        // localhost in production means the secret did not inject correctly.
        if (!process.env.REDIS_HOST) {
            logger.warn(
                'Redis: REDIS_HOST is not set — defaulting to 127.0.0.1. ' +
                'If this is production, check that the REDIS_HOST secret is injected correctly.'
            );
        }

        // Warn when TLS state is not explicitly configured. The default is
        // TLS ON (process.env.REDIS_TLS !== "false"), which will cause a
        // TLS handshake error against a plain Redis. Set REDIS_TLS=false to disable.
        if (process.env.REDIS_TLS === undefined) {
            logger.warn(
                'Redis: REDIS_TLS is not set — TLS is ENABLED by default. ' +
                'Set REDIS_TLS=false if your Redis does not use TLS (e.g. local dev or plain ElastiCache).'
            );
        }

        const redisConfig: any = {
            socket: { host, port, tls: tlsEnabled }
        };

        // Add password if configured
        if (process.env.REDIS_PASSWORD) {
            redisConfig.password = process.env.REDIS_PASSWORD;
            logger.info('Redis: Authentication enabled');
        } else {
            logger.info('Redis: No password configured (authentication disabled)');
        }

        logger.info(
            `Redis: Connecting to ${host}:${port} | TLS: ${tlsEnabled} | ` +
            `Auth: ${process.env.REDIS_PASSWORD ? 'yes' : 'no'}`
        );

        this.client = createClient(redisConfig);

        // Enhanced error handling
        this.client.on('error', (err: any) => {
            logger.err('Redis Client Error: ' + err.message);
            this.isConnected = false;
        });

        this.client.on('connect', () => {
            logger.info('Redis Client Connected to ' + redisConfig.socket.host + ':' + redisConfig.socket.port);
            this.isConnected = true;
        });

        this.client.on('disconnect', () => {
            logger.warn('Redis Client Disconnected');
            this.isConnected = false;
        });

        this.client.on('reconnecting', () => {
            logger.info('Redis Client Reconnecting...');
        });
    }

    /**
     * Get singleton instance of Redis
     */
    static getInstance(): Redis {
        if (!Redis.instance) {
            Redis.instance = new Redis();
        }
        return Redis.instance;
    }

    getClient(){
        return this.client
    }

    async connect(){
        // If already connected, return immediately
        if (this.isConnected && this.client.isOpen) {
            return;
        }

        // If connection is in progress, wait for it
        if (this.connectionPromise) {
            return this.connectionPromise;
        }

        // Start new connection
        this.connectionPromise = this.client.connect()
            .then(() => {
                this.isConnected = true;
                this.connectionPromise = null;
                logger.info('Redis connection established successfully');
            })
            .catch((err: any) => {
                this.connectionPromise = null;
                this.isConnected = false;
                logger.err('Redis connection failed: ' + err.message);
                throw err;
            });

        return this.connectionPromise;
    }

    getConnectionStatus(){
        return this.isConnected && this.client.isOpen;
    }

    async save(key: any, value: any){
        return await this.client.set(key, value, function(err: any, reply: any) {
            logger.info(`REDIS: Key ${key} save request <=> Reply => ${reply}, Err => ${err}`)
        });
    }

    async get(key: any){
        return await this.client.get(key, function(err: any, reply: any) {
            logger.info(`REDIS: Key ${key} get request <=> Reply => ${reply}, Err => ${err}`)
        });
    }

    async delete(key: any){
        return await this.client.del(key, function(err: any, reply: any) {
            logger.info(`REDIS: Key ${key} delete request <=> Reply => ${reply}, Err => ${err}`)
        });
    }

    async iskeyExists(key: any){
        return await this.client.exists(key, function(err: any, reply: any) {
            console.log(`REDIS: Key ${key} exists request <=> Reply => ${reply}, Err => ${err}`)
            if (reply === 1) {
                return true
            } else {
                return false
            }
        });
    }

}

export default Redis