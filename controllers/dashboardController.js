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
const puppeteer = require('puppeteer');
const xlsx = require('xlsx');
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

const loadSalesData = async (req, res) => {
    const filter = req.query.filter;
    let matchStage = {};
    let groupStage = {};
    let dateFormat;
    switch (filter) {
        case 'yearly':
            dateFormat = '%Y';
            break;
        case 'monthly':
            dateFormat = '%Y-%m';
            break;
        case 'weekly':
            dateFormat = '%Y-%U';
            break;
        case 'daily':
            dateFormat = '%Y-%m-%d';
            break;
        default:
            dateFormat = '%Y-%m-%d';
    }
    groupStage = {
        _id: { $dateToString: { format: dateFormat, date: "$items.deliveryDate" } },
        totalSales: { $sum: "$items.productPrice" },
        totalDiscount: { 
            $sum: {
                $add: [
                    { $ifNull: ["$items.offerDiscount", 0] },
                    { $ifNull: ["$items.couponDiscount", 0] }
                ]
            }
        },
        totalQuantity: { $sum: "$items.quantity" },
        totalOrders: { $sum: 1 }
    };
    try {
        const salesData = await Order.aggregate([
            { $unwind: "$items" },
            { $group: groupStage },
            { $sort: { _id: 1 } }
        ]);
        const labels = salesData.map(data => data._id);
        const totalSales = salesData.map(data => data.totalSales/1000);
        const totalDiscount = salesData.map(data => data.totalDiscount/1000);
        const totalQuantity = salesData.map(data => data.totalQuantity);
        const totalOrders = salesData.map(data => data.totalOrders);
        res.json({ labels, totalSales, totalDiscount, totalQuantity, totalOrders });
    } catch (err) {
        res.status(500).send(err.message);
    }
};

const getTopProducts = async (req, res) => {
    try {
        const bestSellingProducts = await Order.aggregate([
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.product_id',
                    totalSold: { $sum: '$items.quantity' },
                    totalRevenue: { $sum: { $multiply: ['$items.productPrice', '$items.quantity'] } }
                }
            },
            {
                $lookup: {
                    from: 'products',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'product'
                }
            },
            { $unwind: '$product' },
            { $sort: { totalSold: -1 } },
            { $limit: 10 }
        ]);
        res.json(bestSellingProducts);
    } catch (err) {
        res.status(500).send(err.message);
    }
};

const getTopCategories = async (req, res) => {
    try {
        const bestSellingCategories = await Order.aggregate([
            { $unwind: '$items' },
            {
                $lookup: {
                    from: 'products',
                    localField: 'items.product_id',
                    foreignField: '_id',
                    as: 'product'
                }
            },
            { $unwind: '$product' },
            {
                $group: {
                    _id: '$product.productCategory',
                    totalSold: { $sum: '$items.quantity' },
                    totalRevenue: { $sum: { $multiply: ['$items.productPrice', '$items.quantity'] } }
                }
            },
            {
                $lookup: {
                    from: 'categories',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'category'
                }
            },
            { $unwind: '$category' },
            { $sort: { totalSold: -1 } },
            { $limit: 10 }
        ]);
        res.json(bestSellingCategories);
    } catch (err) {
        res.status(500).send(err.message);
    }
};

const getTopBrands = async (req, res) => {
    try {
        const bestSellingBrands = await Order.aggregate([
            { $unwind: '$items' },
            {
                $lookup: {
                    from: 'products',
                    localField: 'items.product_id',
                    foreignField: '_id',
                    as: 'product'
                }
            },
            { $unwind: '$product' },
            {
                $group: {
                    _id: '$product.productBrand',
                    totalSold: { $sum: '$items.quantity' },
                    totalRevenue: { $sum: { $multiply: ['$items.productPrice', '$items.quantity'] } }
                }
            },
            {
                $lookup: {
                    from: 'brands',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'brand'
                }
            },
            { $unwind: '$brand' },
            { $sort: { totalSold: -1 } },
            { $limit: 10 }
        ]);
        res.json(bestSellingBrands);
    } catch (err) {
        res.status(500).send(err.message);
    }
};

const getSalesReport = async (req, res) => {
    try {
        let { startDate, endDate, period } = req.query;
        const matchStage = {
            $match: {
                "items.orderStatus": { $nin: ["Canceled", "Returned"] }
            }
        };
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
        console.log(pdfPath);
        res.download(pdfPath, 'sales_report.pdf');
    } catch (error) {
        console.error('Error downloading sales report:', error);
        res.status(500).send('Internal Server Error');
    }
};

