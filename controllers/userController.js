const User = require('../model/userModel');
const Product = require('../model/productModel');
const Category = require('../model/categoryModel');
const Brand = require('../model/brandModel');
const Address = require('../model/addressModel');
const Cart = require('../model/cartModel');
const Order = require('../model/orderModel');
const Wishlist = require('../model/wishlistModel');
const mongoose = require('mongoose');

const loadHome = async (req, res) => {
    try {
        const products = await Product.find({ is_delete: false });
        res.render('home', { products: products });
    } catch (error) {
        res.send(error);
    }
};

const loadShop = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 4;
        const sortOption = req.query.sort || 'popularity';
        const searchQuery = req.query.search || '';
        let sortCriteria;

        switch (sortOption) {
            case 'price-asc':
                sortCriteria = { "minPrice" : 1 };
                break;
            case 'price-desc':
                sortCriteria = { "minPrice": -1 };
                break;
            case 'name-asc':
                sortCriteria = { productName: 1 };
                break;
            case 'name-desc':
                sortCriteria = { productName: -1 };
                break;
            case 'rating-asc':
                sortCriteria = { rating: 1 };
                break;
            case 'rating-desc':
                sortCriteria = { rating: -1 };
                break;
            case 'popularity':
            default:
                sortCriteria = { popularity: -1 };
                break;
        }

        const searchFilter = searchQuery ? {
            $or : [
                { productName : { $regex : searchQuery, $options : 'i'} }
            ]
        } : {};
        const totalProducts = await Product.countDocuments({ is_delete: false, ...searchFilter });
        const products = await Product.aggregate([
            { $match : { is_delete : false, ...searchFilter } },
            {
                $addFields : {
                    minPrice : { $min : "$variants.discountPrice"},
                    maxPrice : { $max : "$variants.discountPrice"}
                }
            },
            { $sort : sortCriteria },
            { $skip : (page - 1) * limit },
            { $limit : limit }
        ]).collation({ locale: "en", strength: 2 });
        const categories = await Category.find({ is_delete: false });
        const brands = await Brand.find({ is_delete: false });

        res.render('shop', {
            products: products,
            categories: categories,
            brands: brands,
            currentPage: page,
            totalPages: Math.ceil(totalProducts / limit),
            totalProducts: totalProducts,
            sort : sortOption,
            search : searchQuery
        });
    } catch (error) {
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


const loadCart = async (req, res) => {
    try {
        const id = req.session.user_id;
        if (!id) {
            return res.status(401).send("User not logged in");
        }
        const address = await Address.find({ user_id: id })
        const cart = await Cart.find({ userId: id });
        res.render('cart', { cart: cart, addresses: address });
    } catch (error) {
        res.send(error);
    }
};

const insertCart = async (req, res) => {
    try {
        const { productId, quantity, productImage, productPrice, productDiscPrice, color, size } = req.body;
        const userId = req.session.user_id;

        if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ error: 'Invalid product or user ID.' });
        }

        const product = await Product.findById(productId);
        const user = await User.findById(userId);

        if (!product || !user) {
            return res.status(404).json({ error: 'Product or user not found.' });
        }

        const existingProduct = await Cart.findOne({
            userId: userId,
            productId: productId,
            productColor: color,
            productSize: size,
        });

        if (existingProduct) {
            return res.status(201).json({ error: 'Product Already in cart.' });
        } else {
            const cartPrice = productDiscPrice * quantity;
            const cart = new Cart({
                userId: user._id,
                productId: product._id,
                productImage: productImage,
                productName: product.productName,
                productPrice: productPrice,
                productDiscPrice: productDiscPrice,
                productColor: color,
                productSize: size,
                productQuantity: quantity,
                cartPrice: cartPrice,
            });

            const cartData = await cart.save();

            if (cartData) {
                return res.status(200).json({ message: 'Added to cart' });
            } else {
                return res.status(500).json({ error: "Couldn't add to cart" });
            }
        }
    } catch (error) {
        res.status(500).json({ error: 'An error occurred while processing the request' });
    }
};

const updateCart = async (req, res) => {
    try {
        const { quantities } = req.body;
        const userId = req.session.user_id;
        for (const cartId in quantities) {
            const quantity = quantities[cartId];
            const cartItem = await Cart.findById(cartId);
            if (cartItem) {
                cartItem.productQuantity = quantity;
                cartItem.cartPrice = quantity * cartItem.productDiscPrice;
                await cartItem.save();
            }
        };
        res.render('cart', { message: "Cart updated successfully", cart: updatedCart });
        const updatedCart = await Cart.find({ userId: userId });

    } catch (error) {
        res.send(error);
    }
};

