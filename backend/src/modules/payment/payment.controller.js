const prisma  = require('../../../prisma/client');
const multer  = require('multer');
const path    = require('path');
const { uploadToSupabase, deleteFromSupabase, USER_BUCKET } = require('../../utils/uploadToSupabase');

// ── Multer for QR code upload (stored in users bucket under adminId/qr-code.jpg) ──
const _qrFilter = (req, file, cb) => {
  const ok = /jpeg|jpg|png|webp/.test(path.extname(file.originalname).toLowerCase())
           && /image/.test(file.mimetype);
  ok ? cb(null, true) : cb(new Error('Only image files are allowed for QR code.'));
};
const _qrUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: _qrFilter
}).single('qrCode');

// =============================================================================
// UPI / QR PAYMENT SETTINGS
// =============================================================================

// PUT /api/payments/admin/upi-settings  (admin only, multipart or JSON)
// Body: upiId, displayName, qrCode (file)
const setUpiSettings = (req, res) => {
  _qrUpload(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });

    try {
      const adminId = req.user.id;
      const { upiId, displayName } = req.body;

      if (!upiId && !displayName && !req.file)
        return res.status(400).json({ success: false, message: 'Provide at least upiId, displayName, or a qrCode image.' });

      const existing   = await prisma.adminPaymentSettings.findUnique({ where: { adminId } });
      const updateData = {};

      if (upiId       !== undefined) updateData.upiId       = String(upiId).trim();
      if (displayName !== undefined) updateData.displayName = String(displayName).trim();

      if (req.file) {
        // Delete old QR from Supabase first (best-effort)
        if (existing?.qrCodeUrl) await deleteFromSupabase(existing.qrCodeUrl, USER_BUCKET).catch(() => {});
        const storagePath = `${adminId}/qr-code.jpg`;
        updateData.qrCodeUrl = await uploadToSupabase(req.file.buffer, req.file.mimetype, storagePath, USER_BUCKET);
      }

      const settings = await prisma.adminPaymentSettings.upsert({
        where:  { adminId },
        create: { adminId, ...updateData },
        update: updateData
      });

      return res.status(200).json({ success: true, message: 'UPI payment settings updated.', data: settings });
    } catch (error) {
      console.error('Set UPI settings error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while updating UPI settings.' });
    }
  });
};

// GET /api/payments/upi-settings/:adminId  (public — customer needs to know where to pay)
const getUpiSettings = async (req, res) => {
  try {
    const adminId = parseInt(req.params.adminId);
    if (isNaN(adminId)) return res.status(400).json({ success: false, message: 'Invalid admin ID.' });

    const settings = await prisma.adminPaymentSettings.findUnique({
      where:  { adminId },
      select: { upiId: true, qrCodeUrl: true, displayName: true, isActive: true }
    });

    if (!settings || !settings.isActive)
      return res.status(404).json({ success: false, message: 'UPI settings not configured for this admin.' });

    return res.status(200).json({ success: true, data: settings });
  } catch (error) {
    console.error('Get UPI settings error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// GET /api/payments/order/:orderId/upi-settings  (auth required)
// Returns UPI details for every admin whose products are in this order.
// A single order may contain products from multiple admins (mixed cart).
const getOrderUpiSettings = async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId);
    if (isNaN(orderId)) return res.status(400).json({ success: false, message: 'Invalid order ID.' });

    const order = await prisma.order.findUnique({
      where:   { id: orderId },
      include: { items: { include: { product: { select: { createdById: true } } } } }
    });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    if (order.userId !== req.user.id && req.user.role !== 'ADMIN')
      return res.status(403).json({ success: false, message: 'Access denied.' });

    const adminIds = [...new Set(
      order.items.map(i => i.product?.createdById).filter(Boolean)
    )];

    const settingsList = await prisma.adminPaymentSettings.findMany({
      where:  { adminId: { in: adminIds }, isActive: true },
      select: { adminId: true, upiId: true, qrCodeUrl: true, displayName: true }
    });

    return res.status(200).json({ success: true, data: settingsList });
  } catch (error) {
    console.error('Get order UPI settings error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// =============================================================================
// EXISTING PAYMENT FLOWS (fixed bugs: CANCELED→CANCELLED, tx.inventory→tx.product)
// =============================================================================

const initiatePayment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { orderId, method = 'CASH', transactionId } = req.body;

    if (!orderId) return res.status(400).json({ success: false, message: 'Order ID is required.' });

    const validMethods = ['CREDIT_CARD', 'DEBIT_CARD', 'UPI', 'CASH', 'NET_BANKING', 'OTHER'];
    if (!validMethods.includes(method))
      return res.status(400).json({ success: false, message: `Invalid payment method. Must be one of: ${validMethods.join(', ')}` });

    const order = await prisma.order.findUnique({ where: { id: parseInt(orderId) } });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (order.userId !== userId) return res.status(403).json({ success: false, message: 'Access denied.' });
    if (order.status !== 'CONFIRMED')
      return res.status(400).json({ success: false, message: `Order must be CONFIRMED before payment. Current status: ${order.status}` });

    const existingPayment = await prisma.payment.findUnique({ where: { orderId: parseInt(orderId) } });
    if (existingPayment)
      return res.status(409).json({ success: false, message: 'Payment already exists for this order.', data: existingPayment });

    const payment = await prisma.payment.create({
      data: {
        orderId: parseInt(orderId),
        userId,
        amount: order.totalAmount,
        method,
        status: 'PENDING',
        transactionId: transactionId || null
      }
    });

    return res.status(201).json({ success: true, message: 'Payment initiated successfully.', data: payment });
  } catch (error) {
    console.error('Initiate payment error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while initiating payment.' });
  }
};

