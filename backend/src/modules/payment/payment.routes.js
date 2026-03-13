const express = require('express');
const router = express.Router();
const {
  initiatePayment,
  verifyPayment,
  getPaymentStatus,
  processRefund
} = require('./payment.controller');
const { authMiddleware, adminMiddleware } = require('../user/user.middleware');

// Customer routes
router.post('/initiate', authMiddleware, initiatePayment);
router.post('/verify', authMiddleware, verifyPayment);
router.get('/:orderId', authMiddleware, getPaymentStatus);

// Admin routes
router.post('/:id/refund', authMiddleware, adminMiddleware, processRefund);

module.exports = router;
