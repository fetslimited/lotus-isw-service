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
        this.iswClient = new net.Socket()

        this.iswClient.connect(this.serverPort, this.serverHost, () => {
            
            logger.info(`Connected to ${this.clientName} on ${this.serverPort}:${this.serverHost} successfully`)
            this.iswSocketInstanceClosed = false
            // updateSwitchStatus('UP')

              // Sign on
            this.sleep(2000).then(() => {
                this.doSignOn()
            });

            // Key Exchange
            this.sleep(8000).then(() => {
                this.doKeyExchange()
            });
        
        });

        this.iswClient.setKeepAlive(true, 1000);

        this.iswClient.on('end', () => {
            logger.info('Disconnected from ISW server');
            this.iswSocketInstanceClosed = true
            // updateSwitchStatus('DOWN')
        });

        this.iswClient.on('error', (err: any) => {
            this.iswSocketInstanceClosed = true
            logger.info('Error in socketConnection: ' + err);
            this.handleSocketClientError()
            // updateSwitchStatus('DOWN')
        })

        this.iswClient.on('data', async (data: any) => {            
            await this.handleSocketData(data)
        })

        return this.iswClient;
    }

    handleSocketClientError(){
        this.sleep(3000).then(() => {
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
        logger.info(`Interswitch Transaction Response Recieved at ${new Date()};`);

        const unpackedMessage = this.Interswitch.unpackMessage(data)

        logger.info(`Interswitch Online Transaction Unpacked Message, ${JSON.stringify(unpackedMessage)}`);

        const MTI = this.Interswitch.getFieldValue(unpackedMessage, 0)
        if(MTI == '0210'){
            // await updateSwitchStatus('UP')
            logger.info(`Interswitch, Response code: ${this.Interswitch.getFieldValue(unpackedMessage, 39)}`)
            const mappedResponse = this.Interswitch.mapInterswitchToNibssResponse(unpackedMessage);
            const maskedPan = this.getMaskedPan(this.Interswitch.getFieldValue(unpackedMessage, 2))
            const clientId = `${this.Interswitch.getFieldValue(unpackedMessage, 41)}${maskedPan}${this.Interswitch.getFieldValue(unpackedMessage, 37)}`;

            logger.info(`Response Client ID :=> ${clientId} `)
            //logger.info(`Response Client ID :=> ${JSON.stringify(this.clients)} `)

            if(this.clients[clientId]){
                logger.info("Found client ID data ")
                
                const transactionDetails = this.clients[clientId].transactionDetails;
                const unpackedMessage = this.clients[clientId].unpackedMessage;
                const socketServerInstance = this.clients[clientId].posSocketConn;

                delete this.clients[clientId]

                await this.Interswitch.handleFinalResponse(unpackedMessage, mappedResponse, socketServerInstance)
            
            } else {
                this.iswClient.end()
                
                logger.info("Could not find client ID data")
                //logger.info(`ALL Stored client data:=> ${JSON.stringify(clients)}`)
            }
                
        } else if(MTI == '0800'){
            // await updateSwitchStatus('UP')
            this.Interswitch.echoResponse(unpackedMessage, this.iswClient)
        
        } else if(MTI == '0810'){

            const NMIC = this.Interswitch.getFieldValue(unpackedMessage, 70)
            if(NMIC == '101'){
                this.Interswitch.keyExchangeResponse(unpackedMessage, this.iswClient)
            }
    
        } else {
            // await updateSwitchStatus('UP')
            logger.info(`Not a valid response MTI`)
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
        this.socket.on('data', async (data: any) => {

            if(this.iswSocketInstanceClosed){
                this.setUpIswClient()
            }

            try {
                const raw_data = data;

                hexData += Buffer.from(raw_data).toString('hex');
                if (hexData.length < 4)
                    return;
                const msgLength = Number.parseInt(hexData.substr(0, 4), 16);
                //const msgLength = 620
                logger.info("Recieved ISO from Main switch:  Message Length: " + msgLength)

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
                    const terminalId =  await this.Interswitch.getTerminalId(transactionDetails.terminalId);

                    transactionDetails.transactingTerminalId = terminalId;

                    const clientId = `${terminalId}${transactionDetails.maskedPan}${transactionDetails.rrn}`
                    
                    logger.info(`Request Client ID :=> ${clientId} `)

                    this.clients[clientId] = {
                        posSocketConn: this.socket,
                        clientId: clientId,
                        unpackedMessage: unpackedMessage,
                        transactionDetails: transactionDetails,
                    }

                    //logger.info(`ALL Stored client data:=> ${JSON.stringify(this.clients)}`)
                    await this.Interswitch.processPurchaseTransaction(unpackedMessage, transactionDetails, this.socket, this.iswClient)

                }

            } catch(error: any){
                logger.err("Exception occured in processDataFromSocketServerConnection: " + error.stack)
                if(this.socket.end()){
                    this.socketInstanceClosed = true;
                    logger.warn(this.socket.name + ' Connection Instance Closed...')
                }
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