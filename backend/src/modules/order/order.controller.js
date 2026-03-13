const prisma = require('../../../prisma/client');

// Create order from cart
const createOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { recipientName, recipientPhone, addressLine1, addressLine2, city, state, postalCode, country, note } = req.body;
    
    console.log('Create order request for user:', userId);

    // Get cart items
    const cartItems = await prisma.cart.findMany({
      where: { userId },
      include: {
        product: {
          include: {
            images: {
              where: { isPrimary: true },
              take: 1
            },
            createdBy: {
              select: { id: true, name: true, email: true, role: true }
            }
          }
        }
      }
    });

    if (cartItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty.'
      });
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
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

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
          totalAmount,
          totalSp,
          totalCp,
          status: 'PENDING',
          type: orderType,
          isPaid: false
        }
      });

      // Create order items
      const orderItems = await Promise.all(
        cartItems.map(item =>
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
        )
      );

      // Clear cart
      await tx.cart.deleteMany({
        where: { userId }
      });

      return { ...newOrder, items: orderItems };
    });

    console.log('✅ Order created:', order.id, '| Type:', orderType);

    const completeOrder = await prisma.order.findUnique({
      where: { id: order.id },
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
        placedBy: {
          select: { id: true, name: true, email: true, role: true }
        }
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Order created successfully.',
      data: completeOrder
    });
  } catch (error) {
    console.error('Create order error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while creating order.'
    });
  }
};

// ✅ NEW: Create order for customer (Admin only)
const createOrderForCustomer = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { 
      customerId, 
      items, // Array of { productId, quantity }
      recipientName, 
      recipientPhone, 
      addressLine1, 
      addressLine2, 
      city, 
      state, 
      postalCode, 
      country, 
      note 
    } = req.body;

    console.log('🏪 Admin creating order for customer:', customerId);

    // Validate admin role
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can create orders for customers.'
      });
    }

    // Validate required fields
    if (!customerId || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Customer ID and items are required.'
      });
    }

    // Get customer info
    const customer = await prisma.user.findUnique({
      where: { id: parseInt(customerId) }
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found.'
      });
    }

    // Fetch all products
    const productIds = items.map(i => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: {
        images: { where: { isPrimary: true }, take: 1 },
        createdBy: { select: { id: true, name: true, email: true, role: true } }
      }
    });

    // Validate stock and calculate totals
    let totalSp = 0;
    let totalCp = 0;
    const orderItemsData = [];

    for (const item of items) {
      const product = products.find(p => p.id === item.productId);
      
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product ID ${item.productId} not found.`
        });
      }

      if (!product.isActive) {
        return res.status(400).json({
          success: false,
          message: `Product ${product.name} is not active.`
        });
      }

      if (product.totalStock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}. Available: ${product.totalStock}`
        });
      }

      const itemSp = product.baseSellingPrice * item.quantity;
      const itemCp = product.costPrice * item.quantity;

      totalSp += itemSp;
      totalCp += itemCp;

      orderItemsData.push({
        productId: product.id,
        productName: product.name,
        productPhoto: product.images[0]?.url || null,
        quantity: item.quantity,
        cp: product.costPrice,
        sp: product.baseSellingPrice,
        subtotalSp: itemSp,
        subtotalCp: itemCp,
        priceAtOrder: product.baseSellingPrice,
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
      const orderItems = await Promise.all(
        orderItemsData.map(itemData =>
          tx.orderItem.create({
            data: {
              orderId: newOrder.id,
              ...itemData
            }
          })
        )
      );

      return { ...newOrder, items: orderItems };
    });

    console.log('✅ Admin order created:', order.id, '| Type: ADMIN');

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

    return res.status(201).json({
      success: true,
      message: 'Order created successfully for customer.',
      data: completeOrder
    });
  } catch (error) {
    console.error('Create order for customer error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while creating order.'
    });
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

    console.log('Get orders request for user:', userId);

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

