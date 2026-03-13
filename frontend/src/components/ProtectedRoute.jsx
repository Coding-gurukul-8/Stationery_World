import { Navigate } from 'react-router-dom';
import { authUtils } from '../utils/auth';

const ProtectedRoute = ({ children, adminOnly = false, customerOnly = false }) => {
  const isAuthenticated = authUtils.isAuthenticated();
  const user = authUtils.getUser();
  const userRole = user?.role;

  // Not logged in - redirect to appropriate login page
  if (!isAuthenticated) {
    if (adminOnly) {
      console.log('🔒 Not authenticated - redirecting to admin login');
      return <Navigate to="/admin" replace />;
    }
    console.log('🔒 Not authenticated - redirecting to customer login');
    return <Navigate to="/" replace />;
  }

  // User is authenticated - check role-based access
  
  // Admin trying to access customer pages
  if (customerOnly && userRole === 'ADMIN') {
    console.log('🚫 Admin trying to access customer page - redirecting to admin dashboard');
    return <Navigate to="/admin/dashboard" replace />;
  }

  // Customer trying to access admin pages
  if (adminOnly && userRole === 'CUSTOMER') {
    console.log('🚫 Customer trying to access admin page - redirecting to customer shop');
    return <Navigate to="/customer" replace />;
  }

  // All checks passed - allow access
  return children;
};

export default ProtectedRoute;