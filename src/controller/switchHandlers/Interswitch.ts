/* eslint-disable @typescript-eslint/no-misused-promises */

/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import '../../pre-start'; // Must be the first import
import logger from '../../shared/Logger';
import handleCardTransactions from '../../controller/Transaction/handleCardTransactions';
import deploySocketService from '../../socket/deploySocketService';
import cISO8583 from '../../ciso8583/CISO'
import SocketClient from '../../socket/socketClient_ISW';
import handleSettlement from '../Transaction/handleSettlement'
import handleNotification from '../Transaction/handleNotification'
import { getNibssResponseMessageFromCode } from '../../utils/responseUtil'
import handleVas from '../Transaction/handleVas'
import Util from '../../shared/Util';
import ITerminal from '../../database/interface/i_terminal'
import { updateInterswitchConfig, getInterswitchConfig } from '../../configs/interswitchConfig';
import {I_Interswitch} from '../../database/interface/i_interswitch'
import Redis from '../../database/redis/Redis';
import net from 'net'
import moment from 'moment';

// Import neccessary config files
const config = require('../../ciso8583/engine/interswitch-dataelement-config.json');
const baseconfig = require('../../ciso8583/engine/dataelement-config.json');
const baseMessage = require('../../ciso8583/engine/dataelements.json');
const baseSubFieldMessage = require('../../ciso8583/engine/subField-data-elements.json');
const ISO8583 = require('iso8583-js');

import { MyPackager } from '../../ciso8583/MyPackager'
import { response } from 'express';
import { AnyARecord } from 'dns';
import TerminalPoolModel from '../../database/model/TerminalPoolModel';
import TerminalPoolService, { SwitchName } from '../../services/TerminalPoolService';
import { sub } from 'date-fns';
const jsPos = require('jspos');
const { ISOUtil, ISOMsg } = jsPos;

let isoInstance = new ISO8583();


const iso8583 = require('iso_8583');
const customIsoFormat = require('../../ciso8583/engine/customIsoFormat.json');

let globalSocketClient: any = null
class Interswitch {

    transactionDetails: any;
    socketServerInstance: any;
    handleCardTransaction: any;
    socketClientInstance: any;
    terminalHost: any;
    appEnv: any;
    nibssResponseISO: any;
    iso8583Parser: any;
    unpackedMessage: any;
    Util: any;
    unpackISO: any;
    myPackager: any;
    ZMK: any;
    init: string;
    logger: any;
    clientName: any;
    posSocketConn: any;
    encryptedPWK: any;
    redis: Redis;
    
    constructor(){
        this.handleCardTransaction = new handleCardTransactions()
        this.socketClientInstance = new deploySocketService()
        this.appEnv = process.env.NODE_ENV
        this.iso8583Parser = new cISO8583(config);
        this.Util = new Util();
        this.myPackager = new MyPackager()
        this.ZMK = Buffer.from(process.env.ZMK_ENC, 'hex')
        this.init = '00000000000000000000000000000000'
        this.clientName = 'ISW-POSTBRIDGE'
        this.redis = Redis.getInstance();
    }

    
    unpackMessage(data: any){
        let msg = this.myPackager.createISOMsg();
        msg.unpack(ISOUtil.hex2byte(this.sanitizeHexData(data)));
        const unpackedMessage = msg.fields;
        return unpackedMessage;
    }

    writeMessage(data: any, socketClient: any){
        socketClient.write(data);
    }  

    async repackMappedIso(unpackedMessage: any, mappedResponse: any){

        let dataElements = unpackedMessage.dataElements;
        dataElements['39'] = mappedResponse.responseCode;
        dataElements['37'] = mappedResponse.rrn || unpackedMessage.dataElements['37'];
        dataElements['11'] = mappedResponse.stan || unpackedMessage.dataElements['11'];
        dataElements['38'] = mappedResponse.authCode || unpackedMessage.dataElements['38'];

        const packedIso = this.iso8583Parser.pack('0210', dataElements);
        const isoMessage = Buffer.from(packedIso.isoMessage);
        const isoLength = isoMessage.toString('hex').length / 2;
        const binLength = this.Util.getLengthBytes(isoLength);
        const requestData = Buffer.concat([binLength, isoMessage]);
        return requestData;
    }

