const router = require('express').Router();
const { authMiddleware, adminMiddleware } = require('../user/user.middleware');
const {
  createOrder,
  createOrderForCustomer,
  confirmOrder,
  getUserOrders,
  getOrderById,
  cancelOrder,
  getAllOrders,
  updateOrderStatus,
  requestReturn,
  markOrderAsPaid,
  processRefund
} = require('./order.controller');

// Customer routes
router.post('/', authMiddleware, createOrder);
router.post('/:id/confirm', authMiddleware, confirmOrder);
router.get('/', authMiddleware, getUserOrders);
router.get('/:id', authMiddleware, getOrderById);
router.post('/:id/cancel', authMiddleware, cancelOrder);
router.put('/:id/return', authMiddleware, requestReturn);

// Admin routes
router.post('/admin/create-for-customer', authMiddleware, adminMiddleware, createOrderForCustomer);
router.get('/admin/all', authMiddleware, adminMiddleware, getAllOrders);
router.put('/admin/:id/status', authMiddleware, adminMiddleware, updateOrderStatus);
router.post('/admin/:id/mark-paid', authMiddleware, adminMiddleware, markOrderAsPaid);
router.post('/admin/:id/refund', authMiddleware, adminMiddleware, processRefund);

module.exports = router;