/* eslint-disable max-len */
import '../pre-start'; // Must be the first import
import net from 'net'
import tls from 'tls'

import logger from '../shared/Logger';
import fs from 'fs';

class SocketClient {
    
    serverPort: any;
    tlsEnabled: boolean;
    tlsSocketOptions: any;
    defaulTLSSocketOptions: any;
    serverHost: any;
    tid: any;

    constructor(host: any, port: any, tlsEnabled = false, tid=""){
        this.serverPort = port
        this.serverHost = host
        this.tlsEnabled = tlsEnabled
        this.tid = tid;
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

            socketClient = new tls.TLSSocket(socketClient, tlsSocketOptions);
            socketClient.setTimeout(timeout);

            socketClient.DEFAULT_MAX_VERSION = 'TLSv1.2';            

            socketClient.connect(this.serverPort, this.serverHost, () => {
                
                if (defaultMessage !== null) {

                    logger.info('Sending message to server:: ' + this.tid + ' => ' + this.serverHost+':' + this.serverPort + ' ==> Message: ' + defaultMessage)
                    socketClient.write(defaultMessage)
                    
                }


            });


            socketClient.on('error', (error: any) => {
                logger.info(`Error occurred during socket connection ${error}`)
            })

            return socketClient;


        } else {

            let socketClient = new net.Socket();

            socketClient.setTimeout(timeout);

            socketClient.connect(this.serverPort, this.serverHost, () => {
                
                if (defaultMessage !== null) {

                    logger.info('Sending message to server:: '+ this.serverHost+':' + this.serverPort + ' ==> Message: ' + defaultMessage)
                    socketClient.write(defaultMessage)
                    
                }


            });

            return socketClient;

        }

        

       



    }
}

export default SocketClient;