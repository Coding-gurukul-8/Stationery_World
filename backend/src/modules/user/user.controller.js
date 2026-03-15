const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../../../prisma/client');
const multer = require('multer');
const path = require('path');
const { sendOTPEmail } = require('../../services/email.service');
const { validatePassword, getPasswordRequirementsText } = require('../../utils/passwordValidator');
const { uploadToCloudinary, deleteFromCloudinary } = require('../../utils/cloudinary');
const crypto = require('crypto');

// ===========================
// MULTER CONFIGURATION
// ===========================

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, JPG, PNG, GIF, WEBP) are allowed!'));
  }
};

// Multer instance — use memory storage so files are uploaded to Cloudinary, not local disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
}).single('photo'); // 'photo' is the field name from frontend

// ===========================
// SIGNUP CONTROLLER
// ===========================

const signup = async (req, res) => {
  // Handle file upload first
  upload(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      // Multer error
      console.error('Multer error:', err);
      return res.status(400).json({
        success: false,
        message: err.code === 'LIMIT_FILE_SIZE' 
          ? 'File size exceeds 5MB limit.' 
          : 'File upload error: ' + err.message
      });
    } else if (err) {
      // Other errors
      console.error('File upload error:', err);
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload failed.'
      });
    }

    // Track Cloudinary publicId so we can clean up on failure
    let cloudinaryPublicId = null;

    try {
      console.log('Signup request received');
      console.log('Request body:', { ...req.body, password: '[HIDDEN]' });
      console.log('Uploaded file:', req.file ? req.file.originalname : 'No file uploaded');

      const {
        name,
        email,
        phone,
        password,
        role,
        addressLine1,
        addressLine2,
        city,
        state,
        postalCode,
        country
      } = req.body;

      // Validate required fields
      if (!name || !email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Name, email, and password are required.'
        });
      }

      // Normalize & validate email format
      const emailNormalized = String(email).trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailNormalized)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format.'
        });
      }

      // ✅ Password strength — shared validator
      const pwCheck = validatePassword(password);
      if (!pwCheck.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Password does not meet security requirements.',
          errors: pwCheck.errors,
          requirements: getPasswordRequirementsText()
        });
      }

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: emailNormalized }
      });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'User with this email already exists.'
        });
      }

      // Check if phone is already used (if provided)
      if (phone) {
        const existingPhone = await prisma.user.findUnique({
          where: { phone: String(phone).trim() }
        });

        if (existingPhone) {
          return res.status(409).json({
            success: false,
            message: 'User with this phone number already exists.'
          });
        }
      }

      // Upload photo to Cloudinary (if provided)
      let photoUrl = null;
      if (req.file) {
        const uploaded = await uploadToCloudinary(req.file.buffer, 'stationery_world/users');
        photoUrl = uploaded.url;
        cloudinaryPublicId = uploaded.publicId;
      }

      // Hash password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Determine user role (default to CUSTOMER)
      const userRole = role === 'ADMIN' ? 'ADMIN' : 'CUSTOMER';

      // Create user with optional profile fields
      const newUser = await prisma.user.create({
        data: {
          name: name.trim(),
          email: emailNormalized,
          phone: phone ? String(phone).trim() : null,
          passwordHash,
          role: userRole,
          addressLine1: addressLine1 ? String(addressLine1).trim() : null,
          addressLine2: addressLine2 ? String(addressLine2).trim() : null,
          city: city ? String(city).trim() : null,
          state: state ? String(state).trim() : null,
          postalCode: postalCode ? String(postalCode).trim() : null,
          country: country ? String(country).trim() : null,
          photoUrl: photoUrl
        },
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

      console.log('User created successfully:', newUser.id);

      // ✅ Generate JWT immediately — auto-login after signup
      const token = jwt.sign(
        { userId: newUser.id, email: newUser.email, role: newUser.role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.status(201).json({
        success: true,
        message: 'Account created successfully.',
        data: { user: newUser, token }
      });
    } catch (error) {
      // Delete Cloudinary image if database operation fails
      if (cloudinaryPublicId) await deleteFromCloudinary(cloudinaryPublicId);

      console.error('Signup error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error during signup.'
      });
    }
  });
};

