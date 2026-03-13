const express = require('express');
const router = express.Router();
const {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart
} = require('./cart.controller');
const { authMiddleware } = require('../user/user.middleware');

// All cart routes require authentication
router.get('/', authMiddleware, getCart);
router.post('/', authMiddleware, addToCart);
router.put('/:id', authMiddleware, updateCartItem);
router.delete('/:id', authMiddleware, removeFromCart);
router.delete('/clear/all', authMiddleware, clearCart);

module.exports = router;
