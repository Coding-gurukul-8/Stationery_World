import React, { useState, useEffect } from 'react';
import { Heart, ShoppingCart, Eye, Zap, Bell } from 'lucide-react';
import BargainModal from './BargainModal';
import { API_BASE_URL } from '../../config/constants';

export default function ProductCard({ product, variant = 'standard', onAddToCart, onToggleWishlist, onViewProduct, onBuyNow, isWishlisted = false }) {
  // guard against undefined product to avoid blank render/crash
  if (!product) return null;

  const [imageError, setImageError] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [notified, setNotified] = useState(false);

  // ✨ BARGAIN FEATURE STATE
  const [showBargainModal, setShowBargainModal] = useState(false);
  const [eligibility, setEligibility] = useState(null);
  const [checkingEligibility, setCheckingEligibility] = useState(false);

  const getImageUrl = () => {
    const primaryImage = product.images?.find(img => img.isPrimary)?.url ||
                         product.images?.[0]?.url;
    if (!primaryImage) return '/placeholder.png';
    if (primaryImage.startsWith('http://') || primaryImage.startsWith('https://')) return primaryImage;
    if (primaryImage.startsWith('/uploads')) return `${API_BASE_URL}${primaryImage}`;
    return `${API_BASE_URL}${primaryImage}`;
  };

  const imageUrl = getImageUrl();
  const isOutOfStock = product.totalStock === 0;
  const isLowStock = product.totalStock > 0 && product.totalStock <= (product.lowStockThreshold || 10);

  // ✨ BARGAIN: Check eligibility on mount
  useEffect(() => {
    // only run if product is defined
    if (product?.bargainable && !isOutOfStock) {
      checkBargainEligibility();
    }
  }, [product?.id, product?.bargainable]);

  // ✨ BARGAIN: Check if user is eligible
  const checkBargainEligibility = async () => {
    setCheckingEligibility(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}/api/bargain/eligibility/${product.id}`, {
        method: 'GET',
        headers
      });

      const result = await response.json();
      
      if (result.success) {
        setEligibility(result.data);
      }
    } catch (error) {
      console.error('Eligibility check failed:', error);
    } finally {
      setCheckingEligibility(false);
    }
  };

  // ✨ BARGAIN: Handle bargain button click
  const handleBargainClick = (e) => {
    e.stopPropagation();
    setShowBargainModal(true);
  };

  // ✨ BARGAIN: Handle successful bargain
  const handleBargainSuccess = (data) => {
    console.log('Bargain accepted:', data);
    alert(`Offer accepted at ₹${data.finalPrice}! Item added to cart.`);
    checkBargainEligibility(); // Refresh eligibility
  };

  const handleWishlistClick = (e) => {
    e.stopPropagation();
    if (onToggleWishlist) onToggleWishlist(product);
  };

  const handleBuyNow = (e) => {
    e.stopPropagation();
    if (onBuyNow) onBuyNow(product);
  };

  const handleNotifyMe = async (e) => {
    e.stopPropagation();
    setNotifying(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Please login to get notified');
        setNotifying(false);
        return;
      }

      const user = JSON.parse(localStorage.getItem('user') || '{}');

      const response = await fetch(`${API_BASE_URL}/api/products/${product.id}/notify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          email: user.email
        })
      });

      const result = await response.json();

      if (result.success) {
        setNotified(true);
        setTimeout(() => setNotified(false), 3000);
      } else {
        alert(result.message || 'Failed to register notification');
      }
    } catch (err) {
      console.error('Notify error:', err);
      alert('Failed to register notification');
    } finally {
      setNotifying(false);
    }
  };

  return (
    <>
      <div className={`product-card ${variant} ${isOutOfStock ? 'out-of-stock' : ''}`}>
        {/* Stock Badge - ONLY show "Out of Stock" for customers */}
        {isOutOfStock && <div className="stock-badge out">Out of Stock</div>}

        {/* Product Image */}
        <div className="pc-image" onClick={() => onViewProduct && onViewProduct(product)}>
          <img
            src={imageError ? '/placeholder.png' : imageUrl}
            alt={product.name}
            onError={() => setImageError(true)}
          />
          <div className="pc-overlay">
            <button
              className={`pc-icon wishlist${isWishlisted ? ' active' : ''}`}
              onClick={handleWishlistClick}
              aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
              title={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            >
              <Heart size={20} fill={isWishlisted ? 'currentColor' : 'none'} />
            </button>
            <button
              className="pc-icon view"
              onClick={(e) => { e.stopPropagation(); onViewProduct && onViewProduct(product); }}
              aria-label="Quick view"
              title="Quick view"
            >
              <Eye size={20} />
            </button>
            <button
              className="pc-icon cart"
              onClick={(e) => { e.stopPropagation(); onAddToCart && onAddToCart(product); }}
              aria-label="Add to cart"
              title="Add to cart"
              disabled={isOutOfStock}
            >
              <ShoppingCart size={20} />
            </button>
          </div>
        </div>

        {/* Product Body */}
        <div className="pc-body">
          <div className="pc-category">{product.category}</div>
          <div className="pc-title" title={product.name}>{product.name}</div>
          <p className="pc-description">
            {product.description?.substring(0, 60)}
            {product.description?.length > 60 ? '...' : ''}
          </p>

          {/* Seller Badge */}
          {product.createdBy && (
            <div className="seller-badge">
              👤 by {product.createdBy.name}
            </div>
          )}
          {/* special bargain badge if admin granted permission */}
          {eligibility?.metadata?.grantedByAdmin && (
            <div className="offer-badge">
              🔑 Special Offer
            </div>
          )}

          <div className="pc-meta">
            <div className="pc-price">
              <span className="currency">₹</span>
              <span className="amount">{parseFloat(product.baseSellingPrice).toFixed(2)}</span>
            </div>
          </div>

          {/* ✨ BARGAIN BUTTON - Shows when eligible */}
          {!isOutOfStock && product.bargainable && eligibility?.canBargain && (
            <button
              onClick={handleBargainClick}
              className="bargain-btn"
            >
              💰 Make an Offer
              {eligibility.metadata.remainingAttempts > 0 && (
                <span className="remaining">
                  {eligibility.metadata.remainingAttempts} left
                </span>
              )}
            </button>
          )}

          {/* Notify Me Button - Shows when out of stock */}
          {isOutOfStock ? (
            <button
              onClick={handleNotifyMe}
              disabled={notifying || notified}
              className={`notify-btn ${notified ? 'notified' : 'default'}`}
            >
              {notified ? (
                <>✓ You'll be notified</>
              ) : notifying ? (
                <>Registering...</>
              ) : (
                <>
                  <Bell size={14} />
                  Notify Me
                </>
              )}
            </button>
          ) : (
            /* Buy Now button - Shows when in stock and no bargain */
            !eligibility?.canBargain && onBuyNow && (
              <button
                onClick={handleBuyNow}
                className="buy-now-btn"
              >
                <Zap size={14} />
                Buy Now
              </button>
            )
          )}
        </div>
      </div>

      {/* ✨ BARGAIN MODAL */}
      {showBargainModal && eligibility && (
        <BargainModal
          isOpen={showBargainModal}
          onClose={() => setShowBargainModal(false)}
          product={product}
          eligibility={eligibility}
          onSuccess={handleBargainSuccess}
        />
      )}
    </>
  );
}