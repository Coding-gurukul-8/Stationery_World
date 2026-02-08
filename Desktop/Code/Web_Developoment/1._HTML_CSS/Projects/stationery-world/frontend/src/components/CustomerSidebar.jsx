import { NavLink } from 'react-router-dom';
import './customer.css';

export default function CustomerSidebar({ onNavigate }) {
  const cls = ({ isActive }) => isActive ? 'active' : undefined;

  return (
    <aside className="customer-sidebar">
      <nav>
        <ul>
          <li><NavLink to="/customer" end className={cls}>Home</NavLink></li>
          <li><NavLink to="/customer/you" className={cls}>You</NavLink></li>
          <li><NavLink to="/customer/wishlist" className={cls}>Wishlist</NavLink></li>
          <li><NavLink to="/customer/cart" className={cls}>Cart</NavLink></li>
        </ul>
      </nav>
    </aside>
  );
}