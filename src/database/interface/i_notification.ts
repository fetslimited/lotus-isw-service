import * as mongoose from 'mongoose';

export interface INotification extends mongoose.Document {
    authType: string;
    contentType: any;
    notificationEndpoint: any;
    terminalOwnerCode: any; 
    status: any;
    endpointBaseUrl: any;
    authToken: any;
    alias: any;
}

