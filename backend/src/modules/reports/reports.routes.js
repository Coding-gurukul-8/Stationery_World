// reports.routes.js  —  Stationery World v4.0

const express = require('express');
const router = express.Router();
const {
  getSalesReport,
  getRevenueReport,
  getInventoryReport,
  getTopProducts,
  getCategoryPerformance,
  getDashboardSummary,
  getProductDemand,
  getWeeklyStats,
  getOrderStatusDistribution,
  getSearchAnalytics,
  sendReportEmail
} = require('./reports.controller');
const { authMiddleware, adminMiddleware } = require('../user/user.middleware');

// All reports require admin authentication
// ── Dashboard & Summary ───────────────────────────────────────────────────────
router.get('/dashboard',         authMiddleware, adminMiddleware, getDashboardSummary);
router.get('/dashboard-summary', authMiddleware, adminMiddleware, getDashboardSummary); // alias

// ── Sales & Revenue ───────────────────────────────────────────────────────────
router.get('/sales',   authMiddleware, adminMiddleware, getSalesReport);
router.get('/revenue', authMiddleware, adminMiddleware, getRevenueReport);

// ── Charts ────────────────────────────────────────────────────────────────────
router.get('/weekly-stats',               authMiddleware, adminMiddleware, getWeeklyStats);
router.get('/order-status-distribution',  authMiddleware, adminMiddleware, getOrderStatusDistribution);

// ── Inventory & Products ──────────────────────────────────────────────────────
router.get('/inventory',            authMiddleware, adminMiddleware, getInventoryReport);
router.get('/top-products',         authMiddleware, adminMiddleware, getTopProducts);
router.get('/category-performance', authMiddleware, adminMiddleware, getCategoryPerformance);
router.get('/demand',               authMiddleware, adminMiddleware, getProductDemand);

// ── 🆕 Search Analytics (Section 4.2 / 2.3) ──────────────────────────────────
router.get('/search-analytics', authMiddleware, adminMiddleware, getSearchAnalytics);

// ── 🔧 Send Report Email (Section 4.2) ───────────────────────────────────────
router.post('/send-email', authMiddleware, adminMiddleware, sendReportEmail);

module.exports = router;
