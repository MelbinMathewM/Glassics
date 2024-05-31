const User = require('../model/userModel');
const Product = require('../model/productModel');
const Category = require('../model/categoryModel');
const Brand = require('../model/brandModel');
const Cart = require('../model/cartModel');
const Wishlist  = require('../model/wishlistModel');
const mongoose = require('mongoose');

const loadHome = async (req,res) => {
    try{
        const products = await Product.find({is_delete : false });
        res.render('home', { products : products });
    }catch(error){
        res.send(error);
    }
};

const loadShop = async (req,res) => {
    try{
        const products = await Product.find({is_delete : false });
        const categories = await Category.find({is_delete : false });
        const brands = await Brand.find({ is_delete : false });
        res.render('shop',{ products : products ,categories : categories,brands : brands});
    }catch(error){
        res.send(error);
    }
};

const loadProductDetail = async (req, res) => {
    try {
        const productId = req.params.productId;
        const product = await Product.findById(productId).populate('productCategory').populate('productBrand');

        if (!product) {
            return res.status(404).send('Product not found');
        }

        const {
            _id,
            productName,
            productGender,
            productDescription,
            productImage,
            frameMaterial, 
            frameShape, 
            frameStyle, 
            lensType, 
            specialFeatures,
            variants,
            is_delete,
        } = product;

        const productCategory = product.productCategory ? product.productCategory.categoryName : null;
        const productBrand = product.productBrand ? product.productBrand.brandName : null;

        const transformedProduct = {
            _id,
            productName,
            productGender,
            productDescription,
            productCategory,
            productBrand,
            productImage,
            frameMaterial, 
            frameShape, 
            frameStyle, 
            lensType, 
            specialFeatures,
            variants,
            is_delete,
        };

        const relatedProducts = await Product.find({ productCategory: product.productCategory });

        transformedProduct.defaultImage =
            variants.length > 0 && variants[0].images.length > 0
                ? `/static/productImages/${variants[0].images[0]}`
                : '/static/default-image.jpg';

        res.render('product_details', { product: transformedProduct, reproducts: relatedProducts });
    } catch (error) {
        res.status(500).send(error);
    }
};


const loadCart = async (req,res) => {
    try{
        const id = req.session.user_id;
        if (!id) {
            return res.status(401).send("User not logged in");
        }
        const cart = await Cart.find({ userId : id});
        res.render('cart',{ cart : cart});
    }catch(error){
        res.send(error);
    }
};

const insertCart = async (req,res) => {
    try{
        const { productId, quantity } = req.body;
        const userId = req.session.user_id;
        if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).send('Invalid product or user ID.');
        }
        const product = await Product.findById(productId);
        const user = await User.findById(userId);

        if (!product || !user) {
            return res.status(404).send('Product or user not found.');
        }
        const cartPrice = product.productPrice * quantity;
        const cart = new Cart({
            userId : user._id,
            productId : product._id,
            productImage : product.productImage,
            productName : product.productName,
            productPrice : product.productPrice,
            productQuantity : quantity,
            cartPrice : cartPrice
        });
        const cartData = await cart.save();
        if(cartData){
            return res.redirect('/cart');
        }else{
            return res.render('product_details',{ message : "Couldn't insert product"})
        }
    }catch(error){
        res.send(error);
    }
};

const updateCart = async (req,res) => {
    try{
        const { quantities } = req.body;
        const userId = req.session.user_id;
        for(const cartId in quantities){
            const quantity = quantities[cartId];
            const cartItem = await Cart.findById(cartId);
            if(cartItem){
                cartItem.productQuantity = quantity;
                cartItem.cartPrice = quantity * cartItem.productPrice;
                await cartItem.save();
            }
        };
        res.render('cart', { message: "Cart updated successfully", cart: updatedCart });
        const updatedCart = await Cart.find({ userId: userId });
        
    }catch(error){
        res.send(error);
    }
};

const deleteCart = async (req,res) => {
    try{

    }catch(error){
        res.send(error);
    }
};

const loadWishlist = async (req,res) => {
    try{
        const id = req.session.user_id;
        if(!id){
            return res.status(401).send("User not logged in");
        };
        const wishlist = await Wishlist.find({ userId : id});
        return res.render('wishlist',{ wishlist : wishlist });
    }catch(error){
        res.send(error);
    }
};

const insertWishlist = async(req,res) => {
    try{
        const { productId } = req.body;
        const userId = req.session.user_id;
        if(!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(userId)){
            return res.status(400).send('Invalid product or user ID.');
        };
        const product = await Product.findById(productId);
        const user = await User.findById(userId);
        if(!user || !product){
            return res.status(404).send('Product or user not found.');
        };
        const wishlist = new Wishlist({
            userId : user._id,
            productId : product._id,
            productImage : product.productImage,
            productName : product.productName,
            productPrice : product.productPrice
        });
        const wishlistData = await wishlist.save();
        if(wishlistData){
            return res.json({ message : "added successfully"});
        }else{
            return res.json({ message : "Couldn't add to wishlist"})
        }
    }catch(error){
        res.send(error);
    }
}

module.exports = {
    loadHome,
    loadShop,
    loadProductDetail,
    loadCart,
    insertCart,
    updateCart,
    loadWishlist,
    insertWishlist
}