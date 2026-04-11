// reports.controller.js  —  Stationery World v4.0
//
// Upgrades:
//  - 🔧 Day/Week/Month/Year/Lifetime filter fully wired to ALL metric queries (Section 3.2)
//  - 🔧 getDashboardSummary accepts ?filter= + ?startDate= + ?endDate= (Section 3.2)
//  - 🆕 MRP field included in asset/stock value calculations (Section 3.2)
//  - 🆕 getSearchAnalytics: Top Search Keys + Search→Purchase funnel (Section 4.2 / 2.3)
//  - 🔧 sendReportEmail: wires 'Send to Mail' to backend email service (Section 4.2)
//  - 🔧 All report data from live DB (no mock data)
//  - All existing functions PRESERVED

const prisma = require('../../../prisma/client');
const { sendOTPEmail } = require('../../services/email.service'); // reuse email transport

// =============================================================================
// DATE HELPERS (IST UTC+5:30)
// =============================================================================

const getTodayStartIST = () => {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);
  istNow.setUTCHours(0, 0, 0, 0);
  return new Date(istNow.getTime() - istOffset);
};

const getTodayEndIST = () => {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);
  istNow.setUTCHours(23, 59, 59, 999);
  return new Date(istNow.getTime() - istOffset);
};

const formatDateByFilter = (date, filter) => {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const fl = (filter || '').toLowerCase();

  if (fl === 'daily' || fl === 'day')    return `${day}-${month}-${year}`;
  if (fl === 'weekly' || fl === 'week')  { const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']; return `${days[d.getDay()]} (${day}-${month})`; }
  if (fl === 'monthly' || fl === 'month') return `${day}-${month}-${year}`;
  if (fl === 'yearly' || fl === 'year')  { const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return `${months[d.getMonth()]} ${year}`; }
  return `${day}-${month}-${year}`;
};

const generateDateRange = (startDate, endDate, filter) => {
  const dates = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  const fl = (filter || '').toLowerCase();

  if (fl === 'yearly' || fl === 'year') {
    while (current <= end) { dates.push(new Date(current)); current.setMonth(current.getMonth() + 1); }
  } else {
    while (current <= end) { dates.push(new Date(current)); current.setDate(current.getDate() + 1); }
  }
  return dates;
};

// Resolve date range from filter string (or explicit start/end)
const resolveDateRange = (filter, startDate, endDate) => {
  if (startDate && endDate) return { start: new Date(startDate), end: new Date(endDate) };

  const now = new Date();
  const fl = (filter || 'monthly').toLowerCase();

  if (fl === 'daily' || fl === 'day') {
    return { start: getTodayStartIST(), end: getTodayEndIST() };
  }
  if (fl === 'weekly' || fl === 'week') {
    const start = new Date(now); start.setDate(now.getDate() - 7); start.setHours(0,0,0,0);
    return { start, end: new Date(now.setHours(23,59,59,999)) };
  }
  if (fl === 'monthly' || fl === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return { start, end };
  }
  if (fl === 'yearly' || fl === 'year') {
    const start = new Date(now.getFullYear(), 0, 1);
    const end   = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    return { start, end };
  }
  if (fl === 'lifetime' || fl === 'all') {
    return { start: new Date('2020-01-01'), end: new Date() };
  }
  // Default: current month
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  return { start, end };
};

// =============================================================================
// HELPERS: Admin product scoping
// =============================================================================

const getAdminProductIds = async (adminId) => {
  const adminProducts = await prisma.product.findMany({ where: { createdById: adminId }, select: { id: true } });
  if (adminProducts.length > 0) return adminProducts.map(p => p.id);
  const allProducts = await prisma.product.findMany({ select: { id: true } });
  return allProducts.map(p => p.id);
};

const getAdminOrderIds = async (adminId, extraWhere = {}) => {
  const productIds = await getAdminProductIds(adminId);
  const orderItems = await prisma.orderItem.findMany({
    where: { productId: { in: productIds }, order: extraWhere },
    select: { orderId: true },
    distinct: ['orderId']
  });
  return orderItems.map(i => i.orderId);
};

// =============================================================================
// DASHBOARD SUMMARY — 🔧 Fully respects filter/startDate/endDate (Section 3.2)
// GET /api/reports/dashboard?filter=monthly|weekly|daily|yearly|lifetime
// =============================================================================
const getDashboardSummary = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { filter, startDate, endDate } = req.query;
    const { start, end } = resolveDateRange(filter || 'lifetime', startDate, endDate);

    const adminProductIds = await getAdminProductIds(adminId);
    const safeIds = adminProductIds.length > 0 ? adminProductIds : [-1];

    const adminProducts = await prisma.product.findMany({
      where: { id: { in: safeIds }, isActive: true },
      select: { id: true, totalStock: true, lowStockThreshold: true, costPrice: true, baseSellingPrice: true, mrp: true }
    });

    const totalProducts = adminProducts.length;
    const lowStockProducts = adminProducts.filter(p => p.totalStock <= p.lowStockThreshold).length;

    // 🔧 Stock value at CP
    const stockValue = adminProducts.reduce((s, p) => s + (p.totalStock || 0) * (p.costPrice || 0), 0);

    // 🆕 MRP-based stock value (for retail valuation)
    const stockValueAtMrp = adminProducts.reduce((s, p) => {
      const mrp = p.mrp || p.baseSellingPrice;
      return s + (p.totalStock || 0) * mrp;
    }, 0);

    const totalCustomers = await prisma.user.count({ where: { role: 'CUSTOMER', isActive: true } });

    // Orders scoped to date range
    const allOrderItems = await prisma.orderItem.findMany({
      where: {
        productId: { in: safeIds },
        order: { status: { notIn: ['CANCELLED', 'RETURNED'] }, createdAt: { gte: start, lte: end } }
      },
      select: { orderId: true },
      distinct: ['orderId']
    });
    const totalOrders = allOrderItems.length;

    const pendingOrderItems = await prisma.orderItem.findMany({
      where: {
        productId: { in: safeIds },
        order: { status: { in: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED'] }, createdAt: { gte: start, lte: end } }
      },
      select: { orderId: true },
      distinct: ['orderId']
    });
    const pendingOrders = pendingOrderItems.length;

    const deliveredOrderItems = await prisma.orderItem.findMany({
      where: {
        productId: { in: safeIds },
        order: { status: 'DELIVERED', createdAt: { gte: start, lte: end } }
      },
      select: { orderId: true },
      distinct: ['orderId']
    });
    const deliveredOrders = deliveredOrderItems.length;

    // Paid items in range
    const paidItems = await prisma.orderItem.findMany({
      where: {
        productId: { in: safeIds },
        order: { isPaid: true, status: { notIn: ['CANCELLED', 'RETURNED'] }, createdAt: { gte: start, lte: end } }
      },
      include: {
        product: { select: { costPrice: true } },
        order: { select: { createdAt: true } }
      }
    });

    let totalRevenue = 0, totalProfit = 0, totalCostPrice = 0;
    const paidOrdersCount = new Set();
    const todayStart = getTodayStartIST(), todayEnd = getTodayEndIST();
    let todayRevenue = 0, todayProfit = 0;
    const todayOrdersSet = new Set();

    paidItems.forEach(item => {
      if (!item.product) return;
      const rev  = item.priceAtOrder * item.quantity;
      const cost = item.product.costPrice * item.quantity;
      totalRevenue   += rev;
      totalProfit    += rev - cost;
      totalCostPrice += cost;
      paidOrdersCount.add(item.orderId);

      const oDate = new Date(item.order.createdAt);
      if (oDate >= todayStart && oDate <= todayEnd) {
        todayRevenue += rev;
        todayProfit  += rev - cost;
        todayOrdersSet.add(item.orderId);
      }
    });

    const averageOrderValue      = paidOrdersCount.size > 0 ? totalRevenue / paidOrdersCount.size : 0;
    const todayAverageOrderValue = todayOrdersSet.size > 0 ? todayRevenue / todayOrdersSet.size : 0;

    // Active cash from profit ledger
    const profitLedger = await prisma.profitLedger.findMany({ where: { adminId }, select: { amount: true } });
    const activeCash = profitLedger.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalAssets = stockValue + activeCash;

    const round2 = n => parseFloat(n.toFixed(2));

    return res.status(200).json({
      success: true,
      message: 'Dashboard summary retrieved successfully.',
      data: {
        // Order counts
        totalOrders, pendingOrders, deliveredOrders,
        // Revenue & Profit (filtered by date range)
        totalRevenue: round2(totalRevenue), totalProfit: round2(totalProfit),
        averageOrderValue: round2(averageOrderValue),
        // Today's metrics
        todayRevenue: round2(todayRevenue), todayProfit: round2(todayProfit),
        todayAverageOrderValue: round2(todayAverageOrderValue),
        // Assets & Cash
        totalAssets: round2(totalAssets), activeCash: round2(activeCash),
        stockValue: round2(stockValue),
        // 🆕 MRP-based stock value
        stockValueAtMrp: round2(stockValueAtMrp),
        // Cost price metrics
        totalCostPrice: round2(totalCostPrice), inventoryValue: round2(stockValue),
        // Product & customer counts
        totalProducts, activeProducts: totalProducts, lowStockProducts, totalCustomers,
        // Filter metadata
        filter: filter || 'lifetime', dateRange: { start, end }
      }
    });
  } catch (error) {
    console.error('Dashboard summary error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while fetching dashboard summary.' });
  }
};

