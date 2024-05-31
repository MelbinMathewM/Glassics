const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Order = new Schema({
    orderProduct_id : {
        type : ObjectId,
        required : true
    },
    orderCustomer_id : {
        type : ObjectId,
        required : true
    },
    orderAddress_id : {
        type : ObjectId,
        required : true
    },
    orderQuantity : {
        type : Number,
        required : true
    },
    orderDate : {
        type : Date,
        required : true
    },
    deliveryDate : {
        type : Date,
        required : true
    },
    orderStatus : {
        type : String,
        required : true
    }
});

module.exports = mongoose.model("Order",Order);