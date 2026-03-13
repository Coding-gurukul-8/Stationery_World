const prisma = require('../../../prisma/client');

// Get user's cart
const getCart = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('Get cart request for user:', userId);

    const cartItems = await prisma.cart.findMany({
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
        createdAt: 'desc'
      }
    });

    // Calculate cart totals
    const subtotal = cartItems.reduce((sum, item) => sum + (item.priceAtAdd * item.quantity), 0);
    const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

    console.log(`Found ${cartItems.length} cart items for user ${userId}`);

    return res.status(200).json({
      success: true,
      message: 'Cart retrieved successfully.',
      data: {
        items: cartItems,
        subtotal,
        itemCount
      }
    });
  } catch (error) {
    console.error('Get cart error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching cart.'
    });
  }
};

// Add item to cart
const addToCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, quantity = 1, bargainApplied = false } = req.body;

    console.log('Add to cart request:', { userId, productId, quantity });

    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'Product ID is required.'
      });
    }

    if (quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be at least 1.'
      });
    }

    // Check if product exists and is active
    const product = await prisma.product.findUnique({
      where: { id: parseInt(productId) },
      include: {
        bargainConfig: true,
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

    // Check stock availability (using totalStock from merged schema)
    if (product.totalStock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock available. Only ${product.totalStock} units in stock.`
      });
    }

    // Determine price
    let priceAtAdd = product.baseSellingPrice;

    // Check if item already in cart
    const existingCartItem = await prisma.cart.findUnique({
      where: {
        userId_productId: {
          userId,
          productId: parseInt(productId)
        }
      }
    });

    let cartItem;

    if (existingCartItem) {
      // Update existing cart item
      const newQuantity = existingCartItem.quantity + quantity;

      // Check if new quantity exceeds stock
      if (product.totalStock < newQuantity) {
        return res.status(400).json({
          success: false,
          message: `Only ${product.totalStock} units available.`
        });
      }

      cartItem = await prisma.cart.update({
        where: {
          id: existingCartItem.id
        },
        data: {
          quantity: newQuantity,
          priceAtAdd,
          bargainApplied
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

      console.log('Updated existing cart item:', cartItem.id);
    } else {
      // Create new cart item
      cartItem = await prisma.cart.create({
        data: {
          userId,
          productId: parseInt(productId),
          quantity,
          priceAtAdd,
          bargainApplied
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

      console.log('Created new cart item:', cartItem.id);
    }

    return res.status(201).json({
      success: true,
      message: existingCartItem ? 'Cart updated successfully.' : 'Item added to cart successfully.',
      data: cartItem
    });
  } catch (error) {
    console.error('Add to cart error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while adding to cart.'
    });
  }
};

// Update cart item quantity
const updateCartItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { quantity } = req.body;

    console.log('Update cart item request:', { userId, cartItemId: id, quantity });

    if (!quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Valid quantity is required.'
      });
    }

    // Find cart item
    const cartItem = await prisma.cart.findUnique({
      where: { id: parseInt(id) },
      include: {
        product: true
      }
    });

    if (!cartItem) {
      return res.status(404).json({
        success: false,
        message: 'Cart item not found.'
      });
    }

    // Verify ownership
    if (cartItem.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied.'
      });
    }

    // Check stock availability
    if (cartItem.product.totalStock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${cartItem.product.totalStock} units available.`
      });
    }

    // Update quantity
    const updatedCartItem = await prisma.cart.update({
      where: { id: parseInt(id) },
      data: { quantity },
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

    console.log('Cart item updated:', updatedCartItem.id);

    return res.status(200).json({
      success: true,
      message: 'Cart item updated successfully.',
      data: updatedCartItem
    });
  } catch (error) {
    console.error('Update cart item error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while updating cart item.'
    });
  }
};

// Remove item from cart
const removeFromCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    console.log('Remove from cart request:', { userId, cartItemId: id });

    // Find cart item
    const cartItem = await prisma.cart.findUnique({
      where: { id: parseInt(id) }
    });

    if (!cartItem) {
      return res.status(404).json({
        success: false,
        message: 'Cart item not found.'
      });
    }

    // Verify ownership
    if (cartItem.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied.'
      });
    }

    // Delete cart item
    await prisma.cart.delete({
      where: { id: parseInt(id) }
    });

    console.log('Cart item removed:', id);

    return res.status(200).json({
      success: true,
      message: 'Item removed from cart successfully.',
      data: { id: parseInt(id) }
    });
  } catch (error) {
    console.error('Remove from cart error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while removing from cart.'
    });
  }
};

// Clear entire cart
const clearCart = async (req, res) => {
  try {
    const userId = req.user.id;

    console.log('Clear cart request for user:', userId);

    const result = await prisma.cart.deleteMany({
      where: { userId }
    });

    console.log(`Cleared ${result.count} items from cart`);

    return res.status(200).json({
      success: true,
      message: 'Cart cleared successfully.',
      data: { deletedCount: result.count }
    });
  } catch (error) {
    console.error('Clear cart error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while clearing cart.'
    });
  }
};

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart
};
