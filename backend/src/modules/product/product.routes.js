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
  createProduct,
  updateProduct,
  deleteProduct,
  toggleProductStatus,
  getLowStockProducts,
  restockProduct,
  getInventoryLogs,
  notifyMeWhenAvailable  // ← ADD THIS
} = require('./product.controller');
const { authMiddleware, adminMiddleware } = require('../user/user.middleware');
const { uploadToSupabase, productImagePath } = require('../../utils/uploadToSupabase');

// Multer uses memory storage — files are held in-process and uploaded to
// Supabase Storage rather than written to the local filesystem.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed!'));
  }
});

// Rate limiter for the image-upload endpoint — 30 requests per minute per IP.
const uploadRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many upload requests. Please wait a moment and try again.' }
});

// Image upload route
router.post('/upload-images', uploadRateLimiter, authMiddleware, adminMiddleware, upload.array('images', 6), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No images uploaded'
      });
    }

    const uploadPromises = req.files.map((file) => {
      const storagePath = productImagePath(file.originalname);
      return uploadToSupabase(file.buffer, file.mimetype, storagePath);
    });

    const urls = await Promise.all(uploadPromises);

    return res.status(200).json({
      success: true,
      message: 'Images uploaded successfully',
      urls
    });
  } catch (error) {
    console.error('Image upload error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload images'
    });
  }
});

// Admin routes (specific before dynamic)
router.get('/admin/low-stock', authMiddleware, adminMiddleware, getLowStockProducts);

// Public routes
router.get('/', getAllProducts);
router.get('/recommended', authMiddleware, getRecommendedProducts);
router.get('/category/:category', getProductsByCategory);

// Admin-only routes
router.post('/', authMiddleware, adminMiddleware, createProduct);

// Dynamic routes (must be last)
router.get('/:id', getProductById);
router.get('/:id/logs', authMiddleware, adminMiddleware, getInventoryLogs);
router.post('/:id/notify', authMiddleware, notifyMeWhenAvailable);  // ← ADD THIS
router.put('/:id', authMiddleware, adminMiddleware, updateProduct);
router.delete('/:id', authMiddleware, adminMiddleware, deleteProduct);
router.patch('/:id/toggle-status', authMiddleware, adminMiddleware, toggleProductStatus);
router.post('/:id/restock', authMiddleware, adminMiddleware, restockProduct);

module.exports = router;