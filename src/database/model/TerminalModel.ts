import mongoose from 'mongoose'
import terminalSchema from '../schema/terminalSchema';
import ITerminal from '../interface/i_terminal';

const TerminalModel = mongoose.model<ITerminal>('terminalkeys', terminalSchema);

export default TerminalModel