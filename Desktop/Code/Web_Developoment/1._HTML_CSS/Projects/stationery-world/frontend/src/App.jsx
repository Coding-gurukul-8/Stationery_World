import { Routes, Route } from "react-router-dom";

import Login from "./pages/customer/Login";
import Signup from "./pages/customer/Signup";
import ForgotPassword from "./pages/customer/ForgotPassword";
import VerifyOtp from "./pages/customer/VerifyOtp";

import AdminLogin from "./pages/admin/AdminLogin";
import AdminSignup from "./pages/admin/AdminSignup";
import AdminForgotPassword from "./pages/admin/AdminForgotPassword";
import AdminVerifyOTP from "./pages/admin/AdminVerifyOTP";
import AdminResetPassword from "./pages/admin/AdminResetPassword";
import Dashboard from "./pages/admin/Dashboard";
import Reports from "./pages/admin/Reports";

import AdminLayout from "./components/AdminLayout";
import Inventory from "./pages/admin/Inventory";
import Orders from "./pages/admin/Orders";
import Users from "./pages/admin/Users";
import AdminShopping from "./pages/admin/AdminShopping";
import AdminWishlist from "./pages/admin/AdminWishlist";
import Shop from "./pages/Shop";

export default function App() {
  return (
    <Routes>
      {/* ================= CUSTOMER ================= */}
      <Route path="/" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/verify-otp" element={<VerifyOtp />} />
      <Route path="/shop" element={<Shop />} />

      {/* Customer pages (uses CustomerLayout) */}
      <Route path="/customer" element={<CustomerLayout />}>
        <Route index element={<Shop />} />
        <Route path="you" element={<You />} />
        <Route path="wishlist" element={<Wishlist />} />
        <Route path="cart" element={<Cart />} />
      </Route>

      {/* ================= ADMIN AUTH ================= */}
      <Route path="/admin" element={<AdminLogin />} />
      <Route path="/admin/signup" element={<AdminSignup />} />
      <Route path="/admin/forgot-password" element={<AdminForgotPassword />} />
      <Route path="/admin/verify-otp" element={<AdminVerifyOTP />} />
      <Route path="/admin/reset-password" element={<AdminResetPassword />} />

      {/* ================= ADMIN DASHBOARD (LAYOUT) ================= */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="reports" element={<Reports />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="orders" element={<Orders />} />
        <Route path="users" element={<Users />} />
        <Route path="shopping" element={<AdminShopping />} />
        <Route path="wishlist" element={<AdminWishlist />} />
      </Route>
    </Routes>
  );
}
