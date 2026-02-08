const express = require('express');
const router = express.Router();
const {
  createOrder,
  getOrderById,
  getSelfOrders,
  getAllOrders,
  updateOrderStatus
} = require('./order.controller');
const { authMiddleware, adminMiddleware } = require('../user/user.middleware');

// Dev-only: return static mock orders (no auth) — useful for frontend testing
router.get('/mock', (req, res) => {
  const now = new Date().toISOString();
  const sampleOrders = [
    {
      id: 1001,
      uid: 'MOCK-SELF-1001',
      createdAt: now,
      placedBy: { id: 1, name: 'Admin User', email: 'admin@example.com' },
      adminId: 1,
      type: 'SELF',
      status: 'PENDING',
      recipientName: 'Admin Office',
      addressLine1: '123 Admin St',
      city: 'Test City',
      country: 'Testland',
      items: [
        { productName: 'A4 Lined Notebook', productPhoto: 'https://via.placeholder.com/150', quantity: 2, sp: 50.0, cp: 30.0, subtotalSp: 100.0, subtotalCp: 60.0 }
      ],
      totalSp: 100.0,
      totalCp: 60.0,
      audits: [ { admin: { name: 'Admin User' }, fromStatus: 'PENDING', toStatus: 'PENDING', createdAt: now } ]
    },
    {
      id: 1002,
      uid: 'MOCK-CUST-1002',
      createdAt: now,
      placedBy: { id: 2, name: 'John Customer', email: 'customer@example.com' },
      type: 'CUSTOMER',
      status: 'PROCESSING',
      recipientName: 'John Customer',
      addressLine1: '456 Customer Ave',
      city: 'Client Town',
      country: 'Clientland',
      items: [
        { productName: 'Rubber Eraser', productPhoto: 'https://via.placeholder.com/150', quantity: 3, sp: 12.0, cp: 5.0, subtotalSp: 36.0, subtotalCp: 15.0 }
      ],
      totalSp: 36.0,
      totalCp: 15.0,
      audits: [ { admin: null, fromStatus: 'PENDING', toStatus: 'PROCESSING', createdAt: now } ]
    }
  ];

  return res.json({ success: true, message: 'Mock orders returned', data: sampleOrders });
});

// Create an order (customer or admin)
router.post('/', authMiddleware, createOrder);

// Get self orders (for logged-in admin -> type=SELF)
router.get('/self', authMiddleware, getSelfOrders);

// Admin: list all orders (others)
router.get('/', authMiddleware, adminMiddleware, getAllOrders);

// Get order details (protected)
router.get('/:id', authMiddleware, getOrderById);

// Admin: update order status
router.patch('/:id/status', authMiddleware, adminMiddleware, updateOrderStatus);

module.exports = router;
