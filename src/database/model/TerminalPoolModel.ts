import mongoose from 'mongoose'
import terminalPoolSchema from '../schema/terminalPoolSchema';
import {ISettlement} from '../interface/i_settlement';
import { ITerminalPool } from '../interface/i_terminal_pool';

const TerminalPoolModel = mongoose.model<ITerminalPool>('interswitch_terminal_pool', terminalPoolSchema);

export default TerminalPoolModel