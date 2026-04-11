// user.controller.js  —  Stationery World v4.0
//
// Upgrades:
//  - BUG FIX: OTP NEVER returned in API response when OTP_FALLBACK=false (Section 1.2)
//  - getAllUsers: includes _count.orders and total spend (Section 7)
//  - getUserDetail: new endpoint returning full profile + total orders + total spend
//  - login: normalises email before lookup (performance + correctness)
//  - All existing functions PRESERVED

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../../../prisma/client');
const multer = require('multer');
const path = require('path');
const { sendOTPEmail } = require('../../services/email.service');
const { validatePassword, getPasswordRequirementsText } = require('../../utils/passwordValidator');
const crypto = require('crypto');
const { uploadToSupabase, deleteFromSupabase, userPhotoPath, USER_BUCKET } = require('../../utils/uploadToSupabase');

// ── Multer ────────────────────────────────────────────────────────────────────
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  if (mimetype && extname) return cb(null, true);
  cb(new Error('Only image files (JPEG, JPG, PNG, GIF, WEBP) are allowed!'));
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter
}).single('photo');

// ── Select shape shared across endpoints ──────────────────────────────────────
const USER_SELECT = {
  id: true, name: true, email: true, phone: true, role: true, isActive: true,
  addressLine1: true, addressLine2: true, city: true, state: true,
  postalCode: true, country: true, photoUrl: true, createdAt: true, updatedAt: true
};

// ============================================================================
// SIGNUP
// ============================================================================
const signup = async (req, res) => {
  upload(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, message: err.code === 'LIMIT_FILE_SIZE' ? 'File size exceeds 5MB limit.' : 'File upload error: ' + err.message });
    } else if (err) {
      return res.status(400).json({ success: false, message: err.message || 'File upload failed.' });
    }

    try {
      const { name, email, phone, password, role, addressLine1, addressLine2, city, state, postalCode, country } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
      }

      const emailNormalized = String(email).trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailNormalized)) {
        return res.status(400).json({ success: false, message: 'Invalid email format.' });
      }

      const pwCheck = validatePassword(password);
      if (!pwCheck.isValid) {
        return res.status(400).json({ success: false, message: 'Password does not meet security requirements.', errors: pwCheck.errors, requirements: getPasswordRequirementsText() });
      }

      const existingUser = await prisma.user.findUnique({ where: { email: emailNormalized } });
      if (existingUser) return res.status(409).json({ success: false, message: 'User with this email already exists.' });

      if (phone) {
        const existingPhone = await prisma.user.findUnique({ where: { phone: String(phone).trim() } });
        if (existingPhone) return res.status(409).json({ success: false, message: 'User with this phone number already exists.' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const userRole = role === 'ADMIN' ? 'ADMIN' : 'CUSTOMER';

      const newUser = await prisma.user.create({
        data: {
          name: name.trim(), email: emailNormalized,
          phone: phone ? String(phone).trim() : null,
          passwordHash, role: userRole,
          addressLine1: addressLine1 ? String(addressLine1).trim() : null,
          addressLine2: addressLine2 ? String(addressLine2).trim() : null,
          city: city ? String(city).trim() : null,
          state: state ? String(state).trim() : null,
          postalCode: postalCode ? String(postalCode).trim() : null,
          country: country ? String(country).trim() : null,
          photoUrl: null
        },
        select: USER_SELECT
      });

      if (req.file) {
        try {
          const storagePath = userPhotoPath(newUser.id);
          const photoUrl = await uploadToSupabase(req.file.buffer, req.file.mimetype, storagePath, USER_BUCKET);
          await prisma.user.update({ where: { id: newUser.id }, data: { photoUrl } });
          newUser.photoUrl = photoUrl;
        } catch (uploadErr) {
          console.error('Profile photo upload failed during signup:', uploadErr.message);
        }
      }

      const token = jwt.sign({ userId: newUser.id, email: newUser.email, role: newUser.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

      return res.status(201).json({ success: true, message: 'Account created successfully.', data: { user: newUser, token } });
    } catch (error) {
      console.error('Signup error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error during signup.' });
    }
  });
};

