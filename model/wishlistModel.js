const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Wishlist = new Schema({
    userId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : 'Customer',
        required : true
    },
    productId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : 'Product',
        required : true
    },
    productImage: {
        type: [String],
        required: true
    },
    productName: {
        type: String,
        required: true
    },
    productPrice: {
        type: Number,
        required: true
    }
});

module.exports = mongoose.model("Wishlist",Wishlist);