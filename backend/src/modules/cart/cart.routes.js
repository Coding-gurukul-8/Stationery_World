// cart.routes.js  —  Stationery World v4.0

const express = require('express');
const router = express.Router();
const {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  validateCartStock
} = require('./cart.controller');
const { authMiddleware } = require('../user/user.middleware');

// All cart routes require authentication
router.get('/', authMiddleware, getCart);
router.post('/', authMiddleware, addToCart);

// 🆕 Stock validation before checkout (Section 10.3)
router.post('/validate', authMiddleware, validateCartStock);

// NOTE: /clear/all must be before /:id so it isn't captured as a cart item ID
router.delete('/clear/all', authMiddleware, clearCart);
router.put('/:id', authMiddleware, updateCartItem);
router.delete('/:id', authMiddleware, removeFromCart);

module.exports = router;