// Get single order
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'ADMIN';

    console.log('Get order by ID:', id);

    const order = await prisma.order.findUnique({
      where: { id: parseInt(id) },
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
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true
          }
        },
        placedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
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

    return res.status(200).json({
      success: true,
      message: 'Order retrieved successfully.',
      data: order
    });
  } catch (error) {
    console.error('Get order by ID error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching order.'
    });
  }
};

// Cancel order
const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'ADMIN';

    console.log('Cancel order request:', { orderId: id, userId });

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

    if (['SHIPPED', 'DELIVERED'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: 'Order cannot be canceled after shipping. Please request a return.'
      });
    }

    if (order.status === 'CANCELED' || order.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        message: 'Order is already canceled.'
      });
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      // Restore inventory if order was CONFIRMED
      if (order.status === 'CONFIRMED' || order.status === 'PAID') {
        for (const item of order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              totalStock: {
                increment: item.quantity
              }
            }
          });

          await tx.inventoryLog.create({
            data: {
              productId: item.productId,
              action: 'ORDER_RESTORATION',
              quantity: item.quantity,
              adminId: isAdmin ? userId : null,
              note: `Order #${order.id} canceled`
            }
          });
        }
      }

      // Delete profit if order was paid
      if (order.isPaid) {
        await tx.profitLedger.deleteMany({
          where: { orderId: order.id }
        });
      }

      await tx.orderAudit.create({
        data: {
          orderId: order.id,
          adminId: isAdmin ? userId : null,
          fromStatus: order.status,
          toStatus: 'CANCELLED',
          note: 'Order canceled'
        }
      });

      return await tx.order.update({
        where: { id: parseInt(id) },
        data: { status: 'CANCELLED' },
        include: {
          items: {
            include: {
              product: true
            }
          }
        }
      });
    });

    console.log('Order canceled and inventory restored:', updatedOrder.id);

    return res.status(200).json({
      success: true,
      message: 'Order canceled successfully.',
      data: updatedOrder
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while canceling order.'
    });
  }
};

// Get all orders (Admin)
const getAllOrders = async (req, res) => {
  try {
    const { status, userId, startDate, endDate, type } = req.query;
    const loggedInUserId = req.user.id;

    console.log('Get all orders request (Admin) | type:', type, '| loggedInUser:', loggedInUserId);

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
                createdBy: {
                  select: { id: true, name: true, email: true, role: true }
                },
                images: true
              }
            }
          }
        },
        payment: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true
          }
        },
        placedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        admin: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        audits: {
          include: {
            admin: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`Found ${orders.length} orders`);

    return res.status(200).json({
      success: true,
      message: 'Orders retrieved successfully.',
      data: orders,
      count: orders.length
    });
  } catch (error) {
    console.error('Get all orders error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching orders.'
    });
  }
};

