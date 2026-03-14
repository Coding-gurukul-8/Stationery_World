import { useEffect, useState, useMemo } from 'react';
import { authUtils } from '../../utils/auth';
import './Inventory.css';

const DEFAULT_CATEGORIES = ['STATIONERY', 'BOOKS', 'TOYS'];
const API = 'http://localhost:3000';

const getImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API}${url}`;
};

/* ── Low Stock Tab ──────────────────────────────── */
function LowStockTab({ lowList, setLowList, onRestock }) {
  const [loadingRefresh, setLoadingRefresh] = useState(false);
  const [notifyMap,      setNotifyMap]      = useState({});

  useEffect(() => {
    const fetchNotifyCounts = async () => {
      if (lowList.length === 0) return;
      try {
        const token = authUtils.getToken();
        const res   = await fetch(`${API}/api/reports/demand`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data?.success && Array.isArray(data.data)) {
          const map = {};
          data.data.forEach(item => {
            if (item.product?.id) map[item.product.id] = item.requestCount || 0;
          });
          setNotifyMap(map);
        }
      } catch (e) {
        console.error('Notify count fetch error', e);
      }
    };
    fetchNotifyCounts();
  }, [lowList]);

  const refresh = async () => {
    setLoadingRefresh(true);
    try {
      const token = authUtils.getToken();
      const res   = await fetch(`${API}/api/inventory/low-stock`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data?.success) {
        setLowList((data.data || []).map(item => ({
          ...item.product,
          totalStock:        item.quantity ?? item.product?.totalStock,
          lowStockThreshold: item.lowStockThreshold ?? item.product?.lowStockThreshold,
          isLowStock:        item.isLowStock ?? true,
          notifyMeCount:     item.notifyMeCount ?? 0,
        })));
      }
    } catch {} finally { setLoadingRefresh(false); }
  };

  if (lowList.length === 0) return (
    <div className="inventory-empty">
      <div className="empty-icon">✅</div>
      <h4 className="inventory-empty-title">All stocked up!</h4>
      <p className="inventory-empty-subtitle">No products below their low-stock threshold.</p>
      <button onClick={refresh} disabled={loadingRefresh} className="btn outline inventory-empty-btn">
        {loadingRefresh ? '⏳ Refreshing…' : '↻ Refresh'}
      </button>
    </div>
  );

  return (
    <div>
      <div className="lowstock-header">
        <div className="lowstock-header-left">
          <h4 className="lowstock-title">Low Stock Products</h4>
          <span className="lowstock-badge">
            {lowList.length} alert{lowList.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button onClick={refresh} disabled={loadingRefresh} className="btn outline">
          {loadingRefresh ? '⏳ Refreshing…' : '↻ Refresh'}
        </button>
      </div>

      <div className="low-stock-grid">
        {lowList.map(p => {
          const imgUrl      = getImageUrl(p.images?.[0]?.url);
          const stockPct    = p.lowStockThreshold > 0 ? Math.min(100, (p.totalStock / p.lowStockThreshold) * 100) : 0;
          const isOut       = p.totalStock === 0;
          const urgency     = isOut ? 'critical' : p.totalStock <= Math.floor(p.lowStockThreshold / 2) ? 'high' : 'medium';
          const uc          = urgency === 'critical' ? '#dc2626' : urgency === 'high' ? '#ea580c' : '#d97706';
          const ubg         = urgency === 'critical' ? '#fef2f2' : urgency === 'high' ? '#fff7ed' : '#fffbeb';
          const uborder     = urgency === 'critical' ? '#fecaca' : urgency === 'high' ? '#fed7aa' : '#fde68a';
          const uLabel      = isOut ? '🚨 OUT OF STOCK' : urgency === 'high' ? '⚠️ CRITICALLY LOW' : '⚡ LOW STOCK';
          const notifyCount = notifyMap[p.id] || p.notifyMeCount || 0;

          return (
            <div
            key={p.id}
            className={`low-stock-card ${urgency}`}
            style={{
              '--accent': uc,
              '--accent-bg': ubg,
              '--accent-border': uborder,
            }}
          >
            <div className="low-stock-card-header">
              <span className="low-stock-card-status">{uLabel}</span>
              <div className="low-stock-card-meta">
                {notifyCount > 0 && (
                  <span className="notify-badge" title={`${notifyCount} customer${notifyCount !== 1 ? 's' : ''} want to be notified`}>
                    🔔 {notifyCount} notify
                  </span>
                )}
                <span>{p.category}</span>
              </div>
            </div>

            <div className="low-stock-card-body">
              <div className="low-stock-card-thumb">
                {imgUrl
                  ? <img src={imgUrl} alt={p.name} onError={e => e.target.style.display = 'none'} />
                  : <span style={{ fontSize: 22 }}>📦</span>}
              </div>
              <div className="low-stock-card-info">
                <div className="low-stock-card-name">{p.name}</div>
                <div className="low-stock-card-uid">{p.uid}</div>
                <div className="low-stock-card-price">
                  ₹{parseFloat(p.baseSellingPrice || 0).toFixed(0)} · Sold: {p.totalSold || 0}
                </div>

                <div className="low-stock-progress">
                  <div className="low-stock-progress-bar" style={{ width: `${Math.max(2, stockPct)}%` }} />
                </div>

                <div className="low-stock-summary">
                  <div className="low-stock-summary-row">
                    <span className="low-stock-summary-label">Current Stock</span>
                    <span className="low-stock-summary-label">Threshold: {p.lowStockThreshold}</span>
                  </div>
                  <div className="low-stock-summary-row">
                    <span className="low-stock-summary-value">{p.totalStock}</span>
                    <span className="low-stock-summary-label">units left</span>
                  </div>
                </div>

                {notifyCount > 0 && (
                  <div className="notify-badge" style={{ marginTop: 10 }}>
                    🔔 <strong>{notifyCount}</strong> customer{notifyCount !== 1 ? 's' : ''} clicked "Notify Me"
                  </div>
                )}

                <button
                  onClick={() => onRestock(p)}
                  className="btn primary restock-btn"
                  style={{ '--accent': uc }}
                >
                  📦 Restock Now
                </button>
              </div>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── View Inventory Tab ─────────────────────────── */
function ViewTab({ inventoryList }) {
  const [viewSearch,    setViewSearch]    = useState('');
  const [sortKey,       setSortKey]       = useState('name');
  const [sortDir,       setSortDir]       = useState('asc');
  const [filterCat,     setFilterCat]     = useState('ALL');
  const [filterStatus,  setFilterStatus]  = useState('ALL');
  // NEW: sorting dropdown (6 preset options)
  const [sortPreset,    setSortPreset]    = useState('default');

  const categories = useMemo(() => {
    const cats = [...new Set(inventoryList.map(p => p.category).filter(Boolean))];
    return ['ALL', ...cats];
  }, [inventoryList]);

  const sorted = useMemo(() => {
    let list = [...inventoryList];

    /* search */
    if (viewSearch.trim()) {
      const q = viewSearch.toLowerCase();
      list = list.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.uid?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        p.subCategory?.toLowerCase().includes(q)
      );
    }
    /* category filter */
    if (filterCat !== 'ALL') list = list.filter(p => p.category === filterCat);
    /* status filter */
    if (filterStatus === 'ACTIVE')   list = list.filter(p => p.isActive);
    if (filterStatus === 'INACTIVE') list = list.filter(p => !p.isActive);
    if (filterStatus === 'LOW')      list = list.filter(p => p.totalStock <= (p.lowStockThreshold || 0));

    /* ── sort preset (takes priority over column sort) ── */
    if (sortPreset !== 'default') {
      switch (sortPreset) {
        case 'price-low-high':
          return list.sort((a, b) => parseFloat(a.baseSellingPrice || 0) - parseFloat(b.baseSellingPrice || 0));
        case 'price-high-low':
          return list.sort((a, b) => parseFloat(b.baseSellingPrice || 0) - parseFloat(a.baseSellingPrice || 0));
        case 'stock-low-high':
          return list.sort((a, b) => (a.totalStock || 0) - (b.totalStock || 0));
        case 'stock-high-low':
          return list.sort((a, b) => (b.totalStock || 0) - (a.totalStock || 0));
        case 'newest':
          return list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        case 'oldest':
          return list.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
        default:
          break;
      }
    }

    /* column sort */
    list.sort((a, b) => {
      let va = a[sortKey]; let vb = b[sortKey];
      if (['costPrice','baseSellingPrice','totalStock'].includes(sortKey)) {
        va = parseFloat(va || 0); vb = parseFloat(vb || 0);
        return sortDir === 'asc' ? va - vb : vb - va;
      }
      va = String(va || '').toLowerCase(); vb = String(vb || '').toLowerCase();
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });

    return list;
  }, [inventoryList, viewSearch, sortKey, sortDir, filterCat, filterStatus, sortPreset]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
    setSortPreset('default'); // reset preset when column clicked
  };
  const arrow = (key) => {
    if (sortKey !== key) return <span className="sort-arrow">↕</span>;
    return <span className="sort-arrow">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div>
      {/* Controls */}
      <div className="view-controls">
        <div className="view-controls-left">
          <input
            className="view-search"
            placeholder="🔍 Search name, UID, category…"
            value={viewSearch}
            onChange={e => setViewSearch(e.target.value)}
          />
          <select className="sort-select" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
            {categories.map(c => <option key={c} value={c}>{c === 'ALL' ? 'All Categories' : c}</option>)}
          </select>
          <select className="sort-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="LOW">Low Stock</option>
          </select>
          {/* NEW: sort preset dropdown */}
          <select
            className="sort-select sort-preset"
            value={sortPreset}
            onChange={e => { setSortPreset(e.target.value); }}
            title="Sort by"
          >
            <option value="default">Sort: Default</option>
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="price-low-high">Price: Low → High</option>
            <option value="price-high-low">Price: High → Low</option>
            <option value="stock-low-high">Stock: Low → High</option>
            <option value="stock-high-low">Stock: High → Low</option>
          </select>
        </div>
        <div className="inventory-count">
          {sorted.length} of {inventoryList.length} product{inventoryList.length !== 1 ? 's' : ''}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="inventory-empty">
          <div className="empty-icon">📭</div>
          <strong>No products found</strong>
          <p className="inventory-empty-subtitle">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="inv-table-wrapper">
          <table className="reports-table">
            <thead>
              <tr>
                <th onClick={() => toggleSort('name')} className={sortKey === 'name' ? 'sorted' : ''}>
                  Product {arrow('name')}
                </th>
                <th>UID</th>
                <th onClick={() => toggleSort('category')} className={sortKey === 'category' ? 'sorted' : ''}>
                  Category {arrow('category')}
                </th>
                <th onClick={() => toggleSort('totalStock')} className={sortKey === 'totalStock' ? 'sorted' : ''}>
                  Stock {arrow('totalStock')}
                </th>
                <th onClick={() => toggleSort('costPrice')} className={sortKey === 'costPrice' ? 'sorted' : ''}>
                  Cost (₹) {arrow('costPrice')}
                </th>
                <th onClick={() => toggleSort('baseSellingPrice')} className={sortKey === 'baseSellingPrice' ? 'sorted' : ''}>
                  Price (₹) {arrow('baseSellingPrice')}
                </th>
                <th>Margin</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(p => {
                const cp     = parseFloat(p.costPrice || 0);
                const sp     = parseFloat(p.baseSellingPrice || 0);
                const margin = sp > 0 ? (((sp - cp) / sp) * 100).toFixed(0) : 0;
                // Use backend isLowStock flag OR compute locally as fallback
                const isLow  = p.isLowStock ?? (p.totalStock <= (p.lowStockThreshold || 0));
                return (
                  <tr key={p.id} className={isLow ? 'low-stock-row' : ''}>
                    <td>
                      <div className="inv-product-name">
                        {p.name}
                        {isLow && <span className="low-stock-indicator">⚠️ Low</span>}
                      </div>
                      {p.subCategory && <div className="inv-product-cat">{p.subCategory}</div>}
                    </td>
                    <td>
                      <span className="mono">{p.uid}</span>
                    </td>
                    <td>{p.category}</td>
                    <td>
                      {
                        (() => {
                          const out = p.totalStock === 0;
                          const stockClass = out ? 'out' : isLow ? 'low' : 'ok';
                          return (
                            <span className={`inv-stock-pill ${stockClass}`}>
                              <span className="mono" style={{ fontWeight: 600 }}>{p.totalStock}</span>
                              {isLow && !out && <span style={{ marginLeft: 3, fontSize: 10 }}>⚠️</span>}
                            </span>
                          );
                        })()
                      }
                    </td>
                    <td>₹{cp.toFixed(0)}</td>
                    <td>₹{sp.toFixed(0)}</td>
                    <td>
                      <span className={margin >= 20 ? 'margin-pill high' : margin >= 10 ? 'margin-pill medium' : 'margin-pill low'}>
                        {margin}%
                      </span>
                    </td>
                    <td>
                      <span className={`status-pill ${p.isActive ? 'active' : 'inactive'}`}>
                        {p.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   Main Inventory Component
   ════════════════════════════════════════════ */
export default function Inventory() {
  const [search,         setSearch]         = useState('');
  const [results,        setResults]        = useState([]);
  const [loading,        setLoading]        = useState(false);
  const [mode,           setMode]           = useState('add');
  const [selected,       setSelected]       = useState(null);
  const [form,           setForm]           = useState({
    name: '', description: '', category: DEFAULT_CATEGORIES[0], subCategory: '',
    costPrice: '', baseSellingPrice: '', bargainable: true, keywords: '',
    // bargain config fields
    bargainMaxAttempts: 1,
    bargainTiers: [{ price: '' }, { price: '' }, { price: '' }],
    // bulk discounts array
    bulkDiscounts: [{ minQty: '', discount: '', unit: 'RUPEES' }],
    quantityAdded: 0, lowStockThreshold: 10
  });
  const [selectedFiles,  setSelectedFiles]  = useState([]);
  const [filePreviews,   setFilePreviews]   = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [tab,            setTab]            = useState('add');
  const [inventoryList,  setInventoryList]  = useState([]);
  const [lowList,        setLowList]        = useState([]);

  /* ── file handling ── */
  function handleFileChange(e) {
    const files = Array.from(e.target.files || []).slice(0, 6);
    setSelectedFiles(files);
    filePreviews.forEach(p => URL.revokeObjectURL(p.url));
    setFilePreviews(files.map(f => ({ url: URL.createObjectURL(f), name: f.name })));
  }
  function removeSelectedFile(idx) {
    const nf = selectedFiles.slice(); const np = filePreviews.slice();
    if (np[idx]) URL.revokeObjectURL(np[idx].url);
    nf.splice(idx, 1); np.splice(idx, 1);
    setSelectedFiles(nf); setFilePreviews(np);
  }
  useEffect(() => { return () => filePreviews.forEach(p => URL.revokeObjectURL(p.url)); }, [filePreviews]);

  /* ── debounced search ── */
  useEffect(() => {
    if (!search) { setResults([]); setMode('add'); setSelected(null); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const token = authUtils.getToken();
        const res   = await fetch(`${API}/api/products?search=${encodeURIComponent(search)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data  = await res.json();
        if (data?.success) {
          const list = data.data || [];
          setResults(list);
          if (list.length === 1) {
            setSelected(list[0]);
            prefillForm(list[0]);
            setMode('edit'); // show full form so admin can update details (restock panel still available on right)
          } else if (list.length === 0) {
            setMode('add');
            setSelected(null);
            setForm(f => ({ ...f, name: search }));
          } else {
            setMode('idle');
            setSelected(null);
          }
        }
      } catch (err) { console.error('Search error', err); }
      finally { setLoading(false); }
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  async function prefillForm(product) {
    // fetch full details (bargainConfig, bulkDiscounts) if not already present
    let full = product;
    if (!product.bargainConfig || !product.bulkDiscounts) {
      try {
        const res = await fetch(`${API}/api/products/${product.id}`);
        const data = await res.json();
        if (data.success) full = data.data;
      } catch (e) {
        console.error('Failed to fetch full product details', e);
      }
    }

    setForm({
      name: full.name, description: full.description || '',
      category: full.category || DEFAULT_CATEGORIES[0],
      subCategory: full.subCategory || '',
      costPrice: full.costPrice || '', baseSellingPrice: full.baseSellingPrice || '',
      bargainable: !!full.bargainable,
      keywords: (full.keywords || []).join(', '),
      bargainMaxAttempts: full.bargainConfig?.maxAttempts || 1,
      bargainTiers: [
        { price: full.bargainConfig?.tier1Price || '' },
        { price: full.bargainConfig?.tier2Price || '' },
        { price: full.bargainConfig?.tier3Price || '' }
      ],
      bulkDiscounts: (full.bulkDiscounts || []).map(d => ({ minQty: d.minQty, discount: d.discount, unit: d.unit })) || [{ minQty: '', discount: '', unit: 'RUPEES' }],
      quantityAdded: 0, lowStockThreshold: full.lowStockThreshold || 10
    });
    setExistingImages(full.images || []);
    setSelectedFiles([]); setFilePreviews([]);
  }

  async function uploadSelectedFiles() {
    if (!selectedFiles.length) return [];
    const fd = new FormData();
    selectedFiles.forEach(f => fd.append('images', f));
    const token = authUtils.getToken();
    const res   = await fetch(`${API}/api/products/upload-images`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd
    });
    const data = await res.json();
    if (data?.success && Array.isArray(data.urls)) return data.urls;
    throw new Error(data?.message || 'Image upload failed');
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.name)                               return alert('Product name is required');
    if (!form.costPrice || !form.baseSellingPrice) return alert('Cost and selling price required');
    setLoading(true);
    try {
      let imageUrls = [];
      if (selectedFiles.length) imageUrls = await uploadSelectedFiles();
      const payload = {
        name: form.name, description: form.description, category: form.category,
        subCategory: form.subCategory, costPrice: parseFloat(form.costPrice),
        baseSellingPrice: parseFloat(form.baseSellingPrice), bargainable: form.bargainable,
        keywords: form.keywords.split(',').map(s => s.trim()).filter(Boolean),
        totalStock: parseInt(form.quantityAdded) || 0,
        lowStockThreshold: parseInt(form.lowStockThreshold) || 10,
        images: imageUrls,
        bargainConfig: form.bargainable ? {
          maxAttempts: form.bargainMaxAttempts,
          tier1Price: parseFloat(form.bargainTiers[0]?.price) || 0,
          tier2Price: parseFloat(form.bargainTiers[1]?.price) || 0,
          tier3Price: parseFloat(form.bargainTiers[2]?.price) || 0
        } : undefined,
        bulkDiscounts: form.bulkDiscounts.map(d => ({ minQty: d.minQty, discount: d.discount, unit: d.unit }))
      };
      const token = authUtils.getToken();
      const res   = await fetch(`${API}/api/products`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data?.success) {
        alert('✅ Product created successfully!');
        setSearch(''); setResults([]); setMode('idle'); setSelectedFiles([]); setFilePreviews([]);
        setForm({ name:'', description:'', category: DEFAULT_CATEGORIES[0], subCategory:'', costPrice:'', baseSellingPrice:'', bargainable: true, keywords:'', bargainMaxAttempts:1, bargainTiers:[{price:''},{price:''},{price:''}], bulkDiscounts:[{minQty:'',discount:'',unit:'RUPEES'}], quantityAdded: 0, lowStockThreshold: 10 });
      } else {
        alert('❌ ' + (data?.message || 'Create failed'));
      }
    } catch (err) { alert('❌ ' + err.message); }
    finally { setLoading(false); }
  }

  async function handleUpdate(e) {
    e.preventDefault();
    if (!selected) return alert('No product selected');
    if (!form.name)                               return alert('Product name is required');
    if (!form.costPrice || !form.baseSellingPrice) return alert('Cost and selling price required');
    setLoading(true);
    try {
      let imageUrls = [];
      if (selectedFiles.length) imageUrls = await uploadSelectedFiles();
      const payload = {
        name: form.name, description: form.description, category: form.category,
        subCategory: form.subCategory, costPrice: parseFloat(form.costPrice),
        baseSellingPrice: parseFloat(form.baseSellingPrice), bargainable: form.bargainable,
        keywords: form.keywords.split(',').map(s => s.trim()).filter(Boolean),
        lowStockThreshold: parseInt(form.lowStockThreshold) || 10,
        images: imageUrls,
        bargainConfig: form.bargainable ? {
          maxAttempts: form.bargainMaxAttempts,
          tier1Price: parseFloat(form.bargainTiers[0]?.price) || 0,
          tier2Price: parseFloat(form.bargainTiers[1]?.price) || 0,
          tier3Price: parseFloat(form.bargainTiers[2]?.price) || 0
        } : undefined,
        bulkDiscounts: form.bulkDiscounts.map(d => ({ minQty: d.minQty, discount: d.discount, unit: d.unit }))
      };
      const token = authUtils.getToken();
      const res   = await fetch(`${API}/api/products/${selected.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data?.success) {
        alert('✅ Product updated successfully!');
        setSearch(''); setResults([]); setMode('idle'); setSelected(null);
        setForm({ name:'', description:'', category: DEFAULT_CATEGORIES[0], subCategory:'', costPrice:'', baseSellingPrice:'', bargainable: true, keywords:'', bargainMaxAttempts:1, bargainTiers:[{price:''},{price:''},{price:''}], bulkDiscounts:[{minQty:'',discount:'',unit:'RUPEES'}], quantityAdded: 0, lowStockThreshold: 10 });
      } else {
        alert('❌ ' + (data?.message || 'Update failed'));
      }
    } catch (err) { alert('❌ ' + err.message); }
    finally { setLoading(false); }
  }

  async function handleRestock(e) {
    e.preventDefault();
    if (!selected) return alert('No product selected');
    if (!form.quantityAdded || parseInt(form.quantityAdded) <= 0) return alert('Enter quantity to add');
    setLoading(true);
    try {
      let imageUrls = [];
      if (selectedFiles.length) imageUrls = await uploadSelectedFiles();
      const payload = {
        quantityAdded: parseInt(form.quantityAdded),
        costPrice: form.costPrice ? parseFloat(form.costPrice) : undefined,
        baseSellingPrice: form.baseSellingPrice ? parseFloat(form.baseSellingPrice) : undefined,
        bargainable: form.bargainable,
        images: imageUrls.length ? imageUrls : undefined,
        note: 'Restocked via admin inventory UI'
      };
      const token = authUtils.getToken();
      const res   = await fetch(`${API}/api/inventory/${selected.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data?.success) {
        alert(`✅ Restocked! New stock: ${data.data?.newStock ?? '—'}`);
        setSearch(''); setResults([]); setMode('idle'); setSelected(null);
        setSelectedFiles([]); setFilePreviews([]);
      } else {
        alert('❌ ' + (data?.message || 'Restock failed'));
      }
    } catch (err) { alert('❌ ' + err.message); }
    finally { setLoading(false); }
  }

  /* ── fetch on tab change ── */
  useEffect(() => {
    if (tab === 'view') {
      (async () => {
        try {
          const token = authUtils.getToken();
          const res   = await fetch(`${API}/api/products`, { headers: { Authorization: `Bearer ${token}` } });
          const data  = await res.json();
          if (data?.success) setInventoryList(data.data || []);
        } catch (err) { console.error(err); }
      })();
    }
    if (tab === 'low') {
      (async () => {
        try {
          const token = authUtils.getToken();
          const res   = await fetch(`${API}/api/inventory/low-stock`, { headers: { Authorization: `Bearer ${token}` } });
          const data  = await res.json();
          if (data?.success) {
            setLowList((data.data || []).map(item => ({
              ...item.product,
              totalStock:        item.quantity ?? item.product?.totalStock,
              lowStockThreshold: item.lowStockThreshold ?? item.product?.lowStockThreshold,
              isLowStock:        item.isLowStock ?? true,
              notifyMeCount:     item.notifyMeCount ?? 0,
            })));
          }
        } catch (err) { console.error(err); }
      })();
    }
  }, [tab]);

  /* ═══════════ RENDER ═══════════ */
  return (
    <div className="inventory-card">

      <div className="inventory-header">
        <h3>🏪 Inventory Management</h3>
        <button
          className="btn outline"
          onClick={() => { setMode('add'); setTab('add'); setSelected(null); setSearch(''); }}
        >
          + Add New Product
        </button>
      </div>

      <div className="inventory-tabs">
        <button className={`tab ${tab === 'add' ? 'active' : ''}`} onClick={() => { setTab('add'); setMode('add'); }}>
          <span className="tab-icon">➕</span>
          <span className="tab-label">Add / Restock</span>
        </button>
        <button className={`tab ${tab === 'view' ? 'active' : ''}`} onClick={() => setTab('view')}>
          <span className="tab-icon">👁</span>
          <span className="tab-label">View Inventory</span>
        </button>
        <button className={`tab ${tab === 'low' ? 'active' : ''}`} onClick={() => setTab('low')}>
          <span className="tab-icon">⚠️</span>
          <span className="tab-label">Low Stock</span>
          {lowList.length > 0 && (
            <span className="inventory-tab-badge">{lowList.length}</span>
          )}
        </button>
      </div>

      {/* ── ADD / RESTOCK TAB ── */}
      {tab === 'add' && (
        <>
          <div style={{ marginBottom: 16 }}>
            <input
              className="inventory-search"
              placeholder="🔍 Search product by name, UID, or keywords…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="inventory-grid">
            <div className="inventory-left">
              {loading && <div className="inv-loading"><div className="inv-spinner" /><span>Searching…</span></div>}

              {!loading && results.length > 0 && (
                <div className="search-results">
                  <h4>Search Results ({results.length})</h4>
                  <ul>
                    {results.map(r => (
                      <li key={r.id} className="search-row">
                    <div className="search-row-info">
                      <strong>{r.name}</strong>
                      <div className="muted">UID: {r.uid} · Stock: {r.totalStock} · {r.category}</div>
                    </div>
                    <div className="search-row-actions">
                      <button className="btn outline" onClick={() => { setSelected(r); setMode('edit'); prefillForm(r); }}>
                        Edit
                      </button>
                      <button className="btn outline" onClick={() => { setSelected(r); setMode('restock'); prefillForm(r); }}>
                        Restock
                      </button>
                    </div>
                  </li>
                    ))}
                  </ul>
                </div>
              )}

              {!loading && (mode === 'add' || mode === 'edit') && (
                <div className="inventory-form">
                  <h4>{mode === 'add' ? '➕ Add New Product' : '✏️ Edit Product'}</h4>
                  <form onSubmit={mode === 'add' ? handleCreate : handleUpdate}>
                    <label>Product Name *</label>
                    <input required placeholder="Product name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />

                    <label>Description</label>
                    <textarea placeholder="Product description" value={form.description} rows={3}
                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />

                    <div className="row">
                      <div className="col">
                        <label>Category *</label>
                        <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                          {DEFAULT_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="col">
                        <label>Sub-Category</label>
                        <input placeholder="e.g., Notebooks, Pens" value={form.subCategory}
                          onChange={e => setForm(f => ({ ...f, subCategory: e.target.value }))} />
                      </div>
                    </div>

                    <div className="row">
                      <div className="col">
                        <label>Cost Price (₹) *</label>
                        <input required type="number" step="0.01" placeholder="0.00"
                          value={form.costPrice} onChange={e => setForm(f => ({ ...f, costPrice: e.target.value }))} />
                      </div>
                      <div className="col">
                        <label>Selling Price (₹) *</label>
                        <input required type="number" step="0.01" placeholder="0.00"
                          value={form.baseSellingPrice} onChange={e => setForm(f => ({ ...f, baseSellingPrice: e.target.value }))} />
                      </div>
                    </div>

                    {form.costPrice && form.baseSellingPrice && (
                      <div style={{ fontSize: 12, color: '#16a34a', marginTop: 4, fontWeight: 600 }}>
                        Margin: ₹{(form.baseSellingPrice - form.costPrice).toFixed(0)} ({form.baseSellingPrice > 0 ? (((form.baseSellingPrice - form.costPrice) / form.baseSellingPrice) * 100).toFixed(1) : 0}%)
                      </div>
                    )}

                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, textTransform: 'none', letterSpacing: 0 }}>
                      <input type="checkbox" checked={form.bargainable} onChange={e => setForm(f => ({ ...f, bargainable: e.target.checked }))} style={{ width: 'auto' }} />
                      Allow bargaining
                    </label>

                    {form.bargainable && (
                      <div style={{ padding: '10px 14px', border: '1px dashed #ccc', borderRadius: 8, marginTop: 12 }}>
                        <h5 style={{ margin: 0, fontSize: 14 }}>Bargain Configuration</h5>
                        <div className="row" style={{ marginTop: 6 }}>
                          <div className="col">
                            <label>Max Attempts</label>
                            <select value={form.bargainMaxAttempts} onChange={e => {
                              const val = parseInt(e.target.value);
                              setForm(f => ({
                                ...f,
                                bargainMaxAttempts: val,
                                bargainTiers: f.bargainTiers.slice(0, val).concat(Array(Math.max(0,val - f.bargainTiers.length)).fill({ price: '' }))
                              }));
                            }}>
                              <option value={1}>1</option>
                              <option value={2}>2</option>
                              <option value={3}>3</option>
                            </select>
                          </div>
                        </div>
                        {Array.from({ length: form.bargainMaxAttempts }).map((_, idx) => (
                          <div className="row" key={idx} style={{ marginTop: 6 }}>
                            <div className="col">
                              <label>Tier {idx+1} Price (₹)</label>
                              <input type="number" step="0.01" placeholder="0.00"
                                value={form.bargainTiers[idx]?.price || ''}
                                onChange={e => {
                                  const v = e.target.value;
                                  setForm(f => {
                                    const tiers = [...f.bargainTiers];
                                    tiers[idx] = { price: v };
                                    return { ...f, bargainTiers: tiers };
                                  });
                                }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <label>Keywords (comma separated)</label>
                    <input placeholder="notebook, classmate, a4" value={form.keywords}
                      onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))} />

                    <label>Bulk Discounts</label>
                    {form.bulkDiscounts.map((row, idx) => (
                      <div key={idx} className="bulk-row" style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                        <input type="number" placeholder="Min qty" value={row.minQty}
                          style={{ width: '80px' }}
                          onChange={e => {
                            const val = e.target.value;
                            setForm(f => {
                              const b = [...f.bulkDiscounts];
                              b[idx].minQty = val;
                              return { ...f, bulkDiscounts: b };
                            });
                          }} />
                        <input type="number" placeholder="Discount" value={row.discount}
                          style={{ width: '80px' }}
                          onChange={e => {
                            const val = e.target.value;
                            setForm(f => {
                              const b = [...f.bulkDiscounts];
                              b[idx].discount = val;
                              return { ...f, bulkDiscounts: b };
                            });
                          }} />
                        <select value={row.unit} onChange={e => {
                          const val = e.target.value;
                          setForm(f => {
                            const b = [...f.bulkDiscounts];
                            b[idx].unit = val;
                            return { ...f, bulkDiscounts: b };
                          });
                        }}>
                          <option value="RUPEES">₹</option>
                          <option value="PERCENT">%</option>
                        </select>
                        <button type="button" className="btn outline" onClick={() => {
                          setForm(f => ({ ...f, bulkDiscounts: f.bulkDiscounts.filter((_,i)=>i!==idx) }));
                        }}>×</button>
                      </div>
                    ))}
                    <button type="button" className="btn outline" onClick={() => {
                      setForm(f => ({ ...f, bulkDiscounts: [...f.bulkDiscounts, { minQty:'', discount:'', unit:'RUPEES' }] }));
                    }}>+ Add rule</button>

                    <label>Product Images (max 6)</label>
                    <input type="file" accept="image/*" multiple onChange={handleFileChange} style={{ border: 'none', padding: '6px 0', background: 'transparent' }} />
                    {filePreviews.length > 0 && (
                      <div className="image-preview">
                        {filePreviews.map((p, idx) => (
                          <div key={idx} className="image-wrapper">
                            <img src={p.url} alt={p.name} />
                            <button type="button" className="image-remove-btn" onClick={() => removeSelectedFile(idx)}>×</button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="row">
                      <div className="col">
                        <label>Initial Quantity *</label>
                        <input required type="number" placeholder="0" value={form.quantityAdded}
                          onChange={e => setForm(f => ({ ...f, quantityAdded: e.target.value }))} />
                      </div>
                      <div className="col">
                        <label>Low Stock Threshold</label>
                        <input type="number" placeholder="10" value={form.lowStockThreshold}
                          onChange={e => setForm(f => ({ ...f, lowStockThreshold: e.target.value }))} />
                      </div>
                    </div>

                    <button className="btn primary" type="submit" disabled={loading} style={{ marginTop: 20, width: '100%', justifyContent: 'center' }}>
                      {loading ? (mode === 'add' ? '⏳ Creating…' : '⏳ Updating…') : (mode === 'add' ? '✅ Create Product' : '✅ Update Product')}
                    </button>
                  </form>
                </div>
              )}
            </div>

            <div className="inventory-right">
              {mode === 'restock' && selected ? (
                <div className="restock-box">
                  <h4>📦 Restock</h4>
                  <div className="restock-product-title">{selected.name}</div>
                  <div className="restock-meta muted">UID: {selected.uid}</div>
                  <div className="restock-info">
                    <strong>Current stock:</strong>{' '}
                    <span className={selected.totalStock <= (selected.lowStockThreshold || 0) ? 'restock-stock low' : 'restock-stock ok'}>
                      {selected.totalStock}
                    </span>
                  </div>

                  {existingImages.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Existing Images</div>
                      <div className="image-preview">
                        {existingImages.slice(0, 4).map((img, idx) => (
                          <img key={idx} src={getImageUrl(img.url)} alt={`img-${idx}`}
                            onError={e => e.target.style.display = 'none'} />
                        ))}
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleRestock} style={{ marginTop: 16 }}>
                    <label>Quantity to Add *</label>
                    <input required type="number" placeholder="e.g. 50" value={form.quantityAdded}
                      onChange={e => setForm(f => ({ ...f, quantityAdded: e.target.value }))} />

                    <label>New Cost Price (₹) <span style={{ fontWeight: 400, fontStyle: 'italic' }}>optional</span></label>
                    <input type="number" step="0.01" placeholder="Leave blank to keep current"
                      value={form.costPrice} onChange={e => setForm(f => ({ ...f, costPrice: e.target.value }))} />

                    <label>New Selling Price (₹) <span style={{ fontWeight: 400, fontStyle: 'italic' }}>optional</span></label>
                    <input type="number" step="0.01" placeholder="Leave blank to keep current"
                      value={form.baseSellingPrice} onChange={e => setForm(f => ({ ...f, baseSellingPrice: e.target.value }))} />

                    <label>Add Images <span style={{ fontWeight: 400, fontStyle: 'italic' }}>optional</span></label>
                    <input type="file" accept="image/*" multiple onChange={handleFileChange} style={{ border: 'none', padding: '6px 0', background: 'transparent' }} />
                    {filePreviews.length > 0 && (
                      <div className="image-preview">
                        {filePreviews.map((p, idx) => (
                          <div key={idx} className="image-wrapper">
                            <img src={p.url} alt={p.name} />
                            <button type="button" className="image-remove-btn" onClick={() => removeSelectedFile(idx)}>×</button>
                          </div>
                        ))}
                      </div>
                    )}

                    <button className="btn primary" type="submit" disabled={loading} style={{ marginTop: 20, width: '100%', justifyContent: 'center' }}>
                      {loading ? '⏳ Restocking…' : '📦 Restock Product'}
                    </button>
                  </form>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
                  <strong style={{ color: '#475569' }}>Search to restock</strong>
                  <p style={{ margin: '8px 0 0', fontSize: 13 }}>Search for an existing product above to restock it, or fill the form to add a new product.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {tab === 'view' && <ViewTab inventoryList={inventoryList} />}

      {tab === 'low' && (
        <LowStockTab
          lowList={lowList}
          setLowList={setLowList}
          onRestock={(p) => { setSelected(p); setTab('add'); setMode('restock'); prefillForm(p); }}
        />
      )}
    </div>
  );
}