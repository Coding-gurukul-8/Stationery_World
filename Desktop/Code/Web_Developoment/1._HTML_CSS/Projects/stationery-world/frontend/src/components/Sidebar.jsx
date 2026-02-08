import { NavLink } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import "../../Style/dashboard.css";

const Sidebar = () => {
  const [open, setOpen] = useState(() => {
    const saved = localStorage.getItem("admin-sidebar");
    return saved ? JSON.parse(saved) : true;
  });

  const sidebarWrapperRef = useRef(null);

  // Persist state
  useEffect(() => {
    localStorage.setItem("admin-sidebar", JSON.stringify(open));
  }, [open]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        open &&
        sidebarWrapperRef.current &&
        !sidebarWrapperRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={sidebarWrapperRef}>
      <button className="sidebar-toggle" onClick={() => setOpen(!open)}>
        {open ? "⮜" : "☰"}
      </button>

      <aside className={`sidebar ${open ? "open" : "closed"}`}>
        <h3 className="sidebar-title">Admin Panel</h3>

        <nav>
          <NavLink to="/admin/dashboard" className={({isActive}) => isActive ? 'active' : ''}>
            <span className="icon">🏠</span>
            <span className="text">Home</span>
          </NavLink>

          <NavLink to="/admin/reports" className={({isActive}) => isActive ? 'active' : ''}>
            <span className="icon">📊</span>
            <span className="text">Monthly Reports</span>
          </NavLink>

          <NavLink to="/admin/inventory" className={({isActive}) => isActive ? 'active' : ''}>
            <span className="icon">📦</span>
            <span className="text">Inventory</span>
          </NavLink>

          <NavLink to="/admin/orders" className={({isActive}) => isActive ? 'active' : ''}>
            <span className="icon">🧾</span>
            <span className="text">Orders</span>
          </NavLink>

          <NavLink to="/admin/users" className={({isActive}) => isActive ? 'active' : ''}>
            <span className="icon">👥</span>
            <span className="text">Users</span>
          </NavLink>

          <NavLink to="/admin/shopping" className={({isActive}) => isActive ? 'active' : ''}>
            <span className="icon">🛒</span>
            <span className="text">Shopping</span>
          </NavLink>

          <NavLink to="/admin/wishlist" className={({isActive}) => isActive ? 'active' : ''}>
            <span className="icon">💖</span>
            <span className="text">Wishlist Products</span>
          </NavLink>
        </nav>
      </aside>
    </div>
  );
};

export default Sidebar;
