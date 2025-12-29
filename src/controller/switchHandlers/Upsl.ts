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
import SocketClient from '../../socket/socketClient_UPSL';
import handleSettlement from '../Transaction/handleSettlement'
import handleNotification from '../Transaction/handleNotification'
import { getNibssResponseMessageFromCode } from '../../utils/responseUtil'
import handleVas from '../Transaction/handleVas'
import Util from '../../shared/Util';
import ITerminal from '../../database/interface/i_terminal'
import { updateUpslConfig } from '../../configs/upslConfig';
import {I_Upsl} from '../../database/interface/i_upsl'

// Import neccessary config files
const config = require('../../ciso8583/engine/interswitch-dataelement-config.json');
const baseMessage = require('../../ciso8583/engine/dataelements.json');
const baseSubFieldMessage = require('../../ciso8583/engine/subField-data-elements.json');

const ISO8583 = require('iso8583-js');
const customIsoFormat = require('../../ciso8583/engine/customIsoFormat.json');

import { MyPackager } from '../../ciso8583/MyPackager'
import encrypt from '../../crypt/encryptData';
const jsPos = require('jspos');
const { ISOUtil, ISOMsg } = jsPos;
let isoInstance = new ISO8583();

const iso8583 = require('iso_8583');

let globalSocketClient: any = null
class Upsl {

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

    constructor(){
        this.handleCardTransaction = new handleCardTransactions()
        this.socketClientInstance = new deploySocketService()
        this.appEnv = process.env.NODE_ENV
        this.iso8583Parser = new cISO8583(config);
        this.Util = new Util();
        this.myPackager = new MyPackager()
        this.ZMK = Buffer.from(process.env.ZMK_ENC_UPSL, 'hex')
        //this.ZMK = Buffer.from('13AED5DA1F32347523C708C11F2608FD', 'hex')
    }

    async repackMappedIso(unpackedMessage: any, mappedResponse: any){

        logger.info('Upsl: Mapped Response from socket client: ' + JSON.stringify(mappedResponse));
        let dataElements = unpackedMessage.dataElements;
        dataElements['39'] = mappedResponse.responseCode;
        dataElements['37'] = mappedResponse.rrn;
        dataElements['11'] = mappedResponse.stan;
        dataElements['38'] = mappedResponse.authCode;

        const packedIso = this.iso8583Parser.pack('0210', dataElements);
        const isoMessage = Buffer.from(packedIso.isoMessage);
        const isoLength = isoMessage.toString('hex').length / 2;
        const binLength = this.Util.getLengthBytes(isoLength);
        const requestData = Buffer.concat([binLength, isoMessage]);
        return requestData;
    }

