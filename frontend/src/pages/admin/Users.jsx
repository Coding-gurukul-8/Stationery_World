import { useEffect, useState, useMemo } from 'react';
import { authUtils } from '../../utils/auth';
import { useSearch } from '../../context/SearchContext';
import './Reports.css';
import { API_BASE_URL } from '../../config/constants';

const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 150 150'%3E%3Ccircle cx='75' cy='75' r='75' fill='%239ca3af'/%3E%3Cpath d='M75 40c-11 0-20 9-20 20s9 20 20 20 20-9 20-20-9-20-20-20zm0 60c-16.5 0-30 8.5-30 19v6h60v-6c0-10.5-13.5-19-30-19z' fill='%23fff'/%3E%3C/svg%3E";

const API = API_BASE_URL;

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [filterRole, setFilterRole] = useState('ALL');
  const [search, setSearch] = useState('');

  const [selectedUser, setSelectedUser] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const { registerSearchHandler, unregisterSearchHandler } = useSearch();

  useEffect(() => {
    loadUsers();
  }, []);

  // Get image URL helper
  const getImageUrl = (photoUrl) => {
    if (!photoUrl) return DEFAULT_AVATAR;
    if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://') || photoUrl.startsWith('data:')) {
      return photoUrl;
    }
    if (photoUrl.startsWith('/uploads/')) {
      return `${API}${photoUrl}`;
    }
    return photoUrl;
  };

  // Register smart search for this page
  useEffect(() => {
    const searchUsers = async (query) => {
      const q = query.toLowerCase().trim();
      return users
        .filter(u => 
          u.name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          String(u.id).includes(q) ||
          u.phone?.includes(q)
        )
        .slice(0, 10)
        .map(u => ({
          id: u.id,
          title: u.name,
          subtitle: `${u.email} • ${u.role}`,
          image: getImageUrl(u.photoUrl),
          badge: u.isActive ? 'Active' : 'Blocked',
          onClick: () => openPanel(u)
        }));
    };

    registerSearchHandler('users', searchUsers, 'Search users by name, email, or ID...');

    return () => unregisterSearchHandler();
  }, [users, registerSearchHandler, unregisterSearchHandler]);

  async function loadUsers() {
    setLoading(true);
    setError(null);

    try {
      const token = authUtils.getToken();

      if (!token) {
        setError('Not authenticated. Please login.');
        setLoading(false);
        return;
      }

      const res = await fetch(`${API}/api/user/all`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('Users response status:', res.status);

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`API error ${res.status}: ${text.slice(0, 200)}`);
      }

      const data = await res.json();
      console.log('Users data:', data);

      if (data?.success) {
        setUsers(data.data || []);
      } else {
        setError(data?.message || 'Failed to load users');
      }
    } catch (err) {
      console.error('Users load error:', err);
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }

  const displayed = useMemo(() => {
    return users.filter(u => {
      if (filterRole !== 'ALL' && u.role !== filterRole) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        (u.name || '').toLowerCase().includes(q) || 
        String(u.id).toLowerCase().includes(q) || 
        (u.email || '').toLowerCase().includes(q)
      );
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
    if (!confirm(`Are you sure you want to ${u.isActive ? 'block' : 'unblock'} ${u.name}?`)) {
      return;
    }

    setActionLoading(true);

    try {
      const token = authUtils.getToken();

      const res = await fetch(`${API}/api/user/profile/${u.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isActive: !u.isActive })
      });

      const data = await res.json();
      console.log('Toggle active response:', data);

      if (data?.success) {
        setUsers(list => list.map(x => x.id === data.data.id ? data.data : x));
        setSelectedUser(data.data);
        alert(`✅ User ${data.data.isActive ? 'unblocked' : 'blocked'} successfully!`);
      } else {
        alert('❌ Error: ' + (data?.message || 'Failed to update user'));
      }
    } catch (err) {
      console.error('Toggle active error:', err);
      alert('❌ Request failed: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  }

  const getRoleBadgeStyle = (role) => {
    if (role === 'ADMIN') {
      return { background: '#fce4ec', color: '#c2185b', fontWeight: 600 };
    }
    return { background: '#e3f2fd', color: '#1976d2', fontWeight: 500 };
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Users Management</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select 
            value={filterRole} 
            onChange={e => setFilterRole(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 4,
              border: '1px solid #ddd',
              fontSize: 14
            }}
          >
            <option value="ALL">All Users</option>
            <option value="ADMIN">Admins</option>
            <option value="CUSTOMER">Customers</option>
          </select>
          <input 
            placeholder="Search by name, id, email..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            style={{ 
              width: 220,
              padding: '8px 12px',
              borderRadius: 4,
              border: '1px solid #ddd',
              fontSize: 14
            }} 
          />
          <button 
            className="btn outline" 
            onClick={loadUsers}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {loading && <div style={{ marginTop: 12 }}>Loading users...</div>}

      {error && (
        <div style={{ 
          marginTop: 12, 
          padding: 12, 
          background: '#f8d7da', 
          color: '#721c24',
          borderRadius: 4,
          border: '1px solid #f5c6cb'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {!loading && !error && displayed.length === 0 && (
        <div style={{ marginTop: 12, textAlign: 'center', padding: 20, color: '#666' }}>
          No users found
        </div>
      )}

      {!loading && !error && displayed.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ marginBottom: 12, fontSize: 14, color: '#666' }}>
            Showing {displayed.length} user{displayed.length !== 1 ? 's' : ''}
          </div>

          <table className="reports-table users-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Role</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map(u => (
                <tr 
                  key={u.id} 
                  className="user-row" 
                  onClick={() => openPanel(u)} 
                  style={{ cursor: 'pointer' }}
                >
                  <td>{u.id}</td>
                  <td><strong>{u.name}</strong></td>
                  <td>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: 4,
                      fontSize: 12,
                      ...getRoleBadgeStyle(u.role)
                    }}>
                      {u.role}
                    </span>
                  </td>
                  <td>{u.email || '-'}</td>
                  <td>{u.phone || '-'}</td>
                  <td>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: 4,
                      fontSize: 12,
                      background: u.isActive ? '#c8e6c9' : '#ffcdd2',
                      color: u.isActive ? '#2e7d32' : '#c62828',
                      fontWeight: 500
                    }}>
                      {u.isActive ? 'Active' : 'Blocked'}
                    </span>
                  </td>
                  <td>
                    <button 
                      className="btn outline" 
                      onClick={e => { 
                        e.stopPropagation(); 
                        openPanel(u); 
                      }}
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Slide-in panel overlay */}
      <div 
        className={`slide-overlay ${panelOpen ? 'open' : ''}`} 
        onClick={closePanel} 
      />

      {/* Slide-in panel */}
      <aside 
        className={`slide-panel ${panelOpen ? 'open' : ''}`} 
        role="dialog" 
        aria-hidden={!panelOpen}
      >
        {selectedUser ? (
          <div style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h4 style={{ margin: 0, fontSize: 20, color: '#1f2937' }}>{selectedUser.name}</h4>
                <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                  User ID: {selectedUser.id} • 
                  <span style={{
                    marginLeft: 6,
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 11,
                    ...getRoleBadgeStyle(selectedUser.role)
                  }}>
                    {selectedUser.role}
                  </span>
                </div>
              </div>
              <button className="btn outline" onClick={closePanel}>✕ Close</button>
            </div>

            <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
              <div style={{ 
                width: 120, 
                height: 120, 
                borderRadius: 8, 
                overflow: 'hidden',
                border: '2px solid #e5e7eb',
                flexShrink: 0
              }}>
                <img 
                  src={getImageUrl(selectedUser.photoUrl)} 
                  alt="profile" 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => {
                    e.target.src = DEFAULT_AVATAR;
                  }}
                />
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ marginBottom: 10 }}>
                  <strong style={{ fontSize: 13, color: '#666' }}>Email:</strong>
                  <div style={{ fontSize: 14, color: '#333' }}>{selectedUser.email || '-'}</div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <strong style={{ fontSize: 13, color: '#666' }}>Phone:</strong>
                  <div style={{ fontSize: 14, color: '#333' }}>{selectedUser.phone || '-'}</div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <strong style={{ fontSize: 13, color: '#666' }}>Status:</strong>
                  <div>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: 4,
                      fontSize: 13,
                      background: selectedUser.isActive ? '#c8e6c9' : '#ffcdd2',
                      color: selectedUser.isActive ? '#2e7d32' : '#c62828',
                      fontWeight: 600
                    }}>
                      {selectedUser.isActive ? '✓ Active' : '✗ Blocked'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ 
              padding: 16, 
              background: '#f9fafb', 
              borderRadius: 8,
              marginBottom: 20
            }}>
              <h5 style={{ margin: '0 0 12px 0', fontSize: 15, color: '#374151' }}>Address Information</h5>
              {selectedUser.addressLine1 ? (
                <>
                  <div style={{ fontSize: 14, color: '#4b5563' }}>{selectedUser.addressLine1}</div>
                  {selectedUser.addressLine2 && (
                    <div style={{ fontSize: 14, color: '#4b5563' }}>{selectedUser.addressLine2}</div>
                  )}
                  <div style={{ fontSize: 14, color: '#4b5563' }}>
                    {selectedUser.city} {selectedUser.state} {selectedUser.postalCode}
                  </div>
                  {selectedUser.country && (
                    <div style={{ fontSize: 14, color: '#4b5563' }}>{selectedUser.country}</div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 14, color: '#9ca3af' }}>No address provided</div>
              )}
            </div>

            <div style={{ 
              padding: 16, 
              background: '#f9fafb', 
              borderRadius: 8,
              marginBottom: 20
            }}>
              <h5 style={{ margin: '0 0 12px 0', fontSize: 15, color: '#374151' }}>Account Details</h5>
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 6 }}>
                <strong>Created:</strong> {new Date(selectedUser.createdAt).toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: 13, color: '#6b7280' }}>
                <strong>Last Updated:</strong> {new Date(selectedUser.updatedAt).toLocaleString('en-IN')}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button 
                className="btn primary" 
                onClick={() => toggleActive(selectedUser)}
                disabled={actionLoading}
                style={{
                  flex: 1,
                  background: selectedUser.isActive ? '#dc2626' : '#16a34a',
                  padding: '10px 16px'
                }}
              >
                {actionLoading ? 'Processing...' : (selectedUser.isActive ? '🚫 Block User' : '✓ Unblock User')}
              </button>
              <button 
                className="btn outline" 
                onClick={() => {
                  window.location.href = `/admin/orders?userId=${selectedUser.id}`;
                }}
                style={{ flex: 1, padding: '10px 16px' }}
              >
                📋 View Orders
              </button>
            </div>

            {/* Activity summary */}
            <div style={{ marginTop: 24 }}>
              <h5 style={{ marginBottom: 12, fontSize: 15, color: '#374151' }}>Activity Summary</h5>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ 
                  padding: 16, 
                  background: '#eff6ff', 
                  borderRadius: 8,
                  border: '1px solid #dbeafe'
                }}>
                  <div style={{ fontSize: 12, color: '#1e40af', marginBottom: 4 }}>Total Orders</div>
                  <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1e3a8a' }}>
                    {selectedUser._meta?.totalOrders ?? 0}
                  </div>
                </div>
                <div style={{ 
                  padding: 16, 
                  background: '#f0fdf4', 
                  borderRadius: 8,
                  border: '1px solid #bbf7d0'
                }}>
                  <div style={{ fontSize: 12, color: '#15803d', marginBottom: 4 }}>Last Order</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#166534' }}>
                    {selectedUser._meta?.lastOrder 
                      ? new Date(selectedUser._meta.lastOrder).toLocaleDateString('en-IN')
                      : 'Never'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: 20 }}>Loading...</div>
        )}
      </aside>
    </div>
  );
}