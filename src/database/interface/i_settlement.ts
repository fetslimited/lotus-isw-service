import * as mongoose from 'mongoose';

export interface ISettlement extends mongoose.Document {
    clientReference: any; 
    terminalId: any;
}

