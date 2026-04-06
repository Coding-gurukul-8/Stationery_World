const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const rateLimit = require('express-rate-limit');
const {
  getAllProducts,
  getProductById,
  getProductsByCategory,
  getRecommendedProducts,
  getCustomerProducts,
  customerSearch,
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

// Image upload
router.post('/upload-images', uploadRateLimiter, authMiddleware, adminMiddleware, upload.array('images', 6), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No images uploaded' });
    }
    const productId = req.query.productId || null;
    const uploadPromises = req.files.map((file, idx) => {
      let storagePath;
      if (productId) {
        storagePath = `${productId}/image-${idx}.webp`;
      } else {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        storagePath = `tmp/${unique}.webp`;
      }
      return uploadToSupabase(file.buffer, file.mimetype, storagePath, PRODUCT_BUCKET);
    });
    const urls = await Promise.all(uploadPromises);
    return res.status(200).json({ success: true, message: 'Images uploaded successfully', urls });
  } catch (error) {
    console.error('Image upload error:', error);
    return res.status(500).json({ success: false, message: 'Failed to upload images' });
  }
});

// Admin-specific static routes (before dynamic /:id)
router.get('/admin/low-stock', authMiddleware, adminMiddleware, getLowStockProducts);

// ─── Customer-facing endpoints (optionalAuth so both guests & logged-in work) ──
// IMPORTANT: these must come before the generic /:id dynamic route
router.get('/customer', optionalAuth, getCustomerProducts);
router.get('/customer/search', optionalAuth, customerSearch);

// Interaction tracking (authenticated)
router.post('/track-interaction', authMiddleware, trackInteraction);

// Public general routes
router.get('/', getAllProducts);
router.get('/recommended', authMiddleware, getRecommendedProducts);
router.get('/category/:category', getProductsByCategory);

// Admin mutation routes
router.post('/', authMiddleware, adminMiddleware, createProduct);

// Dynamic routes (MUST be last to avoid shadowing named routes above)
router.get('/:id', getProductById);
router.get('/:id/logs', authMiddleware, adminMiddleware, getInventoryLogs);
router.post('/:id/notify', authMiddleware, notifyMeWhenAvailable);
router.put('/:id', authMiddleware, adminMiddleware, updateProduct);
router.delete('/:id', authMiddleware, adminMiddleware, deleteProduct);
router.patch('/:id/toggle-status', authMiddleware, adminMiddleware, toggleProductStatus);
router.post('/:id/restock', authMiddleware, adminMiddleware, restockProduct);

// ── Variant group routes (admin) ─────────────────────────────────────────────
router.get( '/variants/groups',                                  authMiddleware, adminMiddleware, getVariantGroups);
router.post('/variants/groups',                                  authMiddleware, adminMiddleware, createVariantGroup);
router.get( '/variants/groups/:groupId',                         authMiddleware, adminMiddleware, getVariantGroupById);
router.post('/variants/groups/:groupId/products/:productId',     authMiddleware, adminMiddleware, addProductToVariantGroup);
router.delete('/variants/products/:productId/group',             authMiddleware, adminMiddleware, removeProductFromVariantGroup);

// ── Product image management (admin) ─────────────────────────────────────────
// PUT  /api/products/:id/images        — append or replace (multipart, field: images)
//   Body: mode=append|replace, position=<int> (for replace only)
// DELETE /api/products/:id/images/:imageId — remove one image
router.put(   '/:id/images',          authMiddleware, adminMiddleware, manageProductImages);
router.delete('/:id/images/:imageId', authMiddleware, adminMiddleware, deleteProductImage);


module.exports = router;
