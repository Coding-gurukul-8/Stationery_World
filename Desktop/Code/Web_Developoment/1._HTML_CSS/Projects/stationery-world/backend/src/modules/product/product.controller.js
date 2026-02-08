const prisma = require('../../../prisma/client');

// Valid categories enum
const VALID_CATEGORIES = ['STATIONERY', 'BOOKS', 'TOYS'];

// Get all products with filters (Public)
const getAllProducts = async (req, res) => {
  try {
    console.log('Get all products request received');

    const { 
      isActive, 
      category, 
      minPrice, 
      maxPrice, 
      search,
      bargainable,
      lowStock 
    } = req.query;

    // Build filter conditions
    const where = {};

    // Filter by active status
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    // Filter by category
    if (category && VALID_CATEGORIES.includes(category.toUpperCase())) {
      where.category = category.toUpperCase();
    }

    // Filter by bargainable status
    if (bargainable !== undefined) {
      where.bargainable = bargainable === 'true';
    }

    // Filter by price range (baseSellingPrice)
    if (minPrice || maxPrice) {
      where.baseSellingPrice = {};
      if (minPrice) where.baseSellingPrice.gte = parseFloat(minPrice);
      if (maxPrice) where.baseSellingPrice.lte = parseFloat(maxPrice);
    }

    // Search in uid, name, description, subCategory, and keywords
    if (search) {
      const terms = search.split(/\s+/).filter(Boolean);

      // Create OR conditions: uid contains, name contains, description contains, subCategory contains
      const orClauses = [
        { uid: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { subCategory: { contains: search, mode: 'insensitive' } }
      ];

      // If there are distinct terms, search keywords array for any match
      if (terms.length > 0) {
        orClauses.push({ keywords: { hasSome: terms } });
      }

      where.AND = [
        { OR: orClauses }
      ];
    }

    const products = await prisma.product.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      }
    });

    // If lowStock filter is true, filter products below threshold (use in-memory filter)
    let filteredProducts = products;
    if (lowStock === 'true') {
      filteredProducts = products.filter(p => p.totalStock <= p.lowStockThreshold);
      console.log('Low stock filter applied:', filteredProducts.length);
    }

    console.log(`Found ${filteredProducts.length} products`);

    return res.status(200).json({
      success: true,
      message: 'Products retrieved successfully.',
      data: filteredProducts,
      count: filteredProducts.length
    });
  } catch (error) {
    console.error('Get all products error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching products.'
    });
  }
};

// Get product by ID (Public)
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Get product by ID request:', id);

    const productId = parseInt(id);
    if (isNaN(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID.'
      });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      });
    }

    console.log('Product found:', product.id);

    return res.status(200).json({
      success: true,
      message: 'Product retrieved successfully.',
      data: product
    });
  } catch (error) {
    console.error('Get product by ID error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching product.'
    });
  }
};

