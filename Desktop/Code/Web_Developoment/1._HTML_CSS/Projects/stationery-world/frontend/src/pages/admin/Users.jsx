import { useEffect, useState, useMemo } from 'react';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [filterRole, setFilterRole] = useState('ALL');
  const [search, setSearch] = useState('');

  const [selectedUser, setSelectedUser] = useState(null); // user object
  const [panelOpen, setPanelOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/user/all');
      if (!res.ok) {
        const t = await res.text();
        setError(`API error ${res.status}: ${t.slice(0,200)}`);
      } else {
        const data = await res.json();
        if (data?.success) setUsers(data.data || []);
        else setError(data?.message || 'Failed to load users');
      }
    } catch (err) {
      console.error('Users load error', err);
      setError(err.message || 'Network error');
    }
    setLoading(false);
  }

  const displayed = useMemo(() => {
    return users.filter(u => {
      if (filterRole !== 'ALL' && u.role !== filterRole) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (u.name || '').toLowerCase().includes(q) || String(u.id).toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
    });
  }, [users, filterRole, search]);

  function openPanel(u) {
    setSelectedUser(u);
    setPanelOpen(true);
  }
  function closePanel() {
    setPanelOpen(false);
    setTimeout(() => setSelectedUser(null), 300);
  }

  async function toggleActive(u) {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/user/${u.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !u.isActive }) });
      const data = await res.json();
      if (data?.success) {
        setUsers(list => list.map(x => x.id === data.data.id ? data.data : x));
        setSelectedUser(data.data);
      } else {
        alert('Error: ' + (data?.message || 'Failed'));
      }
    } catch (err) { console.error(err); alert('Request failed'); }
    setActionLoading(false);
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Users</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={filterRole} onChange={e => setFilterRole(e.target.value)}>
            <option value="ALL">All</option>
            <option value="ADMIN">Admins</option>
            <option value="CUSTOMER">Customers</option>
          </select>
          <input placeholder="Search by name, id, email..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 220 }} />
          <button className="btn outline" onClick={loadUsers}>Refresh</button>
        </div>
      </div>

      {loading && <div style={{ marginTop: 12 }}>Loading...</div>}
      {error && <div style={{ marginTop: 12, color: 'crimson' }}>Error: {error}</div>}

      {!loading && !error && (
        <div style={{ marginTop: 12 }}>
          <table className="reports-table users-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Name (UID)</th>
                <th>Role</th>
                <th>Email</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map(u => (
                <tr key={u.id} className="user-row" onClick={() => openPanel(u)} style={{ cursor: 'pointer' }}>
                  <td><strong>{u.name}</strong> <span className="muted">({u.id})</span></td>
                  <td>{u.role}</td>
                  <td>{u.email || '-'}</td>
                  <td>{u.isActive ? 'Active' : 'Blocked'}</td>
                  <td>
                    <button className="btn outline" onClick={e => { e.stopPropagation(); openPanel(u); }}>View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Slide-in panel */}
      <div className={`slide-overlay ${panelOpen ? 'open' : ''}`} onClick={closePanel} />
      <aside className={`slide-panel ${panelOpen ? 'open' : ''}`} role="dialog" aria-hidden={!panelOpen}>
        {selectedUser ? (
          <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ margin: 0 }}>{selectedUser.name}</h4>
                <div className="muted">({selectedUser.id}) • <span style={{ textTransform: 'capitalize' }}>{selectedUser.role}</span></div>
              </div>
              <div>
                <button className="btn outline" onClick={closePanel}>Close</button>
              </div>
            </div>

            <div style={{ display:'flex', gap: 12, marginTop: 12 }}>
              <div style={{ width: 96, height: 96, borderRadius: 8, background: '#f1f5f9', overflow: 'hidden' }}>
                {selectedUser.photoUrl ? <img src={selectedUser.photoUrl} alt="profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ padding: 12 }} className="muted">No photo</div>}
              </div>
              <div style={{ flex: 1 }}>
                <div><strong>Email:</strong> {selectedUser.email || '-'}</div>
                <div><strong>Phone:</strong> {selectedUser.phone || '-'}</div>
                <div><strong>Address:</strong> {selectedUser.addressLine1 ? `${selectedUser.addressLine1} ${selectedUser.addressLine2 || ''}, ${selectedUser.city || ''} ${selectedUser.state || ''} ${selectedUser.postalCode || ''}` : '-'}</div>
                <div style={{ marginTop: 8 }}><strong>Status:</strong> {selectedUser.isActive ? 'Active' : 'Blocked'}</div>

                <div style={{ marginTop: 12 }}>
                  <button className="btn primary" onClick={() => { toggleActive(selectedUser); }}>{selectedUser.isActive ? 'Block user' : 'Unblock user'}</button>
                  <a style={{ marginLeft: 8 }} className="btn outline" href={`/admin/orders?userId=${selectedUser.id}`}>View Orders</a>
                </div>
              </div>
            </div>

            {/* Activity summary placeholders */}
            <div style={{ marginTop: 16 }}>
              <h5 style={{ marginBottom: 8 }}>Activity summary</h5>
              <div className="row" style={{ gap: 12 }}>
                <div className="card" style={{ padding: 10, flex: 1 }}>Total Orders<br/><strong>{selectedUser._meta?.totalOrders ?? '-'}</strong></div>
                <div className="card" style={{ padding: 10, flex: 1 }}>Last Order<br/><strong>{selectedUser._meta?.lastOrder ? new Date(selectedUser._meta.lastOrder).toLocaleDateString() : '-'}</strong></div>
              </div>
            </div>

          </div>
        ) : (
          <div style={{ padding: 16 }}>Loading...</div>
        )}
      </aside>

    </div>
  );
}