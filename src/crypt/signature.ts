/* eslint-disable no-console */
/* eslint-disable max-len */
import { getTerminalKey } from '../utils/terminal'
import * as crypto from 'crypto'

export async function buildRequestSignature(requestBody: any, terminalSerial: any, terminalId: any){
    delete requestBody.signature
    const reqBodyString = JSON.stringify(requestBody);
    const terminalKey = await getTerminalKey(terminalSerial, terminalId)
    // console.log('Terminal key: ', terminalKey)
    const signature = signKey(terminalKey, reqBodyString)
    return signature;
}

export function compareRequestSignature(requestSignature: string, serverSignature: string){
    if(requestSignature === serverSignature){
        return true;
    } else {
        return false;
    }
}

function signKey(clientKey: any, message: any) {
    const hash = crypto.createHmac('sha256', clientKey).update(message).digest('base64');
    return hash;
}