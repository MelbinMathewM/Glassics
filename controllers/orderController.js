const User = require('../model/userModel');
const Address = require('../model/addressModel');
const Product = require('../model/productModel');
const Order = require('../model/orderModel');
const Cart = require('../model/cartModel');
const Coupon = require('../model/couponModel');
const Wallet = require('../model/walletModel');
const Razorpay = require('razorpay');
const crypto = require('crypto');

const razorpayInstance = new Razorpay({
    key_id: process.env.key_id,
    key_secret: process.env.key_secret,
});

const loadOrder = async (req,res) => {
    try{
        const userId = req.session.user_id;
        const user = await User.findById(userId)
        const orders = await Order.find({customer_id  : userId }).populate('items.product_id').exec();
        res.render('orders',{ orders, user});
    }catch(error){
        res.send(error);
    }
};

const loadOrderDetail = async (req, res) => {
    try {
        const orderId = req.query.id;
        const order = await Order.findById(orderId).populate('items.product_id').populate('address_id').exec();
        const user = await User.findById(req.session.user_id);
        
        res.render('order_details', { order, user });
    } catch (error) {
        res.status(500).json({ error: 'An error occurred while loading the order details' });
    }
};

const cancelOrder = async (req, res) => {
    try {
        const { itemId } = req.body;
        const order = await Order.findOne({ 'items._id': itemId });
        if (!order) {
            return res.json({ success: false, message: 'Order not found.' });
        }
        const item = order.items.id(itemId);
        if (!item) {
            return res.json({ success: false, message: 'Item not found.' });
        }
        const product = await Product.findById(item.product_id);
        if (!product) {
            return res.json({ success: false, message: 'Product not found.' });
        }
        const variant = product.variants.find(v => v.color === item.productColor);
        if (!variant) {
            return res.status(400).json({ error: `Variant with color ${item.productColor} not found for product ${product.productName}`});
        }
        const subvariant = variant.subVariants.find(s => s.size === item.productSize);
        if(!subvariant){
            return res.status(400).json({ error: `Subvariant with size ${item.productSize} not found for product ${product.productName}`});
        }
        subvariant.quantity += item.quantity;
        await product.save();
        if (order.paymentMethod === 'RazorPay') {
            const refundAmount = item.productDiscPrice * item.quantity;

            const wallet = await Wallet.findOne({user : order.customer_id });
            if (!wallet) {
                return res.json({ success: false, message: 'User not found.' });
            }

            wallet.balance += refundAmount;
            wallet.transactions.push({
                description: 'Order canceled',
                amount: refundAmount,
                balance: wallet.balance
            });
            await wallet.save();
        }
        item.orderStatus = 'Canceled';
        await order.save();
        res.json({ success: true, message: 'Order canceled successfully.' });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: 'Failed to cancel the order.' });
    }
};

