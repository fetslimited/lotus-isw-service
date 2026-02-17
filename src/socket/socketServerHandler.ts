/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import '../pre-start'; // Must be the first import
import logger from '../shared/Logger';
import Pm2Io from '@pm2/io'
import handleCardTransactions from '../controller/Transaction/handleCardTransactions';
import { isISORequest, determineRequestType, checkDisabledTerminal, decideSwitch, validateAmount, validateNonZeroAmount } from '../shared/validators';
import cISO8583 from '../ciso8583/CISO'
import handleVas from '../controller/Transaction/handleVas'
import Interswitch from '../controller/switchHandlers/Interswitch';
import Upsl from '../controller/switchHandlers/Upsl';
import { getNibssResponseMessageFromCode } from '../utils/responseUtil'
import net from 'net'
import { updateSwitchStatus, getSlackMessage } from '../utils/data'
import { sendSlackMessage } from '../utils/notifySlack'
import { ITransactionDetails } from '../database/interface/i_transaction_details';


//let clients: any = {}
class SocketServerHandler {

    socketServerInstance: any;
    requestMeter: any;
    tlsEnabled: any;
    requestData: any;
    defaultTerminalSerialNo: any = '100000001';
    defaultTerminalId: any = '203401FR'
    socketInstanceClosed: any;
    iswSocketInstanceClosed: any;
    handleCardTransaction: any
    appEnv: any
    RawISOMessage: any;
    ISOMessage: any;
    iso8583Parser: any;
    unpackedMessage: any
    transactionDetails: any
    handler: any
    terminalData: any
    Nibss: any
    logger: any;
    serverPort: any;
    serverHost: any;
    iswClient: any;
    clientName: any;
    Interswitch: any;
    clients: any;
    socket: any;
 
    constructor(socketServerInstance: any, tlsEnabled = false, ...options: any){
        this.socketServerInstance = socketServerInstance
        this.requestMeter = Pm2Io.meter({
            name: 'req/sec'
        })
        this.tlsEnabled = tlsEnabled;
        this.socketInstanceClosed = false;
        this.appEnv = process.env.NODE_ENV
        this.iso8583Parser = new cISO8583();
        this.handleCardTransaction = new handleCardTransactions()
        this.serverHost = process.env.ISW_IP
        this.serverPort = process.env.ISW_PORT
        this.iswClient = null
        this.clientName = 'ISW-POSTBRIDGE'
        this.Interswitch = new Interswitch()
        this.clients = {}
        this.iswSocketInstanceClosed = false

        this.setUpIswClient()

    }

    setUpIswClient() {
        logger.info(`[ISW-SERVER] setUpIswClient — connecting to Interswitch at ${this.serverHost}:${this.serverPort}`);
        this.iswClient = new net.Socket()

        this.iswClient.connect(this.serverPort, this.serverHost, () => {

            logger.info(`[ISW-SERVER] Connected to ${this.clientName} on ${this.serverHost}:${this.serverPort} successfully`)
            this.iswSocketInstanceClosed = false
            // updateSwitchStatus('UP')

              // Sign on
            this.sleep(2000).then(() => {
                logger.info('[ISW-SERVER] Initiating sign-on with Interswitch');
                this.doSignOn()
            });

            // Key Exchange
            this.sleep(8000).then(() => {
                logger.info('[ISW-SERVER] Initiating key exchange with Interswitch');
                this.doKeyExchange()
            });

        });

        this.iswClient.setKeepAlive(true, 1000);

        this.iswClient.on('end', () => {
            logger.info('[ISW-SERVER] Interswitch socket END — connection half-closed by remote');
            this.iswSocketInstanceClosed = true
            // updateSwitchStatus('DOWN')
        });

        this.iswClient.on('close', (hadError: boolean) => {
            logger.info(`[ISW-SERVER] Interswitch socket CLOSE — hadError: ${hadError}, iswSocketInstanceClosed: ${this.iswSocketInstanceClosed}`);
        });

        this.iswClient.on('error', (err: any) => {
            this.iswSocketInstanceClosed = true
            logger.err(`[ISW-SERVER] ERROR on Interswitch socket — ${err}. Will attempt reconnect in 3s.`);
            this.handleSocketClientError()
            // updateSwitchStatus('DOWN')
        })

        this.iswClient.on('data', async (data: any) => {            
            await this.handleSocketData(data)
        })

        return this.iswClient;
    }

