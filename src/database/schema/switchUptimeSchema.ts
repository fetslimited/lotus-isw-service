import mongoose from 'mongoose'

const switchUptimeSchema = new mongoose.Schema({
    interswitch : String,
    upsl : String,
    nibbs: String,
    refid: String
},{timestamps:true});


export default switchUptimeSchema;