// ===========================
// LOGIN CONTROLLER
// ===========================

const login = async (req, res) => {
  try {
    console.log('Login request received');
    console.log('Request body:', { ...req.body, password: '[HIDDEN]' });

    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.'
      });
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is inactive. Please contact support.'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '7d' // Token valid for 7 days
      }
    );

    console.log('User logged in successfully:', user.id);

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          isActive: user.isActive,
          addressLine1: user.addressLine1 || null,
          addressLine2: user.addressLine2 || null,
          city: user.city || null,
          state: user.state || null,
          postalCode: user.postalCode || null,
          country: user.country || null,
          photoUrl: user.photoUrl || null,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        },
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during login.'
    });
  }
};

// ===========================
// FORGOT PASSWORD (SEND OTP)
// ===========================

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required.'
      });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No user found with this email.'
      });
    }

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Save OTP to database
    await prisma.user.update({
      where: { email: email.toLowerCase().trim() },
      data: {
        resetOTP: otp,
        resetOTPExpiry: otpExpiry
      }
    });

    // Send OTP email
    await sendOTPEmail(user.email, user.name, otp);

    return res.status(200).json({
      success: true,
      message: 'OTP sent to your email. Valid for 10 minutes.'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send OTP. Please try again.'
    });
  }
};

// ===========================
// VERIFY OTP
// ===========================

const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required.'
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    if (!user.resetOTP || !user.resetOTPExpiry) {
      return res.status(400).json({
        success: false,
        message: 'No OTP request found. Please request a new OTP.'
      });
    }

    if (new Date() > user.resetOTPExpiry) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new one.'
      });
    }

    if (user.resetOTP !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'OTP verified successfully. You can now reset your password.'
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify OTP.'
    });
  }
};

// ===========================
// RESET PASSWORD
// ===========================

const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email, OTP, and new password are required.'
      });
    }

    // ✅ Password strength — shared validator
    const pwCheck = validatePassword(newPassword);
    if (!pwCheck.isValid) {
      return res.status(400).json({
        success: false,
        message: 'New password does not meet security requirements.',
        errors: pwCheck.errors,
        requirements: getPasswordRequirementsText()
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    if (!user.resetOTP || !user.resetOTPExpiry) {
      return res.status(400).json({
        success: false,
        message: 'No OTP request found.'
      });
    }

    if (new Date() > user.resetOTPExpiry) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired.'
      });
    }

    if (user.resetOTP !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP.'
      });
    }

    // Hash new password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password and clear OTP
    await prisma.user.update({
      where: { email: email.toLowerCase().trim() },
      data: {
        passwordHash,
        resetOTP: null,
        resetOTPExpiry: null
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully. You can now login with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reset password.'
    });
  }
};

// ===========================
// GET PROFILE CONTROLLER
// ===========================

const getProfile = async (req, res) => {
  try {

    // User is already attached by authMiddleware
    return res.status(200).json({
      success: true,
      message: 'Profile retrieved successfully.',
      data: req.user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching profile.'
    });
  }
};

// ===========================
// UPDATE PROFILE CONTROLLER (WITH PHOTO UPLOAD)
// ===========================