    handleSocketClientError(){
        logger.info('[ISW-SERVER] handleSocketClientError — scheduling reconnect to Interswitch in 3s');
        this.sleep(3000).then(() => {
            logger.info('[ISW-SERVER] Attempting reconnect to Interswitch now...');
            this.iswClient.end()
            this.setUpIswClient()
        })
    }

    sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async handleSocketData(data: any){
        // if(this.iswSocketInstanceClosed){
        //     this.setUpIswClient()
        // }

        data = Buffer.from(data).toString('hex');
        logger.info(`[ISW-SERVER] Interswitch response received at ${new Date()} — hex length: ${data.length} chars`);

        const unpackedMessage = this.Interswitch.unpackMessage(data)

        logger.info(`[ISW-SERVER] Unpacked Interswitch response: ${JSON.stringify(unpackedMessage)}`);

        const MTI = this.Interswitch.getFieldValue(unpackedMessage, 0)
        logger.info(`[ISW-SERVER] Response MTI: ${MTI}`);

        if(MTI == '0210'){
            // await updateSwitchStatus('UP')
            const responseCode = this.Interswitch.getFieldValue(unpackedMessage, 39);
            logger.info(`[ISW-SERVER] 0210 Purchase Response — response code: ${responseCode}`)
            const mappedResponse = this.Interswitch.mapInterswitchToNibssResponse(unpackedMessage);
            const maskedPan = this.getMaskedPan(this.Interswitch.getFieldValue(unpackedMessage, 2))
            const clientId = `${this.Interswitch.getFieldValue(unpackedMessage, 41)}${maskedPan}${this.Interswitch.getFieldValue(unpackedMessage, 37)}`;

            logger.info(`[ISW-SERVER] Looking up clientId in pending clients: ${clientId}`)
            logger.info(`[ISW-SERVER] Pending client keys: [${Object.keys(this.clients).join(', ')}]`)

            if(this.clients[clientId]){
                logger.info(`[ISW-SERVER] Client found — forwarding 0210 response to root-iso socket`)

                const transactionDetails = this.clients[clientId].transactionDetails;
                const unpackedMessage = this.clients[clientId].unpackedMessage;
                const socketServerInstance = this.clients[clientId].posSocketConn;

                delete this.clients[clientId]
                logger.info(`[ISW-SERVER] Client entry removed. Calling handleFinalResponse...`)

                await this.Interswitch.handleFinalResponse(unpackedMessage, mappedResponse, socketServerInstance)
                logger.info(`[ISW-SERVER] handleFinalResponse complete for clientId: ${clientId}`)

            } else {
                logger.err(`[ISW-SERVER] Client NOT FOUND for clientId: ${clientId} — cannot deliver 0210 response. Ending iswClient.`)
                logger.err(`[ISW-SERVER] Known pending clients: [${Object.keys(this.clients).join(', ')}]`)
                this.iswClient.end()
            }

        } else if(MTI == '0430'){
            // Handle reversal response
            const responseCode = this.Interswitch.getFieldValue(unpackedMessage, 39);
            logger.info(`[ISW-SERVER] 0430 Reversal Response — response code: ${responseCode}`)
            const mappedResponse = this.Interswitch.mapInterswitchToNibssResponse(unpackedMessage);
            const maskedPan = this.getMaskedPan(this.Interswitch.getFieldValue(unpackedMessage, 2))
            const clientId = `${this.Interswitch.getFieldValue(unpackedMessage, 41)}${maskedPan}${this.Interswitch.getFieldValue(unpackedMessage, 37)}`;

            logger.info(`[ISW-SERVER] Reversal clientId: ${clientId}`)
            logger.info(`[ISW-SERVER] Pending reversal client keys: [${Object.keys(this.clients).join(', ')}]`)

            if(this.clients[clientId]){
                logger.info(`[ISW-SERVER] Reversal client found — forwarding 0430 response to root-iso socket`)

                const transactionDetails = this.clients[clientId].transactionDetails;
                const unpackedMessage = this.clients[clientId].unpackedMessage;
                const socketServerInstance = this.clients[clientId].posSocketConn;

                delete this.clients[clientId]

                await this.Interswitch.handleFinalResponse(unpackedMessage, mappedResponse, socketServerInstance, true)
                logger.info(`[ISW-SERVER] Reversal handleFinalResponse complete for clientId: ${clientId}`)

            } else {
                logger.err(`[ISW-SERVER] Reversal client NOT FOUND for clientId: ${clientId}. Ending iswClient.`)
                logger.err(`[ISW-SERVER] Known pending clients: [${Object.keys(this.clients).join(', ')}]`)
                this.iswClient.end()
            }

        } else if(MTI == '0800'){
            // await updateSwitchStatus('UP')
            logger.info('[ISW-SERVER] 0800 echo/network request from Interswitch — sending echo response');
            this.Interswitch.echoResponse(unpackedMessage, this.iswClient)

        } else if(MTI == '0810'){

            const NMIC = this.Interswitch.getFieldValue(unpackedMessage, 70)
            logger.info(`[ISW-SERVER] 0810 Network Management Response — NMIC: ${NMIC}`);
            if(NMIC == '101'){
                logger.info('[ISW-SERVER] Key exchange response received — processing...');
                this.Interswitch.keyExchangeResponse(unpackedMessage, this.iswClient)
            }

        } else {
            // await updateSwitchStatus('UP')
            logger.info(`[ISW-SERVER] Unhandled response MTI: ${MTI}`)
        }
    }

