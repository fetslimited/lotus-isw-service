import mongoose from 'mongoose'
import terminalSchema from '../schema/terminalSchema';
import ITerminal from '../interface/i_terminal';

const Terminal = mongoose.model<ITerminal>('terminals', terminalSchema);

export default Terminal