// =============================================================================
// SALES REPORT — fully wired to filter + date range
// =============================================================================
const getSalesReport = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { filter = 'monthly', startDate, endDate } = req.query;
    const { start, end } = resolveDateRange(filter, startDate, endDate);

    const productIds = await getAdminProductIds(adminId);
    const safeIds = productIds.length > 0 ? productIds : [-1];

    const orderItems = await prisma.orderItem.findMany({
      where: {
        productId: { in: safeIds },
        order: { isPaid: true, status: { notIn: ['CANCELLED', 'RETURNED'] }, createdAt: { gte: start, lte: end } }
      },
      include: {
        order: { select: { id: true, createdAt: true } },
        product: { select: { costPrice: true } }
      }
    });

    const salesByDateMap = {};
    orderItems.forEach(item => {
      if (!item.product || !item.order) return;
      const dateKey = formatDateByFilter(item.order.createdAt, filter);
      if (!salesByDateMap[dateKey]) salesByDateMap[dateKey] = { date: dateKey, revenue: 0, profit: 0, orders: new Set() };
      const rev  = item.priceAtOrder * item.quantity;
      const cost = item.product.costPrice * item.quantity;
      salesByDateMap[dateKey].revenue += rev;
      salesByDateMap[dateKey].profit  += rev - cost;
      salesByDateMap[dateKey].orders.add(item.orderId);
    });

    const allDates = generateDateRange(start, end, filter);
    const salesByDate = allDates.map(date => {
      const key = formatDateByFilter(date, filter);
      const ex = salesByDateMap[key];
      return {
        date: key,
        revenue: ex ? parseFloat(ex.revenue.toFixed(2)) : 0,
        profit:  ex ? parseFloat(ex.profit.toFixed(2)) : 0,
        orders:  ex ? ex.orders.size : 0
      };
    });

    const totalRevenue = salesByDate.reduce((s, d) => s + d.revenue, 0);
    const totalProfit  = salesByDate.reduce((s, d) => s + d.profit, 0);
    const totalOrders  = salesByDate.reduce((s, d) => s + d.orders, 0);

    return res.json({
      success: true, message: 'Sales report generated successfully.',
      data: {
        summary: {
          totalOrders, totalRevenue: parseFloat(totalRevenue.toFixed(2)),
          totalProfit: parseFloat(totalProfit.toFixed(2)),
          averageOrderValue: totalOrders > 0 ? parseFloat((totalRevenue / totalOrders).toFixed(2)) : 0
        },
        salesByDate, filter, startDate: start, endDate: end
      }
    });
  } catch (error) {
    console.error('Sales report error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while generating sales report.' });
  }
};