// Get products by category (Public)
const getProductsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    console.log('Get products by category:', category);

    const upperCategory = category.toUpperCase();
    
    if (!VALID_CATEGORIES.includes(upperCategory)) {
      return res.status(400).json({
        success: false,
        message: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`
      });
    }

    const products = await prisma.product.findMany({
      where: {
        category: upperCategory,
        isActive: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    console.log(`Found ${products.length} products in category ${upperCategory}`);

    return res.status(200).json({
      success: true,
      message: `Products in ${upperCategory} category retrieved successfully.`,
      data: products,
      count: products.length
    });
  } catch (error) {
    console.error('Get products by category error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching products.'
    });
  }
};

// Create product (Admin only)
const createProduct = async (req, res) => {
  try {
    console.log('Create product request received');
    console.log('Request body:', req.body);

    const { 
      name, 
      description, 
      category, 
      subCategory,
      costPrice,
      baseSellingPrice,
      bargainable,
      lowStockThreshold
    } = req.body;

    // Validate required fields
    if (!name || !category || !subCategory || costPrice === undefined || baseSellingPrice === undefined || lowStockThreshold === undefined) {
      return res.status(400).json({
        success: false,
        message: 'name, category, subCategory, costPrice, baseSellingPrice, and lowStockThreshold are required.'
      });
    }

    // Validate category
    const upperCategory = category.toUpperCase();
    if (!VALID_CATEGORIES.includes(upperCategory)) {
      return res.status(400).json({
        success: false,
        message: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`
      });
    }

    // Validate costPrice
    const cost = parseFloat(costPrice);
    if (isNaN(cost) || cost < 0) {
      return res.status(400).json({
        success: false,
        message: 'costPrice must be a valid non-negative number.'
      });
    }

    // Validate baseSellingPrice
    const sellingPrice = parseFloat(baseSellingPrice);
    if (isNaN(sellingPrice) || sellingPrice < 0) {
      return res.status(400).json({
        success: false,
        message: 'baseSellingPrice must be a valid non-negative number.'
      });
    }

    // Business logic: selling price should be >= cost price
    if (sellingPrice < cost) {
      return res.status(400).json({
        success: false,
        message: 'baseSellingPrice cannot be less than costPrice.'
      });
    }

    // Validate lowStockThreshold
    const threshold = parseInt(lowStockThreshold);
    if (isNaN(threshold) || threshold < 0) {
      return res.status(400).json({
        success: false,
        message: 'lowStockThreshold must be a valid non-negative integer.'
      });
    }

    // Create product
    // Prepare image and keyword data if provided
    const keywordArray = Array.isArray(req.body.keywords) ? req.body.keywords.map(k => String(k).trim()).filter(Boolean) : [];
    const images = Array.isArray(req.body.images) ? req.body.images.filter(Boolean) : [];
    const quantityAdded = parseInt(req.body.quantityAdded || 0) || 0;

    // Create product
    const newProduct = await prisma.product.create({
      data: {
        name,
        description: description || null,
        keywords: keywordArray,
        category: upperCategory,
        subCategory,
        costPrice: cost,
        baseSellingPrice: sellingPrice,
        bargainable: bargainable !== undefined ? bargainable : true,
        lowStockThreshold: threshold,
        totalStock: quantityAdded
      }
    });

    // Create product images if provided
    if (images.length > 0) {
      const imgCreates = images.map((imgUrl, idx) => {
        return prisma.productImage.create({
          data: { productId: newProduct.id, url: imgUrl, isPrimary: idx === 0 }
        });
      });
      await Promise.all(imgCreates);
    }

    // If initial quantity was added, create inventory log
    if (quantityAdded > 0) {
      await prisma.inventoryLog.create({
        data: {
          productId: newProduct.id,
          action: 'ADD',
          quantity: quantityAdded,
          note: 'Initial stock on product creation'
        }
      });
    }

    console.log('Product created successfully:', newProduct.id);

    // Calculate profit margin
    const profitMargin = ((sellingPrice - cost) / sellingPrice * 100).toFixed(2);

    // Return product with latest data
    const created = await prisma.product.findUnique({ where: { id: newProduct.id }, include: { images: true } });

    return res.status(201).json({
      success: true,
      message: 'Product created successfully.',
      data: {
        ...created,
        profitMargin: `${profitMargin}%`
      }
    });
  } catch (error) {
    console.error('Create product error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while creating product.'
    });
  }
};

