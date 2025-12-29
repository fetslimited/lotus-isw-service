import mongoose from 'mongoose'
import upslConfigSchema from '../schema/upslConfigSchema';
import {I_UpslMongoose} from '../interface/i_upsl';

const UpslConfigModel = mongoose.model<I_UpslMongoose>('upslconfig', upslConfigSchema);

export default UpslConfigModel