const verifyPayment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { paymentId, status = 'SUCCESS', transactionId } = req.body;

    if (!paymentId) return res.status(400).json({ success: false, message: 'Payment ID is required.' });

    const validStatuses = ['SUCCESS', 'FAILED'];
    if (!validStatuses.includes(status))
      return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });

    const payment = await prisma.payment.findUnique({
      where:   { id: parseInt(paymentId) },
      include: { order: { include: { items: { include: { product: true } } } } }
    });
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found.' });
    if (payment.userId !== userId) return res.status(403).json({ success: false, message: 'Access denied.' });
    if (payment.status !== 'PENDING')
      return res.status(400).json({ success: false, message: `Payment already processed. Current status: ${payment.status}` });

    const updatedPayment = await prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id: parseInt(paymentId) },
        data:  { status, transactionId: transactionId || payment.transactionId }
      });

      if (status === 'SUCCESS') {
        await tx.order.update({
          where: { id: payment.orderId },
          data:  { status: 'PAID', isPaid: true, paidAt: new Date(), paymentMethod: payment.method }
        });
        await tx.notification.create({
          data: { userId: payment.userId, type: 'PAYMENT_STATUS', message: `Payment successful for order #${payment.orderId}`, isRead: false }
        });
      } else {
        // FAILED — cancel order and restore stock
        await tx.order.update({ where: { id: payment.orderId }, data: { status: 'CANCELLED' } });
        for (const item of payment.order.items) {
          if (item.productId) {
            await tx.product.update({
              where: { id: item.productId },
              data:  { totalStock: { increment: item.quantity } }
            });
          }
        }
        await tx.notification.create({
          data: { userId: payment.userId, type: 'PAYMENT_STATUS', message: `Payment failed for order #${payment.orderId}. Order cancelled.`, isRead: false }
        });
      }

      return updated;
    });

    return res.status(200).json({
      success: true,
      message: status === 'SUCCESS' ? 'Payment successful.' : 'Payment failed. Order cancelled.',
      data: updatedPayment
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while verifying payment.' });
  }
};

const getPaymentStatus = async (req, res) => {
  try {
    const userId  = req.user.id;
    const isAdmin = req.user.role === 'ADMIN';
    const orderId = parseInt(req.params.orderId);

    const payment = await prisma.payment.findUnique({ where: { orderId }, include: { order: true } });
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found for this order.' });
    if (!isAdmin && payment.userId !== userId) return res.status(403).json({ success: false, message: 'Access denied.' });

    return res.status(200).json({ success: true, message: 'Payment status retrieved successfully.', data: payment });
  } catch (error) {
    console.error('Get payment status error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while fetching payment status.' });
  }
};

const processRefund = async (req, res) => {
  try {
    const payment = await prisma.payment.findUnique({
      where:   { id: parseInt(req.params.id) },
      include: { order: { include: { items: { include: { product: true } } } } }
    });
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found.' });
    if (payment.status !== 'SUCCESS')
      return res.status(400).json({ success: false, message: `Cannot refund payment with status: ${payment.status}` });

    const updatedPayment = await prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id: parseInt(req.params.id) },
        data:  { status: 'REFUNDED' }
      });
      await tx.order.update({
        where: { id: payment.orderId },
        data:  { status: 'RETURNED', refundIssued: true, refundedAt: new Date(), refundAmount: payment.amount }
      });
      for (const item of payment.order.items) {
        if (item.productId) {
          await tx.product.update({
            where: { id: item.productId },
            data:  { totalStock: { increment: item.quantity } }
          });
        }
      }
      await tx.notification.create({
        data: { userId: payment.userId, type: 'PAYMENT_STATUS', message: `Refund processed for order #${payment.orderId}`, isRead: false }
      });
      return updated;
    });

    return res.status(200).json({ success: true, message: 'Refund processed successfully.', data: updatedPayment });
  } catch (error) {
    console.error('Process refund error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while processing refund.' });
  }
};

module.exports = {
  initiatePayment,
  verifyPayment,
  getPaymentStatus,
  processRefund,
  setUpiSettings,
  getUpiSettings,
  getOrderUpiSettings,
};
