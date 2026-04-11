// app.js  —  Stationery World v4.0
// Upgraded entry point:
//  - Version bumped to 4.0.0
//  - Search analytics route added to endpoint registry
//  - Cart /validate route in registry
//  - Reports /send-email + /search-analytics in registry
//  - All pre-existing routes preserved

require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const suppressLogs = process.env.SUPPRESS_LOGS !== 'false';
if (suppressLogs) { console.log = () => {}; }

const { testConnection } = require('./services/email.service');

// ── Import routes ─────────────────────────────────────────────────────────────
const userRoutes      = require('./modules/user/user.routes');
const productRoutes   = require('./modules/product/product.routes');
const cartRoutes      = require('./modules/cart/cart.routes');
const wishlistRoutes  = require('./modules/wishlist/wishlist.routes');
const orderRoutes     = require('./modules/order/order.routes');
const bargainRoutes   = require('./modules/bargain/bargain.routes');
const inventoryRoutes = require('./modules/inventory/inventory.routes');
const paymentRoutes   = require('./modules/payment/payment.routes');
const reportsRoutes   = require('./modules/reports/reports.routes');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  // Uncomment to debug: console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Server is running', timestamp: new Date().toISOString() });
});

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/user',      userRoutes);
app.use('/api/products',  productRoutes);
app.use('/api/cart',      cartRoutes);
app.use('/api/wishlist',  wishlistRoutes);
app.use('/api/orders',    orderRoutes);
app.use('/api/bargain',   bargainRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/payments',  paymentRoutes);
app.use('/api/reports',   reportsRoutes);

// ── Root ──────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to Stationery World API v4.0',
    version: '4.0.0',
    endpoints: {
      health: '/health',

      user: {
        signup:         'POST /api/user/signup',
        login:          'POST /api/user/login',
        forgotPassword: 'POST /api/user/forgot-password',
        verifyOTP:      'POST /api/user/verify-otp',
        resetPassword:  'POST /api/user/reset-password',
        profile:        'GET  /api/user/profile (Protected)',
        updateProfile:  'PUT  /api/user/profile (Protected)',
        getAllUsers:     'GET  /api/user/all (Admin)',
        getUserDetail:  'GET  /api/user/:id/detail (Admin) — total orders + spend'
      },

      products: {
        getAllProducts:         'GET  /api/products',
        customerCatalog:       'GET  /api/products/customer',
        customerSearch:        'GET  /api/products/customer/search',
        recordSearchClick:     'POST /api/products/search/click  ← 🆕 self-learning',
        getSubCategories:      'GET  /api/products/subcategories ← 🆕 Shop By Category',
        getRecommended:        'GET  /api/products/recommended (Protected)',
        getProductById:        'GET  /api/products/:id',
        getProductsByCategory: 'GET  /api/products/category/:category',
        createProduct:         'POST /api/products (Admin)',
        updateProduct:         'PUT  /api/products/:id (Admin)',
        deleteProduct:         'DELETE /api/products/:id (Admin)',
        toggleStatus:          'PATCH /api/products/:id/toggle-status (Admin)',
        restock:               'POST /api/products/:id/restock (Admin)',
        lowStock:              'GET  /api/products/admin/low-stock (Admin)',
        manageImages:          'PUT  /api/products/:id/images (Admin)',
        deleteImage:           'DELETE /api/products/:id/images/:imageId (Admin)',
        notifyMe:              'POST /api/products/:id/notify-me (Protected)',
        variantGroups:         'GET|POST /api/products/variant-groups'
      },

      cart: {
        getCart:       'GET    /api/cart (Protected)',
        addToCart:     'POST   /api/cart (Protected)',
        updateItem:    'PUT    /api/cart/:id (Protected)',
        removeItem:    'DELETE /api/cart/:id (Protected)',
        clearCart:     'DELETE /api/cart/clear/all (Protected)',
        validateStock: 'POST   /api/cart/validate (Protected) ← 🆕 stock check before checkout'
      },

      wishlist: {
        getWishlist:   'GET    /api/wishlist (Protected)',
        addToWishlist: 'POST   /api/wishlist (Protected)',
        remove:        'DELETE /api/wishlist/:productId (Protected)',
        moveToCart:    'POST   /api/wishlist/:productId/move-to-cart (Protected)',
        clear:         'DELETE /api/wishlist/clear/all (Protected)'
      },

      orders: {
        createOrder:          'POST /api/orders (Protected)  — supports pickupTime + deliverySlot',
        confirmOrder:         'POST /api/orders/:id/confirm (Protected)',
        getUserOrders:        'GET  /api/orders (Protected)',
        getOrderById:         'GET  /api/orders/:id (Protected)',
        cancelOrder:          'POST /api/orders/:id/cancel (Protected)',
        requestReturn:        'PUT  /api/orders/:id/return (Protected)',
        adminCreateForCustomer: 'POST /api/orders/admin/create-for-customer (Admin)',
        getAllOrders:          'GET  /api/orders/admin/all (Admin)',
        updateOrderStatus:     'PUT  /api/orders/admin/:id/status (Admin)',
        markPaid:              'POST /api/orders/admin/:id/mark-paid (Admin)',
        refund:                'POST /api/orders/admin/:id/refund (Admin)'
      },

      bargain: {
        getConfig:      'GET  /api/bargain/config/:productId',
        getAttempts:    'GET  /api/bargain/attempts/:productId (Protected)',
        makeAttempt:    'POST /api/bargain/attempt (Protected)',
        setConfig:      'POST /api/bargain/config/:productId (Admin)',
        getRequests:    'GET  /api/bargain/requests (Admin)',
        reviewRequest:  'PUT  /api/bargain/requests/:id (Admin)'
      },

      inventory: {
        getAllInventory:     'GET  /api/inventory (Admin)',
        getLowStock:         'GET  /api/inventory/low-stock (Admin)',
        getProductInventory: 'GET  /api/inventory/:productId (Admin)',
        updateInventory:     'PUT  /api/inventory/:productId (Admin)',
        bulkUpdate:          'POST /api/inventory/bulk-update (Admin)'
      },

      payments: {
        initiatePayment: 'POST /api/payments/initiate (Protected)',
        verifyPayment:   'POST /api/payments/verify (Protected)',
        getStatus:       'GET  /api/payments/:orderId (Protected)',
        refund:          'POST /api/payments/:id/refund (Admin)',
        setUpiSettings:  'PUT  /api/payments/admin/upi-settings (Admin)',
        getUpiSettings:  'GET  /api/payments/upi-settings/:adminId (Public)',
        orderUpi:        'GET  /api/payments/order/:orderId/upi-settings (Protected)'
      },

      reports: {
        dashboard:            'GET  /api/reports/dashboard?filter=daily|weekly|monthly|yearly|lifetime (Admin)',
        sales:                'GET  /api/reports/sales?filter= (Admin)',
        revenue:              'GET  /api/reports/revenue?filter= (Admin)',
        weeklyStats:          'GET  /api/reports/weekly-stats (Admin)',
        orderStatusDist:      'GET  /api/reports/order-status-distribution (Admin)',
        inventory:            'GET  /api/reports/inventory (Admin)',
        topProducts:          'GET  /api/reports/top-products (Admin)',
        categoryPerformance:  'GET  /api/reports/category-performance (Admin)',
        productDemand:        'GET  /api/reports/demand (Admin)',
        searchAnalytics:      'GET  /api/reports/search-analytics (Admin) ← 🆕',
        sendEmail:            'POST /api/reports/send-email (Admin) ← 🔧 wired'
      },

      categories: { available: ['STATIONERY', 'BOOKS', 'TOYS'] }
    }
  });
});

