require('dotenv').config();
const express = require('express');
const cors = require('cors');
const userRoutes = require('./modules/user/user.routes');
const productRoutes = require('./modules/product/product.routes');
const orderRoutes = require('./modules/order/order.routes');
const path = require('path');
const uploadsRoutes = require('./modules/uploads/uploads.routes');

const app = express();
const PORT = process.env.PORT || 5000;

// ===========================
// MIDDLEWARE
// ===========================

// CORS configuration
app.use(cors({
  origin: '*', // Configure this based on your frontend URL in production
  credentials: true
}));

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
app.use('/api/orders', orderRoutes);

// Serve uploaded files (public/uploads)
app.use('/uploads', express.static(path.join(__dirname, '..', '..', 'public', 'uploads')));
// Uploads route
app.use('/api/uploads', uploadsRoutes);

// Root route
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to Stationery Store API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      user: {
        signup: 'POST /api/user/signup',
        login: 'POST /api/user/login',
        profile: 'GET /api/user/profile (Protected)',
        updateProfile: 'PUT /api/user/profile (Protected)',
        getAllUsers: 'GET /api/user/all (Admin Only)'
      },
      products: {
        getAllProducts: 'GET /api/products',
        getProductById: 'GET /api/products/:id',
        getProductsByCategory: 'GET /api/products/category/:category',
        createProduct: 'POST /api/products (Admin Only)',
        updateProduct: 'PUT /api/products/:id (Admin Only)',
        deleteProduct: 'DELETE /api/products/:id (Admin Only)',
        toggleStatus: 'PATCH /api/products/:id/toggle-status (Admin Only)',        restockProduct: 'POST /api/products/:id/restock (Admin Only)',
        inventoryLogs: 'GET /api/products/:id/logs (Admin Only)',        lowStockProducts: 'GET /api/products/admin/low-stock (Admin Only)'
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

app.listen(PORT, () => {
  console.log('=================================');
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log('=================================');
});

module.exports = app;
