import React from 'react';

export default function ProductCard({ product, variant = 'standard', onAddToCart, onToggleWishlist }) {
  return (
    <div className={`product-card ${variant}`} title={product.name}>
      <div className="pc-image">
        <img src={product.image} alt={product.name} />
        <div className="pc-overlay">
          <button className="pc-icon wishlist" onClick={(e) => { e.stopPropagation(); onToggleWishlist && onToggleWishlist(product); }} aria-label="Add to wishlist">❤</button>
          <button className="pc-icon cart" onClick={(e) => { e.stopPropagation(); onAddToCart && onAddToCart(product); }} aria-label="Add to cart">🛒</button>
        </div>
      </div>

      <div className="pc-body">
        <div className="pc-title">{product.name}</div>
        <div className="pc-meta">
          <div className="pc-price">₹{product.price.toFixed(2)}</div>
          <div className="pc-rating">★ {product.rating || '—'}</div>
        </div>
      </div>
    </div>
  );
}
