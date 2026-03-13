import React, { useState } from 'react';
import { ShoppingBag, Sparkles } from 'lucide-react';

export default function Hero({ featured, onShopNow }) {
  const [imageError, setImageError] = useState(false);
  
  const getImageUrl = () => {
    const primaryImage = featured?.images?.find(img => img.isPrimary)?.url || 
                         featured?.images?.[0]?.url;
    
    if (!primaryImage) return '/placeholder.png';
    
    if (primaryImage.startsWith('http://') || primaryImage.startsWith('https://')) {
      return primaryImage;
    }
    
    if (primaryImage.startsWith('/uploads')) {
      return `http://localhost:3000${primaryImage}`;
    }
    
    return `http://localhost:3000${primaryImage}`;
  };

  const imageUrl = getImageUrl();

  return (
    <section className="shop-hero">
      <div className="hero-left">
        <div className="hero-badge">
          <Sparkles size={16} />
          <span>New Arrivals</span>
        </div>
        <h1>Discover Stationery Delights</h1>
        <p className="hero-subtitle">
          Curated picks, trending products and limited offers — just for you.
        </p>
        <div className="hero-ctas">
          <button className="btn primary" onClick={onShopNow}>
            <ShoppingBag size={20} />
            Shop Now
          </button>
          <button className="btn outline" onClick={() => window.location.href = '#categories'}>
            Explore Categories
          </button>
        </div>
        <div className="hero-stats">
          <div className="stat-item">
            <div className="stat-number">500+</div>
            <div className="stat-label">Products</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">50+</div>
            <div className="stat-label">Brands</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">10k+</div>
            <div className="stat-label">Happy Customers</div>
          </div>
        </div>
      </div>
      <div className="hero-right">
        {featured && (
          <div className="hero-card">
            <div className="hero-card-badge">Featured</div>
            <img 
              src={imageError ? '/placeholder.png' : imageUrl} 
              alt={featured.name}
              onError={() => setImageError(true)}
            />
            <div className="hc-info">
              <div className="hc-category">{featured.category}</div>
              <div className="hc-name">{featured.name}</div>
              <div className="hc-price-row">
                <div className="hc-price">₹{parseFloat(featured.baseSellingPrice).toFixed(2)}</div>
                {featured.totalStock > 0 ? (
                  <div className="hc-stock in">In Stock</div>
                ) : (
                  <div className="hc-stock out">Out of Stock</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}