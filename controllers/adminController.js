const Admin = require('../model/adminModel');
const User = require('../model/userModel');
const Order = require('../model/orderModel');
const Product = require('../model/productModel');
const bcrypt = require('bcrypt');

const securePassword = async ( req,res) => {
    try{
        hashPassword = await bcrypt.hash(password,10);
        return hashPassword;
    }catch(error){
        res.send(error);
    }
};
const loadLogin = async(req,res) => {
    try{
        res.render('login')
    }catch(error){
        res.send(error);
    }
};
const verifyAdmin = async (req,res) => {
    try{
        const adminName = req.body.adminName;
        const apassword = req.body.apassword;

        const adminData = await Admin.findOne({adminName : adminName});

        if(adminData){
            const passwordMatch = await bcrypt.compare(apassword,adminData.apassword);
            if(passwordMatch){
                req.session.admin_id = adminData._id;
                res.redirect('/admin/dashboard');
            }else{
                res.render('login',{message : "Incorrect Password"});
            }
        }else{
            res.render('login',{message : "User not found"});
        }

    }catch(error){
        res.send(error);
    }
};
const loadDashboard = async (req,res) => {
    try{
        res.render('dashboard');
    }catch(error){
        res.send(error);
    }
};

const loadUser = async (req,res) => {
    try{
        const users = await User.find();
        res.render('users', {users : users});
    }catch(error){
        res.send(error);
    }
};

const blockUser = async (req,res) => {
    try{
        const userId = req.query.id;
        const userData = await User.findByIdAndUpdate(userId,{is_blocked : 1});
        if(userData){
            res.status(200).json({ message: 'User blocked successfully' });
        }else{
            res.status(200).json({ message: "Couldn't block user" });
        }
    }catch(error){
        res.send(error);
    }
};

const unblockUser = async (req,res) => {
    try{
        const userId = req.query.id;
        const userData = await User.findByIdAndUpdate(userId,{is_blocked : 0});
        if(userData){
            res.status(200).json({ message: 'User unblocked successfully' });
        }else{
            res.status(200).json({ message: "Couldn't unblock user" });
        }
    }catch(error){
        res.send(error);
    }
};

const loadOrder = async (req,res) => {
    try{
        const orders = await Order.find().populate('address_id').populate('items.product_id').populate('customer_id');
        res.render('orders', { orders : orders})
    }catch(error){
        res.send(error);
    }
};

const loadOrderDetail = async (req,res) => {
    try{
        const orderId = req.query.id;
        const order = await Order.findById(orderId).populate('address_id').populate('items.product_id').populate('customer_id');
        res.render('order_details',{ order : order});
    }catch(error){
        res.send(error);
    }
};

const cancelOrder = async (req,res) => {
    try{
        const { itemId, newStatus } = req.body;

        const validStatuses = ['Pending', 'Processing', 'Dispatched', 'Delivered', 'Canceled'];

        // Check if the new status is valid
        if (!validStatuses.includes(newStatus)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        const order = await Order.findOne({'items._id' : itemId});
        if(!order){
            return res.json({ success : false , message : 'Could not find order' });
        }
        const item = order.items.id(itemId);
        if(!item){
            return res.json({ success : false, message : 'Could not find item'});
        }
         // If canceling the order, update product inventory
         if (newStatus === 'Canceled') {
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
    }catch(error){
        res.status(500).json({ success: false, message: 'Failed to update the order status.' });
    }
};

const logoutAdmin = async (req,res) => {
    try{
        req.session.destroy();
        res.redirect('/login');
    }catch(error){
        res.send(error);
    }
}


module.exports = {
    loadLogin,
    verifyAdmin,
    loadDashboard,
    loadUser,
    blockUser,
    unblockUser,
    loadOrder,
    cancelOrder,
    loadOrderDetail,
    logoutAdmin
}