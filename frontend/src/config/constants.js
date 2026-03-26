// API Configuration
const RENDER_API_URL = 'https://stationery-world.onrender.com';
const envApiUrl = import.meta.env.VITE_API_URL;
const LOCALHOST_HOSTNAMES = ['localhost', '127.0.0.1'];

const shouldUseRenderUrl = (() => {
  if (!envApiUrl) return true;

  try {
    const configured = new URL(envApiUrl);
    const runningOnLocalhost =
      typeof window !== 'undefined' &&
      LOCALHOST_HOSTNAMES.includes(window.location.hostname);

    return LOCALHOST_HOSTNAMES.includes(configured.hostname) && !runningOnLocalhost;
  } catch {
    return true;
  }
})();

export const API_BASE_URL = shouldUseRenderUrl ? RENDER_API_URL : (envApiUrl || RENDER_API_URL);

// API Endpoints
export const API_ENDPOINTS = {
  // Auth
  LOGIN: '/api/user/login',
  SIGNUP: '/api/user/signup',
  PROFILE: '/api/user/profile',
  
  // Products
  PRODUCTS: '/api/products',
  PRODUCT_BY_ID: (id) => `/api/products/${id}`,
  
  // Cart
  CART: '/api/cart',
  CART_ITEM: (id) => `/api/cart/${id}`,
  CLEAR_CART: '/api/cart/clear/all',
  
  // Wishlist
  WISHLIST: '/api/wishlist',
  WISHLIST_ITEM: (productId) => `/api/wishlist/${productId}`,
  WISHLIST_MOVE_TO_CART: (productId) => `/api/wishlist/${productId}/move-to-cart`,
  
  // Orders
  ORDERS: '/orders',
  ORDER_BY_ID: (id) => `/orders/${id}`,
  ORDERS_SELF: '/orders/self',
  CONFIRM_ORDER: (id) => `/orders/${id}/confirm`,
  CANCEL_ORDER: (id) => `/orders/${id}/cancel`,
  
  
  // Bargain
  BARGAIN_CONFIG: (productId) => `/api/bargain/config/${productId}`,
  BARGAIN_ATTEMPT: '/api/bargain/attempt',
  BARGAIN_ATTEMPTS: (productId) => `/api/bargain/attempts/${productId}`,
  
  // Payment
  PAYMENT_INITIATE: '/api/payments/initiate',
  PAYMENT_VERIFY: '/api/payments/verify',
  PAYMENT_STATUS: (orderId) => `/api/payments/${orderId}`,
  
  // Admin - Inventory
  INVENTORY: '/api/inventory',
  INVENTORY_LOW_STOCK: '/api/inventory/low-stock',
  INVENTORY_PRODUCT: (productId) => `/api/inventory/${productId}`,
  INVENTORY_BULK_UPDATE: '/api/inventory/bulk-update',
  
  // Admin - Reports
  REPORTS_DASHBOARD: '/api/reports/dashboard',
  REPORTS_SALES: '/api/reports/sales',
  REPORTS_REVENUE: '/api/reports/revenue',
  REPORTS_INVENTORY: '/api/reports/inventory',
  REPORTS_TOP_PRODUCTS: '/api/reports/top-products',
  REPORTS_CATEGORY_PERFORMANCE: '/api/reports/category-performance',
};
