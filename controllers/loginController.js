const User = require('../model/userModel');
const Wallet = require('../model/walletModel');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const nodemailer = require('nodemailer');
const crypto = require('crypto');
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
            return res.status(400).json({ message: "Username already taken" });
        }
        const existingEmail = await User.findOne({ userEmail: req.body.userEmail });
        if (existingEmail) {
            return res.status(400).json({ message: "Email already in use" });
        }
        const otp = generateOTP();
        req.session.otp = { value: otp, expires: Date.now() + 60000 };
        req.session.userData = {
            customerName: req.body.customerName,
            userName: req.body.userName,
            userEmail: req.body.userEmail,
            userMobile: req.body.userMobile,
            password: await securePassword(req.body.password),
            is_blocked: 0
        };
        await sendOTPViaEmail(req.body.userEmail, otp);
        res.status(200).json({ redirectUrl: '/otp_validation' });
    } catch (error) {
        res.status(500).json({ message: error.message });
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
        const { otp } = req.body;
        const otpExpires = req.session.otp.expires;
        const sessionOTP = req.session.otp.value;
        if (!sessionOTP) {
            return res.status(400).json({ success: false, message: "Session expired" });
        }
        const currentTime = Date.now();
        if (currentTime > otpExpires) {
            req.session.otp = null;
            return res.status(400).json({ success: false, message: "OTP expired" });
        }
        if (sessionOTP === otp) {
            req.session.otp = null;
            const userData = req.session.userData;
            const user = new User(userData);
            user.isOTPVerified = true;
            await user.save();
            req.session.userData = null;
            return res.status(201).json({ success: true, message: "Registration successful" });
        } else {
            return res.status(400).json({ success: false, message: "Invalid OTP" });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const resendOTP = async (req, res) => {
    try {
        const userData = req.session.userData;
        if (!userData) {
            return res.status(400).json({ success: false, message: "Session expired, please register again" });
        }

        const otp = generateOTP();
        req.session.otp = { value: otp, expires: Date.now() + 60000 };
        await sendOTPViaEmail(userData.userEmail, otp);

        res.status(200).json({ success: true, message: "OTP resent successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
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
                    let wallet = await Wallet.findOne({ userId: userData._id });
                    if (!wallet) {
                        wallet = new Wallet({
                            user: userData._id,
                            balance: 0
                        });

                        await wallet.save();
                    }
                    res.status(201).json({ success : true });
                }else{
                    res.status(400).json({ success : false, message : 'You are blocked'});
                }
            }else{
                res.status(400).json({ success : false, message : 'Incorrect password'});
            }
        }else{
            res.status(404).json({ success : false, message : 'User not found'});
        }
    }catch(error){
        res.status(500).json({ success : false, error : 'Something went wrong'});
    }
};

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
                customerName: profile.displayName
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
        let wallet = await Wallet.findOne({ userId: req.user._id });
        if (!wallet) {
            wallet = new Wallet({
                user: req.user._id,
                balance: 0
            });
            await wallet.save();
        }
        res.redirect('/');
    } catch (error) {
        res.send(error);
    }
};

const loadForgotPassword = async (req,res) => {
    try{
        res.render('forgot_password');
    }catch(error){
        res.send(error);
    }
};

const postForgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ userEmail: email });
        if (!user) {
            return res.status(400).json({ message: 'User with this email does not exist.' });
        }
        const token = crypto.randomBytes(32).toString('hex');
        user.resetToken = token;
        user.resetTokenExpiration = Date.now() + 3600000;
        await user.save();
        const resetUrl = `http://www.glassics.shop/reset_password/${token}`;
        await sendResetLinkViaEmail(email, `${resetUrl}`);
        res.json({ message: 'Password reset link has been sent to your email.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred while processing your request.' });
    }
};

const loadResetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const user = await User.findOne({
            resetToken: token,
            resetTokenExpiration: { $gt: Date.now() }
        });
        if (!user) {
            return res.render('reset_password', { token: null, message: 'Password reset token is invalid or has expired.' });
        }
        res.render('reset_password', { token });
    } catch (error) {
        res.status(500).send('Error loading reset password page: ' + error.message);
    }
};

const postResetPassword = async (req, res) => {
    const { token, password } = req.body;
    try {
        const user = await User.findOne({
            resetToken: token,
            resetTokenExpiration: { $gt: Date.now() }
        });
        if (!user) {
            return res.status(400).json({ message: 'Password reset token is invalid or has expired.' });
        }
        if (!password) {
            return res.status(400).json({ message: 'Password is required.' });
        }
        const hashedPassword = await securePassword(password);
        user.password = hashedPassword;
        user.resetToken = undefined;
        user.resetTokenExpiration = undefined;
        await user.save();
        res.json({ message: 'Password has been reset successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred while processing your request.' });
    }
};


async function sendResetLinkViaEmail(email, url) {
    const mailOptions = {
        from: process.env.email,
        to: email,
        subject: 'Your link to reset password',
        text: `Your Link: ${url}`
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
    loadForgotPassword,
    postForgotPassword,
    loadResetPassword,
    postResetPassword,
    logoutUser
}