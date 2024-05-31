const User = require('../model/userModel');

const isLogin = async (req,res,next) => {
    try{
        if(req.session.user_id){
            return next();
        }else{
            return res.redirect('/login');
        }
    }catch(error){
        res.send(error.message);
    }
}

const isLogout = async (req,res,next) => {
    try{
        if(req.session.user_id){
           return res.redirect('/');
        }
        return next();
    }catch(error){
        res.send(error.message);
    }
};

const authMiddleware = async (req, res, next) => {
    try {
        if (req.session && req.session.user_id) {
            const user = await User.findById(req.session.user_id);
            if (user) {
                res.locals.isAuthenticated = true;
                res.locals.user = user;
            } else {
                res.locals.isAuthenticated = false;
                res.locals.user = null;
            }
        } else {
            res.locals.isAuthenticated = false;
            res.locals.user = null;
        }
        next();
    } catch (error) {
        res.send(error.message);
    }
};

const checkUserStatus = async (req, res, next) => {
    if (req.session.user_id) {
        try {
            const user = await User.findById(req.session.user_id);
            if (user && user.is_blocked) {
                req.session.destroy((err) => {
                    if (err) {
                        console.error('Error destroying session:', err);
                    }
                    return res.redirect('/login');
                });
            } else {
                next();
            }
        } catch (error) {
            console.error('Error checking user status:', error);
            next(error);
        }
    } else {
        next();
    }
};


module.exports = {
    isLogin,
    isLogout,
    authMiddleware,
    checkUserStatus
}