const deleteCart = async (req, res) => {
    try {
        const cartId = req.query.id;
        const cartData = await Cart.findByIdAndDelete(cartId);
        if (!cartData) {
            return res.status(404).json({ message: 'Cart not found' });
        }
        res.status(200).json({ message: 'Cart deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'There was a problem deleting the cart', error: error.message });
    }
};

const loadCheckout = async (req, res) => {
    try {
        const id = req.session.user_id;
        const address = await Address.find({ user_id: id });
        const cart = await Cart.find({ userId: id });
        if(cart.length === 0){
            res.redirect('cart');
        }else{
            res.render('checkout', { addresses: address, cart: cart });
        }
    } catch (error) {
        res.send(error);
    }
};

const checkoutAddAdress = async (req,res) => {
    try{
        const newAddress = req.body;
        const userId = req.session.user_id;
        const address = new Address({
            user_id : userId,
            addressName : newAddress.addressName,
            addressEmail : newAddress.addressEmail,
            addressMobile : newAddress.addressEmail,
            addressHouse : newAddress.addressHouse,
            addressStreet : newAddress.addressStreet,
            addressPost : newAddress.addressPost,
            addressMark : newAddress.addressMark,
            addressCity : newAddress.addressCity,
            addressDistrict : newAddress.addressDistrict,
            addressState : newAddress.addressState,
            addressPin : newAddress.addressPin
        });
        const addressData = await address.save();
        if(!addressData){
            res.json({ success: false, message : 'Could not add address' });
        }else{
            res.json({ success: true, address: newAddress });
        }
    }catch(error){
        res.json({ success: false, message: 'Error adding address', error });
    }
}

const generateUniqueOrderID = async () => {
    let orderID;
    let existingOrder;
    do {
        orderID = Math.floor(1000000000 + Math.random() * 9000000000).toString();
        existingOrder = await Order.findOne({ orderID });
    } while (existingOrder);
    return orderID;
};


const addCheckout = async (req, res) => {
    try {
        const { addressDetails, paymentOption } = req.body;
        const userId = req.session.user_id;
        if (!userId) {
            return res.status(401).send("User not logged in");
        }
        const cart = await Cart.find({ userId: userId });
        if (cart.length === 0) {
            return res.status(400).json({ error: 'Cart is empty' });
        }
        const selectedAddressIndex = parseInt(addressDetails, 10);
        const userAddress = await Address.find({ user_id: userId });
        const selectedAddress = userAddress[selectedAddressIndex];
        if (!selectedAddress) {
            return res.status(400).json({ error: 'Invalid address selection' });
        }

        const orderItems = cart.map(item => ({
            product_id: item.productId,
            productImage: item.productImage,
            productColor: item.productColor,
            productPrice: item.productDiscPrice,
            productSize: item.productSize,
            quantity: item.productQuantity,
            deliveryDate: new Date(),
            orderStatus: 'Pending'
        }));

        const uniqueOrderID = await generateUniqueOrderID();
        const newOrder = new Order({
            customer_id: userId,
            address_id: selectedAddress._id,
            items: orderItems,
            orderDate: new Date(),
            paymentMethod: paymentOption,
            orderID: uniqueOrderID
        });

        const savedOrder = await newOrder.save();

        // Decrease stock for each product
        for (const item of orderItems) {
            const product = await Product.findById(item.product_id);
            if (!product) {
                return res.status(400).json({ error: `Product not found` });
            }
            const variant = product.variants.find(v => v.color === item.productColor);
            if (!variant) {
                return res.status(400).json({ error: `Variant with color ${item.productColor} not found for product ${product.productName}` });
            }
            const subvariant = variant.subVariants.find(s => s.size === item.productSize);
            if (!subvariant) {
                return res.status(400).json({ error: `Subvariant with size ${item.productSize} not found for product ${product.productName}` });
            }
            if (subvariant.quantity < item.quantity) {
                return res.status(400).json({ error: `Only ${subvariant.quantity} stock for the size ${item.productSize}` });
            }
            subvariant.quantity -= item.quantity;
            await product.save();
        }

        // Clear the cart
        await Cart.deleteMany({ userId: userId });

        res.status(201).json({ message: 'Order placed successfully', order: savedOrder });
    } catch (error) {
        console.error('Error while processing order:', error);
        res.status(500).json({ error: 'An error occurred while processing your order' });
    }
};

const loadWishlist = async (req, res) => {
    try {
        const id = req.session.user_id;
        if (!id) {
            return res.status(401).send("User not logged in");
        };
        const wishlist = await Wishlist.find({ userId: id });
        return res.render('wishlist', { wishlist: wishlist });
    } catch (error) {
        res.send(error);
    }
};

const insertWishlist = async (req, res) => {
    try {
        const { productId } = req.body;
        const userId = req.session.user_id;
        if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).send('Invalid product or user ID.');
        };
        const product = await Product.findById(productId);
        const user = await User.findById(userId);
        if (!user || !product) {
            return res.status(404).send('Product or user not found.');
        };
        const wishlist = new Wishlist({
            userId: user._id,
            productId: product._id,
            productImage: product.productImage,
            productName: product.productName,
            productPrice: product.productPrice
        });
        const wishlistData = await wishlist.save();
        if (wishlistData) {
            return res.json({ message: "added successfully" });
        } else {
            return res.json({ message: "Couldn't add to wishlist" })
        }
    } catch (error) {
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
    deleteCart,
    loadCheckout,
    checkoutAddAdress,
    addCheckout,
    loadWishlist,
    insertWishlist
}