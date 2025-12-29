import * as mongoose from 'mongoose';

export interface I_SwitchUptime {
    interswitch: string;
    upsl: string;
    nibss: string;
    refid: string;
}

export interface I_SwitchUptimeMongoose extends mongoose.Document {
    interswitch: string;
    upsl: string;
    nibss: string;
    refid: string;
}

