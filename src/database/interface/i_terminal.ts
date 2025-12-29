import * as mongoose from 'mongoose';

export default interface ITerminal extends mongoose.Document {
    prepTerminalStatus: boolean;
    terminalActivated: boolean;
    terminalSerial: any; 
    terminalId: any;
    terminalGroupName: any;
    terminalKey: any;
    terminalRepairStatus: boolean,
    terminalHost: string;
    merchantType: string;
}

