const prisma = require('../../../prisma/client');

/**
 * Compute recommended products for a user based on wishlist, cart, and order history.
 *
 * @param {number} userId
 * @param {number} limit
 * @returns {Promise<Array>} Array of product objects including primary image
 */
async function getRecommendedProductsForUser(userId, limit = 20) {
  const [wishlistItems, cartItems, orders] = await Promise.all([
    prisma.wishlist.findMany({
      where: { userId },
      include: { product: true },
      orderBy: { addedAt: 'desc' },
      take: 10
    }),
    prisma.cart.findMany({
      where: { userId },
      include: { product: true },
      orderBy: { updatedAt: 'desc' },
      take: 10
    }),
    prisma.order.findMany({
      where: { userId },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5
    })
  ]);

  const interactedProductIds = new Set();
  const categoryScores = new Map();

  const addCategoryScore = (category, score) => {
    if (!category) return;
    categoryScores.set(category, (categoryScores.get(category) || 0) + score);
  };

  const addInteraction = (product, baseScore = 1, recencyFactor = 0) => {
    if (!product || !product.id) return;
    interactedProductIds.add(product.id);
    addCategoryScore(product.category, baseScore + recencyFactor);
  };

  wishlistItems.forEach((item, idx) => {
    addInteraction(item.product, 35, Math.max(0, 10 - idx));
  });

  cartItems.forEach((item, idx) => {
    addInteraction(item.product, 20, Math.max(0, 7 - idx));
  });

  orders.forEach((order, orderIdx) => {
    order.items.forEach((item) => {
      addInteraction(item.product, 10, Math.max(0, 5 - orderIdx));
    });
  });

  // If no relevant history available, fallback to latest active products
  if (interactedProductIds.size === 0) {
    const recentProducts = await prisma.product.findMany({
      where: { isActive: true },
      include: { images: { where: { isPrimary: true }, take: 1 } },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return recentProducts;
  }

  const topCategories = Array.from(categoryScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category]) => category);

  const candidates = await prisma.product.findMany({
    where: {
      isActive: true,
      category: { in: topCategories }
    },
    include: { images: { where: { isPrimary: true }, take: 1 } },
    take: 100
  });

  const scoredCandidates = candidates
    .filter(p => !interactedProductIds.has(p.id))
    .map(p => {
      const score = (categoryScores.get(p.category) || 0) + (p.subCategory ? (categoryScores.get(p.subCategory) || 0) : 0);
      return { product: p, score };
    })
    .sort((a, b) => b.score - a.score);

  let recommendedProducts = scoredCandidates.slice(0, limit).map(x => x.product);

  if (recommendedProducts.length < limit) {
    const fallback = await prisma.product.findMany({
      where: {
        isActive: true,
        id: { notIn: Array.from(interactedProductIds) }
      },
      include: { images: { where: { isPrimary: true }, take: 1 } },
      orderBy: { createdAt: 'desc' },
      take: limit - recommendedProducts.length
    });
    recommendedProducts = recommendedProducts.concat(fallback);
  }

  return recommendedProducts;
}

module.exports = {
  getRecommendedProductsForUser
};
