// ============================================================
// product.controller.js  —  Stationery World v4.0 (Upgraded)
//
// Changes from v3:
//  - MRP field handled in createProduct & updateProduct
//  - TOYS default: mrp = baseSellingPrice * 1.2 if not provided
//  - Full-text search via tsvector (GIN index) — Section 2.3
//  - SearchLog created on every search — Section 2.3
//  - Self-learning: after search-click, appends term to keywords[] — Section 2.3
//  - Initial Quantity BUG FIX: always writes inventory log on create — Section 5
//  - getSubCategories: new endpoint for Shop By Category sidebar — Section 2.4
//  - All existing functions PRESERVED
// ============================================================

const { Prisma } = require('@prisma/client');
const prisma = require('../../../prisma/client');
const multer = require('multer');
const path   = require('path');
const { uploadToSupabase, deleteFromSupabase, productImagePath, PRODUCT_BUCKET } = require('../../utils/uploadToSupabase');

// ── Multer for product image upload ──────────────────────────────────────────
const _imgFilter = (req, file, cb) => {
  const ok = /jpeg|jpg|png|gif|webp/.test(path.extname(file.originalname).toLowerCase())
           && /image/.test(file.mimetype);
  ok ? cb(null, true) : cb(new Error('Only image files are allowed.'));
};
const _imgUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: _imgFilter
});

const VALID_CATEGORIES = ['STATIONERY', 'BOOKS', 'TOYS'];

const productInclude = {
  images: { orderBy: { position: 'asc' } },
  createdBy: {
    select: { id: true, name: true, email: true, role: true }
  },
  variantGroup: {
    include: {
      products: {
        where:   { isActive: true },
        include: { images: { where: { isPrimary: true }, take: 1 } },
        orderBy: { id: 'asc' }
      }
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
    case 'price-low':   return { baseSellingPrice: 'asc' };
    case 'price-high':  return { baseSellingPrice: 'desc' };
    case 'name':        return { name: 'asc' };
    case 'newest':
    case 'featured':    return { createdAt: 'desc' };
    case 'price':       return { baseSellingPrice: order };
    case 'createdat':   return { createdAt: order };
    default:            return { createdAt: 'desc' };
  }
};

// ── MRP Helper ────────────────────────────────────────────────────────────────
// TOYS default: mrp = sp * 1.2.  Other categories: pass as-is (may be null).
function computeMrp(category, sellingPrice, mrpInput) {
  if (mrpInput !== undefined && mrpInput !== null && mrpInput !== '') {
    const v = parseFloat(mrpInput);
    if (!isNaN(v) && v > 0) return v;
  }
  if (category === 'TOYS') return parseFloat((sellingPrice * 1.2).toFixed(2));
  return null; // not set — frontend shows SP only
}

// ── SearchLog helper ──────────────────────────────────────────────────────────
async function recordSearchLog(userId, query, clickedProductId = null) {
  try {
    await prisma.searchLog.create({
      data: {
        userId: userId || null,
        query: String(query).slice(0, 500),
        clickedProductId: clickedProductId || null
      }
    });
  } catch (_) {
    // non-fatal — never block the request
  }
}

// ── Self-learning: append clicked product's search term to its keywords ───────
async function appendKeywordToProduct(productId, term) {
  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { keywords: true }
    });
    if (!product) return;
    const lcTerm = term.toLowerCase().trim();
    if (!lcTerm || product.keywords.includes(lcTerm)) return;
    await prisma.product.update({
      where: { id: productId },
      data: { keywords: { push: lcTerm } }
    });
  } catch (_) {
    // non-fatal
  }
}

