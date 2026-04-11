const prisma = require('../../../prisma/client');

// Create order from cart
const createOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { recipientName, recipientPhone, addressLine1, addressLine2, city, state, postalCode, country, note,
      // 🆕 Optional pickup/delivery slot (Section 6.3)
      pickupTime, deliverySlot,
      // Optional payment method (for address + payment confirm step)
      paymentMethod } = req.body;
    
    // Get cart items
    const cartItems = await prisma.cart.findMany({
      where: { userId },
      include: {
        product: {
          include: {
            images: { where: { isPrimary: true }, take: 1 },
            createdBy: { select: { id: true, name: true, email: true, role: true } }
          }
        }
      }
    });

    if (cartItems.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty.' });
    }

    // Validate stock availability
    for (const item of cartItems) {
      if (item.product.totalStock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${item.product.name}. Available: ${item.product.totalStock}`
        });
      }
      if (!item.product.isActive) {
        return res.status(400).json({
          success: false,
          message: `Product ${item.product.name} is no longer available.`
        });
      }
    }

    // Calculate totals
    const totalAmount = cartItems.reduce((sum, item) => sum + (item.priceAtAdd * item.quantity), 0);
    const totalSp = totalAmount;
    const totalCp = cartItems.reduce((sum, item) => sum + (item.product.costPrice * item.quantity), 0);

    // Get user info
    const user = await prisma.user.findUnique({ where: { id: userId } });
    // Here We Need to Update that user.role = Admin then Check user.id== product.createdById then SELF else ADMIN and customer is customer
    // ✅ FIXED: Determine order type correctly
    let orderType;
    if (user.role === 'ADMIN') {
      // Admin ordering for themselves = SELF
      orderType = 'SELF';
    } else {
      // Customer ordering = CUSTOMER
      orderType = 'CUSTOMER';
    }

    console.log('📦 Order type determined:', orderType, '| User role:', user.role, '| User ID:', userId);

    // Create order
    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          userId,
          placedById: userId,
          recipientName: recipientName || user.name,
          recipientPhone: recipientPhone || user.phone || '',
          addressLine1: addressLine1 || user.addressLine1 || '',
          addressLine2: addressLine2 || user.addressLine2,
          city: city || user.city || '',
          state: state || user.state || '',
          postalCode: postalCode || user.postalCode || '',
          country: country || user.country || '',
          note: note || null,
          // 🆕 Store pickup/delivery slot (Section 6.3)
          pickupTime: pickupTime || null,
          deliverySlot: deliverySlot || null,
          totalAmount,
          totalSp,
          totalCp,
          status: 'PENDING',
          type: orderType,
          isPaid: false,
          // Store preferred payment method if supplied
          paymentMethod: paymentMethod || null
        }
      });

      await Promise.all(cartItems.map(item =>
        tx.orderItem.create({
          data: {
            orderId: newOrder.id,
            productId: item.productId,
            productName: item.product.name,
            productPhoto: item.product.images[0]?.url || null,
            quantity: item.quantity,
            cp: item.product.costPrice,
            sp: item.priceAtAdd,
            subtotalSp: item.priceAtAdd * item.quantity,
            subtotalCp: item.product.costPrice * item.quantity,
            priceAtOrder: item.priceAtAdd,
            bargainApplied: item.bargainApplied
          }
        })
      ));

      // Clear cart after order creation
      await tx.cart.deleteMany({ where: { userId } });

      return newOrder;
    });
    
    const completeOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: {
        items: {
          include: {
            product: {
              include: { createdBy: { select: { id: true, name: true, email: true, role: true } } }
            }
          }
        },
        placedBy: { select: { id: true, name: true, email: true, role: true } }
      }
    });
    

    return res.status(201).json({ success: true, message: 'Order created successfully.', data: completeOrder });
  } catch (error) {
    console.error('Create order error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while creating order.' });
  }
};

// ✅ NEW: Create order for customer (Admin only)
const createOrderForCustomer = async (req, res) => {
  try {
    const adminId = req.user.id;
    const {
      customerId, items,
      recipientName, recipientPhone,
      addressLine1, addressLine2, city, state, postalCode, country,
      note, pickupTime, deliverySlot
    } = req.body;

    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Only admins can create orders for customers.' });
    }

    // Validate required fields
    if (!customerId || !items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Customer ID and items are required.' });
    }

    // Get customer info
    const customer = await prisma.user.findUnique({ where: { id: parseInt(customerId) } });
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });

    // Fetch all products
    const productIds = items.map(i => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { images: { where: { isPrimary: true }, take: 1 }, createdBy: { select: { id: true, name: true, email: true, role: true } } }
    });

    // Validate stock and calculate totals
    let totalSp = 0, totalCp = 0;
    const orderItemsData = [];

    for (const item of items) {
      const product = products.find(p => p.id === item.productId);
      if (!product) return res.status(404).json({ success: false, message: `Product ID ${item.productId} not found.` });
      if (!product.isActive) return res.status(400).json({ success: false, message: `Product "${product.name}" is not active.` });
      if (product.totalStock < item.quantity) {
        return res.status(400).json({ success: false, message: `Insufficient stock for "${product.name}". Available: ${product.totalStock}.` });
      }
      const itemSp = product.baseSellingPrice * item.quantity;
      const itemCp = product.costPrice * item.quantity;
      totalSp += itemSp;
      totalCp += itemCp;
      orderItemsData.push({
        productId: product.id, productName: product.name,
        productPhoto: product.images[0]?.url || null,
        quantity: item.quantity, cp: product.costPrice, sp: product.baseSellingPrice,
        subtotalSp: itemSp, subtotalCp: itemCp, priceAtOrder: product.baseSellingPrice,
        bargainApplied: false
      });
    }

    // Create order (type = ADMIN)
    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          userId: customer.id,
          placedById: adminId,
          adminId: adminId,
          recipientName: recipientName || customer.name,
          recipientPhone: recipientPhone || customer.phone || '',
          addressLine1: addressLine1 || customer.addressLine1 || '',
          addressLine2: addressLine2 || customer.addressLine2,
          city: city || customer.city || '',
          state: state || customer.state || '',
          postalCode: postalCode || customer.postalCode || '',
          country: country || customer.country || '',
          note: note || null,
          totalAmount: totalSp,
          totalSp,
          totalCp,
          status: 'PENDING',
          type: 'ADMIN',
          isPaid: false
        }
      });

      // Create order items
      await Promise.all(orderItemsData.map(d => tx.orderItem.create({ data: { orderId: newOrder.id, ...d } })));
      return newOrder;
    });

    const completeOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: {
        items: {
          include: {
            product: {
              include: {
                createdBy: { select: { id: true, name: true, email: true, role: true } }
              }
            }
          }
        },
        user: { select: { id: true, name: true, email: true, role: true } },
        placedBy: { select: { id: true, name: true, email: true, role: true } }
      }
    });

    return res.status(201).json({ success: true, message: 'Order created for customer.', data: completeOrder });
  } catch (error) {
    console.error('Create order for customer error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while creating order.' });
  }
};

// Confirm order (deduct inventory)
const confirmOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'ADMIN';

    console.log('Confirm order request:', { orderId: id, userId, isAdmin });

    const order = await prisma.order.findUnique({
      where: { id: parseInt(id) },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.'
      });
    }

    if (!isAdmin && order.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied.'
      });
    }

    if (order.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `Order cannot be confirmed. Current status: ${order.status}`
      });
    }

    // Validate stock
    for (const item of order.items) {
      if (item.product.totalStock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${item.product.name}.`
        });
      }
    }

    // Update order and deduct inventory
    const updatedOrder = await prisma.$transaction(async (tx) => {
      // Deduct stock
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            totalStock: {
              decrement: item.quantity
            },
            totalSold: {
              increment: item.quantity
            }
          }
        });

        await tx.inventoryLog.create({
          data: {
            productId: item.productId,
            action: 'ORDER_DEDUCTION',
            quantity: -item.quantity,
            adminId: isAdmin ? userId : null,
            note: `Order #${order.id} confirmed`
          }
        });

        const updatedProduct = await tx.product.findUnique({
          where: { id: item.productId }
        });

        if (updatedProduct && updatedProduct.totalStock <= updatedProduct.lowStockThreshold) {
          await tx.notification.create({
            data: {
              userId: null,
              type: 'LOW_STOCK',
              message: `Low stock alert: ${updatedProduct.name} (${updatedProduct.totalStock} remaining)`,
              isRead: false
            }
          });
        }
      }

      await tx.orderAudit.create({
        data: {
          orderId: order.id,
          adminId: isAdmin ? userId : null,
          fromStatus: 'PENDING',
          toStatus: 'CONFIRMED',
          note: 'Order confirmed, inventory deducted'
        }
      });

      return await tx.order.update({
        where: { id: parseInt(id) },
        data: { status: 'CONFIRMED' },
        include: {
          items: {
            include: {
              product: true
            }
          }
        }
      });
    });

    console.log('Order confirmed and inventory deducted:', updatedOrder.id);

    return res.status(200).json({
      success: true,
      message: 'Order confirmed successfully.',
      data: updatedOrder
    });
  } catch (error) {
    console.error('Confirm order error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while confirming order.'
    });
  }
};

