const { Prisma } = require('@prisma/client');
const prisma = require('../../../prisma/client');

/**
 * Fisher-Yates in-place shuffle — produces a different order on every call.
 */
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Compute recommended products for a user based on wishlist, cart, and order history.
 * Every call that has no interaction history — or explicitly requests random products —
 * returns a *different* random set of 20 active products, so the home page feels
 * fresh on every reload.
 *
 * @param {number} userId
 * @param {number} limit      How many products to return (default 20)
 * @param {boolean} forceRandom  Skip personalisation and return a random set
 * @returns {Promise<Array>}
 */
async function getRecommendedProductsForUser(userId, limit = 20, forceRandom = false) {

  // ── RANDOM PATH ────────────────────────────────────────────────────────────
  // Used when forceRandom=true OR when the user has no interaction history yet.
  // Pulls ALL active product IDs, shuffles them, then fetches the top `limit`.
  // This guarantees a new set on every refresh without an expensive ORDER BY RANDOM()
  // across a large table (we only ORDER BY RANDOM() on the ID column which is fast).
  const fetchRandom = async () => {
    // Use RANDOM() SQL only on the lightweight id column, then hydrate with a
    // standard findMany for the full product data + relations.
    const randomRows = await prisma.$queryRaw`
      SELECT "id"
      FROM "products"
      WHERE "isActive" = TRUE
      ORDER BY RANDOM()
      LIMIT ${limit}
    `;
    const ids = randomRows.map(r => r.id);
    if (ids.length === 0) return [];

    const products = await prisma.product.findMany({
      where: { id: { in: ids } },
      include: {
        images: { where: { isPrimary: true }, take: 1 }
      }
    });

    // Re-shuffle client-side too so the order differs from the SQL RANDOM() seed
    return shuffleArray(products);
  };

  if (forceRandom) return fetchRandom();

  // ── PERSONALISED PATH ──────────────────────────────────────────────────────
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

  wishlistItems.forEach((item, idx) => addInteraction(item.product, 35, Math.max(0, 10 - idx)));
  cartItems.forEach((item, idx) => addInteraction(item.product, 20, Math.max(0, 7 - idx)));
  orders.forEach((order, orderIdx) => {
    order.items.forEach(item => addInteraction(item.product, 10, Math.max(0, 5 - orderIdx)));
  });

  // No interaction history → return a fresh random set every time
  if (interactedProductIds.size === 0) {
    return fetchRandom();
  }

  // ── SCORE-RANKED PATH ──────────────────────────────────────────────────────
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
    take: 200
  });

  const scoredCandidates = candidates
    .filter(p => !interactedProductIds.has(p.id))
    .map(p => {
      const score =
        (categoryScores.get(p.category) || 0) +
        (p.subCategory ? (categoryScores.get(p.subCategory) || 0) : 0);
      return { product: p, score };
    })
    .sort((a, b) => b.score - a.score);

  let recommended = scoredCandidates.slice(0, limit).map(x => x.product);

  // Pad with random products if fewer than `limit` scored candidates
  if (recommended.length < limit) {
    const existingIds = [
      ...Array.from(interactedProductIds),
      ...recommended.map(p => p.id)
    ];
    const needed = limit - recommended.length;

    const fallbackRows = await prisma.$queryRaw`
      SELECT "id"
      FROM "products"
      WHERE "isActive" = TRUE
        AND "id" NOT IN (${Prisma.join(existingIds.length ? existingIds : [-1])})
      ORDER BY RANDOM()
      LIMIT ${needed}
    `;
    const fallbackIds = fallbackRows.map(r => r.id);
    if (fallbackIds.length > 0) {
      const fallback = await prisma.product.findMany({
        where: { id: { in: fallbackIds } },
        include: { images: { where: { isPrimary: true }, take: 1 } }
      });
      recommended = recommended.concat(fallback);
    }
  }

  // Light shuffle so the order feels fresh on every call even if the scored list
  // is identical (user hasn't changed wishlist / cart since last visit).
  return shuffleArray(recommended);
}

module.exports = {
  getRecommendedProductsForUser
};