const returnOrder = async (req, res) => {
    const { orderId, reason, itemId } = req.body;
    try {
        const order = await Order.findById(orderId);
        if (!order) {
            return res.json({ success: false, message: 'Order not found' });
        }
        const item = order.items.id(itemId);
        if (!item) {
            return res.json({ success: false, message: 'Item not found' });
        }
        item.orderStatus = 'Return requested';
        item.returnReason = reason;
        await order.save();
        res.json({ success: true, message: 'Order returned successfully' });
    } catch (error) {
        console.error('Error returning order:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const loadCoupon = async (req,res) => {
    try{
        const coupons = await Coupon.find();
        res.render('coupons',{coupons : coupons});
    }catch(error){
        res.send(error);
    }
};

const loadCheckout = async (req, res) => {
    try {
        const id = req.session.user_id;
        const address = await Address.find({ user_id: id });
        const cart = await Cart.find({ userId: id });
        if(cart.length === 0){
            res.redirect('/cart');
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
            addressMobile : newAddress.addressMobile,
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
            res.status(201).json({ success: true, newAddress: addressData });
        }
    }catch(error){
        res.json({ success: false, message: 'Error adding address', error });
    }
};

const generateUniqueOrderID = async () => {
    let orderID;
    let existingOrder;
    do {
        orderID = Math.floor(1000000000 + Math.random() * 9000000000).toString();
        existingOrder = await Order.findOne({ orderID });
    } while (existingOrder);
    return orderID;
};

const applyCoupon = async (req, res) => {
    try {
        const { code } = req.body;
        const userId = req.session.user_id;
        const cart = await Cart.find({ userId: userId });
        if (!cart) {
            return res.json({ success: false, message: 'Cart is empty' });
        }
        const coupon = await Coupon.findOne({ code: new RegExp('^' + code + '$', 'i') });
        if (!coupon) {
            return res.json({ success: false, message: 'Invalid coupon code' });
        }
        if (coupon.usedCount >= coupon.usageLimit) {
            return res.json({ success: false, message: 'Coupon usage limit reached' });
        }
        if (new Date() > coupon.expirationDate) {
            return res.json({ success: false, message: 'Coupon expired' });
        }
        const subtotal = cart.reduce((acc, item) => acc + (item.productPrice * item.productQuantity), 0);
        if (cart.subtotal < coupon.minPurchase) {
            return res.json({ success: false, message: 'Minimum purchase not met' });
        }
         let discountAmount = 0;
        cart.forEach(item => {
            const itemDiscount = Math.ceil((coupon.discount / 100) * item.productPrice);
            discountAmount += itemDiscount * item.productQuantity;
        });
        let offerDiscount = cart.reduce((acc, item) => {
            return acc + ((item.productPrice - item.productDiscPrice) * item.productQuantity);
        }, 0);
        const total = subtotal - discountAmount - offerDiscount;
        await coupon.save();
        await Promise.all(cart.map(async item => {
            item.discount = Math.ceil((coupon.discount / 100) * item.productPrice) * item.productQuantity;
            await item.save();
        }));
        res.json({ success: true, discount: discountAmount, percentage : coupon.discount, total: total });
    } catch (error) {
        console.error('Error applying coupon:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const removeCoupon = async (req, res) => {
    try {
        const userId = req.session.user_id;
        const cartItems = await Cart.find({ userId: userId });
        if (!cartItems.length) {
            return res.json({ success: false, message: 'Cart is empty' });
        }
        await Promise.all(cartItems.map(async (item) => {
            item.discount = 0;
            await item.save();
        }));
        const subtotal = cartItems.reduce((acc, item) => acc + (item.productPrice * item.productQuantity), 0);
        const offerDiscount = cartItems.reduce((acc, item) => {
            return acc + ((item.productPrice - item.productDiscPrice) * item.productQuantity);
        }, 0);
        const total = subtotal - offerDiscount;
        console.log(offerDiscount);
        res.json({ success: true, subtotal, offerDiscount, total });
    } catch (error) {
        console.error('Error removing coupon:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const addCheckout = async (req, res) => {
    try {
        const { addressDetails, paymentOption, discountPercentage, code } = req.body;
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
        const orderItems = cart.map(item => {
            const productPrice = item.productPrice;
            const discountedPrice = Math.floor(item.productPrice - ((item.productPrice - item.productDiscPrice) + (item.productPrice * discountPercentage / 100)));
            const offerDiscount = item.productPrice - item.productDiscPrice;
            const couponDiscount = Math.floor(item.productPrice * discountPercentage / 100);
            return {
                product_id: item.productId,
                productImage: item.productImage,
                productColor: item.productColor,
                productPrice: productPrice,
                productDiscPrice: discountedPrice,
                offerDiscount: offerDiscount,
                couponDiscount: couponDiscount,
                productSize: item.productSize,
                quantity: item.productQuantity,
                deliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
                orderStatus: 'Pending',
                paymentStatus: 'Pending'
            };
        });
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
        const totalAmount = orderItems.reduce((acc, item) => acc + item.productDiscPrice * item.quantity, 0);
        if (paymentOption === 'RazorPay') {
            const options = {
                amount: totalAmount * 100,
                currency: "INR",
                receipt: `receipt_${uniqueOrderID}`,
                payment_capture: '1'
            };
            const razorpayOrder = await razorpayInstance.orders.create(options);
            return res.status(201).json({
                message: 'Razorpay order created',
                order: savedOrder,
                razorpayOrderId: razorpayOrder.id,
                amount: razorpayOrder.amount
            });
        }
        await handleOrderProcessing(orderItems, code, userId);
        res.status(201).json({ message: 'Order placed successfully', order: savedOrder });
    } catch (error) {
        console.error('Error while processing order:', error);
        res.status(500).json({ error: error.message });
    }
};

const RazorPayKey = (req, res) => {
    res.status(200).json({ key: process.env.key_id });
};

const handleOrderProcessing = async (orderItems, code, userId) => {
    try {
        for (const item of orderItems) {
            const product = await Product.findById(item.product_id);
            if (!product) {
                throw new Error(`Product not found`);
            }
            const variant = product.variants.find(v => v.color === item.productColor);
            if (!variant) {
                throw new Error(`Variant with color ${item.productColor} not found for product ${product.productName}`);
            }
            const subvariant = variant.subVariants.find(s => s.size === item.productSize);
            if (!subvariant) {
                throw new Error(`Subvariant with size ${item.productSize} not found for product ${product.productName}`);
            }
            if (subvariant.quantity === 0) {
                throw new Error(`Product is out of stock for the size ${item.productSize}`);
            } else if (subvariant.quantity < item.quantity) {
                throw new Error(`Only ${subvariant.quantity} stock for the size ${item.productSize}`);
            }
            subvariant.quantity -= item.quantity;
            await product.save();
            await Product.findByIdAndUpdate(item.product_id, { $inc: { orderCount: item.quantity } });
        }
        await Cart.deleteMany({ userId: userId });
        if (code) {
            const couponData = await Coupon.findOne({ code: code });
            if (couponData) {
                await Coupon.findOneAndUpdate(
                    { _id: couponData._id },
                    { $inc: { usedCount: 1 } }
                );
            }
        }
    } catch (error) {
        throw error;
    }
};

const verifyRazorpayPayment = async (req, res) => {
    const { orderCreationId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;

    const shasum = crypto.createHmac('sha256', process.env.key_secret);
    shasum.update(`${orderCreationId}|${razorpayPaymentId}`);
    const digest = shasum.digest('hex');

    if (digest === razorpaySignature) {
        await Order.findOneAndUpdate(
            { orderID: razorpayOrderId },
            { paymentStatus: 'Paid' }
        );
        res.status(200).json({ message: 'Payment verified successfully' });
    } else {
        res.status(400).json({ error: 'Invalid signature' });
    }
};

module.exports = {
    loadOrder,
    loadOrderDetail,
    cancelOrder,
    returnOrder,
    loadCoupon,
    applyCoupon,
    removeCoupon,
    loadCheckout,
    checkoutAddAdress,
    addCheckout,
    RazorPayKey,
    verifyRazorpayPayment
};