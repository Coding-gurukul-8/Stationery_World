import { useEffect, useState } from 'react';
import { authUtils } from '../../utils/auth';
import { useSearch } from '../../context/SearchContext';
import './BargainRequests.css';

const API = 'http://localhost:3000';

export default function BargainRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [actionLoading, setActionLoading] = useState({});
  const [grantForm, setGrantForm] = useState({ userId: '', productId: '', expiresAt: '' });

  const { registerSearchHandler, unregisterSearchHandler, searchQuery } = useSearch();

  useEffect(() => {
    loadRequests();
  }, [statusFilter]);

  useEffect(() => {
    const handleSearch = async (query) => {
      const q = query.toLowerCase().trim();
      return requests
        .filter(req =>
          (req.user?.name || '').toLowerCase().includes(q) ||
          (req.user?.email || '').toLowerCase().includes(q) ||
          (req.product?.name || '').toLowerCase().includes(q) ||
          String(req.id).includes(q)
        )
        .slice(0, 10)
        .map(req => ({
          id: req.id,
          title: `Request #${req.id} — ${req.product?.name || 'No product'}`,
          subtitle: `${req.user?.name || 'Unknown'} • ${req.status}`,
          badge: req.status,
          onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' })
        }));
    };
    registerSearchHandler('bargain requests', handleSearch, 'Search requests...');
    return () => unregisterSearchHandler();
  }, [requests, registerSearchHandler, unregisterSearchHandler]);

  const loadRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = authUtils.getToken();
      const res = await fetch(`${API}/api/bargain/admin/requests?status=${statusFilter}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Failed to load requests');
      setRequests(data.data || []);
    } catch (err) {
      console.error('Load bargain requests error', err);
      setError(err.message || 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (reqId) => {
    const confirmMsg = 'Approve this request and grant bargaining permission?';
    if (!window.confirm(confirmMsg)) return;

    const expiresAt = window.prompt('Expiry date (ISO format) — leave empty for no expiry (recommended):', '');
    setActionLoading(prev => ({ ...prev, [reqId]: 'approving' }));

    try {
      const token = authUtils.getToken();
      const res = await fetch(`${API}/api/bargain/admin/requests/${reqId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ expiresAt: expiresAt || undefined })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Approve failed');
      alert('Request approved and permission granted.');
      loadRequests();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [reqId]: null }));
    }
  };

  const handleDeny = async (reqId) => {
    const reason = window.prompt('Reason for denying (optional):', '');
    setActionLoading(prev => ({ ...prev, [reqId]: 'denying' }));

    try {
      const token = authUtils.getToken();
      const res = await fetch(`${API}/api/bargain/admin/requests/${reqId}/deny`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ note: reason || '' })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Deny failed');
      alert('Request denied.');
      loadRequests();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [reqId]: null }));
    }
  };

  const handleGrantPermission = async () => {
    const { userId, productId, expiresAt } = grantForm;
    if (!userId || !productId) {
      alert('User ID and Product ID are required');
      return;
    }
    setActionLoading(prev => ({ ...prev, grant: true }));
    try {
      const token = authUtils.getToken();
      const res = await fetch(`${API}/api/bargain/admin/permission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId, productId, expiresAt: expiresAt || undefined })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Grant failed');
      alert('Permission granted.');
      setGrantForm({ userId: '', productId: '', expiresAt: '' });
      loadRequests();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, grant: false }));
    }
  };

  const statusOptions = ['PENDING', 'APPROVED', 'DENIED'];

  const renderRequestRow = (req) => {
    const user = req.user || {};
    const product = req.product || {};
    const isPending = req.status === 'PENDING';

    return (
      <div key={req.id} className="bargain-request-row">
        <div className="bargain-request-info">
          <div className="bargain-request-meta">
            <span className="request-id">#{req.id}</span>
            <span className={`request-status ${req.status.toLowerCase()}`}>{req.status}</span>
            <span className="request-date">{new Date(req.createdAt).toLocaleString()}</span>
          </div>
          <div className="request-details">
            <div><strong>Customer:</strong> {user.name || 'Unknown'} ({user.email || 'no-email'})</div>
            <div><strong>Product:</strong> {product.name || '—'} (ID: {product.id})</div>
            {req.note && <div className="request-note"><strong>Note:</strong> {req.note}</div>}
          </div>
        </div>
        <div className="bargain-request-actions">
          <button
            className="btn-approve"
            disabled={!isPending || actionLoading[req.id]}
            onClick={() => handleApprove(req.id)}
          >
            {actionLoading[req.id] === 'approving' ? 'Approving…' : 'Approve'}
          </button>
          <button
            className="btn-deny"
            disabled={!isPending || actionLoading[req.id]}
            onClick={() => handleDeny(req.id)}
          >
            {actionLoading[req.id] === 'denying' ? 'Denying…' : 'Deny'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="bargain-requests-container">
      <div className="card">
        <div className="bargain-requests-header">
          <h3>Bargain Requests</h3>
          <div className="bargain-requests-controls">
            <label>
              Status:
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                {statusOptions.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </label>
            <button className="btn-refresh" onClick={loadRequests} disabled={loading}>
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading-spinner">
            <div className="spinner" />
            <p>Loading requests…</p>
          </div>
        ) : error ? (
          <div className="error-message">
            <p>{error}</p>
            <button onClick={loadRequests}>Retry</button>
          </div>
        ) : (
          <div className="requests-list">
            {requests.length === 0 ? (
              <div className="empty-state">
                <p>No requests found for the selected status.</p>
              </div>
            ) : (
              requests.map(renderRequestRow)
            )}
          </div>
        )}

        <div className="grant-permission-card">
          <h4>Grant Permission Manually</h4>
          <p className="hint">Enter user and product IDs, then grant access directly (optional expiry).</p>
          <div className="grant-grid">
            <input
              type="text"
              placeholder="User ID"
              value={grantForm.userId}
              onChange={e => setGrantForm(f => ({ ...f, userId: e.target.value }))}
            />
            <input
              type="text"
              placeholder="Product ID"
              value={grantForm.productId}
              onChange={e => setGrantForm(f => ({ ...f, productId: e.target.value }))}
            />
            <input
              type="datetime-local"
              placeholder="Expires at (optional)"
              value={grantForm.expiresAt}
              onChange={e => setGrantForm(f => ({ ...f, expiresAt: e.target.value }))}
            />
            <button
              className="btn-grant"
              onClick={handleGrantPermission}
              disabled={actionLoading.grant}
            >
              {actionLoading.grant ? 'Granting…' : 'Grant Permission'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