    async processPurchaseTransaction(unpackedMessage: any, transactionDetails: any, socketServerInstance: any, socketClient: any){
        logger.info("Processing Purchase Transaction via Interswitch....")

        const encPlainPin = transactionDetails.customerRef;

        let isoMSG;

        unpackedMessage.transactingTerminalId = transactionDetails.transactingTerminalId;
        logger.info(`ONLINE TRANSACTION (LOG).............`)
        
        let pinBlock = '0000';
        if(encPlainPin !== null){
            pinBlock = this.getPlainPinBlock(encPlainPin)
        }
        
        await this.sendOnlineTransaction(unpackedMessage, pinBlock, socketClient);

    }

    async handleFinalResponse(unpackedMessage: any, mappedResponse: any, socketServerInstance: any){
        logger.info("Handling Final Response....")

        logger.info(`Mapped Response: ${JSON.stringify(mappedResponse)}`)
        const data = await this.repackMappedIso(unpackedMessage, mappedResponse);

        await this.writeToPOS(socketServerInstance, null, data)
        
    }

 
    async sendOnlineTransaction(unpackedMessage: any, plainPinBlock: string, socketClient: any){
        try{
            let requestData: any = {};
            Object.assign(requestData, unpackedMessage.dataElements);
            let subFieldMessage = baseSubFieldMessage;

            let date = new Date();
            const mmdd = this.Util.padLeft((date.getMonth()+1).toString(),'0',2) + this.Util.padLeft(date.getDate().toString(),'0',2)

            const pinBlock = await this.getEncryptedPinBlock(plainPinBlock, unpackedMessage.dataElements['2']);
            //logger.info(`Interswitch: PINBLOCK ${pinBlock}`)
            // For CashOut Interswitch
            const terminalId = unpackedMessage.transactingTerminalId;
            requestData['41'] = terminalId;
            requestData['42'] = `2CBT1125SL00001`;
            requestData['3'] = `50${requestData['3'].substring(2,6)}`;
            //requestData['7'] = moment().format('MMDDHHmmss');
            // For Cashout End
            requestData['26'] = null;
            requestData['30'] = unpackedMessage.dataElements['28'];
            requestData['55'] = null;
            requestData['56'] = "1510";
            requestData['98'] = "3FAB0001";
            requestData['59'] = unpackedMessage.dataElements['37'];
            requestData['52'] = pinBlock;
            requestData['15'] = mmdd;
            requestData['18'] = "6010";
            requestData['26'] = "04";
            requestData['28'] = "D00000000";
            requestData['32'] = "111143";
            requestData['33'] = "111111";
            requestData['43'] = this.getField43();
            requestData['103'] = this.getAccountNumber(terminalId)
            requestData['100'] = this.getRID(terminalId)

            // Account to be settled (After the settlement fee is deducted)
            requestData['128'] = null;
            // set dummy data to avoid binary character encode ish of d127 bitmap

            let xmlICC = this.Util.mapICCDataToXML(unpackedMessage);
            if (!xmlICC){
                xmlICC = await this.Util.generateStaticICCData(unpackedMessage);
            }

            //logger.info("Interswitch: Generated ICC Data XML" + xmlICC);
            
            //logger.info("Interswitch: ICC Data" + xmlICC);
            logger.info(`Configured RID for Terminal ID ${unpackedMessage.dataElements['41']} is ${requestData[100]}`)

            let msg = this.myPackager.createISOMsg();
            msg.setMTI('0200');
            msg.setField(2, requestData[2])
            msg.setField(3, requestData[3])
            msg.setField(4, requestData[4])
            msg.setField(7, requestData[7])
            msg.setField(11, requestData[11])
            msg.setField(12, requestData[12])
            msg.setField(13, requestData[13])
            msg.setField(14, requestData[14])
            msg.setField(15, requestData[15])
            msg.setField(18, requestData[18])
            msg.setField(22, requestData[22])
            msg.setField(23, requestData[23])
            msg.setField(25, requestData[25])
            msg.setField(26, requestData[26])
            msg.setField(28, requestData[28])
            msg.setField(30, requestData[30])
            msg.setField(32, requestData[32])
            msg.setField(33, requestData[33]) 
            msg.setField(35, requestData[35])
            msg.setField(37, requestData[37])
            msg.setField(40, requestData[40])
            msg.setField(41, requestData[41])
            msg.setField(42, requestData[42])
            msg.setField(43, requestData[43])
            msg.setField(49, requestData[49])
            msg.setField(52, requestData[52])
            msg.setField(56, requestData[56])
            msg.setField(59, requestData[59])
            msg.setField(98, requestData[98])
            msg.setField(100, requestData[100])
            msg.setField(103, requestData[103])
            msg.setField(123, requestData[123])

            /**
             * Generate Sub-ISO Message for Field 127 <<< 
            */
            // subFieldMessage['2'] = '0282496282' 
            // subFieldMessage['3'] = 'AGENCY2src  TEPSWTsnk   934514934514NOTTEPVPAYMC'
            // subFieldMessage['13'] = '     000000   566'
            // subFieldMessage['20'] = '20180806'
            // subFieldMessage['25'] = xmlICC
            // subFieldMessage['33'] = '6008'

            subFieldMessage['2'] = new Date().getTime().toString().substring(12,-1)
            subFieldMessage['3'] = `                        ${requestData[11]}${requestData[11]}            `;
            subFieldMessage['13'] = `      000000 566`
            subFieldMessage['22'] = this.getRIDAsXML('627805')
            subFieldMessage['25'] = xmlICC
            subFieldMessage['33'] = '6009'

            let subIso = this.iso8583Parser.packSubFieldWithBinaryBitmap(subFieldMessage, config['127'].nestedElements);
            //logger.info(`Interswitch SubISO msg: ${subIso.isoMessage}`);

            msg.setField(127, subIso.isoMessage)

            let hexIsoMessage = ISOUtil.hexString(msg.pack());        
            let isoLength = hexIsoMessage.length / 2;
            let binLength = this.Util.getLengthBytes(isoLength);
            const isoMessageBuffer = Buffer.from(ISOUtil.hex2byte(hexIsoMessage)); 
            const requestISOMsg = Buffer.concat([binLength, isoMessageBuffer]);

            logger.info("Sending transaction to Interswitch Postbridge: " + requestISOMsg.toString())
            this.writeMessage(requestISOMsg, socketClient)

        } catch(error){
            logger.info("Error sending online transaction message: " + error)
        }
        
    }

