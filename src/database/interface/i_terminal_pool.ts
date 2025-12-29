import * as mongoose from 'mongoose';

export interface ITerminalPool extends mongoose.Document {
    tid: string; 
    lastUsedAt: Date;
}

