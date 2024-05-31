//express require
const express = require('express');
const u_route = express();
const session = require('express-session');

//requires
const config = require('../config/config');
const userController = require('../controllers/userController');
const accountController = require('../controllers/accountController');
const loginController = require('../controllers/loginController');
const userAuth = require('../middleWare/userAuth');
const passport = require('passport');
const multer = require('multer');
const path = require('path');

//session handling
u_route.use(session({
    secret: config.sessionSecretos,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

u_route.use(userAuth.authMiddleware)

//googleAuth
u_route.use(passport.initialize());
u_route.use(passport.session());


//use parcers
u_route.use(express.json());
u_route.use(express.urlencoded({extended : true}));

//set engines and views
u_route.set('view engine','ejs');
u_route.set('views','./views/users');
u_route.use(express.static('public'));


//set multer for userImages
const storage = multer.diskStorage({
    destination : (req,file,cb) => {
        cb(null,path.join(__dirname,'../public/userImages'));
    },
    filename : (req,file,cb) => {
        const name = Date.now() + "-" + file.originalname;
        cb(null,name);
    }
});
const upload = multer({ storage : storage });

u_route.use(userAuth.checkUserStatus);

//routes

//main user routes
u_route.get('/',userAuth.authMiddleware,userController.loadHome);
u_route.get('/shop',userAuth.authMiddleware,userController.loadShop);
u_route.get('/product_details/:productId',userController.loadProductDetail);

//cart routes
u_route.get('/cart',userAuth.isLogin,userController.loadCart);
u_route.post('/add_cart',userController.insertCart);
u_route.post('/update_cart',userController.updateCart);

//wishlist routes
u_route.get('/account/wishlist',userAuth.isLogin,userController.loadWishlist);
u_route.post('/account/add_wishlist',userAuth.isLogin,userController.insertWishlist);

//register routes
u_route.get('/register',userAuth.isLogout,loginController.loadRegister);
u_route.post('/register',upload.single('userImage'),loginController.insertUser);

// //google auth
u_route.get('/auth/google/callback',passport.authenticate('google', { failureRedirect: '/login' }),loginController.googleSuccess);
u_route.get('/auth/google',passport.authenticate('google', { scope: ['profile', 'email'] }));

//otp routes
u_route.get('/otp_validation',userAuth.isLogout,loginController.loadOTP);
u_route.post('/otp_validation',loginController.verifyOTP);
u_route.post('/otp_resend',loginController.resendOTP);

//login routes
u_route.get('/login',userAuth.isLogout,loginController.loadLogin);
u_route.post('/login',loginController.verifyUser);

//profile routes
u_route.get('/account/:userName/profile',userAuth.isLogin,accountController.loadProfile);

//address routes
u_route.get('/account/:userName/address',userAuth.isLogin,accountController.loadAddress);
u_route.get('/account/:userName/address/add_address',userAuth.isLogin,accountController.loadAddAddress);
u_route.post('/account/:userName/address/add_address',accountController.insertAddress);
u_route.get('/account/:uerName/address/edit_address',userAuth.isLogin,accountController.loadEditAddress);
u_route.post('/account/:userName/address/edit_address',accountController.updateAddress);

//logout routes
u_route.get('/logout',userAuth.isLogin,loginController.logoutUser);

module.exports = u_route;
