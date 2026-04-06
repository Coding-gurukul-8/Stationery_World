const express = require('express');
const router  = express.Router();
const {
  initiatePayment,
  verifyPayment,
  getPaymentStatus,
  processRefund,
  setUpiSettings,
  getUpiSettings,
  getOrderUpiSettings,
} = require('./payment.controller');
const { authMiddleware, adminMiddleware } = require('../user/user.middleware');

// ── UPI / QR settings ────────────────────────────────────────────────────────
router.put('/admin/upi-settings',          authMiddleware, adminMiddleware, setUpiSettings);
router.get('/upi-settings/:adminId',       getUpiSettings);                               // public
router.get('/order/:orderId/upi-settings', authMiddleware, getOrderUpiSettings);

// ── Standard payment flow ─────────────────────────────────────────────────────
router.post('/initiate', authMiddleware, initiatePayment);
router.post('/verify',   authMiddleware, verifyPayment);
router.get('/:orderId',  authMiddleware, getPaymentStatus);

// ── Admin ─────────────────────────────────────────────────────────────────────
router.post('/:id/refund', authMiddleware, adminMiddleware, processRefund);

module.exports = router;
