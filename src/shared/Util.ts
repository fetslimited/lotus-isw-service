import '../pre-start'; // Must be the first import
const TlvTags =  require('../configs/tvlTags.json');
import Xml2js from 'xml2js'
const parser = require('xml2json-light')
import logger from './Logger';
import {json2xml } from 'xml-js'
import crypto from 'crypto'
//import bufferXor from 'buffer-xor'
const bufferXor = require('buffer-xor')

class Util {

    generateRRN(){
        let date = new Date();
        const year = ((date.getFullYear()).toString()).substr(2,4)
        const rrn = this.padLeft(year,'0',2) + this.padLeft((date.getMonth()+1).toString(),'0',2) + this.padLeft(date.getDate().toString(),'0',2) + this.padLeft(date.getHours().toString(),'0',2) + this.padLeft(date.getMinutes().toString(),'0',2) + this.padLeft(date.getSeconds().toString(),'0',1)
        return rrn;
    }

    des3Encrypt = (hexData: string , secretKey: Buffer) => {
        secretKey = Buffer.concat([secretKey, secretKey.slice(0, 8)]); // properly expand 3DES key from 128 bit to 192 bit
        let cipher = crypto.createCipheriv('des-ede3', secretKey, '');
        //cipher.setAutoPadding(false);
        const encrypted = cipher.update(hexData, 'hex', 'hex');
        const result =  encrypted + cipher.final('hex');
        return result.toUpperCase();
    };

     des3EncryptNoPadding = (hexData: string , secretKey: Buffer) => {
        secretKey = Buffer.concat([secretKey, secretKey.slice(0, 8)]); // properly expand 3DES key from 128 bit to 192 bit
        let cipher = crypto.createCipheriv('des-ede3', secretKey, '');
        cipher.setAutoPadding(false);
        const encrypted = cipher.update(hexData, 'hex', 'hex');
        const result =  encrypted + cipher.final('hex');
        return result.toUpperCase();
    };

    des3Decrypt = (encrypted: any, secretKey: Buffer) => {
        //logger.info(secretKey.toString('hex'))
        //secretKey = Buffer.concat([secretKey, secretKey.slice(0, 8)]); // properly expand 3DES key from 128 bit to 192 bit
        let decipher = crypto.createDecipheriv('des-ede', secretKey, Buffer.alloc(0));
        decipher.setAutoPadding(false);
        let decrypted: any = decipher.update(encrypted, 'hex', 'hex');
        decrypted += decipher.final('hex');
        return decrypted;
    };

    /**
     * xor two hex string
     * @param {String} value_1 operand 1 in hex
     * @param {String} value_2 operand 2 in hex
     * @returns {String} xor result in hex
     */
    xorHexString(value_1: any,value_2: any){
        let a = Buffer.from(value_1, 'hex')
        let b = Buffer.from(value_2, 'hex');
        let result = bufferXor(a,b);
        return result;
    }

    /**
     * XOR the two component keys
     * @param {Boolean} isTest
     * @returns {String} xor componentKeys 
     */
    xorComponentKey(){
        const key_1 = process.env.ISW_COMPONENT_KEY1 || '10101010101010101010101010101010';
        const key_2 = process.env.ISW_COMPONENT_KEY2 || '01010101010101010101010101010101';
        return this.xorHexString(key_1,key_2);   
    }


    byteArrayToHexString(byteArray: any) {
        const data = Array.from(byteArray, function(byte: any) {
            return ('0' + (byte & 0xFF).toString(16)).slice(-2);
        }).join('')
        return data.toUpperCase()
    }

    convertXMLtoJSON(xml: any) {
        let complete_xml = xml;
        let json = parser.toJson(complete_xml)
        return json;
    }
    /**
     * convert xml string response from interswitch to  nibss format to return in response to POS
     * @param {String} xmlIccData xml data string (field 127.25 from interswitch response)
     */
    mapInterswitchICCresponseToNibbs(xmlIccData: any){
        if(xmlIccData == null || xmlIccData == undefined)
            return false;
        
        let jsonData = this.convertXMLtoJSON(xmlIccData);
        let data = JSON.parse(jsonData);
        console.log(JSON.stringify(data));

        if(data["IccData"])
        {
            if(data["IccData"]["IccResponse"])
            {
                let IccResponse = data["IccData"]["IccResponse"];
                let mappedTag = new Map();

                if(IccResponse.ApplicationTransactionCounter)
                    mappedTag.set("9F36",IccResponse.ApplicationTransactionCounter._text);
                if(IccResponse.IssuerAuthenticationData)
                    mappedTag.set("91",IccResponse.IssuerAuthenticationData._text);
                if(IccResponse.IssuerScriptTemplate2)
                    mappedTag.set("71",IccResponse.IssuerScriptTemplate2._text);

                if(mappedTag.size <= 0)
                {
                    return false;
                }

                return this.buildIccData(mappedTag);
        
            }
        }
        return false;

    }