// ✅ Mark order as paid
const markOrderAsPaid = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log('💰 Mark order as paid:', { orderId: id, adminId: userId });

    const order = await prisma.order.findUnique({
      where: { id: parseInt(id) },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                createdById: true,
                costPrice: true
              }
            }
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

    if (!['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot mark as paid. Order status must be CONFIRMED, PROCESSING, SHIPPED, or DELIVERED. Current status: ${order.status}`
      });
    }

    if (order.isPaid) {
      return res.status(400).json({
        success: false,
        message: 'Order is already marked as paid.'
      });
    }

    // ✅ FIX: Update order and create profit ledger ONLY for this admin's products
    const updatedOrder = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: parseInt(id) },
        data: { isPaid: true }
      });

      // ✅ Calculate profit ONLY for items where product.createdById === current admin
      let adminRevenue = 0;
      let adminCost = 0;
      let adminItemsCount = 0;

      order.items.forEach((item) => {
        if (item.product && item.product.createdById === userId) {
          const itemRevenue = item.priceAtOrder * item.quantity;
          const itemCost = item.product.costPrice * item.quantity;
          adminRevenue += itemRevenue;
          adminCost += itemCost;
          adminItemsCount++;
        }
      });

      const adminProfit = adminRevenue - adminCost;

      // Only create profit ledger entry if this admin has products in the order
      if (adminItemsCount > 0) {
        await tx.profitLedger.create({
          data: {
            orderId: order.id,
            adminId: userId,
            amount: adminProfit,
            note: `Profit from Order #${order.uid} | ${adminItemsCount} item(s) | Revenue: ₹${adminRevenue.toFixed(2)} | Cost: ₹${adminCost.toFixed(2)}`
          }
        });
      }

      await tx.orderAudit.create({
        data: {
          orderId: order.id,
          adminId: userId,
          fromStatus: order.status,
          toStatus: order.status,
          note: adminItemsCount > 0 
            ? `Order marked as PAID | Admin earned ₹${adminProfit.toFixed(2)} profit from ${adminItemsCount} item(s)`
            : 'Order marked as PAID | No items from this admin in order'
        }
      });

      return updated;
    });

    console.log('✅ Order marked as paid successfully:', {
      orderId: updatedOrder.id,
      adminId: userId,
      orderUid: order.uid
    });

    return res.status(200).json({
      success: true,
      message: 'Order marked as paid successfully.',
      data: updatedOrder
    });
  } catch (error) {
    console.error('Mark order as paid error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while marking order as paid.'
    });
  }
};

