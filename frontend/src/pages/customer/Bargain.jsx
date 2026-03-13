import { useEffect, useState } from 'react';
import { Loader, ShoppingCart, Heart, Tag, Truck } from 'lucide-react';
import { authUtils } from '../../utils/auth';
import ProductDetailModal from '../../components/shop/ProductDetailModal';
import './Bargain.css';

const API = 'http://localhost:3000';

export default function Bargain() {
  const [wishlistItems, setWishlistItems] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = authUtils.getToken();
      const [wishRes, reqRes] = await Promise.all([
        fetch(`${API}/api/wishlist`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/bargain/requests`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      const [wishData, reqData] = await Promise.all([wishRes.json(), reqRes.json()]);

      if (!wishData.success) throw new Error(wishData.message || 'Failed to load wishlist');
      if (!reqData.success) throw new Error(reqData.message || 'Failed to load bargain requests');

      setWishlistItems(wishData.data || []);
      setRequests(reqData.data || []);
    } catch (err) {
      console.error('Bargain page load error', err);
      setError(err.message || 'Failed to load bargain data');
    } finally {
      setLoading(false);
    }
  };

  const longStayDays = 5;
  const cutoff = new Date(Date.now() - longStayDays * 24 * 60 * 60 * 1000);

  const eligibleWishlist = wishlistItems.filter(item => new Date(item.addedAt) <= cutoff);
  const requestedProductIds = new Set(requests.map(r => r.productId));

  const requestBargain = async (item) => {
    setActionLoading(prev => ({ ...prev, [item.productId]: 'requesting' }));
    try {
      const token = authUtils.getToken();
      const res = await fetch(`${API}/api/bargain/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ productId: item.productId })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      setRequests(prev => [...prev, data.data]);
      alert('Bargain request submitted!');
    } catch (err) {
      alert('Request failed: ' + err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [item.productId]: null }));
    }
  };

  const openProduct = (product) => {
    setSelectedProduct(product);
  };

  if (loading) {
    return (
      <div className="card">
        <h3>Bargain Center</h3>
        <div className="loading-spinner">
          <Loader className="spin" size={32} />
          <p>Loading bargain opportunities...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <h3>Bargain Center</h3>
        <div className="error-message">
          <p>Error: {error}</p>
          <button onClick={fetchData}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bargain-page">
      <div className="card">
        <div className="bargain-header">
          <h3>Barter & Bargain</h3>
          <p className="bargain-subtitle">See items eligible for bargaining (wishlist items ≥ {longStayDays} days). Request access or submit an offer.</p>
        </div>

        <div className="bargain-section">
          <h4>
            <Tag size={18} /> Eligible Wishlist Items
            <span className="badge">{eligibleWishlist.length}</span>
          </h4>

          {eligibleWishlist.length === 0 ? (
            <div className="empty-state">
              <p>No eligible items yet.</p>
              <p>Try adding items to your wishlist and wait {longStayDays} days to request a bargain.</p>
            </div>
          ) : (
            <div className="bargain-grid">
              {eligibleWishlist.map(item => {
                const product = item.product;
                const alreadyRequested = requestedProductIds.has(item.productId);
                const rawImage = product.images?.[0]?.url;
                const primaryImage = rawImage ? (rawImage.startsWith('http') ? rawImage : `${API}${rawImage}`) : '/placeholder.png';

                return (
                  <div key={item.id} className="bargain-card">
                    <div className="bargain-img">
                      <img src={primaryImage} alt={product.name} onError={e => (e.target.src = '/placeholder.png')} />
                    </div>
                    <div className="bargain-info">
                      <div className="bargain-title">{product.name}</div>
                      <div className="bargain-meta">
                        <span className="bargain-price">₹{parseFloat(product.baseSellingPrice).toFixed(2)}</span>
                        <span className="bargain-stock">{product.totalStock > 0 ? `${product.totalStock} in stock` : 'Out of stock'}</span>
                      </div>
                      <div className="bargain-actions">
                        <button
                          className="btn-bargain"
                          onClick={() => openProduct(product)}
                          disabled={!product.bargainable}
                        >
                          {product.bargainable ? 'Bargain Now' : 'Not Bargainable'}
                        </button>
                        <button
                          className="btn-request"
                          onClick={() => requestBargain(item)}
                          disabled={alreadyRequested || actionLoading[item.productId]}
                        >
                          {actionLoading[item.productId] === 'requesting' ? 'Requesting…' : alreadyRequested ? 'Requested' : 'Request Access'}
                        </button>
                      </div>
                      {alreadyRequested && (
                        <div className="bargain-note">You have a pending request for this item.</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bargain-section">
          <h4>
            <Truck size={18} /> Your Bargain Requests
            <span className="badge">{requests.length}</span>
          </h4>

          {requests.length === 0 ? (
            <div className="empty-state">
              <p>No bargain requests submitted yet.</p>
              <p>When you request access to bargain, it will show up here.</p>
            </div>
          ) : (
            <div className="requests-table">
              <div className="requests-row header">
                <div>Product</div>
                <div>Status</div>
                <div>Requested</div>
              </div>
              {requests.map(req => (
                <div key={req.id} className="requests-row">
                  <div>{req.product?.name || 'Unknown'}</div>
                  <div className={`status ${req.status.toLowerCase()}`}>{req.status}</div>
                  <div>{new Date(req.createdAt).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          isWishlisted={true}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={() => {} }
          onToggleWishlist={() => {} }
          onBuyNow={() => {} }
        />
      )}
    </div>
  );
}
