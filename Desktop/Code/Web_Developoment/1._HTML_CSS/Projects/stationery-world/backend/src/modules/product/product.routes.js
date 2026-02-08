const express = require('express');
const router = express.Router();
const {
  getAllProducts,
  getProductById,
  getProductsByCategory,
  createProduct,
  updateProduct,
  deleteProduct,
  toggleProductStatus,
  getLowStockProducts,
  restockProduct,
  getInventoryLogs
} = require('./product.controller');
const { authMiddleware, adminMiddleware } = require('../user/user.middleware');

// Public routes
router.get('/', getAllProducts);
router.get('/category/:category', getProductsByCategory);
router.get('/:id', getProductById);

// Admin-only routes
router.post('/', authMiddleware, adminMiddleware, createProduct);
router.put('/:id', authMiddleware, adminMiddleware, updateProduct);
router.delete('/:id', authMiddleware, adminMiddleware, deleteProduct);
router.patch('/:id/toggle-status', authMiddleware, adminMiddleware, toggleProductStatus);
router.post('/:id/restock', authMiddleware, adminMiddleware, restockProduct);
router.get('/:id/logs', authMiddleware, adminMiddleware, getInventoryLogs);
router.get('/admin/low-stock', authMiddleware, adminMiddleware, getLowStockProducts);

module.exports = router;