    private getRID(terminalId: string){
        const f4 = terminalId.substring(0,4)
         switch (f4) {
            case "2CBT":
                return "666076";
            default:
                return "666076";
         }
    }

    public sanitizeHexData(hexData: string){
        return hexData.substring(4);
    }

    public getFieldValue(unpackedMessage: any, fieldNum: number){
        const unpackedField = unpackedMessage[fieldNum] || null;
        if(unpackedField !== null){
            return unpackedField.value
        } else {
            return null
        }    
    }  

    /**
     * map interswitch response to nibss response for POS.
     * @param {Object} unpackedMessage unpacked message from Interswitch
     * @returns {Object} object with rescode, authCode and iccResponse
     */
    mapInterswitchToNibssResponse(unpackedMessage: any) {
        let responseData: any = {};
        responseData.responseCode = this.getFieldValue(unpackedMessage, 39);
        responseData.switchTerminalId = this.getFieldValue(unpackedMessage, 41);
        responseData.rrn = this.getFieldValue(unpackedMessage, 37);
        responseData.stan = this.getFieldValue(unpackedMessage, 11);
        responseData.authCode = this.getFieldValue(unpackedMessage, 38) !== null ? this.getFieldValue(unpackedMessage, 38) : 'UNI000' ;
        responseData.amount = this.getFieldValue(unpackedMessage, 4);
        // Capture other data here...
        logger.info(`Interswitch: Mapped Response Object => ${JSON.stringify(responseData)}`)
        return responseData;
    }
    
