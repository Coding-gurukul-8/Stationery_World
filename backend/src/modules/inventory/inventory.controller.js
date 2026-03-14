const prisma = require('../../../prisma/client');

// =============================================================================
// ENHANCED INVENTORY CONTROLLER - OPTIMIZED FOR FRONTEND SORTING & DISPLAY
// All responses include fields needed for client-side sorting:
// - name, price, stock, category, createdAt, notifyMeCount
// =============================================================================

// =====================================================
// Get all inventory (Admin only)
// Returns ALL fields needed for frontend sorting
// =====================================================
const getAllInventory = async (req, res) => {
  try {
    const { isLowStock, category } = req.query;

    console.log('📦 Get all inventory request:', { isLowStock, category });

    const where = { isActive: true };
    
    // Filter by category
    if (category && category !== 'ALL') {
      where.category = category.toUpperCase();
    }

    // Fetch all products with all fields needed for sorting
    const products = await prisma.product.findMany({
      where,
      include: {
        images: {
          where: { isPrimary: true },
          take: 1
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        _count: {
          select: {
            notifications: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc' // Default: newest first
      }
    });

    // Filter by low stock if requested
    let filteredProducts = products;
    if (isLowStock === 'true') {
      filteredProducts = products.filter(
        product => product.totalStock <= product.lowStockThreshold
      );
    }

    // ✅ Format inventory response with ALL fields needed for frontend sorting
    const inventory = filteredProducts.map(product => ({
      productId: product.id,
      product: product,
      
      // Core inventory fields
      quantity: product.totalStock,
      isLowStock: product.totalStock <= product.lowStockThreshold,
      lowStockThreshold: product.lowStockThreshold,
      notifyMeCount: product._count.notifications || 0,
      
      // ✅ Fields for frontend sorting (at top level for easy access)
      name: product.name,
      price: product.baseSellingPrice,
      stock: product.totalStock,
      category: product.category,
      createdAt: product.createdAt,
      
      // Timestamps
      lastUpdated: product.updatedAt,
      
      // Additional useful info
      costPrice: product.costPrice,
      sku: product.id.toString(),
      imageUrl: product.images[0]?.url || null,
      createdByName: product.createdBy?.name || null
    }));

    console.log(`✅ Found ${inventory.length} inventory records`);

    return res.status(200).json({
      success: true,
      message: 'Inventory retrieved successfully.',
      data: inventory,
      count: inventory.length,
      // ✅ Metadata for frontend
      metadata: {
        totalProducts: inventory.length,
        lowStockCount: inventory.filter(item => item.isLowStock).length,
        outOfStockCount: inventory.filter(item => item.stock === 0).length,
        categories: [...new Set(inventory.map(item => item.category))]
      }
    });
  } catch (error) {
    console.error('❌ Get all inventory error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching inventory.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =====================================================
// Get low stock products (Admin only)
// =====================================================
const getLowStockProducts = async (req, res) => {
  try {
    console.log('📦 Get low stock products request');

    const products = await prisma.product.findMany({
      where: {
        isActive: true
      },
      include: {
        images: {
          where: { isPrimary: true },
          take: 1
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        _count: {
          select: {
            notifications: true
          }
        }
      },
      orderBy: {
        totalStock: 'asc' // Lowest stock first
      }
    });

    // Filter to only low stock products
    const lowStockProducts = products.filter(
      product => product.totalStock <= product.lowStockThreshold
    );

    // ✅ Format response with all sorting fields
    const lowStockInventory = lowStockProducts.map(product => ({
      productId: product.id,
      product: product,
      
      // Core inventory fields
      quantity: product.totalStock,
      isLowStock: true,
      lowStockThreshold: product.lowStockThreshold,
      notifyMeCount: product._count.notifications || 0,
      
      // ✅ Fields for frontend sorting
      name: product.name,
      price: product.baseSellingPrice,
      stock: product.totalStock,
      category: product.category,
      createdAt: product.createdAt,
      
      // Timestamps
      lastUpdated: product.updatedAt,
      
      // Additional info
      costPrice: product.costPrice,
      sku: product.id.toString(),
      imageUrl: product.images[0]?.url || null,
      createdByName: product.createdBy?.name || null,
      
      // ✅ Low stock specific
      stockDifference: product.lowStockThreshold - product.totalStock,
      urgencyLevel: product.totalStock === 0 ? 'critical' : 
                    product.totalStock <= product.lowStockThreshold / 2 ? 'high' : 'medium'
    }));

    console.log(`✅ Found ${lowStockInventory.length} low stock products`);

    return res.status(200).json({
      success: true,
      message: 'Low stock products retrieved successfully.',
      data: lowStockInventory,
      count: lowStockInventory.length,
      // ✅ Summary for dashboard
      summary: {
        total: lowStockInventory.length,
        critical: lowStockInventory.filter(p => p.urgencyLevel === 'critical').length,
        high: lowStockInventory.filter(p => p.urgencyLevel === 'high').length,
        medium: lowStockInventory.filter(p => p.urgencyLevel === 'medium').length,
        totalWaitingCustomers: lowStockInventory.reduce((sum, p) => sum + p.notifyMeCount, 0)
      }
    });
  } catch (error) {
    console.error('❌ Get low stock products error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching low stock products.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =====================================================
// Update inventory for a product (Admin only) - RESTOCK
// =====================================================
const updateInventory = async (req, res) => {
  try {
    const { productId } = req.params;
    const { 
      quantityAdded,
      quantity,
      costPrice, 
      baseSellingPrice, 
      bargainable, 
      images, 
      note,
      investmentSource = 'NEW',
      action = 'add'
    } = req.body;
    const adminId = req.user?.id;


    const qtyToAdd = quantityAdded !== undefined ? quantityAdded : quantity;

    if (qtyToAdd === undefined || qtyToAdd === null) {
      return res.status(400).json({
        success: false,
        message: 'Quantity is required.'
      });
    }

    const quantityNum = parseInt(qtyToAdd);
    if (isNaN(quantityNum)) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be a valid number.'
      });
    }

    if (action === 'add' && quantityNum <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity to add must be positive.'
      });
    }

    const product = await prisma.product.findUnique({
      where: { id: parseInt(productId) },
      include: {
        notifications: { where: { notified: false } },
        _count: { select: { notifications: true } }
      }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      });
    }

    let newQuantity;
    let inventoryAction;
    let quantityChange;

    if (action === 'set') {
      newQuantity = quantityNum;
      quantityChange = quantityNum - product.totalStock;
      inventoryAction = 'ADJUST';
    } else if (action === 'add') {
      newQuantity = product.totalStock + quantityNum;
      quantityChange = quantityNum;
      inventoryAction = 'RESTOCK';
    } else if (action === 'remove') {
      newQuantity = product.totalStock - quantityNum;
      quantityChange = -quantityNum;
      if (newQuantity < 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot remove ${quantityNum}. Current stock: ${product.totalStock}`
        });
      }
      inventoryAction = 'SALE';
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be: "set", "add", or "remove"'
      });
    }

    const wasLowStock = product.totalStock <= product.lowStockThreshold;
    const wasOutOfStock = product.totalStock === 0;
    const isLowStock = newQuantity <= product.lowStockThreshold;
    const isBackInStock = wasOutOfStock && newQuantity > 0;

    const updateData = { totalStock: newQuantity };

    if (costPrice !== undefined && costPrice !== null && costPrice !== '') {
      const cpNum = parseFloat(costPrice);
      if (isNaN(cpNum) || cpNum < 0) {
        return res.status(400).json({
          success: false,
          message: 'Cost price must be valid.'
        });
      }
      updateData.costPrice = cpNum;
    }

    if (baseSellingPrice !== undefined && baseSellingPrice !== null && baseSellingPrice !== '') {
      const spNum = parseFloat(baseSellingPrice);
      if (isNaN(spNum) || spNum < 0) {
        return res.status(400).json({
          success: false,
          message: 'Selling price must be valid.'
        });
      }
      updateData.baseSellingPrice = spNum;
    }

    if (bargainable !== undefined && bargainable !== null) {
      updateData.bargainable = Boolean(bargainable);
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedProduct = await tx.product.update({
        where: { id: parseInt(productId) },
        data: updateData,
        include: {
          images: { where: { isPrimary: true }, take: 1 },
          createdBy: {
            select: { id: true, name: true, email: true, role: true }
          },
          _count: { select: { notifications: true } }
        }
      });

      await tx.inventoryLog.create({
        data: {
          productId: parseInt(productId),
          action: inventoryAction,
          quantity: quantityChange,
          adminId: adminId || null,
          note: note || `${inventoryAction}: ${Math.abs(quantityChange)} units`
        }
      });

      // If restocking and using profit, record the reinvestment in the profit ledger.
      if (action === 'add' && investmentSource === 'PROFIT') {
        const unitCost = costPrice !== undefined && costPrice !== null && costPrice !== ''
          ? parseFloat(costPrice)
          : product.costPrice;

        const totalCost = unitCost * quantityNum;
        if (!isNaN(totalCost) && totalCost > 0) {
          await tx.profitLedger.create({
            data: {
              adminId: adminId || null,
              amount: -Math.abs(totalCost),
              note: `Reinvested from profit to restock ${quantityNum} unit(s) of ${product.name}`
            }
          });
        }
      }

      if (images && Array.isArray(images) && images.length > 0) {
        for (const img of images) {
          if (img.url) {
            await tx.productImage.create({
              data: {
                productId: parseInt(productId),
                url: img.url,
                altText: img.altText || product.name,
                isPrimary: img.isPrimary || false
              }
            });
          }
        }
      }

      if (isLowStock && !wasLowStock) {
        await tx.notification.create({
          data: {
            userId: null,
            type: 'LOW_STOCK',
            message: `Low stock: ${product.name} (${newQuantity} left)`,
            isRead: false
          }
        });
      }

      if (isBackInStock && product.notifications.length > 0) {
        console.log(`🔔 Back in stock! Notifying ${product.notifications.length} users`);
        
        await tx.productNotification.updateMany({
          where: { productId: parseInt(productId), notified: false },
          data: { notified: true }
        });

        await tx.notification.create({
          data: {
            userId: null,
            type: 'SYSTEM_ALERT',
            message: `${product.name} back in stock! ${product.notifications.length} notified.`,
            isRead: false
          }
        });
      }

      return updatedProduct;
    });

    console.log('✅ Inventory updated:', result.id, 'Stock:', result.totalStock);

    // ✅ Return with all sorting fields
    return res.status(200).json({
      success: true,
      message: 'Inventory updated successfully.',
      data: {
        productId: result.id,
        product: result,
        
        quantity: result.totalStock,
        newStock: result.totalStock,
        isLowStock: result.totalStock <= result.lowStockThreshold,
        lowStockThreshold: result.lowStockThreshold,
        notifyMeCount: result._count.notifications || 0,
        
        // ✅ Sorting fields
        name: result.name,
        price: result.baseSellingPrice,
        stock: result.totalStock,
        category: result.category,
        createdAt: result.createdAt,
        
        lastUpdated: result.updatedAt,
        notifiedUsers: isBackInStock ? product.notifications.length : 0,
        wasOutOfStock,
        isBackInStock,
        stockChange: quantityChange
      }
    });
  } catch (error) {
    console.error('❌ Update inventory error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =====================================================
// Bulk update inventory (Admin only)
// =====================================================
const bulkUpdateInventory = async (req, res) => {
  try {
    const { updates } = req.body;
    const adminId = req.user?.id;

    console.log('📦 Bulk update:', updates?.length, 'products');

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Updates array required.'
      });
    }

    const results = [];
    const errors = [];

    for (const update of updates) {
      try {
        const { productId, quantity } = update;

        if (!productId || quantity === undefined) {
          errors.push({ 
            productId: productId || 'unknown', 
            error: 'Product ID and quantity required' 
          });
          continue;
        }

        const product = await prisma.product.findUnique({
          where: { id: parseInt(productId) }
        });

        if (!product) {
          errors.push({ productId, error: 'Not found' });
          continue;
        }

        const quantityNum = parseInt(quantity);
        if (isNaN(quantityNum) || quantityNum < 0) {
          errors.push({ productId, error: 'Invalid quantity' });
          continue;
        }

        const isLowStock = quantityNum <= product.lowStockThreshold;
        const wasLowStock = product.totalStock <= product.lowStockThreshold;
        const quantityChange = quantityNum - product.totalStock;

        const updatedProduct = await prisma.$transaction(async (tx) => {
          const result = await tx.product.update({
            where: { id: parseInt(productId) },
            data: { totalStock: quantityNum }
          });

          await tx.inventoryLog.create({
            data: {
              productId: parseInt(productId),
              action: 'ADJUST',
              quantity: quantityChange,
              adminId: adminId || null,
              note: `Bulk: set to ${quantityNum}`
            }
          });

          if (isLowStock && !wasLowStock) {
            await tx.notification.create({
              data: {
                userId: null,
                type: 'LOW_STOCK',
                message: `Low stock: ${product.name} (${quantityNum} left)`,
                isRead: false
              }
            });
          }

          return result;
        });

        results.push({
          productId: updatedProduct.id,
          name: updatedProduct.name,
          quantity: updatedProduct.totalStock,
          isLowStock: updatedProduct.totalStock <= updatedProduct.lowStockThreshold,
          change: quantityChange
        });
      } catch (err) {
        errors.push({ 
          productId: update.productId, 
          error: err.message 
        });
      }
    }

    console.log(`✅ Bulk: ${results.length} success, ${errors.length} errors`);

    return res.status(200).json({
      success: true,
      message: 'Bulk update completed.',
      data: {
        successful: results,
        errors,
        successCount: results.length,
        errorCount: errors.length
      }
    });
  } catch (error) {
    console.error('❌ Bulk update error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =====================================================
// Get inventory for specific product
// =====================================================
const getProductInventory = async (req, res) => {
  try {
    const { productId } = req.params;

    console.log('📦 Get product inventory:', productId);

    const product = await prisma.product.findUnique({
      where: { id: parseInt(productId) },
      include: {
        images: { where: { isPrimary: true }, take: 1 },
        createdBy: {
          select: { id: true, name: true, email: true, role: true }
        },
        inventoryLogs: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: {
            admin: {
              select: { id: true, name: true, email: true }
            }
          }
        },
        _count: { select: { notifications: true } }
      }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      });
    }

    const inventory = {
      productId: product.id,
      product: product,
      
      quantity: product.totalStock,
      isLowStock: product.totalStock <= product.lowStockThreshold,
      lowStockThreshold: product.lowStockThreshold,
      notifyMeCount: product._count.notifications || 0,
      
      // ✅ Sorting fields
      name: product.name,
      price: product.baseSellingPrice,
      stock: product.totalStock,
      category: product.category,
      createdAt: product.createdAt,
      
      lastUpdated: product.updatedAt,
      recentLogs: product.inventoryLogs
    };

    return res.status(200).json({
      success: true,
      message: 'Product inventory retrieved.',
      data: inventory
    });
  } catch (error) {
    console.error('❌ Get product inventory error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getAllInventory,
  getLowStockProducts,
  updateInventory,
  bulkUpdateInventory,
  getProductInventory
};