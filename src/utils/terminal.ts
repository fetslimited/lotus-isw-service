/* eslint-disable max-len */

import TerminalModel from '../database/model/TerminalModel'
import generateSecretKey from '../crypt/genKeys'
import logger from '../shared/Logger';
import ITerminal from '../database/interface/i_terminal';


export async function getTerminalKey(terminalSerial: any, terminalId: any){

    const data: ITerminal | null = await TerminalModel.findOne({
        $and: [{
            'terminalSerial': terminalSerial
        }, {
            'terminalId': terminalId
        }]
    });
    
    if(data){
        logger.info("Terminal Key for " + terminalId + "|" + terminalSerial + " fetched successfully")
        const terminalKey: string = data.terminalKey
        return terminalKey;

    } else {
        logger.info("Failed to get Terminal Key for " + terminalId + '')
        return null
    }
}

export async function createTerminalKey(terminalSerial: any, terminalId: any){

    const termDetails = {
        terminalSerial,
        terminalId,
        terminalKey: generateSecretKey()
    }

    try{
       
        logger.info('Data to be saved: ' + JSON.stringify(termDetails))
        const modelHandler = new TerminalModel(termDetails)
        let saved = false
        await modelHandler.save().then(() => {
            saved = true
            logger.info('Terminal KEY created successfully: ' + termDetails)
        }).catch(error => {
            logger.err('Terminal KEY creation FAILED ' + error)
        })
        
        return saved
         
    } catch(err) {
        logger.err('Exception caught while saving terminal Key data: ' + err)
        return false;
    }

}


