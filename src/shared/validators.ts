/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import '../pre-start';
import mtiRequestTypes from '../utils/fileUtil';
import logger from '../shared/Logger';
import Terminal from '../database/model/Terminals';
import ITerminal from '../database/interface/i_terminal'

export function isISORequest(ISOMessage: string){
    const requestMTI = ISOMessage.substr(0,4)
    logger.info('Request MTI Type:=> ' + requestMTI)
    const MRT = mtiRequestTypes()
    if(MRT[requestMTI] == undefined ||  MRT[requestMTI] == null){
        return false
    } else { 
        return true
    }
}

export function determineRequestType(ISOMessage: string, unPackedMessage: any){
    const requestMTI = ISOMessage.substr(0,4)
    const MRT = mtiRequestTypes()
    const key = unPackedMessage.dataElements[3].substr(0, 2)
    const requestTypeName = MRT[requestMTI][key] ? MRT[requestMTI][key].name : null;
    if(requestTypeName == null){
        logger.warn('Handling unknown request type!!!')
        return requestTypeName
    } else {
        logger.info('Handling ' + requestTypeName + ' Request >>')
        return requestTypeName
    }

}

export function validateAmount(amount: any) {

    const parsedAmount = parseInt(amount);
    const thresholdAmount = parseInt(process.env.THRESHOLD_AMOUNT);
    if (parsedAmount <= thresholdAmount){
        return true;
    } else {
        return false;
    }

}

export function validateNonZeroAmount(amount: any) {

    const parsedAmount = parseInt(amount);
    if (parsedAmount > 0){
        return true;
    } else {
        return false;
    }

}

export async function checkDisabledTerminal(terminalId: string){

    try {
        const terminalData = await Terminal.findOne({
            terminalId
        })

        if(terminalData.terminalActivated === true && terminalData.terminalRepairStatus === false && terminalData.prepTerminalStatus === false){
            return terminalData;
        } else {
            return false
        }
    } catch(err){
        logger.err('Error while checking disabled terminal ' + err)
        return false
    }

}

export function decideSwitch(terminalData: ITerminal, transactionDetails: any){
    // Do any type of validation to determine which switch to use for transaction
    const terminalHost = terminalData.terminalHost;
    const switchAmount = parseInt(process.env.SWITCH_AMOUNT);

    if(terminalData.merchantType == 'agent'){

        const defaultSwitch: string = process.env.DEFAULT_SWITCH;
        const switchOverride: string = process.env.OVERRIDE_SWITCH_STATUS;
  
        const cardScheme = transactionDetails.cardScheme;
        let processor;
        if(cardScheme == "VERVE"){
            processor = "INTERSWITCH"
        } else {
            processor = defaultSwitch
        }

        if(switchOverride == "YES"){
            return defaultSwitch.toUpperCase();
        } else {
            if(terminalHost == "POSVAS" || terminalHost == "EPMS"){

                if(transactionDetails.amount <= switchAmount){
                    return "NIBSS";
                } else {
                    return processor;
                }

            } else if (terminalHost == 'INTERSWITCH') {
                return "INTERSWITCH"
            } else if (terminalHost == 'UPSL') {
                return "UPSL"
            }

        }
        
    } else {
        // Always use NIBSS for merchants
        return "NIBSS"
    }    
    
}

export function getIsoMessageLength(data: any, hexData: any){
    hexData += Buffer.from(data).toString('hex');
    if (hexData.length < 4)
        return;
    const dLen = Number.parseInt(hexData.substr(0, 4), 16);
    return dLen
}