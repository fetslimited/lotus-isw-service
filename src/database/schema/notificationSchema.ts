import mongoose from 'mongoose'

const notificationSchema = new mongoose.Schema({
    terminalOwnerCode: String,
    terminalOwnerName: String,
    status: String,
    endpointBaseUrl: String,
    authToken: String,
    alias: String,
    notificationEndpoint: String,
    contentType: String,
    retrial: String,
    authType: String,
    reversalEndpoint: String
},{timestamps:true});


export default notificationSchema;