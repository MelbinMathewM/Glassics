require('dotenv').config()

//mongodb require
const mongoose = require('mongoose');
const mongoURI = process.env.mongo_uri
mongoose.connect(mongoURI)
.then(() => console.log('mongo connected'))
.catch((err) => console.log(err));

//express require
const express = require('express');
const app = express();

//path require
const path = require('path');
app.use('/static',express.static(path.join(__dirname,"public")));

//nocache require
const nocache = require('nocache');
app.use(nocache());


//admin router
const a_route = require('./routes/adminRouter');
app.use('/admin',a_route);

//user router
const u_route = require('./routes/userRouter');
app.use('/',u_route);

//port specify
const port = process.env.PORT || 3003;
app.listen(port,() => {
    console.log(`server started at http://localhost:${port}`);
});