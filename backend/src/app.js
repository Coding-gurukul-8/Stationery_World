require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ✅ NEW: Import email service
const { testConnection } = require('./services/email.service');

// Import routes
const userRoutes = require('./modules/user/user.routes');
const productRoutes = require('./modules/product/product.routes');
const cartRoutes = require('./modules/cart/cart.routes');
const wishlistRoutes = require('./modules/wishlist/wishlist.routes');
const orderRoutes = require('./modules/order/order.routes');
const bargainRoutes = require('./modules/bargain/bargain.routes');
const inventoryRoutes = require('./modules/inventory/inventory.routes');
const paymentRoutes = require('./modules/payment/payment.routes');
const reportsRoutes = require('./modules/reports/reports.routes');


const app = express();
const PORT = process.env.PORT || 3000;

// ===========================
// CREATE UPLOADS DIRECTORIES
// ===========================
const uploadsDir = path.join(__dirname, '..', 'uploads');
const productsUploadDir = path.join(uploadsDir, 'products');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('✅ Created uploads directory:', uploadsDir);
}

if (!fs.existsSync(productsUploadDir)) {
  fs.mkdirSync(productsUploadDir, { recursive: true });
  console.log('✅ Created products upload directory:', productsUploadDir);
}

// ===========================
// MIDDLEWARE
// ===========================

// CORS configuration
app.use(cors({
  origin: '*',
  credentials: true
}));

// Serve static files (uploaded images)
app.use('/uploads', express.static(uploadsDir));

// Body parser middleware - MUST BE BEFORE ROUTES
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ===========================
// ROUTES
// ===========================

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// API routes
app.use('/api/user', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/bargain', bargainRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reports', reportsRoutes);

// Root route
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to Stationery Store API - Full Stack',
    version: '2.0.0',
    endpoints: {
      health: '/health',
      
      user: {
        signup: 'POST /api/user/signup',
        login: 'POST /api/user/login',
        forgotPassword: 'POST /api/user/forgot-password',
        verifyOTP: 'POST /api/user/verify-otp',
        resetPassword: 'POST /api/user/reset-password',
        profile: 'GET /api/user/profile (Protected)',
        updateProfile: 'PUT /api/user/profile (Protected)',
        getAllUsers: 'GET /api/user/all (Admin Only)'
      },
      
      products: {
        getAllProducts: 'GET /api/products',
        getRecommendedProducts: 'GET /api/products/recommended (Protected)',
        getProductById: 'GET /api/products/:id',
        getProductsByCategory: 'GET /api/products/category/:category',
        createProduct: 'POST /api/products (Admin Only)',
        updateProduct: 'PUT /api/products/:id (Admin Only)',
        deleteProduct: 'DELETE /api/products/:id (Admin Only)',
        toggleStatus: 'PATCH /api/products/:id/toggle-status (Admin Only)',
        lowStockProducts: 'GET /api/products/admin/low-stock (Admin Only)'
      },
      
      cart: {
        getCart: 'GET /api/cart (Protected)',
        addToCart: 'POST /api/cart (Protected)',
        updateCartItem: 'PUT /api/cart/:id (Protected)',
        removeFromCart: 'DELETE /api/cart/:id (Protected)',
        clearCart: 'DELETE /api/cart/clear/all (Protected)'
      },
      
      wishlist: {
        getWishlist: 'GET /api/wishlist (Protected)',
        addToWishlist: 'POST /api/wishlist (Protected)',
        removeFromWishlist: 'DELETE /api/wishlist/:productId (Protected)',
        moveToCart: 'POST /api/wishlist/:productId/move-to-cart (Protected)',
        clearWishlist: 'DELETE /api/wishlist/clear/all (Protected)'
      },
      
      orders: {
        createOrder: 'POST /api/orders (Protected)',
        confirmOrder: 'POST /api/orders/:id/confirm (Protected)',
        getUserOrders: 'GET /api/orders (Protected)',
        getOrderById: 'GET /api/orders/:id (Protected)',
        cancelOrder: 'PUT /api/orders/:id/cancel (Protected)',
        getAllOrders: 'GET /api/orders/admin/all (Admin Only)',
        updateOrderStatus: 'PUT /api/orders/admin/:id/status (Admin Only)'
      },
      
      bargain: {
        getBargainConfig: 'GET /api/bargain/config/:productId',
        getBargainAttempts: 'GET /api/bargain/attempts/:productId (Protected)',
        makeBargainAttempt: 'POST /api/bargain/attempt (Protected)',
        setBargainConfig: 'POST /api/bargain/config/:productId (Admin Only)'
      },
      
      inventory: {
        getAllInventory: 'GET /api/inventory (Admin Only)',
        getLowStockProducts: 'GET /api/inventory/low-stock (Admin Only)',
        getProductInventory: 'GET /api/inventory/:productId (Admin Only)',
        updateInventory: 'PUT /api/inventory/:productId (Admin Only)',
        bulkUpdateInventory: 'POST /api/inventory/bulk-update (Admin Only)'
      },
      
      payments: {
        initiatePayment: 'POST /api/payments/initiate (Protected)',
        verifyPayment: 'POST /api/payments/verify (Protected)',
        getPaymentStatus: 'GET /api/payments/:orderId (Protected)',
        processRefund: 'POST /api/payments/:id/refund (Admin Only)'
      },
      
      reports: {
        salesReport: 'GET /api/reports/sales (Admin Only)',
        revenueReport: 'GET /api/reports/revenue (Admin Only)',
        inventoryReport: 'GET /api/reports/inventory (Admin Only)',
        topProducts: 'GET /api/reports/top-products (Admin Only)',
        categoryPerformance: 'GET /api/reports/category-performance (Admin Only)',
        dashboardSummary: 'GET /api/reports/dashboard (Admin Only)'
      },
      
      categories: {
        available: ['STATIONERY', 'BOOKS', 'TOYS']
      }
    }
  });
});

// ===========================
// ERROR HANDLING
// ===========================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.url
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ===========================
// SERVER START
// ===========================

app.listen(PORT, async () => {
  console.log('=================================');
  console.log(`🚀 Stationery Store API v2.0.0`);
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Uploads directory: ${uploadsDir}`);
  console.log(`Products upload directory: ${productsUploadDir}`);
  console.log('=================================');
  console.log('');
  
  // ✅ NEW: Test email service connection
  console.log('📧 Testing email service...');
  const emailConnected = await testConnection();
  
  if (emailConnected) {
    console.log('✅ Email service is ready');
  } else {
    console.log('⚠️  Email service not configured (OTP emails will fail)');
    console.log('   Add EMAIL_HOST, EMAIL_USER, EMAIL_PASS to .env');
  }
  
  console.log('');
  console.log('📦 Modules Loaded:');
  console.log('  ✅ User Authentication');
  console.log('  ✅ Product Management');
  console.log('  ✅ Shopping Cart');
  console.log('  ✅ Wishlist');
  console.log('  ✅ Order Management');
  console.log('  ✅ Bargaining System');
  console.log('  ✅ Inventory Management');
  console.log('  ✅ Payment Processing');
  console.log('  ✅ Reports & Analytics');
  console.log('  ✅ Password Reset (OTP)');
  console.log('=================================');
});

module.exports = app;