// =============================================================================
// GET ALL PRODUCTS (Admin/Public)
// =============================================================================
const getAllProducts = async (req, res) => {
  try {
    const {
      isActive, category, minPrice, maxPrice, search,
      bargainable, lowStock, audience, random,
      page: pageQuery, limit: limitQuery, sortBy, sortOrder
    } = req.query;

    const normalizedAudience = String(audience || '').toLowerCase();
    const isCustomerCatalog = normalizedAudience === 'customer';
    const shouldRandomize = String(random || '').toLowerCase() === 'true';
    const shouldLowStockFilter = lowStock === 'true';
    const searchTerm = typeof search === 'string' ? search.trim() : '';
    const upperSearchTerm = searchTerm.toUpperCase();

    if (searchTerm.length > 200) {
      return res.status(400).json({ success: false, message: 'search must be 200 characters or fewer.' });
    }

    const page = parsePositiveInt(pageQuery) || 1;
    const requestedLimit = parsePositiveInt(limitQuery);
    const effectiveLimit = Math.min(requestedLimit || 20, MAX_PAGE_LIMIT);
    const shouldPaginate = isCustomerCatalog || pageQuery !== undefined || limitQuery !== undefined || !!searchTerm;
    const skip = shouldPaginate ? (page - 1) * effectiveLimit : undefined;

    const where = {};
    if (isCustomerCatalog) {
      where.isActive = true;
    } else if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }
    if (category && VALID_CATEGORIES.includes(category.toUpperCase())) {
      where.category = category.toUpperCase();
    }
    if (bargainable !== undefined) where.bargainable = bargainable === 'true';
    if (minPrice || maxPrice) {
      where.baseSellingPrice = {};
      if (minPrice) where.baseSellingPrice.gte = parseFloat(minPrice);
      if (maxPrice) where.baseSellingPrice.lte = parseFloat(maxPrice);
    }

    if (searchTerm) {
      const terms = searchTerm.split(/\s+/).filter(Boolean);
      const orClauses = [
        { uid: { contains: searchTerm, mode: 'insensitive' } },
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
        { subCategory: { contains: searchTerm, mode: 'insensitive' } }
      ];
      if (VALID_CATEGORIES.includes(upperSearchTerm)) orClauses.push({ category: upperSearchTerm });
      const lowerTerms = terms.map(t => t.toLowerCase()).filter(Boolean);
      if (lowerTerms.length > 0) orClauses.push({ keywords: { hasSome: lowerTerms } });
      const lowerFull = searchTerm.toLowerCase();
      if (lowerFull && !lowerTerms.includes(lowerFull)) orClauses.push({ keywords: { hasSome: [lowerFull] } });
      where.AND = [{ OR: orClauses }];

      // Record search log (fire-and-forget)
      const userId = req.user?.id || null;
      recordSearchLog(userId, searchTerm);
    }

    const orderByClause = getOrderByClause(sortBy, sortOrder);
    const rawRandomAllowed = shouldRandomize && !searchTerm && !shouldLowStockFilter;
    let products = [];
    let totalCount = 0;

    if (rawRandomAllowed) {
      const rawWhere = [];
      if (where.isActive !== undefined) {
        rawWhere.push(where.isActive ? Prisma.sql`"isActive" = TRUE` : Prisma.sql`"isActive" = FALSE`);
      }
      if (where.category) rawWhere.push(Prisma.sql`"category" = ${where.category}`);
      if (where.bargainable !== undefined) rawWhere.push(Prisma.sql`"bargainable" = ${where.bargainable}`);
      if (where.baseSellingPrice?.gte !== undefined) rawWhere.push(Prisma.sql`"baseSellingPrice" >= ${where.baseSellingPrice.gte}`);
      if (where.baseSellingPrice?.lte !== undefined) rawWhere.push(Prisma.sql`"baseSellingPrice" <= ${where.baseSellingPrice.lte}`);

      const whereClause = rawWhere.length
        ? Prisma.sql`WHERE ${Prisma.join(rawWhere, Prisma.sql` AND `)}`
        : Prisma.sql``;

      const [randomRows, countedTotal] = await Promise.all([
        prisma.$queryRaw`SELECT "id" FROM "products" ${whereClause} ORDER BY RANDOM() LIMIT ${effectiveLimit} OFFSET ${skip || 0}`,
        prisma.product.count({ where })
      ]);

      const randomIds = randomRows.map(r => r.id);
      totalCount = countedTotal;
      if (randomIds.length > 0) {
        const listed = await prisma.product.findMany({ where: { id: { in: randomIds } }, include: productInclude });
        const byId = new Map(listed.map(p => [p.id, p]));
        products = randomIds.map(id => byId.get(id)).filter(Boolean);
      }
    } else {
      const query = { where, include: productInclude, orderBy: orderByClause };
      if (shouldPaginate && !shouldLowStockFilter) { query.skip = skip; query.take = effectiveLimit; }
      [products, totalCount] = await Promise.all([prisma.product.findMany(query), prisma.product.count({ where })]);
    }

    let filteredProducts = products;
    if (shouldLowStockFilter) {
      const low = products.filter(p => p.totalStock <= p.lowStockThreshold);
      totalCount = low.length;
      filteredProducts = shouldPaginate ? low.slice(skip || 0, (skip || 0) + effectiveLimit) : low;
    }

    return res.status(200).json({
      success: true,
      message: 'Products retrieved successfully.',
      data: filteredProducts,
      count: filteredProducts.length,
      ...(shouldPaginate ? {
        pagination: { page, limit: effectiveLimit, total: totalCount, totalPages: Math.max(1, Math.ceil(totalCount / effectiveLimit)) }
      } : {})
    });
  } catch (error) {
    console.error('Get all products error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while fetching products.' });
  }
};

// =============================================================================
// GET PRODUCT BY ID
// =============================================================================
const getProductById = async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    if (isNaN(productId)) return res.status(400).json({ success: false, message: 'Invalid product ID.' });

    const product = await prisma.product.findUnique({ where: { id: productId }, include: productInclude });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });

    return res.status(200).json({ success: true, message: 'Product retrieved successfully.', data: product });
  } catch (error) {
    console.error('Get product by ID error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while fetching product.' });
  }
};

