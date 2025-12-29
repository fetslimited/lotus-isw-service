import mongoose from 'mongoose'
import switchUptimeSchema from '../schema/switchUptimeSchema';
import {I_SwitchUptimeMongoose} from '../interface/i_switchuptime';

const switchUptimeModel = mongoose.model<I_SwitchUptimeMongoose>('switchuptime', switchUptimeSchema);

export default switchUptimeModel