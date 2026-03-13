const prisma = require('../../../prisma/client');

// =============================================================================
// COMPLETE RULE-BASED BARGAIN SYSTEM WITH ELIGIBILITY ENGINE
// Implements all security, validation, and business rules
// =============================================================================

// =============================================================================
// ELIGIBILITY CHECKING ENGINE
// =============================================================================

/**
 * Check if customer is eligible to bargain for a product
 * Returns detailed eligibility status with reasons
 */
const checkBargainEligibility = async (userId, productId) => {
  try {
    const eligibility = {
      canBargain: false,
      reasons: [],
      metadata: {}
    };

    // 1. Get product with bargain config
    const product = await prisma.product.findUnique({
      where: { id: parseInt(productId) },
      include: { bargainConfig: true }
    });

    if (!product) {
      eligibility.reasons.push('Product not found');
      return eligibility;
    }

    eligibility.metadata.product = {
      id: product.id,
      name: product.name,
      basePrice: product.baseSellingPrice,
      stock: product.totalStock
    };

    // 🔑 ADMIN-ISSUED PERMISSION - bypass other rules if present
    if (userId) {
      const perm = await prisma.bargainPermission.findFirst({
        where: {
          userId,
          productId: product.id,
          expiresAt: { gt: new Date() }
        }
      });

      if (perm) {
        eligibility.canBargain = true;
        eligibility.reasons = [];
        eligibility.metadata.permissionExpires = perm.expiresAt;
        eligibility.metadata.grantedBy = perm.grantedById;
        eligibility.metadata.grantedByAdmin = true;
        return eligibility; // admin override
      }
    }

    // 2. Check if product is bargainable
    if (!product.bargainable) {
      eligibility.reasons.push('Product is not bargainable');
      return eligibility;
    }

    // 3. Check if bargain config exists and is active
    if (!product.bargainConfig || !product.bargainConfig.isActive) {
      eligibility.reasons.push('Bargain configuration not active');
      return eligibility;
    }

    const config = product.bargainConfig;
    eligibility.metadata.config = {
      tier1Price: config.tier1Price,
      tier2Price: config.tier2Price,
      tier3Price: config.tier3Price,
      maxAttempts: config.maxAttempts
    };

    // 4. Check stock availability
    if (product.totalStock <= 0) {
      eligibility.reasons.push('Product out of stock');
      return eligibility;
    }

    // 5. Check bargain expiry date (if set)
    if (config.bargainExpiryDate) {
      const now = new Date();
      const expiry = new Date(config.bargainExpiryDate);
      if (now > expiry) {
        eligibility.reasons.push(`Bargain expired on ${expiry.toLocaleDateString()}`);
        return eligibility;
      }
      eligibility.metadata.expiresAt = expiry;
    }

    // 6. Check bargain stock limit (if set)
    if (config.bargainStockLimit !== null && config.bargainStockLimit !== undefined) {
      const stockUsed = config.bargainStockUsed || 0;
      if (stockUsed >= config.bargainStockLimit) {
        eligibility.reasons.push('Bargain stock limit reached');
        return eligibility;
      }
      eligibility.metadata.bargainStockRemaining = config.bargainStockLimit - stockUsed;
    }

    // 7. Check if user is logged in (if required)
    if (config.requiresLogin && !userId) {
      eligibility.reasons.push('Login required to bargain');
      return eligibility;
    }

    // If not logged in and login not required, allow guest bargaining
    if (!userId) {
      eligibility.canBargain = true;
      eligibility.metadata.remainingAttempts = config.maxAttempts;
      eligibility.metadata.isGuest = true;
      return eligibility;
    }

    // 8. Get user details
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || !user.isActive) {
      eligibility.reasons.push('User account not active');
      return eligibility;
    }

    // 📥 LONG-STAY IN CART / WISHLIST
    // if item has been sitting in cart/wishlist for a while we allow bargaining
    // default period is 5 days (can be extended via config.longStayDays)
    const longStayDays = config?.longStayDays || 5;
    const longAgo = new Date(Date.now() - longStayDays * 24 * 60 * 60 * 1000);
    const cartEntry = await prisma.cart.findFirst({
      where: { userId, productId: product.id, createdAt: { lte: longAgo } }
    });
    const wishEntry = await prisma.wishlist.findFirst({
      where: { userId, productId: product.id, addedAt: { lte: longAgo } }
    });

    if (cartEntry || wishEntry) {
      eligibility.canBargain = true;
      eligibility.reasons = ['Been in your cart/wishlist for a while'];
      eligibility.metadata.longInCart = !!cartEntry;
      eligibility.metadata.longInWishlist = !!wishEntry;
      return eligibility;
    }

    // 9. Check minimum customer orders required
    if (config.minimumCustomerOrdersRequired && config.minimumCustomerOrdersRequired > 0) {
      const completedOrders = await prisma.order.count({
        where: {
          userId,
          status: 'DELIVERED'
        }
      });

      eligibility.metadata.completedOrders = completedOrders;

      if (completedOrders < config.minimumCustomerOrdersRequired) {
        eligibility.reasons.push(
          `Minimum ${config.minimumCustomerOrdersRequired} completed orders required (you have ${completedOrders})`
        );
        return eligibility;
      }
    }

    // 10. Get existing attempts for this product
    const existingAttempts = await prisma.bargainAttempt.findMany({
      where: {
        userId,
        productId: parseInt(productId),
        orderId: null
      },
      orderBy: { createdAt: 'desc' }
    });

    eligibility.metadata.totalAttempts = existingAttempts.length;
    eligibility.metadata.remainingAttempts = Math.max(0, config.maxAttempts - existingAttempts.length);

    // 11. Check if max attempts exceeded
    if (existingAttempts.length >= config.maxAttempts) {
      eligibility.reasons.push(`Maximum ${config.maxAttempts} attempts reached`);
      return eligibility;
    }

    // 12. Check if user is flagged for abuse
    const abuseCheck = await prisma.bargainAttempt.findFirst({
      where: {
        userId,
        isAbused: true
      }
    });

    if (abuseCheck) {
      eligibility.reasons.push('Account flagged for bargain abuse');
      return eligibility;
    }

    // 13. Check cooldown period (if last attempt exists)
    if (existingAttempts.length > 0 && config.cooldownMinutes > 0) {
      const lastAttempt = existingAttempts[0];
      const cooldownMs = config.cooldownMinutes * 60 * 1000;
      const timeSinceLastAttempt = Date.now() - new Date(lastAttempt.lastAttemptAt).getTime();

      if (timeSinceLastAttempt < cooldownMs) {
        const remainingMinutes = Math.ceil((cooldownMs - timeSinceLastAttempt) / 60000);
        eligibility.reasons.push(`Please wait ${remainingMinutes} minute(s) before next attempt`);
        eligibility.metadata.cooldownRemaining = remainingMinutes;
        return eligibility;
      }
    }

    // 14. Check if there's an active accepted offer
    const activeOffer = existingAttempts.find(
      attempt => attempt.accepted && attempt.offerLockExpiry && new Date(attempt.offerLockExpiry) > new Date()
    );

    if (activeOffer) {
      eligibility.reasons.push('You have an active accepted offer for this product');
      eligibility.metadata.activeOffer = {
        price: activeOffer.finalPrice || activeOffer.offeredPrice,
        expiresAt: activeOffer.offerLockExpiry
      };
      return eligibility;
    }

    // ✅ ALL CHECKS PASSED - ELIGIBLE!
    eligibility.canBargain = true;
    eligibility.metadata.nextAttemptNumber = existingAttempts.length + 1;

    return eligibility;

  } catch (error) {
    console.error('❌ Eligibility check error:', error);
    return {
      canBargain: false,
      reasons: ['Error checking eligibility'],
      metadata: {}
    };
  }
};

