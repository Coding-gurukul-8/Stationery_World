import { useState, useEffect, useMemo } from 'react';
import { Heart, TrendingUp, Users, Package, Loader, RefreshCw, IndianRupee } from 'lucide-react';
import { useSearch } from '../../context/SearchContext';
import { authUtils } from '../../utils/auth';
import ProductDetailModal from '../../components/shop/ProductDetailModal';
import './AdminWishlist.css';

const API = 'http://localhost:3000';
const getImageUrl = (url) => {
  if (!url) return '/placeholder.png';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API}${url}`;
};

export default function AdminWishlist() {
  const [stats, setStats] = useState({
    totalProducts: 0, totalWishlists: 0, uniqueUsers: 0, mostPopular: null, productStats: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('most-wanted');
  const [selectedProduct, setSelectedProduct] = useState(null);

  const { registerSearchHandler, unregisterSearchHandler, searchQuery } = useSearch();

  useEffect(() => { fetchWishlistStats(); }, []);

  useEffect(() => {
    const searchWishlistProducts = async (query) => {
      const q = query.toLowerCase().trim();
      return stats.productStats
        .filter(item =>
          item.product?.name?.toLowerCase().includes(q) ||
          item.product?.category?.toLowerCase().includes(q) ||
          item.product?.description?.toLowerCase().includes(q)
        )
        .slice(0, 8)
        .map(item => ({
          id: item.product.id,
          title: item.product.name,
          subtitle: `${item.wishlistCount} wishlisted · ${item.product.category} · ₹${parseFloat(item.product.baseSellingPrice).toFixed(2)}`,
          badge: `❤️ ${item.wishlistCount}`,
          onClick: () => setSelectedProduct(item.product)
        }));
    };
    registerSearchHandler('wishlist products', searchWishlistProducts, 'Search wishlisted products…');
    return () => unregisterSearchHandler();
  }, [stats.productStats, registerSearchHandler, unregisterSearchHandler]);

  const fetchWishlistStats = async () => {
    try {
      setLoading(true);
      const token = authUtils.getToken();
      const response = await fetch(`${API}/api/wishlist/admin/wishlists`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }
      const result = await response.json();
      if (!result.success) throw new Error(result.message);

      const wishlists = result.data || [];
      const productMap = {};
      const userSet = new Set();

      wishlists.forEach(item => {
        const productId = item.productId;
        userSet.add(item.userId);
        if (!productMap[productId]) {
          productMap[productId] = { product: item.product, count: 0, users: [] };
        }
        productMap[productId].count++;
        productMap[productId].users.push(item.user);
      });

      const productStats = Object.values(productMap).map(p => ({
        product: p.product, wishlistCount: p.count, users: p.users
      }));
      const mostPopular = productStats.reduce((max, p) => (p.wishlistCount > (max?.wishlistCount || 0)) ? p : max, null);

      setStats({ totalProducts: productStats.length, totalWishlists: wishlists.length, uniqueUsers: userSet.size, mostPopular, productStats });
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getSortedStats = () => {
    let sorted = [...stats.productStats];

    // Filter by topbar search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      sorted = sorted.filter(item =>
        item.product?.name?.toLowerCase().includes(q) ||
        item.product?.category?.toLowerCase().includes(q) ||
        item.product?.description?.toLowerCase().includes(q)
      );
    }

    switch (sortBy) {
      case 'most-wanted':
        return sorted.sort((a, b) => b.wishlistCount - a.wishlistCount);
      case 'price-high':
        return sorted.sort((a, b) => parseFloat(b.product.baseSellingPrice) - parseFloat(a.product.baseSellingPrice));
      case 'price-low':
        return sorted.sort((a, b) => parseFloat(a.product.baseSellingPrice) - parseFloat(b.product.baseSellingPrice));
      default:
        return sorted;
    }
  };

  const viewProductDetails = (product) => {
    setSelectedProduct(product);
  };

  if (loading) {
    return (
      <div className="card">
        <h3>Wishlist Analytics</h3>
        <div className="loading-spinner">
          <Loader className="spin" size={32} />
          <p>Loading wishlist data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <h3>Wishlist Analytics</h3>
        <div className="error-message">
          <p>Error: {error}</p>
          <button onClick={fetchWishlistStats}>Retry</button>
        </div>
      </div>
    );
  }

  const sortedStats = getSortedStats();

  return (
    <div className="admin-wishlist-container">
      <div className="card">
        <div className="admin-wishlist-header">
          <h3>
            <Heart size={24} fill="#e74c3c" color="#e74c3c" />
            Wishlist Analytics
          </h3>
          <button className="btn-refresh" onClick={fetchWishlistStats}>
            <RefreshCw size={16} />
            Refresh Data
          </button>
        </div>

        {/* Statistics Overview */}
        <div className="stats-overview">
          <div className="stat-card">
            <div className="stat-icon">
              <Package size={32} color="white" />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.totalProducts}</div>
              <div className="stat-label">Products in Wishlists</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <Heart size={32} color="white" />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.totalWishlists}</div>
              <div className="stat-label">Total Wishlist Items</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <Users size={32} color="white" />
            </div>
            <div className="stat-content">
              <div className="stat-value">{stats.uniqueUsers}</div>
              <div className="stat-label">Users with Wishlists</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <TrendingUp size={32} color="white" />
            </div>
            <div className="stat-content">
              <div className="stat-value">
                {stats.mostPopular?.wishlistCount || 0}
              </div>
              <div className="stat-label">Most Popular Item</div>
            </div>
          </div>
        </div>

        {/* Sort Controls */}
        <div className="controls">
          <label>Sort by:</label>
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            className="sort-select"
          >
            <option value="most-wanted">Most Wanted</option>
            <option value="price-high">Price: High to Low</option>
            <option value="price-low">Price: Low to High</option>
          </select>
          {searchQuery.trim() && (
            <span style={{
              marginLeft: 12,
              fontSize: 13,
              color: '#1e40af',
              background: '#eff6ff',
              padding: '4px 10px',
              borderRadius: 999,
              border: '1px solid #bfdbfe'
            }}>
              🔍 Filtering: "{searchQuery}" — {sortedStats.length} result{sortedStats.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Products Grid */}
        {sortedStats.length === 0 ? (
          <div className="empty-state">
            <Heart size={64} color="#ddd" />
            <h4>No wishlist data yet</h4>
            <p>Products will appear here when customers add them to their wishlists.</p>
          </div>
        ) : (
          <div className="products-grid">
            {sortedStats.map((item) => {
              const product = item.product;
              const primaryImage = getImageUrl(product.images?.[0]?.url);
              const isOutOfStock = product.totalStock === 0;

              return (
                <div key={product.id} className="product-card" onClick={() => viewProductDetails(product)} style={{ cursor: 'pointer' }}>
                  <div className="wishlist-badge">
                    <Heart size={16} fill="#e74c3c" color="#e74c3c" />
                    <span>{item.wishlistCount}</span>
                  </div>

                  <div className="product-image">
                    <img src={primaryImage} alt={product.name} onError={e => e.target.src = '/placeholder.png'} />
                    {isOutOfStock && <div className="stock-badge out-of-stock">Out of Stock</div>}
                    {!isOutOfStock && product.totalStock < 10 && (
                      <div className="stock-badge low-stock">Low Stock ({product.totalStock})</div>
                    )}
                  </div>

                  <div className="product-info">
                    <h4 className="product-name">{product.name}</h4>
                    <p className="product-description">
                      {product.description?.substring(0, 80)}{product.description?.length > 80 ? '...' : ''}
                    </p>
                    <div className="product-meta">
                      <span className="category">{product.category}</span>
                      <span className="stock">Stock: {product.totalStock}</span>
                    </div>
                    <div className="price-section">
                      <div className="price">
                        <IndianRupee size={20} />
                        <span className="amount">{parseFloat(product.baseSellingPrice).toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="interested-users">
                      <Users size={16} />
                      <span className="users-count">{item.users.length} interested</span>
                      <div className="users-list">
                        {item.users.slice(0, 3).map((user, idx) => (
                          <span key={idx} className="user-avatar" title={user.email}>
                            {(user.name || user.email)?.[0]?.toUpperCase()}
                          </span>
                        ))}
                        {item.users.length > 3 && (
                          <span className="user-avatar more">+{item.users.length - 3}</span>
                        )}
                      </div>
                    </div>
                    <div className="product-actions" style={{ marginTop: 12, fontSize: 13, color: '#6b7280', textAlign: 'center' }}>
                      Click card to view details
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Insights */}
        {sortedStats.length > 0 && (
          <div className="insights">
            <h4>💡 Insights</h4>
            <ul>
              <li>
                <strong>Top Product:</strong> "{sortedStats[0].product.name}" with {sortedStats[0].wishlistCount} wishlists
              </li>
              <li>
                <strong>Average Wishlists per Product:</strong> {(stats.totalWishlists / stats.totalProducts).toFixed(1)}
              </li>
              <li>
                <strong>Consider:</strong> Products with high wishlist counts are popular - consider promotions or ensuring stock availability
              </li>
            </ul>
          </div>
        )}
      </div>

      {/* Product detail modal */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={() => {}}
          onToggleWishlist={() => {}}
        />
      )}
    </div>
  );
}