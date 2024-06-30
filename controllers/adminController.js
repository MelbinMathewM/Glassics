const Admin = require('../model/adminModel');
const User = require('../model/userModel');
const Order = require('../model/orderModel');
const Product = require('../model/productModel');
const Category = require('../model/categoryModel');
const Coupon = require('../model/couponModel');
const Offer = require('../model/offerModel');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

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
                res.redirect('/admin/dashboard');
            } else {
                res.render('login', { message: "Incorrect Password" });
            }
        } else {
            res.render('login', { message: "User not found" });
        }
    } catch (error) {
        res.send(error);
    }
};

const loadUser = async (req, res) => {
    try {
        const users = await User.find();
        const defaultImage = '/static/userImages/default.jpg';
        const profileImage = users.userImage ? `/static/userImages/${users.userImage}` : defaultImage;
        res.render('users', { users: users, profileImage: profileImage });
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
        const orders = await Order.find().populate('address_id').populate('items.product_id').populate('customer_id');
        res.render('orders', { orders: orders })
    } catch (error) {
        res.send(error);
    }
};

const loadOrderDetail = async (req, res) => {
    try {
        const orderId = req.query.id;
        const order = await Order.findById(orderId).populate('address_id').populate('items.product_id').populate('customer_id');
        res.render('order_details', { order: order });
    } catch (error) {
        res.send(error);
    }
};

const changeStatusOrder = async (req, res) => {
    try {
        const { itemId, newStatus } = req.body;
        const validStatuses = ['Pending', 'Processing', 'Dispatched', 'Delivered', 'Canceled','Returned','Return requested'];
        if (!validStatuses.includes(newStatus)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }
        const order = await Order.findOne({ 'items._id': itemId });
        if (!order) {
            return res.json({ success: false, message: 'Could not find order' });
        }
        const item = order.items.id(itemId);
        if (!item) {
            return res.json({ success: false, message: 'Could not find item' });
        }
        if (newStatus === 'Canceled' || newStatus === 'Returned') {
            const product = await Product.findById(item.product_id);
            if (!product) {
                return res.json({ success: false, message: 'Could not find product' });
            }
            const variant = product.variants.find(v => v.color === item.productColor);
            if (!variant) {
                return res.json({ success: false, message: 'Could not find variant' });
            }
            const subvariant = variant.subVariants.find(s => s.size === item.productSize);
            if (!subvariant) {
                return res.json({ success: false, message: 'Could not find subvariant' });
            }
            subvariant.quantity += item.quantity;
            await product.save();
        }
        item.orderStatus = newStatus;
        await order.save();
        res.json({ success: true, message: 'Order status updated successfully.', newStatus });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update the order status.' });
    }
};

const loadCoupon = async (req, res) => {
    try {
        const coupons = await Coupon.find();
        res.render('coupons', { coupons: coupons });
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
        const offers = await Offer.find();
        const products = await Product.find();
        const categories = await Category.find();
        res.render('offers', { offers: offers, products: products, categories: categories });
    } catch (error) {
        res.send(error);
    }
};

const loadAddOffer = async (req, res) => {
    try {
        const products = await Product.find();
        const categories = await Category.find();
        res.render('add_offers', { products: products, categories: categories });
    } catch (error) {
        res.send(error);
    }
};

const insertOffer = async (req, res) => {
    try {
        const { offerName, offerDescription, discountPercentage, offerType, typeName, productId, categoryId, isActive, expiryDate } = req.body;

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
        const offer = new Offer({
            offerName,
            offerDescription,
            discountPercentage,
            offerType,
            typeName,
            productId: product ? product._id : undefined,
            categoryId: category ? category._id : undefined,
            isActive: !!isActive,
            expiryDate: new Date(expiryDate)
        });
        const offerData = await offer.save();
        if (offerType === 'productOffer' && product) {
            product.variants.forEach(variant => {
                const currentDiscountPrice = variant.discountPrice || variant.price;
                const newDiscountPrice = Math.floor(variant.price - (variant.price * (discountPercentage / 100)));
                variant.discountPrice = newDiscountPrice < currentDiscountPrice ? newDiscountPrice : currentDiscountPrice;
            });
            await product.save();
        } else if (offerType === 'categoryOffer' && category) {
            const products = await Product.find({ productCategory: category._id });
            products.forEach(async product => {
                product.variants.forEach(variant => {
                    const currentDiscountPrice = variant.discountPrice || variant.price;
                    const newDiscountPrice = Math.floor(variant.price - (variant.price * (discountPercentage / 100)));
                    variant.discountPrice = newDiscountPrice < currentDiscountPrice ? newDiscountPrice : currentDiscountPrice;
                });
                await product.save();
            });
        }
        if (offerData) {
            res.redirect('/admin/offers');
        } else {
            res.status(500).json({ success: false, message: 'Offer creation unsuccessful' });
        }
    } catch (error) {
        res.status(500).send({ success: false, message: 'Server error' });
    }
};

const updateOffer = async (req, res) => {
    try {
        const offerId = req.params.id;
        const { offerName, offerDescription, discountPercentage, offerType, typeName, productId, categoryId, isActive, expiryDate } = req.body;
        console.log(discountPercentage);
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
                offerName : offerName,
                offerDescription : offerDescription,
                discountPercentage : discountPercentage,
                offerType : offerType,
                typeName : typeName,
                productId: product ? product._id : undefined,
                categoryId: category ? category._id : undefined,
                isActive: !!isActive,
                expiryDate: new Date(expiryDate)
            },
            { new: true }
        );
        console.log(updatedOffer);
        if (updatedOffer) {
            if (offerType === 'productOffer' && product) {
                const productOffers = await Offer.find({ productId: product._id, isActive: true }).sort({ discountPercentage: -1 });
                const highestProductDiscount = productOffers.length > 0 ? productOffers[0].discountPercentage : 0;
                product.variants.forEach(variant => {
                    variant.discountPrice = Math.floor(variant.price - (variant.price * (highestProductDiscount / 100)));
                });
                await product.save();
            } else if (offerType === 'categoryOffer' && category) {
                const categoryOffers = await Offer.find({ categoryId: category._id, isActive: true }).sort({ discountPercentage: -1 });
                const highestCategoryDiscount = categoryOffers.length > 0 ? categoryOffers[0].discountPercentage : 0;
                const products = await Product.find({ productCategory: category._id });
                products.forEach(async product => {
                    const productOffers = await Offer.find({ productId: product._id, isActive: true }).sort({ discountPercentage: -1 });
                    const highestProductDiscount = productOffers.length > 0 ? productOffers[0].discountPercentage : 0;
                    const highestDiscount = Math.max(highestCategoryDiscount, highestProductDiscount);
                    product.variants.forEach(variant => {
                        variant.discountPrice = Math.floor(variant.price - (variant.price * (highestDiscount / 100)));
                    });
                    await product.save();
                });
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

const deleteOffer = async (req, res) => {
    try {
        const offerId = req.params.id;
        const deletedOffer = await Offer.findByIdAndDelete(offerId);
        if (deletedOffer) {
            res.status(200).json({ success: true, message: 'Offer deleted successfully' });
        } else {
            res.status(404).json({ success: false, message: 'Offer not found' });
        }
    } catch (error) {
        console.error('Error deleting offer:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

const logoutAdmin = async (req, res) => {
    try {
        req.session.destroy();
        res.redirect('/login');
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
    loadCoupon,
    insertCoupon,
    updateCoupon,
    deleteCoupon,
    loadOffer,
    loadAddOffer,
    insertOffer,
    updateOffer,
    deleteOffer,
    logoutAdmin
};