const generatePDF = async ({ salesReport, overallReport }, filename) => {
    try {
        // Launch Puppeteer
        const browser = await puppeteer.launch({ timeout: 0 }); // Set timeout to 0 for no timeout
        const page = await browser.newPage();

        // Define content to be rendered in HTML
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {
                        font-family: Helvetica, Arial, sans-serif;
                        margin: 50px;
                    }
                    h1 {
                        text-align: center;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 20px;
                    }
                    th, td {
                        border: 1px solid #dddddd;
                        text-align: left;
                        padding: 8px;
                    }
                    th {
                        background-color: #f2f2f2;
                    }
                </style>
            </head>
            <body>
                <h1>Sales Report</h1>
                
                <h2>Overall Report</h2>
                <p>Total Sales: ${overallReport.totalSales.toFixed(2)}</p>
                <p>Total Discount: ${overallReport.totalDiscount.toFixed(2)}</p>
                <p>Total Coupons: ${overallReport.totalCoupons.toFixed(2)}</p>
                <p>Total Orders: ${overallReport.totalOrders}</p>
                <p>Total Quantity: ${overallReport.totalQuantity}</p>
                
                <h2>Sales Report Details</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th>Date</th>
                            <th>Total Quantity</th>
                            <th>Total Sales</th>
                            <th>Total Discount</th>
                            <th>Total Coupons</th>
                            <th>Total Orders</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${salesReport.map(item => `
                            <tr>
                                <td>${item.product}</td>
                                <td>${item.date}</td>
                                <td>${item.totalQuantity}</td>
                                <td>&#8377;${item.totalSales.toFixed(2)}</td>
                                <td>&#8377;${item.totalDiscount.toFixed(2)}</td>
                                <td>&#8377;${item.totalCoupons.toFixed(2)}</td>
                                <td>${item.totalOrders}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </body>
            </html>
        `;

        // Set content and generate PDF
        await page.setContent(htmlContent);
        const pdfPath = path.join(__dirname, '..', 'public', 'pdf', `${filename}.pdf`);
        await page.pdf({ path: pdfPath, format: 'A4', printBackground: true });

        // Close browser
        await browser.close();

        return pdfPath;
    } catch (error) {
        console.error('Error generating PDF:', error);
        throw error;
    }
};

const downloadExcel = async (req, res) => {
    try {
        const { salesReport, overallReport } = await getSalesReport(req);
        const filename = `sales_report_${new Date().toISOString().split('T')[0]}`;
        const filePath = await generateExcel({ salesReport, overallReport }, filename);
        res.download(filePath, (err) => {
            if (err) {
                console.error('Error downloading the file:', err);
                res.status(500).send('Error downloading the file.');
            }
        });
    } catch (error) {
        console.error('Error generating the sales report:', error);
        res.status(500).send('Error generating the sales report.');
    }
};

const generateExcel = async ({ salesReport, overallReport }, filename) => {
    return new Promise((resolve, reject) => {
        const wb = xlsx.utils.book_new();
        // Overall Report
        const overallData = [
            ['Overall Report'],
            ['Total Sales', overallReport.totalSales.toFixed(2)],
            ['Total Discount', overallReport.totalDiscount.toFixed(2)],
            ['Total Coupons', overallReport.totalCoupons.toFixed(2)],
            ['Total Orders', overallReport.totalOrders],
            ['Total Quantity', overallReport.totalQuantity]
        ];
        const overallSheet = xlsx.utils.aoa_to_sheet(overallData);
        xlsx.utils.book_append_sheet(wb, overallSheet, 'Overall Report');
        // Sales Report Details
        const salesData = [
            ['Product', 'Date/Week/Month/Year', 'Total Quantity', 'Total Sales', 'Total Discount', 'Total Coupons', 'Total Orders']
        ];
        salesReport.forEach(item => {
            let dateInfo = '';
            if (item.day) {
                dateInfo = `${item.year}-${item.month}-${item.day}`;
            } else if (item.week) {
                dateInfo = `${item.year}-W${item.week}`;
            } else if (item.month) {
                dateInfo = `${item.year}-${item.month}`;
            } else {
                dateInfo = `${item.year}`;
            }
            salesData.push([
                item.product,
                dateInfo,
                item.totalQuantity,
                item.totalSales.toFixed(2),
                item.totalDiscount.toFixed(2),
                item.totalCoupons.toFixed(2),
                item.totalOrders
            ]);
        });
        const salesSheet = xlsx.utils.aoa_to_sheet(salesData);
        xlsx.utils.book_append_sheet(wb, salesSheet, 'Sales Report');
        const outputPath = path.join(__dirname, '..', 'public', 'excel', `${filename}.xlsx`);
        const directory = path.dirname(outputPath);
        if (!fs.existsSync(directory)) {
            fs.mkdirSync(directory, { recursive: true });
        }
        // Write the workbook to a file
        xlsx.writeFile(wb, outputPath);
        resolve(outputPath);
    });
};

module.exports = {
    loadDashboard,
    loadSalesData,
    getTopProducts,
    getTopCategories,
    getTopBrands,
    loadSalesReport,
    downloadPDF,
    downloadExcel
};