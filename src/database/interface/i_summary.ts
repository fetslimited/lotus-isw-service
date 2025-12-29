import * as mongoose from 'mongoose';

export interface ISummary extends mongoose.Document {
    terminalId: any; 
    amount: any;
    responseCode: any;
}

