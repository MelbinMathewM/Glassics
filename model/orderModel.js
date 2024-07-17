const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const OrderItemSchema = new Schema({
    product_id: {
        type: Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    productImage : {
        type : [String],
        required : true
    },
    productColor: {
        type: String,
        required: true
    },
    productPrice : {
        type : Number,
        required : true
    },
    productDiscPrice : {
        type : Number
    },
    offerDiscount : {
        type : Number
    },
    couponDiscount : {
        type : Number
    },
    productSize: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        required: true
    },
    deliveryDate: {
        type: Date,
    },
    orderStatus: {
        type: String,
        enum: ['Pending', 'Processing','Dispatched', 'Delivered', 'Canceled','Return requested', 'Returned'],
        default : 'Pending'
    },
    returnReason: {
        type: String
    }
});

const OrderSchema = new Schema({
    customer_id: {
        type: Schema.Types.ObjectId,
        ref: 'Customer',
        required: true
    },
    address_id: {
        type: Schema.Types.ObjectId,
        ref: 'Address',
        required: true
    },
    couponCode: {
        type : String
    },
    items: [OrderItemSchema],
    orderDate: {
        type: Date,
        default: Date.now
    },
    paymentMethod: {
        type: String,
        required: true
    },
    paymentStatus : {
        type : String,
        enum: ['Pending','Paid'],
        default : 'Pending'
    },
    orderID: {
        type: String,
        unique: true
    },
    razorpayOrderId : {
        type : String,
    }
});

module.exports = mongoose.model("Order", OrderSchema);