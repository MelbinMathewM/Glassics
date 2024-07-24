const User = require('../model/userModel');
const Product = require('../model/productModel');
const Category = require('../model/categoryModel');
const Brand = require('../model/brandModel');
const Address = require('../model/addressModel');
const Cart = require('../model/cartModel');
const Order = require('../model/orderModel');
const Wallet = require('../model/walletModel');
const Wishlist = require('../model/wishlistModel');
const mongoose = require('mongoose');

const loadHome = async (req, res) => {
    try {
        const bestSellers = await Product.find({ is_delete: false })
            .sort({ orderCount: -1 })
            .limit(8);

        const newArrivals = await Product.find({ is_delete: false })
            .sort({ createdAt: -1 })
            .limit(8);

        res.render('home', { 
            bestSellers: bestSellers,
            newArrivals: newArrivals,
        });
    } catch (error) {
        res.send(error);
    }
};

const loadShop = async (req, res) => {
    try {
        const userId = req.session.user_id;
        const categoriesParam = req.query.category || [];
        const brandsParam = req.query.brand || [];
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const sortOption = req.query.sort || 'popularity';
        const searchQuery = req.query.search || '';
        const priceRangesParam = req.query.price || [];

        // Handle priceRanges and categories as arrays
        const priceRanges = Array.isArray(priceRangesParam)
            ? priceRangesParam
            : priceRangesParam.split(',').filter(Boolean);

        const categories = Array.isArray(categoriesParam)
            ? categoriesParam
            : categoriesParam.split(',').filter(Boolean);

        const brands = Array.isArray(brandsParam)
            ? brandsParam
            : brandsParam.split(',').filter(Boolean);

        let filter = { is_delete: false };

        // Add category filter if categories are provided
        if (categories.length > 0) {
            const categoryData = await Category.find({ categoryName: { $in: categories.map(cat => new RegExp(cat, 'i')) } });
            if (categoryData.length > 0) {
                filter.productCategory = { $in: categoryData.map(cat => cat._id) };
            }
        }

        // Add brand filter if brands are provided
        if (brands.length > 0) {
            const brandData = await Brand.find({ brandName: { $in: brands.map(b => new RegExp(b, 'i')) } });
            if (brandData.length > 0) {
                filter.productBrand = { $in: brandData.map(b => b._id) };
            }
        }

        // Add price range filter if priceRanges are provided
        if (priceRanges.length > 0) {
            let priceFilter = [];
            priceRanges.forEach(range => {
                if (range.endsWith('-')) {
                    const min = parseInt(range.replace('-', ''), 10);
                    if (!isNaN(min)) {
                        priceFilter.push({ 'variants.discountPrice': { $gte: min } });
                    } else {
                        console.error('Invalid price range:', range);
                    }
                } else {
                    const [min, max] = range.split('-').map(Number);
                    if (!isNaN(min) && !isNaN(max)) {
                        priceFilter.push({ 'variants.discountPrice': { $gte: min, $lte: max } });
                    } else {
                        console.error('Invalid price range:', range);
                    }
                }
            });
            if (priceFilter.length > 0) {
                filter = { ...filter, $or: priceFilter };
            }
        }

        // Add search filter if searchQuery is provided
        const searchFilter = searchQuery ? {
            productName: { $regex: new RegExp(searchQuery, 'i') }
        } : {};

        const combinedFilter = { ...filter, ...searchFilter };

        // Count documents matching the combined filter
        const totalProducts = await Product.countDocuments(combinedFilter);

        // Aggregate products with the combined filter
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

        // Fetch categories and brands
        const categoryList = await Category.find({ is_delete: false });
        const brandList = await Brand.find({ is_delete: false });

        // Fetch wishlist items if user is logged in
        let wishlistItems = [];
        if (userId) {
            wishlistItems = await Wishlist.find({ userId: userId });
        }

        // Render the shop page
        res.render('shop', {
            products,
            categories: categoryList,
            brands: brandList,
            currentPage: page,
            totalPages: Math.ceil(totalProducts / limit),
            totalProducts,
            sort: sortOption,
            search: searchQuery,
            selectedCategories: categories,
            selectedBrands: brands,
            priceRanges: priceRanges,
            wishlistItems
        });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).render('500', { error: err.message });
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
        const product = await Product.findById(productId)
            .populate('productCategory')
            .populate('productBrand');
        if (!product) {
            return res.status(404).send('Product not found');
        }
        const relatedProducts = await Product.find({ 
            productCategory: product.productCategory, 
            _id: { $ne: productId } 
        });
        const defaultImage = 
            product.variants.length > 0 && product.variants[0].images.length > 0
                ? `/static/productImages/${product.variants[0].images[0]}`
                : '/static/default-image.jpg';

        // Render the product details page
        res.render('product_details', { 
            product: { ...product.toObject(), defaultImage }, 
            reproducts: relatedProducts 
        });
    } catch (err) {
        console.error('Error:', err);
       res.status(500).render('500', { error: err.message });
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
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ success : false, message: 'Invalid product ID.' });
        }
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ success : false, message: 'Login to add item to cart' });
        }
        const product = await Product.findById(productId);
        const user = await User.findById(userId);
        if (!product) {
            return res.status(404).json({ success : false, message: 'Product not found.' });
        }
        if (!user) {
            return res.status(404).json({ success : false, message: 'Login to add to cart.' });
        }
        const existingProduct = await Cart.findOne({
            userId: userId,
            productId: productId,
            productColor: color,
            productSize: size,
        });
        if (existingProduct) {
            return res.status(201).json({ success : false, message: 'Product Already in cart.' });
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
                return res.status(200).json({ success : true, message: 'Added to cart' });
            } else {
                return res.status(500).json({ success : false , message : "Couldn't add to cart" });
            }
        }
    } catch (error) {
        res.status(500).json({ success : false, message : 'An error occurred while processing the request' });
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
                res.status(200).json({ message: "added successfully" });
            } else {
                return res.status(400).json({ message: "Couldn't add to wishlist" });
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