    async keyExchangeResponse(unpackedMessage: any){
        try{
            logger.info(`Key Exchange was successful at ${new Date()}`);

            logger.info(`Pinkey Unpacked Message: ${JSON.stringify(unpackedMessage)}`);

            let pinData = this.getFieldValue(unpackedMessage, 53);

            if (pinData) {
                // Convert byte array to hex string
                let pinDataHex: string;
                
                if (Array.isArray(pinData)) {
                    // If it's a byte array, convert to hex string
                    pinDataHex = Buffer.from(pinData).toString('hex').toUpperCase();
                } else if (Buffer.isBuffer(pinData)) {
                    // If it's already a buffer
                    pinDataHex = pinData.toString('hex').toUpperCase();
                } else {
                    // If it's already a string
                    pinDataHex = pinData.toString().toUpperCase();
                }

                logger.info(`Pin Data (Hex): ${pinDataHex}`);
                logger.info(`Pin Data Length: ${pinDataHex.length}`);

                const keyExchangeData = {
                    configId: 1001,
                    pinKey: pinDataHex.substr(0, 32),
                    keyCheck: pinDataHex.substr(32, 6),
                    sequence: 0,
                    timestamp: new Date().toISOString()
                };

                logger.info(`Key exchange data: ${JSON.stringify(keyExchangeData)}`);

                // Store in Redis with key prefix
                await this.redis.save('isw:key_exchange:1001', JSON.stringify(keyExchangeData));
                logger.info('Interswitch: Key exchange data saved to Redis');
            } else {
                logger.warn('No PIN data found in field 53');
            }

        } catch(error: any){
            logger.err(`Interswitch: Key Exchange Error => ${error.stack}`);

        }
        
    }

    keyExchangeRequest(socketClient: any){
        try{
            let transactionDateTime = this.Util.getTransmissionDateandTime();
            let datetime = (new Date).getTime().toString();
            let dataElements = baseMessage;
            dataElements['7'] = transactionDateTime;
            dataElements['11'] = datetime.substr(datetime.length - 6);
            dataElements['12'] = transactionDateTime.substr(4);
            dataElements['13'] = transactionDateTime.substr(0, 4);
            dataElements['70'] = '101';

            let msg = this.myPackager.createISOMsg();
            msg.setMTI('0800');
            msg.setField(7, dataElements['7']);
            msg.setField(11, dataElements['11']);
            msg.setField(12, dataElements['12']);
            msg.setField(13, dataElements['13']);
            msg.setField(70, '101');

            const isoMessage = ISOUtil.hexString(msg.pack());
            logger.info(`Interswitch Key Exchange Message: ${isoMessage}`);
            
            let isoLength = isoMessage.length / 2;

            let binLength = this.Util.getLengthBytes(isoLength);
            const isoMessageBuffer = Buffer.from(ISOUtil.hex2byte(isoMessage)); 
            const requestData = Buffer.concat([binLength, isoMessageBuffer]);
            
            logger.info(`Sending Key Exchange Request >>>>>>>>>>>> with data ${requestData.toString()}`);
            
            this.writeMessage(requestData, socketClient)

        } catch(error: any){
            logger.err(`Interswitch Key Exchange Exception - Error => ${error.stack}`);

        }

    }

    echoResponse(unpackedMessage: any, socketClient: any){
        try {
          
            let msg = this.myPackager.createISOMsg();
            msg.setMTI('0810');
            msg.setField(7, this.getFieldValue(unpackedMessage, 7));
            msg.setField(11, this.getFieldValue(unpackedMessage, 11));
            msg.setField(12, this.getFieldValue(unpackedMessage, 12));
            msg.setField(13, this.getFieldValue(unpackedMessage, 13));
            msg.setField(70, '301');

            const isoMessage = ISOUtil.hexString(msg.pack());
            logger.info(`Interswitch ECHO Message: ${isoMessage}`);
            
            let isoLength = isoMessage.length / 2;

            let binLength = this.Util.getLengthBytes(isoLength);
            const isoMessageBuffer = Buffer.from(ISOUtil.hex2byte(isoMessage)); 
            const requestData = Buffer.concat([binLength, isoMessageBuffer]);
            logger.info(`Responding to 0800 message: ${requestData.toString()}`)
            this.writeMessage(requestData, socketClient)

        } catch(error: any){
            logger.info(`Interswitch Exception - Error => ${error.stack}`);

        }
    }

