/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable max-len */
import '../../pre-start'; // Must be the first import
import logger from '../../shared/Logger';
import axios from 'axios'
import SettlementModel from '../../database/model/SettlementModel';
import TransactionModel from '../../database/model/TransactionModel'
import handleCardTransactions from '../../controller/Transaction/handleCardTransactions';

class handleSettlement {


    static reformPhoneNumber(phoneNumber: string){
        if (phoneNumber.length == 11) {
            return phoneNumber.substring(1);
        } else if(phoneNumber.length > 11){
            return phoneNumber.substring(3)
        }
        else {
            return phoneNumber;
        }
    }
    // eslint-disable-next-line @typescript-eslint/require-await
    static async notifyHuaweiForSettlement(terminalData: any, updateDetails: any){
        logger.info("Settlement request recieved for merchant type: " + terminalData.merchantType)
        
        // Check if user is an agent or merchant
        const merchantType = terminalData.merchantType.toLowerCase();
        const transactionHandle = new handleCardTransactions();
        const reversalTransaction = await transactionHandle.getTransactionReversal(updateDetails.terminalId, updateDetails.rrn);

        if (updateDetails.responseCode == "00" && (merchantType == "agent" || merchantType == "fets-merchant") && reversalTransaction === false){

            const url = process.env.FETS_PROZA_BASE_URL + "/mm-request-api/v1/transaction/internal/money"
            const config = {
                headers: {
                    'Content-Type': 'application/json',
                    'proza': process.env.FETS_PROZA_TOKEN
                },
                timeout: 50000
            }

            const apiData = {
                amount: (updateDetails.amount/100),
                creditAccount: this.reformPhoneNumber(terminalData.walletId),
                externalReference: updateDetails.clientReference,
                narration: 'INTERSWITCH CASHOUT Request for RRN ' + updateDetails.rrn,
                channel: process.env.FETS_PROZA_TMS_CHANNEL,
                productId: process.env.PRODUCT_ID
            }
    
            // Initialize settlement transaction data
            const transactionData = updateDetails;
            transactionData.walletId = terminalData.walletId;
            transactionData.merchantType = terminalData.merchantType;
            transactionData.region = terminalData.region;
            transactionData.state = terminalData.state;
            transactionData.substate = terminalData.substate;
            transactionData.terminalOwnerName = terminalData.terminalOwnerName;
            transactionData.responseMessage = 'Awaiting Response';


            const transactionDetails = this.defineTransactionSchema(transactionData)
            this.upsertSettlementTransaction(transactionDetails)

            const requestTime: any = new Date() 

            logger.info('Sending request to ' + url + ' with data ==> ' + JSON.stringify(apiData))
    
            axios.post(url, apiData, config)
                .then( (response) => {
                
                const responseTime: any = new Date()
                const processTime = Math.abs(responseTime - requestTime) / 1000;

                const data = response.data;

                logger.info("Response from " + url + " ::: -> " + JSON.stringify(data));

                transactionDetails.huaweiRef = data.data.data.txnReference || "no-ref";
                transactionDetails.status = "successful";
                transactionDetails.responseMessage = data.ResponseMessage || "Settlement Successful";
                transactionDetails.tranType = "CASHOUT";
                transactionDetails.processTime = processTime.toFixed(2);
                transactionDetails.responseTime = responseTime;

                this.upsertSettlementTransaction(transactionDetails)

                this.updateTransactionSettlementStatus(transactionDetails.clientReference, transactionDetails.huaweiRef)

                }).catch( (error) => {
                

                if (error.response) {
                    
                        logger.err("Response from " + url + " ::: -> " + JSON.stringify(error.response.data));
                        logger.err("Response Code: " + error.response.status);

                        const responseTime: any = new Date()

                        const data = error.response.data;

                        transactionDetails.huaweiRef = data.ReferenceId || null
                        transactionDetails.status = "failed"
                        transactionDetails.responseMessage = data.ResponseMessage || "Settlement Failed"
                        transactionDetails.responseTime = responseTime;

                        this.upsertSettlementTransaction(transactionDetails)

                    } else if (error.request) {
                        logger.err("The request was made but no response was received " + JSON.stringify(error.request));

                        const responseTime: any = new Date()

                        transactionDetails.huaweiRef = null
                        transactionDetails.status = "failed"
                        transactionDetails.responseMessage = "Settlement Failed, No Response Recieved"
                        transactionDetails.responseTime = responseTime;

                        this.upsertSettlementTransaction(transactionDetails)

                    } else {
                        logger.err('Something happened in setting up the request that triggered an Error ' + error.message);

                        const responseTime: any = new Date()

                        transactionDetails.huaweiRef = null
                        transactionDetails.status = "failed"
                        transactionDetails.responseMessage = "Settlement Failed, Request Exception"
                        transactionDetails.responseTime = responseTime;

                        this.upsertSettlementTransaction(transactionDetails)

                    }
                
                });
            
        
        } else {
            const reversalStatus = (reversalTransaction) ? true : false;
            logger.info(`NO Settlement occurred for ${updateDetails.rrn} -- ${updateDetails.terminalId}; Reversal status: ${reversalStatus}`)
        }

    }

