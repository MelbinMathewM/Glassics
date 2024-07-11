const User = require('../model/userModel');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const nodemailer = require('nodemailer');
const bcrypt =  require('bcrypt');

const securePassword = async (password) => {
    try{
        const hashPassword = await bcrypt.hash(password,10);
        return hashPassword;
    }catch(error){
        res.send(error);
    }
};

const transporter = nodemailer.createTransport({
    service : 'Gmail',
    auth : {
        user : process.env.user,
        pass : process.env.pass
    }
});

function generateOTP() {
    const otp = Math.floor(100000 + Math.random() * 900000);
    return otp.toString();
};

async function sendOTPViaEmail(email, otp) {
    const mailOptions = {
        from: process.env.email,
        to: email,
        subject: 'Your OTP for registration',
        text: `Your OTP: ${otp}`
    };
    return new Promise((resolve, reject) => {
        transporter.sendMail(mailOptions, (error, info) => {
            if(error){
                reject(error);
            }else{
                resolve('OTP sent successfully.');
            };
        });
    });
};

const loadRegister = async (req,res) => {
    try{
        res.render('register');
    }catch(error){
        res.send(error);
    };
};

const insertUser = async (req, res) => {
    try {
        const existingUser = await User.findOne({ userName: req.body.userName });
        if (existingUser) {
            return res.render('register', { message: "Username already taken" });
        }
        const existingEmail = await User.findOne({ userEmail: req.body.userEmail });
        if (existingEmail) {
            return res.render('register', { message: "Email already in use" });
        }
        const otp = generateOTP();
        req.session.otp = otp;
        req.session.userData = {
            customerName: req.body.customerName,
            userName: req.body.userName,
            userEmail: req.body.userEmail,
            userMobile: req.body.userMobile,
            userImage: req.file ? req.file.filename : null,
            password: await securePassword(req.body.password),
            is_admin: 0,
            is_blocked: 0
        };
        await sendOTPViaEmail(req.body.userEmail, otp);
        res.redirect(`/otp_validation`);
    } catch (error) {
        res.status(500).send(error.message);
    }
};

const loadOTP = async (req, res) => {
    try {
        if (!req.session.userData) {
            return res.redirect('/register');
        }
        res.render('otp_validation');
    } catch (error) {
        res.status(500).send(error.message);
    }
};

const verifyOTP = async (req, res) => {
    try {
        const otp = req.body.otp;
        const sessionOTP = req.session.otp;

        if (!sessionOTP) {
            return res.render('otp_validation', { message: "Session expired" });
        }

        if (sessionOTP === otp) {
            req.session.otp = null;
            const userData = req.session.userData;
            const user = new User(userData);
            user.isOTPVerified = true;
            await user.save();
            req.session.userData = null;
            res.render('login', { message: "Registration successful" });
        } else {
            res.render('otp_validation', { message: "Invalid OTP" });
        }
    } catch (error) {
        res.status(500).send(error.message);
    }
};

const resendOTP = async (req, res) => {
    try {
        const userData = req.session.userData;
        if (!userData) {
            return res.render('register', { message: "Session expired, please register again" });
        }

        const newOTP = generateOTP();
        req.session.otp = newOTP;
        await sendOTPViaEmail(userData.userEmail, newOTP);

        res.redirect(`/otp_validation`);
    } catch (error) {
        res.status(500).send(error.message);
    }
};

const loadLogin = async (req,res) => {
    try{
        res.render('login');
    }catch(error){
        res.send(error);
    }
};

const verifyUser = async (req,res) => {
    try{
        const userName = req.body.userName;
        const password = req.body.password;
        const userData = await User.findOne({userName : userName});
        if(userData){
            const passwordMatch = await bcrypt.compare(password,userData.password);
            if(passwordMatch){
                if(userData.is_blocked === 0){
                    req.session.user_id = userData._id;
                    res.redirect('/');
                }else{
                    res.render('login',{message : "User blocked"});
                }
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

// middleWare/googleAuth.js
passport.use(new GoogleStrategy({
    clientID: process.env.clientID,
    clientSecret: process.env.clientSecret,
    callbackURL: process.env.callbackURL,
    passReqToCallback: true
}, async (req, accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ userEmail: profile.emails[0].value });

        if (!user) {
            user = new User({
                googleId: profile.id,
                userName: profile.displayName,
                userEmail: profile.emails[0].value,
                customerName: profile.displayName,
                userImage: profile.photos[0].value
            });
            await user.save();
        }

        done(null, user);
    } catch (err) {
        console.error('Error in Google OAuth:', err);
        done(err);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err);
    }
});

const googleSuccess = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.redirect('/login');
        }
        if (req.user.is_blocked) {
            return res.render('login',{ message : 'User blocked'});
        }
        req.session.user_id = req.user._id;
        res.redirect('/');
    } catch (error) {
        res.send(error);
    }
};

const logoutUser = async (req,res) => {
    try{
        req.session.destroy();
        res.redirect('/login');
    }catch(error){
        res.send(error);
    }
};

module.exports = {
    loadRegister,
    loadOTP,
    verifyOTP,
    resendOTP,
    loadLogin,
    insertUser,
    verifyUser,
    googleSuccess,
    logoutUser
}