import { useEffect, useState } from 'react';
import { authUtils } from '../../utils/auth';
import { useSearch } from '../../context/SearchContext';
import './Reports.css';
import './Orders.css';
import { API_BASE_URL } from '../../config/constants';

const API = API_BASE_URL;

// Image URL helper
const getImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API}${url}`;
};

const ORDER_TYPES = [
  { id: 'ALL', label: 'All Orders' },
  { id: 'CUSTOMER', label: 'Customer Orders' },
  { id: 'SELF', label: 'Self Orders' },
  { id: 'ADMIN', label: 'Admin Orders' },
  { id: 'PENDING', label: 'Pending Orders' },
  { id: 'RETURN_REQUESTED', label: 'Return Requests' },
  { id: 'DELIVERED', label: 'Delivered Orders' }
];

const STATUS_OPTIONS = ['PENDING', 'PROCESSING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'RETURN_REQUESTED', 'RETURNED', 'CANCELLED'];

export default function Orders() {
  const [type, setType] = useState('ALL');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState(null);

  // ✅ Current logged-in admin's ID — used for SELF filter and dynamic type display
  const currentUserId = authUtils.getUser()?.id;

  // Create Order Modal States
  const [showCreateOrderModal, setShowCreateOrderModal] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [createOrderForm, setCreateOrderForm] = useState({
    customerId: '',
    items: [{ productId: '', quantity: 1 }],
    recipientName: '',
    recipientPhone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    note: ''
  });
  const [allProducts, setAllProducts] = useState([]);
  const [createOrderLoading, setCreateOrderLoading] = useState(false);

  // --- bargain permission helper states ------------------------------------------------
  const [permissionProductId, setPermissionProductId] = useState('');
  const [permissionExpires, setPermissionExpires] = useState('');
  const [granting, setGranting] = useState(false);
  const [permissionMessage, setPermissionMessage] = useState('');

  const { registerSearchHandler, unregisterSearchHandler } = useSearch();

  useEffect(() => {
    load();
  }, [type]);

  // Register search handler
  useEffect(() => {
    const searchOrders = async (query) => {
      const q = query.toLowerCase().trim();
      return orders
        .filter(o => 
          o.uid?.toLowerCase().includes(q) ||
          o.user?.name?.toLowerCase().includes(q) ||
          o.user?.email?.toLowerCase().includes(q) ||
          o.recipientName?.toLowerCase().includes(q) ||
          o.recipientPhone?.includes(q) ||
          String(o.id).includes(q)
        )
        .slice(0, 10)
        .map(o => ({
          id: o.id,
          title: `Order #${o.uid}`,
          subtitle: `${o.user?.name || o.recipientName || 'Guest'} • ${formatCurrency(o.totalAmount || o.totalSp)} • ${o.status}${o.isPaid ? ' • PAID' : ''}`,
          badge: o.status,
          onClick: () => openDetails(o)
        }));
    };

    registerSearchHandler('orders', searchOrders, 'Search orders by ID, customer, or phone...');

    return () => unregisterSearchHandler();
  }, [orders, registerSearchHandler, unregisterSearchHandler]);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const token = authUtils.getToken();
      
      if (!token) {
        setError('Not authenticated. Please login.');
        setLoading(false);
        return;
      }

      const res = await fetch(`${API}/api/orders/admin/all`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`API error ${res.status}: ${text.slice(0, 200)}`);
      }

      const data = await res.json();

      if (data?.success) {
        let filteredOrders = data.data || [];

        if (type === 'CUSTOMER') {
          filteredOrders = filteredOrders.filter(o => o.type === 'CUSTOMER');
        } else if (type === 'SELF') {
          // ✅ FIXED: Show only orders belonging to the currently logged-in admin.
          // Matches on userId (the order owner) — not o.type === 'SELF',
          // because that would show ALL admins' personal orders to everyone.
          filteredOrders = filteredOrders.filter(o => o.userId === currentUserId);
        } else if (type === 'ADMIN') {
          filteredOrders = filteredOrders.filter(o => o.type === 'ADMIN');
        } else if (type === 'PENDING') {
          filteredOrders = filteredOrders.filter(o => o.status === 'PENDING');
        } else if (type === 'RETURN_REQUESTED') {
          filteredOrders = filteredOrders.filter(o => o.status === 'RETURN_REQUESTED');
        } else if (type === 'DELIVERED') {
          filteredOrders = filteredOrders.filter(o => o.status === 'DELIVERED');
        }

        setOrders(filteredOrders);
      } else {
        setError(data?.message || 'Failed to load orders');
      }
    } catch (err) {
      console.error('Orders load error:', err);
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }

  // Fetch customers and products for create order modal
  async function loadCreateOrderData() {
    try {
      const token = authUtils.getToken();
      
      // Fetch all users
      const usersRes = await fetch(`${API}/api/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const usersData = await usersRes.json();
      if (usersData.success) {
        setCustomers(usersData.data.filter(u => u.role === 'CUSTOMER'));
      }
      
      // Fetch products
      const productsRes = await fetch(`${API}/api/products`);
      const productsData = await productsRes.json();
      if (productsData.success) {
        setAllProducts(productsData.data.filter(p => p.isActive && p.totalStock > 0));
      }
    } catch (err) {
      console.error('Load create order data error:', err);
    }
  }

  function openCreateOrderModal() {
    loadCreateOrderData();
    setShowCreateOrderModal(true);
  }

  function addOrderItem() {
    setCreateOrderForm(f => ({
      ...f,
      items: [...f.items, { productId: '', quantity: 1 }]
    }));
  }

  function removeOrderItem(index) {
    setCreateOrderForm(f => ({
      ...f,
      items: f.items.filter((_, i) => i !== index)
    }));
  }

  function updateOrderItem(index, field, value) {
    setCreateOrderForm(f => ({
      ...f,
      items: f.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  }

  async function handleCreateOrder() {
    try {
      setCreateOrderLoading(true);
      const token = authUtils.getToken();
      
      // Validate
      if (!createOrderForm.customerId) {
        alert('Please select a customer');
        return;
      }
      
      const validItems = createOrderForm.items.filter(i => i.productId && i.quantity > 0);
      if (validItems.length === 0) {
        alert('Please add at least one product');
        return;
      }
      
      const res = await fetch(`${API}/api/orders/admin/create-for-customer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...createOrderForm,
          items: validItems.map(i => ({
            productId: parseInt(i.productId),
            quantity: parseInt(i.quantity)
          }))
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        alert('✅ Order created successfully!');
        setShowCreateOrderModal(false);
        setCreateOrderForm({
          customerId: '',
          items: [{ productId: '', quantity: 1 }],
          recipientName: '',
          recipientPhone: '',
          addressLine1: '',
          addressLine2: '',
          city: '',
          state: '',
          postalCode: '',
          country: '',
          note: ''
        });
        await load();
      } else {
        alert('❌ Error: ' + (data.message || 'Failed to create order'));
      }
    } catch (err) {
      alert('❌ Request failed: ' + err.message);
    } finally {
      setCreateOrderLoading(false);
    }
  }

  function handleCustomerSelect(customerId) {
    const customer = customers.find(c => c.id === parseInt(customerId));
    if (customer) {
      setCreateOrderForm(f => ({
        ...f,
        customerId,
        recipientName: customer.name || '',
        recipientPhone: customer.phone || '',
        addressLine1: customer.addressLine1 || '',
        addressLine2: customer.addressLine2 || '',
        city: customer.city || '',
        state: customer.state || '',
        postalCode: customer.postalCode || '',
        country: customer.country || ''
      }));
    } else {
      setCreateOrderForm(f => ({ ...f, customerId }));
    }
  }

  function openDetails(o) {
    setSelected(o);
  }

  // reset permission inputs when a new order is opened
  useEffect(() => {
    setPermissionProductId('');
    setPermissionExpires('');
    setPermissionMessage('');
  }, [selected]);

  async function handleGrantPermission() {
    if (!selected?.user?.id || !permissionProductId) return;
    setGranting(true);
    setPermissionMessage('');
    try {
      const token = authUtils.getToken();
      const body = { userId: selected.user.id, productId: parseInt(permissionProductId) };
      if (permissionExpires) body.expiresAt = permissionExpires;
      const res = await fetch(`${API}/api/bargain/admin/permission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.success) {
        setPermissionMessage('Permission granted.');
      } else {
        setPermissionMessage(data.message || 'Failed to grant');
      }
    } catch (err) {
      setPermissionMessage('Error: ' + err.message);
    } finally {
      setGranting(false);
    }
  }

  function closeDetails(e) {
    if (e) e.stopPropagation();
    setSelected(null);
  }

  async function handleStatusChange(orderId, newStatus) {
    const order = orders.find(o => o.id === orderId);
    
    if ((newStatus === 'SHIPPED' || newStatus === 'DELIVERED') && !order.isPaid) {
      setPendingStatusChange({ orderId, newStatus });
      setShowPaymentConfirm(true);
    } else {
      changeStatus(orderId, newStatus);
    }
  }

  async function confirmPaymentAndChangeStatus(isPaid) {
    setShowPaymentConfirm(false);
    
    if (isPaid) {
      await markAsPaid(pendingStatusChange.orderId);
    }
    
    await changeStatus(pendingStatusChange.orderId, pendingStatusChange.newStatus);
    setPendingStatusChange(null);
  }

  async function changeStatus(orderId, newStatus) {
    setStatusLoading(true);

    try {
      const token = authUtils.getToken();

      const res = await fetch(`${API}/api/orders/admin/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      const data = await res.json();

      if (data?.success) {
        await load();
        
        if (selected && selected.id === orderId) {
          const updatedOrder = orders.find(o => o.id === orderId);
          setSelected(updatedOrder);
        }

        alert('✅ Status updated successfully!');
      } else {
        alert('❌ Error: ' + (data?.message || 'Update failed'));
      }
    } catch (err) {
      console.error('Status update error:', err);
      alert('❌ Request failed: ' + err.message);
    } finally {
      setStatusLoading(false);
    }
  }

  async function markAsPaid(orderId) {
    try {
      const token = authUtils.getToken();

      const res = await fetch(`${API}/api/orders/admin/${orderId}/mark-paid`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await res.json();

      if (data?.success) {
        await load();
        alert('✅ Order marked as PAID!');
      } else {
        alert('❌ Error: ' + (data?.message || 'Failed to mark as paid'));
      }
    } catch (err) {
      console.error('Mark as paid error:', err);
      alert('❌ Request failed: ' + err.message);
    }
  }

  async function processRefund(orderId) {
    if (!confirm('Are you sure you want to process refund for this order?')) {
      return;
    }

    try {
      const token = authUtils.getToken();

      const res = await fetch(`${API}/api/orders/admin/${orderId}/refund`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await res.json();

      if (data?.success) {
        await load();
        alert('✅ Refund processed successfully!');
      } else {
        alert('❌ Error: ' + (data?.message || 'Refund failed'));
      }
    } catch (err) {
      console.error('Refund error:', err);
      alert('❌ Request failed: ' + err.message);
    }
  }

  const formatCurrency = (amount) => {
    return `₹${(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  };

  // ✅ Dynamically compute what type label to SHOW based on who is logged in:
  // - If the order belongs to the current user → "SELF" (it's my order)
  // - If the order belongs to someone else but was stamped SELF (another admin's personal order) → "ADMIN"
  // - Everything else (CUSTOMER, ADMIN) stays as-is
  const getDisplayType = (order) => {
    if (order.type === 'SELF') {
      return order.userId === currentUserId ? 'SELF' : 'ADMIN';
    }
    return order.type;
  };

  const getTypeBadgeStyle = (orderType) => {
    switch(orderType) {
      case 'CUSTOMER':
        return { background: '#e3f2fd', color: '#1976d2' };
      case 'SELF':
        return { background: '#fff3e0', color: '#f57c00' };
      case 'ADMIN':
        return { background: '#fce4ec', color: '#c2185b' };
      default:
        return { background: '#f5f5f5', color: '#666' };
    }
  };

  const getStatusBadgeStyle = (status) => {
    switch(status) {
      case 'PENDING':
        return { background: '#fff9c4', color: '#f57f17' };
      case 'PROCESSING':
        return { background: '#e1f5fe', color: '#0277bd' };
      case 'CONFIRMED':
        return { background: '#c8e6c9', color: '#388e3c' };
      case 'SHIPPED':
        return { background: '#bbdefb', color: '#1976d2' };
      case 'DELIVERED':
        return { background: '#a5d6a7', color: '#2e7d32' };
      case 'CANCELLED':
      case 'RETURNED':
        return { background: '#ffcdd2', color: '#c62828' };
      default:
        return { background: '#f5f5f5', color: '#666' };
    }
  };

  const canMarkAsPaid = (order) => {
    return !order.isPaid && ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'].includes(order.status);
  };

  const canRefund = (order) => {
    return order.isPaid && ['CANCELLED', 'RETURNED', 'RETURN_REQUESTED'].includes(order.status);
  };

  return (
    <div className="card">
      <div className="orders-header">
        <h3>Orders Management</h3>
        <div className="orders-header actions">
          <button 
            className="btn primary small-btn"
            onClick={openCreateOrderModal}
          >
            + Create Order for Customer
          </button>
          <span className="orders-filter-label">Filter:</span>
          <select 
            value={type} 
            onChange={e => setType(e.target.value)}
            className="orders-select"
          >
            {ORDER_TYPES.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {loading && <div className="orders-loading">Loading orders...</div>}

      {error && (
        <div className="orders-error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {!loading && !error && orders.length === 0 && (
        <div className="orders-empty">
          {type === 'ALL' ? 'No orders found' : `No ${type.toLowerCase()} orders found`}
        </div>
      )}

      {!loading && orders.length > 0 && (
        <div className="order-list-wrapper">
          <div className="order-count">
            Showing {orders.length} {type === 'ALL' ? '' : type.toLowerCase()} order{orders.length !== 1 ? 's' : ''}
          </div>

          <table className="reports-table table-fullwidth">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Type</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id}>
                  <td>{o.uid}</td>
                  <td>{new Date(o.createdAt).toLocaleDateString('en-IN')}</td>
                  <td>
                    {o.user ? `${o.user.name}` : o.recipientName || 'Guest'}
                  </td>
                  <td>{formatCurrency(o.totalAmount || o.totalSp)}</td>
                  <td>
                    <span className="badge" style={getTypeBadgeStyle(getDisplayType(o))}>
                      {getDisplayType(o)}
                    </span>
                  </td>
                  <td>
                    <select 
                      value={o.status} 
                      onChange={e => handleStatusChange(o.id, e.target.value)} 
                      disabled={statusLoading}
                      className="status-select"
                      style={getStatusBadgeStyle(o.status)}
                    >
                      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td>
                    {o.isPaid ? (
                      <span className="badge badge-paid">
                        ✓ PAID
                      </span>
                    ) : (
                      <span className="badge badge-unpaid">
                        NOT PAID
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="action-group">
                      <button 
                        className="btn outline" 
                        onClick={(e) => {
                          e.stopPropagation();
                          openDetails(o);
                        }}
                      >
                        View
                      </button>
                      
                      {canMarkAsPaid(o) && (
                        <button 
                          className="btn primary button-small" 
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsPaid(o.id);
                          }}
                        >
                          Mark Paid
                        </button>
                      )}
                      
                      {canRefund(o) && (
                        <button 
                          className="btn button-small button-refund" 
                          onClick={(e) => {
                            e.stopPropagation();
                            processRefund(o.id);
                          }}
                        >
                          Refund
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Payment Confirmation Modal */}
      {showPaymentConfirm && (
        <div 
          className="modal" 
          onClick={() => setShowPaymentConfirm(false)}
        >
          <div 
            className="modal-content modal-small" 
            onClick={(e) => e.stopPropagation()}
          >
            <h4>Payment Confirmation</h4>
            <p className="modal-paragraph">
              Has this order been paid by the customer?
            </p>
            <div className="modal-footer-space">
              <button 
                className="btn outline" 
                onClick={() => confirmPaymentAndChangeStatus(false)}
              >
                No, Not Paid
              </button>
              <button 
                className="btn primary" 
                onClick={() => confirmPaymentAndChangeStatus(true)}
              >
                Yes, Paid
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Order Modal */}
      {showCreateOrderModal && (
        <div className="modal" onClick={() => !createOrderLoading && setShowCreateOrderModal(false)}>
          <div className="modal-content modal-medium" onClick={e => e.stopPropagation()}>
            <h4>Create Order for Customer</h4>
            
            {/* Customer Selection */}
            <div className="products-section">
              <label className="customer-select-label">
                Select Customer *
              </label>
              <select
                value={createOrderForm.customerId}
                onChange={e => handleCustomerSelect(e.target.value)}
                className="customer-select"
              >
                <option value="">-- Select Customer --</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.email})
                  </option>
                ))}
              </select>
            </div>

            {/* Products */}
            <div className="products-section">
              <div className="products-header">
                <label className="modal-heading">Products *</label>
                <button 
                  onClick={addOrderItem}
                  className="add-product-btn"
                >
                  + Add Product
                </button>
              </div>
              
              {createOrderForm.items.map((item, index) => (
                <div key={index} className="product-row">
                  <select
                    value={item.productId}
                    onChange={e => updateOrderItem(index, 'productId', e.target.value)}
                    className="product-select"
                  >
                    <option value="">-- Select Product --</option>
                    {allProducts.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} (₹{p.baseSellingPrice} - Stock: {p.totalStock})
                      </option>
                    ))}
                  </select>
                  
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={e => updateOrderItem(index, 'quantity', e.target.value)}
                    placeholder="Qty"
                    className="product-qty"
                  />
                  
                  {createOrderForm.items.length > 1 && (
                    <button
                      onClick={() => removeOrderItem(index)}
                      className="product-remove-btn"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Delivery Details */}
            <div className="products-section">
              <h5 className="modal-heading">Delivery Details</h5>
              <div className="grid-two">
                <input
                  placeholder="Recipient Name"
                  value={createOrderForm.recipientName}
                  onChange={e => setCreateOrderForm(f => ({ ...f, recipientName: e.target.value }))}
                  className="form-input"
                />
                <input
                  placeholder="Phone"
                  value={createOrderForm.recipientPhone}
                  onChange={e => setCreateOrderForm(f => ({ ...f, recipientPhone: e.target.value }))}
                  className="form-input"
                />
                <input
                  placeholder="Address Line 1"
                  value={createOrderForm.addressLine1}
                  onChange={e => setCreateOrderForm(f => ({ ...f, addressLine1: e.target.value }))}
                  className="form-input form-span-2"
                />
                <input
                  placeholder="Address Line 2"
                  value={createOrderForm.addressLine2}
                  onChange={e => setCreateOrderForm(f => ({ ...f, addressLine2: e.target.value }))}
                  className="form-input form-span-2"
                />
                <input
                  placeholder="City"
                  value={createOrderForm.city}
                  onChange={e => setCreateOrderForm(f => ({ ...f, city: e.target.value }))}
                  className="form-input"
                />
                <input
                  placeholder="State"
                  value={createOrderForm.state}
                  onChange={e => setCreateOrderForm(f => ({ ...f, state: e.target.value }))}
                  className="form-input"
                />
                <input
                  placeholder="Postal Code"
                  value={createOrderForm.postalCode}
                  onChange={e => setCreateOrderForm(f => ({ ...f, postalCode: e.target.value }))}
                  className="form-input"
                />
                <input
                  placeholder="Country"
                  value={createOrderForm.country}
                  onChange={e => setCreateOrderForm(f => ({ ...f, country: e.target.value }))}
                  className="form-input"
                />
              </div>
              <textarea
                placeholder="Order Note (optional)"
                value={createOrderForm.note}
                onChange={e => setCreateOrderForm(f => ({ ...f, note: e.target.value }))}
                rows={2}
                className="textarea-full"
              />
            </div>

            {/* Actions */}
            <div className="modal-footer-right">
              <button
                onClick={() => setShowCreateOrderModal(false)}
                disabled={createOrderLoading}
                className="btn outline"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateOrder}
                disabled={createOrderLoading}
                className="btn primary"
              >
                {createOrderLoading ? 'Creating...' : 'Create Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details modal */}
      {selected && (
        <div 
          className="modal" 
          onClick={closeDetails}
        >
          <div 
            className="modal-content" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-space-between">
              <h4>Order #{selected.uid}</h4>
              <div className="flex-gap-8">
                <span className="badge" style={getTypeBadgeStyle(getDisplayType(selected))}>
                  {getDisplayType(selected)}
                </span>
                <span className="badge" style={getStatusBadgeStyle(selected.status)}>
                  {selected.status}
                </span>
                {selected.isPaid ? (
                  <span className="badge badge-paid">
                    ✓ PAID
                  </span>
                ) : (
                  <span className="badge badge-unpaid">
                    NOT PAID
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex-gap-16 mt-16">
              <div className="flex-1">
                <h5>Customer Information</h5>
                <div><strong>Name:</strong> {selected.user?.name || selected.recipientName || 'N/A'}</div>
                <div><strong>Email:</strong> {selected.user?.email || 'N/A'}</div>
                <div><strong>Phone:</strong> {selected.recipientPhone || selected.user?.phone || 'N/A'}</div>
                
                <h5 className="mt-16">Shipping Address</h5>
                <div>{selected.addressLine1 || 'N/A'}</div>
                {selected.addressLine2 && <div>{selected.addressLine2}</div>}
                <div>{selected.city} {selected.state} {selected.postalCode}</div>
                <div>{selected.country}</div>

                {/* Admin: ability to grant bargain permission for an item */}
                {selected.items && selected.items.length > 0 && (
                  <div className="permission-box">
                    <strong>Grant bargain permission</strong>
                    <div className="flex-wrap-gap">
                      <select
                        value={permissionProductId}
                        onChange={e => setPermissionProductId(e.target.value)}
                      >
                        <option value="">Select product</option>
                        {selected.items.map(it => (
                          <option key={it.productId} value={it.productId}>{it.productName}</option>
                        ))}
                      </select>
                      <input
                        type="date"
                        value={permissionExpires}
                        onChange={e => setPermissionExpires(e.target.value)}
                        placeholder="Expires at"
                        className="min-width-120"
                      />
                      <button
                        className="btn primary"
                        disabled={granting || !permissionProductId}
                        onClick={handleGrantPermission}
                      >
                        {granting ? 'Granting...' : 'Grant'}
                      </button>
                    </div>
                    {permissionMessage && (
                      <div className="permission-msg">{permissionMessage}</div>
                    )}
                  </div>
                )}

                {selected.note && (
                  <div className="mt-12">
                    <strong>Note:</strong> {selected.note}
                  </div>
                )}

                {selected.placedBy && (
                  <div className="info-box">
                    <strong>Placed by:</strong> {selected.placedBy.name} ({selected.placedBy.role})
                  </div>
                )}

                {selected.admin && (
                  <div className="info-box-alt">
                    <strong>Created by Admin:</strong> {selected.admin.name}
                  </div>
                )}

                <div className="modal-footer-flex">
                  {canMarkAsPaid(selected) && (
                    <button 
                      className="btn primary" 
                      onClick={() => {
                        markAsPaid(selected.id);
                        closeDetails();
                      }}
                    >
                      Mark as PAID
                    </button>
                  )}
                  
                  {canRefund(selected) && (
                    <button 
                      className="btn btn-danger" 
                      onClick={() => {
                        processRefund(selected.id);
                        closeDetails();
                      }}
                    >
                      Process Refund
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1">
                <h5>Order Items</h5>
                <table className="details-table">
                  <thead>
                    <tr>
                      <th>Photo</th>
                      <th>Product</th>
                      <th>Qty</th>
                      <th>Price</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selected.items || []).map((it, idx) => (
                      <tr key={idx}>
                        <td>
                          {it.productPhoto ? (
                            <img 
                              src={getImageUrl(it.productPhoto)}
                              alt="product" 
                              className="product-img"
                              onError={(e) => e.target.style.display = 'none'}
                            />
                          ) : (
                            '-'
                          )}
                        </td>
                        <td>
                          <div>{it.productName}</div>
                          {it.product?.createdBy && (
                            <div className="mt-2 muted-text font-11">
                              by {it.product.createdBy.name}
                            </div>
                          )}
                        </td>
                        <td>{it.quantity}</td>
                        <td>{formatCurrency(it.sp)}</td>
                        <td>{formatCurrency(it.subtotalSp)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="totals-box">
                  <div className="totals-label">
                    <strong>Total Amount:</strong> 
                    <span className="totals-value green">
                      {formatCurrency(selected.totalAmount || selected.totalSp)}
                    </span>
                  </div>
                  <div className="totals-row mt-8">
                    <strong>Total Cost:</strong> 
                    <span className="totals-value">
                      {formatCurrency(selected.totalCp)}
                    </span>
                  </div>
                  <div className="totals-row mt-8">
                    <strong>Profit:</strong> 
                    <span className="totals-value blue">
                      {formatCurrency((selected.totalSp || 0) - (selected.totalCp || 0))}
                    </span>
                  </div>
                  <div className="totals-row mt-8">
                    <strong>Payment Status:</strong> 
                    <span className={`totals-value ${selected.isPaid ? 'green' : 'red'}`}>
                      {selected.isPaid ? '✓ PAID' : '✗ NOT PAID'}
                    </span>
                  </div>
                </div>

                <div className="muted-text">
                  <div><strong>Created:</strong> {new Date(selected.createdAt).toLocaleString('en-IN')}</div>
                  <div><strong>Updated:</strong> {new Date(selected.updatedAt).toLocaleString('en-IN')}</div>
                </div>

                {selected.audits && selected.audits.length > 0 && (
                  <div className="mt-16">
                    <h5>Status History</h5>
                    <ul className="status-history-list">
                      {selected.audits.map((a, idx) => (
                        <li key={idx} className="status-history-item">
                          <div className="font-13">
                            <strong>{a.admin?.name || 'System'}</strong> — 
                            <span className="status-from"> {a.fromStatus}</span> → 
                            <span className="status-to"> {a.toStatus}</span>
                          </div>
                          {a.note && <div className="muted audit-note">{a.note}</div>}
                          <div className="muted mt-4 font-11">
                            {new Date(a.createdAt).toLocaleString('en-IN')}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer-right text-right">
              <button 
                className="btn outline" 
                onClick={(e) => {
                  e.stopPropagation();
                  closeDetails();
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}