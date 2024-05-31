const Admin = require('../model/adminModel');

exports.checkAdminSession = (req, res, next) => {
    if (req.session && req.session.admin_id) {
        return next();
    } else {
        res.redirect('/admin/login');
    }
};