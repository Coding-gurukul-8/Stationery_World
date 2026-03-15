import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useSearch } from '../../context/SearchContext';
import { authUtils } from '../../utils/auth';

import Hero from '../../components/shop/Hero';
import CategoryStrip from '../../components/shop/CategoryStrip';
import ProductGrid from '../../components/shop/ProductGrid';
import ProductDetailModal from '../../components/shop/ProductDetailModal';
import { Loader, X, Search, CheckCircle, ShoppingBag } from 'lucide-react';

import '../../../Style/shop.css';
import { API_BASE_URL } from '../../config/constants';

const CATEGORIES = ['All', 'STATIONERY', 'BOOKS', 'TOYS'];
const API = API_BASE_URL;

export default function AdminShopping() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState('featured');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [activeSearch, setActiveSearch] = useState('');

  // Toast / feedback
  const [toast, setToast] = useState(null); // { type: 'success'|'error', msg }
  // Wishlist product IDs for the logged-in admin
  const [wishlistIds, setWishlistIds] = useState(new Set());
  // Buy Now modal
  const [buyNowProduct, setBuyNowProduct] = useState(null);
  const [buyNowQty, setBuyNowQty] = useState(1);
  const [buyNowLoading, setBuyNowLoading] = useState(false);
  const [buyNowForm, setBuyNowForm] = useState({
    recipientName: '', recipientPhone: '', addressLine1: '', addressLine2: '',
    city: '', state: '', postalCode: '', country: '', note: ''
  });

  const { registerSearchHandler, unregisterSearchHandler, searchQuery, clearSearch } = useSearch();
  const location = useLocation();

  // Helper: show toast
  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  // Sidebar "Shopping" click always resets the page
  useEffect(() => {
    setSelectedCategory('All');
    setSortBy('featured');
    setActiveSearch('');
    clearSearch();
  }, [location.key]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = authUtils.getToken();
      const res = await fetch(`${API}/api/products`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.message);
      setProducts(result.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch admin's current wishlist IDs on mount
  const fetchWishlistIds = useCallback(async () => {
    try {
      const token = authUtils.getToken();
      const res = await fetch(`${API}/api/wishlist`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await res.json();
      if (result.success) {
        setWishlistIds(new Set((result.data || []).map(w => w.productId)));
      }
    } catch {}
  }, []);

  // Add to Cart
  const handleAddToCart = useCallback(async (product) => {
    try {
      const token = authUtils.getToken();
      const res = await fetch(`${API}/api/cart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ productId: product.id, quantity: 1 })
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.message);
      showToast('success', `"${product.name}" added to cart ✓`);
    } catch (err) {
      showToast('error', err.message || 'Failed to add to cart');
    }
  }, []);

  // Toggle Wishlist
  const handleToggleWishlist = useCallback(async (product) => {
    try {
      const token = authUtils.getToken();
      const isWishlisted = wishlistIds.has(product.id);

      if (isWishlisted) {
        const res = await fetch(`${API}/api/wishlist/${product.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.message);
        setWishlistIds(prev => { const s = new Set(prev); s.delete(product.id); return s; });
        showToast('success', `"${product.name}" removed from wishlist`);
      } else {
        const res = await fetch(`${API}/api/wishlist`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ productId: product.id })
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.message);
        setWishlistIds(prev => new Set([...prev, product.id]));
        showToast('success', `"${product.name}" added to wishlist ♥`);
      }
    } catch (err) {
      showToast('error', err.message || 'Wishlist action failed');
    }
  }, [wishlistIds]);

  // Open Buy Now modal
  const handleBuyNow = useCallback((product) => {
    const user = authUtils.getUser();
    setBuyNowProduct(product);
    setBuyNowQty(1);
    setBuyNowForm({
      recipientName: user?.name || '',
      recipientPhone: user?.phone || '',
      addressLine1: user?.addressLine1 || '',
      addressLine2: user?.addressLine2 || '',
      city: user?.city || '',
      state: user?.state || '',
      postalCode: user?.postalCode || '',
      country: user?.country || '',
      note: ''
    });
  }, []);

  // Submit Buy Now order
  const handleBuyNowSubmit = async () => {
    if (!buyNowProduct) return;
    setBuyNowLoading(true);
    try {
      const token = authUtils.getToken();

      // 1. Add to cart
      const cartRes = await fetch(`${API}/api/cart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ productId: buyNowProduct.id, quantity: buyNowQty })
      });
      const cartResult = await cartRes.json();
      if (!cartResult.success) throw new Error(cartResult.message);

      // 2. Create order
      const orderRes = await fetch(`${API}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(buyNowForm)
      });
      const orderResult = await orderRes.json();
      if (!orderResult.success) throw new Error(orderResult.message);

      // 3. Confirm order (deducts inventory)
      const confirmRes = await fetch(`${API}/api/orders/${orderResult.data.id}/confirm`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const confirmResult = await confirmRes.json();
      if (!confirmResult.success) throw new Error(confirmResult.message);

      showToast('success', `Order placed! Order #${orderResult.data.id} confirmed ✓`);
      setBuyNowProduct(null);
      fetchProducts(); // refresh stock
    } catch (err) {
      showToast('error', err.message || 'Order failed');
    } finally {
      setBuyNowLoading(false);
    }
  };

  useEffect(() => { fetchProducts(); fetchWishlistIds(); }, [fetchProducts, fetchWishlistIds]);

  // Topbar search: dropdown as you type
  useEffect(() => {
    const searchProducts = async (query) => {
      const words = query.toLowerCase().trim().split(/\s+/);
      return products
        .filter(p =>
          words.some(w =>
            p.name.toLowerCase().includes(w) ||
            p.description?.toLowerCase().includes(w) ||
            p.category.toLowerCase().includes(w) ||
            p.subCategory?.toLowerCase().includes(w) ||
            p.keywords?.some(k => k.toLowerCase().includes(w))
          )
        )
        .slice(0, 8)
        .map(p => ({
          id: p.id,
          title: p.name,
          subtitle: `${p.category} · ₹${parseFloat(p.baseSellingPrice).toFixed(2)} · ${p.totalStock} in stock`,
          badge: p.category,
          onClick: () => { setSelectedProduct(p); setShowDetailModal(true); }
        }));
    };

    registerSearchHandler('products', searchProducts, 'Search products… press Enter to filter page');
    return () => unregisterSearchHandler();
  }, [products, registerSearchHandler, unregisterSearchHandler]);

  // Enter key commits search to the grid
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
        const isTopbar = document.activeElement?.closest('.topbar-search');
        if (isTopbar && searchQuery.trim()) {
          setActiveSearch(searchQuery.trim());
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchQuery]);

  const filteredProducts = useMemo(() => {
    let list = [...products];

    if (selectedCategory !== 'All') {
      list = list.filter(p => p.category === selectedCategory);
    }

    if (activeSearch) {
      const words = activeSearch.toLowerCase().split(/\s+/);
      list = list.filter(p =>
        words.some(w =>
          p.name.toLowerCase().includes(w) ||
          p.description?.toLowerCase().includes(w) ||
          p.category.toLowerCase().includes(w) ||
          p.subCategory?.toLowerCase().includes(w) ||
          p.keywords?.some(k => k.toLowerCase().includes(w))
        )
      );
    }

    switch (sortBy) {
      case 'price-low':  list.sort((a, b) => a.baseSellingPrice - b.baseSellingPrice); break;
      case 'price-high': list.sort((a, b) => b.baseSellingPrice - a.baseSellingPrice); break;
      case 'name':       list.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'newest':     list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); break;
      default: break;
    }
    return list;
  }, [products, selectedCategory, activeSearch, sortBy]);

  const featuredProduct = useMemo(() =>
    products.find(p => p.totalStock > 0) || products[0],
  [products]);

  const clearActiveSearch = () => { setActiveSearch(''); clearSearch(); };

  if (loading) {
    return (
      <div className="shop-page">
        <div className="card">
          <div className="loading-container">
            <Loader className="spin" size={48} />
            <p>Loading products...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="shop-page">
        <div className="card">
          <div className="error-container">
            <h3>Error Loading Products</h3>
            <p>{error}</p>
            <button className="btn primary" onClick={fetchProducts}>Retry</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="shop-page">

      <Hero
        featured={featuredProduct}
        onShopNow={() => window.scrollTo({ top: 400, behavior: 'smooth' })}
      />

      <div className="card">

        {/* Active search banner */}
        {activeSearch && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#eff6ff', border: '1px solid #bfdbfe',
            color: '#1e40af', padding: '10px 16px',
            borderRadius: 8, marginBottom: 20, fontSize: 14
          }}>
            <Search size={15} />
            Results for <strong style={{ color: '#1d4ed8' }}>"{activeSearch}"</strong>
            &nbsp;— {filteredProducts.length} match{filteredProducts.length !== 1 ? 'es' : ''}
            <button
              onClick={clearActiveSearch}
              style={{
                marginLeft: 'auto', display: 'flex', alignItems: 'center',
                gap: 5, background: 'none', border: '1px solid #93c5fd',
                color: '#1e40af', padding: '4px 10px', borderRadius: 6,
                fontSize: 13, cursor: 'pointer'
              }}
            >
              <X size={13} /> Clear
            </button>
          </div>
        )}

        <div className="shop-toolbar">
          <CategoryStrip
            categories={CATEGORIES}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
          />
          <div className="search-and-sort">
            <select
              className="sort-select"
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
            >
              <option value="featured">Featured</option>
              <option value="newest">Newest</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="name">Name: A to Z</option>
            </select>
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="no-products">
            <h3>No products found</h3>
            <p>{activeSearch ? `No matches for "${activeSearch}"` : 'Try a different category.'}</p>
            {activeSearch && (
              <button className="btn primary" style={{ marginTop: 16 }} onClick={clearActiveSearch}>
                Show all products
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="products-count">
              Showing {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'}
              {activeSearch && ` for "${activeSearch}"`}
            </div>
            <ProductGrid
              products={filteredProducts}
              wishlistIds={wishlistIds}
              onAddToCart={handleAddToCart}
              onToggleWishlist={handleToggleWishlist}
              onBuyNow={handleBuyNow}
              onViewProduct={(product) => { setSelectedProduct(product); setShowDetailModal(true); }}
            />
          </>
        )}
      </div>

      {showDetailModal && selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          isWishlisted={wishlistIds.has(selectedProduct.id)}
          onClose={() => { setShowDetailModal(false); setSelectedProduct(null); }}
          onAddToCart={handleAddToCart}
          onToggleWishlist={handleToggleWishlist}
          onBuyNow={(p) => { setShowDetailModal(false); setSelectedProduct(null); handleBuyNow(p); }}
        />
      )}

      {/* ── Buy Now Modal ── */}
      {buyNowProduct && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }} onClick={() => !buyNowLoading && setBuyNowProduct(null)}>
          <div style={{
            background: '#fff', borderRadius: 16, padding: 32, width: '100%', maxWidth: 540,
            maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 60px rgba(0,0,0,0.25)'
          }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <ShoppingBag size={22} color="#dc3545" />
              <div>
                <h3 style={{ margin: 0, fontSize: 18, color: '#1f2937' }}>Buy Now</h3>
                <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>{buyNowProduct.name}</p>
              </div>
              <button onClick={() => setBuyNowProduct(null)} style={{
                marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 22, color: '#9ca3af', lineHeight: 1
              }}>×</button>
            </div>

            {/* Product summary */}
            <div style={{
              display: 'flex', gap: 12, padding: '12px 16px', background: '#fef2f2',
              borderRadius: 10, border: '1px solid #fecaca', marginBottom: 20
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: '#1f2937', fontSize: 14 }}>{buyNowProduct.name}</div>
                <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{buyNowProduct.category} · ₹{parseFloat(buyNowProduct.baseSellingPrice).toFixed(2)}</div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>Stock: {buyNowProduct.totalStock}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>Qty:</span>
                <button onClick={() => setBuyNowQty(q => Math.max(1, q - 1))} style={qtyBtnStyle}>−</button>
                <span style={{ minWidth: 28, textAlign: 'center', fontWeight: 700, fontSize: 15 }}>{buyNowQty}</span>
                <button onClick={() => setBuyNowQty(q => Math.min(buyNowProduct.totalStock, q + 1))} style={qtyBtnStyle}>+</button>
              </div>
            </div>

            {/* Total */}
            <div style={{ textAlign: 'right', marginBottom: 16, fontSize: 15 }}>
              <span style={{ color: '#6b7280' }}>Total: </span>
              <strong style={{ color: '#dc3545', fontSize: 18 }}>
                ₹{(parseFloat(buyNowProduct.baseSellingPrice) * buyNowQty).toFixed(2)}
              </strong>
            </div>

            {/* Delivery form */}
            <h4 style={{ fontSize: 14, fontWeight: 600, color: '#374151', margin: '0 0 12px 0' }}>Delivery Details</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              {[
                ['Recipient Name *', 'recipientName', 'text'],
                ['Phone', 'recipientPhone', 'tel'],
                ['Address Line 1', 'addressLine1', 'text'],
                ['Address Line 2', 'addressLine2', 'text'],
                ['City', 'city', 'text'],
                ['State', 'state', 'text'],
                ['Postal Code', 'postalCode', 'text'],
                ['Country', 'country', 'text'],
              ].map(([label, field, type]) => (
                <div key={field} style={{ gridColumn: ['addressLine1','addressLine2'].includes(field) ? 'span 2' : undefined }}>
                  <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4, fontWeight: 500 }}>{label}</label>
                  <input
                    type={type}
                    value={buyNowForm[field]}
                    onChange={e => setBuyNowForm(f => ({ ...f, [field]: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
              ))}
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4, fontWeight: 500 }}>Note (optional)</label>
              <textarea
                rows={2}
                value={buyNowForm.note}
                onChange={e => setBuyNowForm(f => ({ ...f, note: e.target.value }))}
                style={{ ...inputStyle, resize: 'vertical' }}
                placeholder="Any special instructions..."
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setBuyNowProduct(null)} disabled={buyNowLoading} style={{
                flex: 1, padding: '12px 0', border: '1px solid #d1d5db', borderRadius: 8,
                background: '#fff', cursor: 'pointer', fontSize: 14, color: '#374151', fontWeight: 500
              }}>Cancel</button>
              <button onClick={handleBuyNowSubmit} disabled={buyNowLoading || !buyNowForm.recipientName} style={{
                flex: 2, padding: '12px 0', border: 'none', borderRadius: 8,
                background: buyNowLoading || !buyNowForm.recipientName ? '#f87171' : '#dc3545',
                cursor: buyNowLoading || !buyNowForm.recipientName ? 'not-allowed' : 'pointer',
                fontSize: 14, color: '#fff', fontWeight: 700, display: 'flex',
                alignItems: 'center', justifyContent: 'center', gap: 8
              }}>
                {buyNowLoading ? 'Placing Order…' : <><ShoppingBag size={16} /> Place Order</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, right: 28, zIndex: 99999,
          background: toast.type === 'success' ? '#16a34a' : '#dc2626',
          color: '#fff', padding: '14px 22px', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.22)', fontSize: 14,
          display: 'flex', alignItems: 'center', gap: 10, maxWidth: 340,
          animation: 'fadeIn .2s ease'
        }}>
          {toast.type === 'success' ? <CheckCircle size={18} /> : '⚠'}
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// Shared mini-styles
const qtyBtnStyle = {
  width: 28, height: 28, borderRadius: 6, border: '1px solid #d1d5db',
  background: '#f9fafb', cursor: 'pointer', fontSize: 16, display: 'flex',
  alignItems: 'center', justifyContent: 'center', fontWeight: 700
};
const inputStyle = {
  width: '100%', padding: '8px 10px', border: '1px solid #d1d5db',
  borderRadius: 7, fontSize: 13, outline: 'none', boxSizing: 'border-box'
};