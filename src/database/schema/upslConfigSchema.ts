import mongoose from 'mongoose'

const upslConfigSchema = new mongoose.Schema({
    pinKey : {
        type : String,
        required: true
    },
    keyCheck : String,
    sequence : {
        type : Number,
        default : 0
    },
    configId: {
        type: Number,
        unique: true,
        required: true
    }

},{timestamps:true});


export default upslConfigSchema;