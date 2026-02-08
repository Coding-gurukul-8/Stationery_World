import { useState } from 'react';

export default function You() {
  const [tab, setTab] = useState('profile');

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>You (Account)</h3>
        <div>
          <button className={tab === 'profile' ? 'btn primary' : 'btn outline'} onClick={() => setTab('profile')}>Profile</button>
          <button className={tab === 'orders' ? 'btn primary' : 'btn outline'} onClick={() => setTab('orders')}>Orders</button>
          <button className={tab === 'addresses' ? 'btn primary' : 'btn outline'} onClick={() => setTab('addresses')}>Addresses</button>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        {tab === 'profile' && (
          <div>
            <h4>Profile</h4>
            <p>Name: John Customer</p>
            <p>Email: customer@example.com</p>
            <p>Phone: +1-555-0100</p>
            <button className="btn outline">Edit Profile</button>
          </div>
        )}

        {tab === 'orders' && (
          <div>
            <h4>Orders</h4>
            <p>Use the Orders page (same design as Admin) — sample orders will show when you enable mocks.</p>
          </div>
        )}

        {tab === 'addresses' && (
          <div>
            <h4>Addresses</h4>
            <p>No addresses yet. Add a default address for smooth checkout.</p>
            <button className="btn primary">Add Address</button>
          </div>
        )}
      </div>
    </div>
  );
}