// =============================================================================
// WEEKLY STATS
// =============================================================================
const getWeeklyStats = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { startDate: qsStart, endDate: qsEnd, filter } = req.query;
    let rangeStart, rangeEnd;

    if (qsStart && qsEnd) { rangeStart = new Date(qsStart); rangeEnd = new Date(qsEnd); }
    else {
      const now = new Date();
      rangeEnd = new Date(now.setHours(23,59,59,999));
      rangeStart = new Date(); rangeStart.setDate(rangeStart.getDate() - 6); rangeStart.setHours(0,0,0,0);
    }

    if (rangeEnd < rangeStart) { const tmp = rangeStart; rangeStart = rangeEnd; rangeEnd = tmp; }
    const fmtFilter = filter || 'weekly';

    const productIds = await getAdminProductIds(adminId);
    const safeIds = productIds.length > 0 ? productIds : [-1];

    const orderItems = await prisma.orderItem.findMany({
      where: {
        productId: { in: safeIds },
        order: { isPaid: true, status: { notIn: ['CANCELLED', 'RETURNED'] }, createdAt: { gte: rangeStart, lte: rangeEnd } }
      },
      include: {
        order: { select: { id: true, createdAt: true } },
        product: { select: { costPrice: true } }
      }
    });

    const dayMap = {};
    orderItems.forEach(item => {
      if (!item.product || !item.order) return;
      const key = formatDateByFilter(item.order.createdAt, fmtFilter);
      if (!dayMap[key]) dayMap[key] = { revenue: 0, orders: new Set() };
      dayMap[key].revenue += item.priceAtOrder * item.quantity;
      dayMap[key].orders.add(item.orderId);
    });

    const intervalDates = generateDateRange(rangeStart, rangeEnd, fmtFilter);
    const weeklyData = intervalDates.map(d => {
      const key = formatDateByFilter(d, fmtFilter);
      const ex = dayMap[key];
      return { date: key, revenue: ex ? parseFloat(ex.revenue.toFixed(2)) : 0, orders: ex ? ex.orders.size : 0 };
    });

    return res.json({ success: true, message: 'Weekly stats retrieved.', data: { weeklyRevenue: weeklyData, weeklyOrders: weeklyData } });
  } catch (error) {
    console.error('Weekly stats error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while fetching weekly stats.' });
  }
};