// Get user's orders
const getUserOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;


    const where = { userId };
    if (status) {
      where.status = status;
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        items: {
          include: {
            product: {
              include: {
                createdBy: {
                  select: { id: true, name: true, email: true, role: true }
                }
              }
            }
          }
        },
        payment: true,
        placedBy: {
          select: { id: true, name: true, email: true, role: true }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`Found ${orders.length} orders for user ${userId}`);

    return res.status(200).json({
      success: true,
      message: 'Orders retrieved successfully.',
      data: orders,
      count: orders.length
    });
  } catch (error) {
    console.error('Get user orders error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching orders.'
    });
  }
};

// =============================================================================
// GET ORDER BY ID
// =============================================================================
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'ADMIN';

    const order = await prisma.order.findUnique({
      where: { id: parseInt(id) },
      include: {
        items: {
          include: { product: { include: { createdBy: { select: { id: true, name: true, email: true, role: true } } } } }
        },
        payment: true,
        user: { select: { id: true, name: true, email: true, phone: true, role: true } },
        placedBy: { select: { id: true, name: true, email: true, role: true } }
      }
    });

    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (!isAdmin && order.userId !== userId) return res.status(403).json({ success: false, message: 'Access denied.' });

    return res.status(200).json({ success: true, message: 'Order retrieved successfully.', data: order });
  } catch (error) {
    console.error('Get order by ID error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while fetching order.' });
  }
};

