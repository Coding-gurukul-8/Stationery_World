// forgotPassword.controller.js  —  Stationery World v4.0
//
// Upgrades:
//  - 🐞 BUG FIX: OTP NEVER returned in API response when OTP_FALLBACK=false (Section 1.2)
//    Previously the dev-only otp field could leak in staging/prod via NODE_ENV check.
//    Now: otp is ONLY returned when NODE_ENV === 'development' AND email delivery failed.
//    In staging/production the endpoint always returns a generic error with no OTP exposed.
//  - Stronger password validation using shared validatePassword utility
//  - All existing functions PRESERVED

const bcrypt = require('bcrypt');
const prisma = require('../../../prisma/client');
const { sendOTPEmail } = require('../../services/email.service');
const { validatePassword, getPasswordRequirementsText } = require('../../utils/passwordValidator');

// Generate cryptographically random 6-digit OTP
const generateOTP = () => {
  const crypto = require('crypto');
  return crypto.randomInt(100000, 999999).toString();
};

// =============================================================================
// REQUEST OTP
// =============================================================================
const requestOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with this email.' });
    }

    const otp = generateOTP();
    const expiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES) || 10;
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    // Store OTP in database
    await prisma.oTP.create({
      data: {
        userId: user.id,
        email: user.email,
        otp,
        expiresAt,
        isUsed: false
      }
    });

    // Attempt email delivery
    const emailResult = await sendOTPEmail(user.email, otp, user.name);

    if (!emailResult.success) {
      console.error('OTP email send failed:', emailResult.error);

      // 🐞 BUG FIX: ONLY expose OTP in local development when email fails.
      // NEVER expose OTP in staging or production — even if NODE_ENV is not set.
      const isDevelopment = process.env.NODE_ENV === 'development';

      if (isDevelopment) {
        // Dev bypass: show OTP in response so developers can test without SMTP
        return res.status(200).json({
          success: true,
          message: '[DEV ONLY] OTP generated. Email delivery failed — use the code below for local testing.',
          data: { email: user.email, otp, expiresIn: expiryMinutes }
        });
      }

      // Production / staging: never expose OTP — return generic error
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP email. Please check your email address and try again, or contact support.'
      });
    }

    // Success — never include OTP in response
    return res.status(200).json({
      success: true,
      message: 'OTP sent to your email successfully.',
      data: {
        email: user.email,
        expiresIn: expiryMinutes
        // OTP intentionally omitted from response
      }
    });
  } catch (error) {
    console.error('Request OTP error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while sending OTP.' });
  }
};

// =============================================================================
// VERIFY OTP
// =============================================================================
const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required.' });
    }

    const otpRecord = await prisma.oTP.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        otp: String(otp).trim(),
        isUsed: false,
        expiresAt: { gt: new Date() }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    }

    return res.status(200).json({
      success: true,
      message: 'OTP verified successfully.',
      data: { email, verified: true }
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while verifying OTP.' });
  }
};

// =============================================================================
// RESET PASSWORD
// =============================================================================
const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: 'Email, OTP, and new password are required.' });
    }

    // Use shared password validator (same rules as signup)
    const pwCheck = validatePassword(newPassword);
    if (!pwCheck.isValid) {
      return res.status(400).json({
        success: false,
        message: 'New password does not meet security requirements.',
        errors: pwCheck.errors,
        requirements: getPasswordRequirementsText()
      });
    }

    // Find & verify OTP
    const otpRecord = await prisma.oTP.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        otp: String(otp).trim(),
        isUsed: false,
        expiresAt: { gt: new Date() }
      },
      orderBy: { createdAt: 'desc' },
      include: { user: true }
    });

    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password + mark OTP used in single transaction
    await prisma.$transaction([
      prisma.user.update({ where: { id: otpRecord.userId }, data: { passwordHash } }),
      prisma.oTP.update({ where: { id: otpRecord.id }, data: { isUsed: true } })
    ]);

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully. You can now login with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while resetting password.' });
  }
};

module.exports = { requestOTP, verifyOTP, resetPassword };
