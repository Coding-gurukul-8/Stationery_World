import { Routes, Route } from "react-router-dom";
import PageTransition from "./components/PageTransition";

import Login from "./pages/customer/Login";
import Signup from "./pages/customer/Signup";
import ForgotPassword from "./pages/customer/ForgotPassword";
import VerifyOtp from "./pages/customer/VerifyOtp";
import CustomerOrders from './pages/customer/Orders';

import { ThemeProvider } from "./context/ThemeContext";

import AdminLogin from "./pages/admin/AdminLogin";
import AdminSignup from "./pages/admin/AdminSignup";
import AdminForgotPassword from "./pages/admin/AdminForgotPassword";
import Dashboard from "./pages/admin/Dashboard";
import Reports from "./pages/admin/Reports";
import AdminProfile from "./pages/admin/AdminProfile";

import AdminLayout from "./components/AdminLayout";
import Inventory from "./pages/admin/Inventory";
import Orders from "./pages/admin/Orders";
import Users from "./pages/admin/Users";
import BargainRequests from "./pages/admin/BargainRequests";
import AdminShopping from "./pages/admin/AdminShopping";
import AdminWishlist from "./pages/admin/AdminWishlist";
import Shop from "./pages/Shop";

import ProtectedRoute from "./components/ProtectedRoute";

// Customer pages & layout
import CustomerLayout from "./components/CustomerLayout";
import You from "./pages/customer/You";
import Wishlist from "./pages/customer/Wishlist";
import Cart from "./pages/customer/Cart";
import Bargain from "./pages/customer/Bargain";
import { SidebarProvider } from "./context/SidebarContext";

export default function App() {
  return (
    <ThemeProvider>
      <PageTransition />
      <Routes>
      {/* ================= CUSTOMER AUTH (PUBLIC) ================= */}
      <Route path="/" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/verify-otp" element={<VerifyOtp />} />

      {/* ================= CUSTOMER PAGES (PROTECTED - CUSTOMER ONLY) ================= */}
      <Route path="/customer" element={
        <ProtectedRoute customerOnly>
          <SidebarProvider>
            <CustomerLayout />
          </SidebarProvider>
        </ProtectedRoute>
      }>
        <Route index element={<Shop />} />
        <Route path="you" element={<You />} />
        <Route path="orders" element={<CustomerOrders />} /> {/* New Orders page for customers */}
        <Route path="bargain" element={<Bargain />} />
        <Route path="wishlist" element={<Wishlist />} />
        <Route path="cart" element={<Cart />} />
      </Route>

      {/* ================= ADMIN AUTH (PUBLIC) ================= */}
      <Route path="/admin" element={<AdminLogin />} />
      <Route path="/admin/signup" element={<AdminSignup />} />
      <Route path="/admin/forgot-password" element={<AdminForgotPassword />} />

      {/* ================= ADMIN DASHBOARD (PROTECTED - ADMIN ONLY) ================= */}
      <Route path="/admin" element={
        <ProtectedRoute adminOnly>
          <SidebarProvider>
            <AdminLayout />
          </SidebarProvider>
        </ProtectedRoute>
      }>
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="profile" element={<AdminProfile />} />
        <Route path="reports" element={<Reports />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="orders" element={<Orders />} />
        <Route path="users" element={<Users />} />
        <Route path="bargain-requests" element={<BargainRequests />} />
        <Route path="shopping" element={<AdminShopping />} />
        <Route path="wishlist" element={<AdminWishlist />} />
      </Route>
    </Routes>    </ThemeProvider>  );
}