const updateProfile = async (req, res) => {
  // Check if this is a photo upload request
  const contentType = req.headers['content-type'] || '';
  
  if (contentType.includes('multipart/form-data')) {
    // Handle photo upload
    upload(req, res, async (err) => {
      if (err instanceof multer.MulterError) {
        console.error('Multer error:', err);
        return res.status(400).json({
          success: false,
          message: err.code === 'LIMIT_FILE_SIZE' 
            ? 'File size exceeds 5MB limit.' 
            : 'File upload error: ' + err.message
        });
      } else if (err) {
        console.error('File upload error:', err);
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload failed.'
        });
      }

      try {
        const userId = req.user.id;

        console.log('Photo upload request for user:', userId);
        console.log('Uploaded file:', req.file ? req.file.originalname : 'No file');

        if (!req.file) {
          return res.status(400).json({
            success: false,
            message: 'No file uploaded.'
          });
        }

        // Get old user to delete old Cloudinary photo
        const oldUser = await prisma.user.findUnique({
          where: { id: userId }
        });

        // Upload new photo to Cloudinary
        let cloudinaryPublicId = null;
        let photoUrl = null;
        try {
          const uploaded = await uploadToCloudinary(req.file.buffer, 'stationery_world/users');
          photoUrl = uploaded.url;
          cloudinaryPublicId = uploaded.publicId;
        } catch (uploadErr) {
          console.error('Cloudinary upload error:', uploadErr);
          return res.status(500).json({
            success: false,
            message: 'Failed to upload photo to cloud storage.'
          });
        }

        const updatedUser = await prisma.user.update({
          where: { id: userId },
          data: { photoUrl },
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

        // Delete old Cloudinary photo after successful DB update
        if (oldUser && oldUser.photoUrl) {
          await deleteFromCloudinary(oldUser.photoUrl);
        }

        console.log('Profile photo updated successfully:', userId);

        return res.status(200).json({
          success: true,
          message: 'Profile photo updated successfully.',
          data: updatedUser
        });
      } catch (error) {
        // Delete newly uploaded Cloudinary image if DB operation fails
        if (cloudinaryPublicId) await deleteFromCloudinary(cloudinaryPublicId);

        console.error('Update photo error:', error);
        return res.status(500).json({
          success: false,
          message: 'Internal server error while updating photo.'
        });
      }
    });
  } else {
    // Handle regular field updates (non-photo)
    try {
      console.log('Update profile request for user:', req.user.id);
      console.log('Request body:', { ...req.body, password: req.body.password ? '[HIDDEN]' : undefined });

      const { name, phone, password, addressLine1, addressLine2, city, state, postalCode, country } = req.body;
      const userId = req.user.id;

      // Build update data object
      const updateData = {};

      if (name) {
        updateData.name = name;
      }

      if (phone) {
        // Check if phone is already used by another user
        const existingPhone = await prisma.user.findUnique({
          where: { phone }
        });

        if (existingPhone && existingPhone.id !== userId) {
          return res.status(409).json({
            success: false,
            message: 'Phone number already in use.'
          });
        }

        updateData.phone = phone;
      }

      if (password) {
        // ✅ Password strength — shared validator
        const pwCheck = validatePassword(password);
        if (!pwCheck.isValid) {
          return res.status(400).json({
            success: false,
            message: 'Password does not meet security requirements.',
            errors: pwCheck.errors,
            requirements: getPasswordRequirementsText()
          });
        }

        const saltRounds = 10;
        updateData.passwordHash = await bcrypt.hash(password, saltRounds);
      }

      // Optional profile fields
      if (addressLine1 !== undefined) updateData.addressLine1 = addressLine1 || null;
      if (addressLine2 !== undefined) updateData.addressLine2 = addressLine2 || null;
      if (city !== undefined) updateData.city = city || null;
      if (state !== undefined) updateData.state = state || null;
      if (postalCode !== undefined) updateData.postalCode = postalCode || null;
      if (country !== undefined) updateData.country = country || null;

      // Check if there's anything to update
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No fields to update.'
        });
      }

      // Update user
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData,
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

      console.log('Profile updated successfully:', userId);

      return res.status(200).json({
        success: true,
        message: 'Profile updated successfully.',
        data: updatedUser
      });
    } catch (error) {
      console.error('Update profile error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error while updating profile.'
      });
    }
  }
};

// ===========================
// GET ALL USERS (ADMIN ONLY)
// ===========================

const getAllUsers = async (req, res) => {
  try {

    const users = await prisma.user.findMany({
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
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Users retrieved successfully.',
      data: users,
      count: users.length
    });
  } catch (error) {
    console.error('Get all users error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching users.'
    });
  }
};

// ===========================
// EXPORTS
// ===========================

module.exports = {
  signup,
  login,
  forgotPassword,
  verifyOTP,
  resetPassword,
  getProfile,
  updateProfile,
  getAllUsers
};