const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Brand = new Schema({
    brandName : {
        type : String,
        required : true
    },
    is_delete : {
        type : Boolean,
        default : false
    }
});

module.exports = mongoose.model("Brand",Brand);