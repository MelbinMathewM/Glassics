const Admin = require('../model/adminModel');
const User = require('../model/userModel');
const Order = require('../model/orderModel');
const Product = require('../model/productModel');
const Category = require('../model/categoryModel');
const Cart = require('../model/cartModel');
const Coupon = require('../model/couponModel');
const Wallet = require('../model/walletModel');
const Offer = require('../model/offerModel');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const loadLogin = async (req, res) => {
    try {
        res.render('login')
    } catch (error) {
        res.send(error);
    }
};

const verifyAdmin = async (req, res) => {
    try {
        const adminName = req.body.adminName;
        const apassword = req.body.apassword;
        const adminData = await Admin.findOne({ adminName: adminName });
        if (adminData) {
            const passwordMatch = await bcrypt.compare(apassword, adminData.apassword);
            if (passwordMatch) {
                req.session.admin_id = adminData._id;
                res.status(201).json({ message : 'Verified successfully'});
            } else {
                res.status(404).json({ message : 'Password is incorrect'});
            }
        } else {
            res.status(404).json({ message : 'User not found'});
        }
    } catch (error) {
        res.send(error);
    }
};

const loadUser = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const skip = (page - 1) * limit;
        const searchRegex = new RegExp(search , 'i');

        const query = {
            $or : [
                { userName : { $regex : searchRegex } },
                { customerName : { $regex : searchRegex } },
                { userEmail : { $regex : searchRegex } }
            ]
        }

        const users = await User.find(query)
            .skip(skip)
            .limit(limit);
        const totalUsers = await User.countDocuments(query);
        res.render('users', { 
            users: users, 
            currentPage: page, 
            totalPages: Math.ceil(totalUsers / limit),
            limit: limit,
            search : search
        });
    } catch (error) {
        res.send(error);
    }
};

const blockUser = async (req, res) => {
    try {
        const userId = req.query.id;
        const userData = await User.findByIdAndUpdate(userId, { is_blocked: 1 });
        if (userData) {
            res.status(200).json({ message: 'User blocked successfully' });
        } else {
            res.status(200).json({ message: "Couldn't block user" });
        }
    } catch (error) {
        res.send(error);
    }
};

const unblockUser = async (req, res) => {
    try {
        const userId = req.query.id;
        const userData = await User.findByIdAndUpdate(userId, { is_blocked: 0 });
        if (userData) {
            res.status(200).json({ message: 'User unblocked successfully' });
        } else {
            res.status(200).json({ message: "Couldn't unblock user" });
        }
    } catch (error) {
        res.send(error);
    }
};

const loadOrder = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const skip = (page - 1) * limit;
        const searchRegex = new RegExp(search, 'i');
        const customerIds = await User.find({ userName: { $regex: searchRegex } }).distinct('_id');
        const query = {
            $or: [
                { orderID: { $regex: searchRegex } },
                { 'items.orderStatus': { $regex: searchRegex } },
                { customer_id: { $in: customerIds } }
            ]
        };
        const orders = await Order.find(query)
            .populate({
                path: 'customer_id',
                select: 'userName'
            })
            .populate('address_id')
            .populate('items.product_id')
            .sort({ orderDate: -1 })
            .skip(skip)
            .limit(limit);
        const totalOrders = await Order.countDocuments(query);
        res.render('orders', {
            orders: orders,
            currentPage: page,
            totalPages: Math.ceil(totalOrders / limit),
            limit: limit,
            search: search
        });
    } catch (error) {
        res.send(error);
    }
};


const loadOrderDetail = async (req, res) => {
    try {
        const orderId = req.query.id;
        const order = await Order.findById(orderId)
            .populate('address_id')
            .populate('items.product_id')
            .populate('customer_id');
        res.render('order_details', { order: order });
    } catch (error) {
        res.send(error);
    }
};

