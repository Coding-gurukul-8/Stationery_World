const express = require('express');
const router = express.Router();
const {
  getAllInventory,
  getLowStockProducts,
  updateInventory,
  bulkUpdateInventory,
  getProductInventory
} = require('./inventory.controller');
const { authMiddleware, adminMiddleware } = require('../user/user.middleware');

// All inventory routes require admin authentication
router.get('/', authMiddleware, adminMiddleware, getAllInventory);
router.get('/low-stock', authMiddleware, adminMiddleware, getLowStockProducts);
router.get('/:productId', authMiddleware, adminMiddleware, getProductInventory);
router.put('/:productId', authMiddleware, adminMiddleware, updateInventory);
router.post('/bulk-update', authMiddleware, adminMiddleware, bulkUpdateInventory);

module.exports = router;
