// =============================================================================
// BARGAIN MIDDLEWARE - Rate Limiting & Validation
// Place this file at: src/middleware/bargain.middleware.js
// =============================================================================

const prisma = require('../../../prisma/client');

// In-memory store for rate limiting (use Redis in production)
const rateLimitStore = new Map();

/**
 * Rate limiter for bargain attempts
 * Prevents API spam and abuse
 */
const bargainRateLimiter = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const ip = req.ip || req.connection.remoteAddress;
    const key = userId ? `user:${userId}` : `ip:${ip}`;

    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window
    const maxRequests = 10; // Max 10 requests per minute

    if (!rateLimitStore.has(key)) {
      rateLimitStore.set(key, []);
    }

    const requests = rateLimitStore.get(key);
    
    // Remove old requests outside the window
    const validRequests = requests.filter(timestamp => now - timestamp < windowMs);
    
    if (validRequests.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: 'Too many bargain attempts. Please wait a moment and try again.'
      });
    }

    // Add current request
    validRequests.push(now);
    rateLimitStore.set(key, validRequests);

    // Cleanup old entries (prevent memory leak)
    if (rateLimitStore.size > 10000) {
      const keysToDelete = [];
      for (const [k, v] of rateLimitStore.entries()) {
        if (v.length === 0 || now - v[v.length - 1] > windowMs * 10) {
          keysToDelete.push(k);
        }
      }
      keysToDelete.forEach(k => rateLimitStore.delete(k));
    }

    next();
  } catch (error) {
    console.error('❌ Rate limiter error:', error);
    next(); // Don't block on error
  }
};

/**
 * Validate bargain attempt request
 * Ensures data integrity and prevents manipulation
 */
const attemptValidator = async (req, res, next) => {
  try {
    const { productId, offeredPrice } = req.body;

    // Basic validation
    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required.'
      });
    }

    if (offeredPrice === undefined || offeredPrice === null) {
      return res.status(400).json({
        success: false,
        message: 'Offered price is required.'
      });
    }

    // Type validation
    const productIdNum = parseInt(productId);
    const offeredPriceNum = parseFloat(offeredPrice);

    if (isNaN(productIdNum) || productIdNum <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID.'
      });
    }

    if (isNaN(offeredPriceNum) || offeredPriceNum <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Offered price must be a positive number.'
      });
    }

    // Check for suspiciously low prices (prevent exploitation)
    if (offeredPriceNum < 1) {
      return res.status(400).json({
        success: false,
        message: 'Offered price too low.'
      });
    }

    // Check for suspiciously high prices (sanity check)
    if (offeredPriceNum > 100000) {
      return res.status(400).json({
        success: false,
        message: 'Offered price exceeds maximum allowed.'
      });
    }

    // Sanitize request body
    req.body.productId = productIdNum;
    req.body.offeredPrice = offeredPriceNum;

    next();
  } catch (error) {
    console.error('❌ Attempt validator error:', error);
    return res.status(500).json({
      success: false,
      message: 'Validation error.'
    });
  }
};

/**
 * Check for abuse patterns
 * Flags suspicious behavior
 */
const abuseDetector = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return next();
    }

    // Check for rapid fire attempts across multiple products
    const recentAttempts = await prisma.bargainAttempt.count({
      where: {
        userId,
        createdAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
        }
      }
    });

    if (recentAttempts > 20) {
      // Flag user
      await prisma.bargainAttempt.updateMany({
        where: { userId },
        data: { isAbused: true }
      });

      return res.status(429).json({
        success: false,
        message: 'Suspicious activity detected. Your account has been flagged.'
      });
    }

    // Check for pattern of offering same low price
    const samePrice = await prisma.bargainAttempt.findMany({
      where: {
        userId,
        offeredPrice: parseFloat(req.body.offeredPrice),
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
        }
      }
    });

    if (samePrice.length > 10) {
      console.log('⚠️ Potential price fixing detected:', userId);
      // Don't block, but log for review
    }

    next();
  } catch (error) {
    console.error('❌ Abuse detector error:', error);
    next(); // Don't block on error
  }
};

module.exports = {
  bargainRateLimiter,
  attemptValidator,
  abuseDetector
};