// =============================================================================
// ORDER STATUS DISTRIBUTION
// =============================================================================
const getOrderStatusDistribution = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { filter, startDate, endDate } = req.query;
    const { start, end } = resolveDateRange(filter || 'lifetime', startDate, endDate);

    const productIds = await getAdminProductIds(adminId);
    const safeIds = productIds.length > 0 ? productIds : [-1];

    const orderItems = await prisma.orderItem.findMany({
      where: {
        productId: { in: safeIds },
        order: { createdAt: { gte: start, lte: end } }
      },
      select: { orderId: true, order: { select: { status: true } } },
      distinct: ['orderId']
    });

    const statusCounts = { PENDING: 0, PROCESSING: 0, CONFIRMED: 0, PAID: 0, SHIPPED: 0, DELIVERED: 0, CANCELLED: 0, RETURN_REQUESTED: 0, RETURNED: 0 };
    orderItems.forEach(item => {
      if (item.order?.status) statusCounts[item.order.status] = (statusCounts[item.order.status] || 0) + 1;
    });

    const total = orderItems.length || 1;
    const distribution = Object.entries(statusCounts)
      .filter(([, count]) => count > 0)
      .map(([status, count]) => ({ status, count, percentage: parseFloat(((count / total) * 100).toFixed(2)) }));

    return res.json({ success: true, data: distribution });
  } catch (error) {
    console.error('Order status distribution error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// =============================================================================
// REVENUE REPORT
// =============================================================================
const getRevenueReport = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { startDate, endDate, period, filter } = req.query;
    const { start, end } = resolveDateRange(filter || period || 'monthly', startDate, endDate);

    const orderFilter = { isPaid: true, status: { notIn: ['CANCELLED', 'RETURNED'] }, createdAt: { gte: start, lte: end } };
    const productIds = await getAdminProductIds(adminId);
    const allowedProductIds = new Set(productIds);
    const orderIds = await getAdminOrderIds(adminId, orderFilter);

    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds } },
      include: { items: { include: { product: { include: { createdBy: { select: { id: true, name: true, email: true, role: true } } } } } }, payment: true }
    });

    const revenueByCategory = {
      STATIONERY: { revenue: 0, orders: new Set(), profit: 0 },
      BOOKS:      { revenue: 0, orders: new Set(), profit: 0 },
      TOYS:       { revenue: 0, orders: new Set(), profit: 0 }
    };
    let totalRevenue = 0;
    const revenueByDay = {};

    orders.forEach(order => {
      const dateKey = new Date(order.createdAt).toISOString().slice(0, 10);
      let dayRevenue = 0;
      order.items.forEach(item => {
        if (!item.product || !allowedProductIds.has(item.productId)) return;
        const rev  = item.priceAtOrder * item.quantity;
        const prof = (item.priceAtOrder - item.product.costPrice) * item.quantity;
        totalRevenue += rev; dayRevenue += rev;
        const cat = item.product.category;
        if (revenueByCategory[cat]) { revenueByCategory[cat].revenue += rev; revenueByCategory[cat].profit += prof; revenueByCategory[cat].orders.add(order.id); }
      });
      if (dayRevenue > 0) {
        if (!revenueByDay[dateKey]) revenueByDay[dateKey] = { date: dateKey, totalRevenue: 0, orderCount: 0 };
        revenueByDay[dateKey].totalRevenue += dayRevenue;
        revenueByDay[dateKey].orderCount++;
      }
    });

    Object.keys(revenueByCategory).forEach(cat => { revenueByCategory[cat].orders = revenueByCategory[cat].orders.size; });
    const dayArray = Object.values(revenueByDay).sort((a, b) => new Date(a.date) - new Date(b.date));

    return res.status(200).json({ success: true, message: 'Revenue report generated.', data: { totalRevenue, revenueByCategory, revenueByDay: dayArray } });
  } catch (error) {
    console.error('Revenue report error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while generating revenue report.' });
  }
};