// ── Error handling ────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found', path: req.url });
});

app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('=================================');
  console.log('🚀 Stationery World API v4.0.0');
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log('=================================');
  console.log('');
  console.log('📦 Modules Loaded:');
  console.log('  ✅ User Authentication (OTP leak fixed)');
  console.log('  ✅ Product Management (MRP + Initial Qty fix)');
  console.log('  ✅ Shopping Cart (stock validation)');
  console.log('  ✅ Wishlist');
  console.log('  ✅ Order Management (pickup slot + SELF accounting)');
  console.log('  ✅ Bargaining System');
  console.log('  ✅ Inventory Management');
  console.log('  ✅ Payment Processing (UPI settings)');
  console.log('  ✅ Reports & Analytics (time-range filter + search analytics)');
  console.log('  🆕 SearchLog + self-learning keywords');
  console.log('  🆕 SubCategories / Shop By Category');
  console.log('=================================');

  console.log('📧 Testing email service (background)...');
  testConnection().then(ok => {
    if (!ok) {
      console.log('⚠️  Email service not ready. Set EMAIL_PROVIDER=resend + RESEND_API_KEY,');
      console.log('   or configure EMAIL_HOST / EMAIL_USER / EMAIL_PASS for SMTP.');
    }
  }).catch(err => { console.error('❌ Email service check failed:', err.message); });
});

module.exports = app;
