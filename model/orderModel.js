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
        required: true
    },
    orderStatus: {
        type: String,
        enum: ['Pending', 'Processing','Dispatched', 'Delivered', 'Canceled'],
        default : 'Pending'
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
    items: [OrderItemSchema],
    orderDate: {
        type: Date,
        default: Date.now
    },
    paymentMethod: {
        type: String,
        required: true
    },
    orderID: {
        type: String,
        unique: true,
        required: true
    }
});

module.exports = mongoose.model("Order", OrderSchema);