// =============================================================================
// CANCEL ORDER
// =============================================================================
const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'ADMIN';

    const order = await prisma.order.findUnique({
      where: { id: parseInt(id) },
      include: { items: { include: { product: true } } }
    });

    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (!isAdmin && order.userId !== userId) return res.status(403).json({ success: false, message: 'Access denied.' });
    if (['SHIPPED', 'DELIVERED'].includes(order.status)) {
      return res.status(400).json({ success: false, message: 'Order cannot be canceled after shipping. Please request a return.' });
    }
    if (order.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Order is already canceled.' });
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      if (order.status === 'CONFIRMED' || order.status === 'PAID') {
        for (const item of order.items) {
          await tx.product.update({ where: { id: item.productId }, data: { totalStock: { increment: item.quantity } } });
          await tx.inventoryLog.create({
            data: { productId: item.productId, action: 'ORDER_RESTORATION', quantity: item.quantity, adminId: isAdmin ? userId : null, note: `Order #${order.id} canceled` }
          });
        }
      }
      if (order.isPaid) {
        await tx.profitLedger.deleteMany({ where: { orderId: order.id } });
      }
      await tx.orderAudit.create({
        data: { orderId: order.id, adminId: isAdmin ? userId : null, fromStatus: order.status, toStatus: 'CANCELLED', note: 'Order canceled' }
      });
      return await tx.order.update({
        where: { id: parseInt(id) },
        data: { status: 'CANCELLED' },
        include: { items: { include: { product: true } } }
      });
    });

    return res.status(200).json({ success: true, message: 'Order canceled successfully.', data: updatedOrder });
  } catch (error) {
    console.error('Cancel order error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while canceling order.' });
  }
};

