import { Routes, Route } from "react-router-dom";

// Customer
import Login from "../pages/customer/Login";
import Signup from "../pages/customer/Signup";
import ForgotPassword from "../pages/customer/ForgotPassword";

import AdminLayout from "../components/AdminLayout";
import Dashboard from "../pages/admin/Dashboard";
import Reports from "../pages/admin/Reports";
import Inventory from "../pages/admin/Inventory";
import Orders from "../pages/admin/Orders";
import Users from "../pages/admin/Users";
import AdminShopping from "../pages/admin/AdminShopping";
import AdminWishlist from "../pages/admin/AdminWishlist";

// Admin
//import AdminLogin from "../pages/admin/AdminLogin";
//import AdminSignup from "../pages/admin/AdminSignup";
//import AdminForgotPassword from "../pages/admin/AdminForgotPassword";

export default function AppRoutes() {
  return (
    <Routes>
      {/* Customer Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      
      {/* Admin Routes */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="reports" element={<Reports />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="orders" element={<Orders />} />
        <Route path="users" element={<Users />} />
        <Route path="shopping" element={<AdminShopping />} />
        <Route path="wishlist" element={<AdminWishlist />} />
      </Route>

      {/*
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin/signup" element={<AdminSignup />} />
      <Route path="/admin/forgot-password" element={<AdminForgotPassword />} />
      */}
    </Routes>
  );
}