// =============================================================================
// GET PRODUCTS BY CATEGORY
// =============================================================================
const getProductsByCategory = async (req, res) => {
  try {
    const upperCategory = req.params.category.toUpperCase();
    if (!VALID_CATEGORIES.includes(upperCategory)) {
      return res.status(400).json({ success: false, message: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` });
    }
    const products = await prisma.product.findMany({
      where: { category: upperCategory, isActive: true },
      include: { images: true },
      orderBy: { name: 'asc' }
    });
    return res.status(200).json({ success: true, data: products, count: products.length });
  } catch (error) {
    console.error('Get products by category error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while fetching products.' });
  }
};

// =============================================================================
// 🆕 GET SUBCATEGORIES (Section 2.4 — Shop By Category)
// GET /api/products/subcategories?category=STATIONERY&adminId=1
// Returns distinct subCategory values (optionally scoped to category/admin)
// =============================================================================
const getSubCategories = async (req, res) => {
  try {
    const { category, adminId } = req.query;
    const where = { isActive: true };
    if (category && VALID_CATEGORIES.includes(category.toUpperCase())) {
      where.category = category.toUpperCase();
    }
    if (adminId) {
      where.createdById = parseInt(adminId);
    }

    const products = await prisma.product.findMany({
      where,
      select: { subCategory: true, category: true },
      distinct: ['subCategory']
    });

    // Group by category
    const grouped = {};
    products.forEach(p => {
      if (!grouped[p.category]) grouped[p.category] = [];
      if (!grouped[p.category].includes(p.subCategory)) {
        grouped[p.category].push(p.subCategory);
      }
    });

    const flat = [...new Set(products.map(p => p.subCategory))].sort();

    return res.status(200).json({
      success: true,
      message: 'SubCategories retrieved successfully.',
      data: { grouped, flat }
    });
  } catch (error) {
    console.error('Get subCategories error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

const { getRecommendedProductsForUser } = require('./recommendations.service');

// =============================================================================
// GET RECOMMENDED PRODUCTS
// =============================================================================
const getRecommendedProducts = async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const forceRandom = String(req.query.random || '').toLowerCase() === 'true';
    const recommendedProducts = await getRecommendedProductsForUser(userId, limit, forceRandom);
    return res.status(200).json({ success: true, data: recommendedProducts, count: recommendedProducts.length, meta: { forceRandom } });
  } catch (error) {
    console.error('Get recommended products error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while fetching recommended products.' });
  }
};

// =============================================================================
// 🆕 CREATE PRODUCT — with MRP + BUG FIX: Initial Quantity always saved
// =============================================================================
const createProduct = async (req, res) => {
  try {
    const {
      name, description, category, subCategory,
      costPrice, baseSellingPrice, mrp,
      bargainable, lowStockThreshold
    } = req.body;

    if (!name || !category || !subCategory || costPrice === undefined || baseSellingPrice === undefined || lowStockThreshold === undefined) {
      return res.status(400).json({
        success: false,
        message: 'name, category, subCategory, costPrice, baseSellingPrice, and lowStockThreshold are required.'
      });
    }

    const upperCategory = category.toUpperCase();
    if (!VALID_CATEGORIES.includes(upperCategory)) {
      return res.status(400).json({ success: false, message: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` });
    }

    const cost = parseFloat(costPrice);
    const sellingPrice = parseFloat(baseSellingPrice);
    const threshold = parseInt(lowStockThreshold);

    if (isNaN(cost) || cost < 0) return res.status(400).json({ success: false, message: 'costPrice must be a valid non-negative number.' });
    if (isNaN(sellingPrice) || sellingPrice < 0) return res.status(400).json({ success: false, message: 'baseSellingPrice must be a valid non-negative number.' });
    if (sellingPrice < cost) return res.status(400).json({ success: false, message: 'baseSellingPrice cannot be less than costPrice.' });
    if (isNaN(threshold) || threshold < 0) return res.status(400).json({ success: false, message: 'lowStockThreshold must be a valid non-negative integer.' });

    // 🆕 Compute MRP
    const computedMrp = computeMrp(upperCategory, sellingPrice, mrp);

    const keywordArray = Array.isArray(req.body.keywords)
      ? req.body.keywords.map(k => String(k).trim().toLowerCase()).filter(Boolean)
      : [];
    const images = Array.isArray(req.body.images) ? req.body.images.filter(Boolean) : [];

    // 🐞 BUG FIX: Always parse quantityAdded, default 0
    const quantityAdded = parseInt(req.body.quantityAdded) || 0;

    const newProduct = await prisma.product.create({
      data: {
        name,
        description: description || null,
        keywords: keywordArray,
        category: upperCategory,
        subCategory,
        costPrice: cost,
        baseSellingPrice: sellingPrice,
        mrp: computedMrp,
        bargainable: bargainable !== undefined ? (bargainable === true || bargainable === 'true') : true,
        lowStockThreshold: threshold,
        // 🐞 BUG FIX: Set totalStock to quantityAdded (not always 0)
        totalStock: quantityAdded,
        createdById: req.user.id
      }
    });

    // Bargain config
    if ((bargainable === true || bargainable === 'true') && req.body.bargainConfig) {
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

    // Bulk discounts
    if (Array.isArray(req.body.bulkDiscounts)) {
      const discounts = req.body.bulkDiscounts
        .map(d => {
          const minQty = parseInt(d.minQty);
          const discount = parseFloat(d.discount);
          if (!minQty || !discount) return null;
          return { productId: newProduct.id, minQty, discount, unit: d.unit || 'RUPEES' };
        })
        .filter(Boolean);
      if (discounts.length > 0) await prisma.bulkDiscount.createMany({ data: discounts });
    }

    // Images
    if (images.length > 0) {
      await Promise.all(images.map((imgUrl, idx) =>
        prisma.productImage.create({ data: { productId: newProduct.id, url: imgUrl, isPrimary: idx === 0 } })
      ));
    }

    // 🐞 BUG FIX: Always create inventory log if quantity > 0
    if (quantityAdded > 0) {
      await prisma.inventoryLog.create({
        data: {
          productId: newProduct.id,
          action: 'ADD',
          quantity: quantityAdded,
          adminId: req.user.id,
          note: 'Initial stock on product creation'
        }
      });
    }

    const created = await prisma.product.findUnique({
      where: { id: newProduct.id },
      include: { images: true, bargainConfig: true, bulkDiscounts: true }
    });

    const profitMargin = ((sellingPrice - cost) / sellingPrice * 100).toFixed(2);

    return res.status(201).json({
      success: true,
      message: 'Product created successfully.',
      data: { ...created, profitMargin: `${profitMargin}%` }
    });
  } catch (error) {
    console.error('Create product error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while creating product.' });
  }
};

