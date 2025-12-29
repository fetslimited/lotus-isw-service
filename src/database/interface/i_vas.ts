import * as mongoose from 'mongoose';

export interface IVas extends mongoose.Document {
    clientReference: any; 
    terminalId: any;
    status: any;
}