    /**
     * convert mapped TLV tags to structure Icc data
     * @param {Map} tagsMap map of TLV tags
     * @returns {String}
     */
    buildIccData(tagsMap: any){
        let iccData = '';
        tagsMap.forEach((data: any, tag: any)=>{
            iccData += tag;
            let dataLength = data.length;
            dataLength= dataLength/2;
            let hexLen = dataLength.toString(16);
            //console.log(hexLen);
            iccData+= this.padLeft(hexLen,"0",2) + data;
        });
        return iccData.toUpperCase();
    }

    /**
     * map icc data from POS to XML
     * @param {Object} unpackedMessage unpacked message from POS
     * @returns {String} xml string of the iccdata
     */
    public mapICCDataToXML(unpackedMessage: any)
    {
        logger.info("Interswitch: Mapping ICC Data to XML")
        try{
            let iccdata = this.getICCData(unpackedMessage);

            if(!iccdata){
                logger.info("Interswitch: No ICC data found in message")
                return false;
            }
        
            logger.info("Interswitch: Building ICC data object from tags")
            
            // Build the IccRequest object, only including fields that have values
            const iccRequest: any = {};
            
            // Required fields with safe retrieval
            const amountAuthorized = iccdata.get('9F02');
            if(amountAuthorized) iccRequest.AmountAuthorized = amountAuthorized;
            
            // AmountOther (9F03) - missing in original implementation
            const amountOther = iccdata.get('9F03');
            if(amountOther) iccRequest.AmountOther = amountOther;
            
            const applicationInterchangeProfile = iccdata.get('82');
            if(applicationInterchangeProfile) iccRequest.ApplicationInterchangeProfile = applicationInterchangeProfile;
            
            const applicationTransactionCounter = iccdata.get('9F36');
            if(applicationTransactionCounter) iccRequest.ApplicationTransactionCounter = applicationTransactionCounter;
            
            const cryptogram = iccdata.get('9F26');
            if(cryptogram) iccRequest.Cryptogram = cryptogram;
            
            const cryptogramInformationData = iccdata.get('9F27');
            if(cryptogramInformationData) iccRequest.CryptogramInformationData = cryptogramInformationData;
            
            const cvmResults = iccdata.get('9F34');
            if(cvmResults) iccRequest.CvmResults = cvmResults;
            
            const issuerApplicationData = iccdata.get('9F10');
            if(issuerApplicationData) iccRequest.IssuerApplicationData = issuerApplicationData;
            
            const terminalCapabilities = iccdata.get('9F33');
            if(terminalCapabilities) iccRequest.TerminalCapabilities = terminalCapabilities;
            
            const terminalCountryCode = iccdata.get('9F1A');
            if(terminalCountryCode) iccRequest.TerminalCountryCode = this.removeLeftPad(terminalCountryCode, 3);
            
            const terminalVerificationResult = iccdata.get('95');
            if(terminalVerificationResult) iccRequest.TerminalVerificationResult = terminalVerificationResult;
            
            const transactionCurrencyCode = iccdata.get('5F2A');
            if(transactionCurrencyCode) iccRequest.TransactionCurrencyCode = this.removeLeftPad(transactionCurrencyCode, 3);
            
            const transactionDate = iccdata.get('9A');
            if(transactionDate) iccRequest.TransactionDate = transactionDate;
            
            const transactionType = iccdata.get('9C');
            if(transactionType) iccRequest.TransactionType = transactionType;
            
            const unpredictableNumber = iccdata.get('9F37');
            if(unpredictableNumber) iccRequest.UnpredictableNumber = unpredictableNumber;

            logger.info(`Interswitch: ICC Request object: ${JSON.stringify(iccRequest)}`)
            
            let options = {
                compact: true,
                ignoreComment: true
            };

            let data = {
                IccData: {
                    IccRequest: iccRequest
                }
            };

            logger.info("Interswitch: Converting ICC data to XML")
            const result = json2xml(JSON.stringify(data), options)
            const xmlResult = `<?xml version="1.0" encoding="UTF-8"?>${result}`;
            logger.info(`Interswitch: Generated ICC XML: ${xmlResult}`)
            return xmlResult;
        } catch(err: any){
            logger.err(`Interswitch: Error mapping ICC Data - ${err.message}`)
            logger.err(`Interswitch: Stack trace: ${err.stack}`)
            return false;
        }
        
    }

