import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import "../../Style/dashboard.css";
import { Outlet } from "react-router-dom";
import { useState, useEffect } from "react";

const AdminLayout = ({ children }) => {

  useEffect(() => {
    const handleKeyShortcuts = (e) => {

      if (e.key === "/") {
        e.preventDefault();
        document.querySelector(".topbar-search input")?.focus();
      }

      if (e.ctrlKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        document.querySelector(".sidebar-toggle")?.click();
      }

      if (e.key === "Escape") {
        document.body.click();
      }
    };

    window.addEventListener("keydown", handleKeyShortcuts);
    return () => window.removeEventListener("keydown", handleKeyShortcuts);
  }, []);

  return (
    <div className="admin-layout">
      <Sidebar />
      <div className="admin-main">
        <Topbar />
        <div className="admin-content">
          <Outlet />
          {/* {children} */}
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;
