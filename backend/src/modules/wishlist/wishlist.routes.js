const express = require('express');
const router = express.Router();
const {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  moveToCart,
  clearWishlist,
  getAllWishlistsAdmin
} = require('./wishlist.controller');
const { authMiddleware } = require('../user/user.middleware');

// ===========================
// ADMIN ROUTES - MUST BE FIRST!
// ===========================
// ✅ ONLY use authMiddleware (admin check is done inside controller)
router.get('/admin/wishlists', authMiddleware, getAllWishlistsAdmin);

// ===========================
// CUSTOMER ROUTES
// ===========================
router.get('/', authMiddleware, getWishlist);
router.post('/', authMiddleware, addToWishlist);
router.delete('/clear/all', authMiddleware, clearWishlist);

// ===========================
// DYNAMIC ROUTES - MUST BE LAST!
// ===========================
router.delete('/:productId', authMiddleware, removeFromWishlist);
router.post('/:productId', authMiddleware, moveToCart);

module.exports = router;