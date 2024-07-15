const User = require('../model/userModel');
const Address = require('../model/addressModel');
const Product = require('../model/productModel');
const Order = require('../model/orderModel');
const Cart = require('../model/cartModel');
const Coupon = require('../model/couponModel');
const Wallet = require('../model/walletModel');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const razorpayInstance = new Razorpay({
    key_id: process.env.key_id,
    key_secret: process.env.key_secret,
});

const loadOrder = async (req, res) => {
    try {
        const userId = req.session.user_id;
        const user = await User.findById(userId);
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const orders = await Order.find({customer_id  : user._id })
        .populate('items.product_id')
        .populate('address_id')
        .populate('items.product_id')
        .populate('customer_id')
        .sort({ orderDate: -1 })
        .skip((page - 1) * limit)
        .limit(limit).exec();
        const totalOrders = await Order.countDocuments();
        res.render('orders', {
            orders: orders,
            currentPage: page,
            totalPages: Math.ceil(totalOrders / limit),
            limit: limit
        });
    } catch (error) {
        res.send(error);
    }
};

const continuePay = async (req, res) => {
    try {
        const { orderId } = req.body;
        
        // Log request body for debugging
        console.log('Request body:', req.body);

        const order = await Order.findById(orderId);
        if (!order) {
            console.log('Order not found');
            return res.status(400).json({ error: 'Order not found' });
        }

        // Calculate total amount excluding canceled items
        const totalAmount = order.items.reduce((acc, item) => {
            if (item.orderStatus !== 'Canceled') {
                return acc + item.productDiscPrice * item.quantity;
            }
            return acc;
        }, 0);

        if (totalAmount <= 0) {
            console.log('Invalid total amount');
            return res.status(400).json({ error: 'Invalid total amount' });
        }

        const options = {
            amount: totalAmount * 100,
            currency: "INR",
            receipt: `receipt_${order.orderID}`,
            payment_capture: '1'
        };
        const razorpayOrder = await razorpayInstance.orders.create(options);
        order.razorpayOrderId = razorpayOrder.id;
        await order.save();
        res.status(200).json({
            key: process.env.key_id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            razorpayOrderId: razorpayOrder.id
        });
    } catch (error) {
        console.error('Error while continuing payment:', error);
        res.status(500).json({ error: error.message });
    }
};