// ✅ Process refund
const processRefund = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log('💸 Process refund:', { orderId: id, adminId: userId });

    const order = await prisma.order.findUnique({
      where: { id: parseInt(id) }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.'
      });
    }

    if (!order.isPaid) {
      return res.status(400).json({
        success: false,
        message: 'Cannot refund - order was not paid.'
      });
    }

    if (!['CANCELLED', 'RETURNED'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot refund. Order must be CANCELLED or RETURNED. Current status: ${order.status}`
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: parseInt(id) },
        data: { isPaid: false }
      });

      // ✅ FIX: Only delete THIS admin's profit ledger entry, not all entries
      // In multi-vendor, multiple admins may have profit from same order
      const deletedEntries = await tx.profitLedger.deleteMany({
        where: { 
          orderId: order.id,
          adminId: userId  // ✅ Only delete current admin's entry
        }
      });

      await tx.orderAudit.create({
        data: {
          orderId: order.id,
          adminId: userId,
          fromStatus: order.status,
          toStatus: order.status,
          note: `Refund processed | ${deletedEntries.count} profit entry removed for admin ${userId}`
        }
      });
    });

    console.log('✅ Refund processed successfully:', { 
      orderId: id, 
      adminId: userId 
    });

    return res.status(200).json({
      success: true,
      message: 'Refund processed successfully.',
      data: { orderId: parseInt(id) }
    });
  } catch (error) {
    console.error('Process refund error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while processing refund.'
    });
  }
};

// Update order status (Admin)
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;
    const userId = req.user.id;

    console.log('Update order status:', { orderId: id, newStatus: status });

    const validStatuses = ['PENDING', 'PROCESSING', 'CONFIRMED', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURN_REQUESTED', 'RETURNED'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

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

    const oldStatus = order.status;

    // Handle RETURN_REQUESTED → RETURNED
    if (status === 'RETURNED' && order.status === 'RETURN_REQUESTED') {
      await prisma.$transaction(async (tx) => {
        for (const item of order.items) {
          const currentProduct = await tx.product.findUnique({
            where: { id: item.productId },
            select: { totalSold: true }
          });

          await tx.product.update({
            where: { id: item.productId },
            data: {
              totalStock: { increment: item.quantity },
              totalSold: { decrement: Math.min(item.quantity, currentProduct.totalSold) }
            }
          });

          await tx.inventoryLog.create({
            data: {
              productId: item.productId,
              action: 'ORDER_RESTORATION',
              quantity: item.quantity,
              adminId: userId,
              note: `Return approved - Order #${order.uid || order.id}`
            }
          });
        }

        if (order.isPaid) {
          await tx.profitLedger.deleteMany({
            where: { orderId: order.id }
          });

          await tx.order.update({
            where: { id: parseInt(id) },
            data: { isPaid: false }
          });
        }

        await tx.orderAudit.create({
          data: {
            orderId: order.id,
            adminId: userId,
            fromStatus: oldStatus,
            toStatus: status,
            note: note || 'Return request approved by admin, inventory restored'
          }
        });

        await tx.order.update({
          where: { id: parseInt(id) },
          data: { status: 'RETURNED' }
        });
      });
    }
    // Handle CANCELLED
    else if (status === 'CANCELLED') {
      await prisma.$transaction(async (tx) => {
        if (['CONFIRMED', 'PAID', 'PROCESSING', 'SHIPPED'].includes(order.status)) {
          for (const item of order.items) {
            const currentProduct = await tx.product.findUnique({
              where: { id: item.productId },
              select: { totalSold: true }
            });

            await tx.product.update({
              where: { id: item.productId },
              data: {
                totalStock: { increment: item.quantity },
                totalSold: { decrement: Math.min(item.quantity, currentProduct.totalSold) }
              }
            });

            await tx.inventoryLog.create({
              data: {
                productId: item.productId,
                action: 'ORDER_RESTORATION',
                quantity: item.quantity,
                adminId: userId,
                note: `Order #${order.uid || order.id} cancelled`
              }
            });
          }
        }

        if (order.isPaid) {
          await tx.profitLedger.deleteMany({
            where: { orderId: order.id }
          });

          await tx.order.update({
            where: { id: parseInt(id) },
            data: { isPaid: false }
          });
        }

        await tx.orderAudit.create({
          data: {
            orderId: order.id,
            adminId: userId,
            fromStatus: oldStatus,
            toStatus: status,
            note: note || 'Order cancelled, inventory restored'
          }
        });

        await tx.order.update({
          where: { id: parseInt(id) },
          data: { status: 'CANCELLED' }
        });
      });
    }
    else {
      await prisma.$transaction(async (tx) => {
        await tx.orderAudit.create({
          data: {
            orderId: order.id,
            adminId: userId,
            fromStatus: oldStatus,
            toStatus: status,
            note: note || `Status updated to ${status}`
          }
        });

        await tx.order.update({
          where: { id: parseInt(id) },
          data: { status }
        });
      });
    }

    const updatedOrder = await prisma.order.findUnique({
      where: { id: parseInt(id) },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });

    console.log('Order status updated:', updatedOrder.id);

    return res.status(200).json({
      success: true,
      message: 'Order status updated successfully.',
      data: updatedOrder
    });
  } catch (error) {
    console.error('Update order status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while updating order status.'
    });
  }
};

// Customer request return
const requestReturn = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;

    const order = await prisma.order.findUnique({
      where: { id: parseInt(id) },
      include: { 
        items: { include: { product: { include: { createdBy: true } } } }
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.'
      });
    }

    if (order.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied.'
      });
    }

    if (order.status !== 'DELIVERED') {
      return res.status(400).json({
        success: false,
        message: 'Only delivered orders can be returned.'
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: parseInt(id) },
        data: { 
          status: 'RETURN_REQUESTED',
          note: `${order.note || ''}\n\nReturn requested: ${reason}`.trim()
        }
      });

      await tx.orderAudit.create({
        data: {
          orderId: order.id,
          fromStatus: 'DELIVERED',
          toStatus: 'RETURN_REQUESTED',
          note: `Customer return request: ${reason}`
        }
      });
    });

    const updatedOrder = await prisma.order.findUnique({
      where: { id: parseInt(id) },
      include: { items: { include: { product: true } } }
    });

    return res.status(200).json({
      success: true,
      message: 'Return request submitted. Awaiting admin approval.',
      data: updatedOrder
    });
  } catch (error) {
    console.error('Request return error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
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