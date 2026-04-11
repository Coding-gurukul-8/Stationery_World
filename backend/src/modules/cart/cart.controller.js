// cart.controller.js  —  Stationery World v4.0
//
// Upgrades:
//  - 🔧 Cart validates stock before adding/updating (Section 10.3)
//  - 🔧 validateCartStock: new helper called before checkout to confirm all items still in stock
//  - 🔧 Bulk discount auto-applied when minQty threshold is met (Section 10.3)
//  - All existing functions PRESERVED

const prisma = require('../../../prisma/client');

// ── Helper: apply bulk discount for a product at given quantity ───────────────
const applyBulkDiscount = (basePrice, quantity, bulkDiscounts = []) => {
  if (!bulkDiscounts || bulkDiscounts.length === 0) return basePrice;

  // Find the best discount tier where minQty <= quantity
  const eligibleDiscounts = bulkDiscounts
    .filter(d => quantity >= d.minQty)
    .sort((a, b) => b.minQty - a.minQty); // highest threshold first

  if (eligibleDiscounts.length === 0) return basePrice;

  const best = eligibleDiscounts[0];
  if (best.unit === 'PERCENT') {
    return Math.max(0, basePrice * (1 - best.discount / 100));
  } else {
    // RUPEES
    return Math.max(0, basePrice - best.discount);
  }
};

// =============================================================================
// GET CART
// =============================================================================
const getCart = async (req, res) => {
  try {
    const userId = req.user.id;

    const cartItems = await prisma.cart.findMany({
      where: { userId },
      include: {
        product: {
          include: {
            images: { where: { isPrimary: true }, take: 1 },
            bulkDiscounts: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Recalculate totals with bulk discounts applied
    let subtotal = 0;
    const itemsWithDiscount = cartItems.map(item => {
      const effectivePrice = applyBulkDiscount(
        item.priceAtAdd,
        item.quantity,
        item.product?.bulkDiscounts
      );
      const itemTotal = effectivePrice * item.quantity;
      subtotal += itemTotal;

      return {
        ...item,
        effectivePrice: parseFloat(effectivePrice.toFixed(2)),
        itemTotal: parseFloat(itemTotal.toFixed(2)),
        discountApplied: effectivePrice < item.priceAtAdd,
        // Stock availability status — frontend can show warning
        inStock: item.product ? item.product.totalStock >= item.quantity : false,
        availableStock: item.product?.totalStock || 0
      };
    });

    const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

    return res.status(200).json({
      success: true,
      message: 'Cart retrieved successfully.',
      data: {
        items: itemsWithDiscount,
        subtotal: parseFloat(subtotal.toFixed(2)),
        itemCount
      }
    });
  } catch (error) {
    console.error('Get cart error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while fetching cart.' });
  }
};

// =============================================================================
// ADD TO CART
// =============================================================================
const addToCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, quantity = 1, bargainApplied = false } = req.body;

    if (!productId) return res.status(400).json({ success: false, message: 'Product ID is required.' });
    if (quantity < 1) return res.status(400).json({ success: false, message: 'Quantity must be at least 1.' });

    const product = await prisma.product.findUnique({
      where: { id: parseInt(productId) },
      include: {
        bargainConfig: true,
        bulkDiscounts: true,
        images: { where: { isPrimary: true }, take: 1 }
      }
    });

    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
    if (!product.isActive) return res.status(400).json({ success: false, message: 'Product is not available.' });

    // 🔧 UPGRADE: Stock validation before adding to cart (Section 10.3)
    if (product.totalStock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Only ${product.totalStock} unit(s) available.`,
        data: { availableStock: product.totalStock }
      });
    }

    // Determine effective price (apply bulk discount)
    let priceAtAdd = applyBulkDiscount(product.baseSellingPrice, quantity, product.bulkDiscounts);
    priceAtAdd = parseFloat(priceAtAdd.toFixed(2));

    const existingCartItem = await prisma.cart.findUnique({
      where: { userId_productId: { userId, productId: parseInt(productId) } }
    });

    let cartItem;

    if (existingCartItem) {
      const newQuantity = existingCartItem.quantity + quantity;

      // 🔧 Validate updated total quantity against stock
      if (product.totalStock < newQuantity) {
        return res.status(400).json({
          success: false,
          message: `Only ${product.totalStock} unit(s) available. You already have ${existingCartItem.quantity} in your cart.`,
          data: { availableStock: product.totalStock, inCart: existingCartItem.quantity }
        });
      }

      // Recalculate price with new quantity
      const newPrice = applyBulkDiscount(product.baseSellingPrice, newQuantity, product.bulkDiscounts);

      cartItem = await prisma.cart.update({
        where: { id: existingCartItem.id },
        data: { quantity: newQuantity, priceAtAdd: parseFloat(newPrice.toFixed(2)), bargainApplied },
        include: { product: { include: { images: { where: { isPrimary: true }, take: 1 } } } }
      });
    } else {
      cartItem = await prisma.cart.create({
        data: { userId, productId: parseInt(productId), quantity, priceAtAdd, bargainApplied },
        include: { product: { include: { images: { where: { isPrimary: true }, take: 1 } } } }
      });
    }

    return res.status(201).json({
      success: true,
      message: existingCartItem ? 'Cart updated successfully.' : 'Item added to cart successfully.',
      data: cartItem
    });
  } catch (error) {
    console.error('Add to cart error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while adding to cart.' });
  }
};

// =============================================================================
// UPDATE CART ITEM
// =============================================================================
const updateCartItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity < 1) return res.status(400).json({ success: false, message: 'Valid quantity is required.' });

    const cartItem = await prisma.cart.findUnique({
      where: { id: parseInt(id) },
      include: { product: { include: { bulkDiscounts: true } } }
    });

    if (!cartItem) return res.status(404).json({ success: false, message: 'Cart item not found.' });
    if (cartItem.userId !== userId) return res.status(403).json({ success: false, message: 'Access denied.' });

    // 🔧 UPGRADE: Stock validation on update (Section 10.3)
    if (cartItem.product.totalStock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${cartItem.product.totalStock} unit(s) available.`,
        data: { availableStock: cartItem.product.totalStock }
      });
    }

    // Recalculate price with new quantity (bulk discount may change tier)
    const newPrice = applyBulkDiscount(cartItem.product.baseSellingPrice, quantity, cartItem.product.bulkDiscounts);

    const updatedCartItem = await prisma.cart.update({
      where: { id: parseInt(id) },
      data: { quantity, priceAtAdd: parseFloat(newPrice.toFixed(2)) },
      include: { product: { include: { images: { where: { isPrimary: true }, take: 1 } } } }
    });

    return res.status(200).json({ success: true, message: 'Cart item updated successfully.', data: updatedCartItem });
  } catch (error) {
    console.error('Update cart item error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while updating cart item.' });
  }
};