const changeStatusOrder = async (req, res) => {
    try {
        const { itemId, newStatus } = req.body;
        const validStatuses = ['Pending', 'Processing', 'Dispatched', 'Delivered', 'Canceled', 'Returned', 'Return requested'];
        
        if (!validStatuses.includes(newStatus)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        const statusOrder = {
            'Pending': 0,
            'Processing': 1,
            'Dispatched': 2,
            'Delivered': 3,
            'Canceled': 4,
            'Return requested': 5,
            'Returned': 6
        };

        const order = await Order.findOne({ 'items._id': itemId });
        if (!order) {
            return res.status(404).json({ success: false, message: 'Could not find order' });
        }
        
        const item = order.items.id(itemId);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Could not find item' });
        }

        const currentStatusOrder = statusOrder[item.orderStatus];
        const newStatusOrder = statusOrder[newStatus];

        if (newStatusOrder < currentStatusOrder) {
            return res.status(400).json({ success: false, message: 'Cannot update to a previous status.' });
        }

        if ((item.orderStatus === 'Delivered' || item.orderStatus === 'Returned') && newStatus === 'Canceled') {
            return res.status(400).json({ success: false, message: 'Cannot cancel a delivered or returned order.' });
        }

        if (newStatus === 'Canceled' || newStatus === 'Returned') {
            const product = await Product.findById(item.product_id);
            if (!product) {
                return res.status(404).json({ success: false, message: 'Could not find product' });
            }
            const variant = product.variants.find(v => v.color === item.productColor);
            if (!variant) {
                return res.status(404).json({ success: false, message: 'Could not find variant' });
            }
            const subvariant = variant.subVariants.find(s => s.size === item.productSize);
            if (!subvariant) {
                return res.status(404).json({ success: false, message: 'Could not find subvariant' });
            }
            subvariant.quantity += item.quantity;
            await product.save();
            
            if (order.paymentMethod === 'RazorPay' || order.paymentMethod === 'wallet') {
                const wallet = await Wallet.findOne({ user: order.customer_id });
                if (!wallet) {
                    wallet = new Wallet({
                        user: order.customer_id
                    });
                }
                wallet.balance += item.productDiscPrice * item.quantity;
                wallet.transactions.push({
                    description: 'Order canceled',
                    amount: item.productDiscPrice * item.quantity,
                    balance: wallet.balance
                });
                await wallet.save();
            }
        }

        item.orderStatus = newStatus;
        if (item.orderStatus === 'Delivered') {
            item.deliveryDate = Date.now();
        } else if (item.orderStatus === 'Canceled') {
            item.deliveryDate = null;
        }
        await order.save();
        res.json({ success: true, message: 'Order status updated successfully.', newStatus });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ success: false, message: 'Failed to update the order status.' });
    }
};


const getReturnedOrder = async (req, res) => {
    try {
        const returnedOrders = await Order.find({ $or: 
            [{ 'items.orderStatus': 'Returned' },
                { 'items.orderStatus': 'Return requested' }
            ] }).populate('customer_id');
        res.render('returned_orders', { returnedOrders });
    } catch (error) {
        console.error('Error fetching returned orders:', error);
        res.status(500).send('Internal Server Error');
    }
};

const loadCoupon = async (req, res) => {
    try {
        const search = req.query.search;
        const page = req.query.page || 1;
        const limit = req.query.limit || 8;
        const skip = (page - 1) * limit;
        const searchNumber = parseFloat(search);
        const searchRegex = new RegExp(search, 'i');
        const query = {
            $or : [
                { code : { $regex : searchRegex } },
                ...(isNaN(searchNumber) ? [] : [
                    { discount: searchNumber },
                    { minPurchase: searchNumber }
                ])
            ]
        }
        const coupons = await Coupon.find(query).skip(skip).limit(parseInt(limit));
        const totalCoupons = await Coupon.countDocuments(query);
        res.render('coupons', { coupons: coupons, currentPage : parseInt(page), totalPages : Math.ceil(totalCoupons/limit), limit, search });
    } catch (error) {
        res.send(error);
    }
};

