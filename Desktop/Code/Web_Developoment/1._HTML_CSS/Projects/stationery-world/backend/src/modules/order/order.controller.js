const prisma = require('../../../prisma/client');

// Create order
// Expected body: { type?: 'CUSTOMER'|'SELF'|'ADMIN', recipientName, recipientPhone, addressLine1..., items: [{ productId, quantity, sp? }] }
const createOrder = async (req, res) => {
  try {
    const { type = 'CUSTOMER', recipientName, recipientPhone, addressLine1, addressLine2, city, state, postalCode, country, note, items } = req.body;

    if (!recipientName) return res.status(400).json({ success: false, message: 'recipientName is required' });
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ success: false, message: 'items array is required' });

    // Basic validation on items
    for (const it of items) {
      if (!it.productId || !it.quantity || it.quantity <= 0) return res.status(400).json({ success: false, message: 'Each item must have productId and positive quantity' });
    }

    // Transaction to create order and items
    const created = await prisma.$transaction(async (tx) => {
      // Create order record
      const order = await tx.order.create({
        data: {
          type,
          status: 'PENDING',
          recipientName,
          recipientPhone: recipientPhone || null,
          addressLine1: addressLine1 || null,
          addressLine2: addressLine2 || null,
          city: city || null,
          state: state || null,
          postalCode: postalCode || null,
          country: country || null,
          note: note || null,
          placedById: req.user?.id || null,
          adminId: type === 'SELF' ? req.user?.id || null : null
        }
      });

      let totalSp = 0;
      let totalCp = 0;

      for (const it of items) {
        const product = await tx.product.findUnique({ where: { id: it.productId }, include: { images: true } });
        if (!product) throw new Error('Product not found: ' + it.productId);

        const cp = product.costPrice;
        const sp = (it.sp !== undefined && it.sp !== null) ? parseFloat(it.sp) : product.baseSellingPrice;
        const quantity = Number(it.quantity);
        const subtotalSp = sp * quantity;
        const subtotalCp = cp * quantity;

        totalSp += subtotalSp;
        totalCp += subtotalCp;

        await tx.orderItem.create({
          data: {
            orderId: order.id,
            productId: product.id,
            productName: product.name,
            productPhoto: (product.images && product.images[0] && product.images[0].url) ? product.images[0].url : null,
            quantity,
            cp,
            sp,
            subtotalSp,
            subtotalCp
          }
        });

        // Optionally: decrement product totalStock if this is a customer sale
        if (type !== 'SELF') {
          await tx.product.update({ where: { id: product.id }, data: { totalStock: { decrement: quantity } } });
        }
      }

      // Update totals
      await tx.order.update({ where: { id: order.id }, data: { totalSp, totalCp } });

      return order;
    });

    const order = await prisma.order.findUnique({ where: { id: created.id }, include: { items: true, placedBy: { select: { id: true, name: true, email: true } } } });

    return res.status(201).json({ success: true, message: 'Order created successfully', data: order });
  } catch (error) {
    console.error('Create order error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error while creating order.' });
  }
};

// Get order by id
const getOrderById = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid order id' });

    const order = await prisma.order.findUnique({ where: { id }, include: { items: true, audits: { orderBy: { createdAt: 'desc' }, include: { admin: { select: { id: true, name: true } } } }, placedBy: { select: { id: true, name: true, email: true, phone: true } } } });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    return res.status(200).json({ success: true, message: 'Order retrieved', data: order });
  } catch (error) {
    console.error('Get order error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Get self orders (orders placed by this admin and type=SELF)
const getSelfOrders = async (req, res) => {
  try {
    const orders = await prisma.order.findMany({ where: { type: 'SELF', placedById: req.user.id }, include: { items: true, audits: { orderBy: { createdAt: 'desc' } } }, orderBy: { createdAt: 'desc' } });
    return res.status(200).json({ success: true, message: 'Self orders retrieved', data: orders });
  } catch (error) {
    console.error('Get self orders error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Admin: get all orders (others)
const getAllOrders = async (req, res) => {
  try {
    const orders = await prisma.order.findMany({ include: { items: true, audits: { orderBy: { createdAt: 'desc' }, include: { admin: { select: { id: true, name: true } } } }, placedBy: { select: { id:true, name:true, email:true, phone:true, addressLine1:true, city:true } } }, orderBy: { createdAt: 'desc' } });
    return res.status(200).json({ success: true, message: 'Orders retrieved', data: orders });
  } catch (error) {
    console.error('Get all orders error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Admin: update order status
const updateOrderStatus = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid order id' });

    const { status } = req.body;
    const allowed = ['PENDING','PROCESSING','SHIPPED','DELIVERED','CANCELLED'];
    if (!allowed.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status' });

    const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.order.update({ where: { id }, data: { status } });

      // create audit record
      await tx.orderAudit.create({ data: { orderId: id, adminId: req.user.id, fromStatus: order.status, toStatus: status, note: req.body.note || null } });

      // If order moved to DELIVERED, create profit ledger entry
      if (status === 'DELIVERED') {
        // for self orders — attribute to the order.adminId (admin who placed it), for others — attribute to the admin performing the delivery
        const ledgerAdminId = (order.type === 'SELF' && order.adminId) ? order.adminId : req.user.id;
        const amount = (order.type === 'SELF') ? -1 * (order.totalCp || 0) : ((order.totalSp || 0) - (order.totalCp || 0));

        // create ledger entry only when amount != 0
        if (amount !== 0 && ledgerAdminId) {
          await tx.profitLedger.create({ data: { adminId: ledgerAdminId, orderId: id, amount, note: `Auto ledger for order ${id} status change to DELIVERED` } });
        }
      }

      return u;
    });

    return res.status(200).json({ success: true, message: 'Order status updated', data: updated });
  } catch (error) {
    console.error('Update order status error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = {
  createOrder,
  getOrderById,
  getSelfOrders,
  getAllOrders,
  updateOrderStatus
};
