import React from 'react';
import ProductCard from './ProductCard';

export default function ProductGrid({ products = [], onAddToCart, onToggleWishlist, onViewProduct, onBuyNow, wishlistIds = new Set() }) {
  return (
    <div className="product-grid">
      {products.map((product) => (
        <div key={product.id} className="grid-item">
          <ProductCard
            product={product}
            onAddToCart={onAddToCart}
            onToggleWishlist={onToggleWishlist}
            onViewProduct={onViewProduct}
            onBuyNow={onBuyNow}
            isWishlisted={wishlistIds.has(product.id)}
          />
        </div>
      ))}
    </div>
  );
}