    echoRequest(socketClient: any){

       try {
            let transactionDateTime = this.Util.getTransmissionDateandTime();
            let datetime = (new Date).getTime().toString();
            let dataElements = baseMessage;
            dataElements['7'] = transactionDateTime;
            dataElements['11'] = datetime.substr(datetime.length - 6);
            dataElements['12'] = transactionDateTime.substr(4);
            dataElements['13'] = transactionDateTime.substr(0, 4);

            let msg = this.myPackager.createISOMsg();
            msg.setMTI('0800');
            msg.setField(7, dataElements['7']);
            msg.setField(11, dataElements['11']);
            msg.setField(12, dataElements['12']);
            msg.setField(13, dataElements['13']);
            msg.setField(70, '301');

            const isoMessage = ISOUtil.hexString(msg.pack());
            logger.info(`Interswitch ECHO Message: ${isoMessage}`);
            
            let isoLength = isoMessage.length / 2;

            let binLength = this.Util.getLengthBytes(isoLength);
            const isoMessageBuffer = Buffer.from(ISOUtil.hex2byte(isoMessage)); 
            const requestData = Buffer.concat([binLength, isoMessageBuffer]);
            
           this.writeMessage(requestData, socketClient)

        } catch(error: any){
            logger.info(`Interswitch Exception - Error => ${error.stack}`);

        }

    }

    signOn(socketClient: any){

        try {
            let transactionDateTime = this.Util.getTransmissionDateandTime();
            let datetime = (new Date).getTime().toString();
            let dataElements = baseMessage;
            dataElements['7'] = transactionDateTime;
            dataElements['11'] = datetime.substr(datetime.length - 6);
            dataElements['12'] = transactionDateTime.substr(4);
            dataElements['13'] = transactionDateTime.substr(0, 4);
            dataElements['70'] = "001";

            let msg = this.myPackager.createISOMsg();
            msg.setMTI('0800');
            msg.setField(7, dataElements['7']);
            msg.setField(11, dataElements['11']);
            msg.setField(12, dataElements['12']);
            msg.setField(13, dataElements['13']);
            msg.setField(70, '001');

            const isoMessage = ISOUtil.hexString(msg.pack());
            logger.info(`Interswitch SignOn Message: ${isoMessage}`);
            
            let isoLength = isoMessage.length / 2;

            let binLength = this.Util.getLengthBytes(isoLength);
            const isoMessageBuffer = Buffer.from(ISOUtil.hex2byte(isoMessage)); 
            const requestData = Buffer.concat([binLength, isoMessageBuffer]);
            
            this.writeMessage(requestData, socketClient)
            
        } catch(error: any){
            logger.info(`Interswitch Sign-on Exception - Error => ${error.stack}`);

        }
        
    }

    async writeToPOS(socket:any, socketClient: any, data: any){
        let write = false;

        try{

            logger.info("Interswitch: Writing to POS ::::: " + socket.name + ': Data: ' + data.toString())
            write = socket.write(data)

            if(write){
                logger.info('Interswitch: Data written to POS!')
                socket.end() // Else, POS won't print
                //socketClient.end()
                return write;
            } else {
                logger.err('Interswitch: Failed to write to POS!')
                socket.end() // Else, POS won't print
                //socketClient.end()
                return write;
            }

        } catch(err){
            logger.err('Failed to write to POS:: ' + err)
            socket.end() // Else, POS won't print
            return write;
        }
     
    }

    async getTerminalId(){
        return "2CBT0001";
        //return await TerminalPoolService.getInstance().getNextTerminalId(SwitchName.INTERSWITCH);
    }

    async generateCustomResponse(requestData: any, responseCode: string){
        let responseData: any = {};
        responseData.responseCode = responseCode;
        responseData.terminalId = requestData['41'];
        responseData.switchTerminalId = requestData['41'];
        responseData.rrn = requestData['37'];
        responseData.stan = requestData['11'];
        responseData.authCode = requestData['38'] !== null ? requestData['38'] : 'UNI000' ;
        responseData.amount = requestData['4'];
        return responseData;
    }

    async getKcv(data: string){
        const ZMK = Buffer.from(this.ZMK).toString('hex');
        //logger.info(`Interswitch: ZMK: ${ZMK}`)
        const encrypt3des = this.Util.des3Encrypt(data, this.ZMK);
        return encrypt3des.substr(0,6);
    }

