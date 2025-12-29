import mongoose from 'mongoose'
import settlementSchema from '../schema/settlementSchema';
import {ISettlement} from '../interface/i_settlement';

const SettlementModel = mongoose.model<ISettlement>('settlements', settlementSchema);

export default SettlementModel