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
  getOrderStatusDistribution
} = require('./reports.controller');
const { authMiddleware, adminMiddleware } = require('../user/user.middleware');

// =============================================================================
// ALL REPORTS REQUIRE ADMIN AUTHENTICATION
// =============================================================================

// ── Dashboard & Summary ────────────────────────────────────────────────────
router.get('/dashboard', authMiddleware, adminMiddleware, getDashboardSummary);
router.get('/dashboard-summary', authMiddleware, adminMiddleware, getDashboardSummary); // Alias

// ── Sales & Revenue Reports ────────────────────────────────────────────────
router.get('/sales', authMiddleware, adminMiddleware, getSalesReport);
router.get('/revenue', authMiddleware, adminMiddleware, getRevenueReport);

// ── NEW: Weekly & Status Distribution ──────────────────────────────────────
router.get('/weekly-stats', authMiddleware, adminMiddleware, getWeeklyStats);
router.get('/order-status-distribution', authMiddleware, adminMiddleware, getOrderStatusDistribution);

// ── Inventory & Products ───────────────────────────────────────────────────
router.get('/inventory', authMiddleware, adminMiddleware, getInventoryReport);
router.get('/top-products', authMiddleware, adminMiddleware, getTopProducts);
router.get('/category-performance', authMiddleware, adminMiddleware, getCategoryPerformance);
router.get('/demand', authMiddleware, adminMiddleware, getProductDemand);

module.exports = router;