// =============================================================================
// PUBLIC API ENDPOINTS
// =============================================================================

/**
 * GET /api/bargain/eligibility/:productId
 * Check if user can bargain for a product
 */
const getBargainEligibility = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const { productId } = req.params;

    console.log('🔍 Check bargain eligibility:', { userId, productId });

    const eligibility = await checkBargainEligibility(userId, productId);

    return res.status(200).json({
      success: true,
      message: eligibility.canBargain 
        ? 'Eligible to bargain' 
        : eligibility.reasons.join(', '),
      data: eligibility
    });

  } catch (error) {
    console.error('❌ Get eligibility error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while checking eligibility.'
    });
  }
};

/**
 * GET /api/bargain/config/:productId
 * Get bargain configuration for a product
 */
const getBargainConfig = async (req, res) => {
  try {
    const { productId } = req.params;

    console.log('📋 Get bargain config:', productId);

    const product = await prisma.product.findUnique({
      where: { id: parseInt(productId) },
      include: { bargainConfig: true }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      });
    }

    if (!product.bargainable) {
      return res.status(400).json({
        success: false,
        message: 'This product is not bargainable.'
      });
    }

    if (!product.bargainConfig) {
      return res.status(404).json({
        success: false,
        message: 'Bargain configuration not found.'
      });
    }

    // Don't expose all internal fields to frontend
    const safeConfig = {
      tier1Price: product.bargainConfig.tier1Price,
      tier2Price: product.bargainConfig.tier2Price,
      tier3Price: product.bargainConfig.tier3Price,
      maxAttempts: product.bargainConfig.maxAttempts,
      cooldownMinutes: product.bargainConfig.cooldownMinutes,
      bargainExpiryDate: product.bargainConfig.bargainExpiryDate,
      minimumCustomerOrdersRequired: product.bargainConfig.minimumCustomerOrdersRequired,
      basePrice: product.baseSellingPrice
    };

    return res.status(200).json({
      success: true,
      message: 'Bargain configuration retrieved.',
      data: safeConfig
    });

  } catch (error) {
    console.error('❌ Get config error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
};

/**
 * GET /api/bargain/attempts/:productId
 * Get user's attempts for a product
 */
const getBargainAttempts = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.params;

    console.log('📊 Get bargain attempts:', { userId, productId });

    const attempts = await prisma.bargainAttempt.findMany({
      where: {
        userId,
        productId: parseInt(productId),
        orderId: null
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        attemptNumber: true,
        offeredPrice: true,
        accepted: true,
        acceptedTier: true,
        finalPrice: true,
        offerLockExpiry: true,
        rejectionReason: true,
        createdAt: true
      }
    });

    const config = await prisma.bargainConfig.findUnique({
      where: { productId: parseInt(productId) },
      select: { maxAttempts: true }
    });

    const maxAttempts = config?.maxAttempts || 3;
    const remainingAttempts = Math.max(0, maxAttempts - attempts.length);

    return res.status(200).json({
      success: true,
      message: 'Attempts retrieved.',
      data: {
        attempts,
        totalAttempts: attempts.length,
        remainingAttempts,
        maxAttempts
      }
    });

  } catch (error) {
    console.error('❌ Get attempts error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
};

/**
 * POST /api/bargain/attempt
 * Make a bargain attempt
 */
const makeBargainAttempt = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, offeredPrice } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');

    console.log('💰 Bargain attempt:', { userId, productId, offeredPrice });

    // Validation
    if (!productId || offeredPrice === undefined || offeredPrice === null) {
      return res.status(400).json({
        success: false,
        message: 'Product ID and offered price are required.'
      });
    }

    const offeredPriceNum = parseFloat(offeredPrice);
    if (isNaN(offeredPriceNum) || offeredPriceNum <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid price. Must be a positive number.'
      });
    }

    // Check eligibility FIRST
    const eligibility = await checkBargainEligibility(userId, productId);

    if (!eligibility.canBargain) {
      return res.status(403).json({
        success: false,
        message: eligibility.reasons.join('. '),
        data: { eligibility }
      });
    }

    // Get product and config
    const product = await prisma.product.findUnique({
      where: { id: parseInt(productId) },
      include: { bargainConfig: true }
    });

    const config = product.bargainConfig;

    // Check if offered price is too high (greater than base price)
    if (offeredPriceNum > product.baseSellingPrice) {
      return res.status(400).json({
        success: false,
        message: `Offered price cannot exceed base price of ₹${product.baseSellingPrice}`
      });
    }

    // Check if offered price meets minimum threshold (tier3)
    if (offeredPriceNum < config.tier3Price) {
      // Create rejected attempt
      const attempt = await prisma.bargainAttempt.create({
        data: {
          userId,
          productId: parseInt(productId),
          attemptNumber: eligibility.metadata.nextAttemptNumber,
          offeredPrice: offeredPriceNum,
          accepted: false,
          rejectionReason: `Price below minimum acceptable (₹${config.tier3Price})`,
          ipAddress,
          userAgent,
          lastAttemptAt: new Date()
        }
      });

      const remainingAttempts = config.maxAttempts - eligibility.metadata.nextAttemptNumber;

      return res.status(200).json({
        success: false,
        message: `Offer rejected. Minimum price is ₹${config.tier3Price}. ${remainingAttempts} attempt(s) remaining.`,
        data: {
          attempt,
          accepted: false,
          remainingAttempts,
          minimumPrice: config.tier3Price,
          nextTierPrice: config.tier2Price
        }
      });
    }

    // Determine matched tier
    let acceptedTier = 3;
    let finalPrice = config.tier3Price;

    if (offeredPriceNum >= config.tier1Price) {
      acceptedTier = 1;
      finalPrice = config.tier1Price;
    } else if (offeredPriceNum >= config.tier2Price) {
      acceptedTier = 2;
      finalPrice = config.tier2Price;
    }

    // Calculate lock expiry
    const lockDurationMs = (config.lockDurationMinutes || 30) * 60 * 1000;
    const offerLockExpiry = new Date(Date.now() + lockDurationMs);

    // Create accepted attempt
    const attempt = await prisma.$transaction(async (tx) => {
      // Create attempt
      const newAttempt = await tx.bargainAttempt.create({
        data: {
          userId,
          productId: parseInt(productId),
          attemptNumber: eligibility.metadata.nextAttemptNumber,
          offeredPrice: offeredPriceNum,
          accepted: true,
          acceptedTier,
          finalPrice,
          offerLockExpiry,
          ipAddress,
          userAgent,
          lastAttemptAt: new Date()
        }
      });

      // Update bargain stock used
      if (config.bargainStockLimit !== null) {
        await tx.bargainConfig.update({
          where: { productId: parseInt(productId) },
          data: {
            bargainStockUsed: { increment: 1 }
          }
        });
      }

      // Add to cart with bargain price
      await tx.cart.upsert({
        where: {
          userId_productId: {
            userId,
            productId: parseInt(productId)
          }
        },
        update: {
          priceAtAdd: finalPrice,
          bargainApplied: true,
          quantity: 1
        },
        create: {
          userId,
          productId: parseInt(productId),
          quantity: 1,
          priceAtAdd: finalPrice,
          bargainApplied: true
        }
      });

      // Mark as added to cart
      await tx.bargainAttempt.update({
        where: { id: newAttempt.id },
        data: {
          addedToCart: true,
          cartAddedAt: new Date()
        }
      });

      return newAttempt;
    });

    console.log('✅ Bargain accepted:', {
      tier: acceptedTier,
      price: finalPrice,
      expiresAt: offerLockExpiry
    });

    const remainingAttempts = config.maxAttempts - eligibility.metadata.nextAttemptNumber;

    return res.status(201).json({
      success: true,
      message: `Bargain accepted! Matched Tier ${acceptedTier}. Item added to cart at ₹${finalPrice}`,
      data: {
        attempt,
        accepted: true,
        acceptedTier,
        finalPrice,
        offerLockExpiry,
        remainingAttempts,
        addedToCart: true
      }
    });

  } catch (error) {
    console.error('❌ Make attempt error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
};

// =============================================================================
// ADMIN ENDPOINTS
// =============================================================================

/**
 * POST /api/bargain/config/:productId
 * Set/update bargain configuration (Admin only)
 */
const setBargainConfig = async (req, res) => {
  try {
    const { productId } = req.params;
    const {
      tier1Price,
      tier2Price,
      tier3Price,
      maxAttempts = 3,
      isActive = true,
      bargainPercentageLimit,
      bargainAmountLimit,
      minimumCartValueForBargain,
      minimumCustomerOrdersRequired = 0,
      bargainExpiryDate,
      bargainStockLimit,
      cooldownMinutes = 30,
      lockDurationMinutes = 30,
      requiresLogin = true,
      allowCouponCombination = false
    } = req.body;

    console.log('⚙️ Set bargain config:', productId);

    // Validation
    if (!tier1Price || !tier2Price || !tier3Price) {
      return res.status(400).json({
        success: false,
        message: 'All three tier prices are required.'
      });
    }

    const t1 = parseFloat(tier1Price);
    const t2 = parseFloat(tier2Price);
    const t3 = parseFloat(tier3Price);

    if (t1 <= t2 || t2 <= t3) {
      return res.status(400).json({
        success: false,
        message: 'Tier prices must be: tier1 > tier2 > tier3'
      });
    }

    // Check product exists
    const product = await prisma.product.findUnique({
      where: { id: parseInt(productId) }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      });
    }

    // Validate tier prices against base price
    if (t1 > product.baseSellingPrice) {
      return res.status(400).json({
        success: false,
        message: `Tier 1 price cannot exceed base price (₹${product.baseSellingPrice})`
      });
    }

    // Build update data
    const configData = {
      tier1Price: t1,
      tier2Price: t2,
      tier3Price: t3,
      maxAttempts: parseInt(maxAttempts),
      isActive,
      cooldownMinutes: parseInt(cooldownMinutes),
      lockDurationMinutes: parseInt(lockDurationMinutes),
      requiresLogin,
      allowCouponCombination,
      minimumCustomerOrdersRequired: parseInt(minimumCustomerOrdersRequired)
    };

    // Optional fields
    if (bargainPercentageLimit) configData.bargainPercentageLimit = parseFloat(bargainPercentageLimit);
    if (bargainAmountLimit) configData.bargainAmountLimit = parseFloat(bargainAmountLimit);
    if (minimumCartValueForBargain) configData.minimumCartValueForBargain = parseFloat(minimumCartValueForBargain);
    if (bargainExpiryDate) configData.bargainExpiryDate = new Date(bargainExpiryDate);
    if (bargainStockLimit) configData.bargainStockLimit = parseInt(bargainStockLimit);

    // Upsert config
    const config = await prisma.bargainConfig.upsert({
      where: { productId: parseInt(productId) },
      update: configData,
      create: {
        productId: parseInt(productId),
        ...configData
      }
    });

    // Update product bargainable flag
    await prisma.product.update({
      where: { id: parseInt(productId) },
      data: { bargainable: isActive }
    });

    console.log('✅ Bargain config set:', config.id);

    return res.status(200).json({
      success: true,
      message: 'Bargain configuration updated.',
      data: config
    });

  } catch (error) {
    console.error('❌ Set config error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
};

/**
 * GET /api/bargain/admin/analytics/:productId
 * Get bargain analytics for a product (Admin only)
 */
const getBargainAnalytics = async (req, res) => {
  try {
    const { productId } = req.params;

    console.log('📈 Get bargain analytics:', productId);

    const attempts = await prisma.bargainAttempt.findMany({
      where: { productId: parseInt(productId) },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const stats = {
      totalAttempts: attempts.length,
      acceptedAttempts: attempts.filter(a => a.accepted).length,
      rejectedAttempts: attempts.filter(a => !a.accepted).length,
      tier1Matches: attempts.filter(a => a.acceptedTier === 1).length,
      tier2Matches: attempts.filter(a => a.acceptedTier === 2).length,
      tier3Matches: attempts.filter(a => a.acceptedTier === 3).length,
      uniqueUsers: new Set(attempts.map(a => a.userId)).size,
      addedToCart: attempts.filter(a => a.addedToCart).length,
      purchased: attempts.filter(a => a.purchasedAt).length,
      flaggedForAbuse: attempts.filter(a => a.isAbused).length
    };

    return res.status(200).json({
      success: true,
      message: 'Analytics retrieved.',
      data: {
        stats,
        recentAttempts: attempts.slice(0, 20)
      }
    });

  } catch (error) {
    console.error('❌ Get analytics error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
};

// =============================================================================
// ADMIN REQUEST HANDLING (BARGAIN REQUESTS)
// =============================================================================

/**
 * POST /api/bargain/request
 * Customer requests ability to bargain for a product (after wishlist/long stay)
 */
const requestBargain = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, note } = req.body;

    if (!productId) {
      return res.status(400).json({ success: false, message: 'productId is required' });
    }

    const product = await prisma.product.findUnique({ where: { id: parseInt(productId) } });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    // Ensure user has had this item in wishlist for a while (default 5 days)
    const config = await prisma.bargainConfig.findUnique({ where: { productId: parseInt(productId) } });
    const longStayDays = config?.longStayDays || 5;
    const cutoff = new Date(Date.now() - longStayDays * 24 * 60 * 60 * 1000);

    const wish = await prisma.wishlist.findFirst({
      where: {
        userId,
        productId: parseInt(productId),
        addedAt: { lte: cutoff }
      }
    });

    if (!wish) {
      return res.status(403).json({
        success: false,
        message: `Item must be in wishlist for at least ${longStayDays} days to request a bargain.`
      });
    }

    // Check for existing pending request
    const existing = await prisma.bargainRequest.findFirst({
      where: { userId, productId: parseInt(productId), status: 'PENDING' }
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'You already have a pending bargain request for this product.'
      });
    }

    const request = await prisma.bargainRequest.create({
      data: {
        userId,
        productId: parseInt(productId),
        note: note || null
      }
    });

    return res.status(201).json({ success: true, message: 'Bargain request submitted.', data: request });
  } catch (err) {
    console.error('Request bargain error', err);
    return res.status(500).json({ success: false, message: 'Failed to submit bargain request.' });
  }
};

/**
 * GET /api/bargain/requests
 * Customer -> list their own bargain requests
 */
const getMyBargainRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const requests = await prisma.bargainRequest.findMany({
      where: { userId },
      include: {
        product: { select: { id: true, name: true, uid: true, category: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json({ success: true, message: 'Your bargain requests retrieved.', data: requests });
  } catch (err) {
    console.error('Get my bargain requests error', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch your requests.' });
  }
};


/**
 * GET /api/bargain/admin/requests
 * Admin list of bargain requests
 */
const getBargainRequests = async (req, res) => {
  try {
    const { status } = req.query;

    const where = {};
    if (status) where.status = status.toUpperCase();

    const requests = await prisma.bargainRequest.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        product: { select: { id: true, name: true, uid: true, category: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json({ success: true, message: 'Requests retrieved.', data: requests });
  } catch (err) {
    console.error('Get bargain requests error', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch requests.' });
  }
};

/**
 * POST /api/bargain/admin/requests/:id/approve
 */
const approveBargainRequest = async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);
    const { expiresAt } = req.body;

    const request = await prisma.bargainRequest.findUnique({
      where: { id: requestId }
    });
    if (!request) return res.status(404).json({ success: false, message: 'Request not found.' });
    if (request.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'Request already handled.' });
    }

    // Grant permission
    await prisma.bargainPermission.upsert({
      where: { userId_productId: { userId: request.userId, productId: request.productId } },
      update: {
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        grantedById: req.user.id
      },
      create: {
        userId: request.userId,
        productId: request.productId,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        grantedById: req.user.id
      }
    });

    const updated = await prisma.bargainRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        reviewedById: req.user.id,
        reviewedAt: new Date()
      }
    });

    return res.status(200).json({ success: true, message: 'Request approved.', data: updated });
  } catch (err) {
    console.error('Approve bargain request error', err);
    return res.status(500).json({ success: false, message: 'Failed to approve request.' });
  }
};

/**
 * POST /api/bargain/admin/requests/:id/deny
 */
const denyBargainRequest = async (req, res) => {
  try {
    const requestId = parseInt(req.params.id);
    const { note } = req.body;

    const request = await prisma.bargainRequest.findUnique({
      where: { id: requestId }
    });
    if (!request) return res.status(404).json({ success: false, message: 'Request not found.' });
    if (request.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'Request already handled.' });
    }

    const updated = await prisma.bargainRequest.update({
      where: { id: requestId },
      data: {
        status: 'DENIED',
        reviewedById: req.user.id,
        reviewedAt: new Date(),
        note: note || request.note
      }
    });

    return res.status(200).json({ success: true, message: 'Request denied.', data: updated });
  } catch (err) {
    console.error('Deny bargain request error', err);
    return res.status(500).json({ success: false, message: 'Failed to deny request.' });
  }
};

