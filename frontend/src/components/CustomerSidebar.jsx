import { NavLink } from 'react-router-dom';
import './customer.css';

export default function CustomerSidebar({ onNavigate }) {
  const cls = ({ isActive }) => isActive ? 'active' : undefined;

  return (
    <aside className="customer-sidebar">
      <div className="customer-sidebar-brand">
        <div className="customer-sidebar-logo">Stationery World</div>
        <div className="customer-sidebar-tagline">Your Marketplace</div>
      </div>
      <nav>
        <ul>
          <li>
            <NavLink to="/customer" end className={cls} onClick={onNavigate}>
              <span className="cs-icon">🏠</span> Home
            </NavLink>
          </li>
          <li>
            <NavLink to="/customer/you" className={cls} onClick={onNavigate}>
              <span className="cs-icon">👤</span> You
            </NavLink>
          </li>
          <li>
            <NavLink to="/customer/bargain" className={cls} onClick={onNavigate}>
              <span className="cs-icon">🤝</span> Bargain
            </NavLink>
          </li>
          <li>
            <NavLink to="/customer/wishlist" className={cls} onClick={onNavigate}>
              <span className="cs-icon">❤️</span> Wishlist
            </NavLink>
          </li>
          <li>
            <NavLink to="/customer/cart" className={cls} onClick={onNavigate}>
              <span className="cs-icon">🛒</span> Cart
            </NavLink>
          </li>
          <li>
            <NavLink to="/customer/orders" className={cls} onClick={onNavigate}>
              <span className="cs-icon">📦</span> Orders
            </NavLink>
          </li>
        </ul>
      </nav>
    </aside>
  );
}