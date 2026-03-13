import { API_BASE_URL, API_ENDPOINTS } from '../config/constants';
import { authUtils } from '../utils/auth';

// Base fetch wrapper
const apiFetch = async (endpoint, options = {}) => {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authUtils.getAuthHeaders(),
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'API request failed');
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

// API Service
export const apiService = {
  // =====================
  // AUTHENTICATION
  // =====================
  auth: {
    signup: async (userData) => {
      const data = await apiFetch(API_ENDPOINTS.SIGNUP, {
        method: 'POST',
        body: JSON.stringify(userData),
      });
      
      if (data.success && data.data.token) {
        authUtils.setToken(data.data.token);
        authUtils.setUser(data.data.user);
      }
      
      return data;
    },

    login: async (credentials) => {
      const data = await apiFetch(API_ENDPOINTS.LOGIN, {
        method: 'POST',
        body: JSON.stringify(credentials),
      });
      
      if (data.success && data.data.token) {
        authUtils.setToken(data.data.token);
        authUtils.setUser(data.data.user);
      }
      
      return data;
    },

    logout: () => {
      authUtils.logout();
    },

    getProfile: async () => {
      return await apiFetch(API_ENDPOINTS.PROFILE);
    },
  },

  // =====================
  // PRODUCTS
  // =====================
  products: {
    getAll: async (params) => {
      const queryString = params ? `?${new URLSearchParams(params)}` : '';
      return await apiFetch(`${API_ENDPOINTS.PRODUCTS}${queryString}`);
    },

    getById: async (id) => {
      return await apiFetch(API_ENDPOINTS.PRODUCT_BY_ID(id));
    },

    create: async (productData) => {
      return await apiFetch(API_ENDPOINTS.PRODUCTS, {
        method: 'POST',
        body: JSON.stringify(productData),
      });
    },

    update: async (id, productData) => {
      return await apiFetch(API_ENDPOINTS.PRODUCT_BY_ID(id), {
        method: 'PUT',
        body: JSON.stringify(productData),
      });
    },

    delete: async (id) => {
      return await apiFetch(API_ENDPOINTS.PRODUCT_BY_ID(id), {
        method: 'DELETE',
      });
    },
  },

  // =====================
  // CART
  // =====================
  cart: {
    get: async () => {
      return await apiFetch(API_ENDPOINTS.CART);
    },

    add: async (productId, quantity, bargainApplied = false) => {
      return await apiFetch(API_ENDPOINTS.CART, {
        method: 'POST',
        body: JSON.stringify({ productId, quantity, bargainApplied }),
      });
    },

    update: async (cartItemId, quantity) => {
      return await apiFetch(API_ENDPOINTS.CART_ITEM(cartItemId), {
        method: 'PUT',
        body: JSON.stringify({ quantity }),
      });
    },

    remove: async (cartItemId) => {
      return await apiFetch(API_ENDPOINTS.CART_ITEM(cartItemId), {
        method: 'DELETE',
      });
    },

    clear: async () => {
      return await apiFetch(API_ENDPOINTS.CLEAR_CART, {
        method: 'DELETE',
      });
    },
  },

  // =====================
  // WISHLIST
  // =====================
  wishlist: {
    get: async () => {
      return await apiFetch(API_ENDPOINTS.WISHLIST);
    },

    add: async (productId, note) => {
      return await apiFetch(API_ENDPOINTS.WISHLIST, {
        method: 'POST',
        body: JSON.stringify({ productId, note }),
      });
    },

    remove: async (productId) => {
      return await apiFetch(API_ENDPOINTS.WISHLIST_ITEM(productId), {
        method: 'DELETE',
      });
    },

    moveToCart: async (productId, quantity = 1) => {
      return await apiFetch(API_ENDPOINTS.WISHLIST_MOVE_TO_CART(productId), {
        method: 'POST',
        body: JSON.stringify({ quantity }),
      });
    },
  },

  // =====================
  // ORDERS
  // =====================
  orders: {
    create: async (recipientInfo) => {
      return await apiFetch(API_ENDPOINTS.ORDERS, {
        method: 'POST',
        body: JSON.stringify(recipientInfo),
      });
    },

    getAll: async (params) => {
      const queryString = params ? `?${new URLSearchParams(params)}` : '';
      return await apiFetch(`${API_ENDPOINTS.ORDERS}${queryString}`);
    },

    getSelf: async () => {
      return await apiFetch(`${API_ENDPOINTS.ORDERS}/self`);
    },

    getById: async (id) => {
      return await apiFetch(API_ENDPOINTS.ORDER_BY_ID(id));
    },

    confirm: async (id) => {
      return await apiFetch(API_ENDPOINTS.CONFIRM_ORDER(id), {
        method: 'POST',
      });
    },

    cancel: async (id) => {
      return await apiFetch(API_ENDPOINTS.CANCEL_ORDER(id), {
        method: 'PUT',
      });
    },
  },

  // =====================
  // ✨ BARGAIN - ENHANCED IMPLEMENTATION
  // =====================
  bargain: {
    /**
     * ✨ Check eligibility (works for guests and logged-in users)
     */
    checkEligibility: async (productId) => {
      try {
        const token = localStorage.getItem('token');
        const headers = { 'Content-Type': 'application/json' };
        
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_BASE_URL}/bargain/eligibility/${productId}`, {
          method: 'GET',
          headers
        });

        const data = await response.json();
        return data;
      } catch (error) {
        console.error('Check eligibility error:', error);
        throw error;
      }
    },

    /**
     * Get bargain configuration for a product
     */
    getConfig: async (productId) => {
      return await apiFetch(API_ENDPOINTS.BARGAIN_CONFIG(productId));
    },

    /**
     * Get user's bargain attempts for a product
     */
    getAttempts: async (productId) => {
      return await apiFetch(API_ENDPOINTS.BARGAIN_ATTEMPTS(productId));
    },

    /**
     * Make a bargain attempt
     */
    makeAttempt: async (productId, offeredPrice) => {
      return await apiFetch(API_ENDPOINTS.BARGAIN_ATTEMPT, {
        method: 'POST',
        body: JSON.stringify({ productId, offeredPrice }),
      });
    },

    /**
     * ✨ Set bargain configuration (Admin only)
     */
    setConfig: async (productId, config) => {
      return await apiFetch(`/bargain/config/${productId}`, {
        method: 'POST',
        body: JSON.stringify(config),
      });
    },

    /**
     * ✨ Get bargain analytics (Admin only)
     */
    getAnalytics: async (productId) => {
      return await apiFetch(`/bargain/admin/analytics/${productId}`);
    },
  },

  // =====================
  // PAYMENT
  // =====================
  payment: {
    initiate: async (orderId, method, transactionId) => {
      return await apiFetch(API_ENDPOINTS.PAYMENT_INITIATE, {
        method: 'POST',
        body: JSON.stringify({ orderId, method, transactionId }),
      });
    },

    verify: async (paymentId, status, transactionId) => {
      return await apiFetch(API_ENDPOINTS.PAYMENT_VERIFY, {
        method: 'POST',
        body: JSON.stringify({ paymentId, status, transactionId }),
      });
    },

    getStatus: async (orderId) => {
      return await apiFetch(API_ENDPOINTS.PAYMENT_STATUS(orderId));
    },
  },

  // =====================
  // ADMIN - REPORTS
  // =====================
  reports: {
    getDashboard: async () => {
      return await apiFetch(API_ENDPOINTS.REPORTS_DASHBOARD);
    },

    getSales: async (params) => {
      const queryString = params ? `?${new URLSearchParams(params)}` : '';
      return await apiFetch(`${API_ENDPOINTS.REPORTS_SALES}${queryString}`);
    },

    getRevenue: async (params) => {
      const qs = params ? `?${new URLSearchParams(params)}` : '';
      return await apiFetch(`${API_ENDPOINTS.REPORTS_REVENUE}${qs}`);
    },

    getInventory: async () => {
      return await apiFetch(API_ENDPOINTS.REPORTS_INVENTORY);
    },

    getTopProducts: async (limit = 10, sortBy = 'revenue') => {
      return await apiFetch(`${API_ENDPOINTS.REPORTS_TOP_PRODUCTS}?limit=${limit}&sortBy=${sortBy}`);
    },

    getCategoryPerformance: async (params) => {
      const qs = params ? `?${new URLSearchParams(params)}` : '';
      return await apiFetch(`${API_ENDPOINTS.REPORTS_CATEGORY_PERFORMANCE}${qs}`);
    },
  },
};

export default apiService;