    static defineTransactionSchema(transactionData: any){
        const date = new Date();
        const data = {
            amount: transactionData.amount,
            terminalId: transactionData.terminalId,
            rrn: transactionData.rrn,
            authCode: transactionData.authCode,
            stan: transactionData.stan,
            walletId: transactionData.walletId,
            maskedPan: transactionData.maskedPan,
            responseMessage:  transactionData.responseMessage || 'Awaiting Response',
            clientReference : transactionData.clientReference,
            status: transactionData.status || 'pending',
            tranType: transactionData.tranType,
            merchantType: transactionData.merchantType,
            region: transactionData.region,
            state: transactionData.state,
            substate: transactionData.substate,
            terminalOwnerName: transactionData.terminalOwnerName,
            settlementBank: this.getSettlementBank(transactionData.terminalId),
            huaweiRef: transactionData.huaweiRef || null,
            processTime: transactionData.processTime || 0,
            responseTime: transactionData.responseTime || date
        }
        return data;
    }

    static getSettlementBank(terminalId: string){
        const prefix = terminalId.slice(0, 4);
        let bankName = "NIL"

        if(prefix == "2076"){
            bankName = "Polaris"
        } else if(prefix == "2057"){
            bankName = "Zenith"
        } else if(prefix == "2033"){
            bankName = "UBA"
        } else if(prefix == "2214"){
            bankName = "FCMB"
        }

        return bankName
    }

    static async updateTransactionSettlementStatus(clientReference: any, externalRef: any){
       
        const updateData = {
            settlementStatus: "true",
            externalRef: externalRef,
            settlementDate: new Date()
        } 
        await TransactionModel.updateOne({
            clientReference
        }, updateData).then(() => {
            logger.info('Transaction Settlement Status updated successfully')
        }).catch(error => {
            logger.err('Transaction Settlement Status failed to update: terminalID: HadError => ' + error)
        })
        
              
    }

    static async upsertSettlementTransaction(transactionDetails: any){
        try {

            let updated = false

            await SettlementModel.findOneAndUpdate({
                clientReference: transactionDetails.clientReference
            }, transactionDetails, { upsert: true }, (err, doc) => {
                if(err){
                    logger.err('Settlement data failed to upsert: terminalID: HadError => ' + err)
                } else {
                    updated = true;
                    logger.info('Settlement data upserted successfully for - ' + transactionDetails.clientReference)

                }
            });
     
            return updated

        } catch(err) {
            logger.err('Exception caught while upserting settlement transaction data: ' + err)
            return false;
        }
    }

}

export default handleSettlement