// =============================================================================
// GET ALL ORDERS (Admin)
// =============================================================================
const getAllOrders = async (req, res) => {
  try {
    const { status, userId, startDate, endDate, type } = req.query;
    const loggedInUserId = req.user.id;

    const where = {};
    // ─────────────────────────────────────────────────────────────────────
    // TYPE FILTER
    //
    //  SELF     → orders WHERE order.userId === currently logged-in person
    //             Priyanshu logged in → only Priyanshu's orders
    //             Ayan logged in      → only Ayan's orders
    //
    //  CUSTOMER → orders placed by customers (order.type === 'CUSTOMER')
    //             excludes all admin-placed orders
    //
    //  ADMIN    → ALL orders in the store, no userId restriction
    //             both Priyanshu's and Ayan's orders appear here
    //
    //  (none)   → ALL orders, backward compatible
    // ─────────────────────────────────────────────────────────────────────
    if (type) {
      const typeUpper = type.toUpperCase();
      if (typeUpper === 'SELF') {
        where.userId = loggedInUserId;
      } else if (typeUpper === 'CUSTOMER') {
        where.type = 'CUSTOMER';
      }
      // ADMIN or unrecognised → no filter, show everything
    }

    if (status) where.status = status;
    // userId query param: only apply if SELF hasn't already locked userId
    if (userId && !where.userId) where.userId = parseInt(userId);
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate)   where.createdAt.lte = new Date(endDate);
    }


    const orders = await prisma.order.findMany({
      where,
      include: {
        items: {
          include: {
            product: {
              include: {
                createdBy: { select: { id: true, name: true, email: true, role: true } },
                images: true
              }
            }
          }
        },
        payment: true,
        user: { select: { id: true, name: true, email: true, phone: true, role: true } },
        placedBy: { select: { id: true, name: true, email: true, role: true } },
        admin: { select: { id: true, name: true, email: true } },
        audits: {
          include: { admin: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json({ success: true, message: 'Orders retrieved successfully.', data: orders, count: orders.length });
  } catch (error) {
    console.error('Get all orders error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while fetching orders.' });
  }
};

// =============================================================================
// MARK ORDER AS PAID — 🔧 SELF order accounting fixed (Section 6.3)
// SELF orders: deduct CP as investment, record SP as revenue
// =============================================================================
const markOrderAsPaid = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const order = await prisma.order.findUnique({
      where: { id: parseInt(id) },
      include: {
        items: {
          include: { product: { select: { id: true, name: true, createdById: true, costPrice: true } } }
        }
      }
    });

    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (!['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'].includes(order.status)) {
      return res.status(400).json({ success: false, message: `Cannot mark as paid. Order status must be CONFIRMED, PROCESSING, SHIPPED, or DELIVERED. Current: ${order.status}` });
    }
    if (order.isPaid) return res.status(400).json({ success: false, message: 'Order is already marked as paid.' });

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({ where: { id: parseInt(id) }, data: { isPaid: true } });

      let adminRevenue = 0, adminCost = 0, adminItemsCount = 0;

      order.items.forEach(item => {
        if (item.product && item.product.createdById === userId) {
          adminRevenue += item.priceAtOrder * item.quantity;
          adminCost    += item.product.costPrice * item.quantity;
          adminItemsCount++;
        }
      });

      const adminProfit = adminRevenue - adminCost;

      if (adminItemsCount > 0) {
        // 🔧 SELF ORDER accounting: record profit but also deduct CP as investment cost
        if (order.type === 'SELF') {
          // For SELF orders: Admin bought their own product.
          // Record the cost price as a negative (investment) and selling price as positive (cash inflow).
          // Net effect: activeCash += SP - CP (profit)
          await tx.profitLedger.create({
            data: {
              orderId: order.id, adminId: userId,
              amount: adminProfit,
              note: `SELF order #${order.uid} | SP: ₹${adminRevenue.toFixed(2)} | CP deducted: ₹${adminCost.toFixed(2)} | Net profit: ₹${adminProfit.toFixed(2)}`
            }
          });
        } else {
          // CUSTOMER or ADMIN order — standard profit recording
          await tx.profitLedger.create({
            data: {
              orderId: order.id, adminId: userId,
              amount: adminProfit,
              note: `Profit from Order #${order.uid} | ${adminItemsCount} item(s) | Revenue: ₹${adminRevenue.toFixed(2)} | Cost: ₹${adminCost.toFixed(2)}`
            }
          });
        }
      }

      await tx.orderAudit.create({
        data: {
          orderId: order.id, adminId: userId,
          fromStatus: order.status, toStatus: order.status,
          note: adminItemsCount > 0
            ? `Order marked PAID | ${order.type} | Admin earned ₹${adminProfit.toFixed(2)} profit from ${adminItemsCount} item(s)`
            : 'Order marked PAID | No items from this admin in order'
        }
      });

      return updated;
    });

    return res.status(200).json({ success: true, message: 'Order marked as paid successfully.', data: updatedOrder });
  } catch (error) {
    console.error('Mark order as paid error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while marking order as paid.' });
  }
};

