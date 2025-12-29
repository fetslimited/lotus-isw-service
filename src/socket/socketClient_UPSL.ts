/* eslint-disable max-len */
import '../pre-start'; // Must be the first import
import net from 'net'
import tls from 'tls'

import logger from '../shared/Logger';
import fs from 'fs';
import Redis from '../database/redis/Redis'

class SocketClient {
    
    serverPort: any;
    tlsEnabled: boolean;
    tlsSocketOptions: any;
    defaulTLSSocketOptions: any;
    serverHost: any;
    tid: any;
    socketClient: any;
    redis: any
    redisKey: string;

    constructor(host: any, port: any, tlsEnabled = false, tid=""){
        this.serverPort = port
        this.serverHost = host
        this.tlsEnabled = tlsEnabled
        this.tid = tid;
        this.redis = Redis.getInstance();
        this.redisKey = 'upsl_socket';
        this.socketClient = null;
        if (this.tlsEnabled === true) {
            this.tlsSocketOptions = {

                key: fs.readFileSync('/var/www/certs/privkey.pem'),
                cert: fs.readFileSync('/var/www/certs/fullchain.pem'),
                // ca: [ fs.readFileSync('ca-cert.pem') ],
                //requestCert: false,
                rejectUnauthorized: false

            }
        }
    }

    reUseClient(socketClient: any, defaultMessage: any){
        logger.info("Upsl: Re-using PREVIOUS socket connection ---- " );

        if (defaultMessage !== null) {
            logger.info('Upsl: Writing message to server:: ' + this.tid + ' => ' + this.serverHost+':' + this.serverPort + ' ==> Message: ' + defaultMessage)
            
            socketClient.write(defaultMessage)
        }

        return socketClient
    }
        /**
     * 
     * @param {*} defaultMessage data to be sent
     * @param {*} timeout request timeout
     */
    startClient(defaultMessage: any, timeout=50000) {

        if (this.tlsEnabled === true) {

            let socketClient: any;

            const { constants } = require('crypto')
            const tlsSocketOptions: any = {

                key: fs.readFileSync('/var/www/certs/privkey.pem'),
                cert: fs.readFileSync('/var/www/certs/fullchain.pem'),
                // ca: [ fs.readFileSync('ca-cert.pem') ],
                requestCert: false,
                rejectUnauthorized: false,
                enableTrace: true,
                secureOptions: constants.SSL_OP_NO_TLSv1

            }

            logger.info("Using TLS ---- " );

            logger.info("Interswitch: Starting NEW socket connection ---- " );

            socketClient = new tls.TLSSocket(socketClient, tlsSocketOptions);
            //socketClient.setTimeout(timeout);   
            socketClient.DEFAULT_MAX_VERSION = 'TLSv1.2';            

            socketClient.connect(this.serverPort, this.serverHost, () => {
                //socketClient.setTimeout(timeout);
                if (defaultMessage !== null) {

                    logger.info('Writing message to server:: ' + this.tid + ' => ' + this.serverHost+':' + this.serverPort + ' ==> Message: ' + defaultMessage)
                    socketClient.write(defaultMessage)
                    
                }

            });

            socketClient.on('error', (error: any) => {
                logger.info(`Error occurred during socket connection ${error}`)
            })

            return socketClient;

        } else {

            let socketClient = new net.Socket();

            logger.info("Interswitch: Starting NEW socket connection ---- " );

            //socketClient.setTimeout(timeout);

            socketClient.connect(this.serverPort, this.serverHost, () => {
                
                if (defaultMessage !== null) {

                    logger.info('Interswitch: Sending message to server:: '+ this.serverHost+':' + this.serverPort + ' ==> Message: ' + defaultMessage)
                    socketClient.write(defaultMessage)
                    
                }


            });

            socketClient.setKeepAlive(true, 0)

            return socketClient;
            

        } 

    }
}

export default SocketClient;