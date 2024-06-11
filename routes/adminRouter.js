const express = require('express');
const a_route = express();
const session = require('express-session');
const nocache = require('nocache');
const config = require('../config/config');
const adminController = require('../controllers/adminController');
const productController = require('../controllers/productController');
const adminAuth = require('../middleWare/adminAuth');
const { cpUpload } = require('../multer/productMulter');

//session handling
a_route.use(session({
    secret : config.sessionSecret,
    resave : false,
    saveUninitialized : false,
    cookie: {
        path: '/admin',
        _expires: 86400000,
        httpOnly: true
    }
}));


//set engines and views
a_route.set('view engine','ejs');
a_route.set('views','views/admin');
a_route.use(express.static('public'));

//use parcers
a_route.use(express.json());
a_route.use(express.urlencoded({extended : true}));

a_route.use(nocache());

const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../public/productImages'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({ storage : storage })

//login
a_route.get('/login',adminController.loadLogin);
a_route.post('/login',adminController.verifyAdmin);

//dashboard management
a_route.get('/dashboard',adminAuth.checkAdminSession,adminController.loadDashboard);

//product management
a_route.get('/products',adminAuth.checkAdminSession,productController.loadProducts);
a_route.get('/products/add_products',adminAuth.checkAdminSession,productController.loadAddProducts);
a_route.post('/products/add_products',cpUpload,productController.insertProduct);
a_route.get('/products/detail_products',adminAuth.checkAdminSession,productController.loadDetailProduct);
a_route.get('/products/edit_products',adminAuth.checkAdminSession,productController.loadEditProduct);
a_route.post('/products/edit_products',upload.any(),productController.updateProduct);
a_route.get('/products/delete_products',adminAuth.checkAdminSession,productController.deleteProduct);
a_route.get('/products/unlisted_products',adminAuth.checkAdminSession,productController.loadUnlistedProduct);
a_route.get('/products/reAdd_products',adminAuth.checkAdminSession,productController.reAddProduct);

//user management
a_route.get('/users',adminAuth.checkAdminSession,adminController.loadUser);
a_route.get('/users/block_user',adminAuth.checkAdminSession,adminController.blockUser);
a_route.get('/users/unblock_user',adminAuth.checkAdminSession,adminController.unblockUser);

//category management
a_route.get('/categories',adminAuth.checkAdminSession,productController.loadCategory);
a_route.post('/categories/add',productController.insertCategory);
a_route.post('/categories/edit',productController.updateCategory);
a_route.get('/categories/delete_categories',adminAuth.checkAdminSession,productController.deleteCategory);
a_route.get('/categories/unlisted_categories',adminAuth.checkAdminSession,productController.loadUnlistedCategory);
a_route.get('/categories/reAdd_categories',adminAuth.checkAdminSession,productController.reAddCategory);

//brand management
a_route.get('/brands',adminAuth.checkAdminSession,productController.loadBrand);
a_route.post('/brands/add',adminAuth.checkAdminSession,productController.insertBrand);
a_route.post('/brands/edit',productController.updateBrand);
a_route.get('/brands/delete_brands',adminAuth.checkAdminSession,productController.deleteBrand);
a_route.get('/brands/unlisted_brands',adminAuth.checkAdminSession,productController.loadUnlistedBrand);
a_route.get('/brands/reAdd_brands',adminAuth.checkAdminSession,productController.reAddBrand);

//logout
a_route.get('/logout',adminAuth.checkAdminSession,adminController.logoutAdmin);

module.exports = a_route;