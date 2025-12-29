import mongoose from 'mongoose'
import interswitchConfigSchema from '../schema/interswitchConfigSchema';
import {I_InterswitchMongoose} from '../interface/i_interswitch';

const InterswitchConfigModel = mongoose.model<I_InterswitchMongoose>('interswitchconfig', interswitchConfigSchema);

export default InterswitchConfigModel