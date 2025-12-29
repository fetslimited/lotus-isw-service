import * as mongoose from 'mongoose';

export interface I_Upsl {
    pinKey: string;
    keyCheck: string;
    sequence: number;
    configId: number;
}

export interface I_UpslMongoose extends mongoose.Document {
    pinKey: string;
    keyCheck: string;
    sequence: number;
    configId: number;
}

