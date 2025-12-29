import * as mongoose from 'mongoose';

export interface ITransaction extends mongoose.Document {
    ISOResponse: any;
    terminalSerial: any;
    terminalGroupName: any;
    merchantType: any;
    terminalId: any;
    vasData: any;
    region: any;
    state: any;
    substate: any;
    terminalHost: any;
    switchTerminalId: any;
    originalMerchantName: string;
    pnr: string;
}

