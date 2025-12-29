import mongoose from 'mongoose'

const terminalSchema = new mongoose.Schema({
    _id: false,
    terminalSerial: {
        type: String,
        required: true,
        unique: true
    },
    terminalId: {
        type: String
    },
    terminalType: {
        type: String,
        required: true
    },
    acquirerCode: {
        type: String,
        trim: true
    },
    acquirerLogo: {
        type: String,
        trim: true
    },
    acquirerName: {
        type: String,
        trim: true
    },
    merchantEmail: {
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
    merchantPhoneNumber: {
        type: String,
        trim: true
    },
    merchantType: {
        type: String,
        trim: true,
        enum: ['agent', 'merchant']
    },
    terminalOwnerCode: {
        type: String,
        trim: true
    },
    terminalHost: {
        type: String,
        trim: true,
        enum: ['EPMS', 'POSVAS', 'INTERSWITCH']
    },
    terminalOwnerName: {
        type: String,
        trim: true
    },
    terminalStatus: {
        type: String,
        trim: true,
        enum: ['active', 'inactive'],
    },
    walletId: {
        type: String,
        trim: true
    },
    terminalManagerId: {
        type: String,
        trim: true
    },
    terminalRepairStatus: {
        type: Boolean,
        trim: true,
        default: false
    },
    terminalActivated: {
        type: Boolean,
        trim: true,
        default: false
    },
    terminalGroupName: String,
    region: String,
    state: String,
    substate: String,
    prepTerminalStatus: {
        type: Boolean
    },
},{timestamps:true});


export default terminalSchema;