// Update product (Admin only)
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Update product request:', id);
    console.log('Request body:', req.body);

    const productId = parseInt(id);
    if (isNaN(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID.'
      });
    }

    // Check if product exists
    const existingProduct = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      });
    }

    const { 
      name, 
      description, 
      category, 
      subCategory,
      costPrice,
      baseSellingPrice,
      bargainable,
      lowStockThreshold,
      isActive
    } = req.body;

    // Build update data
    const updateData = {};

    if (name !== undefined) {
      updateData.name = name;
    }

    if (description !== undefined) {
      updateData.description = description;
    }

    if (category !== undefined) {
      const upperCategory = category.toUpperCase();
      if (!VALID_CATEGORIES.includes(upperCategory)) {
        return res.status(400).json({
          success: false,
          message: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`
        });
      }
      updateData.category = upperCategory;
    }

    if (subCategory !== undefined) {
      updateData.subCategory = subCategory;
    }

    if (costPrice !== undefined) {
      const cost = parseFloat(costPrice);
      if (isNaN(cost) || cost < 0) {
        return res.status(400).json({
          success: false,
          message: 'costPrice must be a valid non-negative number.'
        });
      }
      updateData.costPrice = cost;
    }

    if (baseSellingPrice !== undefined) {
      const sellingPrice = parseFloat(baseSellingPrice);
      if (isNaN(sellingPrice) || sellingPrice < 0) {
        return res.status(400).json({
          success: false,
          message: 'baseSellingPrice must be a valid non-negative number.'
        });
      }
      updateData.baseSellingPrice = sellingPrice;
    }

    // Validate pricing logic if both are being updated
    if (updateData.costPrice !== undefined && updateData.baseSellingPrice !== undefined) {
      if (updateData.baseSellingPrice < updateData.costPrice) {
        return res.status(400).json({
          success: false,
          message: 'baseSellingPrice cannot be less than costPrice.'
        });
      }
    }

    if (bargainable !== undefined) {
      updateData.bargainable = bargainable;
    }

    if (lowStockThreshold !== undefined) {
      const threshold = parseInt(lowStockThreshold);
      if (isNaN(threshold) || threshold < 0) {
        return res.status(400).json({
          success: false,
          message: 'lowStockThreshold must be a valid non-negative integer.'
        });
      }
      updateData.lowStockThreshold = threshold;
    }

    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update.'
      });
    }

    // Update product
    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: updateData
    });

    console.log('Product updated successfully:', productId);

    // Calculate profit margin
    const profitMargin = ((updatedProduct.baseSellingPrice - updatedProduct.costPrice) / updatedProduct.baseSellingPrice * 100).toFixed(2);

    return res.status(200).json({
      success: true,
      message: 'Product updated successfully.',
      data: {
        ...updatedProduct,
        profitMargin: `${profitMargin}%`
      }
    });
  } catch (error) {
    console.error('Update product error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while updating product.'
    });
  }
};

// Delete product (Admin only)
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Delete product request:', id);

    const productId = parseInt(id);
    if (isNaN(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID.'
      });
    }

    // Check if product exists
    const existingProduct = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      });
    }

    // Hard delete
    await prisma.product.delete({
      where: { id: productId }
    });

    console.log('Product deleted successfully:', productId);

    return res.status(200).json({
      success: true,
      message: 'Product deleted successfully.',
      data: { id: productId }
    });
  } catch (error) {
    console.error('Delete product error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while deleting product.'
    });
  }
};

// Toggle product active status (Admin only) - Soft deletion
const toggleProductStatus = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Toggle product status request:', id);

    const productId = parseInt(id);
    if (isNaN(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID.'
      });
    }

    const existingProduct = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      });
    }

    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: {
        isActive: !existingProduct.isActive
      }
    });

    console.log('Product status toggled:', productId, 'New status:', updatedProduct.isActive);

    return res.status(200).json({
      success: true,
      message: `Product ${updatedProduct.isActive ? 'activated' : 'deactivated'} successfully.`,
      data: updatedProduct
    });
  } catch (error) {
    console.error('Toggle product status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while toggling product status.'
    });
  }
};

// Restock existing product (Admin only)
const restockProduct = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Restock product request:', id);

    const productId = parseInt(id);
    if (isNaN(productId)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID.' });
    }

    const { quantityAdded, costPrice, baseSellingPrice, bargainable, images, note } = req.body;
    const qty = parseInt(quantityAdded || 0);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ success: false, message: 'quantityAdded must be a positive integer.' });
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    // Build update data
    const updateData = {};
    if (costPrice !== undefined) updateData.costPrice = parseFloat(costPrice);
    if (baseSellingPrice !== undefined) updateData.baseSellingPrice = parseFloat(baseSellingPrice);
    if (bargainable !== undefined) updateData.bargainable = bargainable;

    // Transaction: update product stock/prices, create log, add images
    const result = await prisma.$transaction(async (prismaTx) => {
      const updated = await prismaTx.product.update({
        where: { id: productId },
        data: {
          ...updateData,
          totalStock: { increment: qty },
          updatedAt: new Date()
        }
      });

      // Create inventory log
      await prismaTx.inventoryLog.create({
        data: {
          productId,
          action: 'RESTOCK',
          quantity: qty,
          note: note || null,
          adminId: req.user?.id || null
        }
      });

      // Add images if provided (array of URLs)
      if (Array.isArray(images) && images.length > 0) {
        const imgCreates = images.map((imgUrl) => prismaTx.productImage.create({ data: { productId, url: imgUrl } }));
        await Promise.all(imgCreates);
      }

      return updated;
    });

    console.log('Product restocked:', productId, 'Qty:', qty);

    const refreshed = await prisma.product.findUnique({ where: { id: productId }, include: { images: true } });

    return res.status(200).json({ success: true, message: 'Product restocked successfully.', data: refreshed });
  } catch (error) {
    console.error('Restock product error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while restocking product.' });
  }
};

// Get inventory logs for a product (Admin only)
const getInventoryLogs = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Get inventory logs for product:', id);

    const productId = parseInt(id);
    if (isNaN(productId)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID.' });
    }

    const logs = await prisma.inventoryLog.findMany({
      where: { productId },
      include: { admin: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json({ success: true, message: 'Inventory logs retrieved.', data: logs });
  } catch (error) {
    console.error('Get inventory logs error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while fetching inventory logs.' });
  }
};

// Get low stock products (Admin only)
const getLowStockProducts = async (req, res) => {
  try {
    console.log('Get low stock products request');

    // Retrieve products where totalStock is less than or equal to lowStockThreshold
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        totalStock: { lte: prisma.raw('"lowStockThreshold"') } // placeholder for comparison
      },
      orderBy: {
        totalStock: 'asc'
      },
      include: { images: true }
    });

    // Note: Prisma currently doesn't support comparing two columns in a simple where clause.
    // We'll do the filtering in-memory for now (acceptable for small datasets). If needed, replace with raw query.
    const filtered = products.filter(p => p.totalStock <= p.lowStockThreshold);

    console.log('Low stock products retrieved:', filtered.length);

    return res.status(200).json({
      success: true,
      message: 'Products with low stock retrieved.',
      data: filtered,
      count: filtered.length
    });
  } catch (error) {
    console.error('Get low stock products error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching low stock products.'
    });
  }
};

module.exports = {
  getAllProducts,
  getProductById,
  getProductsByCategory,
  createProduct,
  updateProduct,
  deleteProduct,
  toggleProductStatus,
  getLowStockProducts,
  restockProduct,
  getInventoryLogs
};
