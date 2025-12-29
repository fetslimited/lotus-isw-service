import mongoose from 'mongoose'

const terminalPoolSchema = new mongoose.Schema({
    _id: false,
    tid: { type: String, required: true, unique: true },
    lastUsedAt: { type: Date, default: null }
},{timestamps:true});


export default terminalPoolSchema;