const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Offer = new Schema({
    offerName:{
        type:String,
        required:true,
        index:true
    },
    offerDescription:{
        type:String,
        required:false,
        index : true
    },
    discountPercentage:{
        type:Number,
        required:true,
        default: 10
    },
    offerType:{
        type:String,
        required:true,
        index : true
    },
    typeName:{
        type:String,
        required:true
    },
    categoryId:{
        type: Schema.Types.ObjectId,
        ref:'Category',
        required:false,
        index:true
    },
    productId:{
        type: Schema.Types.ObjectId,
        ref:'Product',
        required:false,
        index:true
    },
    isActive:{
        type:Boolean,
        require:true,
        default:false
    },
    addedDateTime:{
        type:Date,
        default:Date.now
    },
    expiryDate:{
        type:Date,
        required:true,
        index: { expires: 0 } 
    }
})

module.exports = mongoose.model('Offer',Offer);