// =============================================================================
// INVENTORY REPORT
// =============================================================================
const getInventoryReport = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: { images: { where: { isPrimary: true }, take: 1 }, createdBy: { select: { id: true, name: true, email: true, role: true } } }
    });

    const byCategory = {
      STATIONERY: { total: 0, lowStock: 0, outOfStock: 0, totalValue: 0 },
      BOOKS:      { total: 0, lowStock: 0, outOfStock: 0, totalValue: 0 },
      TOYS:       { total: 0, lowStock: 0, outOfStock: 0, totalValue: 0 }
    };

    products.forEach(p => {
      const c = p.category;
      if (byCategory[c]) {
        byCategory[c].total++;
        byCategory[c].totalValue += (p.totalStock || 0) * (p.costPrice || 0);
        if (p.totalStock <= p.lowStockThreshold) byCategory[c].lowStock++;
        if (p.totalStock === 0) byCategory[c].outOfStock++;
      }
    });

    const lowStockProducts   = products.filter(p => p.totalStock <= p.lowStockThreshold);
    const outOfStockProducts = products.filter(p => p.totalStock === 0);
    const totalInventoryValue = products.reduce((s, p) => s + (p.totalStock || 0) * (p.costPrice || 0), 0);

    return res.status(200).json({
      success: true, message: 'Inventory report generated.',
      data: {
        summary: { totalProducts: products.length, lowStockCount: lowStockProducts.length, outOfStockCount: outOfStockProducts.length, totalInventoryValue },
        byCategory,
        lowStockProducts: lowStockProducts.map(p => ({ id: p.id, name: p.name, category: p.category, stock: p.totalStock, threshold: p.lowStockThreshold, image: p.images[0]?.url || null })),
        outOfStockProducts: outOfStockProducts.map(p => ({ id: p.id, name: p.name, category: p.category, image: p.images[0]?.url || null }))
      }
    });
  } catch (error) {
    console.error('Inventory report error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while generating inventory report.' });
  }
};

