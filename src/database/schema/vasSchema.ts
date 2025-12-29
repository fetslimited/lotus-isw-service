import mongoose from 'mongoose'

const vasSchema = new mongoose.Schema({
    _id: false,
    amount: Number,
    terminalId: String,
    walletId: String,
    rrn: String, 
    authCode: String,
    stan: String,
    maskedPan: String,
    responseMessage:  String,
    clientReference: String,
    status: String,
    tranType: String,
    merchantType: String,
    merchant_id: String,
    product_id: String,
    productName: String,
    productService: String,
    naration: String,
    customerRefNum: String,
    lookupParam: String,
    customerPhone: String,
    tnxRef: String,
    region: String,
    state: String,
    substate: String,
    terminalOwnerName: String,
    settlementBank: String,
    providerRef: String,
    processTime: Number,
    responseString: String,
},{timestamps:true});


export default vasSchema;