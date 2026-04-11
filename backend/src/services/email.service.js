// email.service.js  —  Stationery World v4.0 (unchanged from v3 — preserved as-is)
// All existing SMTP + Resend logic kept intact.

const nodemailer = require('nodemailer');
const https = require('https');

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;
  const emailPort = parseInt(process.env.EMAIL_PORT, 10) || 587;
  const isSecure  = emailPort === 465;

  _transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: emailPort,
    secure: isSecure,
    requireTLS: !isSecure,
    family: 4,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    tls: { rejectUnauthorized: process.env.EMAIL_TLS_REJECT_UNAUTHORIZED !== 'false' },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 15000
  });

  return _transporter;
}

const sendViaResend = (mailOptions) =>
  new Promise((resolve, reject) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return reject(new Error('RESEND_API_KEY environment variable is not set'));

    const payload = JSON.stringify({
      from: mailOptions.from,
      to: Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to],
      subject: mailOptions.subject,
      html: mailOptions.html,
      text: mailOptions.text
    });

    const req = https.request({
      hostname: 'api.resend.com', path: '/emails', method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          res.statusCode >= 200 && res.statusCode < 300
            ? resolve({ messageId: parsed.id })
            : reject(new Error(parsed.message || `Resend API error: HTTP ${res.statusCode}`));
        } catch (e) { reject(new Error(`Failed to parse Resend API response: ${e.message}`)); }
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('Resend API request timed out')));
    req.write(payload);
    req.end();
  });

function buildOTPMailOptions(email, otp, name) {
  return {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: 'Password Reset OTP - Stationery World',
    html: `
      <!DOCTYPE html><html><head><style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #007bff; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
        .otp-box { background: white; padding: 20px; text-align: center; border: 2px dashed #007bff; border-radius: 8px; margin: 20px 0; }
        .otp { font-size: 32px; font-weight: bold; color: #007bff; letter-spacing: 8px; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin: 20px 0; }
      </style></head>
      <body><div class="container">
        <div class="header"><h1>🔐 Password Reset Request</h1></div>
        <div class="content">
          <p>Hi ${name},</p>
          <p>You requested to reset your password. Use the OTP below to proceed:</p>
          <div class="otp-box">
            <p style="margin:0;color:#666;font-size:14px;">Your OTP is:</p>
            <p class="otp">${otp}</p>
            <p style="margin:0;color:#666;font-size:12px;">Valid for ${process.env.OTP_EXPIRY_MINUTES || 10} minutes</p>
          </div>
          <div class="warning"><strong>⚠️ Security Notice:</strong> Never share this OTP with anyone.</div>
          <p>If you didn't request this, please ignore this email.</p>
          <p>Best regards,<br><strong>Stationery World Team</strong></p>
        </div>
        <div class="footer"><p>This is an automated email. Please do not reply.</p><p>© 2026 Stationery World. All rights reserved.</p></div>
      </div></body></html>
    `,
    text: `Hi ${name},\n\nYour OTP for password reset is: ${otp}\n\nThis OTP is valid for ${process.env.OTP_EXPIRY_MINUTES || 10} minutes.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nStationery World Team`
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

const sendOTPEmail = async (email, otp, name = 'User') => {
  const provider = (process.env.EMAIL_PROVIDER || 'smtp').toLowerCase();
  const mailOptions = buildOTPMailOptions(email, otp, name);

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
    if (provider !== 'resend') _transporter = null;
    return { success: false, error: error.message };
  }
};

// Generic send — used by reports sendReportEmail (plain HTML)
const sendEmail = async ({ to, subject, html, text }) => {
  const provider = (process.env.EMAIL_PROVIDER || 'smtp').toLowerCase();
  const mailOptions = { from: process.env.EMAIL_FROM, to, subject, html, text };

  try {
    let info;
    if (provider === 'resend') {
      info = await sendViaResend(mailOptions);
    } else {
      info = await getTransporter().sendMail(mailOptions);
    }
    console.log('Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    if (provider !== 'resend') _transporter = null;
    return { success: false, error: error.message };
  }
};

const testConnection = async () => {
  const provider = (process.env.EMAIL_PROVIDER || 'smtp').toLowerCase();
  if (provider === 'resend') {
    if (!process.env.RESEND_API_KEY) { console.error('❌ Email service error: RESEND_API_KEY is not set'); return false; }
    console.log('✅ Email service configured (Resend API)');
    return true;
  }
  try {
    await getTransporter().verify();
    console.log('✅ Email service is ready');
    return true;
  } catch (error) {
    console.error('❌ Email service error:', error.message || error);
    _transporter = null;
    return false;
  }
};

module.exports = { sendOTPEmail, sendEmail, testConnection };
