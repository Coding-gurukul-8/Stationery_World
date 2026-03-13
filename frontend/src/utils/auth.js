// Token Management
export const authUtils = {
  // Get token from localStorage
  getToken: () => {
    return localStorage.getItem('token');
  },

  // Set token in localStorage
  setToken: (token) => {
    localStorage.setItem('token', token);
  },

  // Remove token
  removeToken: () => {
    localStorage.removeItem('token');
  },

  // Get user from localStorage
  getUser: () => {
    const userJson = localStorage.getItem('user');
    return userJson ? JSON.parse(userJson) : null;
  },

  // Set user in localStorage
  setUser: (user) => {
    localStorage.setItem('user', JSON.stringify(user));
  },

  // Remove user
  removeUser: () => {
    localStorage.removeItem('user');
  },

  // Check if user is logged in
  isAuthenticated: () => {
    return !!authUtils.getToken();
  },

  // Check if user is admin
  isAdmin: () => {
    const user = authUtils.getUser();
    return user?.role === 'ADMIN';
  },

  // ✅ NEW: Check if user is customer
  isCustomer: () => {
    const user = authUtils.getUser();
    return user?.role === 'CUSTOMER';
  },

  // ✅ NEW: Get user role
  getRole: () => {
    const user = authUtils.getUser();
    return user?.role || null;
  },

  // Logout
  logout: () => {
    authUtils.removeToken();
    authUtils.removeUser();
  },

  // Get auth headers
  getAuthHeaders: () => {
    const token = authUtils.getToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }
};