const Address = require('../model/addressModel');
const Product = require('../model/productModel');
const User = require('../model/userModel');

const loadProfile = async (req,res) => {
    try{
        const userName = req.params.userName;
        const products = await Product.find();
        const user = await User.findOne({ userName : userName})
        res.render(`profile`,{products : products, user : user});
    }catch(error){
        res.send(error)
    }
};

const loadAddress = async (req,res) => {
    try{
        const userName = req.params.userName
        const user = await User.findOne({userName : userName})
        const addresses = await Address.find({user_id : user._id});
        res.render('address',{user : user, addresses : addresses});
    }catch(error){
        res.send(error);
    }
};

const loadAddAddress = async (req,res) => {
    try{
        res.render('add_address');
    }catch(error){
        res.send(error);
    }
};

const insertAddress = async (req,res) => {
    try{
        const userName = req.params.userName
        const { addressName, addressEmail, addressMobile, addressHouse, addressStreet, addressPost, addressMark, addressCity, addressDistrict, addressState, addressPin } = req.body;
        const userId = req.session.user_id;
        const address = new Address({
            user_id : userId,
            addressName,
            addressEmail,
            addressMobile,
            addressHouse,
            addressStreet,
            addressPost,
            addressMark,
            addressCity,
            addressDistrict,
            addressState,
            addressPin
        });
        const addressData = await address.save();
        if(addressData){
            return res.redirect(`/account/${userName}/address`);
        }else{
            return res.render('address',{ message : "Couldn't insert Address!"})
        }
    }catch(error){
        res.send(error);
    }
};

const loadEditAddress = async (req,res) => {
    try{
        const id = req.query.id;
        const addressData = await Address.findById({_id : id});
        if(addressData){
            res.render('edit_address',{address : addressData})
        }else{
            res.render('address');
        }
    }catch(error){
        res.send(error);
    }
};

const updateAddress = async (req,res) => {
    try{
        const id = req.query.id;
        const userName = req.params.userName;
        const addressData = await Address.findByIdAndUpdate({ _id : id },{
            $set : {
                addressName : req.body.addressName,
                addressEmail : req.body.addressEmail,
                addressMobile : req.body.addressMobile,
                addressHouse : req.body.addressHouse,
                addressStreet : req.body.addressStreet,
                addressPost : req.body.addressPost,
                addressMark : req.body.addressMark,
                addressCity : req.body.addressCity,
                addressDistrict : req.body.addressDistrict,
                addressState : req.body.addressState,
                addressPin : req.body.addressPin
            }
        });
        if(addressData){
            return res.redirect(`/account/${userName}/address`);
        }else{
            return res.render('edit_address',{ message : "Couldn't update address"});
        }
    }catch(error){
        res.send(error);
    }
};

module.exports = {
    loadProfile,
    loadAddress,
    loadAddAddress,
    insertAddress,
    loadEditAddress,
    updateAddress
}