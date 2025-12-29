/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable max-len */
import '../../pre-start'; // Must be the first import
import logger from '../../shared/Logger';
import axios from 'axios'
import VasModel from '../../database/model/VasModel'


class handleVas {

    static getUrl(serviceType: any){
        if(serviceType == "payBill"){
            const url = process.env.MIDDLEWARE_BASE_URL + "/direct_POS_Bills"
            return url
        } else if(serviceType == "payBill_energy") {
            const url = process.env.MIDDLEWARE_BASE_URL + "/direct_POS_Bills_Energy"
            return url
        } else {
            return false;
        }
    }

    // eslint-disable-next-line @typescript-eslint/require-await
    static async push(terminalData: any, updateDetails: any, vasData: any){
        
        if(updateDetails.responseCode == "00" && terminalData.merchantType == "agent"){

            logger.info("Processing Vas Request for: -->  " + terminalData.terminalId)
            
            const vasDataObj = {
                amount: vasData.amount,
                wallet: terminalData.walletId || vasData.msisdn,
                thirdPartyRef: updateDetails.clientReference,
                tranType: 'BILLS-PAYMENT-POS',
                serviceType: vasData.bills_url,
                merchantId: vasData.merchant_id,
                productId: vasData.product_id,
                narration: vasData.remarks,
                customerRefNum: vasData.customerRefNum,
                lookupParam: decodeURIComponent(vasData.lookupParam) || "",
                phoneNo: vasData.phoneNo || vasData.msisdn,
                terminalID: vasData.terminalID,
                productName: vasData.merchant_name || "DEFAULT",
                productService: vasData.product_name || ""
            }

            const apiToken = process.env.MIDDLEWARE_TOKEN;
            const url = this.getUrl(vasDataObj.serviceType)
                        
            if(url == false){
                const respdata = {
                    error: true,
                    message: 'Not a fets bill',
                    reversal: true
                }
                return respdata
            }

            const config = {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + apiToken
                },
                timeout: 40000
            }

            const apiData = {
                AmountInNaira: (updateDetails.amount/100),
                AccountNumberToCredit: terminalData.walletId || '0',
                ReferenceNumber: updateDetails.clientReference,
                TranType: vasDataObj.tranType,
                url: vasDataObj.serviceType,
                merchant_id: vasDataObj.merchantId,
                product_id: vasDataObj.productId,
                naration: vasDataObj.narration,
                customerRefNum: vasDataObj.customerRefNum,
                lookupParam: vasDataObj.lookupParam,
                customerPhone: vasDataObj.phoneNo,
                terminalID: updateDetails.terminalId
            }
    
            // Initialize bill payment transaction data
            const transactionData = updateDetails;
            transactionData.walletId = terminalData.walletId;
            transactionData.merchantType = terminalData.merchantType;
            transactionData.region = terminalData.region;
            transactionData.state = terminalData.state;
            transactionData.substate = terminalData.substate;
            transactionData.terminalOwnerName = terminalData.terminalOwnerName;

            const transactionDetails = this.defineTransactionSchema(transactionData, vasDataObj)

            this.upsertVasTransaction(transactionDetails)

            const requestTime: any = new Date() 

            logger.info('Sending request to ' + url + ' with data ==> ' + JSON.stringify(apiData))
            
           return axios.post(url, apiData, config)
                .then( (response) => {
                
                const responseTime: any = new Date()
                const processTime = Math.abs(responseTime - requestTime) / 1000;

                const data = response.data;

                logger.info("Response from " + url + " ::: -> " + JSON.stringify(data));

                if(data.success == true){
                    transactionDetails.tnxRef = data.tnxRefNo || null
                    transactionDetails.status = "successful"
                    transactionDetails.responseMessage = data.message || "Bill-Payment Successful"
                    transactionDetails.processTime = processTime.toFixed(2)
                    transactionDetails.providerRef = data.extResponseCode;
                    transactionDetails.responseString = JSON.stringify(data);
                    this.upsertVasTransaction(transactionDetails)

                    const respdata = {
                        error: false,
                        message: transactionDetails.responseMessage,
                        reversal: false
                    }
    
                    return { ...respdata, ...data }

                } else {
                    transactionDetails.tnxRef = data.tnxRefNo || null
                    transactionDetails.status = "failed"
                    transactionDetails.responseMessage = data.message || "Transaction Failed"
                    transactionDetails.processTime = processTime.toFixed(2)
                    transactionDetails.providerRef = data.extResponseCode
                    transactionDetails.responseString = JSON.stringify(data);

                    this.upsertVasTransaction(transactionDetails)

                    const respdata = {
                        error: true,
                        message: transactionDetails.responseMessage,
                        reversal: true
                    }
    
                    return { ...respdata, ...data }
                }
                

                }).catch( (error) => {
                

                if (error.response) {
                    
                        logger.err("Response from " + url + " ::: -> " + JSON.stringify(error.response.data));
                        logger.err("Response Code: " + error.response.status);

                        const data = error.response.data;

                        transactionDetails.tnxRef = data.tnxRefNo || null
                        transactionDetails.status = "failed"
                        transactionDetails.responseMessage = data.message || "Transaction Failed";
                        transactionDetails.responseString = JSON.stringify(data);

                        this.upsertVasTransaction(transactionDetails)

                        const respdata = {
                            error: true,
                            message: transactionDetails.responseMessage,
                            reversal: true
                        }

                        return { ...respdata, ...data }

                    } else if (error.request) {
                        logger.err("The request was made but no response was received " + JSON.stringify(error.request));

                        transactionDetails.tnxRef = null
                        transactionDetails.status = "failed"
                        transactionDetails.responseMessage = "Transaction Processed. Await confirmation"

                        this.upsertVasTransaction(transactionDetails)

                        const respdata = {
                            error: true,
                            message: transactionDetails.responseMessage,
                            reversal: false
                        }
                        return respdata

                    } else {
                        logger.err('Something happened in setting up the request that triggered an Error ' + error.message);

                        transactionDetails.tnxRef = null
                        transactionDetails.status = "failed"
                        transactionDetails.responseMessage = "Transaction Failed, Request Exception"
                        
                        this.upsertVasTransaction(transactionDetails)

                        const respdata = {
                            error: true,
                            message: transactionDetails.responseMessage,
                            reversal: true
                        }
                        return respdata
                   

                    }
                
                });
            
        
        } else {
            return ""
        }

    }

    static defineTransactionSchema(transactionData: any, vasDataObj: any){
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
            tranType: 'VAS',
            merchant_id: vasDataObj.merchantId,
            product_id: vasDataObj.productId,
            productName: vasDataObj.productName,
            productService: vasDataObj.productService,
            naration: vasDataObj.narration,
            customerRefNum: vasDataObj.customerRefNum,
            lookupParam: vasDataObj.lookupParam,
            customerPhone: vasDataObj.phoneNo,
            merchantType: transactionData.merchantType,
            region: transactionData.region,
            state: transactionData.state,
            substate: transactionData.substate,
            terminalOwnerName: transactionData.terminalOwnerName,
            tnxRef: transactionData.tnxRef || null,
            settlementBank: this.getSettlementBank(transactionData.terminalId),
            providerRef: transactionData.providerRef || null,
            processTime: transactionData.processTime || 0,
            responseString: transactionData.responseString || ''
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


    static async upsertVasTransaction(transactionDetails: any){
        try {

            let updated = false

            await VasModel.findOneAndUpdate({
                clientReference: transactionDetails.clientReference
            }, transactionDetails, { upsert: true }, (err, doc) => {
                if(err){
                    logger.err('VAS data failed to upsert: terminalID: HadError => ' + err)
                } else {
                    updated = true;
                    logger.info('VAS data upserted successfully for - ' + transactionDetails.clientReference)

                }
            });
     
            return updated

        } catch(err) {
            logger.err('Exception caught while upserting VAS transaction data: ' + err)
            return false;
        }
    }

    static async getVasTransaction(transactionDetails: any){
        try {
            const clientRef = transactionDetails.rrn +"|"+ transactionDetails.terminalId +"|" + transactionDetails.stan;
            const transaction = await VasModel.findOne({
                clientReference: clientRef
            })
            
            if(transaction){
                return transaction
            } else {
                return false
            }

        } catch(err) {
            logger.err('Exception caught while fetching VAS transaction data: ' + err)
            return false;
        }
    }

}

export default handleVas