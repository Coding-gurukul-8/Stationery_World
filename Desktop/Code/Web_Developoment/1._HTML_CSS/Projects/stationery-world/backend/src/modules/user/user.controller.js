const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../../../prisma/client');

// Signup controller
const signup = async (req, res) => {
  try {
    console.log('Signup request received');
    console.log('Request body:', { ...req.body, password: '[HIDDEN]' });

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
      country,
      photoUrl
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

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.'
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
        where: { phone }
      });

      if (existingPhone) {
        return res.status(409).json({
          success: false,
          message: 'User with this phone number already exists.'
        });
      }
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
        photoUrl: photoUrl ? String(photoUrl).trim() : null
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

    return res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      data: newUser
    });
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during signup.'
    });
  }
};

// Login controller
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

// Get profile controller
const getProfile = async (req, res) => {
  try {
    console.log('Get profile request for user:', req.user.id);

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

// Update profile controller
const updateProfile = async (req, res) => {
  try {
    console.log('Update profile request for user:', req.user.id);
    console.log('Request body:', { ...req.body, password: req.body.password ? '[HIDDEN]' : undefined });

        const { name, phone, password, addressLine1, addressLine2, city, state, postalCode, country, photoUrl } = req.body;
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
      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long.'
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
    if (photoUrl !== undefined) updateData.photoUrl = photoUrl || null;

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
};

// Get all users (Admin only)
const getAllUsers = async (req, res) => {
  try {
    console.log('Get all users request by admin:', req.user.id);

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

module.exports = {
  signup,
  login,
  getProfile,
  updateProfile,
  getAllUsers
};
