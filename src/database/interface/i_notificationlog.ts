import * as mongoose from 'mongoose';

export interface INotificationLog extends mongoose.Document {
    terminalOwnerCode: any; 
    status: any;
    endpointBaseUrl: any;
    authToken: any;
    alias: any;
}

