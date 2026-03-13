const express = require('express');
const router = express.Router();
const {
  signup,
  login,
  getProfile,
  updateProfile,
  getAllUsers
} = require('./user.controller');
const { requestOTP, verifyOTP, resetPassword } = require('./forgotPassword.controller'); // ✅ NEW
const { authMiddleware, adminMiddleware } = require('./user.middleware');
const prisma = require('../../../prisma/client'); // For admin update route

// ===========================
// PUBLIC ROUTES
// ===========================
router.post('/signup', signup);
router.post('/login', login);

// ✅ NEW: Forgot password routes (public)
router.post('/forgot-password', requestOTP);
router.post('/verify-otp', verifyOTP);
router.post('/reset-password', resetPassword);

// ===========================
// PROTECTED ROUTES (require authentication)
// ===========================
router.get('/profile', authMiddleware, getProfile);
router.put('/profile', authMiddleware, updateProfile);

// ===========================
// ADMIN-ONLY ROUTES
// ===========================
router.get('/all', authMiddleware, adminMiddleware, getAllUsers);

// Admin: update a user (except role)
router.put('/:id', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id);
    
    if (isNaN(userId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid user id.' 
      });
    }

    // Build allowed update fields only
    const allowed = [
      'name',
      'email',
      'phone',
      'isActive',
      'addressLine1',
      'addressLine2',
      'city',
      'state',
      'postalCode',
      'country',
      'photoUrl'
    ];
    
    const payload = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) {
        payload[k] = req.body[k];
      }
    }

    // Prevent changing role through this endpoint
    if (req.body.role !== undefined) {
      return res.status(403).json({ 
        success: false, 
        message: 'Role cannot be changed here.' 
      });
    }

    // Check unique constraints: email & phone
    if (payload.email) {
      const existing = await prisma.user.findUnique({ 
        where: { email: payload.email } 
      });
      
      if (existing && existing.id !== userId) {
        return res.status(409).json({ 
          success: false, 
          message: 'Email already in use.' 
        });
      }
    }
    
    if (payload.phone) {
      const existingPhone = await prisma.user.findUnique({ 
        where: { phone: payload.phone } 
      });
      
      if (existingPhone && existingPhone.id !== userId) {
        return res.status(409).json({ 
          success: false, 
          message: 'Phone number already in use.' 
        });
      }
    }

    const updated = await prisma.user.update({ 
      where: { id: userId }, 
      data: payload, 
      select: { 
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        postalCode: true,
        country: true,
        photoUrl: true,
        createdAt: true,
        updatedAt: true 
      } 
    });

    return res.status(200).json({ 
      success: true, 
      message: 'User updated successfully', 
      data: updated 
    });
  } catch (err) {
    console.error('Admin update user error:', err);
    next(err);
  }
});

const multer = require('multer');
const path = require('path');

const userStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/users/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'user-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const userUpload = multer({
  storage: userStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) return cb(null, true);
    cb(new Error('Only image files are allowed!'));
  }

  
});

router.post('/signup', userUpload.single('photo'), signup);

module.exports = router;