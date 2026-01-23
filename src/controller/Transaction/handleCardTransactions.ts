/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable max-len */
import '../../pre-start'; // Must be the first import
import TransactionModel from '../../database/model/TransactionModel';
import SummaryModel from '../../database/model/SummaryModel'
import logger from '../../shared/Logger';
import fs = require('fs');
import { getNibssResponseMessageFromCode } from '../../utils/responseUtil'
import endOfDay from 'date-fns/endOfDay'
import startOfDay from 'date-fns/startOfDay'
import { ITransaction } from '../../database/interface/i_transaction'
class handleCardTransactions {

    handlerUsed: string
    appEnv: string

    constructor(){
        this.handlerUsed = 'NIBSS'
        this.appEnv = process.env.NODE_ENV
    }

    public async getTransactionReversal(terminalId: string, rrn: string){
        //Fetch transaction
        const transaction = await TransactionModel.findOne({
            rrn: rrn,
            terminalId: terminalId,
            tranType: 'REVERSAL'
        })

        if(transaction){
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return transaction
        } else {
            return false
        }
    }

    public async getTransaction(terminalId: string, rrn: string){
        //Fetch transaction
        const transaction = await TransactionModel.findOne({
            rrn: rrn,
            terminalId: terminalId
        }).lean()

        if(transaction){
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return transaction;
        } else {
            return false
        }
    }

    public async getTransactionISO(terminalId: string, rrn: string){
        //Fetch transaction
        const transaction = await TransactionModel.findOne({
            rrn: rrn,
            terminalId: terminalId,
            responseCode: '00'
        })

        if(transaction){
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return transaction.ISOResponse ? transaction.ISOResponse : false
        } else {
            return false
        }
    }

    public async getAnyTransactionISO(terminalId: string, rrn: string, handler: string){
        //Fetch transaction
        const transaction = await TransactionModel.findOne({
            rrn: rrn,
            terminalId: terminalId,
            handlerUsed: handler
        }).lean()

        if(transaction){
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return transaction.ISOResponse ? transaction.ISOResponse : false
        } else {
            return false
        }
    }

    public async upsertTransaction(updateDetails: any, flagged=false, notified=false, settlementStatus=false, write2pos=false){
        try {

            let updated = false

            updateDetails.notified = notified
            updateDetails.flagged = flagged
            updateDetails.settlementStatus = settlementStatus
            updateDetails.write2pos = write2pos
    
            const transactionDetails = updateDetails
            
            await TransactionModel.findOneAndUpdate({
                clientReference: transactionDetails.clientReference
            }, transactionDetails, { upsert: true }, (err, doc) => {
                if(err){
                    logger.err('Transaction data failed to upsert: terminalID: HadError => ' + err)
                } else {
                    updated = true;
                    logger.info('Transaction data upserted successfully for - ' + transactionDetails.rrn)
                }
            });
                       
            return updated

        } catch(err) {
            logger.err('Exception caught while upserting transaction data: ' + err)
            return false;
        }
    }

    public async updateTransaction(updateDetails: any){
        try {

            //const modelHandler = new TransactionModel
            let updated = false

            await  TransactionModel.findOneAndUpdate({
                terminalId: updateDetails.terminalId,
                rrn: updateDetails.rrn
            }, updateDetails ).then(() => {
                updated = true
                logger.info('Transaction data updated successfully')
            }).catch(error => {
                logger.err('Transaction data failed to save: terminalID: HadError => ' + error)
            })
            
            return updated
        } catch(err) {
            logger.err('Exception caught while updating transaction data: ' + err)
            return false;
        }
    }

