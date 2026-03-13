import "../../Style/dashboard.css";
import { useState, useRef, useEffect } from "react";
import { useSidebar } from "../context/SidebarContext";
import { useTheme } from "../context/ThemeContext";
import { Link, useNavigate } from 'react-router-dom';
import { authUtils } from "../utils/auth";
import { useSearch } from "../context/SearchContext";
import SearchDropdown from "./SearchDropdown";
import Logo from "./Logo";
import { Search, X, Sun, Moon } from 'lucide-react';

const DEFAULT_AVATAR_CUSTOMER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 150 150'%3E%3Ccircle cx='75' cy='75' r='75' fill='%234d7260'/%3E%3Cpath d='M75 40c-11 0-20 9-20 20s9 20 20 20 20-9 20-20-9-20-20-20zm0 60c-16.5 0-30 8.5-30 19v6h60v-6c0-10.5-13.5-19-30-19z' fill='%23fff'/%3E%3C/svg%3E";
const DEFAULT_AVATAR_ADMIN    = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 150 150'%3E%3Ccircle cx='75' cy='75' r='75' fill='%23c0714f'/%3E%3Cpath d='M75 40c-11 0-20 9-20 20s9 20 20 20 20-9 20-20-9-20-20-20zm0 60c-16.5 0-30 8.5-30 19v6h60v-6c0-10.5-13.5-19-30-19z' fill='%23fff'/%3E%3C/svg%3E";

const getImageUrl = (photoUrl, userRole) => {
  if (!photoUrl) return userRole === 'ADMIN' ? DEFAULT_AVATAR_ADMIN : DEFAULT_AVATAR_CUSTOMER;
  if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://') || photoUrl.startsWith('data:')) return photoUrl;
  if (photoUrl.startsWith('/uploads/')) return `http://localhost:3000${photoUrl}`;
  return photoUrl;
};

const MenuIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <rect x="2" y="3.5"  width="14" height="1.6" rx="0.8" fill="currentColor"/>
    <rect x="2" y="8.2"  width="10" height="1.6" rx="0.8" fill="currentColor"/>
    <rect x="2" y="12.9" width="14" height="1.6" rx="0.8" fill="currentColor"/>
  </svg>
);

