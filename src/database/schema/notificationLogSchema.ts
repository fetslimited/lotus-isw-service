import mongoose from 'mongoose'

const notificationLogSchema = new mongoose.Schema({
    rrn: String,
    terminalId: String,
    amount: Number,
    request: String,
    response: String,
    status: String,
    alias: String,
},{timestamps:true});


export default notificationLogSchema;