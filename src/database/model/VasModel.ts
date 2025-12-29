import mongoose from 'mongoose'
import vasSchema from '../schema/vasSchema';
import {IVas} from '../interface/i_vas';

const VasModel = mongoose.model<IVas>('vas', vasSchema);

export default VasModel