const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <path d="M3 3L15 15M15 3L3 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const Topbar = ({
  variant = 'admin',
  wishlistCount = 0,
  cartCount = 0,
  onToggleSidebar,
  sidebarOpen: customerSidebarOpen = false,
}) => {
  const { open: sidebarOpen, setOpen: setSidebarOpen } = useSidebar();
  const { theme, toggle: toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const searchRef   = useRef(null);
  const navigate    = useNavigate();

  const { searchQuery, searchResults, isSearching, placeholder, resultRenderer, performSearch, clearSearch } = useSearch();

  const [user, setUser] = useState(authUtils.getUser());
  const userRole  = user?.role || 'CUSTOMER';
  const userPhoto = getImageUrl(user?.photoUrl, userRole);
  const userName  = user?.name || 'User';
  const isAdmin   = variant === 'admin';
  const isOpen    = isAdmin ? sidebarOpen : customerSidebarOpen;

  useEffect(() => {
    if (variant === 'customer' && user?.role === 'ADMIN') {
      navigate('/admin/dashboard', { replace: true });
    } else if (variant === 'admin' && user?.role === 'CUSTOMER') {
      navigate('/customer', { replace: true });
    }
  }, [user, variant, navigate]);

  useEffect(() => {
    const onUpdate = (e) => setUser(e.detail);
    window.addEventListener('userUpdated', onUpdate);
    return () => window.removeEventListener('userUpdated', onUpdate);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
      if (searchRef.current   && !searchRef.current.contains(e.target))   setShowSearchDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.querySelector('input')?.focus();
      }
      if (e.key === 'Escape') { setShowSearchDropdown(false); clearSearch(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [clearSearch]);

  const handleSearchChange = (e) => {
    const q = e.target.value;
    performSearch(q);
    setShowSearchDropdown(q.trim().length > 0);
  };

  const handleLogout = () => {
    authUtils.logout();
    navigate(isAdmin ? '/admin' : '/', { replace: true });
  };

  const handleProfile = () => {
    navigate(isAdmin ? '/admin/profile' : '/customer/you');
    setOpen(false);
  };

  return (
    <header className="topbar" data-variant={variant}>

      {/* Left: toggle + brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <button
          className={`sidebar-toggle${isOpen ? ' open' : ''}`}
          aria-label={isOpen ? 'Close sidebar' : 'Open sidebar'}
          onClick={() => isAdmin ? setSidebarOpen(!sidebarOpen) : onToggleSidebar?.()}
        >
          <span className="toggle-icon-wrap">
            <span className={`toggle-icon toggle-icon--menu${isOpen ? ' hidden' : ''}`}><MenuIcon /></span>
            <span className={`toggle-icon toggle-icon--close${isOpen ? '' : ' hidden'}`}><CloseIcon /></span>
          </span>
        </button>
        <span className="topbar-brand">
          <Logo size={26} />
          <span className="topbar-brand-text">
            {variant === 'customer' ? 'Stationery World' : 'Stationery World'}
          </span>
        </span>
      </div>

      {/* Centre: search */}
      <div className="topbar-search" role="search" ref={searchRef}>
        <div className="search-input-wrap">
          <span className="search-icon" aria-hidden="true"><Search size={14} /></span>
          <input
            type="text"
            aria-label="Search"
            placeholder={placeholder}
            value={searchQuery}
            onChange={handleSearchChange}
            onFocus={() => searchQuery.trim() && setShowSearchDropdown(true)}
          />
          {searchQuery && (
            <button className="search-clear" onClick={() => { clearSearch(); setShowSearchDropdown(false); }} aria-label="Clear">
              <X size={14} />
            </button>
          )}
          <kbd className="search-shortcut">⌘K</kbd>
        </div>

        {showSearchDropdown && (
          <SearchDropdown
            results={searchResults}
            isSearching={isSearching}
            query={searchQuery}
            resultRenderer={resultRenderer}
            onClose={() => setShowSearchDropdown(false)}
          />
        )}
      </div>

      {/* Right: actions */}
      <div className="topbar-actions" ref={dropdownRef}>

        {/* Theme toggle */}
        <button className="icon-link" onClick={toggleTheme} title={theme === 'dark' ? 'Light mode' : 'Dark mode'} style={{ fontSize: 0 }}>
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Customer quick links */}
        {!isAdmin && (
          <div className="topbar-icons" role="navigation" aria-label="Customer quick actions">
            <Link to="/customer/wishlist" title="Wishlist" className="icon-link">
              ❤️ <span className="count">{wishlistCount}</span>
            </Link>
            <Link to="/customer/cart" title="Cart" className="icon-link">
              🛒 <span className="count">{cartCount}</span>
            </Link>
          </div>
        )}

        {/* Username + badge */}
        <span className="topbar-username">
          {userName}
          {isAdmin && <span className="topbar-badge-admin">ADMIN</span>}
        </span>

        {/* Avatar + dropdown */}
        <div className="topbar-admin" onClick={() => setOpen(!open)}>
          <img
            src={userPhoto}
            alt={userName}
            aria-haspopup="true"
            style={{ border: isAdmin ? '2px solid var(--terra)' : '2px solid var(--sage)' }}
            onError={(e) => { e.target.src = isAdmin ? DEFAULT_AVATAR_ADMIN : DEFAULT_AVATAR_CUSTOMER; }}
          />
        </div>

        {open && (
          <div className="admin-dropdown" role="menu">
            <button role="menuitem" onClick={handleProfile}>Profile</button>
            <button role="menuitem" className="logout" onClick={handleLogout}>Logout</button>
          </div>
        )}

      </div>
    </header>
  );
};

export default Topbar;