// ============================================================================
// LOGIN — BUG FIX: normalize email before lookup
// ============================================================================
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    // Normalize email — prevents case-mismatch misses
    const emailNormalized = String(email).trim().toLowerCase();

    const user = await prisma.user.findUnique({ where: { email: emailNormalized } });

    if (!user) return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    if (!user.isActive) return res.status(403).json({ success: false, message: 'Account is inactive. Please contact support.' });

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) return res.status(401).json({ success: false, message: 'Invalid email or password.' });

    const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

    return res.status(200).json({
      success: true, message: 'Login successful.',
      data: {
        user: {
          id: user.id, name: user.name, email: user.email, phone: user.phone,
          role: user.role, isActive: user.isActive,
          addressLine1: user.addressLine1 || null, addressLine2: user.addressLine2 || null,
          city: user.city || null, state: user.state || null,
          postalCode: user.postalCode || null, country: user.country || null,
          photoUrl: user.photoUrl || null, createdAt: user.createdAt, updatedAt: user.updatedAt
        },
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error during login.' });
  }
};

// ============================================================================
// GET PROFILE
// ============================================================================
const getProfile = async (req, res) => {
  try {
    return res.status(200).json({ success: true, message: 'Profile retrieved successfully.', data: req.user });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while fetching profile.' });
  }
};

// ============================================================================
// UPDATE PROFILE (with photo upload)
// ============================================================================
const updateProfile = async (req, res) => {
  const contentType = req.headers['content-type'] || '';

  if (contentType.includes('multipart/form-data')) {
    upload(req, res, async (err) => {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ success: false, message: err.code === 'LIMIT_FILE_SIZE' ? 'File size exceeds 5MB limit.' : 'File upload error: ' + err.message });
      } else if (err) {
        return res.status(400).json({ success: false, message: err.message || 'File upload failed.' });
      }
      try {
        const userId = req.user.id;
        if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });

        const oldUser = await prisma.user.findUnique({ where: { id: userId } });
        const storagePath = userPhotoPath(userId);
        const photoUrl = await uploadToSupabase(req.file.buffer, req.file.mimetype, storagePath, USER_BUCKET);

        const updatedUser = await prisma.user.update({ where: { id: userId }, data: { photoUrl }, select: USER_SELECT });

        if (oldUser.photoUrl && oldUser.photoUrl.startsWith('http')) {
          deleteFromSupabase(oldUser.photoUrl, USER_BUCKET).catch(() => {});
        }

        return res.status(200).json({ success: true, message: 'Profile photo updated successfully.', data: updatedUser });
      } catch (error) {
        console.error('Update photo error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error while updating photo.' });
      }
    });
  } else {
    try {
      const { name, phone, password, addressLine1, addressLine2, city, state, postalCode, country } = req.body;
      const userId = req.user.id;
      const updateData = {};

      if (name) updateData.name = name;
      if (phone) {
        const existingPhone = await prisma.user.findUnique({ where: { phone } });
        if (existingPhone && existingPhone.id !== userId) {
          return res.status(409).json({ success: false, message: 'Phone number already in use.' });
        }
        updateData.phone = phone;
      }
      if (password) {
        const pwCheck = validatePassword(password);
        if (!pwCheck.isValid) {
          return res.status(400).json({ success: false, message: 'Password does not meet security requirements.', errors: pwCheck.errors, requirements: getPasswordRequirementsText() });
        }
        updateData.passwordHash = await bcrypt.hash(password, 10);
      }

      if (addressLine1 !== undefined) updateData.addressLine1 = addressLine1 || null;
      if (addressLine2 !== undefined) updateData.addressLine2 = addressLine2 || null;
      if (city !== undefined) updateData.city = city || null;
      if (state !== undefined) updateData.state = state || null;
      if (postalCode !== undefined) updateData.postalCode = postalCode || null;
      if (country !== undefined) updateData.country = country || null;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ success: false, message: 'No fields to update.' });
      }

      const updatedUser = await prisma.user.update({ where: { id: userId }, data: updateData, select: USER_SELECT });

      return res.status(200).json({ success: true, message: 'Profile updated successfully.', data: updatedUser });
    } catch (error) {
      console.error('Update profile error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while updating profile.' });
    }
  }
};

// ============================================================================
// GET ALL USERS (Admin) — 🆕 includes total orders + total spend (Section 7)
// ============================================================================
const getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        ...USER_SELECT,
        _count: { select: { orders: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json({
      success: true, message: 'Users retrieved successfully.',
      data: users, count: users.length
    });
  } catch (error) {
    console.error('Get all users error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while fetching users.' });
  }
};

// ============================================================================
// 🆕 GET USER DETAIL (Admin) — Section 7: Total Orders + Total Spend
// GET /api/user/:id/detail
// ============================================================================
const getUserDetail = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) return res.status(400).json({ success: false, message: 'Invalid user ID.' });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: USER_SELECT
    });

    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    // Total orders (non-cancelled)
    const orders = await prisma.order.findMany({
      where: { userId, status: { notIn: ['CANCELLED', 'RETURNED'] } },
      select: { id: true, totalAmount: true, isPaid: true, status: true, createdAt: true }
    });

    const totalOrders = orders.length;
    const totalSpend = orders.filter(o => o.isPaid).reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    return res.status(200).json({
      success: true, message: 'User detail retrieved.',
      data: {
        ...user,
        totalOrders,
        totalSpend: parseFloat(totalSpend.toFixed(2)),
        recentOrders: orders.slice(0, 10)
      }
    });
  } catch (error) {
    console.error('Get user detail error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while fetching user detail.' });
  }
};

module.exports = {
  signup,
  login,
  getProfile,
  updateProfile,
  getAllUsers,
  getUserDetail
};
