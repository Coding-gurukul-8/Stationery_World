import "../../Style/dashboard.css";
import { useState, useRef, useEffect } from "react";
import { Link } from 'react-router-dom';
import adminPfp from "../assets/admin-avatar.jpg";

const Topbar = ({ variant = 'admin', wishlistCount = 0, cartCount = 0, onToggleSidebar }) => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {variant === 'customer' && (
          <button className="sidebar-toggle" aria-label="Toggle navigation" onClick={() => onToggleSidebar && onToggleSidebar()}>
            ☰
          </button>
        )}
        <span className="topbar-brand">{variant === 'customer' ? 'Stationery World' : 'Stationery World – Admin'}</span>
      </div>

      {/* SEARCH */}
      <div className="topbar-search" role="search">
        <input aria-label="Search products" type="text" placeholder="Search…" />
      </div>

      {/* CUSTOMER / ADMIN */}
      <div className="topbar-actions" ref={dropdownRef}>
        {variant === 'customer' && (
          <div className="topbar-icons" role="navigation" aria-label="Customer quick actions">
            <Link to="/customer/wishlist" title="Wishlist" className="icon-link">❤️ <span className="count">{wishlistCount}</span></Link>
            <Link to="/customer/cart" title="Cart" className="icon-link">🛒 <span className="count">{cartCount}</span></Link>
          </div>
        )}

        <div className="topbar-admin" onClick={() => setOpen(!open)}>
          <img
            src={adminPfp}
            alt={variant === 'customer' ? 'User' : 'Admin'}
            aria-haspopup="true"
          />
        </div>

        {open && (
          <div className="admin-dropdown" role="menu">
            <button role="menuitem">Profile</button>
            <button role="menuitem" className="logout">Logout</button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Topbar;

export default Topbar;