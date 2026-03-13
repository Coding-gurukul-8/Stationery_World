const prisma = require('../../../prisma/client');

// Initiate payment for an order
const initiatePayment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { orderId, method = 'CASH', transactionId } = req.body;

    console.log('Initiate payment request:', { userId, orderId, method });

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required.'
      });
    }

    const validMethods = ['CREDIT_CARD', 'DEBIT_CARD', 'UPI', 'CASH', 'NET_BANKING', 'OTHER'];
    if (!validMethods.includes(method)) {
      return res.status(400).json({
        success: false,
        message: `Invalid payment method. Must be one of: ${validMethods.join(', ')}`
      });
    }

    // Get order
    const order = await prisma.order.findUnique({
      where: { id: parseInt(orderId) }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.'
      });
    }

    // Verify ownership
    if (order.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied.'
      });
    }

    // Check if order is in correct status
    if (order.status !== 'CONFIRMED') {
      return res.status(400).json({
        success: false,
        message: `Order must be CONFIRMED before payment. Current status: ${order.status}`
      });
    }

    // Check if payment already exists
    const existingPayment = await prisma.payment.findUnique({
      where: { orderId: parseInt(orderId) }
    });

    if (existingPayment) {
      return res.status(409).json({
        success: false,
        message: 'Payment already exists for this order.',
        data: existingPayment
      });
    }

    // Create payment
    const payment = await prisma.payment.create({
      data: {
        orderId: parseInt(orderId),
        userId,
        amount: order.totalAmount,
        method,
        status: 'PENDING',
        transactionId: transactionId || null
      }
    });

    console.log('Payment initiated:', payment.id);

    return res.status(201).json({
      success: true,
      message: 'Payment initiated successfully.',
      data: payment
    });
  } catch (error) {
    console.error('Initiate payment error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while initiating payment.'
    });
  }
};

// Verify/complete payment
const verifyPayment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { paymentId, status = 'SUCCESS', transactionId } = req.body;

    console.log('Verify payment request:', { userId, paymentId, status });

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        message: 'Payment ID is required.'
      });
    }

    const validStatuses = ['SUCCESS', 'FAILED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Get payment
    const payment = await prisma.payment.findUnique({
      where: { id: parseInt(paymentId) },
      include: {
        order: {
          include: {
            items: {
              include: {
                product: true
              }
            }
          }
        }
      }
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found.'
      });
    }

    // Verify ownership
    if (payment.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied.'
      });
    }

    if (payment.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `Payment already processed. Current status: ${payment.status}`
      });
    }

    // Update payment and order in transaction
    const updatedPayment = await prisma.$transaction(async (tx) => {
      // Update payment status
      const updated = await tx.payment.update({
        where: { id: parseInt(paymentId) },
        data: {
          status,
          transactionId: transactionId || payment.transactionId
        }
      });

      // Update order status based on payment status
      if (status === 'SUCCESS') {
        await tx.order.update({
          where: { id: payment.orderId },
          data: { status: 'PAID' }
        });

        // Create notification
        await tx.notification.create({
          data: {
            userId: payment.userId,
            type: 'PAYMENT_STATUS',
            message: `Payment successful for order #${payment.orderId}`,
            isRead: false
          }
        });
      } else if (status === 'FAILED') {
        // Payment failed - cancel order and restore inventory
        await tx.order.update({
          where: { id: payment.orderId },
          data: { status: 'CANCELED' }
        });

        // Restore inventory
        for (const item of payment.order.items) {
          await tx.inventory.update({
            where: { productId: item.productId },
            data: {
              quantity: {
                increment: item.quantity
              }
            }
          });
        }

        // Create notification
        await tx.notification.create({
          data: {
            userId: payment.userId,
            type: 'PAYMENT_STATUS',
            message: `Payment failed for order #${payment.orderId}. Order canceled and inventory restored.`,
            isRead: false
          }
        });
      }

      return updated;
    });

    console.log('Payment verified:', updatedPayment.id);

    return res.status(200).json({
      success: true,
      message: status === 'SUCCESS' ? 'Payment successful.' : 'Payment failed. Order canceled.',
      data: updatedPayment
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while verifying payment.'
    });
  }
};

// Get payment status for an order
const getPaymentStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.role === 'ADMIN';
    const { orderId } = req.params;

    console.log('Get payment status:', orderId);

    const payment = await prisma.payment.findUnique({
      where: { orderId: parseInt(orderId) },
      include: {
        order: true
      }
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found for this order.'
      });
    }

    // Check ownership (unless admin)
    if (!isAdmin && payment.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Payment status retrieved successfully.',
      data: payment
    });
  } catch (error) {
    console.error('Get payment status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching payment status.'
    });
  }
};

// Process refund (Admin only)
const processRefund = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('Process refund request:', id);

    const payment = await prisma.payment.findUnique({
      where: { id: parseInt(id) },
      include: {
        order: {
          include: {
            items: {
              include: {
                product: true
              }
            }
          }
        }
      }
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found.'
      });
    }

    if (payment.status !== 'SUCCESS') {
      return res.status(400).json({
        success: false,
        message: `Cannot refund payment with status: ${payment.status}`
      });
    }

    // Update payment and order in transaction
    const updatedPayment = await prisma.$transaction(async (tx) => {
      // Update payment status to REFUNDED
      const updated = await tx.payment.update({
        where: { id: parseInt(id) },
        data: { status: 'REFUNDED' }
      });

      // Update order status to RETURNED
      await tx.order.update({
        where: { id: payment.orderId },
        data: { status: 'RETURNED' }
      });

      // Restore inventory
      for (const item of payment.order.items) {
        await tx.inventory.update({
          where: { productId: item.productId },
          data: {
            quantity: {
              increment: item.quantity
            }
          }
        });
      }

      // Create notification
      await tx.notification.create({
        data: {
          userId: payment.userId,
          type: 'PAYMENT_STATUS',
          message: `Refund processed for order #${payment.orderId}`,
          isRead: false
        }
      });

      return updated;
    });

    console.log('Refund processed:', updatedPayment.id);

    return res.status(200).json({
      success: true,
      message: 'Refund processed successfully.',
      data: updatedPayment
    });
  } catch (error) {
    console.error('Process refund error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while processing refund.'
    });
  }
};

module.exports = {
  initiatePayment,
  verifyPayment,
  getPaymentStatus,
  processRefund
};