    public async saveTransaction(data: any, flagged=false, notified=false, settlementStatus="pending", write2pos=false){
        
        try{
            data.notified = notified
            data.flagged = flagged
            data.settlementStatus = settlementStatus
            data.write2pos = write2pos
    
            const transactionDetails = this.buildTransactionData(data)
            //logger.info('Built transaction data for saving ==== ' + JSON.stringify(transactionDetails))

            const modelHandler = new TransactionModel(transactionDetails)

            let saved = false
            await modelHandler.save().then(() => {
                saved = true
                logger.info('Transaction data saved successfully <=> terminalID: ' + transactionDetails.terminalId)
            }).catch(error => {
                logger.err('Transaction data failed to save: terminalID: ' + transactionDetails.terminalId + ': HadError => ' + error)
            })
            
            return saved
             
        } catch(err) {
            logger.err('Exception caught while saving transaction data: ' + err)
            return false;
        }
    }


    async updateTransactionSummary(transactionDetails: any){

        try {

            const summaryData = await SummaryModel.findOne({
                terminalId: transactionDetails.terminalId,
                bankName: transactionDetails.bankName,
                cardScheme: transactionDetails.cardScheme,
                tranType: transactionDetails.tranType,
                responseCode: transactionDetails.responseCode,
                terminalOwnerCode: transactionDetails.terminalOwnerCode,
                terminalGroupName: transactionDetails.terminalGroupName,
                region: transactionDetails.region,
                state: transactionDetails.state,
                substate: transactionDetails.substate,
                createdAt: {
                    $gte: startOfDay(new Date()),
                    $lte: endOfDay(new Date())
                }
            })

            if(summaryData){
                
                const updatedAmount = parseFloat(summaryData.amount) + parseFloat(transactionDetails.amount)

                let updated = false
                const updateData = {
                    amount: updatedAmount
                } 
                await  SummaryModel.updateOne({
                    terminalId: transactionDetails.terminalId,
                    bankName: transactionDetails.bankName,
                    cardScheme: transactionDetails.cardScheme,
                    tranType: transactionDetails.tranType,
                    responseCode: transactionDetails.responseCode,
                    terminalOwnerCode: transactionDetails.terminalOwnerCode,
                    terminalGroupName: transactionDetails.terminalGroupName,
                    region: transactionDetails.region,
                    state: transactionDetails.state,
                    substate: transactionDetails.substate,
                    createdAt: {
                        $gte: startOfDay(new Date()),
                        $lte: endOfDay(new Date())
                    }
                }, updateData).then(() => {
                    updated = true
                    logger.info('Summary Transaction data updated successfully')
                }).catch(error => {
                    logger.err('Summary Transaction data failed to update: terminalID: HadError => ' + error)
                })
                
                return updated

            } else {

                const summary = {
                    terminalId: transactionDetails.terminalId,
                    amount: transactionDetails.amount,
                    responseCode: transactionDetails.responseCode,
                    responseMessage: transactionDetails.responseMessage,
                    bankName: transactionDetails.bankName,
                    cardScheme: transactionDetails.cardScheme,
                    region: transactionDetails.region,
                    state: transactionDetails.state,
                    substate: transactionDetails.substate,
                    tranType: transactionDetails.tranType,
                    merchantType: transactionDetails.merchantType,
                    terminalOwnerCode: transactionDetails.terminalOwnerCode,
                    terminalGroupName: transactionDetails.terminalGroupName
                }

                const modelHandler = new SummaryModel(summary)

                let saved = false
                await modelHandler.save().then(() => {
                    saved = true
                    logger.info('Transaction summary data saved successfully <=> terminalID: ' + transactionDetails.terminalId)
                }).catch(error => {
                    logger.err('Transaction summary data failed to save: terminalID: ' + transactionDetails.terminalId + ': HadError => ' + error)
                })
                
                return saved
            }
           
        } catch(err) {
            logger.err('Exception caught while updating transaction data: ' + err)
            return false;
        }
        
    }

