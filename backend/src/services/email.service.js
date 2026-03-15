const nodemailer = require('nodemailer');
const https = require('https');

// ---------------------------------------------------------------
// SMTP Transporter (local dev / hosts that allow outbound SMTP)
// ---------------------------------------------------------------

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
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      // Allow self-signed certs on some hosting environments; still enforces
      // encryption — only disables strict CA chain validation.
      rejectUnauthorized: process.env.EMAIL_TLS_REJECT_UNAUTHORIZED !== 'false',
    },
    // Reduced timeouts so SMTP failures surface quickly rather than blocking
    // for a long time (some cloud hosts block outbound SMTP entirely).
    connectionTimeout: 5000,  // 5 s to establish TCP connection
    greetingTimeout: 5000,    // 5 s for SMTP greeting
    socketTimeout: 15000,     // 15 s for individual socket operations
  });

  return _transporter;
}

// ---------------------------------------------------------------
// Resend API transport (HTTPS — works on platforms that block SMTP)
//
// Set EMAIL_PROVIDER=resend and RESEND_API_KEY in your environment
// when deploying to a host that blocks outbound SMTP ports (e.g.
// Render free tier blocks ports 25, 465, and 587).
// Sign up and get a free API key at https://resend.com
// ---------------------------------------------------------------

const sendViaResend = (mailOptions) =>
  new Promise((resolve, reject) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return reject(new Error('RESEND_API_KEY environment variable is not set'));
    }

    const payload = JSON.stringify({
      from: mailOptions.from,
      to: Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to],
      subject: mailOptions.subject,
      html: mailOptions.html,
      text: mailOptions.text,
    });

    const req = https.request(
      {
        hostname: 'api.resend.com',
        path: '/emails',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ messageId: parsed.id });
            } else {
              reject(new Error(parsed.message || `Resend API error: HTTP ${res.statusCode}`));
            }
          } catch (e) {
            reject(new Error(`Failed to parse Resend API response: ${e.message}`));
          }
        });
      }
    );

    req.on('error', reject);
    // Fail fast if the HTTPS request itself hangs
    req.setTimeout(15000, () => req.destroy(new Error('Resend API request timed out')));
    req.write(payload);
    req.end();
  });

// ---------------------------------------------------------------
// Shared mail options builder
// ---------------------------------------------------------------

function buildMailOptions(email, otp, name) {
  return {
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
    text: `Hi ${name},\n\nYour OTP for password reset is: ${otp}\n\nThis OTP is valid for ${process.env.OTP_EXPIRY_MINUTES || 10} minutes.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nStationery World Team`,
  };
}

// ---------------------------------------------------------------
// Public API
// ---------------------------------------------------------------

// Send OTP Email
const sendOTPEmail = async (email, otp, name = 'User') => {
  const provider = (process.env.EMAIL_PROVIDER || 'smtp').toLowerCase();
  const mailOptions = buildMailOptions(email, otp, name);

  try {
    let info;
    if (provider === 'resend') {
      info = await sendViaResend(mailOptions);
    } else {
      info = await getTransporter().sendMail(mailOptions);
    }
    console.log('OTP email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending OTP email:', error);
    // Reset cached SMTP transporter so the next request gets a fresh connection.
    // (Only relevant for the smtp provider.)
    if (provider !== 'resend') {
      _transporter = null;
    }
    return { success: false, error: error.message };
  }
};

// Test email connection / configuration
const testConnection = async () => {
  const provider = (process.env.EMAIL_PROVIDER || 'smtp').toLowerCase();

  if (provider === 'resend') {
    if (!process.env.RESEND_API_KEY) {
      console.error('❌ Email service error: RESEND_API_KEY is not set');
      return false;
    }
    console.log('✅ Email service configured (Resend API)');
    return true;
  }

  // SMTP path — verify the connection
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