    getPlainPinBlock(encryptedPin: string){
        let pin = ''
        for (let i = 0; i < encryptedPin.length; i++) {
            console.log(encryptedPin.charAt(i));
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

    getTerminalId(terminalId: string){
        const tf = terminalId;
        return tf;
    }

    async processVasTransactionAfterResponse(mappedResponse: any, terminalData: any, ISOResponse: any, vasData: any,socketServerInstance: any, socketClient: any){
    
        // Update Transaction
        let updateDetails: any = {}
        updateDetails.responseCode = mappedResponse.responseCode;
        updateDetails.responseMessage = getNibssResponseMessageFromCode(mappedResponse.responseCode);
        updateDetails.terminalId = terminalData.terminalId;
        updateDetails.switchTerminalId = this.getTerminalId(terminalData.terminalId);
        updateDetails.rrn = mappedResponse.rrn;
        updateDetails.stan = mappedResponse.stan;
        updateDetails.authCode = mappedResponse.authCode;
        // updateDetails.handlerResponseTime = new Date;
        updateDetails.ISOResponse = ISOResponse;
        updateDetails.region = terminalData.region;
        updateDetails.state = terminalData.state;
        updateDetails.substate = terminalData.substate;
        updateDetails.terminalOwnerCode = terminalData.terminalOwnerCode
        updateDetails.terminalOwnerName = terminalData.terminalOwnerName
        updateDetails.terminalGroupName = terminalData.terminalGroupName
        updateDetails.merchantType = terminalData.merchantType
        updateDetails.clientReference = mappedResponse.rrn + "|" + terminalData.terminalId + "|" + mappedResponse.stan
        updateDetails.tranType = "VAS";
        updateDetails.amount = mappedResponse.amount;

        const dataUpdated = this.handleCardTransaction.updateTransaction(updateDetails)
        
        // Push bill payment request
        const vasResponse = await handleVas.push(terminalData, updateDetails, vasData);
        const convertedVasResponseToString = JSON.stringify(vasResponse)
        const data = ISOResponse + convertedVasResponseToString

        const writeStatus = await this.writeToPOS(socketServerInstance, socketClient, data)
        
        // Re-Update Transaction
        updateDetails.ISOResponse = data;
        updateDetails.write2pos = writeStatus;
        this.handleCardTransaction.updateTransaction(updateDetails);

        // Update Summary
        this.handleCardTransaction.updateTransactionSummary(updateDetails)

        if(dataUpdated){
            logger.info('Transaction data updated successfully for - ' + updateDetails.rrn)
        }

    }

    async processTransactionAfterResponse(mappedResponse: any, terminalData: any, writeStatus: boolean, ISOResponse: any){
        // Update Transaction
        let updateDetails: any = {}
        const terminalId = terminalData.terminalId;
        updateDetails.responseCode = mappedResponse.responseCode;
        updateDetails.responseMessage = getNibssResponseMessageFromCode(mappedResponse.responseCode);
        updateDetails.terminalId = terminalData.terminalId;
        updateDetails.switchTerminalId = this.getTerminalId(terminalData.terminalId)
        updateDetails.rrn = mappedResponse.rrn;
        updateDetails.stan = mappedResponse.stan;
        updateDetails.authCode = mappedResponse.authCode;
        updateDetails.handlerResponseTime = new Date;
        updateDetails.write2pos = writeStatus;
        updateDetails.ISOResponse = ISOResponse;
        updateDetails.region = terminalData.region;
        updateDetails.state = terminalData.state;
        updateDetails.substate = terminalData.substate;
        updateDetails.terminalOwnerCode = terminalData.terminalOwnerCode
        updateDetails.terminalOwnerName = terminalData.terminalOwnerName
        updateDetails.terminalGroupName = terminalData.terminalGroupName
        updateDetails.merchantType = terminalData.merchantType
        updateDetails.clientReference = mappedResponse.rrn + "|" + terminalData.terminalId + "|" + mappedResponse.stan

        const dataUpdated = await this.handleCardTransaction.updateTransaction(updateDetails)
        
        if(dataUpdated){
            logger.info('Upsl: Transaction data updated successfully for - ' + updateDetails.rrn)
            
            const initialTransactionData = await this.handleCardTransaction.getTransaction(terminalData.terminalId, updateDetails.rrn);
            
            const updateDetailsObject = Object.assign(initialTransactionData, updateDetails)
            
            this.handleCardTransaction.updateTransactionSummary(updateDetailsObject)

            // Push settlement
            handleSettlement.notifyHuaweiForSettlement(terminalData, updateDetailsObject);
            
            // Push Notification to third party
            handleNotification.notify(terminalData, updateDetailsObject)
        }

    }


   async processPurchaseTransaction(unpackedMessage: any, transactionDetails: any, terminalData: any, socketServerInstance: any){
      
        const terminalHost = terminalData.terminalHost.toUpperCase();
        transactionDetails.terminalHost = terminalHost;
        const dataInserted = this.handleCardTransaction.upsertTransaction(transactionDetails)
        if(!dataInserted){
            logger.err("Failed to save initial transaction data ... exiting.." + JSON.stringify(transactionDetails))
            socketServerInstance.end()
        }

        const encPlainPin = transactionDetails.customerRef;

        if(transactionDetails.onlinePin === true && encPlainPin !== null){
            logger.info(`Upsl: ONLINE TRANSACTION .............`)
            
            let pinBlock = '0000';
            if(encPlainPin !== null){
                pinBlock = this.getPlainPinBlock(encPlainPin)
            }
            
            const mappedResponse = await this.sendOnlineTransaction(unpackedMessage, pinBlock);

            const data = await this.repackMappedIso(unpackedMessage, mappedResponse);

            if(transactionDetails.isRequestPadded === true){

                await this.processVasTransactionAfterResponse(mappedResponse, terminalData, data, transactionDetails.vasData, socketServerInstance, null)

            } else {
                const writeStatus = await this.writeToPOS(socketServerInstance, null, data)

                await this.processTransactionAfterResponse(mappedResponse, terminalData, writeStatus, data)
            }

       } else { 
            logger.info(`Upsl: OFFLINE TRANSACTION .............`)

            const mappedResponse = await this.sendOfflineTransaction(unpackedMessage);

            const data = await this.repackMappedIso(unpackedMessage, mappedResponse);

            if(transactionDetails.isRequestPadded === true){

                await this.processVasTransactionAfterResponse(mappedResponse, terminalData, data, transactionDetails.vasData, socketServerInstance, null)

            } else {
                const writeStatus = await this.writeToPOS(socketServerInstance, null, data)

                await this.processTransactionAfterResponse(mappedResponse, terminalData, writeStatus, data)
            }

       }   
    }

    async getKcv(data: string){
        const ZMK = Buffer.from(this.ZMK).toString('hex');
        //logger.info(`Interswitch: ZMK: ${ZMK}`)
        const encrypt3des = this.Util.des3Encrypt(data, this.ZMK);
        return encrypt3des.substr(0,6);
    }


    async getClearPWK(){
        //const getKcv = await this.getKcv(this.init);
        //logger.info(`Interswitch: KCV: ${getKcv}`)
        //const encryptedPWK = 'BFB9BEB6F49BC705609E26C8E99170B7';
        const encryptedPWK = process.env.ENCRYPTED_ZPK;
        //logger.info(`Interswitch: encryptedPWK: ${encryptedPWK}`)
        const clearPinkey = this.Util.des3Decrypt(encryptedPWK, this.ZMK);
        logger.info(`Upsl: Clear PINKey: ${clearPinkey.toUpperCase()}`)
        return clearPinkey.toUpperCase();
    }

    async getEncryptedPinBlock(userpin: string, pan: string){
        
        const block_1 = `04${userpin}FFFFFFFFFF`;
        const block_2 = `0000${pan.substring(pan.length - 13, pan.length - 1)}`
        const pinBlock = this.Util.xorHexString(block_1, block_2)
        const pinBlockHex = Buffer.from(pinBlock).toString('hex')
        
        const clearPWK = await this.getClearPWK();
        const bufferClearPWK = Buffer.from(clearPWK, 'hex');

        const encryptedPinBlock = this.Util.des3EncryptNoPadding(pinBlockHex.toUpperCase(), bufferClearPWK);
        logger.info('Upsl: Encrypted PIN Block: ' + encryptedPinBlock)
        return encryptedPinBlock;
    }

    async sendOnlineTransaction(unpackedMessage: any, plainPinBlock: string){
        let requestData: any = {};
        Object.assign(requestData, unpackedMessage.dataElements);
        let subFieldMessage = baseSubFieldMessage;

        let date = new Date();
        const mmdd = this.Util.padLeft((date.getMonth()+1).toString(),'0',2) + this.Util.padLeft(date.getDate().toString(),'0',2)

        const pinBlock = await this.getEncryptedPinBlock(plainPinBlock, unpackedMessage.dataElements['2']);

        // For CashOut Upsl
        requestData['41'] = this.getTerminalId(requestData['41']);
        requestData['42'] = `2AGTLAGPOOO7964`;
        requestData['3'] = '011000';
        // For Cashout End
        //requestData['23'] = null;
        requestData['56'] = "1510";
        requestData['59'] = unpackedMessage.dataElements['37'];
        requestData['52'] = pinBlock;
        requestData['15'] = mmdd;
        requestData['18'] = "6010";
        requestData['26'] = "04";
        requestData['28'] = "0";
        requestData['30'] = "0";
        requestData['32'] = "424367";
        requestData['103'] = this.getSettlementCode(requestData['41'])
        // Account to be settled (After the settlement fee is deducted)
        requestData['128'] = null;
        // set dummy data to avoid binary character encode ish of d127 bitmap

        let xmlICC = this.Util.mapICCDataToXML(unpackedMessage);
        if (!xmlICC){
            xmlICC = await this.Util.generateStaticICCData(unpackedMessage);
        }
        
        //logger.info("Upsl: ICC Data" + xmlICC);

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
        subFieldMessage['2'] = '3944065709' 
        subFieldMessage['3'] = 'UBATAMAGYsrcUPAgencySnk 703834703834VISMASTOTGRP'
        subFieldMessage['12'] = '111128'
        subFieldMessage['13'] = '1111111111    566'
        subFieldMessage['20'] = '20211223'
        subFieldMessage['22'] = '17REFCODE2277070_PAX~3K440945~7.8.23UBA'
        subFieldMessage['25'] = xmlICC
        //subFieldMessage['33'] = '6008'

        let subIso = this.iso8583Parser.packSubFieldWithBinaryBitmap(subFieldMessage, config['127'].nestedElements);

        msg.setField(127, subIso.isoMessage)

        let hexIsoMessage = ISOUtil.hexString(msg.pack());        
        let isoLength = hexIsoMessage.length / 2;
        let binLength = this.Util.getLengthBytes(isoLength);
        const isoMessageBuffer = Buffer.from(ISOUtil.hex2byte(hexIsoMessage)); 
        const requestISOMsg = Buffer.concat([binLength, isoMessageBuffer]);

        const { IP, PORT } = this.getSwitchParams()
        const SocketClientHandle = new SocketClient(IP, PORT, false)

        let socketHandler: any;

        if(globalSocketClient !== null){
            globalSocketClient.on('close', () => {
                globalSocketClient = null
            })
        }

        if(globalSocketClient == null){
            socketHandler = SocketClientHandle.startClient(requestISOMsg);
            globalSocketClient = socketHandler
        } else {
            socketHandler = SocketClientHandle.reUseClient(globalSocketClient, requestISOMsg)
        }   

        return new Promise((resolve, reject) => {
            
                logger.info(`Upsl: Sending Online Transaction Request to ${IP}:${PORT} >>>>>>>>>>>> with data ${requestISOMsg.toString()}` );
                
                let hexData = ''
                socketHandler.on('data', async (data: any) => {
                    hexData += Buffer.from(data).toString('hex');
                    if(hexData.length < 4)
                        return;  
                    
                    logger.info(`Upsl Online Transaction Response Recieved at ${new Date()};`);
                    
                    msg.unpack(ISOUtil.hex2byte(this.sanitizeHexData(hexData)));
                    const unpackedMessage = msg.fields;

                    logger.info(`Upsl Online Transaction Unpacked Message, ${JSON.stringify(unpackedMessage)}`);

                    logger.info(`Upsl, Response code: ${this.getFieldValue(unpackedMessage, 39)}`)

                    let responseData = this.mapToNibssResponse(unpackedMessage);

                    resolve(responseData);
                });


                socketHandler.on('timeout', async () => {
                    socketHandler.end();
                    globalSocketClient = null

                    logger.info('Closing the client because the handling server timed-out without a response MTI:: ');

                    const responseData = await this.generateCustomResponse(requestData, "101");
                    logger.info(`Upsl: OnlineMapped Response Object => ${JSON.stringify(responseData)}`)

                    const Tnx = await this.handleCardTransaction.getTransaction(responseData.terminalId, responseData.rrn)

                    if(Tnx === false){
                        resolve(responseData);
                    } else if(Tnx && Tnx.responseCode == '102' ){
                        resolve(responseData);
                    } else {
                        // Do nothing
                    }                    
                    // Capture other data here...
                });

                socketHandler.on('error', async (err: any) => {

                    socketHandler.end();
                    globalSocketClient = null

                    logger.info('Upsl: Error occurred => ' + JSON.stringify(err))
                    const responseData = await this.generateCustomResponse(requestData, "103");
                    logger.info(`Upsl: Online Mapped Response Object => ${JSON.stringify(responseData)}`)

                    const Tnx = await this.handleCardTransaction.getTransaction(responseData.terminalId, responseData.rrn)
                

                    if(Tnx === false){
                        resolve(responseData);
                    } else if(Tnx && Tnx.responseCode == '102' ){
                        resolve(responseData);
                    } else {
                        // Do nothing
                    }
                });

            }

       );

    }

    async sendOfflineTransaction(unpackedMessage: any){
        let requestData: any = {};
        Object.assign(requestData, unpackedMessage.dataElements);
        let subFieldMessage = baseSubFieldMessage;

        let date = new Date();
        const mmdd = this.Util.padLeft((date.getMonth()+1).toString(),'0',2) + this.Util.padLeft(date.getDate().toString(),'0',2)

        // For CashOut Interswitch
        requestData['41'] = this.getTerminalId(requestData['41']);
        requestData['42'] = `2AGTLAGPOOO7964`;
        requestData['3'] = '011000';
        // For Cashout End
        //requestData['23'] = null;
        requestData['56'] = "1510";
        requestData['59'] = unpackedMessage.dataElements['37'];
        requestData['52'] = null;
        requestData['15'] = mmdd;
        requestData['18'] = "6010";
        requestData['26'] = "04";
        requestData['28'] = "0";
        requestData['30'] = "0";
        requestData['32'] = "424367";
        requestData['103'] = this.getSettlementCode(requestData['41'])
        // Account to be settled (After the settlement fee is deducted)
        requestData['128'] = null;
        // set dummy data to avoid binary character encode ish of d127 bitmap

        let xmlICC = this.Util.mapICCDataToXML(unpackedMessage);
        if (!xmlICC){
            xmlICC = await this.Util.generateStaticICCData(unpackedMessage);
        }
        
        //logger.info("Upsl: ICC Data" + xmlICC);

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
        msg.setField(56, requestData[56])
        msg.setField(59, requestData[59])
        msg.setField(98, requestData[98])
        msg.setField(100, requestData[100])
        msg.setField(103, requestData[103])
        msg.setField(123, requestData[123])

        /**
         * Generate Sub-ISO Message for Field 127 <<< 
        */
        subFieldMessage['2'] = '3944065709' 
        subFieldMessage['3'] = 'UBATAMAGYsrcUPAgencySnk 703834703834VISMASTOTGRP'
        subFieldMessage['12'] = '111128'
        subFieldMessage['13'] = '1111111111    566'
        subFieldMessage['20'] = '20211223'
        subFieldMessage['22'] = '17REFCODE2277070_PAX~3K440945~7.8.23UBA'
        subFieldMessage['25'] = xmlICC
        //subFieldMessage['33'] = '6008'

        let subIso = this.iso8583Parser.packSubFieldWithBinaryBitmap(subFieldMessage, config['127'].nestedElements);
        //logger.info(`Interswitch SubISO msg: ${subIso.isoMessage}`);

        msg.setField(127, subIso.isoMessage)

        let hexIsoMessage = ISOUtil.hexString(msg.pack());        
        let isoLength = hexIsoMessage.length / 2;
        let binLength = this.Util.getLengthBytes(isoLength);
        const isoMessageBuffer = Buffer.from(ISOUtil.hex2byte(hexIsoMessage)); 
        const requestISOMsg = Buffer.concat([binLength, isoMessageBuffer]);

        const { IP, PORT } = this.getSwitchParams()
        const SocketClientHandle = new SocketClient(IP, PORT, false)

        let socketHandler: any;

        if(globalSocketClient !== null){
            globalSocketClient.on('close', () => {
                globalSocketClient = null
            })
        }

        if(globalSocketClient == null){
            socketHandler = SocketClientHandle.startClient(requestISOMsg);
            globalSocketClient = socketHandler
        } else {
            socketHandler = SocketClientHandle.reUseClient(globalSocketClient, requestISOMsg)
        }   

        return new Promise((resolve, reject) => {
                
                logger.info(`Upsl: Sending Offline Transaction Request to ${IP}:${PORT} >>>>>>>>>>>> with data ${requestISOMsg.toString()}` );
                
                let hexData = ''
                socketHandler.on('data', async (data: any) => {
                    hexData += Buffer.from(data).toString('hex');
                    if(hexData.length < 4)
                        return;  
                    
                    logger.info(`Upsl Transaction Response Recieved at ${new Date()};`);
                    
                    msg.unpack(ISOUtil.hex2byte(this.sanitizeHexData(hexData)));
                    const unpackedMessage = msg.fields;

                    logger.info(`Upsl Offline Transaction Unpacked Message, ${JSON.stringify(unpackedMessage)}`);

                    logger.info(`Upsl, Response code: ${this.getFieldValue(unpackedMessage, 39)}`)

                    let responseData = this.mapToNibssResponse(unpackedMessage);

                    resolve(responseData);
                });


                socketHandler.on('timeout', async () => {
                    socketHandler.end();
                    globalSocketClient = null

                    logger.info('Closing the client because the handling server timed-out without a response MTI:: ');

                    const responseData = await this.generateCustomResponse(requestData, "101");
                    logger.info(`Upsl: Mapped Response Object => ${JSON.stringify(responseData)}`)

                    const Tnx = await this.handleCardTransaction.getTransaction(responseData.terminalId, responseData.rrn)

                    if(Tnx === false){
                        resolve(responseData);
                    } else if(Tnx && Tnx.responseCode == '102' ){
                        resolve(responseData);
                    } else {
                        // Do nothing
                    }                    
                    // Capture other data here...
                });

                socketHandler.on('error', async (err: any) => {

                    socketHandler.end();
                    globalSocketClient = null

                    logger.info('Upsl: Error occurred => ' + JSON.stringify(err))
                    const responseData = await this.generateCustomResponse(requestData, "103");
                    logger.info(`Upsl: Mapped Response Object => ${JSON.stringify(responseData)}`)

                    const Tnx = await this.handleCardTransaction.getTransaction(responseData.terminalId, responseData.rrn)

                    if(Tnx === false){
                        resolve(responseData);
                    } else if(Tnx && Tnx.responseCode == '102' ){
                        resolve(responseData);
                    } else {
                        // Do nothing
                    }
                });

            }

       );

    }

    async payAttitude(unpackedMessage: any){
        let requestData: any = {};
        Object.assign(requestData, unpackedMessage.dataElements);
        let transactionDateTime = this.Util.getTransmissionDateandTime();
        let datetime = (new Date).getTime().toString();
        let subFieldMessage = baseSubFieldMessage;
       
        const rrn = this.Util.generateRRN()

        requestData['2'] = "9501000000000001" //unpackedMessage['2'];
        requestData['3'] = "010000" //unpackedMessage.dataElements['3'];
        requestData['4'] = unpackedMessage['amount'];
        requestData['7'] = transactionDateTime;
        requestData['11'] = datetime.substr(datetime.length - 6);
        requestData['12'] = transactionDateTime.substr(4);
        requestData['13'] = transactionDateTime.substr(0, 4);
        requestData['14'] = '4912';
        requestData['15'] = '107';
        requestData['18'] = '6011';
        requestData['22'] = "901" //unpackedMessage.dataElements['22'];
        requestData['23'] = "000" //unpackedMessage.dataElements['23'];
        requestData['25'] = "0";
        requestData['28'] = "0"
        requestData['30'] = "0"
        requestData['32'] = "457714" //unpackedMessage.dataElements['32'];
        requestData['33'] = "111111" //unpackedMessage.dataElements['35'];
        requestData['35'] = "9501000000000001=4912101"
        //dataElements['35'] = "9501000000000001" 
        requestData['37'] = rrn
        requestData['40'] = "101"
        requestData['41'] = unpackedMessage['terminalId']
        requestData['42'] = "1116060609"
        requestData['43'] = "WT|GAMBO SANI            GOMBE        NG"
        requestData['49'] = '566';
        requestData['56'] = "1510"
        requestData['59'] = "6047914977";
        requestData['100'] = "909111"
        requestData['123'] = "155112012033440"     
        
        //logger.info("Upsl: ICC Data" + xmlICC);
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
        msg.setField(56, requestData[56])
        msg.setField(59, requestData[59])
        msg.setField(98, requestData[98])
        msg.setField(100, requestData[100])
        msg.setField(123, requestData[123])

        // /**
        //  * Generate Sub-ISO Message for Field 127 <<< 
        // */
        subFieldMessage['2'] = rrn
        subFieldMessage['3'] = "AGENCY4fets UPVASsnk    FET371784330DebitGroup  "
        subFieldMessage['12'] = "SWTFETsnk"
        subFieldMessage['13'] = "01234000000   566"
        subFieldMessage['14'] = "FETS    "
        subFieldMessage['20'] = "20220111"
        subFieldMessage['22'] = "<BufferB>" + unpackedMessage['phoneNumber'] + "</BufferB>"
        subFieldMessage['25'] = null
     
        let subIso = this.iso8583Parser.packSubFieldWithBinaryBitmap(subFieldMessage, config['127'].nestedElements);
        logger.info(`Upsl SubISO msg: ${subIso.isoMessage}`);

        msg.setField(127, subIso.isoMessage)

        let hexIsoMessage = ISOUtil.hexString(msg.pack());        
        let isoLength = hexIsoMessage.length / 2;
        let binLength = this.Util.getLengthBytes(isoLength);
        const isoMessageBuffer = Buffer.from(ISOUtil.hex2byte(hexIsoMessage)); 
        const requestISOMsg = Buffer.concat([binLength, isoMessageBuffer]);

        const { IP, PORT } = this.getSwitchParams()
        const SocketClientHandle = new SocketClient(IP, PORT, false)

        return new Promise((resolve, reject) => {
                let socketHandler = SocketClientHandle.startClient(requestISOMsg);
                logger.info(`Upsl: Sending Payattitude Transaction Request to ${IP}:${PORT} >>>>>>>>>>>> with data ${requestISOMsg.toString()}` );
                
                let hexData = ''
                socketHandler.on('data', async (data: any) => {
                    hexData += Buffer.from(data).toString('hex');
                    if(hexData.length < 4)
                        return;  
                    
                    logger.info(`Upsl Payattitude Response Recieved at ${new Date()};`);
                    
                    msg.unpack(ISOUtil.hex2byte(this.sanitizeHexData(hexData)));
                    const unpackedMessage = msg.fields;

                    logger.info(`Upsl Payattitude Transaction Unpacked Message, ${JSON.stringify(unpackedMessage)}`);

                    logger.info(`Upsl, Payattitude Response code: ${this.getFieldValue(unpackedMessage, 39)}`)

                    let responseData = this.mapToNibssResponse(unpackedMessage);
                    socketHandler.destroy()

                    resolve(responseData);
                });


                socketHandler.on('timeout', async () => {
                    logger.info('Closing the client because the handling server timed-out without a response MTI:: ');

                    const responseData = await this.generateCustomResponse(requestData, "101");
                    logger.info(`Upsl: Mapped Response Object => ${JSON.stringify(responseData)}`)

                    const Tnx = await this.handleCardTransaction.getTransaction(responseData.terminalId, responseData.rrn)
                    socketHandler.destroy()

                    if(Tnx === false){
                        resolve(responseData);
                    } else if(Tnx && Tnx.responseCode == '102' ){
                        resolve(responseData);
                    } else {
                        // Do nothing
                    }                    
                    // Capture other data here...
                });

                socketHandler.on('error', async (err: any) => {

                    //this.signOn(); //

                    logger.info('Upsl: Error occurred => ' + JSON.stringify(err))
                    const responseData = await this.generateCustomResponse(requestData, "103");
                    logger.info(`Upsl: Mapped Response Object => ${JSON.stringify(responseData)}`)

                    const Tnx = await this.handleCardTransaction.getTransaction(responseData.terminalId, responseData.rrn)

                    socketHandler.destroy()

                    if(Tnx === false){
                        resolve(responseData);
                    } else if(Tnx && Tnx.responseCode == '102' ){
                        resolve(responseData);
                    } else {
                        // Do nothing
                    }
                });

            }

       );

    }

    async generateCustomResponse(requestData: any, responseCode: string){
        let responseData: any = {};
        responseData.responseCode = responseCode;
        responseData.terminalId = requestData['41'];
        responseData.switchTerminalId = requestData['41'];
        responseData.rrn = requestData['37'] || '';
        responseData.stan = requestData['11'] || '';
        responseData.authCode = requestData['38'] !== null ? requestData['38'] : 'U29189' ;
        responseData.amount = requestData['4'];
        return responseData;
    }

    async signOn(){

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
            logger.info(`Upsl: ${isoMessage}`);
            
            let isoLength = isoMessage.length / 2;

            let binLength = this.Util.getLengthBytes(isoLength);
            const isoMessageBuffer = Buffer.from(ISOUtil.hex2byte(isoMessage)); 
            const requestData = Buffer.concat([binLength, isoMessageBuffer]);
            
            const { IP, PORT } = this.getSwitchParams()
            const SocketClientHandle = new SocketClient(IP, PORT, false)

            let socketHandler: any;

            if(globalSocketClient !== null){
                globalSocketClient.on('close', () => {
                    globalSocketClient = null
                })
            }

            if(globalSocketClient == null){
                socketHandler = SocketClientHandle.startClient(requestData);
                globalSocketClient = socketHandler
            } else {
                socketHandler = SocketClientHandle.reUseClient(globalSocketClient, requestData)
            }   

            return new Promise((resolve, reject) => {

                logger.info(`Upsl: Sending Sign-on Data to ${IP}:${PORT} >>>>>>>>>>>> with data ${requestData.toString()}` );

                let hexData = ''
                socketHandler.on('data', async (data: any) => {

                    hexData += Buffer.from(data).toString('hex'); 
                    if(hexData.length < 4)
                        return;

                    logger.info(`Upsl Sign-on request was successful at ${new Date()} >> Data: ${data.toString()}`);
                    let unpackMsg = this.myPackager.createISOMsg();
                    unpackMsg.unpack(ISOUtil.hex2byte(this.sanitizeHexData(hexData)));
                    const unpackedMessage = unpackMsg.fields;

                    logger.info(`Upsl Unpacked Message, ${JSON.stringify(unpackedMessage)}`);

                    //this.echoRequest()
                    //resolve(unpackedMessage)

                });

                socketHandler.on('error', (err: any) => {
                    socketHandler.end();
                    globalSocketClient = null
                    logger.info(`Upsl Sign-on request failed at ${new Date()} - Error => ${err}`);
                    //resolve(err);
                });

            });

        } catch(error: any){
            logger.info(`Upsl Exception - Error => ${error.stack}`);

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

    
    async echoRequest(){

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
            logger.info(`Upsl ECHO Message: ${isoMessage}`);
            
            let isoLength = isoMessage.length / 2;

            let binLength = this.Util.getLengthBytes(isoLength);
            const isoMessageBuffer = Buffer.from(ISOUtil.hex2byte(isoMessage)); 
            const requestData = Buffer.concat([binLength, isoMessageBuffer]);
            
            const { IP, PORT } = this.getSwitchParams()
            const SocketClientHandle = new SocketClient(IP, PORT, false)

            let socketHandler: any;

            if(globalSocketClient !== null){
                globalSocketClient.on('close', () => {
                    globalSocketClient = null
                })
            }

            if(globalSocketClient == null){
                socketHandler = SocketClientHandle.startClient(requestData);
                globalSocketClient = socketHandler
            } else {
                socketHandler = SocketClientHandle.reUseClient(globalSocketClient, requestData)
            }   

            return new Promise((resolve, reject) => {

                logger.info(`Upsl: Sending ECHO to ${IP}:${PORT} >>>>>>>>>>>> with data ${requestData.toString()}` );

                let hexData = ''
                socketHandler.on('data', async (data: any) => {
                    logger.info(`Upsl ECHO request was successful at ${new Date()} >> Data: `);
                    hexData += Buffer.from(data).toString('hex'); 
                    if(hexData.length < 4)
                        return;   

                    let unpackMsg = this.myPackager.createISOMsg();
                    unpackMsg.unpack(ISOUtil.hex2byte(this.sanitizeHexData(hexData)));
                    const unpackedMessage = unpackMsg.fields;

                    logger.info(`Upsl Unpacked Message, ${JSON.stringify(unpackedMessage)}`);

                    //resolve(unpackedMessage)
                });

                socketHandler.on('error', (err: any) => {
                    logger.info(`Upsl ECHO request failed at ${new Date()} - Error => ${err}`);
                    socketHandler.end();
                    globalSocketClient = null

                    //reject(err);
                });

            });

        } catch(error: any){
            logger.info(`Upsl Exception - Error => ${error.stack}`);

        }

    }
    
     /**
     * map interswitch response to nibss response for POS.
     * @param {Object} unpackedMessage unpacked message from Interswitch
     * @returns {Object} object with rescode, authCode and iccResponse
     */
    mapToNibssResponse(unpackedMessage: any) {
        let responseData: any = {};
        responseData.responseCode = this.getFieldValue(unpackedMessage, 39);
        responseData.switchTerminalId = this.getFieldValue(unpackedMessage, 41);
        responseData.rrn = this.getFieldValue(unpackedMessage, 37);
        responseData.stan = this.getFieldValue(unpackedMessage, 11);
        responseData.authCode = this.getFieldValue(unpackedMessage, 38) !== null ? this.getFieldValue(unpackedMessage, 38) : 'UNI000' ;
        responseData.amount = this.getFieldValue(unpackedMessage, 4);
        // Capture other data here...
        logger.info(`Upsl: Mapped Response Object => ${JSON.stringify(responseData)}`)
        return responseData;
    }

     async writeToPOS(socket:any, socketClient: any, data: any){
        let write = false;

        try{

            logger.info("Upsl: Writing to POS ::::: " + socket.name + ': Data: ' + data.toString())
            write = socket.write(data)

            if(write){
                logger.info('Upsl: Data written to POS!')
                socket.end() // Else, POS won't print
                //socketClient.end()
                return write;
            } else {
                logger.err('Upsl: Failed to write to POS!')
                socket.end() // Else, POS won't print
                //socketClient.end()
                return write;
            }

        } catch(err){
            logger.err('Upsl: Failed to write to POS:: ' + err)
            socket.end() // Else, POS won't print
            socketClient.end()
            return write;
        }
     
    }

    private getSwitchParams(){
        
        const serverData = {
            IP: process.env.UP_IP || '196.46.20.30',
            PORT: process.env.UP_PORT || '3388',
            settlementAccountPayee: process.env.UPSL_SETTLEMENT_ACCOUNT,
            settlementAccountPayer: '123456789'
        }

        return serverData
        
    }

    private getSettlementCode(terminalId: string){
        const f4 = terminalId.substring(0,4)
         switch (f4) {
            case "2103":
                return "87001528"; // Globus
            case "2033":
                return "87001529"; // Uba
            case "2100":
                return "87001530"; // Suntrust
            case "2214":
                return "87001531"; // Fcmb
            case "2057":
                return "87001532"; // Zenith
            case "2076":
                return "87001526"; // Polaris
            default:
                return "87001526";
         }
    }
  

}

export default Upsl