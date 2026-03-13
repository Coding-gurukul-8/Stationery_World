import { useState, useEffect, useCallback } from 'react';
import { ShoppingCart, Trash2, Plus, Minus, Loader, Package, ArrowRight, ShoppingBag, X } from 'lucide-react';
import './Cart.css';

const API = 'http://localhost:3000';
const getImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API}${url}`;
};

export default function Cart() {
  const [cart, setCart] = useState({ items: [], subtotal: 0, itemCount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  const [bargainStatuses, setBargainStatuses] = useState({});
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(null);
  const [checkoutForm, setCheckoutForm] = useState({
    recipientName: '', recipientPhone: '', addressLine1: '', addressLine2: '',
    city: '', state: '', postalCode: '', country: '', note: ''
  });

  const fetchCart = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/cart`, { headers: { Authorization: `Bearer ${token}` } });
      const result = await res.json();
      if (!result.success) throw new Error(result.message);
      setCart(result.data || { items: [], subtotal: 0, itemCount: 0 });
      setError(null);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchCart();
    fetchBargainRequests();

    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      setCheckoutForm(f => ({
        ...f,
        recipientName: user.name || '', recipientPhone: user.phone || '',
        addressLine1: user.addressLine1 || '', addressLine2: user.addressLine2 || '',
        city: user.city || '', state: user.state || '',
        postalCode: user.postalCode || '', country: user.country || '',
      }));
    } catch {}
  }, [fetchCart]);

  const fetchBargainRequests = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/bargain/requests`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!data.success) return;
      const map = {};
      (data.data || []).forEach(req => {
        map[req.productId] = req.status;
      });
      setBargainStatuses(map);
    } catch (err) {
      console.error('Failed to load bargain requests', err);
    }
  };

  const updateQuantity = async (cartItemId, newQty) => {
    setActionLoading(p => ({ ...p, [cartItemId]: 'qty' }));
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/cart/${cartItemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ quantity: newQty })
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.message);
      await fetchCart();
    } catch (err) { alert('Error: ' + err.message); }
    finally { setActionLoading(p => ({ ...p, [cartItemId]: null })); }
  };

  const removeItem = async (cartItemId) => {
    setActionLoading(p => ({ ...p, [cartItemId]: 'remove' }));
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/cart/${cartItemId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const result = await res.json();
      if (!result.success) throw new Error(result.message);
      await fetchCart();
    } catch (err) { alert('Error: ' + err.message); }
    finally { setActionLoading(p => ({ ...p, [cartItemId]: null })); }
  };

  const clearCart = async () => {
    if (!window.confirm('Remove all items from cart?')) return;
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API}/api/cart/clear/all`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      await fetchCart();
    } catch (err) { alert('Error: ' + err.message); }
  };

  const handleCheckout = async () => {
    if (!checkoutForm.recipientName) { alert('Recipient name is required'); return; }
    setCheckoutLoading(true);
    try {
      const token = localStorage.getItem('token');
      const orderRes = await fetch(`${API}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(checkoutForm)
      });
      const orderResult = await orderRes.json();
      if (!orderResult.success) throw new Error(orderResult.message);
      const confirmRes = await fetch(`${API}/api/orders/${orderResult.data.id}/confirm`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }
      });
      const confirmResult = await confirmRes.json();
      if (!confirmResult.success) throw new Error(confirmResult.message);
      setCheckoutSuccess({ orderId: orderResult.data.id, uid: orderResult.data.uid, total: cart.subtotal });
      await fetchCart();
    } catch (err) { alert('Order failed: ' + err.message); }
    finally { setCheckoutLoading(false); }
  };

  const fmt = (n) => `₹${parseFloat(n || 0).toFixed(2)}`;

  if (loading) return (
    <div className="card cart-centered">
      <Loader size={40} className="cart-loader" />
      <p className="mt-16 text-muted">Loading your cart...</p>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (error) return (
    <div className="card cart-centered-small cart-error">
      <p>Error: {error}</p>
      <button onClick={fetchCart} className="retry-btn">Retry</button>
    </div>
  );

  const items = cart.items || [];

  if (items.length === 0) return (
    <div className="card cart-empty">
      <ShoppingCart size={80} style={{ color: '#e2e8f0', marginBottom: 20 }} />
      <h3>Your cart is empty</h3>
      <p>Add products from the shop to get started!</p>
      <button onClick={() => window.location.href = '/customer'} className="browse-btn">
        <ShoppingBag size={18} /> Browse Products
      </button>
    </div>
  );

  return (
    <div className="cart-container" style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div className="cart-header">
        <h2>
          <ShoppingCart size={24} color="#3b82f6" />
          My Cart
          <span className="item-count">
            {items.length} item{items.length !== 1 ? 's' : ''}
          </span>
        </h2>
        <button onClick={clearCart} className="clear-btn">
          Clear All
        </button>
      </div>

      <div className="cart-grid">
        {/* Items list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {items.map(item => {
            const product = item.product;
            const imgUrl = getImageUrl(product?.images?.[0]?.url);
            const busy = actionLoading[item.id];
            return (
              <div key={item.id} style={{
                background: 'var(--bg-surface)', borderRadius: 14, border: '1px solid var(--border)',
                padding: 16, display: 'flex', gap: 16, alignItems: 'center',
                opacity: busy ? 0.6 : 1, transition: 'opacity .2s'
              }}>
                <div style={{ width: 84, height: 84, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: 'var(--bg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {imgUrl ? (
                    <img src={imgUrl} alt={product?.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                  ) : <Package size={30} color="#cbd5e1" />}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <span>{product?.name || 'Product'}</span>
                    {bargainStatuses[product?.id] && (
                      <span style={{
                        padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                        textTransform: 'uppercase',
                        background: bargainStatuses[product.id] === 'APPROVED' ? 'rgba(34,197,94,0.12)' : bargainStatuses[product.id] === 'DENIED' ? 'rgba(239,68,68,0.12)' : 'rgba(59,130,246,0.12)',
                        color: bargainStatuses[product.id] === 'APPROVED' ? 'var(--green)' : bargainStatuses[product.id] === 'DENIED' ? 'var(--red)' : 'var(--blue)',
                        border: '1px solid',
                        borderColor: bargainStatuses[product.id] === 'APPROVED' ? 'rgba(34,197,94,0.2)' : bargainStatuses[product.id] === 'DENIED' ? 'rgba(239,68,68,0.2)' : 'rgba(59,130,246,0.2)'
                      }}>
                        {bargainStatuses[product.id].toLowerCase()}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, marginBottom: 6 }}>
                    {product?.category}{product?.subCategory ? ` · ${product.subCategory}` : ''}
                    {/* ✅ SELLER INFO ADDED */}
                    {product?.createdBy && (
                      <span style={{ marginLeft: 6, color: '#6b7280' }}>
                        · Sold by <strong>{product.createdBy.name}</strong>
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--gold)' }}>{fmt(item.priceAtAdd)}<span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 5 }}>each</span></div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <button onClick={() => item.quantity > 1 ? updateQuantity(item.id, item.quantity - 1) : removeItem(item.id)} disabled={!!busy} style={QB}>
                    <Minus size={13} />
                  </button>
                  <span style={{ minWidth: 26, textAlign: 'center', fontWeight: 700, fontSize: 15 }}>{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.id, item.quantity + 1)} disabled={!!busy || item.quantity >= (product?.totalStock || 99)} style={QB}>
                    <Plus size={13} />
                  </button>
                </div>

                <div style={{ minWidth: 80, textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#1f2937' }}>{fmt(item.priceAtAdd * item.quantity)}</div>
                  {item.quantity > 1 && <div style={{ fontSize: 11, color: '#9ca3af' }}>{item.quantity}×{fmt(item.priceAtAdd)}</div>}
                </div>

                <button onClick={() => removeItem(item.id)} disabled={!!busy}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', padding: 6, borderRadius: 6 }}>
                  {busy === 'remove' ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={17} />}
                </button>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div style={{ background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border)', padding: 22, position: 'sticky', top: 20 }}>
          <h3 style={{ margin: '0 0 18px 0', fontSize: 16, color: 'var(--text-primary)', fontWeight: 700 }}>Order Summary</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
            <div style={SR}><span style={{ color: '#6b7280' }}>Subtotal ({cart.itemCount})</span><span style={{ fontWeight: 600 }}>{fmt(cart.subtotal)}</span></div>
            <div style={SR}><span style={{ color: '#6b7280' }}>Shipping</span><span style={{ color: '#16a34a', fontWeight: 600 }}>FREE</span></div>
            <div style={{ borderTop: '2px solid var(--border)', paddingTop: 12, ...SR }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>Total</span>
              <span style={{ fontWeight: 800, fontSize: 19, color: 'var(--gold)' }}>{fmt(cart.subtotal)}</span>
            </div>
          </div>
          <button onClick={() => setShowCheckout(true)} style={{
            width: '100%', padding: '13px 0', background: 'linear-gradient(135deg,#2563eb,#1d4ed8)',
            color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
          }}>
            <ArrowRight size={17} /> Checkout
          </button>
          <button onClick={() => window.location.href = '/customer'} style={{ width: '100%', marginTop: 10, padding: '10px 0', background: 'none', border: '1px solid #d1d5db', color: '#374151', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            ← Continue Shopping
          </button>
        </div>
      </div>

      {/* Checkout Modal */}
      {showCheckout && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => !checkoutLoading && setShowCheckout(false)}>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            {checkoutSuccess ? (
              <div style={{ textAlign: 'center', padding: 24 }}>
                <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
                <h3 style={{ color: '#16a34a', fontSize: 20 }}>Order Placed!</h3>
                <p style={{ color: '#6b7280' }}>Order #{checkoutSuccess.uid}</p>
                <p style={{ color: '#1f2937', fontWeight: 700, fontSize: 18, margin: '12px 0 24px' }}>{fmt(checkoutSuccess.total)}</p>
                <button onClick={() => { setShowCheckout(false); setCheckoutSuccess(null); }}
                  style={{ padding: '11px 28px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>Done</button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                  <h3 style={{ margin: 0, color: '#1f2937', fontSize: 17 }}>Delivery Details</h3>
                  <button onClick={() => setShowCheckout(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={20} /></button>
                </div>
                <div style={{ background: '#eff6ff', borderRadius: 8, padding: '9px 14px', marginBottom: 18, fontSize: 13, color: '#1e40af' }}>
                  {items.length} item{items.length !== 1 ? 's' : ''} · <strong>{fmt(cart.subtotal)}</strong>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  {[['Recipient Name *','recipientName','text'],['Phone','recipientPhone','tel'],['Address Line 1','addressLine1','text'],['Address Line 2','addressLine2','text'],['City','city','text'],['State','state','text'],['Postal Code','postalCode','text'],['Country','country','text']].map(([label, field, type]) => (
                    <div key={field} style={{ gridColumn: ['addressLine1','addressLine2'].includes(field) ? 'span 2' : undefined }}>
                      <label style={{ display: 'block', fontSize: 11, color: '#6b7280', marginBottom: 3, fontWeight: 500 }}>{label}</label>
                      <input type={type} value={checkoutForm[field]} onChange={e => setCheckoutForm(f => ({ ...f, [field]: e.target.value }))}
                        style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' }} />
                    </div>
                  ))}
                </div>
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: 'block', fontSize: 11, color: '#6b7280', marginBottom: 3, fontWeight: 500 }}>Note</label>
                  <textarea rows={2} value={checkoutForm.note} onChange={e => setCheckoutForm(f => ({ ...f, note: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, boxSizing: 'border-box', resize: 'vertical' }} />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setShowCheckout(false)} disabled={checkoutLoading} style={{ flex: 1, padding: '11px 0', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-surface)', cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>Cancel</button>
                  <button onClick={handleCheckout} disabled={checkoutLoading || !checkoutForm.recipientName} style={{
                    flex: 2, padding: '11px 0', border: 'none', borderRadius: 8,
                    background: checkoutLoading || !checkoutForm.recipientName ? '#93c5fd' : '#2563eb',
                    cursor: checkoutLoading || !checkoutForm.recipientName ? 'not-allowed' : 'pointer',
                    fontSize: 13, color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                  }}>
                    {checkoutLoading ? 'Placing...' : <><ArrowRight size={15} /> Place Order</>}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

const QB = { width: 30, height: 30, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)' }; 
const SR = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 };