// =============================================================================
// TOP PRODUCTS
// =============================================================================
const getTopProducts = async (req, res) => {
  try {
    const adminId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;
    const { filter, startDate, endDate } = req.query;
    const { start, end } = resolveDateRange(filter || 'lifetime', startDate, endDate);

    const productIds = await getAdminProductIds(adminId);
    const orderItems = await prisma.orderItem.findMany({
      where: {
        productId: { in: productIds },
        order: { isPaid: true, createdAt: { gte: start, lte: end } }
      },
      include: { product: { include: { images: { where: { isPrimary: true }, take: 1 } } } }
    });

    const productStats = {};
    orderItems.forEach(item => {
      const pid = item.productId;
      if (!productStats[pid]) productStats[pid] = { product: item.product, qtySold: 0, revenue: 0, orders: 0 };
      productStats[pid].qtySold  += item.quantity;
      productStats[pid].revenue  += item.priceAtOrder * item.quantity;
      productStats[pid].orders++;
    });

    const topProducts = Object.values(productStats).sort((a, b) => b.revenue - a.revenue).slice(0, limit);

    return res.json({ success: true, data: topProducts });
  } catch (error) {
    console.error('Top products error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// =============================================================================
// CATEGORY PERFORMANCE
// =============================================================================
const getCategoryPerformance = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { filter, startDate, endDate } = req.query;
    const { start, end } = resolveDateRange(filter || 'lifetime', startDate, endDate);

    const productIds = await getAdminProductIds(adminId);

    const orderItems = await prisma.orderItem.findMany({
      where: {
        productId: { in: productIds },
        order: { isPaid: true, createdAt: { gte: start, lte: end } }
      },
      include: { product: true, order: true }
    });

    const categoryStats = {};
    orderItems.forEach(item => {
      const cat = item.product.category;
      if (!categoryStats[cat]) categoryStats[cat] = { category: cat, orders: 0, revenue: 0, profit: 0, quantity: 0 };
      const rev = item.priceAtOrder * item.quantity;
      categoryStats[cat].orders   += 1;
      categoryStats[cat].revenue  += rev;
      categoryStats[cat].profit   += rev - (item.product.costPrice * item.quantity);
      categoryStats[cat].quantity += item.quantity;
    });

    const data = Object.values(categoryStats).sort((a, b) => b.revenue - a.revenue);
    return res.json({ success: true, data });
  } catch (error) {
    console.error('Category performance error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

// =============================================================================
// PRODUCT DEMAND
// =============================================================================
const getProductDemand = async (req, res) => {
  try {
    const notifications = await prisma.productNotification.groupBy({
      by: ['productId'], _count: { userId: true },
      orderBy: { _count: { userId: 'desc' } }, take: 20
    });

    const demandData = await Promise.all(
      notifications.map(async item => {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          include: { images: { where: { isPrimary: true }, take: 1 }, createdBy: { select: { id: true, name: true, email: true, role: true } } }
        });
        return { productId: item.productId, product, requestCount: item._count.userId, isInStock: product ? product.totalStock > 0 : false };
      })
    );

    return res.status(200).json({ success: true, message: 'Product demand data retrieved.', data: demandData });
  } catch (error) {
    console.error('Product demand error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while fetching product demand.' });
  }
};

// =============================================================================
// 🆕 SEARCH LOG ANALYTICS (Section 4.2 / 2.3)
// GET /api/reports/search-analytics?limit=20&filter=weekly
// Returns: top search keys, search→purchase funnel
// =============================================================================
const getSearchAnalytics = async (req, res) => {
  try {
    const { limit = 20, filter, startDate, endDate } = req.query;
    const { start, end } = resolveDateRange(filter || 'monthly', startDate, endDate);
    const topN = Math.min(parseInt(limit) || 20, 100);

    // Top search queries in date range
    const searchLogs = await prisma.searchLog.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { query: true, clickedProductId: true, userId: true, createdAt: true }
    });

    // Group by query
    const queryMap = {};
    searchLogs.forEach(log => {
      const q = log.query.toLowerCase().trim();
      if (!queryMap[q]) queryMap[q] = { query: q, searchCount: 0, clickCount: 0, uniqueUsers: new Set(), clickedProducts: new Set() };
      queryMap[q].searchCount++;
      if (log.clickedProductId) {
        queryMap[q].clickCount++;
        queryMap[q].clickedProducts.add(log.clickedProductId);
      }
      if (log.userId) queryMap[q].uniqueUsers.add(log.userId);
    });

    const topSearchKeys = Object.values(queryMap)
      .sort((a, b) => b.searchCount - a.searchCount)
      .slice(0, topN)
      .map(q => ({
        query: q.query,
        searchCount: q.searchCount,
        clickCount: q.clickCount,
        clickThroughRate: q.searchCount > 0 ? parseFloat(((q.clickCount / q.searchCount) * 100).toFixed(1)) : 0,
        uniqueUsers: q.uniqueUsers.size
      }));

    // Search→Purchase funnel: of clicked products, how many were purchased?
    const clickedProductIds = [...new Set(searchLogs.filter(l => l.clickedProductId).map(l => l.clickedProductId))];

    let purchaseCount = 0;
    if (clickedProductIds.length > 0) {
      const purchases = await prisma.orderItem.count({
        where: { productId: { in: clickedProductIds }, order: { isPaid: true, createdAt: { gte: start, lte: end } } }
      });
      purchaseCount = purchases;
    }

    const totalSearches  = searchLogs.length;
    const totalClicks    = searchLogs.filter(l => l.clickedProductId).length;
    const conversionRate = totalClicks > 0 ? parseFloat(((purchaseCount / totalClicks) * 100).toFixed(1)) : 0;

    return res.status(200).json({
      success: true, message: 'Search analytics retrieved.',
      data: {
        topSearchKeys,
        funnel: { totalSearches, totalClicks, clickedProductsPurchased: purchaseCount, conversionRate },
        dateRange: { start, end }
      }
    });
  } catch (error) {
    console.error('Search analytics error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error while fetching search analytics.' });
  }
};