    public buildTransactionData(unpackedMessage: any, update=false){
        if (this.appEnv == "production"){
            logger.info('Unpacked Message' + JSON.stringify(unpackedMessage));
        } 
        const maskedPan = this.getMaskedPan(unpackedMessage);
        const respCode = unpackedMessage.dataElements[39] || "102"

        let clientReference = "";
        if(this.getRequestType(unpackedMessage.mti) == "REVERSAL"){
            clientReference = unpackedMessage.dataElements[37] + "|" + unpackedMessage.dataElements[41] + "|" + unpackedMessage.dataElements[11] + "-R"
        } else if(this.getRequestType(unpackedMessage.mti) == "REVERSAL-R"){
            clientReference = unpackedMessage.dataElements[37] + "|" + unpackedMessage.dataElements[41] + "|" + unpackedMessage.dataElements[11] + "-RR"
        } else {
            clientReference = unpackedMessage.dataElements[37] + "|" + unpackedMessage.dataElements[41] + "|" + unpackedMessage.dataElements[11]
        }

        const transactionData = {
            rrn: unpackedMessage.dataElements[37],
            responseCode: respCode,
            responseMessage: getNibssResponseMessageFromCode(respCode),
            onlinePin: unpackedMessage.dataElements[52] !== null ? true : false,
            amount: parseInt(unpackedMessage.dataElements[4] || 0),
            currencyCode: unpackedMessage.dataElements[49] ? unpackedMessage.dataElements[49] : '',
            merchantName: unpackedMessage.dataElements[43] !== null ? unpackedMessage.dataElements[43].substring(0, 22) : 'DEFAULT MERCHANT',
            originalMerchantName: unpackedMessage.dataElements[43] !== null ? unpackedMessage.dataElements[43].substring(0, 22) : 'DEFAULT MERCHANT',
            merchantAddress: unpackedMessage.dataElements[43] !== null ? unpackedMessage.dataElements[43].substring(23) : 'LA LANG',
            merchantId: unpackedMessage.dataElements[42] ? unpackedMessage.dataElements[42] : '',
            terminalId: unpackedMessage.dataElements[41],
            transactionTime: new Date,
            handlerResponseTime: (update == true) ? new Date : null,
            stan: unpackedMessage.dataElements[11] ? unpackedMessage.dataElements[11] : '',
            authCode: unpackedMessage.dataElements[38] ? unpackedMessage.dataElements[38] : '',
            merchantCategoryCode: unpackedMessage.dataElements[18] ? unpackedMessage.dataElements[18]: '',
            handlerUsed : 'INTERSWITCH',
            MTI: unpackedMessage.mti,
            maskedPan: maskedPan,
            cardExpiry: unpackedMessage.dataElements[14] ? unpackedMessage.dataElements[14] : '',
            cardName: unpackedMessage.dataElements[14] ? unpackedMessage.dataElements[14] : '',
            customerRef: this.getExtraParams('customerRef', unpackedMessage),
            pnr: this.getExtraParams('pnr', unpackedMessage),
            version: this.getExtraParams('version', unpackedMessage),
            location: this.getExtraParams('location', unpackedMessage),
            clientReference : clientReference,
            processingCode: unpackedMessage.dataElements[3] ? unpackedMessage.dataElements[3] : '',
            notified : (update == true) ? unpackedMessage.notified : false,
            settlementStatus: (update == true) ? unpackedMessage.settlementStatus : "false",
            flagged: (update == true) ? unpackedMessage.flagged : false,
            write2pos : (update == true) ? unpackedMessage.write2pos : false,
            script: unpackedMessage.dataElements[55] ? unpackedMessage.dataElements[55] : '',
            FIIC : unpackedMessage.dataElements[33] ? unpackedMessage.dataElements[33] : '' ,
            customDataElements: unpackedMessage.dataElements[90] ? unpackedMessage.dataElements[90] : '', // originalDataElements
            bankName: this.getBankNameFromBin(maskedPan),
            cardScheme: this.getCardSchemeFromBin(maskedPan),
            tranType: unpackedMessage.tranType == "VAS" ? unpackedMessage.tranType : this.getRequestType(unpackedMessage.mti, unpackedMessage.dataElements[3] ? unpackedMessage.dataElements[3]: ''),
            vasData: unpackedMessage.vasData ? this.parseJSONdata(unpackedMessage.vasData) : null,
            isRequestPadded: unpackedMessage.vasData ? true : false
        }

        logger.info("Transaction Message: " + transactionData.tranType + " ---- " + transactionData.responseMessage)
        
        logger.info(transactionData.terminalId + ": >> Transaction Details" + JSON.stringify(transactionData))
        
        return transactionData
        
    }

