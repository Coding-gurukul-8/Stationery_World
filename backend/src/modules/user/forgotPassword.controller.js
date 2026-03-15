const bcrypt = require('bcrypt');
const prisma = require('../../../prisma/client');
const { sendOTPEmail } = require('../../services/email.service');

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// ===========================
// REQUEST OTP
// ===========================
const requestOTP = async (req, res) => {
  try {
    const { email } = req.body;

    console.log('OTP request for:', email);

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required.'
      });
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email.'
      });
    }

    // Generate OTP
    const otp = generateOTP();
    const expiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES) || 10;
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    // Store OTP in database (using OTP table)
    await prisma.oTP.create({
      data: {
        userId: user.id,
        email: user.email,
        otp: otp,
        expiresAt: expiresAt,
        isUsed: false
      }
    });

    // Send OTP via email
    const emailResult = await sendOTPEmail(user.email, otp, user.name);

    if (!emailResult.success) {
      console.error('OTP email send failed:', emailResult.error);

      // Only expose the OTP in the API response during local development.
      // Never return it in staging or production environments.
      if (process.env.NODE_ENV === 'development') {
        return res.status(200).json({
          success: true,
          message: 'OTP generated (email delivery failed). Use the OTP below for local testing.',
          data: { email: user.email, otp, expiresIn: expiryMinutes }
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP email. Please try again later.'
      });
    }

    console.log('OTP sent successfully to:', user.email);

    return res.status(200).json({
      success: true,
      message: 'OTP sent to your email successfully.',
      data: {
        email: user.email,
        expiresIn: expiryMinutes
      }
    });
  } catch (error) {
    console.error('Request OTP error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while sending OTP.'
    });
  }
};

// ===========================
// VERIFY OTP
// ===========================
const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    console.log('OTP verification for:', email);

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required.'
      });
    }

    // Find the latest OTP for this email
    const otpRecord = await prisma.oTP.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        otp: otp,
        isUsed: false,
        expiresAt: {
          gt: new Date() // Not expired
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP.'
      });
    }

    console.log('OTP verified successfully for:', email);

    // Don't mark as used yet - will do that when password is reset
    return res.status(200).json({
      success: true,
      message: 'OTP verified successfully.',
      data: {
        email: email,
        verified: true
      }
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while verifying OTP.'
    });
  }
};

// ===========================
// RESET PASSWORD
// ===========================
const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    console.log('Password reset request for:', email);

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email, OTP, and new password are required.'
      });
    }

    // Validate password
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.'
      });
    }

    // Find and verify OTP
    const otpRecord = await prisma.oTP.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        otp: otp,
        isUsed: false,
        expiresAt: {
          gt: new Date()
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        user: true
      }
    });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP.'
      });
    }

    // Hash new password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password and mark OTP as used in transaction
    await prisma.$transaction([
      // Update password
      prisma.user.update({
        where: { id: otpRecord.userId },
        data: { passwordHash }
      }),
      // Mark OTP as used
      prisma.oTP.update({
        where: { id: otpRecord.id },
        data: { isUsed: true }
      })
    ]);

    console.log('Password reset successfully for:', email);

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully. You can now login with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while resetting password.'
    });
  }
};

module.exports = {
  requestOTP,
  verifyOTP,
  resetPassword
};