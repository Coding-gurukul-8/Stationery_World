import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import CartoonMascot from "./CartoonMascot";
import "../../Style/dashboard.css";
import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useSidebar } from "../context/SidebarContext";

const AdminLayout = () => {
  const { open } = useSidebar();
  const location = useLocation();
  const [animatePage, setAnimatePage] = useState(true);

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

  useEffect(() => {
    // Trigger a small fade/slide animation when the route changes.
    setAnimatePage(true);
    const timer = window.setTimeout(() => setAnimatePage(false), 500);
    return () => window.clearTimeout(timer);
  }, [location.pathname]);

  return (
    <div className="admin-layout">
      <Sidebar />
      <div className={`admin-main${open ? "" : " sidebar-closed"}`}>
        <Topbar />
        <div className={`admin-content${animatePage ? ' page-transition' : ''}`}>
          <Outlet />
        </div>
      </div>
      {/* Subtle animated mascot to make UI feel more lively */}
      <CartoonMascot position="top-right" />
    </div>
  );
};

export default AdminLayout;