// =============================================================================
// PROCESS REFUND
// =============================================================================
const processRefund = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const order = await prisma.order.findUnique({ where: { id: parseInt(id) } });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (!order.isPaid) return res.status(400).json({ success: false, message: 'Cannot refund — order was not paid.' });
    if (!['CANCELLED', 'RETURNED'].includes(order.status)) {
      return res.status(400).json({ success: false, message: `Cannot refund. Order must be CANCELLED or RETURNED. Current: ${order.status}` });
    }

    await prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: parseInt(id) }, data: { isPaid: false } });
      const deleted = await tx.profitLedger.deleteMany({ where: { orderId: order.id, adminId: userId } });
      await tx.orderAudit.create({
        data: {
          orderId: order.id, adminId: userId,
          fromStatus: order.status, toStatus: order.status,
          note: `Refund processed | ${deleted.count} profit entry removed for admin ${userId}`
        }
      });
    });

    return res.status(200).json({ success: true, message: 'Refund processed successfully.', data: { orderId: parseInt(id) } });
  } catch (error) {
    console.error('Process refund error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while processing refund.' });
  }
};

// =============================================================================
// UPDATE ORDER STATUS (Admin)
// =============================================================================
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, note, isPaid, paymentMethod } = req.body;
    const userId = req.user.id;

    const validStatuses = ['PENDING', 'PROCESSING', 'CONFIRMED', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURN_REQUESTED', 'RETURNED'];

    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const order = await prisma.order.findUnique({
      where: { id: parseInt(id) },
      include: { items: { include: { product: true } } }
    });

    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    const oldStatus = order.status;

    // Handle RETURN_REQUESTED → RETURNED
    if (status === 'RETURNED' && order.status === 'RETURN_REQUESTED') {
      await prisma.$transaction(async (tx) => {
        for (const item of order.items) {
          const current = await tx.product.findUnique({ where: { id: item.productId }, select: { totalSold: true } });
          await tx.product.update({
            where: { id: item.productId },
            data: { totalStock: { increment: item.quantity }, totalSold: { decrement: Math.min(item.quantity, current.totalSold) } }
          });
          await tx.inventoryLog.create({
            data: { productId: item.productId, action: 'ORDER_RESTORATION', quantity: item.quantity, adminId: userId, note: `Return approved — Order #${order.uid || order.id}` }
          });
        }
        if (order.isPaid) {
          await tx.profitLedger.deleteMany({ where: { orderId: order.id } });
          await tx.order.update({ where: { id: parseInt(id) }, data: { isPaid: false } });
        }
        await tx.orderAudit.create({ data: { orderId: order.id, adminId: userId, fromStatus: oldStatus, toStatus: 'RETURNED', note: note || 'Return approved, inventory restored' } });
        await tx.order.update({ where: { id: parseInt(id) }, data: { status: 'RETURNED' } });
      });
    }
    // Handle CANCELLED
    else if (status === 'CANCELLED') {
      await prisma.$transaction(async (tx) => {
        if (['CONFIRMED', 'PAID', 'PROCESSING', 'SHIPPED'].includes(order.status)) {
          for (const item of order.items) {
            const current = await tx.product.findUnique({ where: { id: item.productId }, select: { totalSold: true } });
            await tx.product.update({
              where: { id: item.productId },
              data: { totalStock: { increment: item.quantity }, totalSold: { decrement: Math.min(item.quantity, current.totalSold) } }
            });
            await tx.inventoryLog.create({
              data: { productId: item.productId, action: 'ORDER_RESTORATION', quantity: item.quantity, adminId: userId, note: `Order #${order.uid || order.id} cancelled` }
            });
          }
        }
        if (order.isPaid) {
          await tx.profitLedger.deleteMany({ where: { orderId: order.id } });
          await tx.order.update({ where: { id: parseInt(id) }, data: { isPaid: false } });
        }
        await tx.orderAudit.create({ data: { orderId: order.id, adminId: userId, fromStatus: oldStatus, toStatus: 'CANCELLED', note: note || 'Order cancelled, inventory restored' } });
        await tx.order.update({ where: { id: parseInt(id) }, data: { status: 'CANCELLED' } });
      });
    }
    else {
      // Generic status update — also allow updating isPaid and paymentMethod directly
      const updateFields = {};
      if (status) updateFields.status = status;
      if (isPaid !== undefined) updateFields.isPaid = isPaid;
      if (paymentMethod !== undefined) updateFields.paymentMethod = paymentMethod;

      await prisma.$transaction(async (tx) => {
        if (status) {
          await tx.orderAudit.create({
            data: { orderId: order.id, adminId: userId, fromStatus: oldStatus, toStatus: status, note: note || `Status updated to ${status}` }
          });
        }
        await tx.order.update({ where: { id: parseInt(id) }, data: updateFields });
      });
    }

    const updatedOrder = await prisma.order.findUnique({
      where: { id: parseInt(id) },
      include: { items: { include: { product: true } } }
    });

    return res.status(200).json({ success: true, message: 'Order updated successfully.', data: updatedOrder });
  } catch (error) {
    console.error('Update order status error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while updating order status.' });
  }
};

