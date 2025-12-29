import * as mongoose from 'mongoose';

export interface I_Interswitch {
    pinKey: string;
    keyCheck: string;
    sequence: number;
    configId: number;
}

export interface I_InterswitchMongoose extends mongoose.Document {
    pinKey: string;
    keyCheck: string;
    sequence: number;
    configId: number;
}

