const express = require('express');
const router = express.Router();
const {
  getBargainEligibility,
  getBargainConfig,
  getBargainAttempts,
  makeBargainAttempt,
  requestBargain,
  getMyBargainRequests,
  getBargainRequests,
  approveBargainRequest,
  denyBargainRequest,
  setBargainConfig,
  getBargainAnalytics,
  grantBargainPermission,
  revokeBargainPermission
} = require('./bargain.controller');
const { authMiddleware, adminMiddleware } = require('../user/user.middleware');
const { bargainRateLimiter, attemptValidator } = require('./bargain.middleware');

// =============================================================================
// PUBLIC ROUTES (Customer)
// =============================================================================

// Check eligibility (can be called by guests or logged-in users)
router.get('/eligibility/:productId', getBargainEligibility);

// Get bargain configuration
router.get('/config/:productId', getBargainConfig);

// Get user's attempts (requires auth)
router.get('/attempts/:productId', authMiddleware, getBargainAttempts);

// Make bargain attempt (requires auth + rate limiting + validation)
router.post(
  '/attempt',
  authMiddleware,
  bargainRateLimiter,
  attemptValidator,
  makeBargainAttempt
);

// Request bargain (from wishlist) - requires at least 5 days in wishlist
router.post(
  '/request',
  authMiddleware,
  requestBargain
);

// =============================================================================
// ADMIN ROUTES
// =============================================================================

// Set/update bargain configuration
router.post(
  '/config/:productId',
  authMiddleware,
  adminMiddleware,
  setBargainConfig
);

// Get bargain analytics
router.get(
  '/admin/analytics/:productId',
  authMiddleware,
  adminMiddleware,
  getBargainAnalytics
);

// Customer requests (own)
router.get(
  '/requests',
  authMiddleware,
  getMyBargainRequests
);

// Bargain request management (admin)
router.get(
  '/admin/requests',
  authMiddleware,
  adminMiddleware,
  getBargainRequests
);

router.post(
  '/admin/requests/:id/approve',
  authMiddleware,
  adminMiddleware,
  approveBargainRequest
);

router.post(
  '/admin/requests/:id/deny',
  authMiddleware,
  adminMiddleware,
  denyBargainRequest
);

// Grant special bargain permission to a customer for a product
router.post(
  '/admin/permission',
  authMiddleware,
  adminMiddleware,
  grantBargainPermission
);

// Revoke previously granted permission
router.delete(
  '/admin/permission',
  authMiddleware,
  adminMiddleware,
  revokeBargainPermission
);

module.exports = router;