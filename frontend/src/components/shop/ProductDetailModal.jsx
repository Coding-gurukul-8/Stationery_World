import React, { useState, useEffect } from 'react';
import { X, Heart, ShoppingCart, Package, Minus, Plus, Zap, Bell } from 'lucide-react';
import BargainModal from './BargainModal';
import './ProductDetailModal.css';
import { API_BASE_URL } from '../../config/constants';

export default function ProductDetailModal({ product, onClose, onAddToCart, onToggleWishlist, onBuyNow, isWishlisted = false }) {
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [notifying, setNotifying] = useState(false);
  const [notified, setNotified] = useState(false);

  // ✨ BARGAIN FEATURE STATE
  const [showBargainModal, setShowBargainModal] = useState(false);
  const [eligibility, setEligibility] = useState(null);
  const [checkingEligibility, setCheckingEligibility] = useState(false);

  const getImageUrl = (imageUrl) => {
    if (!imageUrl) return '/placeholder.png';
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) return imageUrl;
    if (imageUrl.startsWith('/uploads')) return `${API_BASE_URL}${imageUrl}`;
    return `${API_BASE_URL}${imageUrl}`;
  };

  const images = product.images || [];
  const currentImageUrl = images[selectedImage]?.url
    ? getImageUrl(images[selectedImage].url)
    : '/placeholder.png';

  const isOutOfStock = product.totalStock === 0;
  const maxQuantity = Math.min(product.totalStock, 10);

  // ✨ BARGAIN: Check eligibility on mount
  useEffect(() => {
    if (product.bargainable && !isOutOfStock) {
      checkBargainEligibility();
    }
  }, [product.id, product.bargainable]);

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
  const handleBargainClick = () => {
    setShowBargainModal(true);
  };

  // ✨ BARGAIN: Handle successful bargain
  const handleBargainSuccess = (data) => {
    console.log('Bargain accepted:', data);
    alert(`Offer accepted at ₹${data.finalPrice}! Item added to cart.`);
    checkBargainEligibility(); // Refresh eligibility
    onClose(); // Close modal
  };

  const handleAddToCart = () => {
    for (let i = 0; i < quantity; i++) {
      onAddToCart(product);
    }
    onClose();
  };

  const handleQuantityChange = (delta) => {
    const newQty = quantity + delta;
    if (newQty >= 1 && newQty <= maxQuantity) setQuantity(newQty);
  };

  const handleWishlistClick = () => {
    if (onToggleWishlist) {
      onToggleWishlist(product);
      onClose();
    }
  };

  const handleBuyNow = () => {
    if (onBuyNow) {
      onBuyNow(product);
    }
  };

  const handleNotifyMe = async () => {
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
      <div className="modal-overlay" onClick={onClose}>
        <div className="product-detail-modal" onClick={(e) => e.stopPropagation()}>
          <button className="modal-close" onClick={onClose}>
            <X size={24} />
          </button>

          <div className="modal-content">
            {/* Left Side - Images */}
            <div className="modal-left">
              <div className="main-image">
                <img
                  src={currentImageUrl}
                  alt={product.name}
                  onError={(e) => e.target.src = '/placeholder.png'}
                />
                {isOutOfStock && (
                  <div className="modal-stock-badge">Out of Stock</div>
                )}
              </div>
              {images.length > 1 && (
                <div className="image-thumbnails">
                  {images.map((img, idx) => (
                    <div
                      key={idx}
                      className={`thumbnail ${idx === selectedImage ? 'active' : ''}`}
                      onClick={() => setSelectedImage(idx)}
                    >
                      <img
                        src={getImageUrl(img.url)}
                        alt={`${product.name} ${idx + 1}`}
                        onError={(e) => e.target.src = '/placeholder.png'}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Side - Details */}
            <div className="modal-right">
              <div className="modal-category">{product.category}</div>
              <h2 className="modal-title">{product.name}</h2>

              <div className="modal-price-section">
                <div className="modal-price">₹{parseFloat(product.baseSellingPrice).toFixed(2)}</div>
                <div className={`modal-stock ${isOutOfStock ? 'out' : 'in'}`}>
                  <Package size={16} />
                  {isOutOfStock ? 'Out of Stock' : `${product.totalStock} in stock`}
                </div>
              </div>

              <div className="modal-description">
                <h4>Description</h4>
                <p>{product.description || 'No description available.'}</p>
              </div>

              {!isOutOfStock && (
                <div className="quantity-selector">
                  <label>Quantity:</label>
                  <div className="quantity-controls">
                    <button onClick={() => handleQuantityChange(-1)} disabled={quantity <= 1}>
                      <Minus size={16} />
                    </button>
                    <span className="quantity-value">{quantity}</span>
                    <button onClick={() => handleQuantityChange(1)} disabled={quantity >= maxQuantity}>
                      <Plus size={16} />
                    </button>
                  </div>
                  <span className="max-qty">Max: {maxQuantity}</span>
                </div>
              )}

              {/* ✨ BARGAIN BUTTON - Shows when eligible */}
              {!isOutOfStock && product.bargainable && eligibility?.canBargain && (
                <button
                  onClick={handleBargainClick}
                  className="btn-modal-bargain"
                  style={{
                    width: '100%',
                    padding: '14px 0',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 12,
                    fontSize: 16,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    marginBottom: 16,
                    transition: 'all 0.3s',
                    boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(245, 158, 11, 0.4)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 15px rgba(245, 158, 11, 0.3)';
                  }}
                >
                  💰 Make an Offer
                  {eligibility.metadata.remainingAttempts > 0 && (
                    <span style={{
                      background: 'rgba(255, 255, 255, 0.3)',
                      padding: '4px 12px',
                      borderRadius: 16,
                      fontSize: 13
                    }}>
                      {eligibility.metadata.remainingAttempts} attempts left
                    </span>
                  )}
                </button>
              )}

              <div className="modal-actions">
                {isOutOfStock ? (
                  <button
                    className="btn-modal-notify"
                    onClick={handleNotifyMe}
                    disabled={notifying || notified}
                    style={{
                      width: '100%',
                      padding: '12px 0',
                      background: notified ? '#22c55e' : '#6366f1',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      fontSize: 15,
                      fontWeight: 700,
                      cursor: notified ? 'default' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8
                    }}
                  >
                    {notified ? (
                      <>✓ You'll be notified when back in stock</>
                    ) : notifying ? (
                      <>Registering...</>
                    ) : (
                      <>
                        <Bell size={18} />
                        Notify Me When Available
                      </>
                    )}
                  </button>
                ) : (
                  <>
                    <button
                      className="btn-modal-cart"
                      onClick={handleAddToCart}
                    >
                      <ShoppingCart size={20} />
                      Add to Cart
                    </button>
                    <button
                      className="btn-modal-wishlist"
                      onClick={handleWishlistClick}
                      style={isWishlisted ? { background: '#dc3545', color: '#fff', borderColor: '#dc3545' } : {}}
                    >
                      <Heart size={20} fill={isWishlisted ? 'currentColor' : 'none'} />
                      {isWishlisted ? 'Wishlisted ♥' : 'Add to Wishlist'}
                    </button>
                  </>
                )}
              </div>

              {/* Buy Now — full-width below */}
              {!isOutOfStock && onBuyNow && (
                <button
                  className="btn-modal-buynow"
                  onClick={handleBuyNow}
                  style={{
                    marginTop: 10, width: '100%', padding: '12px 0',
                    background: 'linear-gradient(135deg, #dc3545, #b91c1c)',
                    color: '#fff', border: 'none', borderRadius: 8,
                    fontSize: 15, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: '0 4px 12px rgba(220,53,69,0.35)',
                    transition: 'opacity .15s'
                  }}
                >
                  <Zap size={18} />
                  Buy Now
                </button>
              )}

              <div className="product-meta-info">
                <div className="meta-item"><strong>SKU:</strong> {product.id}</div>
                <div className="meta-item"><strong>Category:</strong> {product.category}</div>
                {product.subCategory && (
                  <div className="meta-item"><strong>Sub-category:</strong> {product.subCategory}</div>
                )}
                <div className="meta-item">
                  <strong>Availability:</strong> {isOutOfStock ? 'Out of Stock' : 'In Stock'}
                </div>
                {/* Seller Info */}
                {product.createdBy && (
                  <div className="product-meta-info" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
                    <div className="meta-item" style={{
                      background: '#f0f9ff',
                      padding: '10px 14px',
                      borderRadius: 8,
                      border: '1px solid #bfdbfe'
                    }}>
                      <strong style={{ color: '#1e40af' }}>👤 Seller:</strong> 
                      <span style={{ marginLeft: 6, fontWeight: 600, color: '#1f2937' }}>
                        {product.createdBy.name}
                      </span>
                      <span style={{
                        marginLeft: 8,
                        padding: '2px 8px',
                        background: product.createdBy.role === 'ADMIN' ? '#fef2f2' : '#f0fdf4',
                        color: product.createdBy.role === 'ADMIN' ? '#dc2626' : '#16a34a',
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 700
                      }}>
                        {product.createdBy.role}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
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