const User = require('../model/userModel');
const Address = require('../model/addressModel');
const Product = require('../model/productModel');
const Order = require('../model/orderModel');

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

        item.orderStatus = 'Canceled';
        await order.save();

        res.json({ success: true, message: 'Order canceled successfully.' });
    } catch (error) {
        console.error(error);
        res.json({ success: false, message: 'Failed to cancel the order.' });
    }
};

module.exports = {
    loadOrder,
    loadOrderDetail,
    cancelOrder
}