// =============================================================================
// REMOVE FROM CART
// =============================================================================
const removeFromCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const cartItem = await prisma.cart.findUnique({ where: { id: parseInt(id) } });
    if (!cartItem) return res.status(404).json({ success: false, message: 'Cart item not found.' });
    if (cartItem.userId !== userId) return res.status(403).json({ success: false, message: 'Access denied.' });

    await prisma.cart.delete({ where: { id: parseInt(id) } });

    return res.status(200).json({ success: true, message: 'Item removed from cart successfully.', data: { id: parseInt(id) } });
  } catch (error) {
    console.error('Remove from cart error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while removing from cart.' });
  }
};

// =============================================================================
// CLEAR CART
// =============================================================================
const clearCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await prisma.cart.deleteMany({ where: { userId } });
    return res.status(200).json({ success: true, message: 'Cart cleared successfully.', data: { deletedCount: result.count } });
  } catch (error) {
    console.error('Clear cart error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while clearing cart.' });
  }
};

// =============================================================================
// 🆕 VALIDATE CART STOCK — called before checkout (Section 10.3)
// POST /api/cart/validate
// Returns items that are out-of-stock or have insufficient stock
// =============================================================================
const validateCartStock = async (req, res) => {
  try {
    const userId = req.user.id;

    const cartItems = await prisma.cart.findMany({
      where: { userId },
      include: { product: true }
    });

    if (cartItems.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty.' });
    }

    const issues = [];
    const valid = [];

    for (const item of cartItems) {
      if (!item.product || !item.product.isActive) {
        issues.push({
          cartItemId: item.id,
          productId: item.productId,
          productName: item.product?.name || 'Unknown',
          reason: 'Product is no longer available.',
          requested: item.quantity,
          available: 0
        });
        continue;
      }

      if (item.product.totalStock < item.quantity) {
        issues.push({
          cartItemId: item.id,
          productId: item.productId,
          productName: item.product.name,
          reason: item.product.totalStock === 0 ? 'Out of stock.' : `Only ${item.product.totalStock} unit(s) available.`,
          requested: item.quantity,
          available: item.product.totalStock
        });
      } else {
        valid.push(item.id);
      }
    }

    return res.status(200).json({
      success: issues.length === 0,
      message: issues.length === 0 ? 'All cart items are available.' : 'Some items have stock issues.',
      data: {
        canCheckout: issues.length === 0,
        issues,
        validItemCount: valid.length,
        totalItems: cartItems.length
      }
    });
  } catch (error) {
    console.error('Validate cart stock error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while validating cart.' });
  }
};

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  validateCartStock
};
