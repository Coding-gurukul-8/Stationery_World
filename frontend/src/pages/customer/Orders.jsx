import { useState, useEffect } from 'react';
import { authUtils } from '../../utils/auth';
import './Orders.css';

const API = 'http://localhost:3000';

// Helper to get full image URL
const getImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API}${url}`;
};

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [filter, setFilter] = useState('ALL');
  const [returnLoading, setReturnLoading] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [orderToReturn, setOrderToReturn] = useState(null);

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' || event.key === 'Esc') {
        if (showReturnModal) {
          setShowReturnModal(false);
        } else if (selectedOrder) {
          setSelectedOrder(null);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedOrder, showReturnModal]);

  const loadOrders = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = authUtils.getToken();
      
      if (!token) {
        setError('Please login to view your orders');
        return;
      }

      const response = await fetch(`${API}/api/orders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch orders: ${response.status}`);
      }

      const data = await response.json();

      if (data?.success) {
        const sortedOrders = (data.data || []).sort((a, b) => 
          new Date(b.createdAt) - new Date(a.createdAt)
        );
        setOrders(sortedOrders);
      } else {
        setError(data?.message || 'Failed to load orders');
      }
    } catch (err) {
      setError(err.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    if (filter === 'ALL') return true;
    return order.status === filter;
  });

  const getStatusBadgeStyle = (status) => {
    switch(status) {
      case 'PENDING':
        return { background: 'rgba(255, 241, 118, 0.22)', color: 'var(--text-primary)', border: '1px solid rgba(249, 168, 37, 0.30)' };
      case 'PROCESSING':
        return { background: 'rgba(227, 242, 253, 0.22)', color: 'var(--text-primary)', border: '1px solid rgba(3, 169, 244, 0.32)' };
      case 'CONFIRMED':
      case 'PAID':
        return { background: 'rgba(200, 230, 201, 0.22)', color: 'var(--text-primary)', border: '1px solid rgba(102, 187, 106, 0.35)' };
      case 'SHIPPED':
        return { background: 'rgba(187, 222, 251, 0.22)', color: 'var(--text-primary)', border: '1px solid rgba(66, 165, 245, 0.35)' };
      case 'DELIVERED':
        return { background: 'rgba(165, 214, 167, 0.22)', color: 'var(--text-primary)', border: '1px solid rgba(76, 175, 80, 0.35)' };
      case 'RETURN_REQUESTED':
        return { background: 'rgba(255, 224, 178, 0.22)', color: 'var(--text-primary)', border: '1px solid rgba(255, 183, 77, 0.35)' };
      case 'CANCELLED':
      case 'RETURNED':
        return { background: 'rgba(255, 205, 210, 0.22)', color: 'var(--text-primary)', border: '1px solid rgba(239, 83, 80, 0.35)' };
      default:
        return { background: 'rgba(255, 255, 255, 0.06)', color: 'var(--text-secondary)', border: '1px solid var(--border)' };
    }
  };

  const formatCurrency = (amount) => {
    return `₹${(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const openOrderDetails = (order) => {
    setSelectedOrder(order);
  };

  const closeOrderDetails = () => {
    setSelectedOrder(null);
  };

  const openReturnModal = (order) => {
    setOrderToReturn(order);
    setReturnReason('');
    setShowReturnModal(true);
  };

  const handleReturn = async () => {
    if (!orderToReturn || !returnReason.trim()) {
      alert('Please provide a reason for return');
      return;
    }

    setReturnLoading(true);
    try {
      const token = authUtils.getToken();
      const res = await fetch(`${API}/api/orders/${orderToReturn.id}/return`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reason: returnReason })
      });

      const result = await res.json();
      if (!result.success) throw new Error(result.message);

      alert('Return request submitted successfully! Awaiting admin approval. ✓');
      setShowReturnModal(false);
      setOrderToReturn(null);
      setReturnReason('');
      await loadOrders(); // Refresh orders
    } catch (err) {
      alert('Return failed: ' + err.message);
    } finally {
      setReturnLoading(false);
    }
  };

  const getOrderTypeDisplay = (type) => {
    switch(type) {
      case 'SELF':
        return { icon: '🏠', label: 'Self Order' };
      case 'ADMIN':
        return { icon: '👨‍💼', label: 'Admin Order' };
      case 'CUSTOMER':
      default:
        return { icon: '🛒', label: 'Customer Order' };
    }
  };

  if (loading) {
    return (
      <div className="card">
        <h3>My Orders</h3>
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
          Loading your orders...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <h3>My Orders</h3>
        <div style={{
          padding: 20,
          background: 'rgba(220, 53, 69, 0.16)',
          color: 'var(--text-primary)',
          borderRadius: 8,
          border: '1px solid rgba(220, 53, 69, 0.25)'
        }}>
          <strong>Error:</strong> {error}
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3>My Orders ({orders.length})</h3>
        <button className="btn outline" onClick={loadOrders}>
          🔄 Refresh
        </button>
      </div>

      {/* Filter Buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {['ALL', 'PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'].map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            style={{
              padding: '8px 16px',
              border: filter === status ? '2px solid var(--gold)' : '1px solid var(--border)',
              background: filter === status ? 'rgba(201, 168, 76, 0.14)' : 'var(--bg-surface)',
              color: filter === status ? 'var(--text-primary)' : 'var(--text-secondary)',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: filter === status ? 600 : 400
            }}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📦</div>
          <p style={{ fontSize: 16, marginBottom: 8 }}>No {filter.toLowerCase()} orders found</p>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            {filter === 'ALL' ? 'Start shopping to create your first order!' : `You don't have any ${filter.toLowerCase()} orders.`}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filteredOrders.map(order => {
            const typeDisplay = getOrderTypeDisplay(order.type);
            const firstItem = order.items?.[0];
            const imageUrl = getImageUrl(firstItem?.productPhoto);
            
            return (
              <div
                key={order.id}
                style={{
                  padding: 20,
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  background: 'var(--bg-surface)',
                  cursor: 'pointer',
                  transition: 'box-shadow 0.2s',
                }}
                onClick={() => openOrderDetails(order)}
                onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
              >
                <div style={{ display: 'flex', gap: 16 }}>
                  {/* Product Image */}
                  {imageUrl && (
                    <div style={{
                      width: 100,
                      height: 100,
                      flexShrink: 0,
                      borderRadius: 8,
                      overflow: 'hidden',
                      border: '1px solid var(--border)',
                      background: 'var(--bg-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <img
                        src={imageUrl}
                        alt={firstItem.productName}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.parentElement.innerHTML = '<span style="font-size:32px">📦</span>';
                        }}
                      />
                    </div>
                  )}

                  {/* Order Details */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                          Order #{order.uid}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
                          Placed on {formatDate(order.createdAt)}
                        </div>
                        {/* Seller/Placer Info */}
                        {order.placedBy && (
                          <div style={{ 
                            fontSize: 12, 
                            color: 'var(--text-primary)',
                            marginTop: 6,
                            padding: '4px 10px',
                            background: 'rgba(56, 189, 248, 0.12)',
                            border: '1px solid rgba(96, 165, 250, 0.25)',
                            borderRadius: 6,
                            display: 'inline-block'
                          }}>
                            👤 Sold by: <strong>{order.placedBy.name}</strong> 
                            <span style={{ 
                              marginLeft: 6,
                              padding: '2px 6px',
                              background: order.placedBy.role === 'ADMIN' ? 'rgba(254, 242, 242, 0.2)' : 'rgba(240, 253, 244, 0.2)',
                              color: order.placedBy.role === 'ADMIN' ? 'rgba(220, 38, 38, 0.85)' : 'rgba(22, 163, 74, 0.85)',
                              borderRadius: 4,
                              fontSize: 10,
                              fontWeight: 700
                            }}>
                              {order.placedBy.role}
                            </span>
                          </div>
                        )}
                        {order.admin && order.type === 'ADMIN' && (
                          <div style={{ 
                            fontSize: 12, 
                            color: 'var(--text-primary)',
                            marginTop: 6,
                            padding: '4px 10px',
                            background: 'rgba(250, 204, 21, 0.15)',
                            border: '1px solid rgba(253, 230, 138, 0.35)',
                            borderRadius: 6,
                            display: 'inline-block'
                          }}>
                            👨‍💼 Created by Admin: <strong>{order.admin.name}</strong>
                          </div>
                        )}
                      </div>
                      <span style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        ...getStatusBadgeStyle(order.status)
                      }}>
                        {order.status}
                      </span>
                    </div>

                    {/* Product Preview */}
                    {firstItem && (
                      <div style={{ 
                        marginTop: 8, 
                        padding: 8, 
                        background: 'var(--bg-muted)', 
                        borderRadius: 6,
                        fontSize: 13
                      }}>
                        <strong>{firstItem.productName}</strong>
                        {order.items.length > 1 && (
                          <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>
                            +{order.items.length - 1} more item{order.items.length > 2 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    )}

                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      marginTop: 12, 
                      paddingTop: 12, 
                      borderTop: '1px solid var(--border)' 
                    }}>
                      <div style={{ display: 'flex', gap: 20 }}>
                        <div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Items</div>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{order.items?.length || 0}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Total</div>
                          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                            {formatCurrency(order.totalAmount || order.totalSp)}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Type</div>
                          <div style={{ fontSize: 14, fontWeight: 500 }}>
                            {typeDisplay.icon} {typeDisplay.label}
                          </div>
                        </div>
                      </div>
                      <button
                        className="btn outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          openOrderDetails(order);
                        }}
                        style={{ fontSize: 13 }}
                      >
                        View Details →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Order Details Modal */}
      {selectedOrder && (
        <div 
          className="modal" 
          onClick={closeOrderDetails}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            zIndex: 9999,
            padding: '24px 16px',
            boxSizing: 'border-box',
            overflowY: 'auto',
            overflowX: 'hidden'
          }}
        >
          <div 
            className="modal-content" 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-surface)',
              borderRadius: 12,
              width: 'min(1200px, calc(100vw - 48px))',
              maxHeight: 'calc(90vh)',
              overflowY: 'auto',
              overflowX: 'hidden',
              padding: 24,
              color: 'var(--text-primary)',
              boxShadow: 'var(--shadow-lg)',
              boxSizing: 'border-box'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h4 style={{ margin: 0, fontSize: 20, color: 'var(--text-primary)' }}>Order #{selectedOrder.uid}</h4>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                  Placed on {new Date(selectedOrder.createdAt).toLocaleString('en-IN')}
                </div>
                {/* Seller/Admin Info in Modal */}
                {selectedOrder.placedBy && (
                  <div style={{ 
                    marginTop: 8, 
                    padding: 10, 
                    background: 'rgba(56, 189, 248, 0.12)', 
                    border: '1px solid rgba(96, 165, 250, 0.25)',
                    borderRadius: 8,
                    fontSize: 13,
                    display: 'inline-block'
                  }}>
                    👤 Sold by: <strong>{selectedOrder.placedBy.name}</strong>
                    <span style={{ 
                      marginLeft: 8,
                      padding: '2px 8px',
                      background: selectedOrder.placedBy.role === 'ADMIN' ? 'rgba(254, 242, 242, 0.25)' : 'rgba(240, 253, 244, 0.25)',
                      color: selectedOrder.placedBy.role === 'ADMIN' ? 'rgba(220, 38, 38, 0.85)' : 'rgba(22, 163, 74, 0.85)',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 700
                    }}>
                      {selectedOrder.placedBy.role}
                    </span>
                  </div>
                )}
                {selectedOrder.admin && selectedOrder.type === 'ADMIN' && (
                  <div style={{ 
                    marginTop: 8, 
                    padding: 10, 
                    background: 'rgba(254, 243, 199, 0.22)', 
                    border: '1px solid rgba(253, 230, 138, 0.35)',
                    borderRadius: 8,
                    fontSize: 13,
                    display: 'inline-block'
                  }}>
                    👨‍💼 Created by Admin: <strong>{selectedOrder.admin.name}</strong>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  ...getStatusBadgeStyle(selectedOrder.status)
                }}>
                  {selectedOrder.status}
                </span>
                {selectedOrder.status === 'DELIVERED' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedOrder(null); openReturnModal(selectedOrder); }}
                    style={{
                      background: 'var(--gold)',
                      color: 'var(--text-inverse)',
                      border: 'none',
                      borderRadius: 6,
                      padding: '8px 16px',
                      cursor: 'pointer',
                      fontSize: 14,
                      fontWeight: 600
                    }}
                  >
                    ↩ Return Order
                  </button>
                )}
                <button 
                  onClick={closeOrderDetails}
                  style={{
                    background: 'rgba(220, 53, 69, 0.85)',
                    color: 'var(--text-inverse)',
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 16px',
                    cursor: 'pointer',
                    fontSize: 14
                  }}
                >
                  ✕ Close
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              {/* Left Column - Shipping Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <h5 style={{ margin: '0 0 12px 0', fontSize: 15, color: 'var(--text-primary)' }}>Shipping Address</h5>
                <div style={{ padding: 16, background: 'var(--bg-muted)', borderRadius: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                    {selectedOrder.recipientName}
                  </div>
                  {selectedOrder.recipientPhone && (
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      📞 {selectedOrder.recipientPhone}
                    </div>
                  )}
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>
                    {selectedOrder.addressLine1}
                  </div>
                  {selectedOrder.addressLine2 && (
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{selectedOrder.addressLine2}</div>
                  )}
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {selectedOrder.city}, {selectedOrder.state} {selectedOrder.postalCode}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{selectedOrder.country}</div>
                </div>

                {selectedOrder.note && (
                  <div style={{ marginTop: 12 }}>
                    <h5 style={{ margin: '0 0 8px 0', fontSize: 15, color: 'var(--text-primary)' }}>Order Note</h5>
                    <div style={{ padding: 12, background: 'rgba(255, 243, 235, 0.18)', borderRadius: 8, border: '1px solid rgba(254, 243, 199, 0.35)' }}>
                      <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{selectedOrder.note}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column - Order Items */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <h5 style={{ margin: '0 0 12px 0', fontSize: 15, color: 'var(--text-primary)' }}>Order Items</h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {(selectedOrder.items || []).map((item, idx) => {
                    const itemImageUrl = getImageUrl(item.productPhoto);
                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          gap: 12,
                          padding: 12,
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          background: 'var(--bg-surface)'
                        }}
                      >
                        {itemImageUrl && (
                          <img
                            src={itemImageUrl}
                            alt={item.productName}
                            style={{
                              width: 60,
                              height: 60,
                              objectFit: 'cover',
                              borderRadius: 6,
                              border: '1px solid var(--border)',
                              flexShrink: 0,
                              background: 'var(--bg-muted)'
                            }}
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.parentElement.innerHTML = '<div style="width:60px;height:60px;display:flex;align-items:center;justify-content:center;background:rgba(235, 236, 240, 0.4);border-radius:6px"><span style="font-size:24px">📦</span></div>';
                            }}
                          />
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                            {item.productName}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            Qty: {item.quantity} × {formatCurrency(item.sp)}
                          </div>
                          {item.bargainApplied && (
                            <div style={{ 
                              fontSize: 11, 
                              color: 'rgba(22, 163, 74, 0.85)', 
                              marginTop: 2,
                              fontWeight: 500 
                            }}>
                              ✓ Bargain Applied
                            </div>
                          )}
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>
                            {formatCurrency(item.subtotalSp)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Order Summary */}
            <div style={{
              padding: 16,
              background: 'var(--bg-muted)',
              borderRadius: 8,
              marginTop: 20
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Subtotal</span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>
                  {formatCurrency(selectedOrder.totalSp)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Shipping</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(46, 125, 50, 0.85)' }}>FREE</span>
              </div>
              <div style={{
                borderTop: '2px solid var(--border)',
                paddingTop: 8,
                marginTop: 8,
                display: 'flex',
                justifyContent: 'space-between'
              }}>
                <span style={{ fontSize: 16, fontWeight: 700 }}>Total</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {formatCurrency(selectedOrder.totalAmount || selectedOrder.totalSp)}
                </span>
              </div>
            </div>

            {/* Order Timeline */}
            <div style={{ marginTop: 20 }}>
              <h5 style={{ margin: '0 0 12px 0', fontSize: 15, color: 'var(--text-primary)' }}>Order Timeline</h5>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                <div style={{ marginBottom: 6 }}>
                  <strong>Created:</strong> {new Date(selectedOrder.createdAt).toLocaleString('en-IN')}
                </div>
                <div>
                  <strong>Last Updated:</strong> {new Date(selectedOrder.updatedAt).toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Return Modal */}
      {showReturnModal && orderToReturn && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.6)', zIndex: 10000,
            padding: '24px 16px', boxSizing: 'border-box',
            overflowY: 'auto', overflowX: 'hidden'
          }}
          onClick={() => !returnLoading && setShowReturnModal(false)}
        >
          <div
            style={{
              position: 'relative',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'var(--bg-surface)', borderRadius: 12, padding: 24,
              width: 'min(520px, calc(100vw - 48px))', boxSizing: 'border-box',
              maxHeight: 'calc(90vh)', overflowY: 'auto', overflowX: 'hidden'
            }}
            onClick={e => e.stopPropagation()}
          >
            <h4 style={{ margin: '0 0 16px 0', color: 'var(--text-primary)' }}>Request Return for Order #{orderToReturn.uid}</h4>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Please provide a reason for the return. Your request will be sent to the admin for approval.
            </p>
            <textarea
              value={returnReason}
              onChange={e => setReturnReason(e.target.value)}
              placeholder="Reason for return..."
              rows={4}
              style={{
                width: '100%', padding: 12, border: '1px solid var(--border)',
                borderRadius: 8, fontSize: 14, resize: 'vertical', boxSizing: 'border-box'
              }}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button
                onClick={() => setShowReturnModal(false)}
                disabled={returnLoading}
                style={{
                  flex: 1, padding: 12, border: '1px solid var(--border)',
                  background: 'var(--bg-surface)', borderRadius: 8, cursor: 'pointer', fontSize: 14
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleReturn}
                disabled={returnLoading || !returnReason.trim()}
                style={{
                  flex: 1, padding: 12, border: 'none',
                  background: returnLoading || !returnReason.trim() ? 'rgba(156, 163, 175, 0.65)' : 'var(--gold)',
                  color: 'var(--text-inverse)', borderRadius: 8, fontSize: 14, fontWeight: 600,
                  cursor: returnLoading || !returnReason.trim() ? 'not-allowed' : 'pointer'
                }}
              >
                {returnLoading ? 'Processing...' : 'Submit Return'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}