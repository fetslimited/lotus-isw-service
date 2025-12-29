/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable max-len */
import '../../pre-start'; // Must be the first import
import NotificationModel from '../../database/model/NotificationModel';
import NotificationLogModel from '../../database/model/NotificationLogModel';
import logger from '../../shared/Logger';
import Moment from 'moment';
import fs = require('fs');
import axios from 'axios'
import TransactionModel from '../../database/model/TransactionModel'
import notificationsConfig from '../../configs/notifications'
class handleNotification {

     // eslint-disable-next-line @typescript-eslint/require-await
     static async notifyReversal(terminalData: any, updateDetails: any){
        logger.info("Checking if terminal requires notification ... ")
        const terminalOwnerCode = terminalData.terminalOwnerCode || null
        
        const notificationDB = await NotificationModel.findOne({
            terminalOwnerCode: terminalOwnerCode,
            status: "active"
        })

        if(notificationDB){

            try {
                const requestData = this.defineTransactionRequest(updateDetails)
                
                await this.upsertNotificationLog(updateDetails, notificationDB, requestData, "pending")
        
                // Send Notification 
                const apiToken = notificationDB.authToken;
                const url = notificationDB.endpointBaseUrl + notificationDB.notificationEndpoint
                logger.info('Sending request to ' + url + ' with data ==> ' + JSON.stringify(requestData))

                const config = {
                    headers: {
                        'Content-Type': notificationDB.contentType,
                        'Authorization': notificationDB.authType + ' ' + apiToken
                    },
                    timeout: 30000
                }

                axios.post(url, requestData, config)
                .then( async (response) => {
                
                    const data = response.data;
    
                    logger.info("Notification:: Response from " + url + " ::: -> " + JSON.stringify(data));
                    
                    await this.upsertNotificationLog(updateDetails, notificationDB, requestData, "success", data)
    
                    await this.updateTransactionNotificationStatus(updateDetails.clientReference)

                }).catch( async (error) => {
                

                if (error.response) {
                    
                        logger.err("Notification:: Response from " + url + " ::: -> " + JSON.stringify(error.response.data));
                        logger.err("Notification:: Response Code: " + error.response.status);

                        const data = error.response.data;

                        await this.upsertNotificationLog(updateDetails, notificationDB, requestData, "failed", data)


                    } else if (error.request) {
                        logger.err("Notification:: The request was made but no response was received " + JSON.stringify(error.request));

                        await this.upsertNotificationLog(updateDetails, notificationDB, requestData, "failed")

                    } else {
                        logger.err('Notification:: Something happened in setting up the request that triggered an Error ' + error.message);

                        await this.upsertNotificationLog(updateDetails, notificationDB, requestData, "failed")

                    }
                
                });
                
    
            } catch(err) {
                logger.err('Exception caught while pushing notification data: ' + err.stack)
                return false;
            }

        } else {
            logger.info("Notification is NOT enabled for " + terminalData.terminalId)
        }

    }

