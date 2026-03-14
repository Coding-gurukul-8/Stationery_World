const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
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

// Multer setup (existing)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/products/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'product-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
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

// Image upload route
router.post('/upload-images', authMiddleware, adminMiddleware, upload.array('images', 6), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No images uploaded'
      });
    }

    const urls = req.files.map(file => `/uploads/products/${file.filename}`);

    return res.status(200).json({
      success: true,
      message: 'Images uploaded successfully',
      urls: urls
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