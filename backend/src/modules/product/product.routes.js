const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { uploadToCloudinary } = require('../../utils/cloudinary');
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

// Multer setup — use memory storage so files are uploaded to Cloudinary, not local disk
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

// Image upload route — stores images permanently on Cloudinary
router.post('/upload-images', authMiddleware, adminMiddleware, upload.array('images', 6), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No images uploaded'
      });
    }

    const uploads = await Promise.all(
      req.files.map(file => uploadToCloudinary(file.buffer, 'stationery_world/products'))
    );
    const urls = uploads.map(u => u.url);

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