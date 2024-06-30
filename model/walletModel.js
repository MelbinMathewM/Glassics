const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const transactionSchema = new Schema({
    date: { 
        type : Date, 
        default : Date.now 
    },
    description : String,
    amount: Number,
    balance: Number
});

const walletSchema = new Schema({
    user: { 
        type : Schema.Types.ObjectId, 
        ref : 'Customer', 
        required : true 
    },
    balance: { 
        type: Number, 
        default: 0 
    },
    transactions: [transactionSchema]
});

module.exports = mongoose.model('Wallet', walletSchema);