    // eslint-disable-next-line @typescript-eslint/require-await
    static async notify(terminalData: any, updateDetails: any){
        logger.info("Checking if terminal requires notification ... ")
        const terminalOwnerCode = terminalData.terminalOwnerCode || null
        
        const notificationDB = await NotificationModel.findOne({
            terminalOwnerCode: terminalOwnerCode,
            status: "active"
        })

        if(notificationDB){

            try {
                const requestData = this.defineTransactionRequest(updateDetails)
                
                await this.upsertNotificationLog(updateDetails, notificationDB, requestData, "pending")
        
                // Send Notification 
                const notificationConfig = this.readNotificationConfig(notificationDB.alias)
                const apiToken = notificationDB.authToken;
                const url = notificationDB.endpointBaseUrl + notificationConfig.notificationEndpoint
                logger.info('Sending request to ' + url + ' with data ==> ' + JSON.stringify(requestData))

                const config = {
                    headers: {
                        'Content-Type': notificationConfig.contentType,
                        'Authorization': notificationConfig.authType + ' ' + apiToken
                    },
                    timeout: 30000
                }

                axios.post(url, requestData, config)
                .then( async (response) => {
                
                    const data = response.data;
    
                    logger.info("Notification:: Response from " + url + " ::: -> " + JSON.stringify(data));
                    
                    await this.upsertNotificationLog(updateDetails, notificationDB, requestData, "success", data)
    
                    await this.updateTransactionNotificationStatus(updateDetails.clientReference)

                }).catch( async (error) => {
                

                if (error.response) {
                    
                        logger.err("Notification:: Response from " + url + " ::: -> " + JSON.stringify(error.response.data));
                        logger.err("Notification:: Response Code: " + error.response.status);

                        const data = error.response.data;

                        await this.upsertNotificationLog(updateDetails, notificationDB, requestData, "failed", data)


                    } else if (error.request) {
                        logger.err("Notification:: The request was made but no response was received " + JSON.stringify(error.request));

                        await this.upsertNotificationLog(updateDetails, notificationDB, requestData, "failed")

                    } else {
                        logger.err('Notification:: Something happened in setting up the request that triggered an Error ' + error.message);

                        await this.upsertNotificationLog(updateDetails, notificationDB, requestData, "failed")

                    }
                
                });
                
    
            } catch(err) {
                logger.err('Exception caught while pushing notification data: ' + err.stack)
                return false;
            }

        } else {
            logger.info("Notification is NOT enabled for " + terminalData.terminalId)
        }

    }

    static async updateTransactionNotificationStatus(clientReference: any){
       
        const updateData = {
            notified: true
        } 
        await TransactionModel.updateOne({
            clientReference
        }, updateData).then(() => {
            logger.info('Transaction Notification Status updated successfully')
        }).catch(error => {
            logger.err('Transaction Notification Status failed to update: terminalID: HadError => ' + error)
        })
        
              
    }

    static async upsertNotificationLog(updateDetails: any, notificationDB: any, requestData: any, processStatus: string, responseData: any = ""){
        
        let updated = false;

        const db_data = {
            rrn: updateDetails.rrn,
            terminalId: updateDetails.terminalId,
            request: JSON.stringify(requestData),
            amount: updateDetails.amount,
            response: responseData == "" ? "" : JSON.stringify(responseData),
            status: processStatus,
            alias: notificationDB.alias,
        }

        await NotificationLogModel.findOneAndUpdate({
            terminalId: updateDetails.terminalId,
            rrn: updateDetails.rrn
        }, db_data, { upsert: true }, (err, doc) => {
            if(err){
                logger.err('Notification log failed to upsert: terminalID: HadError => ' + err)
            } else {
                updated = true;
                logger.info('Notification log upserted successfully for - ' + db_data.rrn)

            }
        });

        return updated;
    }


    static readNotificationConfig(alias: string){

        const configData = notificationsConfig(alias)
        logger.info('Notification config: ' + JSON.stringify(configData))

        return configData;
        
    }

    static defineTransactionRequest(transactionData: any){
        const data = { 
            "source":"PTSP",
            "customername": "Customer",
            "customerphone": "000000000",
            "id": "131542",
            "rrn":transactionData.rrn,
            "terminalid": transactionData.terminalId,
            "fee": transactionData.fee || "0",
            "pan": transactionData.maskedPan,
            "amount": Number(transactionData.amount/100).toFixed(2),
            "currencycode": "NGN",
            "cardholder" : transactionData.cardName,
            "expiry": transactionData.cardExpiry,
            "authcode": transactionData.authCode,
            "cardtype": transactionData.cardScheme,
            "refcode": transactionData.customerRef || transactionData.rrn || "",
            "type": transactionData.tranType,
            "requestdate": Moment().format("YYYY-MM-DD HH:mm:ss"),
            "responsedate": Moment().format("YYYY-MM-DD HH:mm:ss"),
            "responsecode": transactionData.responseCode,
            "responsemessage": transactionData.responseMessage,
            "status": transactionData.responseCode  == "00" ? "success" : "failed"
        }
        return data;
    }

}

export default handleNotification