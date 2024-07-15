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
        // Fetch best sellers
        const bestSellers = await Product.find({ is_delete: false })
            .sort({ orderCount: -1 })
            .limit(8);

        // Fetch new arrivals
        const newArrivals = await Product.find({ is_delete: false })
            .sort({ createdAt: -1 })
            .limit(8);

        // Render the home page with data
        res.render('home', { 
            bestSellers: bestSellers,
            newArrivals: newArrivals,
        });
    } catch (error) {
        // Handle errors
        res.send(error);
    }
};

const loadShop = async (req, res) => {
    try {
        const userId = req.session.user_id;
        const category = req.query.category || '';
        const brand = req.query.brand || '';
        const minPrice = req.query.minPrice || '';
        const maxPrice = req.query.maxPrice || '';
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const sortOption = req.query.sort || 'popularity';
        const searchQuery = req.query.search || '';
        let filter = { is_delete: false };
        if (category) {
            const categoryData = await Category.findOne({ categoryName: new RegExp(category, 'i') });
            if (categoryData) {
                filter.productCategory = categoryData._id;
            } else {
                filter.productCategory = null;
            }
        }
        if (brand) {
            const brandData = await Brand.findOne({ brandName: new RegExp(brand, 'i') });
            if (brandData) {
                filter.productBrand = brandData._id;
            } else {
                filter.productBrand = null;
            }
        }
        if (minPrice && maxPrice) {
            filter['variants.discountPrice'] = { $gte: parseFloat(minPrice), $lte: parseFloat(maxPrice) };
        } else if (minPrice) {
            filter['variants.discountPrice'] = { $gte: parseFloat(minPrice) };
        } else if (maxPrice) {
            filter['variants.discountPrice'] = { $lte: parseFloat(maxPrice) };
        }
        const searchFilter = searchQuery ? {
            productName: { $regex: new RegExp(searchQuery, 'i') }
        } : {};
        const combinedFilter = { ...filter, ...searchFilter };
        const totalProducts = await Product.countDocuments(combinedFilter);
        const products = await Product.aggregate([
            { $match: combinedFilter },
            {
                $addFields: {
                    minPrice: { $min: "$variants.discountPrice" },
                    maxPrice: { $max: "$variants.discountPrice" }
                }
            },
            { $sort: getSortCriteria(sortOption) },
            { $skip: (page - 1) * limit },
            { $limit: limit }
        ]).collation({ locale: "en", strength: 2 });
        const categories = await Category.find({ is_delete: false });
        const brands = await Brand.find({ is_delete: false });
        let wishlistItems = [];
        if (userId) {
            wishlistItems = await Wishlist.find({ userId: userId });
        }
        res.render('shop', {
            products,
            categories,
            brands,
            currentPage: page,
            totalPages: Math.ceil(totalProducts / limit),
            totalProducts,
            sort: sortOption,
            search: searchQuery,
            category,
            brand,
            minPrice,
            maxPrice,
            wishlistItems
        });
    } catch (error) {
        res.status(500).send('Internal Server Error');
    }
};

function getSortCriteria(sortOption) {
    switch (sortOption) {
        case 'price-asc':
            return { 'variants.discountPrice': 1 };
        case 'price-desc':
            return { 'variants.discountPrice': -1 };
        case 'name-asc':
            return { productName: 1 };
        case 'name-desc':
            return { productName: -1 };
        case 'rating-asc':
            return { rating: 1 };
        case 'rating-desc':
            return { rating: -1 };
        case 'new-arrivals':
            return { createdAt: -1 };
        case 'popularity':
            return { orderCount: -1 };
        case 'popularity':
        default:
            return { popularity: -1 };
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
            _id, productName, productGender, productDescription, productImage, frameMaterial,
            frameShape, frameStyle, lensType, specialFeatures, variants, is_delete
        } = product;
        const productCategory = product.productCategory ? product.productCategory.categoryName : null;
        const productBrand = product.productBrand ? product.productBrand.brandName : null;
        const transformedProduct = {
            _id, productName, productGender, productDescription, productCategory, productBrand, productImage,
            frameMaterial, frameShape, frameStyle, lensType, specialFeatures, variants, is_delete,
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
        const messages = [];

        for (const cartId in quantities) {
            const quantity = quantities[cartId];
            const cartItem = await Cart.findById(cartId).populate('productId');

            if (cartItem) {
                const product = await Product.findById(cartItem.productId);

                if (!product) {
                    return res.json({ success: false, message: 'Product not found.' });
                }

                const variant = product.variants.find(v => v.color === cartItem.productColor);
                if (!variant) {
                    return res.status(400).json({ success: false, message: `Variant not found for product ${product.productName}` });
                }

                const subvariant = variant.subVariants.find(s => s.size === cartItem.productSize);
                if (!subvariant) {
                    return res.status(400).json({ success: false, message: `Subvariant not found for product ${product.productName}` });
                }

                if (subvariant.quantity >= quantity) {
                    cartItem.productQuantity = quantity;
                    cartItem.cartPrice = quantity * cartItem.productDiscPrice;
                    await cartItem.save();
                    messages.push(`Updated quantity for ${product.productName} to ${quantity}`);
                } else {
                    messages.push(`Only ${subvariant.quantity} items available for ${product.productName}`);
                }
            }
        };
        const updatedCart = await Cart.find({ userId: userId });
        res.status(201).json({ success: true, message: messages.join('. '), cart: updatedCart });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
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

const loadWishlist = async (req, res) => {
    try {
        const id = req.session.user_id;
        if (!id) {
            return res.status(401).send("User not logged in");
        };
        const wishlist = await Wishlist.find({ userId: id });
        res.render('wishlist', { wishlist: wishlist });
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
        const existingProduct = await Wishlist.findOne({
            userId: userId,
            productId: productId,
        });
        if (existingProduct) {
            return res.status(201).json({ success: false, message: 'Product Already in wishlist.' });
        } else {
            const wishlist = new Wishlist({
                userId: user._id,
                productId: product._id,
                productImage: product.variants[0].images[0],
                productName: product.productName,
                productPrice: product.variants[0].price
            });
            const wishlistData = await wishlist.save();
            if (wishlistData) {
                return res.json({ message: "added successfully" });
            } else {
                return res.json({ message: "Couldn't add to wishlist" })
            }
        }
    } catch (error) {
        res.send(error);
    }
};

const removeWishlist = async (req, res) => {
    try {
        const id = req.params.id;
        const wishlistData = await Wishlist.findByIdAndDelete(id);
        if (wishlistData) {
            res.json({ success: true, message: 'removed successfully' });
        } else {
            res.json({ success: false, message: 'couldn\'t remove' });
        }
    } catch (error) {
        res.json({ success: false, message: 'Error deleting item' });
    }
};

module.exports = {
    loadHome,
    loadShop,
    loadProductDetail,
    loadCart,
    insertCart,
    updateCart,
    deleteCart,
    loadWishlist,
    insertWishlist,
    removeWishlist
};