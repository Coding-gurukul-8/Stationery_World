// product.routes.js  —  Stationery World v4.0

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const rateLimit = require('express-rate-limit');
const {
  getAllProducts,
  getProductById,
  getProductsByCategory,
  getSubCategories,
  getRecommendedProducts,
  getCustomerProducts,
  customerSearch,
  recordSearchClick,
  trackInteraction,
  createProduct,
  updateProduct,
  deleteProduct,
  toggleProductStatus,
  getLowStockProducts,
  restockProduct,
  getInventoryLogs,
  notifyMeWhenAvailable,
  manageProductImages,
  deleteProductImage,
  createVariantGroup,
  getVariantGroups,
  getVariantGroupById,
  addProductToVariantGroup,
  removeProductFromVariantGroup,
} = require('./product.controller');
const { authMiddleware, adminMiddleware, optionalAuth } = require('../user/user.middleware');
const { uploadToSupabase, PRODUCT_BUCKET } = require('../../utils/uploadToSupabase');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) return cb(null, true);
    cb(new Error('Only image files are allowed!'));
  }
});

const uploadRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many upload requests. Please wait a moment and try again.' }
});

// ── Image upload ──────────────────────────────────────────────────────────────
router.post('/upload-images', uploadRateLimiter, authMiddleware, adminMiddleware, upload.array('images', 6), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No images uploaded' });
    }
    const productId = req.query.productId || null;
    const uploadPromises = req.files.map((file, idx) => {
      const storagePath = productId
        ? `${productId}/image-${idx}.webp`
        : `tmp/${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`;
      return uploadToSupabase(file.buffer, file.mimetype, storagePath, PRODUCT_BUCKET);
    });
    const urls = await Promise.all(uploadPromises);
    return res.status(200).json({ success: true, message: 'Images uploaded successfully', urls });
  } catch (error) {
    console.error('Image upload error:', error);
    return res.status(500).json({ success: false, message: 'Failed to upload images' });
  }
});

// ── Static admin routes (must be before /:id) ────────────────────────────────
router.get('/admin/low-stock', authMiddleware, adminMiddleware, getLowStockProducts);

// ── 🆕 SubCategories (Section 2.4 — Shop By Category) ───────────────────────
router.get('/subcategories', optionalAuth, getSubCategories);

// ── Customer catalog ─────────────────────────────────────────────────────────
router.get('/customer', optionalAuth, getCustomerProducts);
router.get('/customer/search', optionalAuth, customerSearch);

// ── 🆕 Search click (self-learning) — Section 2.3 ───────────────────────────
router.post('/search/click', optionalAuth, recordSearchClick);

// ── Recommended products ──────────────────────────────────────────────────────
router.get('/recommended', authMiddleware, getRecommendedProducts);

// ── Variant groups ────────────────────────────────────────────────────────────
router.post('/variant-groups', authMiddleware, adminMiddleware, createVariantGroup);
router.get('/variant-groups', getVariantGroups);
router.get('/variant-groups/:groupId', getVariantGroupById);
router.post('/variant-groups/:groupId/products/:productId', authMiddleware, adminMiddleware, addProductToVariantGroup);
router.delete('/variant-groups/products/:productId', authMiddleware, adminMiddleware, removeProductFromVariantGroup);

// ── Track interaction ─────────────────────────────────────────────────────────
router.post('/track-interaction', authMiddleware, trackInteraction);

// ── General product routes ────────────────────────────────────────────────────
router.get('/', optionalAuth, getAllProducts);
router.get('/category/:category', getProductsByCategory);

// ── Product-specific routes (must be after all static routes) ────────────────
router.get('/:id', getProductById);
router.post('/', authMiddleware, adminMiddleware, createProduct);
router.put('/:id', authMiddleware, adminMiddleware, updateProduct);
router.delete('/:id', authMiddleware, adminMiddleware, deleteProduct);
router.patch('/:id/toggle-status', authMiddleware, adminMiddleware, toggleProductStatus);
router.post('/:id/restock', authMiddleware, adminMiddleware, restockProduct);
router.get('/:id/inventory-logs', authMiddleware, adminMiddleware, getInventoryLogs);
router.post('/:id/notify-me', authMiddleware, notifyMeWhenAvailable);

// ── Product image management ──────────────────────────────────────────────────
router.put('/:id/images', authMiddleware, adminMiddleware, ...manageProductImages);
router.delete('/:id/images/:imageId', authMiddleware, adminMiddleware, deleteProductImage);

module.exports = router;