    public handleSocketServerInstance(){
        const connectionType: any = this.tlsEnabled ? 'secureConnection' : 'connection';
    
        this.socketServerInstance.on(connectionType, (socket: any) => {
            // monitor req/sec
            this.requestMeter.mark();

            // Identify client
            socket.name = socket.remoteAddress + ":" + socket.remotePort;

            //logger.info('Received connection from ' + socket.name + ' TLS: ' + this.tlsEnabled);

            // recieve data from client for processing
            this.processDataFromSocketServerConnection(socket)

        })
    }

    private getVasRequestData(ISOMessage: any, length: number){
        ISOMessage = ISOMessage.toString().substring(2)
        const vasRequestString:string = ISOMessage.substring(length)
        if(vasRequestString.length > 0){
            logger.info('Request is padded with vas: ' +  vasRequestString)
            return vasRequestString
        } else {
            logger.info('No request padding .. ' + vasRequestString)
            return false
        }
    }

    private getISO(data:any, length: number){
       return data.slice(0,length + 2)
    }

    private processDataFromSocketServerConnection(socket: any){

        let hexData = '';
        this.socket = socket
        logger.info(`[ISW-SERVER] New connection from root-iso accepted — ${socket.remoteAddress}:${socket.remotePort}`);
        logger.info(`[ISW-SERVER] Interswitch socket state — iswSocketInstanceClosed: ${this.iswSocketInstanceClosed}`);

        this.socket.on('data', async (data: any) => {

            if(this.iswSocketInstanceClosed){
                logger.info('[ISW-SERVER] iswSocket was closed — triggering reconnect before processing message');
                this.setUpIswClient()
            }

            try {
                const raw_data = data;

                hexData += Buffer.from(raw_data).toString('hex');
                if (hexData.length < 4)
                    return;
                const msgLength = Number.parseInt(hexData.substr(0, 4), 16);
                //const msgLength = 620
                logger.info(`[ISW-SERVER] Message received from root-iso — declared length: ${msgLength}, raw bytes: ${raw_data.length}`)

                data = this.getISO(raw_data, msgLength)
                
                let RawISOMessage = data.toString()
    
                let ISOMessage = RawISOMessage.substring(2) 

                if(isISORequest(ISOMessage) === false){
                    // Respond back to client
                    logger.err('Invalid ISO Message...Aborting..')
                    if(socket.end()){
                        this.socketInstanceClosed = true;
                        logger.warn(socket.name + ' Connection Instance Closed...')
                    }
                    return false;
                }
    
                logger.info('Valid ISO Message...proceeding to unpack message')
     
                let unpackedMessage = this.iso8583Parser.unpack(ISOMessage)

                // Validate for appended VAS request 
                const vasRequestData = this.getVasRequestData(raw_data, msgLength)
                if(vasRequestData !== false){
                    unpackedMessage.vasData = vasRequestData
                }

                // Build Initial Transaction Data
                let transactionDetails: ITransactionDetails = this.handleCardTransaction.buildTransactionData(unpackedMessage, false)

                        
                if (transactionDetails.MTI == "0200"){
                    logger.info(`[ISW-SERVER] 0200 Purchase — fetching mapped terminalId for: ${transactionDetails.terminalId}`);
                    const terminalId = await this.Interswitch.getTerminalId(transactionDetails.terminalId);
                    logger.info(`[ISW-SERVER] Mapped terminalId: ${terminalId}`);

                    if (!terminalId) {
                        logger.err(`[ISW-SERVER] getTerminalId returned null/undefined for ${transactionDetails.terminalId} — cannot build clientId. Closing root-iso socket.`);
                        this.socket.end();
                        return false;
                    }

                    transactionDetails.transactingTerminalId = terminalId;

                    const clientId = `${terminalId}${transactionDetails.maskedPan}${transactionDetails.rrn}`
                    logger.info(`[ISW-SERVER] Storing pending client — clientId: ${clientId}`)

                    this.clients[clientId] = {
                        posSocketConn: this.socket,
                        clientId: clientId,
                        unpackedMessage: unpackedMessage,
                        transactionDetails: transactionDetails,
                    }

                    logger.info(`[ISW-SERVER] Pending clients after store: [${Object.keys(this.clients).join(', ')}]`);
                    logger.info(`[ISW-SERVER] Forwarding 0200 to Interswitch via iswClient...`);
                    await this.Interswitch.processPurchaseTransaction(unpackedMessage, transactionDetails, this.socket, this.iswClient)
                    logger.info(`[ISW-SERVER] processPurchaseTransaction returned — waiting for 0210 from Interswitch`);
                }

                if (transactionDetails.MTI == "0420"){
                    logger.info(`[ISW-SERVER] 0420 Reversal — fetching mapped terminalId for: ${transactionDetails.terminalId}`);
                    const terminalId = await this.Interswitch.getTerminalId(transactionDetails.terminalId);
                    logger.info(`[ISW-SERVER] Mapped terminalId: ${terminalId}`);

                    if (!terminalId) {
                        logger.err(`[ISW-SERVER] getTerminalId returned null/undefined for ${transactionDetails.terminalId} on reversal. Closing root-iso socket.`);
                        this.socket.end();
                        return false;
                    }

                    transactionDetails.transactingTerminalId = terminalId;

                    const clientId = `${terminalId}${transactionDetails.maskedPan}${transactionDetails.rrn}`
                    logger.info(`[ISW-SERVER] Storing pending reversal client — clientId: ${clientId}`)

                    this.clients[clientId] = {
                        posSocketConn: this.socket,
                        clientId: clientId,
                        unpackedMessage: unpackedMessage,
                        transactionDetails: transactionDetails,
                    }

                    logger.info(`[ISW-SERVER] Forwarding 0420 to Interswitch via iswClient...`);
                    await this.Interswitch.processReversalTransaction(unpackedMessage, transactionDetails, this.socket, this.iswClient);
                    logger.info(`[ISW-SERVER] processReversalTransaction returned — waiting for 0430 from Interswitch`);
                }

            } catch(error: any){
                logger.err(`[ISW-SERVER] EXCEPTION in processDataFromSocketServerConnection: ${error.stack}`)
                logger.err(`[ISW-SERVER] Closing root-iso socket due to exception`);
                this.socket.end();
                this.socketInstanceClosed = true;
                return false;
            }
            

        })

        this.socket.on('error', (err: any) => {
            logger.err('Socket server error : ' + err.stack)
            if(this.socket.end()){
                this.socketInstanceClosed = true;
                logger.info(this.socket.name + ' Connection Instance Closed...')
            }

        })
    }

    async doEcho(){
        await this.Interswitch.echoRequest(this.iswClient)
    }

    doKeyExchange() {
        this.Interswitch.keyExchangeRequest(this.iswClient)
    }

    doSignOn(){
        this.Interswitch.signOn(this.iswClient)
    }

    getMaskedPan(clearPan: any){
        return clearPan.substr(0, 6) + ''.padEnd(clearPan.length - 10, 'X') + clearPan.slice(-4)
    }

    async writeToPOS(socket:any, data: any){
        let write = false;

        try{

            logger.info("Writing Reversal Message to POS ::::: " + socket.name)
            write = socket.write(data)
            if(write){
                logger.info('Data written to POS! ' + data) 
                socket.end() // Else, POS won't print
            } else {
                logger.err('Failed to write to POS!')
                socket.end() // Else, POS won't print
            }

        } catch(err){
            logger.err('Failed to write to POS:: ' + err)
            socket.end() // Else, POS won't print
            return write;
        }
     
    }


}

export default SocketServerHandler;