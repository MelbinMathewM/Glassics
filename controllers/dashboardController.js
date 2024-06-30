const Admin = require('../model/adminModel');
const User = require('../model/userModel');
const Order = require('../model/orderModel');
const Product = require('../model/productModel');
const Category = require('../model/categoryModel');
const Coupon = require('../model/couponModel');
const Offer = require('../model/offerModel');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const loadDashboard = async (req, res) => {
    try {
        res.render('dashboard');
    } catch (error) {
        res.send(error);
    }
};

const getSalesReport = async (req, res) => {
    try {
        let { startDate, endDate, period } = req.query;
        const matchStage = { $match: {} };
        const now = new Date();
        if (startDate) startDate = new Date(startDate);
        if (endDate) {
            endDate = new Date(endDate);
            endDate.setHours(23, 59, 59, 999);
        }
        if (period && period !== 'select') {
            switch (period) {
                case 'daily':
                    startDate = new Date(now.setHours(0, 0, 0, 0));
                    endDate = new Date(now.setHours(23, 59, 59, 999));
                    break;
                case 'weekly':
                    startDate = new Date(now.setDate(now.getDate() - now.getDay() - 6));
                    startDate.setHours(0, 0, 0, 0);
                    endDate = new Date(now.setDate(now.getDate() - now.getDay() + 7));
                    endDate.setHours(23, 59, 59, 999);
                    break;
                case 'monthly':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    startDate.setHours(0, 0, 0, 0);
                    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                    endDate.setHours(23, 59, 59, 999);
                    break;
                case 'yearly':
                    startDate = new Date(now.getFullYear(), 0, 1);
                    startDate.setHours(0, 0, 0, 0);
                    endDate = new Date(now.getFullYear(), 11, 31);
                    endDate.setHours(23, 59, 59, 999);
                    break;
                default:
                    throw new Error('Invalid period selected');
            }
        } else if (startDate && endDate) {
            matchStage.$match["items.deliveryDate"] = {
                $gte: startDate,
                $lte: endDate
            };
        }
        if (startDate && endDate) {
            matchStage.$match["items.deliveryDate"] = {
                $gte: startDate,
                $lte: endDate
            };
        }
        let groupStage;
        switch (period) {
            case 'daily':
                groupStage = {
                    $group: {
                        _id: {
                            year: { $year: "$items.deliveryDate" },
                            month: { $month: "$items.deliveryDate" },
                            day: { $dayOfMonth: "$items.deliveryDate" },
                            product_id: "$items.product_id"
                        },
                        totalQuantity: { $sum: "$items.quantity" },
                        totalSales: { $sum: { $multiply: ["$items.quantity", "$items.productPrice"] } },
                        totalDiscount: { $sum: { $ifNull: ["$items.offerDiscount", 0] } },
                        totalCoupons: { $sum: { $ifNull: ["$items.couponDiscount", 0] } },
                        totalOrders: { $sum: 1 }
                    }
                };
                break;
            case 'weekly':
                groupStage = {
                    $group: {
                        _id: {
                            year: { $year: "$items.deliveryDate" },
                            week: { $isoWeek: "$items.deliveryDate" },
                            product_id: "$items.product_id"
                        },
                        totalQuantity: { $sum: "$items.quantity" },
                        totalSales: { $sum: { $multiply: ["$items.quantity", "$items.productPrice"] } },
                        totalDiscount: { $sum: { $ifNull: ["$items.offerDiscount", 0] } },
                        totalCoupons: { $sum: { $ifNull: ["$items.couponDiscount", 0] } },
                        totalOrders: { $sum: 1 }
                    }
                };
                break;
            case 'monthly':
                groupStage = {
                    $group: {
                        _id: {
                            year: { $year: "$items.deliveryDate" },
                            month: { $month: "$items.deliveryDate" },
                            product_id: "$items.product_id"
                        },
                        totalQuantity: { $sum: "$items.quantity" },
                        totalSales: { $sum: { $multiply: ["$items.quantity", "$items.productPrice"] } },
                        totalDiscount: { $sum: { $ifNull: ["$items.offerDiscount", 0] } },
                        totalCoupons: { $sum: { $ifNull: ["$items.couponDiscount", 0] } },
                        totalOrders: { $sum: 1 }
                    }
                };
                break;
            case 'yearly':
                groupStage = {
                    $group: {
                        _id: {
                            year: { $year: "$items.deliveryDate" },
                            product_id: "$items.product_id"
                        },
                        totalQuantity: { $sum: "$items.quantity" },
                        totalSales: { $sum: { $multiply: ["$items.quantity", "$items.productPrice"] } },
                        totalDiscount: { $sum: { $ifNull: ["$items.offerDiscount", 0] } },
                        totalCoupons: { $sum: { $ifNull: ["$items.couponDiscount", 0] } },
                        totalOrders: { $sum: 1 }
                    }
                };
                break;
            default:
                groupStage = {
                    $group: {
                        _id: {
                            year: { $year: "$items.deliveryDate" },
                            month: { $month: "$items.deliveryDate" },
                            day: { $dayOfMonth: "$items.deliveryDate" },
                            product_id: "$items.product_id"
                        },
                        totalQuantity: { $sum: "$items.quantity" },
                        totalSales: { $sum: { $multiply: ["$items.quantity", "$items.productPrice"] } },
                        totalDiscount: { $sum: { $ifNull: ["$items.offerDiscount", 0] } },
                        totalCoupons: { $sum: { $ifNull: ["$items.couponDiscount", 0] } },
                        totalOrders: { $sum: 1 }
                    }
                };
                break;
        }
        const projectStage = {
            $project: {
                _id: 0,
                year: "$_id.year",
                month: { $ifNull: ["$_id.month", null] },
                day: { $ifNull: ["$_id.day", null] },
                week: { $ifNull: ["$_id.week", null] },
                product: "$productDetails.productName",
                totalQuantity: 1,
                totalSales: 1,
                totalDiscount: 1,
                totalCoupons: 1,
                totalOrders: 1
            }
        };
        const pipeline = [
            { $unwind: "$items" },
            matchStage,
            groupStage,
            {
                $lookup: {
                    from: 'products',
                    localField: '_id.product_id',
                    foreignField: '_id',
                    as: 'productDetails'
                }
            },
            { $unwind: "$productDetails" },
            projectStage
        ];
        const salesReport = await Order.aggregate(pipeline);
        const overallPipeline = [
            { $unwind: "$items" },
            matchStage,
            {
                $group: {
                    _id: null,
                    totalSales: { $sum: { $multiply: ["$items.quantity", "$items.productPrice"] } },
                    totalDiscount: { $sum: { $ifNull: ["$items.offerDiscount", 0] } },
                    totalCoupons: { $sum: { $ifNull: ["$items.couponDiscount", 0] } },
                    totalOrders: { $sum: 1 },
                    totalQuantity: { $sum: "$items.quantity" }
                }
            }
        ];
        const overallSales = await Order.aggregate(overallPipeline);
        const overallReport = overallSales[0] || {
            totalSales: 0,
            totalDiscount: 0,
            totalCoupons: 0,
            totalOrders: 0,
            totalQuantity: 0
        };
        return { salesReport, overallReport };
    } catch (error) {
        console.error('Error loading sales report:', error);
        res.status(500).send('Internal Server Error');
    }
};