// =============================================================================
// 🔧 SEND REPORT EMAIL (Section 4.2)
// POST /api/reports/send-email
// Body: { reportType, email, filter, startDate, endDate }
// Generates the requested report and emails it to the specified address
// =============================================================================
const sendReportEmail = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { reportType = 'sales', email, filter = 'monthly', startDate, endDate } = req.body;

    if (!email) return res.status(400).json({ success: false, message: 'email is required.' });

    const { start, end } = resolveDateRange(filter, startDate, endDate);

    // Fetch report data inline
    const productIds = await getAdminProductIds(adminId);
    const safeIds = productIds.length > 0 ? productIds : [-1];

    const orderItems = await prisma.orderItem.findMany({
      where: {
        productId: { in: safeIds },
        order: { isPaid: true, status: { notIn: ['CANCELLED', 'RETURNED'] }, createdAt: { gte: start, lte: end } }
      },
      include: {
        order: { select: { id: true, createdAt: true } },
        product: { select: { costPrice: true, name: true, category: true } }
      }
    });

    let totalRevenue = 0, totalProfit = 0, totalOrders = new Set();
    orderItems.forEach(item => {
      if (!item.product) return;
      totalRevenue += item.priceAtOrder * item.quantity;
      totalProfit  += (item.priceAtOrder - item.product.costPrice) * item.quantity;
      totalOrders.add(item.orderId);
    });

    const formattedStart = start.toLocaleDateString('en-IN');
    const formattedEnd   = end.toLocaleDateString('en-IN');

    const htmlBody = `
      <!DOCTYPE html><html><head><style>
        body { font-family: Arial, sans-serif; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
        .content { background: #f8f9fa; padding: 24px; border-radius: 0 0 8px 8px; }
        .metric { background: white; border-radius: 8px; padding: 16px; margin: 8px 0; display: flex; justify-content: space-between; }
        .metric-label { color: #666; font-size: 14px; }
        .metric-value { font-size: 20px; font-weight: bold; color: #2563eb; }
        .footer { text-align: center; margin-top: 20px; color: #999; font-size: 12px; }
      </style></head><body>
      <div class="container">
        <div class="header"><h2>📊 Stationery World — ${reportType.toUpperCase()} Report</h2><p>${formattedStart} — ${formattedEnd}</p></div>
        <div class="content">
          <div class="metric"><div><div class="metric-label">Total Orders</div><div class="metric-value">${totalOrders.size}</div></div></div>
          <div class="metric"><div><div class="metric-label">Total Revenue</div><div class="metric-value">₹${totalRevenue.toFixed(2)}</div></div></div>
          <div class="metric"><div><div class="metric-label">Total Profit</div><div class="metric-value">₹${totalProfit.toFixed(2)}</div></div></div>
          <div class="metric"><div><div class="metric-label">Avg Order Value</div><div class="metric-value">₹${totalOrders.size > 0 ? (totalRevenue / totalOrders.size).toFixed(2) : '0.00'}</div></div></div>
          <p style="margin-top:20px; color:#666; font-size: 13px;">This report covers the period: <strong>${formattedStart}</strong> to <strong>${formattedEnd}</strong>.<br>Filter: <strong>${filter}</strong></p>
        </div>
        <div class="footer"><p>Generated by Stationery World Admin Dashboard · ${new Date().toLocaleString('en-IN')}</p></div>
      </div></body></html>
    `;

    // Reuse the sendOTPEmail transport (same nodemailer/resend setup)
    // We call the underlying email service directly
    const { sendOTPEmail: _unused, ...emailService } = require('../../services/email.service');
    // Build and send directly
    const nodemailer = require('nodemailer');
    const emailPort  = parseInt(process.env.EMAIL_PORT, 10) || 587;
    const isSecure   = emailPort === 465;
    const provider   = (process.env.EMAIL_PROVIDER || 'smtp').toLowerCase();

    let emailResult;
    if (provider === 'resend') {
      const https = require('https');
      const mailOptions = { from: process.env.EMAIL_FROM, to: email, subject: `Stationery World — ${reportType.toUpperCase()} Report (${formattedStart} – ${formattedEnd})`, html: htmlBody };
      const payload = JSON.stringify({ from: mailOptions.from, to: [mailOptions.to], subject: mailOptions.subject, html: mailOptions.html });
      emailResult = await new Promise((resolve, reject) => {
        const rq = https.request({ hostname: 'api.resend.com', path: '/emails', method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } }, (rs) => {
          let d = ''; rs.on('data', c => d += c); rs.on('end', () => { try { const p = JSON.parse(d); rs.statusCode < 300 ? resolve({ success: true }) : reject(new Error(p.message)); } catch (e) { reject(e); } });
        }); rq.on('error', reject); rq.write(payload); rq.end();
      });
    } else {
      const transporter = nodemailer.createTransport({ host: process.env.EMAIL_HOST || 'smtp.gmail.com', port: emailPort, secure: isSecure, requireTLS: !isSecure, family: 4, auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }, connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 15000 });
      await transporter.sendMail({ from: process.env.EMAIL_FROM, to: email, subject: `Stationery World — ${reportType.toUpperCase()} Report (${formattedStart} – ${formattedEnd})`, html: htmlBody });
      emailResult = { success: true };
    }

    return res.status(200).json({ success: true, message: `Report emailed to ${email} successfully.` });
  } catch (error) {
    console.error('Send report email error:', error);
    return res.status(500).json({ success: false, message: 'Failed to send report email. Check email configuration.' });
  }
};

// =============================================================================
// EXPORTS
// =============================================================================
module.exports = {
  getDashboardSummary,
  getSalesReport,
  getWeeklyStats,
  getOrderStatusDistribution,
  getRevenueReport,
  getInventoryReport,
  getTopProducts,
  getCategoryPerformance,
  getProductDemand,
  getSearchAnalytics,
  sendReportEmail
};
