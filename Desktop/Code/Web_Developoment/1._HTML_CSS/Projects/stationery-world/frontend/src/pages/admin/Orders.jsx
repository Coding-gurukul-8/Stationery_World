import { useEffect, useState } from 'react';
import './Reports.css';

const ORDER_TYPES = [ { id: 'SELF', label: 'Self Orders' }, { id: 'OTHERS', label: 'Orders of Others' } ];

const STATUS_OPTIONS = ['PENDING','PROCESSING','SHIPPED','DELIVERED','CANCELLED'];

export default function Orders() {
  const [type, setType] = useState('SELF');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [error, setError] = useState(null); // UI error state to show helpful messages

  const useMock = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mock') === 'true';

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      if (useMock) {
        // Dev-only: fetch mock data from backend route
        const res = await fetch('/api/orders/mock');
        const data = await res.json();
        if (data?.success) setOrders(data.data || []);
        else setError(data?.message || 'Failed to load mock orders');
      } else if (type === 'SELF') {
        const res = await fetch('/api/orders/self');
        if (!res.ok) {
          const text = await res.text();
          setError(`API error ${res.status}: ${text.slice(0,200)}`);
        } else {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const data = await res.json();
            if (data?.success) setOrders(data.data || []);
            else setError(data?.message || 'Failed to load orders');
          } else {
            const text = await res.text();
            setError('Server returned non-JSON response — check backend. ' + text.slice(0,200));
          }
        }
      } else {
        const res = await fetch('/api/orders');
        if (!res.ok) {
          const text = await res.text();
          setError(`API error ${res.status}: ${text.slice(0,200)}`);
        } else {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const data = await res.json();
            if (data?.success) setOrders(data.data || []);
            else setError(data?.message || 'Failed to load orders');
          } else {
            const text = await res.text();
            setError('Server returned non-JSON response — check backend. ' + text.slice(0,200));
          }
        }
      }
    } catch (err) { console.error('Orders load error', err); setError(err.message || 'Network error'); }
    setLoading(false);
  }

  function openDetails(o) {
    setSelected(o);
  }

  function closeDetails() { setSelected(null); }

  async function changeStatus(orderId, newStatus) {
    setStatusLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) });
      const data = await res.json();
      if (data?.success) {
        setOrders(prev => prev.map(p => p.id === data.data.id ? data.data : p));
        alert('Status updated');
      } else {
        alert('Error: ' + (data?.message || 'Update failed'));
      }
    } catch (err) { console.error(err); alert('Request failed'); }
    setStatusLoading(false);
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent:'space-between', alignItems:'center' }}>
        <h3>Orders</h3>
        <div>
          <select value={type} onChange={e=>setType(e.target.value)}>
            {ORDER_TYPES.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {loading && <div>Loading...</div>}

      {error && <div style={{ marginTop: 12, color: 'crimson' }}>Error: {error}</div>}

      {!loading && !error && orders.length === 0 && <div style={{ marginTop: 12 }}>No orders yet</div>}

      {!loading && orders.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <table className="reports-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Date</th>
                <th>Person</th>
                <th>Amount</th>
                <th>Type</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id}>
                  <td>{o.uid}</td>
                  <td>{new Date(o.createdAt).toLocaleString()}</td>
                  <td>{o.placedBy ? `${o.placedBy.name} (${o.placedBy.id})` : o.recipientName}</td>
                  <td>{(() => {
                    const total = (o.totalSp !== undefined && o.totalSp !== null) ? Number(o.totalSp) : (Array.isArray(o.items) ? o.items.reduce((s,it)=>s+Number(it.subtotalSp||0),0) : 0);
                    return total.toFixed(2);
                  })()}</td>
                  <td>{o.type}</td>
                  <td>
                    {type === 'OTHERS' ? (
                      <select value={o.status} onChange={e => changeStatus(o.id, e.target.value)} disabled={statusLoading}>
                        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <span>{o.status}</span>
                    )}
                  </td>
                  <td>
                    <button className="btn outline" onClick={()=>openDetails(o)}>View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Details modal */}
      {selected && (
        <div className="modal">
          <div className="modal-content">
            <h4>Order {selected.uid}</h4>
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <h5>Recipient / Placed By</h5>
                <div><strong>{selected.placedBy ? selected.placedBy.name : selected.recipientName}</strong></div>
                <div>{selected.recipientPhone || (selected.placedBy && selected.placedBy.email) || '-'}</div>
                <div style={{ marginTop: 8 }}>{selected.addressLine1 || ''} {selected.addressLine2 || ''}</div>
                <div>{selected.city || ''} {selected.state || ''} {selected.postalCode || ''}</div>
                <div>{selected.country || ''}</div>
              </div>

              <div style={{ flex: 1 }}>
                <h5>Products</h5>
                <table style={{ width: '100%' }}>
                  <thead>
                    <tr><th>Photo</th><th>Name</th><th>Qty</th><th>SP</th><th>CP</th><th>Subtotal</th></tr>
                  </thead>
                  <tbody>
                    {selected.items.map((it, idx) => (
                      <tr key={idx}>
                        <td>{it.productPhoto ? <img src={it.productPhoto} alt="p" style={{ width:48, height:48, objectFit:'cover', borderRadius:6 }} /> : '-'}</td>
                        <td>{it.productName}</td>
                        <td>{it.quantity}</td>
                        <td>{it.sp.toFixed(2)}</td>
                        <td>{it.cp.toFixed(2)}</td>
                        <td>{(it.subtotalSp).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ marginTop: 12 }}>
                  <strong>Total SP: </strong> {selected.totalSp?.toFixed?.(2) || (selected.items.reduce((s,it)=>s+it.subtotalSp,0)).toFixed(2)}
                </div>
                <div><strong>Total CP: </strong> {selected.totalCp?.toFixed?.(2) || (selected.items.reduce((s,it)=>s+it.subtotalCp,0)).toFixed(2)}</div>
                <div><strong>Profit Impact: </strong>{selected.type === 'SELF' ? `- ${ (selected.totalCp||0).toFixed(2) }` : `+ ${ ((selected.totalSp||0)-(selected.totalCp||0)).toFixed(2) }`}</div>

                {/* Audit trail */}
                {selected.audits && selected.audits.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <h5>Audit trail</h5>
                    <ul style={{ maxHeight: 180, overflow: 'auto', paddingLeft: 0, listStyle: 'none' }}>
                      {selected.audits.map((a, idx) => (
                        <li key={idx} style={{ padding: 6, borderBottom: '1px solid #f1f5f9' }}>
                          <div><strong>{a.admin ? a.admin.name : 'System'}</strong> — {a.fromStatus} → {a.toStatus}</div>
                          {a.note && <div className="muted">{a.note}</div>}
                          <div className="muted">{new Date(a.createdAt).toLocaleString()}</div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <button className="btn outline" onClick={closeDetails}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
