const express = require('express');
const a_route = express();
const session = require('express-session');
const nocache = require('nocache');
const config = require('../config/config');
const adminController = require('../controllers/adminController');
const productController = require('../controllers/productController');
const dashboardController = require('../controllers/dashboardController');
const adminAuth = require('../middleWare/adminAuth');
const { cpUpload } = require('../multer/productMulter');

a_route.use(session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
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

const fs = require('fs');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../public/productImages/');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage : storage })

//login
a_route.get('/login',adminAuth.isLogout,adminController.loadLogin);
a_route.post('/login',adminController.verifyAdmin);

//dashboard management
a_route.get('/',adminAuth.isLogin,dashboardController.loadDashboard);
a_route.get('/dashboard',adminAuth.isLogin,dashboardController.loadDashboard);
a_route.get('/dashboard/sales_data',adminAuth.isLogin,dashboardController.loadSalesData);
a_route.get('/dashboard/weekly_data',adminAuth.isLogin,dashboardController.loadWeeklyData);
a_route.get('/dashboard/top_products',adminAuth.isLogin,dashboardController.getTopProducts);
a_route.get('/dashboard/top_categories',adminAuth.isLogin,dashboardController.getTopCategories);
a_route.get('/dashboard/top_brands',adminAuth.isLogin,dashboardController.getTopBrands);

//product management
a_route.get('/products',adminAuth.isLogin,productController.loadProducts);
a_route.get('/products/add_products',adminAuth.isLogin,productController.loadAddProducts);
a_route.post('/products/add_products',cpUpload,productController.insertProduct);
a_route.get('/products/detail_products',adminAuth.isLogin,productController.loadDetailProduct);
a_route.get('/products/edit_products',adminAuth.isLogin,productController.loadEditProduct);
a_route.post('/products/edit_products',upload.any(),productController.updateProduct);
a_route.get('/products/delete_products',adminAuth.isLogin,productController.deleteProduct);
a_route.get('/products/unlisted_products',adminAuth.isLogin,productController.loadUnlistedProduct);
a_route.get('/products/reAdd_products',adminAuth.isLogin,productController.reAddProduct);

//user management
a_route.get('/users',adminAuth.isLogin,adminController.loadUser);
a_route.get('/users/block_user',adminAuth.isLogin,adminController.blockUser);
a_route.get('/users/unblock_user',adminAuth.isLogin,adminController.unblockUser);

//order management
a_route.get('/orders',adminAuth.isLogin,adminController.loadOrder);
a_route.get('/orders/order_details',adminAuth.isLogin,adminController.loadOrderDetail);
a_route.post('/orders/order_details/change_status',adminController.changeStatusOrder);
a_route.get('/orders/returned_orders',adminAuth.isLogin,adminController.getReturnedOrder);

//category management
a_route.get('/categories',adminAuth.isLogin,productController.loadCategory);
a_route.post('/categories/add',productController.insertCategory);
a_route.post('/categories/edit',productController.updateCategory);
a_route.get('/categories/delete_categories',adminAuth.isLogin,productController.deleteCategory);
a_route.get('/categories/unlisted_categories',adminAuth.isLogin,productController.loadUnlistedCategory);
a_route.get('/categories/reAdd_categories',adminAuth.isLogin,productController.reAddCategory);

//brand management
a_route.get('/brands',adminAuth.isLogin,productController.loadBrand);
a_route.post('/brands/add',adminAuth.isLogin,productController.insertBrand);
a_route.post('/brands/edit',productController.updateBrand);
a_route.get('/brands/delete_brands',adminAuth.isLogin,productController.deleteBrand);
a_route.get('/brands/unlisted_brands',adminAuth.isLogin,productController.loadUnlistedBrand);
a_route.get('/brands/reAdd_brands',adminAuth.isLogin,productController.reAddBrand);

//coupon management
a_route.get('/coupons',adminAuth.isLogin,adminController.loadCoupon);
a_route.post('/coupons/add',adminController.insertCoupon);
a_route.post('/coupons/edit',adminController.updateCoupon);
a_route.get('/coupons/delete',adminAuth.isLogin,adminController.deleteCoupon);

//offer management
a_route.get('/offers',adminAuth.isLogin,adminController.loadOffer);
a_route.post('/offers/add',adminController.insertOffer);
a_route.put('/offers/edit/:id',adminController.updateOffer);
a_route.delete('/offers/delete/:id',adminController.deleteOffer);

//sales report
a_route.get('/dashboard/sales_report',adminAuth.isLogin,dashboardController.loadSalesReport);
a_route.get('/dashboard/sales_report/pdf',adminAuth.isLogin,dashboardController.downloadPDF);
a_route.get('/dashboard/sales_report/excel',adminAuth.isLogin,dashboardController.downloadExcel);

//logout
a_route.get('/logout',adminAuth.isLogin,adminController.logoutAdmin);


a_route.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).render('500', { error: err.message });
});

a_route.use((req, res, next) => {
    res.status(404).render('404', { message: 'Page not found' });
});

module.exports = a_route;