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
    setActiveSearch('');
    clearSearch();
  }, [location.key, clearSearch]);

  const fetchWishlistIds = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await fetch(`${API}/api/wishlist`, { headers: { Authorization: `Bearer ${token}` } });
      const result = await res.json();
      if (result.success) setWishlistIds(new Set((result.data || []).map(w => w.productId)));
    } catch {}
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchWishlistIds();
  }, []);

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
        if (isTopbar && topbarQuery.trim()) {
          setActiveSearch(topbarQuery.trim());
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [topbarQuery]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const url = token
        ? `${API}/api/products/recommended?limit=20`
        : `${API}/api/products`;

      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const result = await response.json();

      if (!result.success) {
        // If recommendations fail (invalid/expired token), fall back to public products
        if (token) {
          const fallbackRes = await fetch(`${API}/api/products`);
          const fallbackResult = await fallbackRes.json();

          if (!fallbackResult.success) {
            throw new Error(fallbackResult.message);
          }

          const activeProducts = (fallbackResult.data || []).filter(p => p.isActive);
          const shuffled = activeProducts.sort(() => Math.random() - 0.5);
          setProducts(shuffled.slice(0, 20));
          setError(null);
          return;
        }

        throw new Error(result.message);
      }

      const activeProducts = (result.data || []).filter(p => p.isActive);
      // show a randomized subset of 20 products each time when not using recommended endpoint
      const finalList = token ? activeProducts : activeProducts.sort(() => Math.random() - 0.5);
      setProducts(finalList.slice(0, 20));
      setError(null);
    } catch (err) {
      console.error('Error fetching products:', err);
      setError(err.message);
      showToast('Failed to load products', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = useMemo(() => {
    let filtered = [...products];

    if (selectedCategory !== 'All') {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }

    if (activeSearch || searchQuery.trim()) {
      const query = (activeSearch || searchQuery).toLowerCase().trim();
      const words = query.split(/\s+/);
      filtered = filtered.filter(p =>
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
  }, [products, selectedCategory, activeSearch, searchQuery, sortBy]);

  const featuredProduct = useMemo(() => {
    return products.find(p => p.totalStock > 0) || products[0];
  }, [products]);

  const clearActiveSearch = () => { setActiveSearch(''); clearSearch(); };

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
    } catch {}
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
            &nbsp;— {filteredProducts.length} match{filteredProducts.length !== 1 ? 'es' : ''}
            <button
              className="active-search-clear"
              onClick={clearActiveSearch}
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

        {filteredProducts.length === 0 ? (
          <div className="no-products">
            <h3>No products found</h3>
            <p>{activeSearch ? `No matches for "${activeSearch}"` : 'Try adjusting your search or filters'}</p>
            {activeSearch && (
              <button className="btn primary mt-16" onClick={clearActiveSearch}>
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
              onAddToCart={handleAddToCart}
              onToggleWishlist={handleToggleWishlist}
              onViewProduct={handleViewProduct}
              onBuyNow={handleBuyNow}
              wishlistIds={wishlistIds}
            />
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