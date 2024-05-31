const Admin = require('../model/adminModel');
const User = require('../model/userModel');
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
    logoutAdmin
}