const insertCoupon = async (req, res) => {
    try {
        const { code, discount, minPurchase, expirationDate, usageLimit } = req.body;
        const existingCoupon = await Coupon.findOne({ code }).collation({ locale: "en", strength: 2 });
        if (existingCoupon) {
            const coupons = await Coupon.find();
            return res.status(400).json({ message: "Coupon code already exists!", coupons });
        } else {
            const coupon = new Coupon({
                code,
                discount,
                minPurchase,
                expirationDate,
                usageLimit
            });
            const couponData = await coupon.save();
            return res.status(201).json({ message: "Coupon added successfully", couponData });
        }
    } catch (error) {
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
};

const updateCoupon = async (req, res) => {
    try {
        const { couponId, discount, minPurchase, expirationDate, usageLimit } = req.body;
        const couponData = await Coupon.findByIdAndUpdate(couponId, {
            $set: {
                discount: discount,
                minPurchase: minPurchase,
                expirationDate: expirationDate,
                usageLimit: usageLimit
            }
        });
        if (couponData) {
            return res.status(201).json({ message: "Coupon edited successfully", couponData });
        } else {
            return res.status(200).json({ message: 'Coupon editing unsuccessfull' });
        }
    } catch (error) {
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
};

const deleteCoupon = async (req, res) => {
    try {
        const couponId = req.query.id;
        const couponData = await Coupon.findByIdAndDelete(couponId);
        if (couponData) {
            return res.status(201).json({ message: "Coupon deleted successfully" });
        } else {
            return res.status(200).json({ message: 'Coupon deletion unsuccessfull' });
        }
    } catch (error) {
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
};

const loadOffer = async (req, res) => {
    try {
        const search = req.query.search || '';
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 8;
        const skip = (page - 1) * limit;

        const searchNumber = parseFloat(search);
        const searchRegex = new RegExp(search, 'i');

        const query = {
            $or: [
                { offerName: { $regex: searchRegex } },
                { offerDescription: { $regex: searchRegex } },
                { offerType: { $regex: searchRegex } },
                { typeName: { $regex: searchRegex } },
                ...(isNaN(searchNumber) ? [] : [
                    { discountPercentage: searchNumber }
                ])
            ]
        };

        const offers = await Offer.find(query)
            .populate('productId')
            .populate('categoryId')
            .skip(skip)
            .limit(limit);

        const totalOffers = await Offer.countDocuments(query);
        const products = await Product.find();
        const categories = await Category.find();

        res.render('offers', {
            offers: offers,
            products: products,
            categories: categories,
            currentPage: page,
            totalPages: Math.ceil(totalOffers / limit),
            limit,
            search
        });
    } catch (error) {
        res.send(error);
    }
};


const insertOffer = async (req, res) => {
    try {
        const { offerName, offerDescription, discountPercentage, offerType, typeName, productId, categoryId, isActive } = req.body;
        if (productId && !mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).send('Invalid product ID.');
        }
        if (categoryId && !mongoose.Types.ObjectId.isValid(categoryId)) {
            return res.status(400).send('Invalid category ID.');
        }
        let product = null;
        let category = null;
        if (productId) {
            product = await Product.findById(productId);
            if (!product) {
                return res.status(404).json({ success: false, message: 'Product not found.' });
            }
        }
        if (categoryId) {
            category = await Category.findById(categoryId);
            if (!category) {
                return res.status(404).json({ success: false, message: 'Category not found.' });
            }
        }
        const offer = new Offer({
            offerName,
            offerDescription,
            discountPercentage,
            offerType,
            typeName,
            productId: product ? product._id : undefined,
            categoryId: category ? category._id : undefined,
            isActive: !!isActive
        });
        const offerData = await offer.save();
        if (offerData && isActive) {
            if (offerType === 'productOffer' && product) {
                product.variants.forEach(variant => {
                    const newDiscountPrice = Math.floor(variant.price - (variant.price * (discountPercentage / 100)));
                    variant.discountPrice = Math.min(newDiscountPrice, variant.discountPrice || variant.price);
                });
                await product.save();
                const carts = await Cart.find({ productId: product._id });
                for (const cart of carts) {
                    cart.productDiscPrice = Math.floor(cart.productPrice - (cart.productPrice * (discountPercentage / 100)));
                    cart.cartPrice = cart.productDiscPrice * cart.productQuantity;
                    await cart.save();
                }
            } else if (offerType === 'categoryOffer' && category) {
                const categoryOffers = await Offer.find({ categoryId: category._id, isActive: true }).sort({ discountPercentage: -1 });
                const highestCategoryDiscount = categoryOffers.length > 0 ? categoryOffers[0].discountPercentage : 0;
                const products = await Product.find({ productCategory: category._id });
                for (const product of products) {
                    const productOffers = await Offer.find({ productId: product._id, isActive: true }).sort({ discountPercentage: -1 });
                    const highestProductDiscount = productOffers.length > 0 ? productOffers[0].discountPercentage : 0;
                    const highestDiscount = Math.max(highestCategoryDiscount, highestProductDiscount);
                    product.variants.forEach(variant => {
                        variant.discountPrice = Math.floor(variant.price - (variant.price * (highestDiscount / 100)));
                    });
                    await product.save();
                    const carts = await Cart.find({ productId: product._id });
                    for (const cart of carts) {
                        cart.productDiscPrice = Math.floor(cart.productPrice - (cart.productPrice * (highestDiscount / 100)));
                        cart.cartPrice = cart.productDiscPrice * cart.productQuantity;
                        await cart.save();
                    }
                }
            }
            res.status(201).json({ success: true, message: 'Offer creation successful' });
        } else if (!isActive) {
            res.status(201).json({ success: true, message: 'Offer created but not active, no discounts applied.' });
        } else {
            res.status(500).json({ success: false, message: 'Offer creation unsuccessful' });
        }
    } catch (error) {
        console.error('Error inserting offer:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

const updateOffer = async (req, res) => {
    try {
        const offerId = req.params.id;
        const { offerName, offerDescription, discountPercentage, offerType, typeName, productId, categoryId, isActive } = req.body;
        if (productId && !mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).send('Invalid product ID.');
        }
        if (categoryId && !mongoose.Types.ObjectId.isValid(categoryId)) {
            return res.status(400).send('Invalid category ID.');
        }
        let product = null;
        let category = null;
        if (productId) {
            product = await Product.findById(productId);
            if (!product) {
                return res.status(404).send({ success: false, message: 'Product not found.' });
            }
        }
        if (categoryId) {
            category = await Category.findById(categoryId);
            if (!category) {
                return res.status(404).send({ success: false, message: 'Category not found.' });
            }
        }
        const updatedOffer = await Offer.findByIdAndUpdate(
            offerId,
            {
                offerName,
                offerDescription,
                discountPercentage,
                offerType,
                typeName,
                productId: product ? product._id : undefined,
                categoryId: category ? category._id : undefined,
                isActive: !!isActive
            },
            { new: true }
        );
        if (updatedOffer) {
            if (isActive) {
                await applyDiscounts(updatedOffer.offerType, product, category, discountPercentage);
            } else {
                await revertToHighestAvailableDiscount(updatedOffer.offerType, product, category);
            }
            res.status(200).json({ success: true, message: 'Offer updated successfully', offer: updatedOffer });
        } else {
            res.status(404).json({ success: false, message: 'Offer not found' });
        }
    } catch (error) {
        console.error('Error updating offer:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

const applyDiscounts = async (offerType, product, category, discountPercentage) => {
    if (offerType === 'productOffer' && product) {
        const productOffers = await Offer.find({ productId: product._id, isActive: true }).sort({ discountPercentage: -1 });
        const highestProductDiscount = productOffers.length > 0 ? productOffers[0].discountPercentage : discountPercentage;
        product.variants.forEach(variant => {
            variant.discountPrice = Math.floor(variant.price - (variant.price * (highestProductDiscount / 100)));
        });
        await product.save();
        await updateCartPrices(product._id, highestProductDiscount);
    } else if (offerType === 'categoryOffer' && category) {
        const products = await Product.find({ productCategory: category._id });
        for (const product of products) {
            const highestDiscount = await getHighestDiscount(product._id, category._id);
            product.variants.forEach(variant => {
                variant.discountPrice = Math.floor(variant.price - (variant.price * (highestDiscount / 100)));
            });
            await product.save();
            await updateCartPrices(product._id, highestDiscount);
        }
    }
};

const revertToHighestAvailableDiscount = async (offerType, product, category) => {
    if (offerType === 'productOffer' && product) {
        const highestDiscount = await getHighestDiscount(product._id);
        const discountToApply = highestDiscount || 5;
        product.variants.forEach(variant => {
            variant.discountPrice = Math.floor(variant.price - (variant.price * (discountToApply / 100)));
        });
        await product.save();
        await updateCartPrices(product._id, discountToApply);
    } else if (offerType === 'categoryOffer' && category) {
        const products = await Product.find({ productCategory: category._id });
        for (const product of products) {
            const highestDiscount = await getHighestDiscount(product._id, category._id);
            const discountToApply = highestDiscount || 5;
            product.variants.forEach(variant => {
                variant.discountPrice = Math.floor(variant.price - (variant.price * (discountToApply / 100)));
            });
            await product.save();
            await updateCartPrices(product._id, discountToApply);
        }
    }
};


const getHighestDiscount = async (productId, categoryId = null) => {
    const productOffers = await Offer.find({ productId, isActive: true }).sort({ discountPercentage: -1 });
    const categoryOffers = categoryId ? await Offer.find({ categoryId, isActive: true }).sort({ discountPercentage: -1 }) : [];
    const highestProductDiscount = productOffers.length > 0 ? productOffers[0].discountPercentage : 0;
    const highestCategoryDiscount = categoryOffers.length > 0 ? categoryOffers[0].discountPercentage : 0;
    return Math.max(highestProductDiscount, highestCategoryDiscount);
};

const updateCartPrices = async (productId, discountPercentage) => {
    const carts = await Cart.find({ productId });
    for (const cart of carts) {
        cart.productDiscPrice = Math.floor(cart.productPrice - (cart.productPrice * (discountPercentage / 100)));
        cart.cartPrice = cart.productDiscPrice * cart.productQuantity;
        await cart.save();
    }
};

const deleteOffer = async (req, res) => {
    try {
        const offerId = req.params.id;
        const deletedOffer = await Offer.findByIdAndDelete(offerId);
        if (!deletedOffer) {
            return res.status(404).json({ success: false, message: 'Offer not found' });
        }
        const { productId, categoryId, brandId } = deletedOffer;
        let highestOffer = { discountPercentage: 0 };
        if (productId) {
            const productOffers = await Offer.find({ productId, isActive: true });
            if (productOffers.length > 0) {
                highestOffer = productOffers.reduce((prev, curr) => (prev.discountPercentage > curr.discountPercentage ? prev : curr), highestOffer);
            } else if (categoryId) {
                const categoryOffers = await Offer.find({ categoryId, isActive: true });
                if (categoryOffers.length > 0) {
                    highestOffer = categoryOffers.reduce((prev, curr) => (prev.discountPercentage > curr.discountPercentage ? prev : curr), highestOffer);
                }
            } else {
                const product = await Product.findById(productId);
                if (product) {
                    const productCategoryId = product.productCategory;
                    const categoryOffers = await Offer.find({ categoryId: productCategoryId, isActive: true });
                    if (categoryOffers.length > 0) {
                        highestOffer = categoryOffers.reduce((prev, curr) => (prev.discountPercentage > curr.discountPercentage ? prev : curr), highestOffer);
                    }
                } else {
                    return res.status(404).json({ success: false, message: 'Product not found' });
                }
            }
            await updateProductAndCartPrices(productId, highestOffer.discountPercentage || 5, !highestOffer.discountPercentage);
        }
        if (categoryId) {
            const products = await Product.find({ productCategory: categoryId });
            for (const product of products) {
                const productOffers = await Offer.find({ productId: product._id, isActive: true });
                if (productOffers.length === 0) {
                    const categoryOffers = await Offer.find({ categoryId, isActive: true });
                    highestOffer = { discountPercentage: 0 };
                    if (categoryOffers.length > 0) {
                        highestOffer = categoryOffers.reduce((prev, curr) => (prev.discountPercentage > curr.discountPercentage ? prev : curr), highestOffer);
                    }
                    await updateProductAndCartPrices(product._id, highestOffer.discountPercentage || 5, !highestOffer.discountPercentage);
                }
            }
        }
        if (brandId) {
            const brandOffers = await Offer.find({ brandId, isActive: true });
            if (brandOffers.length > 0) {
                highestOffer = brandOffers.reduce((prev, curr) => (prev.discountPercentage > curr.discountPercentage ? prev : curr), highestOffer);
            }
        }
        res.status(200).json({ success: true, message: 'Offer deleted successfully' });
    } catch (error) {
        console.error('Error deleting offer:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

const updateProductAndCartPrices = async (productId, discountPercentage, isFlatDiscount = false) => {
    const product = await Product.findById(productId);
    product.variants.forEach(variant => {
        const discount = isFlatDiscount ? 5 : discountPercentage;
        variant.discountPrice = Math.floor(variant.price * (1 - discount / 100));
    });
    await product.save();

    const carts = await Cart.find({ productId });
    for (const cart of carts) {
        const discount = isFlatDiscount ? 5 : discountPercentage;
        cart.productDiscPrice = Math.floor(cart.productPrice * (1 - discount / 100));
        cart.cartPrice = cart.productDiscPrice * cart.productQuantity;
        await cart.save();
    }
};

const logoutAdmin = async (req, res) => {
    try {
        req.session.destroy();
        res.redirect('/admin/login');
    } catch (error) {
        res.send(error);
    }
};

module.exports = {
    loadLogin,
    verifyAdmin,
    loadUser,
    blockUser,
    unblockUser,
    loadOrder,
    changeStatusOrder,
    loadOrderDetail,
    getReturnedOrder,
    loadCoupon,
    insertCoupon,
    updateCoupon,
    deleteCoupon,
    loadOffer,
    insertOffer,
    updateOffer,
    deleteOffer,
    logoutAdmin
};