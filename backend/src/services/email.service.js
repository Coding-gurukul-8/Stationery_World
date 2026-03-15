const nodemailer = require('nodemailer');

// Create transporter lazily so env vars are always resolved at call time.
let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  const emailPort = parseInt(process.env.EMAIL_PORT, 10) || 587;
  const isSecure  = emailPort === 465; // true for SMTPS (465), false for STARTTLS (587)

  _transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: emailPort,
    secure: isSecure,
    // Force STARTTLS upgrade on port 587 / non-secure connections
    requireTLS: !isSecure,
    // Force IPv4 to avoid ENETUNREACH errors on hosts (e.g. Render) where
    // IPv6 routes to Gmail SMTP are unreachable.
    family: 4,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      // Allow self-signed certs on some hosting environments; still enforces
      // encryption — only disables strict CA chain validation.
      rejectUnauthorized: process.env.EMAIL_TLS_REJECT_UNAUTHORIZED !== 'false',
    },
    connectionTimeout: 10000, // 10 seconds to establish TCP connection
    greetingTimeout: 10000,   // 10 seconds for SMTP greeting
    socketTimeout: 30000,     // 30 seconds — increased from 15s to allow for slower SMTP servers
  });

  return _transporter;
}

// Send OTP Email
const sendOTPEmail = async (email, otp, name = 'User') => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'Password Reset OTP - Stationery World',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #007bff; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
            .otp-box { background: white; padding: 20px; text-align: center; border: 2px dashed #007bff; border-radius: 8px; margin: 20px 0; }
            .otp { font-size: 32px; font-weight: bold; color: #007bff; letter-spacing: 8px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Password Reset Request</h1>
            </div>
            <div class="content">
              <p>Hi ${name},</p>
              <p>You requested to reset your password. Use the OTP below to proceed:</p>
              
              <div class="otp-box">
                <p style="margin: 0; color: #666; font-size: 14px;">Your OTP is:</p>
                <p class="otp">${otp}</p>
                <p style="margin: 0; color: #666; font-size: 12px;">Valid for ${process.env.OTP_EXPIRY_MINUTES || 10} minutes</p>
              </div>

              <div class="warning">
                <strong>⚠️ Security Notice:</strong> Never share this OTP with anyone. Our team will never ask for your OTP.
              </div>

              <p>If you didn't request this, please ignore this email or contact support if you're concerned.</p>
              
              <p>Best regards,<br><strong>Stationery World Team</strong></p>
            </div>
            <div class="footer">
              <p>This is an automated email. Please do not reply.</p>
              <p>&copy; 2026 Stationery World. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `Hi ${name},\n\nYour OTP for password reset is: ${otp}\n\nThis OTP is valid for ${process.env.OTP_EXPIRY_MINUTES || 10} minutes.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nStationery World Team`
    };

    const info = await getTransporter().sendMail(mailOptions);
    console.log('OTP email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending OTP email:', error);
    // Reset cached transporter so the next request creates a fresh connection
    _transporter = null;
    return { success: false, error: error.message };
  }
};

// Test email connection
const testConnection = async () => {
  try {
    await getTransporter().verify();
    console.log('✅ Email service is ready');
    return true;
  } catch (error) {
    console.error('❌ Email service error:', error.message || error);
    // Reset cached transporter so subsequent calls retry with fresh settings
    _transporter = null;
    return false;
  }
};

module.exports = {
  sendOTPEmail,
  testConnection
};