const verifyContinuePayment = async (req, res) => {
    const { orderCreationId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;
    try {
        const shasum = crypto.createHmac('sha256', process.env.key_secret);
        shasum.update(`${orderCreationId}|${razorpayPaymentId}`);
        const digest = shasum.digest('hex');
        if (digest !== razorpaySignature) {
            return res.status(400).json({ error: 'Invalid signature' });
        }
        const order = await Order.findOne({ razorpayOrderId: razorpayOrderId });
        if (!order) {
            return res.status(400).json({ error: 'Order not found' });
        }
        if (order.paymentStatus === 'Paid') {
            return res.status(200).json({ message: 'Payment already verified' });
        }
        order.paymentStatus = 'Paid';
        await order.save();
        res.status(200).json({ message: 'Payment verified successfully', order });
    } catch (error) {
        console.error('Error while verifying payment:', error);
        res.status(500).json({ error: error.message });
    }
};


const loadOrderDetail = async (req, res) => {
    try {
        const orderId = req.query.id;
        const order = await Order.findById(orderId).populate('items.product_id').populate('address_id').exec();
        if (!order) {
            return res.status(404).send('Order not found');
        }
        const user = await User.findById(req.session.user_id);
        const allDelivered = order.items.every(item => item.orderStatus === 'Delivered');
        res.render('order_details', { order, user, allDelivered });
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
        if (order.paymentMethod === 'RazorPay' || order.paymentMethod === 'wallet' && order.paymentStatus === 'Paid') {
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
        const coupons = await Coupon.find();
        const address = await Address.find({ user_id: id });
        const wallet = await Wallet.findOne({ user : id});
        const cart = await Cart.find({ userId: id });
        if(cart.length === 0){
            res.redirect('/cart');
        }else{
            res.render('checkout', { addresses: address, cart: cart, coupons : coupons, wallet : wallet });
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
            res.json({ success: true, message : "Address added" , newAddress: addressData });
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
        if (subtotal < coupon.minPurchase) {
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
        const newOrderData = {
            customer_id: userId,
            address_id: selectedAddress._id,
            items: orderItems,
            orderDate: new Date(),
            paymentMethod: paymentOption,
            orderID: uniqueOrderID
        };
        if (code) {
            newOrderData.couponCode = code;
        }
        let savedOrder;
        const totalAmount = orderItems.reduce((acc, item) => acc + item.productDiscPrice * item.quantity, 0);
        if (paymentOption === 'RazorPay') {
            const options = {
                amount: totalAmount * 100,
                currency: "INR",
                receipt: `receipt_${uniqueOrderID}`,
                payment_capture: '1'
            };
            const razorpayOrder = await razorpayInstance.orders.create(options);
            newOrderData.razorpayOrderId = razorpayOrder.id;
            
            return res.status(201).json({
                message: 'Razorpay order created',
                orderData: newOrderData,
                razorpayOrderId: razorpayOrder.id,
                amount: razorpayOrder.amount,
                orderID: uniqueOrderID
            });
        } else if (paymentOption === 'wallet') {
            const wallet = await Wallet.findOne({ user: userId });
            if (wallet.balance >= totalAmount) {
                wallet.balance -= totalAmount;
                wallet.transactions.push({
                    description: 'Order placed',
                    amount: -totalAmount,
                    balance: wallet.balance
                });
                await wallet.save();
                const newOrder = new Order(newOrderData);
                newOrder.paymentStatus = 'Paid';
                savedOrder = await newOrder.save();
                await handleOrderProcessing(orderItems, code, userId);
                return res.status(201).json({
                    message: 'Order placed successfully using wallet balance',
                    order: savedOrder
                });
            } else {
                return res.status(400).json({ error: 'Insufficient wallet balance' });
            }
        }
        const newOrder = new Order(newOrderData);
        savedOrder = await newOrder.save();
        await handleOrderProcessing(orderItems, code, userId);
        res.status(201).json({ message: 'Order placed successfully', order: savedOrder });
    } catch (error) {
        console.error('Error while processing order:', error);
        res.status(500).json({ error: error.message });
    }
};

const balanceCheck = async (req, res) => {
    try {
        const { finalPrice } = req.body;
        const userId = req.session.user_id;
        const wallet = await Wallet.findOne({ user: userId });

        if (wallet.balance >= finalPrice) {
            res.json({ sufficient: true });
        } else {
            res.json({ sufficient: false });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to check wallet balance' });
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
    const { orderCreationId, razorpayPaymentId, razorpayOrderId, razorpaySignature, orderData } = req.body;
    const shasum = crypto.createHmac('sha256', process.env.key_secret);
    shasum.update(`${orderCreationId}|${razorpayPaymentId}`);
    const digest = shasum.digest('hex');
    if (digest === razorpaySignature) {
        const existingOrder = await Order.findOne({ razorpayOrderId: razorpayOrderId });
        if (existingOrder) {
            return res.status(200).json({ message: 'Payment already verified' });
        }
        const newOrder = new Order(orderData);
        newOrder.paymentStatus = 'Paid';
        const savedOrder = await newOrder.save();
        const userId = req.session.user_id;
        await handleOrderProcessing(orderData.items, orderData.couponCode, userId);
        res.status(200).json({ message: 'Payment verified successfully', order: savedOrder });
    } else {
        res.status(400).json({ error: 'Invalid signature' });
    }
};

const handleFailedPayment = async (req, res) => {
    try {
        const { orderData } = req.body;
        const existingOrder = await Order.findOne({ orderID: orderData.orderID });
        if (!existingOrder) {
            const newOrder = new Order(orderData);
            newOrder.paymentStatus = 'Pending';
            const savedOrder = await newOrder.save();
            await handleOrderProcessing(orderData.items, orderData.couponCode, orderData.customer_id);
            return res.status(200).json({ message: 'Order placed with pending payment status', order: savedOrder });
        }
        existingOrder.paymentStatus = 'Pending';
        await existingOrder.save();
        await handleOrderProcessing(existingOrder.items, existingOrder.couponCode, existingOrder.customer_id);
        res.status(200).json({ message: 'Order updated with pending payment status' });
    } catch (error) {
        console.error('Error while handling failed payment:', error);
        res.status(500).json({ error: error.message });
    }
};

const getInvoice = async (req, res) => {
    try {
        const orderId = req.query.id;
        const order = await Order.findById(orderId).populate('customer_id').populate('items.product_id');
        if (!order) {
            return res.status(404).send('Order not found');
        }
        const invoicePath = generateInvoice(order);
        res.download(invoicePath, `invoice-${order.orderID}.pdf`, (err) => {
            if (err) {
                console.error('Error downloading invoice:', err);
                res.status(500).send('Error generating invoice');
            }
        });
    } catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).send('Error fetching order');
    }
};

const generateInvoice = (order) => {
    const doc = new PDFDocument({ margin: 50 });
    const fileName = `invoice-${order.orderID}.pdf`;
    const filePath = path.join(__dirname, '..', 'public', 'invoices', fileName);
    doc.pipe(fs.createWriteStream(filePath));
    // Header
    doc.fontSize(25).text('Invoice', { align: 'center' }).moveDown(1.5);
    // Order Info
    doc.fontSize(16).text(`Order ID: ${order.orderID}`, { align: 'left' });
    doc.text(`Customer Name: ${order.customer_id.customerName}`, { align: 'left' });
    doc.text(`Order Date: ${new Date(order.orderDate).toLocaleDateString()}`, { align: 'left' });
    doc.moveDown();
    // Table Header
    const tableTop = doc.y;
    const itemX = 50;
    const quantityX = 150;
    const unitPriceX = 250;
    const totalX = 350;
    const deliveryDateX = 450;
    doc.fontSize(12);
    doc.text('Item', itemX, tableTop, { width: 100 });
    doc.text('Qty', quantityX, tableTop, { width: 100, align: 'right' });
    doc.text('Unit Price', unitPriceX, tableTop, { width: 100, align: 'right' });
    doc.text('Total', totalX, tableTop, { width: 100, align: 'right' });
    doc.text('Delivery Date', deliveryDateX, tableTop, { width: 100, align: 'right' });
    doc.moveDown();
    // Divider line
    doc.moveTo(itemX, doc.y).lineTo(deliveryDateX + 100, doc.y).stroke();
    doc.moveDown();
    // Table Rows
    order.items.forEach((item) => {
        const rowY = doc.y;
        doc.text(item.product_id.productName, itemX, rowY, { width: 100 });
        doc.text(item.quantity, quantityX, rowY, { width: 100, align: 'right' });
        doc.text(item.productPrice.toFixed(2), unitPriceX, rowY, { width: 100, align: 'right' });
        doc.text((item.quantity * item.productPrice).toFixed(2), totalX, rowY, { width: 100, align: 'right' });
        doc.text(new Date(item.deliveryDate).toLocaleDateString(), deliveryDateX, rowY, { width: 100, align: 'right' });
        doc.moveDown();
    });
    // Divider line before total
    doc.moveTo(itemX, doc.y).lineTo(deliveryDateX + 100, doc.y).stroke();
    doc.moveDown(0.5);
    // Total
    const total = order.items.reduce((sum, item) => sum + (item.quantity * item.productPrice), 0);
    doc.fontSize(16).text(`Total: ${total.toFixed(2)}`, 450, doc.y);
    doc.end();
    return filePath;
};

module.exports = {
    loadOrder,
    continuePay,
    verifyContinuePayment,
    loadOrderDetail,
    cancelOrder,
    returnOrder,
    loadCoupon,
    applyCoupon,
    removeCoupon,
    loadCheckout,
    checkoutAddAdress,
    addCheckout,
    balanceCheck,
    RazorPayKey,
    verifyRazorpayPayment,
    handleFailedPayment,
    getInvoice
};