    public generateStaticICCData(unpackedMessage: any){
        let date = new Date();
        const yymmdd = this.padLeft((date.getFullYear()).toString(),'0',2) + this.padLeft((date.getMonth()+1).toString(),'0',2) + this.padLeft(date.getDate().toString(),'0',2)
        // return `<?xml version="1.0" encoding="UTF-8"?><IccData><IccRequest><AmountAuthorized>${unpackedMessage.dataElements['4']}</AmountAuthorized><ApplicationInterchangeProfile>3900</ApplicationInterchangeProfile><ApplicationTransactionCounter>02B9</ApplicationTransactionCounter><Cryptogram>64A2A1F02A9DE3D4</Cryptogram><CryptogramInformationData>80</CryptogramInformationData><CvmResults>410302</CvmResults><IssuerApplicationData>0110A000002A000046E300000000000000FF</IssuerApplicationData><TerminalCapabilities>E0E8C8</TerminalCapabilities><TerminalCountryCode>566</TerminalCountryCode><TerminalType>22</TerminalType><TerminalVerificationResult>0000340000</TerminalVerificationResult><TransactionCurrencyCode>566</TransactionCurrencyCode><TransactionDate>${yymmdd}</TransactionDate><TransactionType>00</TransactionType><UnpredictableNumber>3FF6AE55</UnpredictableNumber></IccRequest></IccData>`
        return ``;
    }
     /**
     * read throught the iccdata string, compare tag with the one in config,
     *  read length convert to int , divide by 2 and use the length to read
     *  the tag data. 
     * @param {Object} unpackedMessage unpackmessage object from POS or HOST
     */
    getICCData(unpackedMessage: any) {
        try{
            let nibssICC = unpackedMessage.dataElements[55];
            logger.info(`Interswitch: ICC Field 55 Data: ${nibssICC}`)
            
            if (nibssICC) {
                let iccDataList = new Map();
                let skip = 0;
                let iterationCount = 0;
                const maxIterations = 1000; // Prevent infinite loops
                
                while (skip < nibssICC.length && iterationCount < maxIterations) {
                    iterationCount++;
                    
                    // Try to find 2-byte tag first
                    let tag: any = TlvTags.find((c: any) => c.tag == nibssICC.substr(skip, 2));
                    let tagLength = 2;
                    
                    if (!tag) {
                        // Try 4-byte tag
                        tag = TlvTags.find((c: any) => c.tag == nibssICC.substr(skip, 4));
                        tagLength = 4;
                    }
                    
                    if (!tag) {
                        // Unknown tag - log and skip to avoid infinite loop
                        const unknownTag = nibssICC.substr(skip, 4);
                        //logger.warn(`Interswitch: Unknown ICC tag ${unknownTag} at position ${skip} - skipping 2 bytes`);
                        skip += 2; // Skip minimal amount to avoid infinite loop
                        continue;
                    }
                    
                    // Move past the tag
                    skip += tagLength;
                    
                    // Read length byte
                    if (skip + 2 > nibssICC.length) {
                        logger.warn(`Interswitch: Incomplete ICC data at position ${skip} for tag ${tag.tag}`);
                        break;
                    }
                    
                    let lengthHex = nibssICC.substr(skip, 2);
                    let dataLength = (Number.parseInt(lengthHex, 16)) * 2;
                    skip += 2;
                    
                    // Read data
                    if (skip + dataLength > nibssICC.length) {
                        logger.warn(`Interswitch: Incomplete data for tag ${tag.tag} at position ${skip}, expected ${dataLength} bytes`);
                        break;
                    }
                    
                    let data = nibssICC.substr(skip, dataLength);
                    skip += dataLength;
                    
                    iccDataList.set(tag.tag, data);
                    //logger.info(`Interswitch: Parsed tag ${tag.tag}, length: ${dataLength/2} bytes, data: ${data}`);
                }
                
                if (iterationCount >= maxIterations) {
                    logger.err('Interswitch: Maximum iterations reached while parsing ICC data - possible infinite loop');
                }
                
                logger.info(`Interswitch: Successfully parsed ${iccDataList.size} ICC tags`);
                return iccDataList;
            }
            
            logger.info('Interswitch: No ICC data (field 55) found in message');
            return false;

        } catch(error: any){
            logger.err('Interswitch: Error getting ICC Data: ' + error.message)
            logger.err('Interswitch: Stack trace: ' + error.stack)
            return false;
        }
        
    }

    /**
     * extract pinblock from unpacked message
     * @param {Object} unpackedMessage unpacked message from POSs
     */
    public getPinBLock(unpackedMessage: any){
        return unpackedMessage.dataElements[52];
    }

    /**
     * get the length of the iso message in binary
     * @param {Number} length length of the data in decimal
     * @returns {Binary} length in binary
     */
    public getLengthBinary(length: any){
        let d = length & 0xFF;
        let c = length >> 8;
        return String.fromCharCode(c) + String.fromCharCode(d);
    }

    public getLengthBytes(length: any){
        // console.log("length "+length.toString());
        const d = length & 0xFF;
        // console.log(d);
        const c = length >> 8;
        const array: any = [c,d]
        return Buffer.from(array,'binary');
    }

    public padLeft(data: string, padChar: string,length: number){
        let result = data
        while(result.length < length)
        {
            result = padChar + result;
        }
        return result;
    }

    public padRight(data: string, padChar: string, length: number){
        let result = data
        while(result.length < length)
        {
            result+= padChar;
        }
        return result;
    }

    public getTransmissionDateandTime(){
        let date = new Date();
        let result = this.padLeft((date.getMonth()+1).toString(),'0',2) + this.padLeft(date.getDate().toString(),'0',2) + this.padLeft(date.getHours().toString(),'0',2) + this.padLeft(date.getMinutes().toString(),'0',2) + this.padLeft(date.getSeconds().toString(),'0',2);
        // console.log(result);
        return result;
    }

    public removeLeftPad(data: any,len: number){
        return data.substr(data.length-len);
    }

    
}

export default Util