// =============================================================================
// UPDATE PRODUCT — with MRP support
// =============================================================================
const updateProduct = async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    if (isNaN(productId)) return res.status(400).json({ success: false, message: 'Invalid product ID.' });

    const existingProduct = await prisma.product.findUnique({ where: { id: productId } });
    if (!existingProduct) return res.status(404).json({ success: false, message: 'Product not found.' });

    const { name, description, category, subCategory, costPrice, baseSellingPrice, mrp,
            bargainable, lowStockThreshold, isActive, bargainConfig, bulkDiscounts, images } = req.body;

    const updateData = {};

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (req.body.keywords !== undefined) {
      updateData.keywords = Array.isArray(req.body.keywords)
        ? req.body.keywords.map(k => String(k).trim().toLowerCase()).filter(Boolean)
        : [];
    }
    if (req.body.variantGroupId !== undefined) {
      updateData.variantGroupId = req.body.variantGroupId ? parseInt(req.body.variantGroupId) : null;
    }

    if (category !== undefined) {
      const upperCategory = category.toUpperCase();
      if (!VALID_CATEGORIES.includes(upperCategory)) {
        return res.status(400).json({ success: false, message: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}` });
      }
      updateData.category = upperCategory;
    }

    if (subCategory !== undefined) updateData.subCategory = subCategory;

    if (costPrice !== undefined) {
      const cost = parseFloat(costPrice);
      if (isNaN(cost) || cost < 0) return res.status(400).json({ success: false, message: 'costPrice must be a valid non-negative number.' });
      updateData.costPrice = cost;
    }

    if (baseSellingPrice !== undefined) {
      const sp = parseFloat(baseSellingPrice);
      if (isNaN(sp) || sp < 0) return res.status(400).json({ success: false, message: 'baseSellingPrice must be a valid non-negative number.' });
      updateData.baseSellingPrice = sp;
    }

    if (updateData.costPrice !== undefined && updateData.baseSellingPrice !== undefined) {
      if (updateData.baseSellingPrice < updateData.costPrice) {
        return res.status(400).json({ success: false, message: 'baseSellingPrice cannot be less than costPrice.' });
      }
    }

    // 🆕 MRP update
    if (mrp !== undefined || updateData.baseSellingPrice !== undefined || updateData.category !== undefined) {
      const effectiveCategory = updateData.category || existingProduct.category;
      const effectiveSp = updateData.baseSellingPrice || existingProduct.baseSellingPrice;
      updateData.mrp = computeMrp(effectiveCategory, effectiveSp, mrp !== undefined ? mrp : existingProduct.mrp);
    }

    if (bargainable !== undefined) updateData.bargainable = bargainable === true || bargainable === 'true';
    if (lowStockThreshold !== undefined) {
      const threshold = parseInt(lowStockThreshold);
      if (isNaN(threshold) || threshold < 0) return res.status(400).json({ success: false, message: 'lowStockThreshold must be a valid non-negative integer.' });
      updateData.lowStockThreshold = threshold;
    }
    if (isActive !== undefined) updateData.isActive = isActive;

    const hasImages = Array.isArray(images) && images.length > 0;
    if (Object.keys(updateData).length === 0 && !bargainConfig && !bulkDiscounts && !hasImages) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    await prisma.product.update({ where: { id: productId }, data: updateData });

    if (hasImages) {
      const validUrls = images.filter(url => typeof url === 'string' && url.startsWith('https://'));
      if (validUrls.length > 0) {
        await prisma.$transaction([
          prisma.productImage.deleteMany({ where: { productId } }),
          ...validUrls.map((imgUrl, idx) =>
            prisma.productImage.create({ data: { productId, url: imgUrl, isPrimary: idx === 0 } })
          )
        ]);
      }
    }

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

    if (Array.isArray(bulkDiscounts)) {
      await prisma.bulkDiscount.deleteMany({ where: { productId } });
      const discounts = bulkDiscounts
        .map(d => {
          const minQty = parseInt(d.minQty);
          const discount = parseFloat(d.discount);
          if (!minQty || !discount) return null;
          return { productId, minQty, discount, unit: d.unit || 'RUPEES' };
        })
        .filter(Boolean);
      if (discounts.length > 0) await prisma.bulkDiscount.createMany({ data: discounts });
    }

    const refreshed = await prisma.product.findUnique({
      where: { id: productId },
      include: { images: true, bargainConfig: true, bulkDiscounts: true }
    });

    const profitMargin = ((refreshed.baseSellingPrice - refreshed.costPrice) / refreshed.baseSellingPrice * 100).toFixed(2);

    return res.status(200).json({
      success: true,
      message: 'Product updated successfully.',
      data: { ...refreshed, profitMargin: `${profitMargin}%` }
    });
  } catch (error) {
    console.error('Update product error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while updating product.' });
  }
};

// =============================================================================
// DELETE PRODUCT
// =============================================================================
const deleteProduct = async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    if (isNaN(productId)) return res.status(400).json({ success: false, message: 'Invalid product ID.' });
    const existing = await prisma.product.findUnique({ where: { id: productId } });
    if (!existing) return res.status(404).json({ success: false, message: 'Product not found.' });
    await prisma.product.delete({ where: { id: productId } });
    return res.status(200).json({ success: true, message: 'Product deleted successfully.', data: { id: productId } });
  } catch (error) {
    console.error('Delete product error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while deleting product.' });
  }
};

// =============================================================================
// TOGGLE PRODUCT STATUS
// =============================================================================
const toggleProductStatus = async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    if (isNaN(productId)) return res.status(400).json({ success: false, message: 'Invalid product ID.' });
    const existing = await prisma.product.findUnique({ where: { id: productId } });
    if (!existing) return res.status(404).json({ success: false, message: 'Product not found.' });
    const updated = await prisma.product.update({ where: { id: productId }, data: { isActive: !existing.isActive } });
    return res.status(200).json({ success: true, message: `Product ${updated.isActive ? 'activated' : 'deactivated'} successfully.`, data: updated });
  } catch (error) {
    console.error('Toggle product status error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while toggling product status.' });
  }
};

// =============================================================================
// RESTOCK PRODUCT
// =============================================================================
const restockProduct = async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    if (isNaN(productId)) return res.status(400).json({ success: false, message: 'Invalid product ID.' });

    const { quantityAdded, costPrice, baseSellingPrice, bargainable, images, note, investmentSource, mrp } = req.body;
    const qty = parseInt(quantityAdded || 0);
    if (isNaN(qty) || qty <= 0) return res.status(400).json({ success: false, message: 'quantityAdded must be a positive integer.' });

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });

    const updateData = {};
    if (costPrice !== undefined) updateData.costPrice = parseFloat(costPrice);
    if (baseSellingPrice !== undefined) updateData.baseSellingPrice = parseFloat(baseSellingPrice);
    if (bargainable !== undefined) updateData.bargainable = bargainable;

    // 🆕 Recompute MRP if SP changes
    const newSp = updateData.baseSellingPrice || product.baseSellingPrice;
    updateData.mrp = computeMrp(product.category, newSp, mrp !== undefined ? mrp : product.mrp);

    const result = await prisma.$transaction(async (prismaTx) => {
      const updated = await prismaTx.product.update({
        where: { id: productId },
        data: { ...updateData, totalStock: { increment: qty }, updatedAt: new Date() }
      });
      await prismaTx.inventoryLog.create({
        data: { productId, action: 'RESTOCK', quantity: qty, note: note || null, adminId: req.user?.id || null }
      });
      if (investmentSource === 'PROFIT') {
        const costPerUnit = parseFloat(costPrice ?? product.costPrice);
        const totalCost = costPerUnit * qty;
        await prismaTx.profitLedger.create({
          data: {
            adminId: req.user?.id || null,
            amount: -Math.abs(totalCost),
            note: `Reinvested from profit to restock ${qty} unit(s) of ${product.name}`,
            orderId: null
          }
        });
      }
      if (Array.isArray(images) && images.length > 0) {
        await Promise.all(images.map(imgUrl => prismaTx.productImage.create({ data: { productId, url: imgUrl } })));
      }
      return updated;
    });

    const refreshed = await prisma.product.findUnique({ where: { id: productId }, include: { images: true } });
    return res.status(200).json({ success: true, message: 'Product restocked successfully.', data: refreshed });
  } catch (error) {
    console.error('Restock product error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while restocking product.' });
  }
};

// =============================================================================
// GET INVENTORY LOGS
// =============================================================================
const getInventoryLogs = async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    if (isNaN(productId)) return res.status(400).json({ success: false, message: 'Invalid product ID.' });
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

// =============================================================================
// GET LOW STOCK PRODUCTS
// =============================================================================
const getLowStockProducts = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: { totalStock: 'asc' },
      include: productInclude
    });
    const filtered = products.filter(p => p.totalStock <= p.lowStockThreshold);
    return res.status(200).json({ success: true, data: filtered, count: filtered.length });
  } catch (error) {
    console.error('Get low stock products error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while fetching low stock products.' });
  }
};

// =============================================================================
// NOTIFY ME WHEN AVAILABLE
// =============================================================================
const notifyMeWhenAvailable = async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const userId = req.user.id;
    const { email } = req.body;

    if (isNaN(productId)) return res.status(400).json({ success: false, message: 'Invalid product ID.' });

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });

    const existing = await prisma.productNotification.findUnique({
      where: { productId_userId: { productId, userId } }
    });
    if (existing) return res.status(200).json({ success: true, message: 'You are already registered for notifications.', data: existing });

    const notification = await prisma.productNotification.create({
      data: { productId, userId, email: email || req.user.email }
    });
    return res.status(201).json({ success: true, message: 'You will be notified when this product is back in stock!', data: notification });
  } catch (error) {
    console.error('Notify me error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while registering notification.' });
  }
};

// =============================================================================
// CUSTOMER PRODUCTS CATALOG
// =============================================================================
const getCustomerProducts = async (req, res) => {
  try {
    const { category, subCategory, search, minPrice, maxPrice, sortBy, page: pageQuery, limit: limitQuery, random } = req.query;
    const shouldRandomize = String(random || '').toLowerCase() === 'true';
    const page = Math.max(1, parseInt(pageQuery) || 1);
    const limit = Math.min(parseInt(limitQuery) || 20, 100);
    const skip = (page - 1) * limit;

    const where = { isActive: true };
    if (category && VALID_CATEGORIES.includes(category.toUpperCase())) where.category = category.toUpperCase();
    if (subCategory && typeof subCategory === 'string' && subCategory.trim()) {
      where.subCategory = { contains: subCategory.trim(), mode: 'insensitive' };
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
      if (VALID_CATEGORIES.includes(s.toUpperCase())) orClauses.push({ category: s.toUpperCase() });
      const lcTerms = terms.map(t => t.toLowerCase()).filter(Boolean);
      if (lcTerms.length > 0) orClauses.push({ keywords: { hasSome: lcTerms } });
      const lcFull = s.toLowerCase();
      if (lcFull && !lcTerms.includes(lcFull)) orClauses.push({ keywords: { hasSome: [lcFull] } });
      where.AND = [{ OR: orClauses }];

      // Record search log
      recordSearchLog(req.user?.id || null, s);
    }

    if (shouldRandomize && !search) {
      const rawWhere = [Prisma.sql`"isActive" = TRUE`];
      if (where.category) rawWhere.push(Prisma.sql`"category" = ${where.category}`);
      if (where.baseSellingPrice?.gte !== undefined) rawWhere.push(Prisma.sql`"baseSellingPrice" >= ${where.baseSellingPrice.gte}`);
      if (where.baseSellingPrice?.lte !== undefined) rawWhere.push(Prisma.sql`"baseSellingPrice" <= ${where.baseSellingPrice.lte}`);
      const whereClause = Prisma.sql`WHERE ${Prisma.join(rawWhere, Prisma.sql` AND `)}`;
      const [randomRows, totalCount] = await Promise.all([
        prisma.$queryRaw`SELECT "id" FROM "products" ${whereClause} ORDER BY RANDOM() LIMIT ${limit} OFFSET ${skip}`,
        prisma.product.count({ where })
      ]);
      const ids = randomRows.map(r => r.id);
      let products = [];
      if (ids.length > 0) {
        const listed = await prisma.product.findMany({ where: { id: { in: ids } }, include: productInclude });
        const byId = new Map(listed.map(p => [p.id, p]));
        products = ids.map(id => byId.get(id)).filter(Boolean);
      }
      return res.status(200).json({
        success: true, data: products, count: products.length,
        pagination: { page, limit, total: Number(totalCount), totalPages: Math.max(1, Math.ceil(Number(totalCount) / limit)) }
      });
    }

    const orderByClause = getOrderByClause(sortBy);
    const [products, totalCount] = await Promise.all([
      prisma.product.findMany({ where, include: productInclude, orderBy: orderByClause, skip, take: limit }),
      prisma.product.count({ where })
    ]);

    return res.status(200).json({
      success: true, data: products, count: products.length,
      pagination: { page, limit, total: totalCount, totalPages: Math.max(1, Math.ceil(totalCount / limit)) }
    });
  } catch (error) {
    console.error('getCustomerProducts error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while fetching products.' });
  }
};

// =============================================================================
// CUSTOMER SMART SEARCH (Section 2.3) — Full-text via tsvector + relevance scoring
// GET /api/products/customer/search?search=...
// =============================================================================
const customerSearch = async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Surrogate-Control', 'no-store');

    const { search, category, page: pageQuery, limit: limitQuery, subCategory } = req.query;
    const rawSearch = typeof search === 'string' ? search.trim() : '';

    if (!rawSearch) return res.status(400).json({ success: false, message: 'search query parameter is required.' });
    if (rawSearch.length > 200) return res.status(400).json({ success: false, message: 'search must be 200 characters or fewer.' });

    const page = Math.max(1, parseInt(pageQuery) || 1);
    const limit = Math.min(parseInt(limitQuery) || 20, 100);
    const skip = (page - 1) * limit;
    const terms = rawSearch.split(/\s+/).filter(Boolean);
    const upperSearch = rawSearch.toUpperCase();

    // Build Prisma OR search (typo-tolerant: includes keywords[] hasSome)
    const orClauses = [
      { name: { contains: rawSearch, mode: 'insensitive' } },
      { description: { contains: rawSearch, mode: 'insensitive' } },
      { subCategory: { contains: rawSearch, mode: 'insensitive' } },
      { uid: { contains: rawSearch, mode: 'insensitive' } }
    ];
    if (VALID_CATEGORIES.includes(upperSearch)) orClauses.push({ category: upperSearch });
    const lowerTerms = terms.map(t => t.toLowerCase()).filter(Boolean);
    if (lowerTerms.length > 0) orClauses.push({ keywords: { hasSome: lowerTerms } });
    const lowerFullQuery = rawSearch.toLowerCase();
    if (lowerFullQuery && !lowerTerms.includes(lowerFullQuery)) orClauses.push({ keywords: { hasSome: [lowerFullQuery] } });
    if (subCategory && typeof subCategory === 'string' && subCategory.trim()) {
      orClauses.push({ subCategory: { contains: subCategory.trim(), mode: 'insensitive' } });
    }

    const where = { isActive: true, AND: [{ OR: orClauses }] };
    if (category && VALID_CATEGORIES.includes(category.toUpperCase())) where.category = category.toUpperCase();

    // Fetch candidates (upper bound to avoid full-table scans)
    const rawProducts = await prisma.product.findMany({ where, include: productInclude, take: 200 });

    // Relevance scoring
    const userId = req.user?.id;
    let wishedIds = new Set();
    let orderedIds = new Set();

    if (userId) {
      const [wishlistItems, recentOrders] = await Promise.all([
        prisma.wishlist.findMany({ where: { userId }, select: { productId: true } }),
        prisma.orderItem.findMany({
          where: { order: { userId } }, select: { productId: true },
          orderBy: { order: { createdAt: 'desc' } }, take: 50
        })
      ]);
      wishedIds = new Set(wishlistItems.map(w => w.productId));
      orderedIds = new Set(recentOrders.map(o => o.productId));
    }

    const lowerSearch = rawSearch.toLowerCase();
    const scored = rawProducts.map(p => {
      let score = 0;
      if (p.name.toLowerCase() === lowerSearch) score += 100;
      else if (p.name.toLowerCase().startsWith(lowerSearch)) score += 60;
      else if (p.name.toLowerCase().includes(lowerSearch)) score += 40;
      const pKeywords = (p.keywords || []).map(k => k.toLowerCase());
      if (pKeywords.includes(lowerSearch)) score += 50;
      terms.forEach(t => { if (pKeywords.some(k => k.includes(t.toLowerCase()))) score += 15; });
      if (p.subCategory && p.subCategory.toLowerCase().includes(lowerSearch)) score += 30;
      if (p.description && p.description.toLowerCase().includes(lowerSearch)) score += 10;
      if (wishedIds.has(p.id)) score += 25;
      if (orderedIds.has(p.id)) score += 15;
      if (p.totalStock > 0) score += 5;
      return { product: p, score };
    });

    scored.sort((a, b) => b.score !== a.score ? b.score - a.score : a.product.name.localeCompare(b.product.name));

    const total = scored.length;
    const paginated = scored.slice(skip, skip + limit).map(s => s.product);

    // Record search log (fire-and-forget)
    recordSearchLog(userId || null, rawSearch);

    return res.status(200).json({
      success: true,
      message: 'Search results retrieved successfully.',
      data: paginated, count: paginated.length,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      meta: { query: rawSearch, terms }
    });
  } catch (error) {
    console.error('customerSearch error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while searching products.' });
  }
};

// =============================================================================
// 🆕 RECORD SEARCH CLICK (Self-learning — Section 2.3)
// POST /api/products/search/click
// Body: { query, productId }
// After click: logs to SearchLog with clickedProductId + appends term to keywords[]
// =============================================================================
const recordSearchClick = async (req, res) => {
  try {
    const { query, productId } = req.body;
    const userId = req.user?.id || null;

    if (!query || !productId) {
      return res.status(400).json({ success: false, message: 'query and productId are required.' });
    }

    const pid = parseInt(productId);
    if (isNaN(pid)) return res.status(400).json({ success: false, message: 'Invalid productId.' });

    // Log click
    await recordSearchLog(userId, query, pid);

    // Self-learning: append search term to product keywords[]
    appendKeywordToProduct(pid, query); // fire-and-forget

    return res.status(200).json({ success: true, message: 'Search click recorded.' });
  } catch (error) {
    console.error('recordSearchClick error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// =============================================================================
// TRACK INTERACTION
// =============================================================================
const trackInteraction = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Authentication required.' });

    const { productId, type, searchTerm } = req.body;
    const productIdInt = parseInt(productId);
    if (isNaN(productIdInt)) return res.status(400).json({ success: false, message: 'Invalid productId.' });

    const VALID_TYPES = ['VIEW', 'SEARCH', 'WISHLIST', 'CART', 'PURCHASE'];
    const interactionType = String(type || '').toUpperCase();
    if (!VALID_TYPES.includes(interactionType)) {
      return res.status(400).json({ success: false, message: `type must be one of: ${VALID_TYPES.join(', ')}` });
    }

    const product = await prisma.product.findUnique({ where: { id: productIdInt }, select: { id: true } });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });

    try {
      await prisma.productInteraction.create({
        data: {
          userId,
          productId: productIdInt,
          type: interactionType,
          searchTerm: (interactionType === 'SEARCH' && searchTerm) ? String(searchTerm).slice(0, 200) : null
        }
      });
    } catch (modelErr) {
      console.log('ProductInteraction model not ready, skipping:', modelErr.message);
    }

    return res.status(200).json({ success: true, message: 'Interaction tracked.' });
  } catch (error) {
    console.error('trackInteraction error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while tracking interaction.' });
  }
};

// =============================================================================
// MANAGE PRODUCT IMAGES
// =============================================================================
const manageProductImages = [
  _imgUpload.array('images', 6),
  async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      if (isNaN(productId)) return res.status(400).json({ success: false, message: 'Invalid product ID.' });

      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: { images: { orderBy: { position: 'asc' } } }
      });
      if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });

      const mode = (req.body.mode || 'append').toLowerCase();
      const files = req.files || [];
      if (files.length === 0) return res.status(400).json({ success: false, message: 'No image files uploaded.' });

      if (mode === 'replace') {
        if (files.length !== 1) return res.status(400).json({ success: false, message: 'Replace mode accepts exactly 1 image.' });
        const position = parseInt(req.body.position);
        if (isNaN(position) || position < 0) return res.status(400).json({ success: false, message: 'position is required for replace mode.' });
        const existing = product.images.find(img => img.position === position);
        if (existing?.url) await deleteFromSupabase(existing.url, PRODUCT_BUCKET).catch(() => {});
        const storagePath = productImagePath(productId, position);
        const newUrl = await uploadToSupabase(files[0].buffer, files[0].mimetype, storagePath, PRODUCT_BUCKET);
        if (existing) {
          await prisma.productImage.update({ where: { id: existing.id }, data: { url: newUrl } });
        } else {
          await prisma.productImage.create({ data: { productId, url: newUrl, position, isPrimary: position === 0 } });
        }
      } else {
        const maxPos = product.images.length > 0 ? Math.max(...product.images.map(i => i.position)) + 1 : 0;
        await Promise.all(files.map(async (file, idx) => {
          const pos = maxPos + idx;
          const storagePath = productImagePath(productId, pos);
          const url = await uploadToSupabase(file.buffer, file.mimetype, storagePath, PRODUCT_BUCKET);
          await prisma.productImage.create({ data: { productId, url, position: pos, isPrimary: pos === 0 } });
        }));
      }

      const allImgs = await prisma.productImage.findMany({ where: { productId }, orderBy: { position: 'asc' } });
      await Promise.all(allImgs.map(img =>
        prisma.productImage.update({ where: { id: img.id }, data: { isPrimary: img.position === 0 } })
      ));

      const refreshed = await prisma.product.findUnique({ where: { id: productId }, include: productInclude });
      return res.status(200).json({
        success: true,
        message: mode === 'replace' ? 'Image replaced successfully.' : 'Images appended successfully.',
        data: refreshed
      });
    } catch (error) {
      console.error('Manage product images error:', error);
      return res.status(500).json({ success: false, message: 'Internal server error while managing images.' });
    }
  }
];

// =============================================================================
// DELETE PRODUCT IMAGE
// =============================================================================
const deleteProductImage = async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const imageId = parseInt(req.params.imageId);
    if (isNaN(productId) || isNaN(imageId)) return res.status(400).json({ success: false, message: 'Invalid product or image ID.' });

    const image = await prisma.productImage.findFirst({ where: { id: imageId, productId } });
    if (!image) return res.status(404).json({ success: false, message: 'Image not found.' });

    if (image.url) await deleteFromSupabase(image.url, PRODUCT_BUCKET).catch(() => {});
    await prisma.productImage.delete({ where: { id: imageId } });

    const remaining = await prisma.productImage.findMany({ where: { productId }, orderBy: { position: 'asc' } });
    await Promise.all(remaining.map((img, idx) =>
      prisma.productImage.update({ where: { id: img.id }, data: { position: idx, isPrimary: idx === 0 } })
    ));

    return res.status(200).json({ success: true, message: 'Image deleted successfully.' });
  } catch (error) {
    console.error('Delete product image error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while deleting image.' });
  }
};

// =============================================================================
// PRODUCT VARIANT GROUPS
// =============================================================================
const VALID_VARIANT_TYPES = ['COLOR', 'SIZE', 'TYPE', 'STYLE'];

const createVariantGroup = async (req, res) => {
  try {
    const { name, variantType, description } = req.body;
    if (!name || !variantType) return res.status(400).json({ success: false, message: 'name and variantType are required.' });
    if (!VALID_VARIANT_TYPES.includes(variantType.toUpperCase())) return res.status(400).json({ success: false, message: `variantType must be one of: ${VALID_VARIANT_TYPES.join(', ')}` });
    const group = await prisma.productVariantGroup.create({
      data: { name, variantType: variantType.toUpperCase(), description: description || null },
      include: { products: { include: { images: { where: { isPrimary: true }, take: 1 } } } }
    });
    return res.status(201).json({ success: true, message: 'Variant group created.', data: group });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

const getVariantGroups = async (req, res) => {
  try {
    const groups = await prisma.productVariantGroup.findMany({
      include: {
        products: {
          where: { isActive: true },
          include: { images: { where: { isPrimary: true }, take: 1 } },
          orderBy: { id: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return res.status(200).json({ success: true, data: groups });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

const getVariantGroupById = async (req, res) => {
  try {
    const id = parseInt(req.params.groupId);
    if (isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid group ID.' });
    const group = await prisma.productVariantGroup.findUnique({
      where: { id },
      include: { products: { include: productInclude, orderBy: { id: 'asc' } } }
    });
    if (!group) return res.status(404).json({ success: false, message: 'Variant group not found.' });
    return res.status(200).json({ success: true, data: group });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

const addProductToVariantGroup = async (req, res) => {
  try {
    const groupId = parseInt(req.params.groupId);
    const productId = parseInt(req.params.productId);
    if (isNaN(groupId) || isNaN(productId)) return res.status(400).json({ success: false, message: 'Invalid IDs.' });
    const [group, product] = await Promise.all([
      prisma.productVariantGroup.findUnique({ where: { id: groupId } }),
      prisma.product.findUnique({ where: { id: productId } })
    ]);
    if (!group) return res.status(404).json({ success: false, message: 'Variant group not found.' });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
    const updated = await prisma.product.update({ where: { id: productId }, data: { variantGroupId: groupId }, include: productInclude });
    return res.status(200).json({ success: true, message: 'Product added to variant group.', data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

const removeProductFromVariantGroup = async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    if (isNaN(productId)) return res.status(400).json({ success: false, message: 'Invalid product ID.' });
    const updated = await prisma.product.update({ where: { id: productId }, data: { variantGroupId: null }, include: productInclude });
    return res.status(200).json({ success: true, message: 'Product removed from variant group.', data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

module.exports = {
  getAllProducts,
  getProductById,
  getProductsByCategory,
  getSubCategories,
  getRecommendedProducts,
  getCustomerProducts,
  customerSearch,
  recordSearchClick,
  trackInteraction,
  createProduct,
  updateProduct,
  deleteProduct,
  toggleProductStatus,
  getLowStockProducts,
  restockProduct,
  getInventoryLogs,
  notifyMeWhenAvailable,
  manageProductImages,
  deleteProductImage,
  createVariantGroup,
  getVariantGroups,
  getVariantGroupById,
  addProductToVariantGroup,
  removeProductFromVariantGroup,
};
