/* eslint-disable no-console */
/* eslint-disable max-len */
import '../pre-start'; // Must be the first import
import net from 'net'
import tls from 'tls'
import fs = require('fs');
class SocketServer {

    serverPort: any;
    tlsEnabled: boolean;
    tlsSocketOptions: any;
    defaulTLSSocketOptions: any;

    constructor(port: any, tlsEnabled = false){
        this.serverPort = port
        this.tlsEnabled = tlsEnabled

        if (this.tlsEnabled === true) {

            this.tlsSocketOptions = {
                key: fs.readFileSync(process.env.SSL_KEY_PATH || '/app/certs/iso.cbimonie.com.key', 'utf-8'),
                cert: fs.readFileSync(process.env.SSL_CERT_PATH || '/app/certs/iso.cbimonie.com.pem', 'utf-8'),
                ca: [ fs.readFileSync(process.env.SSL_CA_PATH || '/app/certs/gd_bundle-g2.crt', 'utf-8') ],
                requestCert: false,
                rejectUnauthorized: false,
                minVersion : 'TLSv1.3',
                maxVersion : 'TLSv1.3'
            }

        }
    }

    public startSocketServer(){

        let socketServerResource;

        if (this.tlsEnabled === true) {

            socketServerResource = tls.createServer(this.tlsSocketOptions);

        } else {

            socketServerResource = net.createServer();

        }

        socketServerResource.listen(this.serverPort, (): void => {
            console.log('ISW service socket server started and running on PORT ' + this.serverPort + ' TLS: ' + this.tlsEnabled)
        });

        return socketServerResource;
    }
}

export default SocketServer;