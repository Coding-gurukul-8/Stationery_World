import CustomerSidebar from './CustomerSidebar';
import Topbar from './Topbar';
import '../../Style/shop.css';
import './customer.css';
import { Outlet } from 'react-router-dom';
import { useState } from 'react';

export default function CustomerLayout() {
  const [showSidebar, setShowSidebar] = useState(false);

  return (
    <div className={`customer-layout ${showSidebar ? 'sidebar-open' : ''}`}>
      <CustomerSidebar />
      <div className="customer-main">
        <Topbar variant="customer" onToggleSidebar={() => setShowSidebar(s => !s)} />
        <main className="customer-content" onClick={() => setShowSidebar(false)}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
