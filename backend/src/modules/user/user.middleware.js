const jwt = require('jsonwebtoken');
const prisma = require('../../../prisma/client');

// ── Constants ─────────────────────────────────────────────────────────────────
const JWT_EXPIRY        = '7d';
const INACTIVE_DAYS     = 10;          // auto-logout if no activity for this many days
const INACTIVE_MS       = INACTIVE_DAYS * 24 * 60 * 60 * 1000;
const SLIDING_HEADER    = 'x-new-token'; // header name carrying the refreshed token

// ── authMiddleware ────────────────────────────────────────────────────────────
// 1. Verifies JWT signature.
// 2. Checks lastSeenAt — if the user hasn't been active in 10 days, force re-login.
// 3. Updates lastSeenAt in DB (fire-and-forget, never blocks the request).
// 4. Issues a fresh 7-day token and returns it in the X-New-Token header so the
//    frontend can transparently replace the stored token (sliding window).
// ─────────────────────────────────────────────────────────────────────────────
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Invalid token format.'
      });
    }

    // 1. Verify JWT signature & structural validity
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 2. Load fresh user from DB (includes lastSeenAt)
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        lastSeenAt: true,
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

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found.' });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is inactive. Please contact support.'
      });
    }

    // 3. 10-day inactivity check
    const lastSeen = new Date(user.lastSeenAt);
    if (Date.now() - lastSeen.getTime() > INACTIVE_MS) {
      return res.status(401).json({
        success: false,
        message: `Session expired after ${INACTIVE_DAYS} days of inactivity. Please log in again.`,
        code: 'SESSION_INACTIVE'
      });
    }

    // 4. Slide the session window — update lastSeenAt (fire-and-forget)
    prisma.user.update({
      where: { id: user.id },
      data:  { lastSeenAt: new Date() }
    }).catch(() => {});  // non-fatal

    // 5. Issue a fresh token and send it back in a response header
    //    Frontend should watch for this header and replace the stored token.
    const freshToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );
    res.setHeader(SLIDING_HEADER, freshToken);

    // Attach user (omit lastSeenAt from req.user — not needed by controllers)
    const { lastSeenAt: _ls, ...userForReq } = user;
    req.user = userForReq;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid token.' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired. Please log in again.' });
    }
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during authentication.'
    });
  }
};

// ── adminMiddleware ───────────────────────────────────────────────────────────
const adminMiddleware = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Access denied. Admin privileges required.' });
  }
  next();
};

// ── optionalAuth ──────────────────────────────────────────────────────────────
// Attaches req.user if a valid token is present; never blocks if missing/invalid.
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }
    const token = authHeader.split(' ')[1];
    if (!token) { req.user = null; return next(); }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true, name: true, email: true, phone: true, role: true,
        isActive: true, lastSeenAt: true,
        addressLine1: true, addressLine2: true, city: true,
        state: true, postalCode: true, country: true, photoUrl: true,
        createdAt: true, updatedAt: true
      }
    });

    if (!user || !user.isActive) { req.user = null; return next(); }

    // Also enforce 10-day inactivity for optional routes
    const lastSeen = new Date(user.lastSeenAt);
    if (Date.now() - lastSeen.getTime() > INACTIVE_MS) {
      req.user = null;
      return next();
    }

    // Slide the window
    prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } }).catch(() => {});

    const freshToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );
    res.setHeader(SLIDING_HEADER, freshToken);

    const { lastSeenAt: _ls, ...userForReq } = user;
    req.user = userForReq;
    return next();
  } catch (_err) {
    req.user = null;
    return next();
  }
};

module.exports = { authMiddleware, adminMiddleware, optionalAuth };
