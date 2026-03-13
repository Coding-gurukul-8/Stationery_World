import { useState, useEffect } from 'react';
import './BargainModal.css';

/**
 * BargainModal Component
 * Handles bargain offer submission with validation and timer
 */
const BargainModal = ({ 
  isOpen, 
  onClose, 
  product, 
  eligibility, 
  onSuccess 
}) => {
  const [offeredPrice, setOfferedPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens
      setOfferedPrice('');
      setError('');
      setResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const config = eligibility?.metadata?.config;
  const basePrice = eligibility?.metadata?.product?.basePrice;
  const remainingAttempts = eligibility?.metadata?.remainingAttempts || 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const price = parseFloat(offeredPrice);

      // Client-side validation
      if (isNaN(price) || price <= 0) {
        setError('Please enter a valid price');
        setLoading(false);
        return;
      }

      if (price > basePrice) {
        setError(`Price cannot exceed ₹${basePrice}`);
        setLoading(false);
        return;
      }

      if (config && price < config.tier3Price) {
        setError(`Minimum acceptable price is ₹${config.tier3Price}`);
        setLoading(false);
        return;
      }

      // Make API call
      const response = await fetch('http://localhost:3000/api/bargain/attempt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          productId: product.id,
          offeredPrice: price
        })
      });

      const data = await response.json();

      if (data.success) {
        // Accepted!
        setResult({
          type: 'success',
          message: data.message,
          data: data.data
        });

        // Call success callback after 2 seconds
        setTimeout(() => {
          onSuccess && onSuccess(data.data);
          onClose();
        }, 2000);
      } else {
        // Rejected
        setResult({
          type: 'error',
          message: data.message,
          data: data.data
        });
      }

    } catch (err) {
      console.error('Bargain attempt error:', err);
      setError('Failed to submit bargain. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target.className === 'bargain-modal-overlay') {
      onClose();
    }
  };

  // If result is shown, display result screen
  if (result) {
    return (
      <div className="bargain-modal-overlay" onClick={handleBackdropClick}>
        <div className="bargain-modal">
          <div className={`bargain-result ${result.type}`}>
            <div className="result-icon">
              {result.type === 'success' ? '✅' : '❌'}
            </div>
            <h3>{result.type === 'success' ? 'Offer Accepted!' : 'Offer Rejected'}</h3>
            <p>{result.message}</p>

            {result.type === 'success' && result.data.finalPrice && (
              <div className="accepted-price">
                <span>Final Price:</span>
                <strong>₹{result.data.finalPrice}</strong>
                <div className="tier-badge">Tier {result.data.acceptedTier}</div>
              </div>
            )}

            {result.type === 'error' && result.data?.remainingAttempts !== undefined && (
              <div className="remaining-attempts">
                {result.data.remainingAttempts} attempt(s) remaining
              </div>
            )}

            <button 
              onClick={onClose}
              className="bargain-btn bargain-btn-primary"
            >
              {result.type === 'success' ? 'View Cart' : 'Try Again'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show bargain form
  return (
    <div className="bargain-modal-overlay" onClick={handleBackdropClick}>
      <div className="bargain-modal">
        <div className="modal-header">
          <h2>Make an Offer</h2>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>

        <div className="modal-body">
          <div className="product-info">
            <h3>{product.name}</h3>
            <div className="price-info">
              <span className="label">Original Price:</span>
              <span className="value">₹{basePrice}</span>
            </div>
          </div>

          {config && (
            <div className="tier-pricing">
              <h4>Price Tiers</h4>
              <div className="tier-grid">
                <div className="tier">
                  <div className="tier-label">Tier 1</div>
                  <div className="tier-price">₹{config.tier1Price}+</div>
                </div>
                <div className="tier">
                  <div className="tier-label">Tier 2</div>
                  <div className="tier-price">₹{config.tier2Price}+</div>
                </div>
                <div className="tier">
                  <div className="tier-label">Tier 3</div>
                  <div className="tier-price">₹{config.tier3Price}+</div>
                </div>
              </div>
              <p className="tier-hint">
                💡 Higher offers have better chance of acceptance
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="offeredPrice">Your Offer</label>
              <div className="input-wrapper">
                <span className="currency">₹</span>
                <input
                  type="number"
                  id="offeredPrice"
                  value={offeredPrice}
                  onChange={(e) => setOfferedPrice(e.target.value)}
                  placeholder="Enter your offer"
                  min={config?.tier3Price || 1}
                  max={basePrice}
                  step="0.01"
                  required
                  disabled={loading}
                />
              </div>
              <small className="hint">
                Min: ₹{config?.tier3Price || 1} • Max: ₹{basePrice}
              </small>
            </div>

            {error && (
              <div className="error-message">
                ⚠️ {error}
              </div>
            )}

            <div className="attempts-info">
              <span className="attempts-remaining">
                {remainingAttempts} attempt(s) remaining
              </span>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                onClick={onClose}
                className="bargain-btn bargain-btn-secondary"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bargain-btn bargain-btn-primary"
                disabled={loading || !offeredPrice}
              >
                {loading ? 'Submitting...' : 'Submit Offer'}
              </button>
            </div>
          </form>

          {config?.cooldownMinutes > 0 && (
            <div className="cooldown-info">
              ⏱️ {config.cooldownMinutes} minute cooldown between attempts
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BargainModal;