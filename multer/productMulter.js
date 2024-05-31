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

const upload = multer({ 
    storage: storage, 
    limits: { fileSize: 1024 * 1024 * 5 }
});

const generateMulterFields = () => {
    let fields = [];
    for (let i = 0; i < 4; i++) {
        fields.push({ name: `variantImages[${i}][]`, maxCount: 10 });
    }
    return fields;
};


const cpUpload = upload.fields(generateMulterFields());

module.exports = {
    cpUpload
}