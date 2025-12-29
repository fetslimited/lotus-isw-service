import mongoose from 'mongoose'
import summarySchema from '../schema/summarySchema';
import {ISummary} from '../interface/i_summary';

const SummaryModel = mongoose.model<ISummary>('summary', summarySchema);

export default SummaryModel