import React from 'react';
import ProductCard from './ProductCard';

export default function ProductGrid({ products = [], onAddToCart, onToggleWishlist }) {
  // assign visual variants for variety
  const variants = ['standard', 'wide', 'tall'];

  return (
    <div className="product-grid">
      {products.map((p, i) => (
        <div key={p.id || i} className={`grid-item ${variants[i % variants.length]}`}>
          <ProductCard product={p} variant={variants[i % variants.length]} onAddToCart={onAddToCart} onToggleWishlist={onToggleWishlist} />
        </div>
      ))}
    </div>
  );
}