const loadSalesReport = async (req, res) => {
    try {
        const { startDate, endDate, period } = req.query;
        const { salesReport, overallReport } = await getSalesReport(req);
        res.render('sales_report', {
            salesReport,
            startDate: startDate ? new Date(startDate).toISOString().split('T')[0] : '',
            endDate: endDate ? new Date(endDate).toISOString().split('T')[0] : '',
            period,
            overallReport
        });
    } catch (error) {
        console.error('Error rendering sales report page:', error);
        res.status(500).send('Internal Server Error');
    }
};

const downloadPDF = async (req, res) => {
    try {
        const { salesReport, overallReport } = await getSalesReport(req);
        const pdfPath = await generatePDF({ salesReport, overallReport }, 'sales_report');
        res.download(pdfPath, 'sales_report.pdf');
    } catch (error) {
        console.error('Error downloading sales report:', error);
        res.status(500).send('Internal Server Error');
    }
};


const generatePDF = async ({ salesReport, overallReport }, filename) => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument();
        const outputPath = path.join(__dirname, '..', 'public', 'pdf', `${filename}.pdf`);

        // Ensure the directory exists
        const directory = path.dirname(outputPath);
        if (!fs.existsSync(directory)) {
            fs.mkdirSync(directory, { recursive: true });
        }

        const stream = fs.createWriteStream(outputPath);
        doc.pipe(stream);

        // PDF content generation
        doc.font('Helvetica').fontSize(24);
        doc.text('Sales Report', { align: 'center' }).moveDown();

        // Overall Report
        doc.fontSize(20);
        doc.text('Overall Report', { align: 'left' }).moveDown();

        doc.fontSize(16);
        doc.text(`Total Sales: ${overallReport.totalSales.toFixed(2)}`);
        doc.text(`Total Discount: ${overallReport.totalDiscount.toFixed(2)}`);
        doc.text(`Total Coupons: ${overallReport.totalCoupons.toFixed(2)}`);
        doc.text(`Total Orders: ${overallReport.totalOrders}`);
        doc.text(`Total Quantity: ${overallReport.totalQuantity}`).moveDown();

        // Sales Report Details
        doc.fontSize(16);
        doc.text('Sales Report Details', { align: 'left' }).moveDown();

        salesReport.forEach(item => {
            doc.fontSize(16);
            doc.text(`Product: ${item.product}`).moveDown();

            doc.fontSize(14);
            if (item.day) {
                doc.text(`Date: ${item.year}-${item.month}-${item.day}`);
            } else if (item.week) {
                doc.text(`Week: ${item.year}-W${item.week}`);
            } else if (item.month) {
                doc.text(`Month: ${item.year}-${item.month}`);
            } else {
                doc.text(`Year: ${item.year}`);
            }
            doc.text(`Total Quantity: ${item.totalQuantity}`);
            doc.text(`Total Sales: ${item.totalSales.toFixed(2)}`);
            doc.text(`Total Discount: ${item.totalDiscount.toFixed(2)}`);
            doc.text(`Total Coupons: ${item.totalCoupons.toFixed(2)}`);
            doc.text(`Total Orders: ${item.totalOrders}`);
            doc.moveDown();
        });

        doc.end();

        stream.on('finish', () => {
            resolve(outputPath);
        });

        stream.on('error', (err) => {
            reject(err);
        });
    });
};

module.exports = {
    loadDashboard,
    loadSalesReport,
    downloadPDF
}