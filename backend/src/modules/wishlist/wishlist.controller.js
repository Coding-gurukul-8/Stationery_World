const prisma = require('../../../prisma/client');

// Get user's wishlist
const getWishlist = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('Get wishlist request for user:', userId);

    const wishlistItems = await prisma.wishlist.findMany({
      where: { userId },
      include: {
        product: {
          include: {
            images: {
              where: { isPrimary: true },
              take: 1
            }
          }
        }
      },
      orderBy: {
        addedAt: 'desc'
      }
    });

    console.log(`Found ${wishlistItems.length} wishlist items for user ${userId}`);

    return res.status(200).json({
      success: true,
      message: 'Wishlist retrieved successfully.',
      data: wishlistItems,
      count: wishlistItems.length
    });
  } catch (error) {
    console.error('Get wishlist error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching wishlist.'
    });
  }
};

// Add item to wishlist
const addToWishlist = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, note } = req.body;

    console.log('Add to wishlist request:', { userId, productId });

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required.'
      });
    }

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: parseInt(productId) }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      });
    }

    // Check if already in wishlist
    const existing = await prisma.wishlist.findUnique({
      where: {
        userId_productId: {
          userId,
          productId: parseInt(productId)
        }
      }
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Product already in wishlist.'
      });
    }

    // Add to wishlist
    const wishlistItem = await prisma.wishlist.create({
      data: {
        userId,
        productId: parseInt(productId),
        note: note || null
      },
      include: {
        product: {
          include: {
            images: {
              where: { isPrimary: true },
              take: 1
            }
          }
        }
      }
    });

    console.log('Added to wishlist:', wishlistItem.id);

    return res.status(201).json({
      success: true,
      message: 'Item added to wishlist successfully.',
      data: wishlistItem
    });
  } catch (error) {
    console.error('Add to wishlist error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while adding to wishlist.'
    });
  }
};

// Remove item from wishlist
const removeFromWishlist = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.params;

    console.log('Remove from wishlist request:', { userId, productId });

    // Find wishlist item
    const wishlistItem = await prisma.wishlist.findUnique({
      where: {
        userId_productId: {
          userId,
          productId: parseInt(productId)
        }
      }
    });

    if (!wishlistItem) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in wishlist.'
      });
    }

    // Delete wishlist item
    await prisma.wishlist.delete({
      where: {
        userId_productId: {
          userId,
          productId: parseInt(productId)
        }
      }
    });

    console.log('Removed from wishlist:', productId);

    return res.status(200).json({
      success: true,
      message: 'Item removed from wishlist successfully.',
      data: { productId: parseInt(productId) }
    });
  } catch (error) {
    console.error('Remove from wishlist error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while removing from wishlist.'
    });
  }
};

// Move wishlist item to cart
const moveToCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.params;
    const { quantity = 1 } = req.body;

    console.log('Move to cart request:', { userId, productId, quantity });

    // Check if product exists and is active
    const product = await prisma.product.findUnique({
      where: { id: parseInt(productId) },
      include: {
        images: {
          where: { isPrimary: true },
          take: 1
        }
      }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      });
    }

    if (!product.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Product is not available.'
      });
    }

    // Check stock using totalStock field (not inventory relation)
    if (product.totalStock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock available. Only ${product.totalStock} units in stock.`
      });
    }

    // Add to cart
    const cartItem = await prisma.cart.upsert({
      where: {
        userId_productId: {
          userId,
          productId: parseInt(productId)
        }
      },
      update: {
        quantity: {
          increment: quantity
        }
      },
      create: {
        userId,
        productId: parseInt(productId),
        quantity,
        priceAtAdd: product.baseSellingPrice,
        bargainApplied: false
      },
      include: {
        product: true
      }
    });

    // Remove from wishlist
    await prisma.wishlist.delete({
      where: {
        userId_productId: {
          userId,
          productId: parseInt(productId)
        }
      }
    });

    console.log('Moved to cart:', cartItem.id);

    return res.status(200).json({
      success: true,
      message: 'Item moved to cart successfully.',
      data: cartItem
    });
  } catch (error) {
    console.error('Move to cart error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while moving to cart.'
    });
  }
};

// Clear entire wishlist
const clearWishlist = async (req, res) => {
  try {
    const userId = req.user.id;

    console.log('Clear wishlist request for user:', userId);

    const result = await prisma.wishlist.deleteMany({
      where: { userId }
    });

    console.log(`Cleared ${result.count} items from wishlist`);

    return res.status(200).json({
      success: true,
      message: 'Wishlist cleared successfully.',
      data: { deletedCount: result.count }
    });
  } catch (error) {
    console.error('Clear wishlist error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while clearing wishlist.'
    });
  }
};

// Get all wishlists for admin
// Get all wishlists for admin
const getAllWishlistsAdmin = async (req, res) => {
  try {
    console.log('=== ADMIN WISHLIST DEBUG ===');
    console.log('req.user:', req.user);
    console.log('req.user.role:', req.user.role);
    
    // ✅ Check for ADMIN role (uppercase)
    if (!req.user || req.user.role !== 'ADMIN') {
      console.log('❌ Access denied - Role:', req.user?.role);
      return res.status(403).json({
        success: false,
        message: 'Admin access required.'
      });
    }

    console.log('✅ Admin access granted');
    console.log('Admin fetching all wishlists');

    const wishlists = await prisma.wishlist.findMany({
      include: {
        product: {
          include: {
            images: {
              where: { isPrimary: true },
              take: 1
            }
          }
        },
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      },
      orderBy: {
        addedAt: 'desc'
      }
    });

    console.log(`Found ${wishlists.length} total wishlist items`);

    return res.status(200).json({
      success: true,
      message: 'All wishlists retrieved successfully.',
      data: wishlists
    });
  } catch (error) {
    console.error('Get all wishlists error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching wishlists.'
    });
  }
};

module.exports = {
     getWishlist,
     addToWishlist,
     removeFromWishlist,
     moveToCart,
     clearWishlist,
     getAllWishlistsAdmin  // ← This must be here!
   };