/* eslint-disable */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import '../pre-start'; // Must be the first import
import Pm2Io from '@pm2/io'
import SocketServer from './socketServer'
import SocketServerHandler from './socketServerHandler'
import SocketClient from './socketClient';
const cron =  require('node-cron')
import logger from '../shared/Logger';

// Global socket handler instance
let globalSocketServerHandler: SocketServerHandler | null = null;

/**
 * Get the global socket server handler instance
 * @returns SocketServerHandler instance or null
 */
export function getSocketServerHandler(): SocketServerHandler | null {
    return globalSocketServerHandler;
}

class deploySocketService {


    public runPlainSocketServer(): void {

        const plainSocketServer = new SocketServer(process.env.SOCKET_SERVER_PORT_PLAIN, false);
    
        const plainSocketServerInstance = plainSocketServer.startSocketServer();
    
        let plainSocketServerHandler = new SocketServerHandler(plainSocketServerInstance, false);
    
        // Store reference globally
        globalSocketServerHandler = plainSocketServerHandler;
    
        plainSocketServerHandler.handleSocketServerInstance();

        cron.schedule('*/55 * * * * *', function() {
            logger.info('Interswitch ECHO task schedule RUNNING on PID >>>> ');
            plainSocketServerHandler.doEcho()
        });
    }
    
    public runTLSSocketServer(): void {
    
        let tlsSocketServer = new SocketServer(process.env.SOCKET_SERVER_PORT_TLS, true);
    
        let tlsSocketServerInstance = tlsSocketServer.startSocketServer();
    
        let tlsSocketServerHandler = new SocketServerHandler(tlsSocketServerInstance, true);
    
        tlsSocketServerHandler.handleSocketServerInstance();
    
    }

    public runSocketClient(msg: any, serverIp = "", serverPort = ""){
        const socketServerIP = (serverIp == "") ? process.env.SOCKET_SERVER_IP : serverIp
        const socketServerPort = (serverPort == "") ? process.env.SOCKET_SERVER_PORT_PLAIN : serverPort
        let SocketClientHandle = new SocketClient(socketServerIP, socketServerPort)

        return SocketClientHandle.startClient(msg)
    }

    public runEchoService(){

    }
}

export default deploySocketService;