    private getExtraParams<T>(field: string, unpackedMessage: any): T|String {
        if(unpackedMessage.mti != '0420' && unpackedMessage.mti != '0421'){
            const params = unpackedMessage.dataElements[59] 
            const paramsArray = params.split('|')
            switch(field){
                case "customerRef":
                    return paramsArray[0];
                case "pnr":
                    return paramsArray[1];
                case "version":
                    return paramsArray[2];
                case "location":
                    return paramsArray[3];
                default: 
                    return paramsArray[0]
            }
        } else {
            return unpackedMessage.dataElements[59]
        }
    }

    private parseJSONdata(JSONString: string){
        try{    
            const jsonObject = JSON.parse(JSONString)
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return jsonObject;
        } catch(error){
            logger.err('Error parsing string to JSON object ' + JSONString + ' ' + error)
            return null
        }
        
    }

    private getRequestType(mti: string, processingCode: any = '000000'){
        const key = processingCode.substr(0, 2)
        if(mti == "0200" && key == "00"){
            return "PURCHASE"
        } else if(mti == "0420"){
            return "REVERSAL"
        } else if(mti == "0210" && key == "00" ){
            return "PURCHASE"
        } else if(mti == "0430"){
            return "REVERSAL"
        } else if(mti == "0421"){
            return "REVERSAL-R"
        } else if (mti == "0100") {
            return "ACCOUNT-ENQ"
        } else if (mti == "0110") {
            return "ACCOUNT-ENQ"
        } else if (mti == "0220") {
            return "PRAUTH-SLS-COMPL"
        } else if (mti == "0230") {
            return "PRAUTH-SLS-COMPL"
        } else if (mti == "0200" && key == "09") {
            return "PURCHASE-WC"
        } else if (mti == "0210" && key == "09") {
            return "PURCHASE-WC"
        } else {
            return "UNKNOWN"
        }
    }

    private getBankNameFromBin(cardPan: string){

        let data;
        if(this.appEnv == 'local'){
            data = fs.readFileSync(process.cwd() + '/src/configs/bank-bins.json');
        } else {
            data = fs.readFileSync(process.cwd() + '/dist/configs/bank-bins.json');
        }
        
        const bin = this.getBinFromCardpan(cardPan)
        const dataArray = JSON.parse(data.toString()) 
        let bankName = ''
        for(const value of dataArray){
            if(bin == value.bin){
                bankName = value.bank
                break;
            }
        }
        return bankName
    }

    private getCardSchemeFromBin(cardPan: string){

        const check = cardPan.substr(0,2);
    
        if(cardPan.startsWith("4")) return "VISA";
        else if(["51","52","53","54","55"].includes(check) || cardPan.startsWith("2")) return "MASTERCARD";
        else if(["50","65"].includes(check)) return "VERVE";
        else if(["34","37"].includes(check)) return "AMERICAN-EXPRESS";
        else if(cardPan.startsWith("3528") || cardPan.startsWith("3589")) return "JCB";
        else return "CARD";

    }

    private getBinFromCardpan(cardPan:string){
        const bin = cardPan.substring(0,6);
        return bin
    }

    private getMaskedPan(unpackedMessage: any){
        return unpackedMessage.dataElements[2].substr(0, 6) + ''.padEnd(unpackedMessage.dataElements[2].length - 10, 'X') + unpackedMessage.dataElements[2].slice(-4)
    }

}

export default handleCardTransactions