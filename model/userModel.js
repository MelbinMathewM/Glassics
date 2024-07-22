const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const User = new Schema({
    googleId : {
        type : String,
        required : false
    },
    customerName : {
        type : String,
        required : true
    },
    userName : {
        type : String,
        required : true
    },
    userEmail : {
        type : String,
        required : true
    },
    userMobile : {
        type : String,
        required : false
    },
    password : {
        type : String,
        required : false
    },
    resetToken : {
        type : String
    },
    resetTokenExpiration : {
        type : Date
    },
    is_blocked : {
        type : Number,
        default : 0
    }
});


module.exports = mongoose.model("Customer",User);