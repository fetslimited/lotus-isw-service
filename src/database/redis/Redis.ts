import '../../pre-start';
import { createClient } from 'redis';

import logger from '../../shared/Logger';

class Redis{

    private static instance: Redis;
    client: any;
    private isConnected: boolean = false;
    private connectionPromise: Promise<void> | null = null;

    private constructor(){
        const redisConfig: any = {
            socket: {
                host: process.env.REDIS_HOST || '127.0.0.1',
                port: Number(process.env.REDIS_PORT) || 6379,
                tls: process.env.REDIS_TLS !== 'false'
            }
        };

        // Add password if configured
        if (process.env.REDIS_PASSWORD) {
            redisConfig.password = process.env.REDIS_PASSWORD;
            logger.info('Redis: Authentication enabled');
        } else {
            logger.info('Redis: No password configured (authentication disabled)');
        }

        logger.info(`Redis: Connecting to ${redisConfig.socket.host}:${redisConfig.socket.port} (TLS: ${redisConfig.socket.tls})`);

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