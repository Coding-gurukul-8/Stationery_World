const prisma = require('../../../prisma/client');

// =============================================================================
// DATE HELPER FUNCTIONS - IST TIMEZONE (UTC+5:30)
// =============================================================================

/**
 * Get start of today in IST
 */
const getTodayStartIST = () => {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
  const istNow = new Date(now.getTime() + istOffset);
  istNow.setUTCHours(0, 0, 0, 0);
  return new Date(istNow.getTime() - istOffset); // Convert back to UTC for DB
};

/**
 * Get end of today in IST
 */
const getTodayEndIST = () => {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);
  istNow.setUTCHours(23, 59, 59, 999);
  return new Date(istNow.getTime() - istOffset);
};

/**
 * Format date based on filter type
 * @param {Date} date - Date to format
 * @param {String} filter - Filter type (daily/day, weekly/week, monthly/month, yearly/year)
 * @returns {String} - Formatted date string
 */
const formatDateByFilter = (date, filter) => {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  const filterLower = (filter || '').toLowerCase();

  if (filterLower === 'daily' || filterLower === 'day') {
    // Format: DD-MM-YYYY
    return `${day}-${month}-${year}`;
  } else if (filterLower === 'weekly' || filterLower === 'week') {
    // Format: DayName (DD-MM)
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = dayNames[d.getDay()];
    return `${dayName} (${day}-${month})`;
  } else if (filterLower === 'monthly' || filterLower === 'month') {
    // Format: DD-MM-YYYY (for individual days in month)
    return `${day}-${month}-${year}`;
  } else if (filterLower === 'yearly' || filterLower === 'year') {
    // Format: MonthName YYYY
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[d.getMonth()]} ${year}`;
  }

  return `${day}-${month}-${year}`; // Default
};

/**
 * Generate complete date range with zero-sales filling
 */
const generateDateRange = (startDate, endDate, filter) => {
  const dates = [];
  const current = new Date(startDate);
  const end = new Date(endDate);

  const filterLower = (filter || '').toLowerCase();

  if (filterLower === 'monthly' || filterLower === 'month') {
    // Generate ALL days in the month
    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
  } else if (filterLower === 'yearly' || filterLower === 'year') {
    // Generate ALL months in the year
    while (current <= end) {
      dates.push(new Date(current));
      current.setMonth(current.getMonth() + 1);
    }
  } else {
    // For daily/weekly, just fill the actual range
    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
  }

  return dates;
};

// =============================================================================
// HELPER: Get admin's product IDs
// =============================================================================
const getAdminOrderIds = async (adminId, extraWhere = {}) => {
  const orderItems = await prisma.orderItem.findMany({
    where: {
      product: { createdById: adminId },
      order: extraWhere,
    },
    select: { orderId: true },
    distinct: ['orderId'],
  });

  const ids = orderItems.map((i) => i.orderId);
  return ids.length > 0 ? ids : [-1];
};

// =============================================================================
// DASHBOARD SUMMARY - ALL 14+ METRICS IN ONE OPTIMIZED CALL
// =============================================================================
const getDashboardSummary = async (req, res) => {
  try {
    const adminId = req.user.id;
    console.log('🏠 Dashboard Summary | admin:', adminId);

    // ── Get admin's products ───────────────────────────────────────────────────
    const adminProducts = await prisma.product.findMany({
      where: { createdById: adminId, isActive: true },
      select: { id: true, totalStock: true, lowStockThreshold: true, costPrice: true },
    });

    const totalProducts = adminProducts.length;
    const adminProductIds = adminProducts.map((p) => p.id);
    const safeIds = adminProductIds.length > 0 ? adminProductIds : [-1];

    // Low stock products (using per-product threshold)
    const lowStockProducts = adminProducts.filter((p) => p.totalStock <= p.lowStockThreshold).length;

    // ── Stock Value (CP of current inventory) ──────────────────────────────────
    const stockValue = adminProducts.reduce((s, p) => s + (p.totalStock || 0) * (p.costPrice || 0), 0);

    // ── Global customer count ──────────────────────────────────────────────────
    const totalCustomers = await prisma.user.count({ 
      where: { role: 'CUSTOMER', isActive: true } 
    });

    // ── ALL orders with admin's products (not cancelled/returned) ──────────────
    const allOrderItems = await prisma.orderItem.findMany({
      where: {
        productId: { in: safeIds },
        order: { status: { notIn: ['CANCELLED', 'RETURNED'] } },
      },
      select: { orderId: true },
      distinct: ['orderId'],
    });
    const totalOrders = allOrderItems.length;

    // ── Pending orders (PENDING + CONFIRMED + PROCESSING + SHIPPED) ────────────
    const pendingOrderItems = await prisma.orderItem.findMany({
      where: {
        productId: { in: safeIds },
        order: { status: { in: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED'] } },
      },
      select: { orderId: true },
      distinct: ['orderId'],
    });
    const pendingOrders = pendingOrderItems.length;

    // ── Delivered orders ───────────────────────────────────────────────────────
    const deliveredOrderItems = await prisma.orderItem.findMany({
      where: {
        productId: { in: safeIds },
        order: { status: 'DELIVERED' },
      },
      select: { orderId: true },
      distinct: ['orderId'],
    });
    const deliveredOrders = deliveredOrderItems.length;

    // ── PAID order items (for revenue & profit calculations) ───────────────────
    const paidItems = await prisma.orderItem.findMany({
      where: {
        productId: { in: safeIds },
        order: { isPaid: true, status: { notIn: ['CANCELLED', 'RETURNED'] } },
      },
      include: { 
        product: { select: { costPrice: true } },
        order: { select: { createdAt: true } }
      },
    });

    // ── Calculate ALL-TIME metrics ─────────────────────────────────────────────
    let totalRevenue = 0;
    let totalProfit = 0;
    let totalCostPrice = 0; // Total CP of sold items
    const paidOrdersCount = new Set();

    paidItems.forEach((item) => {
      if (!item.product) return;
      const itemRevenue = item.priceAtOrder * item.quantity;
      const itemCost = item.product.costPrice * item.quantity;
      
      totalRevenue += itemRevenue;
      totalProfit += itemRevenue - itemCost;
      totalCostPrice += itemCost;
      paidOrdersCount.add(item.orderId);
    });

    // ── Calculate TODAY's metrics (IST timezone) ───────────────────────────────
    const todayStart = getTodayStartIST();
    const todayEnd = getTodayEndIST();

    let todayRevenue = 0;
    let todayProfit = 0;
    const todayOrdersSet = new Set();

    paidItems.forEach((item) => {
      if (!item.product || !item.order) return;
      
      const orderDate = new Date(item.order.createdAt);
      if (orderDate >= todayStart && orderDate <= todayEnd) {
        const itemRevenue = item.priceAtOrder * item.quantity;
        const itemCost = item.product.costPrice * item.quantity;
        
        todayRevenue += itemRevenue;
        todayProfit += itemRevenue - itemCost;
        todayOrdersSet.add(item.orderId);
      }
    });

    // ── Average Order Values ───────────────────────────────────────────────────
    const averageOrderValue = paidOrdersCount.size > 0 
      ? parseFloat((totalRevenue / paidOrdersCount.size).toFixed(2))
      : 0;

    const todayAverageOrderValue = todayOrdersSet.size > 0 
      ? parseFloat((todayRevenue / todayOrdersSet.size).toFixed(2))
      : 0;

    // ── Active Cash & Total Assets ─────────────────────────────────────────────
    // Active Cash = Total Profit (the money earned that can be reinvested)
    const activeCash = totalProfit;
    
    // Total Assets = Stock Value (inventory at CP) + Active Cash (profit earned)
    const totalAssets = stockValue + activeCash;

    // ── Round all monetary values ──────────────────────────────────────────────
    const roundToTwo = (num) => parseFloat(num.toFixed(2));

    const responseData = {
      // Order counts
      totalOrders,
      pendingOrders,
      deliveredOrders,
      
      // Revenue & Profit (All-time)
      totalRevenue: roundToTwo(totalRevenue),
      totalProfit: roundToTwo(totalProfit),
      averageOrderValue: roundToTwo(averageOrderValue),
      
      // Today's metrics
      todayRevenue: roundToTwo(todayRevenue),
      todayProfit: roundToTwo(todayProfit),
      todayAverageOrderValue: roundToTwo(todayAverageOrderValue),
      
      // Assets & Cash
      totalAssets: roundToTwo(totalAssets),
      activeCash: roundToTwo(activeCash), // Money that can be reinvested
      stockValue: roundToTwo(stockValue), // Inventory at cost price
      
      // Cost Price metrics
      totalCostPrice: roundToTwo(totalCostPrice), // CP of all sold items
      inventoryValue: roundToTwo(stockValue), // Same as stockValue (for backward compatibility)
      
      // Product & Customer counts
      totalProducts,
      activeProducts: totalProducts, // All fetched products are active
      lowStockProducts,
      totalCustomers,
    };

    console.log('✅ Dashboard Summary:', {
      totalOrders,
      totalRevenue: roundToTwo(totalRevenue),
      todayRevenue: roundToTwo(todayRevenue),
      totalAssets: roundToTwo(totalAssets),
      activeCash: roundToTwo(activeCash)
    });

    return res.status(200).json({
      success: true,
      message: 'Dashboard summary retrieved successfully.',
      data: responseData,
    });

  } catch (error) {
    console.error('❌ Dashboard summary error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error while fetching dashboard summary.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// SALES REPORT - WITH DATE FORMATTING & ZERO-FILLING
// =============================================================================
const getSalesReport = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { startDate, endDate, filter = 'monthly' } = req.query;

    console.log('📊 Sales Report | admin:', adminId, '| filter:', filter);

    // ── Determine date range ──────────────────────────────────────────────────
    let start, end;
    const filterLower = (filter || '').toLowerCase();

    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      // Default ranges based on filter
      const now = new Date();
      
      if (filterLower === 'daily' || filterLower === 'day') {
        start = getTodayStartIST();
        end = getTodayEndIST();
      } else if (filterLower === 'weekly' || filterLower === 'week') {
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        end = now;
      } else if (filterLower === 'monthly' || filterLower === 'month') {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      } else if (filterLower === 'yearly' || filterLower === 'year') {
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      } else {
        // Default to current month
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      }
    }

    // ── Get admin's products ───────────────────────────────────────────────────
    const adminProducts = await prisma.product.findMany({
      where: { createdById: adminId },
      select: { id: true }
    });
    const productIds = adminProducts.map(p => p.id);

    if (productIds.length === 0) {
      return res.json({
        success: true,
        message: 'No products found for this admin.',
        data: {
          summary: { totalOrders: 0, totalRevenue: 0, totalProfit: 0 },
          salesByDate: [],
          filter,
          startDate: start,
          endDate: end,
        }
      });
    }

    const safeIds = productIds.length > 0 ? productIds : [-1];

    // ── Get all order items with admin's products ──────────────────────────────
    const orderItems = await prisma.orderItem.findMany({
      where: {
        productId: { in: safeIds },
        order: {
          isPaid: true,
          status: { notIn: ['CANCELLED', 'RETURNED'] },
          createdAt: { gte: start, lte: end }
        }
      },
      include: {
        order: { select: { id: true, createdAt: true } },
        product: { select: { costPrice: true } }
      }
    });

    // ── Group by date ──────────────────────────────────────────────────────────
    const salesByDateMap = {};

    orderItems.forEach((item) => {
      if (!item.product || !item.order) return;

      const dateKey = formatDateByFilter(item.order.createdAt, filter);
      
      if (!salesByDateMap[dateKey]) {
        salesByDateMap[dateKey] = {
          date: dateKey,
          revenue: 0,
          profit: 0,
          orders: new Set()
        };
      }

      const itemRevenue = item.priceAtOrder * item.quantity;
      const itemCost = item.product.costPrice * item.quantity;

      salesByDateMap[dateKey].revenue += itemRevenue;
      salesByDateMap[dateKey].profit += itemRevenue - itemCost;
      salesByDateMap[dateKey].orders.add(item.orderId);
    });

    // ── Generate complete date range with zero-filling ─────────────────────────
    const allDates = generateDateRange(start, end, filter);
    const salesByDate = allDates.map(date => {
      const dateKey = formatDateByFilter(date, filter);
      const existingData = salesByDateMap[dateKey];

      return {
        date: dateKey,
        revenue: existingData ? parseFloat(existingData.revenue.toFixed(2)) : 0,
        profit: existingData ? parseFloat(existingData.profit.toFixed(2)) : 0,
        orders: existingData ? existingData.orders.size : 0
      };
    });

    // ── Calculate summary ──────────────────────────────────────────────────────
    const totalRevenue = salesByDate.reduce((sum, d) => sum + d.revenue, 0);
    const totalProfit = salesByDate.reduce((sum, d) => sum + d.profit, 0);
    const totalOrders = salesByDate.reduce((sum, d) => sum + d.orders, 0);

    console.log('✅ Sales Report generated:', { totalOrders, totalRevenue, totalProfit, dataPoints: salesByDate.length });

    return res.json({
      success: true,
      message: 'Sales report generated successfully.',
      data: {
        summary: {
          totalOrders,
          totalRevenue: parseFloat(totalRevenue.toFixed(2)),
          totalProfit: parseFloat(totalProfit.toFixed(2)),
          averageOrderValue: totalOrders > 0 ? parseFloat((totalRevenue / totalOrders).toFixed(2)) : 0
        },
        salesByDate,
        filter,
        startDate: start,
        endDate: end,
      }
    });

  } catch (error) {
    console.error('❌ Sales report error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error while generating sales report.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// WEEKLY STATS - FOR WEEKLY CHARTS
// =============================================================================
const getWeeklyStats = async (req, res) => {
  try {
    const adminId = req.user.id;
    console.log('📊 Weekly Stats | admin:', adminId);

    // accept optional range parameters (same semantics as other report endpoints)
    const { startDate: qsStart, endDate: qsEnd, filter } = req.query;
    let rangeStart, rangeEnd;

    if (qsStart && qsEnd) {
      rangeStart = new Date(qsStart);
      rangeEnd   = new Date(qsEnd);
    } else {
      // default to last 7 days including today
      const now = new Date();
      rangeEnd = new Date(now);
      rangeEnd.setHours(23, 59, 59, 999);
      rangeStart = new Date(now);
      rangeStart.setDate(now.getDate() - 6);
      rangeStart.setHours(0, 0, 0, 0);
    }

    // ensure start <= end
    if (rangeEnd < rangeStart) {
      const tmp = rangeStart;
      rangeStart = rangeEnd;
      rangeEnd = tmp;
    }

    // choose formatting filter (default weekly)
    const fmtFilter = filter || 'weekly';

    // ── Get admin's products ───────────────────────────────────────────────────
    const adminProducts = await prisma.product.findMany({
      where: { createdById: adminId },
      select: { id: true }
    });
    const productIds = adminProducts.map(p => p.id);

    if (productIds.length === 0) {
      // No products -> produce empty array spanning requested range
      const emptyData = generateDateRange(rangeStart, rangeEnd, fmtFilter).map(d => ({
        date: formatDateByFilter(d, fmtFilter),
        revenue: 0,
        orders: 0,
      }));

      return res.json({
        success: true,
        message: 'Weekly stats retrieved.',
        data: {
          weeklyRevenue: emptyData,
          weeklyOrders: emptyData,
        }
      });
    }

    const safeIds = productIds.length > 0 ? productIds : [-1];

    // ── Get order items for the requested range ───────────────────────────────
    const orderItems = await prisma.orderItem.findMany({
      where: {
        productId: { in: safeIds },
        order: {
          isPaid: true,
          status: { notIn: ['CANCELLED', 'RETURNED'] },
          createdAt: { gte: rangeStart, lte: rangeEnd }
        }
      },
      include: {
        order: { select: { id: true, createdAt: true } },
        product: { select: { costPrice: true } }
      }
    });

    // ── Group by formatted interval (day/week/month/year as requested) ───────
    const dayMap = {}; // key -> { revenue, orders:set }

    orderItems.forEach((item) => {
      if (!item.product || !item.order) return;
      const key = formatDateByFilter(item.order.createdAt, fmtFilter);
      if (!dayMap[key]) {
        dayMap[key] = { revenue: 0, orders: new Set() };
      }
      const itemRevenue = item.priceAtOrder * item.quantity;
      dayMap[key].revenue += itemRevenue;
      dayMap[key].orders.add(item.orderId);
    });

    // ── Build output sequence covering entire requested interval ─────────────
    const intervalDates = generateDateRange(rangeStart, rangeEnd, fmtFilter);
    const weeklyData = intervalDates.map((d) => {
      const dateKey = formatDateByFilter(d, fmtFilter);
      const existing = dayMap[dateKey];
      return {
        date: dateKey,
        revenue: existing ? parseFloat(existing.revenue.toFixed(2)) : 0,
        orders: existing ? existing.orders.size : 0,
      };
    });

    console.log('✅ Weekly Stats generated:', weeklyData.length, 'days');

    return res.json({
      success: true,
      message: 'Weekly stats retrieved successfully.',
      data: {
        weeklyRevenue: weeklyData,
        weeklyOrders: weeklyData,
      }
    });

  } catch (error) {
    console.error('❌ Weekly stats error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error while fetching weekly stats.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// ORDER STATUS DISTRIBUTION - FOR PIE CHART
// =============================================================================
const getOrderStatusDistribution = async (req, res) => {
  try {
    const adminId = req.user.id;
    console.log('📊 Order Status Distribution | admin:', adminId);

    // ── Get admin's products ───────────────────────────────────────────────────
    const adminProducts = await prisma.product.findMany({
      where: { createdById: adminId },
      select: { id: true }
    });
    const productIds = adminProducts.map(p => p.id);

    if (productIds.length === 0) {
      return res.json({
        success: true,
        message: 'No products found.',
        data: []
      });
    }

    const safeIds = productIds.length > 0 ? productIds : [-1];

    // ── Get all orders with admin's products ───────────────────────────────────
    const orderItems = await prisma.orderItem.findMany({
      where: {
        productId: { in: safeIds }
      },
      select: {
        orderId: true,
        order: {
          select: {
            id: true,
            status: true
          }
        }
      },
      distinct: ['orderId']
    });

    // ── Count by status ────────────────────────────────────────────────────────
    const statusCounts = {
      PENDING: 0,
      PROCESSING: 0,
      CONFIRMED: 0,
      PAID: 0,
      SHIPPED: 0,
      DELIVERED: 0,
      CANCELLED: 0,
      RETURN_REQUESTED: 0,
      RETURNED: 0
    };

    orderItems.forEach((item) => {
      if (item.order && item.order.status) {
        statusCounts[item.order.status] = (statusCounts[item.order.status] || 0) + 1;
      }
    });

    // ── Format for pie chart ───────────────────────────────────────────────────
    const distribution = Object.entries(statusCounts)
      .filter(([status, count]) => count > 0) // Only include statuses with orders
      .map(([status, count]) => ({
        status,
        count,
        percentage: parseFloat(((count / orderItems.length) * 100).toFixed(2))
      }));

    console.log('✅ Order Status Distribution:', distribution.length, 'statuses');

    return res.json({
      success: true,
      message: 'Order status distribution retrieved successfully.',
      data: distribution
    });

  } catch (error) {
    console.error('❌ Order status distribution error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error while fetching order status distribution.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =============================================================================
// KEEP EXISTING FUNCTIONS
// =============================================================================

const getRevenueReport = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { startDate, endDate, period } = req.query;

    console.log('📊 Revenue Report | admin:', adminId, '| query:', req.query);

    const orderFilter = {
      isPaid: true,
      status: { notIn: ['CANCELLED', 'RETURNED'] },
    };

    // Apply date range / period
    if (startDate || endDate) {
      orderFilter.createdAt = {};
      if (startDate) orderFilter.createdAt.gte = new Date(startDate);
      if (endDate)   orderFilter.createdAt.lte = new Date(endDate);
    } else if (period === 'monthly') {
      const now   = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      orderFilter.createdAt = { gte: start, lte: end };
    }

    const orderIds = await getAdminOrderIds(adminId, orderFilter);

    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds } },
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
        payment: true
      },
    });

    // ── Category breakdown ─────────────────────────────────────────────────────
    const revenueByCategory = {
      STATIONERY: { revenue: 0, orders: new Set(), profit: 0 },
      BOOKS:      { revenue: 0, orders: new Set(), profit: 0 },
      TOYS:       { revenue: 0, orders: new Set(), profit: 0 },
    };

    let totalRevenue = 0;

    // ── Day-grouped revenue (used for charting regardless of period) ────────
    const revenueByDay = {}; // key will be yyyy-mm-dd string

    orders.forEach((order) => {
      const dateKey = new Date(order.createdAt).toISOString().slice(0, 10);
      let dayRevenue = 0;

      order.items.forEach((item) => {
        if (!item.product || item.product.createdById !== adminId) return;

        const itemRevenue = item.priceAtOrder * item.quantity;
        const itemProfit  = (item.priceAtOrder - item.product.costPrice) * item.quantity;

        totalRevenue += itemRevenue;
        dayRevenue   += itemRevenue;

        const cat = item.product.category;
        if (revenueByCategory[cat]) {
          revenueByCategory[cat].revenue += itemRevenue;
          revenueByCategory[cat].profit  += itemProfit;
          revenueByCategory[cat].orders.add(order.id);
        }
      });

      if (dayRevenue > 0) {
        if (!revenueByDay[dateKey]) revenueByDay[dateKey] = { date: dateKey, totalRevenue: 0, orderCount: 0 };
        revenueByDay[dateKey].totalRevenue += dayRevenue;
        revenueByDay[dateKey].orderCount   += 1;
      }
    });

    // Convert Sets → counts
    Object.keys(revenueByCategory).forEach((cat) => {
      revenueByCategory[cat].orders = revenueByCategory[cat].orders.size;
    });

    // sort day array for output
    const dayArray = Object.values(revenueByDay).sort((a, b) => new Date(a.date) - new Date(b.date));

    // if caller only wants daily breakdown (any period) or range specified return it
    if (period || startDate || endDate) {
      return res.status(200).json({
        success: true,
        message: 'Revenue report generated.',
        data: {
          totalRevenue,
          revenueByCategory,
          revenueByDay: dayArray
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Revenue report generated.',
      data: { totalRevenue, revenueByCategory },
    });
  } catch (error) {
    console.error('Revenue report error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error while generating revenue report.' });
  }
};

const getInventoryReport = async (req, res) => {
  try {
    console.log('📦 Inventory Report');

    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: {
        images:    { where: { isPrimary: true }, take: 1 },
        createdBy: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    const byCategory = {
      STATIONERY: { total: 0, lowStock: 0, outOfStock: 0, totalValue: 0 },
      BOOKS:      { total: 0, lowStock: 0, outOfStock: 0, totalValue: 0 },
      TOYS:       { total: 0, lowStock: 0, outOfStock: 0, totalValue: 0 },
    };

    products.forEach((p) => {
      const c = p.category;
      if (byCategory[c]) {
        byCategory[c].total      += 1;
        byCategory[c].totalValue += (p.totalStock || 0) * (p.costPrice || 0);
        if (p.totalStock <= p.lowStockThreshold) byCategory[c].lowStock    += 1;
        if (p.totalStock === 0)                  byCategory[c].outOfStock  += 1;
      }
    });

    const lowStockProducts    = products.filter((p) => p.totalStock <= p.lowStockThreshold);
    const outOfStockProducts  = products.filter((p) => p.totalStock === 0);
    const totalInventoryValue = products.reduce((s, p) => s + (p.totalStock || 0) * (p.costPrice || 0), 0);

    return res.status(200).json({
      success: true,
      message: 'Inventory report generated.',
      data: {
        summary: {
          totalProducts:     products.length,
          lowStockCount:     lowStockProducts.length,
          outOfStockCount:   outOfStockProducts.length,
          totalInventoryValue,
        },
        byCategory,
        lowStockProducts: lowStockProducts.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          stock: p.totalStock,
          threshold: p.lowStockThreshold,
          image: p.images[0]?.url || null,
        })),
        outOfStockProducts: outOfStockProducts.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          image: p.images[0]?.url || null,
        })),
      },
    });
  } catch (error) {
    console.error('Inventory report error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error while generating inventory report.' });
  }
};

const getTopProducts = async (req, res) => {
  try {
    const adminId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;

    console.log('📊 Top Products | admin:', adminId, '| limit:', limit);

    const adminProducts = await prisma.product.findMany({
      where: { createdById: adminId },
      select: { id: true }
    });
    const productIds = adminProducts.map(p => p.id);

    if (productIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const orderItems = await prisma.orderItem.findMany({
      where: {
        productId: { in: productIds },
        order: { isPaid: true }
      },
      include: {
        product: {
          include: {
            images: { where: { isPrimary: true }, take: 1 }
          }
        }
      }
    });

    const productStats = {};
    orderItems.forEach(item => {
      const pid = item.productId;
      if (!productStats[pid]) {
        productStats[pid] = {
          product: item.product,
          qtySold: 0,
          revenue: 0,
          orders: 0
        };
      }
      productStats[pid].qtySold += item.quantity;
      productStats[pid].revenue += item.priceAtOrder * item.quantity;
      productStats[pid].orders += 1;
    });

    const topProducts = Object.values(productStats)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);

    return res.json({ success: true, data: topProducts });
    
  } catch (error) {
    console.error('Top products error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

const getCategoryPerformance = async (req, res) => {
  try {
    const adminId = req.user.id;
    console.log('📊 Category Performance | admin:', adminId);

    const adminProducts = await prisma.product.findMany({
      where: { createdById: adminId },
      select: { id: true }
    });
    const productIds = adminProducts.map(p => p.id);

    if (productIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // include date filtering if supplied
    const orderItemWhere = {
      productId: { in: productIds },
      order: { isPaid: true }
    };
    if (req.query.startDate || req.query.endDate) {
      orderItemWhere.order = orderItemWhere.order || {};
      if (req.query.startDate) orderItemWhere.order.createdAt = { gte: new Date(req.query.startDate) };
      if (req.query.endDate) {
        orderItemWhere.order.createdAt = orderItemWhere.order.createdAt || {};
        orderItemWhere.order.createdAt.lte = new Date(req.query.endDate);
      }
    }

    const orderItems = await prisma.orderItem.findMany({
      where: orderItemWhere,
      include: {
        product: true,
        order: true
      }
    });

    const categoryStats = {};
    orderItems.forEach(item => {
      const category = item.product.category;
      if (!categoryStats[category]) {
        categoryStats[category] = {
          category,
          orders: 0,
          revenue: 0,
          profit: 0,
          quantity: 0
        };
      }

      const itemRevenue = item.priceAtOrder * item.quantity;
      const itemCost = item.product.costPrice * item.quantity;

      categoryStats[category].orders += 1;
      categoryStats[category].revenue += itemRevenue;
      categoryStats[category].profit += (itemRevenue - itemCost);
      categoryStats[category].quantity += item.quantity;
    });

    const data = Object.values(categoryStats).sort((a, b) => b.revenue - a.revenue);

    return res.json({ success: true, data });
    
  } catch (error) {
    console.error('Category performance error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

const getProductDemand = async (req, res) => {
  try {
    console.log('📣 Product Demand');

    const notifications = await prisma.productNotification.groupBy({
      by:      ['productId'],
      _count:  { userId: true },
      orderBy: { _count: { userId: 'desc' } },
      take:    20,
    });

    const demandData = await Promise.all(
      notifications.map(async (item) => {
        const product = await prisma.product.findUnique({
          where:   { id: item.productId },
          include: {
            images:    { where: { isPrimary: true }, take: 1 },
            createdBy: { select: { id: true, name: true, email: true, role: true } },
          },
        });
        return {
          productId:    item.productId,
          product,
          requestCount: item._count.userId,
          isInStock:    product ? product.totalStock > 0 : false,
        };
      })
    );

    return res.status(200).json({ success: true, message: 'Product demand data retrieved.', data: demandData });
  } catch (error) {
    console.error('Product demand error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error while fetching product demand.' });
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
};