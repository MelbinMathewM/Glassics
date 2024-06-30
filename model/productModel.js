const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// SubVariant Schema for Sizes
const SubVariantSchema = new Schema({
    size: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        required: true
    }
}, { _id: false });

// Variant Schema for Colors
const VariantSchema = new Schema({
    color: {
        type: String,
        required: true
    },
    images: {
        type: [String],
        required : true
    },
    price: {
        type: Number,
        required: true
    },
    discountPrice: Number,
    subVariants: [SubVariantSchema],
    offer: { 
        type: Schema.Types.ObjectId, 
        ref: 'Offer' 
    }
}, { _id: false });

// Product Schema
const ProductSchema = new Schema({
    productName: {
        type: String,
        required: true
    },
    productCategory: {
        type: Schema.Types.ObjectId,
        ref: "Category",
        required: true
    },
    productBrand: {
        type: Schema.Types.ObjectId,
        ref: "Brand",
        required: true
    },
    productDescription: {
        type: String,
        required: true
    },
    productGender: {
        type: String,
        required: true
    },
    frameMaterial : {
        type : String,
        required : true
    }, 
    frameShape : {
        type : String,
        required : true
    },
    frameStyle : {
        type : String,
        required : true
    },
    lensType : {
        type : String,
        required : true
    },
    specialFeatures : {
        type : String,
        required : true
    },
    variants: [VariantSchema],
    orderCount: {
        type: Number,
        default: 0
    },
    is_delete: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

module.exports = mongoose.model("Product", ProductSchema);

