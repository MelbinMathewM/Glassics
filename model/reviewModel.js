const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Review = new Schema({
    product_id : {
        type : mongoose.Schema.Types.ObjectId,
        ref : 'Product'
    },
    user_id : {
        type : mongoose.Schema.Types.ObjectId,
        ref : 'Customer'
    },
    rating : {
        type : Number,
        min : 1,
        max : 5
    },
    review_text : {
        type : String
    }
});

module.exports = mongoose.model('Review', Review);