    async getClearPWK(){
        try {
            // Try to get the key from Redis first
            const redisData = await this.redis.get('isw:key_exchange:1001');
            
            if (redisData) {
                const keyExchangeData = JSON.parse(redisData);
                const encryptedPWK = keyExchangeData.pinKey;
                const clearPinkey = this.Util.des3Decrypt(encryptedPWK, this.ZMK);
                logger.info('Interswitch: Using PIN key from Redis clear PIN Key: ' + clearPinkey.toUpperCase());
                return clearPinkey.toUpperCase();
            }
        } catch (error: any) {
            logger.err(`Interswitch: Redis fetch error => ${error.message}`);
        }
    }

    async getEncryptedPinBlock(userpin: string, pan: string){
        try{
            const block_1 = `04${userpin}FFFFFFFFFF`;
            const block_2 = `0000${pan.substring(pan.length - 13, pan.length - 1)}`
            const pinBlock = this.Util.xorHexString(block_1, block_2)
            const pinBlockHex = Buffer.from(pinBlock).toString('hex')
            
            //logger.info(`Interswitch: RAW PIN BLOCK: ${pinBlockHex}`)
            
            const clearPWK = await this.getClearPWK();
            const bufferClearPWK = Buffer.from(clearPWK, 'hex');
            const bufferPinblock = Buffer.from(pinBlock, 'hex'); 
            const encryptedPinBlock = this.Util.des3EncryptNoPadding(pinBlockHex.toUpperCase(), bufferClearPWK)
            
            //logger.info('Interswitch: Encrypted PIN Block: ' + encryptedPinBlock)
            
            return encryptedPinBlock;
        } catch(error){
            logger.err('Interswitch: Error generating encrypted pin block: ' + error)
            return null;
        }
        
        
    }

    getPlainPinBlock(encryptedPin: string){
        let pin = ''
        for (let i = 0; i < encryptedPin.length; i++) {
            if(i == 2){
                pin += encryptedPin.charAt(i)
            }

            if(i == 5){
                pin += encryptedPin.charAt(i)
            }

            if(i == 8){
                pin += encryptedPin.charAt(i)
            }

            if(i == 11){
                pin += encryptedPin.charAt(i)
            }
        }
        return pin;
    }

       // Convert a hex string to a byte array
    hexToBytes(hex: any) {
        for (var bytes = [], c = 0; c < hex.length; c += 2)
            bytes.push(parseInt(hex.substr(c, 2), 16));
        return bytes;
    }

    private getAccountNumber(terminalId: string){
        
        const f4 = terminalId.substring(0,4)
         switch (f4) {
            case "2100":
                return process.env.INTERSWITCH_SETTLEMENT_ACCOUNT //"0002527528";// Suntrust
            default:
                return process.env.INTERSWITCH_SETTLEMENT_ACCOUNT
         }
        
    }

    private getRIDAsXML(rid: string): string {
        return `212ORIGINAL_RID235<ORIGINAL_RID>${rid}</ORIGINAL_RID>`;
    }

    /**
     * Generate Field 43 - Card Acceptor Name Location
     * Format: ans40 (40 characters fixed length)
     * Structure:
     *  - Positions 1-23: Location information (merchant name)
     *  - Positions 24-36: City (13 chars)
     *  - Positions 37-38: State/Region (2 chars)
     *  - Positions 39-40: Country (2 chars)
     * @returns {string} Field 43 value (40 characters)
     */
    private getField43(): string {
        const merchantName = 'CBIMONIE';
        const city = 'Lagos';
        const state = 'LA';  // Lagos state code
        const country = 'NG'; // Nigeria country code
        
        // Position 1-23: Merchant name (23 chars)
        const locationInfo = this.Util.padRight(merchantName, ' ', 23);
        
        // Position 24-36: City (13 chars)
        const cityField = this.Util.padRight(city, ' ', 13);
        
        // Position 37-38: State (2 chars)
        const stateField = state;
        
        // Position 39-40: Country (2 chars)
        const countryField = country;
        
        const field43 = locationInfo + cityField + stateField + countryField;
        
        logger.info(`Interswitch: Generated Field 43: ${field43} (length: ${field43.length})`);
        
        return field43;
    }
    


}

export default Interswitch