// =============================================================================
// REQUEST RETURN (Customer)
// =============================================================================
const requestReturn = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;

    const order = await prisma.order.findUnique({
      where: { id: parseInt(id) },
      include: { items: { include: { product: { include: { createdBy: true } } } } }
    });

    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (order.userId !== userId) return res.status(403).json({ success: false, message: 'Access denied.' });
    if (order.status !== 'DELIVERED') return res.status(400).json({ success: false, message: 'Only delivered orders can be returned.' });

    await prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: parseInt(id) }, data: { status: 'RETURN_REQUESTED', note: `${order.note || ''}\n\nReturn requested: ${reason}`.trim() } });
      await tx.orderAudit.create({
        data: { orderId: order.id, fromStatus: 'DELIVERED', toStatus: 'RETURN_REQUESTED', note: `Customer return request: ${reason}` }
      });
    });

    const updatedOrder = await prisma.order.findUnique({ where: { id: parseInt(id) }, include: { items: { include: { product: true } } } });

    return res.status(200).json({ success: true, message: 'Return request submitted. Awaiting admin approval.', data: updatedOrder });
  } catch (error) {
    console.error('Request return error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

module.exports = {
  createOrder,
  createOrderForCustomer,
  confirmOrder,
  getUserOrders,
  getOrderById,
  cancelOrder,
  getAllOrders,
  updateOrderStatus,
  requestReturn,
  markOrderAsPaid,
  processRefund
};