// =============================================================================
// ADMIN PERMISSION HELPERS
// =============================================================================

/**
 * Grant bargain permission to a user for a product.
 * POST /api/bargain/admin/permission
 */
const grantBargainPermission = async (req, res) => {
  try {
    const { userId, productId, expiresAt } = req.body;
    if (!userId || !productId) {
      return res.status(400).json({ success: false, message: 'userId and productId are required' });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: parseInt(userId) } });
    const targetProduct = await prisma.product.findUnique({ where: { id: parseInt(productId) } });

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (!targetProduct) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const expiresDate = expiresAt ? new Date(expiresAt) : null;

    const permission = await prisma.bargainPermission.upsert({
      where: { userId_productId: { userId: parseInt(userId), productId: parseInt(productId) } },
      update: {
        expiresAt: expiresDate,
        grantedById: req.user.id
      },
      create: {
        userId: parseInt(userId),
        productId: parseInt(productId),
        expiresAt: expiresDate,
        grantedById: req.user.id
      }
    });

    return res.status(200).json({ success: true, message: 'Permission granted.', data: permission });
  } catch (err) {
    console.error('Grant permission error', err);
    return res.status(500).json({ success: false, message: 'Failed to grant permission.' });
  }
};

/**
 * Revoke bargain permission.
 * DELETE /api/bargain/admin/permission
 */
const revokeBargainPermission = async (req, res) => {
  try {
    const { userId, productId } = req.body;
    if (!userId || !productId) {
      return res.status(400).json({ success: false, message: 'userId and productId are required' });
    }

    await prisma.bargainPermission.deleteMany({
      where: { userId: parseInt(userId), productId: parseInt(productId) }
    });

    return res.status(200).json({ success: true, message: 'Permission revoked.' });
  } catch (err) {
    console.error('Revoke permission error', err);
    return res.status(500).json({ success: false, message: 'Failed to revoke permission.' });
  }
};

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // Public endpoints
  getBargainEligibility,
  getBargainConfig,
  getBargainAttempts,
  makeBargainAttempt,
  requestBargain,
  getMyBargainRequests,

  // Admin endpoints
  setBargainConfig,
  getBargainAnalytics,
  getBargainRequests,
  approveBargainRequest,
  denyBargainRequest,
  grantBargainPermission,
  revokeBargainPermission,

  // Helper function (for internal use)
  checkBargainEligibility
};