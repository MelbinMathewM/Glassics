const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Coupon = new Schema({
    code : {
        type : String,
        required : true,
        unique : true
    },
    discount : {
        type : Number,
        required : true
    },
    minPurchase : {
        type : Number,
        required : true
    },
    expirationDate : {
        type : Date,
        required : true
    },
    usageLimit : {
        type : Number,
        required : true
    },
    usedCount : {
        type : Number,
        default : 0
    }
});

module.exports = mongoose.model('Coupon', Coupon);