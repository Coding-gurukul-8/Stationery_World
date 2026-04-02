import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { useSearch } from '../context/SearchContext';
import Hero from '../components/shop/Hero';
import CategoryStrip from '../components/shop/CategoryStrip';
import ProductGrid from '../components/shop/ProductGrid';
import ProductDetailModal from '../components/shop/ProductDetailModal';
import { Loader, X, Search, CheckCircle, ShoppingBag } from 'lucide-react';
import '../../Style/shop.css';
import { API_BASE_URL } from '../config/constants';

const API = API_BASE_URL;
const PAGE_LIMIT = 20;

export default function Shop() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('featured');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [activeSearch, setActiveSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_LIMIT, total: 0, totalPages: 1 });

  const { showToast } = useToast();
  const [wishlistIds, setWishlistIds] = useState(new Set());
  const { registerSearchHandler, unregisterSearchHandler, searchQuery: topbarQuery, clearSearch } = useSearch();
  const location = useLocation();
  const [buyNowProduct, setBuyNowProduct] = useState(null);
  const [buyNowQty, setBuyNowQty] = useState(1);
  const [buyNowLoading, setBuyNowLoading] = useState(false);
  const [buyNowForm, setBuyNowForm] = useState({
    recipientName: '', recipientPhone: '', addressLine1: '', addressLine2: '',
    city: '', state: '', postalCode: '', country: '', note: ''
  });

  const categories = useMemo(() => ['All', 'STATIONERY', 'BOOKS', 'TOYS'], []);

  // Sidebar "Home" click resets page
  useEffect(() => {
    setSelectedCategory('All');
    setSortBy('featured');
    setSearchQuery('');
    setActiveSearch('');
    setPage(1);
    clearSearch();
  }, [location.key, clearSearch]);

  const fetchWishlistIds = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await fetch(`${API}/api/wishlist`, { headers: { Authorization: `Bearer ${token}` } });
      const result = await res.json();
      if (result.success) setWishlistIds(new Set((result.data || []).map(w => w.productId)));
    } catch (err) {
      console.error('Failed to load wishlist ids:', err);
    }
  }, []);

  useEffect(() => {
    fetchWishlistIds();
  }, [fetchWishlistIds]);

  // Topbar search: dropdown as you type
  useEffect(() => {
    const searchProducts = async (query) => {
      const trimmed = query.trim();
      if (!trimmed) return [];
      const params = new URLSearchParams({
        search: trimmed,
        page: '1',
        limit: '8'
      });
      const response = await fetch(`${API}/api/products/customer/search?${params.toString()}`);
      const result = await response.json();
      const list = result?.success ? (result.data || []) : [];
      return list
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
        if (isTopbar && topbarQuery.trim()) {
          setActiveSearch(topbarQuery.trim());
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [topbarQuery]);

  const fetchProducts = useCallback(async ({ currentPage = 1, searchTerm = '', category = 'All' } = {}) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(PAGE_LIMIT)
      });
      if (category !== 'All') {
        params.set('category', category);
      }
      const trimmedSearch = searchTerm.trim();
      const endpoint = trimmedSearch ? '/api/products/customer/search' : '/api/products/customer';
      if (trimmedSearch) {
        params.set('search', trimmedSearch);
      }

      const response = await fetch(`${API}${endpoint}?${params.toString()}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message);
      }

      setProducts(result.data || []);
      setPagination(result.pagination || { page: currentPage, limit: PAGE_LIMIT, total: (result.data || []).length, totalPages: 1 });
      setError(null);
    } catch (err) {
      console.error('Error fetching products:', err);
      setError(err.message);
      showToast('Failed to load products', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const visibleProducts = useMemo(() => {
    const filtered = [...products];
    switch (sortBy) {
      case 'price-low':
        filtered.sort((a, b) => parseFloat(a.baseSellingPrice) - parseFloat(b.baseSellingPrice));
        break;
      case 'price-high':
        filtered.sort((a, b) => parseFloat(b.baseSellingPrice) - parseFloat(a.baseSellingPrice));
        break;
      case 'name':
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'newest':
        filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
      default:
        break;
    }
    return filtered;
  }, [products, sortBy]);

  const featuredProduct = useMemo(() => {
    return products.find(p => p.totalStock > 0) || products[0];
  }, [products]);

  const clearActiveSearch = () => { setActiveSearch(''); clearSearch(); };

  useEffect(() => {
    fetchProducts({ currentPage: page, searchTerm: activeSearch, category: selectedCategory });
  }, [page, activeSearch, selectedCategory, fetchProducts]);

  useEffect(() => {
    // Debounce search input to reduce backend calls while typing.
    const timer = setTimeout(() => {
      const trimmed = searchQuery.trim();
      setPage(1);
      setActiveSearch(trimmed);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ✅ FIX: Use useCallback to stabilize the function
  const handleAddToCart = useCallback(async (product) => {
    console.log('🛒 handleAddToCart called for:', product.id, product.name);
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        showToast('Please login to add items to cart', 'warning');
        setTimeout(() => {
          window.location.href = '/';
        }, 1500);
        return;
      }

      const response = await fetch(`${API}/api/cart`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          productId: product.id,
          quantity: 1
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message);
      }

      showToast(`${product.name} added to cart! 🛒`, 'success');
    } catch (err) {
      console.error('Add to cart error:', err);
      showToast(err.message, 'error');
    }
  }, [showToast]); // ✅ Add showToast as dependency

  const handleToggleWishlist = useCallback(async (product) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        showToast('Please login to add items to wishlist', 'warning');
        setTimeout(() => { window.location.href = '/'; }, 1500);
        return;
      }

      const isWishlisted = wishlistIds.has(product.id);

      if (isWishlisted) {
        const res = await fetch(`${API}/api/wishlist/${product.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.message);
        setWishlistIds(prev => { const s = new Set(prev); s.delete(product.id); return s; });
        showToast(`${product.name} removed from wishlist 💔`, 'info');
      } else {
        const res = await fetch(`${API}/api/wishlist`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ productId: product.id })
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.message);
        setWishlistIds(prev => new Set([...prev, product.id]));
        showToast(`${product.name} added to wishlist! ❤️`, 'success');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  }, [showToast, wishlistIds]);

  const handleViewProduct = useCallback((product) => {
    setSelectedProduct(product);
    setShowDetailModal(true);
  }, []);

  const handleBuyNow = useCallback((product) => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      setBuyNowForm({
        recipientName: user?.name || '', recipientPhone: user?.phone || '',
        addressLine1: user?.addressLine1 || '', addressLine2: user?.addressLine2 || '',
        city: user?.city || '', state: user?.state || '',
        postalCode: user?.postalCode || '', country: user?.country || '', note: ''
      });
    } catch (err) {
      console.error('Failed to load user defaults for buy now:', err);
    }
    setBuyNowProduct(product);
    setBuyNowQty(1);
    setShowDetailModal(false);
    setSelectedProduct(null);
  }, []);

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
      showToast(`Order #${orderResult.data.id} placed & confirmed!`, 'success');
      // Notify admin dashboard to refresh immediately
      window.dispatchEvent(new CustomEvent('orderCreated', { detail: { orderId: orderResult.data.id } }));
      setBuyNowProduct(null);
    } catch (err) {
      showToast(err.message || 'Order failed', 'error');
    } finally {
      setBuyNowLoading(false);
    }
  };

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
            <button className="btn primary" onClick={fetchProducts}>
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="shop-page">
      {/* decorative floating emoji */}
      <div className="floating-emoji emoji-float">🎈</div>
      <Hero featured={featuredProduct} onShopNow={() => window.scrollTo({ top: 400, behavior: 'smooth' })} />

      <div className="card">

        {/* Active search banner */}
        {activeSearch && (
          <div className="active-search-banner">
            <Search size={15} />
            Results for <strong className="active-search-term">"{activeSearch}"</strong>
            &nbsp;— {pagination.total} match{pagination.total !== 1 ? 'es' : ''}
            <button
              className="active-search-clear"
              onClick={() => { clearActiveSearch(); setSearchQuery(''); setPage(1); }}
            >
              <X size={13} /> Clear
            </button>
          </div>
        )}

        <div className="shop-toolbar">
          <CategoryStrip 
            categories={categories} 
            selected={selectedCategory}
            onSelect={setSelectedCategory} 
          />

          <div className="search-and-sort">
            <div className="search-wrap">
              <input 
                placeholder="Search products..." 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
              />
            </div>

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

        {visibleProducts.length === 0 ? (
          <div className="no-products">
            <h3>No products found</h3>
            <p>{activeSearch ? `No matches for "${activeSearch}"` : 'Try adjusting your search or filters'}</p>
            {activeSearch && (
              <button className="btn primary mt-16" onClick={() => { clearActiveSearch(); setSearchQuery(''); setPage(1); }}>
                Show all products
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="products-count">
              Showing {visibleProducts.length} of {pagination.total} {pagination.total === 1 ? 'product' : 'products'}
              {activeSearch && ` for "${activeSearch}"`}
            </div>

            <ProductGrid
              products={visibleProducts}
              onAddToCart={handleAddToCart}
              onToggleWishlist={handleToggleWishlist}
              onViewProduct={handleViewProduct}
              onBuyNow={handleBuyNow}
              wishlistIds={wishlistIds}
            />
            <div className="shop-toolbar shop-toolbar-pagination">
              <button
                className="btn outline"
                disabled={pagination.page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <div className="products-count products-count-pagination">
                Page {pagination.page} of {pagination.totalPages}
              </div>
              <button
                className="btn outline"
                disabled={pagination.page >= pagination.totalPages || loading}
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>

      {showDetailModal && selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          isWishlisted={wishlistIds.has(selectedProduct.id)}
          onClose={() => setShowDetailModal(false)}
          onAddToCart={handleAddToCart}
          onToggleWishlist={handleToggleWishlist}
          onBuyNow={handleBuyNow}
        />
      )}

      {/* Buy Now Modal */}
      {buyNowProduct && (
        <div className="modal-overlay"
          onClick={() => !buyNowLoading && setBuyNowProduct(null)}>
          <div className="modal-content"
            onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="emoji-large">🛍️</span>
              <div>
                <h3>Buy Now</h3>
                <p>{buyNowProduct.name}</p>
              </div>
              <button onClick={() => setBuyNowProduct(null)} className="modal-close-btn">×</button>
            </div>
            <div className="buy-now-info">
              <div className="name">{buyNowProduct.name}</div>
              <div className="price">₹{parseFloat(buyNowProduct.baseSellingPrice).toFixed(2)} each</div>
              <div className="qty-controls">
                <span className="qty-label">Qty:</span>
                <button onClick={() => setBuyNowQty(q => Math.max(1, q - 1))} className="qty-btn">−</button>
                <span className="qty-display">{buyNowQty}</span>
                <button onClick={() => setBuyNowQty(q => Math.min(buyNowProduct.totalStock, q + 1))} className="qty-btn">+</button>
              </div>
            </div>
            <div className="modal-footer">
              <span className="text-muted">Total: </span>
              <strong className="text-danger">₹{(parseFloat(buyNowProduct.baseSellingPrice) * buyNowQty).toFixed(2)}</strong>
            </div>
            <h4 className="modal-section-title">Delivery Details</h4>
            <div className="form-grid">
              {[['Recipient Name *','recipientName','text'],['Phone','recipientPhone','tel'],['Address Line 1','addressLine1','text'],['Address Line 2','addressLine2','text'],['City','city','text'],['State','state','text'],['Postal Code','postalCode','text'],['Country','country','text']].map(([label, field, type]) => (
                <div key={field} className={['addressLine1','addressLine2'].includes(field) ? 'span-2' : ''}>
                  <label className="form-label">{label}</label>
                  <input type={type} value={buyNowForm[field]} onChange={e => setBuyNowForm(f => ({ ...f, [field]: e.target.value }))} className="form-input" />
                </div>
              ))}
            </div>
            <div className="form-group">
              <label className="form-label">Note</label>
              <textarea rows={2} value={buyNowForm.note} onChange={e => setBuyNowForm(f => ({ ...f, note: e.target.value }))} className="form-textarea" />
            </div>
            <div className="form-actions">
              <button onClick={() => setBuyNowProduct(null)} disabled={buyNowLoading} className="btn outline">Cancel</button>
              <button onClick={handleBuyNowSubmit} disabled={buyNowLoading || !buyNowForm.recipientName} className="btn primary buy-now-submit">
                {buyNowLoading ? 'Placing...' : '🛍️ Place Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
