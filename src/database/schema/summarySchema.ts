import mongoose from 'mongoose'

const summarySchema = new mongoose.Schema({
    terminalId: String,
    amount: Number,
    responseCode: String,
    responseMessage: String,
    bankName: String,
    cardScheme: String,
    region: String,
    tranType: String,
    terminalOwnerCode: String,
    terminalGroupName: String,
    merchantType: String
},{timestamps:true});


export default summarySchema;