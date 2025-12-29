import mongoose from 'mongoose'

const settlementSchema = new mongoose.Schema({
    _id: false,
    amount: Number,
    terminalId: String,
    walletId: String,
    rrn: String, 
    authCode: String,
    stan: String,
    maskedPan: String,
    responseMessage:  String,
    clientReference : String,
    status: String,
    tranType: String,
    merchantType: String,
    region: String,
    state: String,
    substate: String,
    terminalOwnerName: String,
    huaweiRef: String,
    settlementBank: String,
    processTime: Number,
    responseTime: Date,
},{timestamps:true});


export default settlementSchema;