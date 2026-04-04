const { Prisma } = require('@prisma/client');
const prisma = require('../../../prisma/client');

// Valid categories enum
const VALID_CATEGORIES = ['STATIONERY', 'BOOKS', 'TOYS'];

// Include creator info in product queries
const productInclude = {
  images: true,
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true
    }
  }
};

const MAX_PAGE_LIMIT = 100;

const parsePositiveInt = (value) => {
  const parsed = parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const getOrderByClause = (sortBy, sortOrder) => {
  const order = sortOrder === 'asc' ? 'asc' : 'desc';

  switch ((sortBy || '').toLowerCase()) {
    case 'price-low':
      return { baseSellingPrice: 'asc' };
    case 'price-high':
      return { baseSellingPrice: 'desc' };
    case 'name':
      return { name: 'asc' };
    case 'newest':
    case 'featured':
      return { createdAt: 'desc' };
    case 'price':
      return { baseSellingPrice: order };
    case 'createdat':
      return { createdAt: order };
    default:
      return { createdAt: 'desc' };
  }
};

// Get all products with filters (Public)
const getAllProducts = async (req, res) => {
  try {
    const { 
      isActive, 
      category, 
      minPrice, 
      maxPrice, 
      search,
      bargainable,
      lowStock,
      audience,
      random,
      page: pageQuery,
      limit: limitQuery,
      sortBy,
      sortOrder
    } = req.query;

    const normalizedAudience = String(audience || '').toLowerCase();
    const isCustomerCatalog = normalizedAudience === 'customer';
    const shouldRandomize = String(random || '').toLowerCase() === 'true';
    const shouldLowStockFilter = lowStock === 'true';
    const searchTerm = typeof search === 'string' ? search.trim() : '';
    const upperSearchTerm = searchTerm.toUpperCase();

    if (searchTerm.length > 200) {
      return res.status(400).json({
        success: false,
        message: 'search must be 200 characters or fewer.'
      });
    }

    if (pageQuery !== undefined && parsePositiveInt(pageQuery) === null) {
      return res.status(400).json({
        success: false,
        message: 'page must be a positive integer.'
      });
    }

    if (limitQuery !== undefined && parsePositiveInt(limitQuery) === null) {
      return res.status(400).json({
        success: false,
        message: 'limit must be a positive integer.'
      });
    }

    const page = parsePositiveInt(pageQuery) || 1;
    const requestedLimit = parsePositiveInt(limitQuery);
    const effectiveLimit = Math.min(requestedLimit || 20, MAX_PAGE_LIMIT);
    const shouldPaginate =
      isCustomerCatalog ||
      pageQuery !== undefined ||
      limitQuery !== undefined ||
      !!searchTerm;
    const skip = shouldPaginate ? (page - 1) * effectiveLimit : undefined;

    // Build filter conditions
    const where = {};

    // Customer catalog always returns customer-eligible products
    if (isCustomerCatalog) {
      where.isActive = true;
    } else if (isActive !== undefined) {
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
    if (searchTerm) {
      const terms = searchTerm.split(/\s+/).filter(Boolean);

      // Create OR conditions: uid contains, name contains, description contains, subCategory contains
      const orClauses = [
        { uid: { contains: searchTerm, mode: 'insensitive' } },
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
        { subCategory: { contains: searchTerm, mode: 'insensitive' } }
      ];

      if (VALID_CATEGORIES.includes(upperSearchTerm)) {
        orClauses.push({ category: upperSearchTerm });
      }

      // If there are distinct terms, search keywords array for any match
      if (terms.length > 0) {
        orClauses.push({ keywords: { hasSome: terms } });
      }

      where.AND = [
        { OR: orClauses }
      ];
    }

    const orderByClause = getOrderByClause(sortBy, sortOrder);
    const rawRandomAllowed = shouldRandomize && !searchTerm && !shouldLowStockFilter;
    let products = [];
    let totalCount = 0;

    if (rawRandomAllowed) {
      const rawWhere = [];

      if (where.isActive !== undefined) {
        rawWhere.push(
          where.isActive
            ? Prisma.sql`"isActive" = TRUE`
            : Prisma.sql`"isActive" = FALSE`
        );
      }
      if (where.category !== undefined) {
        rawWhere.push(Prisma.sql`"category" = ${where.category}`);
      }
      if (where.bargainable !== undefined) {
        rawWhere.push(Prisma.sql`"bargainable" = ${where.bargainable}`);
      }
      if (where.baseSellingPrice?.gte !== undefined) {
        rawWhere.push(Prisma.sql`"baseSellingPrice" >= ${where.baseSellingPrice.gte}`);
      }
      if (where.baseSellingPrice?.lte !== undefined) {
        rawWhere.push(Prisma.sql`"baseSellingPrice" <= ${where.baseSellingPrice.lte}`);
      }

      const whereClause = rawWhere.length
        ? Prisma.sql`WHERE ${Prisma.join(rawWhere, Prisma.sql` AND `)}`
        : Prisma.sql``;

      const [randomRows, countedTotal] = await Promise.all([
        prisma.$queryRaw`
          SELECT "id"
          FROM "products"
          ${whereClause}
          ORDER BY RANDOM()
          LIMIT ${effectiveLimit}
          OFFSET ${skip || 0}
        `,
        prisma.product.count({ where })
      ]);

      const randomIds = randomRows.map((row) => row.id);
      totalCount = countedTotal;

      if (randomIds.length > 0) {
        const listed = await prisma.product.findMany({
          where: { id: { in: randomIds } },
          include: productInclude
        });

        const byId = new Map(listed.map((p) => [p.id, p]));
        products = randomIds.map((id) => byId.get(id)).filter(Boolean);
      }
    } else {
      const query = {
        where,
        include: productInclude,
        orderBy: orderByClause
      };

      if (shouldPaginate && !shouldLowStockFilter) {
        query.skip = skip;
        query.take = effectiveLimit;
      }

      [products, totalCount] = await Promise.all([
        prisma.product.findMany(query),
        prisma.product.count({ where })
      ]);
    }

    // If lowStock filter is true, filter products below threshold (use in-memory filter)
    let filteredProducts = products;
    if (shouldLowStockFilter) {
      const lowStockProducts = products.filter((p) => p.totalStock <= p.lowStockThreshold);
      totalCount = lowStockProducts.length;
      if (shouldPaginate) {
        filteredProducts = lowStockProducts.slice(skip || 0, (skip || 0) + effectiveLimit);
      } else {
        filteredProducts = lowStockProducts;
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Products retrieved successfully.',
      data: filteredProducts,
      count: filteredProducts.length,
      ...(shouldPaginate
        ? {
            pagination: {
              page,
              limit: effectiveLimit,
              total: totalCount,
              totalPages: Math.max(1, Math.ceil(totalCount / effectiveLimit))
            }
          }
        : {})
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

    const productId = parseInt(id);
    if (isNaN(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID.'
      });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { images: true }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      });
    }

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
      include: { images: true },
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

const { getRecommendedProductsForUser } = require('./recommendations.service');

// Get recommended products (based on wishlist/cart/order history)
// Supports ?random=true to force a fresh random set (used on home-page refresh).
const getRecommendedProducts = async (req, res) => {
  // Prevent any proxy/CDN from caching personalised recommendations
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');

  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const forceRandom = String(req.query.random || '').toLowerCase() === 'true';

    const recommendedProducts = await getRecommendedProductsForUser(userId, limit, forceRandom);

    return res.status(200).json({
      success: true,
      message: 'Recommended products retrieved successfully.',
      data: recommendedProducts,
      count: recommendedProducts.length,
      meta: { forceRandom }
    });
  } catch (error) {
    console.error('Get recommended products error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching recommended products.'
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
        totalStock: quantityAdded,
        createdById: req.user.id  // Track who created the product
      }
    });

    // create bargain config if provided and product is bargainable
    if (bargainable !== false && req.body.bargainConfig) {
      const cfg = req.body.bargainConfig;
      await prisma.bargainConfig.create({
        data: {
          productId: newProduct.id,
          tier1Price: parseFloat(cfg.tier1Price) || 0,
          tier2Price: parseFloat(cfg.tier2Price) || 0,
          tier3Price: parseFloat(cfg.tier3Price) || 0,
          maxAttempts: parseInt(cfg.maxAttempts) || 1,
          bargainExpiryDate: cfg.bargainExpiryDate ? new Date(cfg.bargainExpiryDate) : null
        }
      });
    }

    // create bulk discounts if any
    if (Array.isArray(req.body.bulkDiscounts)) {
      const discounts = req.body.bulkDiscounts
        .map(d => {
          const minQty = parseInt(d.minQty);
          const discount = parseFloat(d.discount);
          if (!minQty || !discount) return null;
          return {
            productId: newProduct.id,
            minQty,
            discount,
            unit: d.unit || 'RUPEES'
          };
        })
        .filter(Boolean);
      if (discounts.length > 0) {
        await prisma.bulkDiscount.createMany({ data: discounts });
      }
    }

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
    const created = await prisma.product.findUnique({
      where: { id: newProduct.id },
      include: { images: true, bargainConfig: true, bulkDiscounts: true }
    });

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
      isActive,
      bargainConfig,
      bulkDiscounts,
      images
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
    // if price changed and bargainConfig exists maybe update tiers? will handle below

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

    // ===================================================
    // After building updateData, handle bargainConfig & bulkDiscounts separately below
    // ===================================================

    // Check if there's anything to update
    const hasImages = Array.isArray(images) && images.length > 0;
    if (Object.keys(updateData).length === 0 && !bargainConfig && !bulkDiscounts && !hasImages) {
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

    // -- images handling --
    if (hasImages) {
      // Accept Supabase Storage HTTPS URLs only.  Any URL that does not start with
      // 'https://' is silently discarded to prevent path-traversal or injection via
      // locally-crafted values.
      const validImageUrls = images.filter(url => typeof url === 'string' && url.startsWith('https://'));
      if (validImageUrls.length > 0) {
        await prisma.$transaction([
          prisma.productImage.deleteMany({ where: { productId } }),
          ...validImageUrls.map((imgUrl, idx) =>
            prisma.productImage.create({
              data: {
                productId,
                url: imgUrl,
                isPrimary: idx === 0
              }
            })
          )
        ]);
      }
    }

    // -- bargain config handling --
    if (bargainConfig) {
      const existingCfg = await prisma.bargainConfig.findUnique({ where: { productId } });
      const cfgData = {
        tier1Price: parseFloat(bargainConfig.tier1Price) || 0,
        tier2Price: parseFloat(bargainConfig.tier2Price) || 0,
        tier3Price: parseFloat(bargainConfig.tier3Price) || 0,
        maxAttempts: parseInt(bargainConfig.maxAttempts) || 1,
        bargainExpiryDate: bargainConfig.bargainExpiryDate ? new Date(bargainConfig.bargainExpiryDate) : null,
        isActive: bargainConfig.isActive !== undefined ? bargainConfig.isActive : true
      };
      if (existingCfg) {
        await prisma.bargainConfig.update({ where: { id: existingCfg.id }, data: cfgData });
      } else {
        await prisma.bargainConfig.create({ data: { ...cfgData, productId } });
      }
    }

    // -- bulk discounts handling --
    if (Array.isArray(bulkDiscounts)) {
      await prisma.bulkDiscount.deleteMany({ where: { productId } });
      const discounts = bulkDiscounts
        .map(d => {
          const minQty = parseInt(d.minQty);
          const discount = parseFloat(d.discount);
          if (!minQty || !discount) return null;
          return {
            productId,
            minQty,
            discount,
            unit: d.unit || 'RUPEES'
          };
        })
        .filter(Boolean);
      if (discounts.length > 0) {
        await prisma.bulkDiscount.createMany({ data: discounts });
      }
    }

    // re-fetch to include relations
    const refreshed = await prisma.product.findUnique({
      where: { id: productId },
      include: { images: true, bargainConfig: true, bulkDiscounts: true }
    });

    // Calculate profit margin
    const profitMargin = ((refreshed.baseSellingPrice - refreshed.costPrice) / refreshed.baseSellingPrice * 100).toFixed(2);

    return res.status(200).json({
      success: true,
      message: 'Product updated successfully.',
      data: {
        ...refreshed,
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

    const { quantityAdded, costPrice, baseSellingPrice, bargainable, images, note, investmentSource } = req.body;
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

      // If restocking from profit, deduct from profit ledger (cash reserve)
      if (investmentSource === 'PROFIT') {
        const costPerUnit = parseFloat(costPrice ?? product.costPrice);
        const totalCost = costPerUnit * qty;
        await prismaTx.profitLedger.create({
          data: {
            adminId: req.user?.id || null,
            amount: -Math.abs(totalCost),
            note: `Reinvested from profit to restock ${qty} unit(s) of ${product.name} (${product.id}) at ₹${costPerUnit.toFixed(2)} each`,
            orderId: null
          }
        });
      }

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

    // Fetch all active products, filter in memory (Prisma doesn't support column-column comparison in where)
    const products = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: { totalStock: 'asc' },
      include: { images: true },
      include: productInclude
    });

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

const notifyMeWhenAvailable = async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;
    const userId = req.user.id;

    console.log('Notify request for product:', id, 'User:', userId);

    const productId = parseInt(id);
    if (isNaN(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID.'
      });
    }

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      });
    }

    // Check if already registered
    const existing = await prisma.productNotification.findUnique({
      where: {
        productId_userId: {
          productId,
          userId
        }
      }
    });

    if (existing) {
      return res.status(200).json({
        success: true,
        message: 'You are already registered for notifications.',
        data: existing
      });
    }

    // Create notification request
    const notification = await prisma.productNotification.create({
      data: {
        productId,
        userId,
        email: email || req.user.email
      }
    });

    console.log('Notification registered:', notification.id);

    return res.status(201).json({
      success: true,
      message: 'You will be notified when this product is back in stock!',
      data: notification
    });
  } catch (error) {
    console.error('Notify me error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while registering notification.'
    });
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER-FACING PRODUCT CATALOG
// GET /api/products/customer
// Public (optionalAuth) — returns active products, supports ?random=true for
// a fresh shuffle every request (used by the home-page personalised feed).
// ─────────────────────────────────────────────────────────────────────────────
const getCustomerProducts = async (req, res) => {
  try {
    const {
      category,
      search,
      minPrice,
      maxPrice,
      sortBy,
      page: pageQuery,
      limit: limitQuery,
      random
    } = req.query;

    const shouldRandomize = String(random || '').toLowerCase() === 'true';
    const page = Math.max(1, parseInt(pageQuery) || 1);
    const limit = Math.min(parseInt(limitQuery) || 20, 100);
    const skip = (page - 1) * limit;

    const where = { isActive: true };

    if (category && VALID_CATEGORIES.includes(category.toUpperCase())) {
      where.category = category.toUpperCase();
    }

    if (minPrice || maxPrice) {
      where.baseSellingPrice = {};
      if (minPrice) where.baseSellingPrice.gte = parseFloat(minPrice);
      if (maxPrice) where.baseSellingPrice.lte = parseFloat(maxPrice);
    }

    if (search && typeof search === 'string' && search.trim()) {
      const s = search.trim();
      const terms = s.split(/\s+/).filter(Boolean);
      const orClauses = [
        { name: { contains: s, mode: 'insensitive' } },
        { description: { contains: s, mode: 'insensitive' } },
        { subCategory: { contains: s, mode: 'insensitive' } },
        { uid: { contains: s, mode: 'insensitive' } }
      ];
      if (VALID_CATEGORIES.includes(s.toUpperCase())) {
        orClauses.push({ category: s.toUpperCase() });
      }
      if (terms.length > 0) {
        orClauses.push({ keywords: { hasSome: terms } });
      }
      where.AND = [{ OR: orClauses }];
    }

    // Random shuffle path — use RANDOM() via raw SQL for true randomness
    if (shouldRandomize && !search) {
      const rawWhere = [Prisma.sql`"isActive" = TRUE`];
      if (where.category) rawWhere.push(Prisma.sql`"category" = ${where.category}`);
      if (where.baseSellingPrice?.gte !== undefined)
        rawWhere.push(Prisma.sql`"baseSellingPrice" >= ${where.baseSellingPrice.gte}`);
      if (where.baseSellingPrice?.lte !== undefined)
        rawWhere.push(Prisma.sql`"baseSellingPrice" <= ${where.baseSellingPrice.lte}`);

      const whereClause = Prisma.sql`WHERE ${Prisma.join(rawWhere, Prisma.sql` AND `)}`;

      const [randomRows, totalCount] = await Promise.all([
        prisma.$queryRaw`
          SELECT "id" FROM "products"
          ${whereClause}
          ORDER BY RANDOM()
          LIMIT ${limit}
          OFFSET ${skip}
        `,
        prisma.product.count({ where })
      ]);

      const ids = randomRows.map(r => r.id);
      let products = [];
      if (ids.length > 0) {
        const listed = await prisma.product.findMany({
          where: { id: { in: ids } },
          include: productInclude
        });
        const byId = new Map(listed.map(p => [p.id, p]));
        products = ids.map(id => byId.get(id)).filter(Boolean);
      }

      return res.status(200).json({
        success: true,
        message: 'Customer products retrieved successfully.',
        data: products,
        count: products.length,
        pagination: {
          page, limit,
          total: Number(totalCount),
          totalPages: Math.max(1, Math.ceil(Number(totalCount) / limit))
        }
      });
    }

    // Normal (deterministic) path
    const orderByClause = getOrderByClause(sortBy);

    const [products, totalCount] = await Promise.all([
      prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: orderByClause,
        skip,
        take: limit
      }),
      prisma.product.count({ where })
    ]);

    return res.status(200).json({
      success: true,
      message: 'Customer products retrieved successfully.',
      data: products,
      count: products.length,
      pagination: {
        page, limit,
        total: totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / limit))
      }
    });
  } catch (error) {
    console.error('getCustomerProducts error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching products.'
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER SMART SEARCH
// GET /api/products/customer/search?search=...&category=...&limit=...
//
// Search order (highest relevance first):
//  1. Exact name match
//  2. Keyword array contains any search term
//  3. subCategory match
//  4. Description / UID partial match
//  5. Wishlist / order history boost (logged-in users only)
//
// No caching — every request hits the DB fresh (Cache-Control: no-store).
// ─────────────────────────────────────────────────────────────────────────────
const customerSearch = async (req, res) => {
  try {
    // Hard-disable any upstream proxy caching
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Surrogate-Control', 'no-store');

    const {
      search,
      category,
      page: pageQuery,
      limit: limitQuery,
      subCategory
    } = req.query;

    const rawSearch = typeof search === 'string' ? search.trim() : '';

    if (!rawSearch) {
      return res.status(400).json({
        success: false,
        message: 'search query parameter is required.'
      });
    }

    if (rawSearch.length > 200) {
      return res.status(400).json({
        success: false,
        message: 'search must be 200 characters or fewer.'
      });
    }

    const page = Math.max(1, parseInt(pageQuery) || 1);
    const limit = Math.min(parseInt(limitQuery) || 20, 100);
    const skip = (page - 1) * limit;

    const terms = rawSearch.split(/\s+/).filter(Boolean);
    const upperSearch = rawSearch.toUpperCase();

    // Build base OR search clauses
    const orClauses = [
      { name: { contains: rawSearch, mode: 'insensitive' } },
      { description: { contains: rawSearch, mode: 'insensitive' } },
      { subCategory: { contains: rawSearch, mode: 'insensitive' } },
      { uid: { contains: rawSearch, mode: 'insensitive' } }
    ];

    if (VALID_CATEGORIES.includes(upperSearch)) {
      orClauses.push({ category: upperSearch });
    }

    if (terms.length > 0) {
      orClauses.push({ keywords: { hasSome: terms } });
    }

    // Subcategory filter from query param
    if (subCategory && typeof subCategory === 'string' && subCategory.trim()) {
      orClauses.push({ subCategory: { contains: subCategory.trim(), mode: 'insensitive' } });
    }

    const where = {
      isActive: true,
      AND: [{ OR: orClauses }]
    };

    // Category filter
    if (category && VALID_CATEGORIES.includes(category.toUpperCase())) {
      where.category = category.toUpperCase();
    }

    // Fetch raw results — no artificial limit, we'll sort + slice
    const rawProducts = await prisma.product.findMany({
      where,
      include: productInclude,
      take: 200 // upper bound to avoid full-table scans
    });

    // ── Relevance scoring ──────────────────────────────────────────────────
    const userId = req.user?.id;
    let wishedIds = new Set();
    let orderedIds = new Set();

    if (userId) {
      const [wishlistItems, recentOrders] = await Promise.all([
        prisma.wishlist.findMany({
          where: { userId },
          select: { productId: true }
        }),
        prisma.orderItem.findMany({
          where: { order: { userId } },
          select: { productId: true },
          orderBy: { order: { createdAt: 'desc' } },
          take: 50
        })
      ]);
      wishedIds = new Set(wishlistItems.map(w => w.productId));
      orderedIds = new Set(recentOrders.map(o => o.productId));
    }

    const lowerSearch = rawSearch.toLowerCase();

    const scored = rawProducts.map(p => {
      let score = 0;

      // Exact name match — highest priority
      if (p.name.toLowerCase() === lowerSearch) score += 100;
      // Name starts with search
      else if (p.name.toLowerCase().startsWith(lowerSearch)) score += 60;
      // Name contains search
      else if (p.name.toLowerCase().includes(lowerSearch)) score += 40;

      // Keyword exact match
      const pKeywords = (p.keywords || []).map(k => k.toLowerCase());
      if (pKeywords.includes(lowerSearch)) score += 50;
      // Keyword partial match for each term
      terms.forEach(t => {
        if (pKeywords.some(k => k.includes(t.toLowerCase()))) score += 15;
      });

      // SubCategory match
      if (p.subCategory && p.subCategory.toLowerCase().includes(lowerSearch)) score += 30;

      // Description match
      if (p.description && p.description.toLowerCase().includes(lowerSearch)) score += 10;

      // Wishlist boost (user previously wishlisted this product)
      if (wishedIds.has(p.id)) score += 25;

      // Purchase history boost
      if (orderedIds.has(p.id)) score += 15;

      // In-stock boost
      if (p.totalStock > 0) score += 5;

      return { product: p, score };
    });

    // Sort by score descending, then by name ascending as tiebreaker
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.product.name.localeCompare(b.product.name);
    });

    const total = scored.length;
    const paginated = scored.slice(skip, skip + limit).map(s => s.product);

    // Save search term for history (fire-and-forget — never blocks response)
    if (userId && rawSearch.length >= 2) {
      prisma.searchHistory
        .upsert({
          where: { userId_term: { userId, term: rawSearch } },
          create: { userId, term: rawSearch, searchedAt: new Date() },
          update: { searchedAt: new Date(), count: { increment: 1 } }
        })
        .catch(() => {}); // silently ignore if SearchHistory model doesn't exist yet
    }

    return res.status(200).json({
      success: true,
      message: 'Search results retrieved successfully.',
      data: paginated,
      count: paginated.length,
      pagination: {
        page, limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      },
      meta: { query: rawSearch, terms }
    });
  } catch (error) {
    console.error('customerSearch error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while searching products.'
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// TRACK INTERACTION
// POST /api/products/track-interaction
// Body: { productId, type: 'VIEW' | 'SEARCH' | 'WISHLIST', searchTerm? }
//
// Saves customer interaction events that feed the recommendation engine.
// Fire-and-forget from the frontend — errors are swallowed server-side.
// ─────────────────────────────────────────────────────────────────────────────
const trackInteraction = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const { productId, type, searchTerm } = req.body;
    const productIdInt = parseInt(productId);

    if (isNaN(productIdInt)) {
      return res.status(400).json({ success: false, message: 'Invalid productId.' });
    }

    const VALID_TYPES = ['VIEW', 'SEARCH', 'WISHLIST', 'CART', 'PURCHASE'];
    const interactionType = String(type || '').toUpperCase();
    if (!VALID_TYPES.includes(interactionType)) {
      return res.status(400).json({ success: false, message: `type must be one of: ${VALID_TYPES.join(', ')}` });
    }

    // Check product exists (quick lookup — no include needed)
    const product = await prisma.product.findUnique({
      where: { id: productIdInt },
      select: { id: true }
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    // Try to save to ProductInteraction table if it exists in the schema.
    // If the model doesn't exist (older migration), silently succeed.
    try {
      await prisma.productInteraction.create({
        data: {
          userId,
          productId: productIdInt,
          type: interactionType,
          searchTerm: (interactionType === 'SEARCH' && searchTerm)
            ? String(searchTerm).slice(0, 200)
            : null
        }
      });
    } catch (modelErr) {
      // ProductInteraction model may not be migrated yet — fail silently
      console.log('ProductInteraction model not ready, skipping:', modelErr.message);
    }

    return res.status(200).json({ success: true, message: 'Interaction tracked.' });
  } catch (error) {
    console.error('trackInteraction error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while tracking interaction.'
    });
  }
};


module.exports = {
  getAllProducts,
  getProductById,
  getProductsByCategory,
  getRecommendedProducts,
  getCustomerProducts,
  customerSearch,
  trackInteraction,
  createProduct,
  updateProduct,
  deleteProduct,
  toggleProductStatus,
  getLowStockProducts,
  restockProduct,
  getInventoryLogs,
  notifyMeWhenAvailable
};
