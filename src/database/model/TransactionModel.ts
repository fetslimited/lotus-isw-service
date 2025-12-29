import mongoose from 'mongoose'
import transactionSchema from '../schema/transactionSchema';
import {ITransaction} from '../interface/i_transaction';

const TransactionModel = mongoose.model<ITransaction>('transactions', transactionSchema);

export default TransactionModel