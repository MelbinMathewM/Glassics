const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Address = new Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true
    },
    addressName : {
        type : String,
        required : true
    },
    addressEmail : {
        type : String,
        required : true
    },
    addressMobile : {
        type : String,
        required : true
    },
    addressHouse : {
        type : String,
        required : true
    },
    addressStreet : {
        type : String,
        required : true
    },
    addressPost : {
        type : String,
        required : true
    },
    addressMark : {
        type : String
    },
    addressCity : {
        type : String,
        required : true
    },
    addressDistrict : {
        type : String,
        required : true
    },
    addressState : {
        type : String,
        required : true
    },
    addressPin : {
        type : Number,
        required : true
    }
});

module.exports = mongoose.model("Address",Address);