import mongoose from 'mongoose'

const transactionSchema = new mongoose.Schema({
    _id: false,
    rrn: String,
    responseCode: String,
    onlinePin: Boolean,
    amount: Number,
    currencyCode: String,
    originalMerchantName: {
        type: String,
        trim: true
    },
    merchantName: {
        type: String,
        trim: true
    },
    merchantAddress: {
        type: String,
        trim: true
    },
    merchantId: String,
    terminalId: String,
    switchTerminalId: String,
    stan: String,
    authCode: String,
    cardExpiry: String,
    cardName: String,
    customerRef: String,
    processingCode: String,
    merchantCategoryCode: String,
    handlerUsed : String,
    MTI: String,
    maskedPan: String,
    script: String,
    responseMessage:  String,
    clientReference : {
        type: String,
        trim: true,
        unique: true
    },
    notified : Boolean,
    settlementStatus: String,
    flagged: Boolean,
    write2pos : Boolean,
    FIIC : String,
    bankName: String,
    cardScheme: String,
    tranType: String,
    transactionTime: String,
    handlerResponseTime: String,
    region: String,
    state: String,
    substate: String,
    terminalManager: String,
    terminalHost: String,
    terminalOwnerName: String,
    terminalOwnerCode: String,
    terminalGroupName: String,
    merchantType: String,
    externalRef: String,
    settlementDate: String,
    ISOResponse: Buffer,
    pnr: String,
    version: String,
    location: String,
    vasData : {type: Object, default : null},
    customData: { type: Object, default: null }

},{timestamps:true});


export default transactionSchema;