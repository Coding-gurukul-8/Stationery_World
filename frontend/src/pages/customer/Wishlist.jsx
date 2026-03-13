import { useState, useEffect } from 'react';
import { Heart, Trash2, ShoppingCart, Loader, Package, IndianRupee } from 'lucide-react';
import './Wishlist.css';
import ProductDetailModal from '../../components/shop/ProductDetailModal';

const API = 'http://localhost:3000';

export default function Wishlist() {
  const [wishlistItems, setWishlistItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  const [requestedBargains, setRequestedBargains] = useState({});
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [buyNowProduct, setBuyNowProduct] = useState(null);
  const [buyNowQty, setBuyNowQty] = useState(1);
  const [buyNowLoading, setBuyNowLoading] = useState(false);
  const [buyNowForm, setBuyNowForm] = useState({
    recipientName: '', recipientPhone: '', addressLine1: '', addressLine2: '',
    city: '', state: '', postalCode: '', country: '', note: ''
  });

  useEffect(() => {
    fetchWishlist();
    fetchBargainRequests();
  }, []);

  const fetchBargainRequests = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/bargain/requests`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.success) return;
      const statusMap = {};
      (data.data || []).forEach((req) => {
        statusMap[req.productId] = req.status;
      });
      setRequestedBargains(statusMap);
    } catch (err) {
      console.error('Failed to load bargain requests', err);
    }
  };

  const fetchWishlist = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API}/api/wishlist`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const result = await response.json();
      if (!result.success) throw new Error(result.message);
      setWishlistItems(result.data || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const removeFromWishlist = async (productId) => {
    try {
      setActionLoading(prev => ({ ...prev, [productId]: 'removing' }));
      const token = localStorage.getItem('token');
      const response = await fetch(`${API}/api/wishlist/${productId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.message);
      setWishlistItems(prev => prev.filter(item => item.productId !== productId));
    } catch (err) {
      alert('Error removing item: ' + err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [productId]: null }));
    }
  };

  const moveToCart = async (item) => {
    try {
      setActionLoading(prev => ({ ...prev, [item.productId]: 'moving' }));
      const token = localStorage.getItem('token');
      const response = await fetch(`${API}/api/wishlist/${item.productId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ quantity: 1 })
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.message);
      setWishlistItems(prev => prev.filter(i => i.productId !== item.productId));
      alert('Moved to cart successfully! 🛒');
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [item.productId]: null }));
    }
  };

  const requestBargain = async (item) => {
    try {
      setActionLoading(prev => ({ ...prev, [item.productId]: 'requesting' }));
      const token = localStorage.getItem('token');
      const response = await fetch(`${API}/api/bargain/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ productId: item.productId })
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.message);
      setRequestedBargains(prev => ({ ...prev, [item.productId]: result.data?.status || 'PENDING' }));
      alert('Bargain request submitted! The admin will review it soon.');
    } catch (err) {
      alert('Error requesting bargain: ' + err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [item.productId]: null }));
    }
  };

  const clearAll = async () => {
    if (!window.confirm('Remove all items from wishlist?')) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API}/api/wishlist/clear/all`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.message);
      setWishlistItems([]);
    } catch (err) {
      alert('Error clearing wishlist: ' + err.message);
    }
  };

  // Add to cart from modal
  const handleAddToCart = async (product) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API}/api/cart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ productId: product.id, quantity: 1 })
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.message);
      alert(`${product.name} added to cart! 🛒`);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleBuyNow = (product) => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      setBuyNowForm({
        recipientName: user?.name || '', recipientPhone: user?.phone || '',
        addressLine1: user?.addressLine1 || '', addressLine2: user?.addressLine2 || '',
        city: user?.city || '', state: user?.state || '',
        postalCode: user?.postalCode || '', country: user?.country || '', note: ''
      });
    } catch {}
    setBuyNowProduct(product);
    setBuyNowQty(1);
    setSelectedProduct(null);
  };

  const handleBuyNowSubmit = async () => {
    if (!buyNowProduct) return;
    setBuyNowLoading(true);
    try {
      const token = localStorage.getItem('token');
      const cartRes = await fetch(`${API}/api/cart`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ productId: buyNowProduct.id, quantity: buyNowQty })
      });
      const cartResult = await cartRes.json();
      if (!cartResult.success) throw new Error(cartResult.message);
      const orderRes = await fetch(`${API}/api/orders`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(buyNowForm)
      });
      const orderResult = await orderRes.json();
      if (!orderResult.success) throw new Error(orderResult.message);
      const confirmRes = await fetch(`${API}/api/orders/${orderResult.data.id}/confirm`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }
      });
      const confirmResult = await confirmRes.json();
      if (!confirmResult.success) throw new Error(confirmResult.message);
      alert(`Order #${orderResult.data.id} placed & confirmed!`);
      setBuyNowProduct(null);
    } catch (err) {
      alert('Order failed: ' + err.message);
    } finally {
      setBuyNowLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="card">
        <h3>My Wishlist</h3>
        <div className="loading-spinner">
          <Loader className="spin" size={32} />
          <p>Loading your wishlist...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <h3>My Wishlist</h3>
        <div className="error-message">
          <p>Error: {error}</p>
          <button onClick={fetchWishlist}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="wishlist-container">
      <div className="card">
        <div className="wishlist-header">
          <div className="header-left">
            <h3>
              <Heart size={24} fill="#e74c3c" color="#e74c3c" />
              My Wishlist
            </h3>
            <span className="wishlist-count">{wishlistItems.length} items saved</span>
          </div>
          {wishlistItems.length > 0 && (
            <button className="btn-clear-all" onClick={clearAll}>
              Clear All
            </button>
          )}
        </div>

        {wishlistItems.length === 0 ? (
          <div className="empty-wishlist">
            <div className="empty-icon"><Heart size={80} color="#ddd" /></div>
            <h4>Your wishlist is empty</h4>
            <p>Save items you love and check them out later! ❤️</p>
            <button className="btn-browse" onClick={() => window.location.href = '/customer'}>
              <Package size={20} /> Browse Products
            </button>
          </div>
        ) : (
          <div className="wishlist-grid">
            {wishlistItems.map((item) => {
              const product = item.product;
              const rawImage = product.images?.[0]?.url;
              const primaryImage = rawImage
                ? (rawImage.startsWith('http') ? rawImage : `${API}${rawImage}`)
                : '/placeholder.png';
              const isOutOfStock = product.totalStock === 0;
              const isLowStock = product.totalStock < 10 && product.totalStock > 0;
              const addedAt = new Date(item.addedAt);
              const daysInWishlist = Math.floor((Date.now() - addedAt.getTime()) / (1000 * 60 * 60 * 24));
              const longStayDays = 5;
              const canRequestBargain = product.bargainable && daysInWishlist >= longStayDays;
              const status = requestedBargains[item.productId];
              const alreadyRequested = !!status;
              const statusLabel = status ? status.toLowerCase() : null;

              return (
                <div key={item.id} className="wishlist-card" onClick={() => setSelectedProduct(product)} style={{ cursor: 'pointer' }}>
                  {/* Heart toggle — removes from wishlist */}
                  <button
                    className="btn-remove-heart"
                    onClick={e => { e.stopPropagation(); removeFromWishlist(item.productId); }}
                    disabled={actionLoading[item.productId]}
                    title="Remove from wishlist"
                  >
                    {actionLoading[item.productId] === 'removing' ? (
                      <Loader className="spin" size={20} />
                    ) : (
                      <Heart size={20} fill="#e74c3c" color="#e74c3c" />
                    )}
                  </button>

                  <div className="wishlist-image">
                    <img src={primaryImage} alt={product.name} onError={e => e.target.src = '/placeholder.png'} />
                    {isOutOfStock && <div className="stock-badge out-of-stock">Out of Stock</div>}
                    {isLowStock && <div className="stock-badge low-stock">Only {product.totalStock} left!</div>}
                  </div>

                  <div className="wishlist-details">
                    <h4 className="wishlist-product-name">{product.name}</h4>
                    <p className="wishlist-description">
                      {product.description?.substring(0, 100)}{product.description?.length > 100 ? '...' : ''}
                    </p>
                    <div className="wishlist-meta">
                      <span className="wishlist-category">{product.category}</span>
                      {item.note && <span className="wishlist-note" title={item.note}>📝 Note</span>}
                    </div>
                    <div className="price-and-stock">
                      <div className="wishlist-price">
                        <IndianRupee size={20} />
                        <span className="price-amount">{parseFloat(product.baseSellingPrice).toFixed(2)}</span>
                      </div>
                      <div className="stock-info">
                        {isOutOfStock ? (
                          <span className="stock-status out">Out of Stock</span>
                        ) : (
                          <span className="stock-status in">In Stock ({product.totalStock})</span>
                        )}
                      </div>
                    </div>
                    {item.note && (
                      <div className="personal-note">
                        <span className="note-label">Your note:</span>
                        <p className="note-text">{item.note}</p>
                      </div>
                    )}
                    <div className="added-date">
                      Added {new Date(item.addedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    <div className="wishlist-actions" onClick={e => e.stopPropagation()}>
                      <button
                        className="btn-move-to-cart"
                        onClick={() => moveToCart(item)}
                        disabled={isOutOfStock || actionLoading[item.productId]}
                      >
                        {actionLoading[item.productId] === 'moving' ? (
                          <><Loader className="spin" size={18} />Moving...</>
                        ) : (
                          <><ShoppingCart size={18} />Move to Cart</>
                        )}
                      </button>

                      {canRequestBargain && (
                        <button
                          className="btn-request-bargain"
                          onClick={() => requestBargain(item)}
                          disabled={actionLoading[item.productId] || alreadyRequested}
                          title={alreadyRequested ? `Request ${statusLabel}` : `Request bargain (after ${longStayDays} days)`}
                        >
                          {actionLoading[item.productId] === 'requesting' ? (
                            <><Loader className="spin" size={18} /> Requesting...</>
                          ) : alreadyRequested ? (
                            statusLabel === 'approved' ? 'Approved' : statusLabel === 'denied' ? 'Denied' : 'Requested'
                          ) : (
                            'Request Bargain'
                          )}
                        </button>
                      )}

                      {alreadyRequested && (
                        <span className={`request-status ${statusLabel}`}>{statusLabel}</span>
                      )}

                      <button
                        className="btn-remove"
                        onClick={() => removeFromWishlist(item.productId)}
                        disabled={actionLoading[item.productId]}
                        title="Remove from wishlist"
                      >
                        {actionLoading[item.productId] === 'removing' ? <Loader className="spin" size={18} /> : <Trash2 size={18} />}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Product detail modal */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          isWishlisted={true}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={(p) => { handleAddToCart(p); setSelectedProduct(null); }}
          onToggleWishlist={(p) => { removeFromWishlist(p.id); setSelectedProduct(null); }}
          onBuyNow={handleBuyNow}
        />
      )}

      {/* Buy Now Modal */}
      {buyNowProduct && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => !buyNowLoading && setBuyNowProduct(null)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 60px rgba(0,0,0,0.25)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <span style={{ fontSize: 22 }}>🛍️</span>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, color: '#1f2937' }}>Buy Now</h3>
                <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>{buyNowProduct.name}</p>
              </div>
              <button onClick={() => setBuyNowProduct(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#9ca3af' }}>×</button>
            </div>
            <div style={{ display: 'flex', gap: 12, padding: '12px 16px', background: '#fef2f2', borderRadius: 10, border: '1px solid #fecaca', marginBottom: 20 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: '#1f2937', fontSize: 14 }}>{buyNowProduct.name}</div>
                <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>₹{parseFloat(buyNowProduct.baseSellingPrice).toFixed(2)} each</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>Qty:</span>
                <button onClick={() => setBuyNowQty(q => Math.max(1, q - 1))} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #d1d5db', background: '#f9fafb', cursor: 'pointer', fontWeight: 700 }}>−</button>
                <span style={{ minWidth: 28, textAlign: 'center', fontWeight: 700, fontSize: 15 }}>{buyNowQty}</span>
                <button onClick={() => setBuyNowQty(q => Math.min(buyNowProduct.totalStock, q + 1))} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #d1d5db', background: '#f9fafb', cursor: 'pointer', fontWeight: 700 }}>+</button>
              </div>
            </div>
            <div style={{ textAlign: 'right', marginBottom: 16, fontSize: 15 }}>
              <span style={{ color: '#6b7280' }}>Total: </span>
              <strong style={{ color: '#dc3545', fontSize: 18 }}>₹{(parseFloat(buyNowProduct.baseSellingPrice) * buyNowQty).toFixed(2)}</strong>
            </div>
            <h4 style={{ fontSize: 14, fontWeight: 600, color: '#374151', margin: '0 0 12px 0' }}>Delivery Details</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              {[['Recipient Name *','recipientName','text'],['Phone','recipientPhone','tel'],['Address Line 1','addressLine1','text'],['Address Line 2','addressLine2','text'],['City','city','text'],['State','state','text'],['Postal Code','postalCode','text'],['Country','country','text']].map(([label, field, type]) => (
                <div key={field} style={{ gridColumn: ['addressLine1','addressLine2'].includes(field) ? 'span 2' : undefined }}>
                  <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4, fontWeight: 500 }}>{label}</label>
                  <input type={type} value={buyNowForm[field]} onChange={e => setBuyNowForm(f => ({ ...f, [field]: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, boxSizing: 'border-box' }} />
                </div>
              ))}
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4, fontWeight: 500 }}>Note</label>
              <textarea rows={2} value={buyNowForm.note} onChange={e => setBuyNowForm(f => ({ ...f, note: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, boxSizing: 'border-box', resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setBuyNowProduct(null)} disabled={buyNowLoading} style={{ flex: 1, padding: '11px 0', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 14, color: '#374151', fontWeight: 500 }}>Cancel</button>
              <button onClick={handleBuyNowSubmit} disabled={buyNowLoading || !buyNowForm.recipientName} style={{
                flex: 2, padding: '11px 0', border: 'none', borderRadius: 8,
                background: buyNowLoading || !buyNowForm.recipientName ? '#f87171' : '#dc3545',
                cursor: buyNowLoading || !buyNowForm.recipientName ? 'not-allowed' : 'pointer',
                fontSize: 14, color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
              }}>
                {buyNowLoading ? 'Placing...' : '🛍️ Place Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}