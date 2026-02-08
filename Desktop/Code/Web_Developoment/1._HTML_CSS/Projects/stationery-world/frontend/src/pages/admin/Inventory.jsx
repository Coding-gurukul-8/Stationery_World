import { useEffect, useState, useMemo } from 'react';
import './Reports.css'; // reuse styles

const DEFAULT_CATEGORIES = ['STATIONERY', 'BOOKS', 'TOYS'];

export default function Inventory() {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('add'); // 'add' | 'restock' | 'idle'
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({
    name: '', description: '', category: DEFAULT_CATEGORIES[0], subCategory: '',
    costPrice: '', baseSellingPrice: '', bargainable: true, keywords: '', quantityAdded: 0, lowStockThreshold: 10
  });

  // File upload states (admin will upload files instead of providing URLs)
  const [selectedFiles, setSelectedFiles] = useState([]); // File objects to upload
  const [filePreviews, setFilePreviews] = useState([]); // { url, name }
  const [existingImages, setExistingImages] = useState([]); // images already saved on product (from DB)

  // Helper to handle file selection
  function handleFileChange(e) {
    const files = Array.from(e.target.files || []).slice(0, 6); // limit to 6
    setSelectedFiles(files);
    // revoke old previews
    filePreviews.forEach(p => URL.revokeObjectURL(p.url));
    setFilePreviews(files.map(f => ({ url: URL.createObjectURL(f), name: f.name })));
  }

  // Remove a selected file by index
  function removeSelectedFile(idx) {
    const next = selectedFiles.slice();
    const nextPreviews = filePreviews.slice();
    if (nextPreviews[idx]) URL.revokeObjectURL(nextPreviews[idx].url);
    next.splice(idx, 1);
    nextPreviews.splice(idx, 1);
    setSelectedFiles(next);
    setFilePreviews(nextPreviews);
  }

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      filePreviews.forEach(p => URL.revokeObjectURL(p.url));
    };
  }, [filePreviews]);

  // Debounced search
  useEffect(() => {
    if (!search) {
      // No search term -> show Add New Product form by default
      setResults([]);
      setMode('add');
      setSelected(null);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/products?search=${encodeURIComponent(search)}`);
        const data = await res.json();
        if (data?.success) {
          setResults(data.data || []);
          if ((data.data || []).length === 1) {
            setSelected(data.data[0]);
            setMode('restock');
            prefillForm(data.data[0]);
          } else if ((data.data || []).length === 0) {
            // No results -> prepare Add mode and prefill name
            setMode('add');
            setSelected(null);
            setForm(f => ({ ...f, name: search }));
          } else {
            // Multiple results -> show results and allow selection
            setMode('idle');
            setSelected(null);
          }
        } else {
          setResults([]);
          setMode('add');
          setSelected(null);
        }
      } catch (err) {
        console.error('Search error', err);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(t);
  }, [search]);

  function prefillForm(product) {
    setForm({
      name: product.name,
      description: product.description || '',
      category: product.category || DEFAULT_CATEGORIES[0],
      subCategory: product.subCategory || '',
      costPrice: product.costPrice || '',
      baseSellingPrice: product.baseSellingPrice || '',
      bargainable: !!product.bargainable,
      keywords: (product.keywords || []).join(', '),
      quantityAdded: 0,
      lowStockThreshold: product.lowStockThreshold || 10
    });

    // existing images from DB
    setExistingImages(product.images || []);
    // reset selected files
    setSelectedFiles([]);
    setFilePreviews([]);
  }

  async function uploadSelectedFiles() {
    if (!selectedFiles || selectedFiles.length === 0) return [];
    const fd = new FormData();
    selectedFiles.forEach(f => fd.append('images', f));
    const res = await fetch('/api/uploads', { method: 'POST', body: fd });
    const data = await res.json();
    if (data?.success && Array.isArray(data.urls)) return data.urls;
    throw new Error(data?.message || 'Upload failed');
  }

  async function handleCreate(e) {
    e.preventDefault();

    // Upload selected files first (if any)
    let uploadedUrls = [];
    if (selectedFiles.length > 0) {
      try {
        uploadedUrls = await uploadSelectedFiles();
      } catch (err) {
        return alert('Image upload failed: ' + err.message);
      }
    }

    const payload = {
      ...form,
      keywords: form.keywords.split(',').map(s => s.trim()).filter(Boolean),
      images: uploadedUrls // send uploaded URLs to backend
    };

    const res = await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, quantityAdded: Number(form.quantityAdded) }) });
    if (res.status === 401) return alert('Unauthorized. Please login as an admin to create products.');
    const data = await res.json();
    if (data?.success) {
      alert('Product created');
      setSearch(''); setResults([]); setMode('idle');
      // reset file selection
      setSelectedFiles([]); setFilePreviews([]);
    } else {
      alert('Error: ' + (data?.message || 'Create failed'));
    }
  }

  async function handleRestock(e) {
    e.preventDefault();
    if (!selected) return alert('No product selected to restock');

    // Upload selected files first (if any)
    let uploadedUrls = [];
    if (selectedFiles.length > 0) {
      try {
        uploadedUrls = await uploadSelectedFiles();
      } catch (err) {
        return alert('Image upload failed: ' + err.message);
      }
    }

    const payload = {
      quantityAdded: Number(form.quantityAdded),
      costPrice: form.costPrice ? Number(form.costPrice) : undefined,
      baseSellingPrice: form.baseSellingPrice ? Number(form.baseSellingPrice) : undefined,
      bargainable: !!form.bargainable,
      images: uploadedUrls,
      note: 'Restocked via admin UI'
    };

    const res = await fetch(`/api/products/${selected.id}/restock`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (res.status === 401) return alert('Unauthorized. Please login as an admin to restock products.');
    const data = await res.json();
    if (data?.success) {
      alert('Product restocked');
      setSearch(''); setResults([]); setMode('idle'); setSelected(null);
      // reset files
      setSelectedFiles([]); setFilePreviews([]);
    } else {
      alert('Error: ' + (data?.message || 'Restock failed'));
    }
  }

  const [tab, setTab] = useState('add'); // 'add' | 'view' | 'low'
  const [inventoryList, setInventoryList] = useState([]);
  const [lowList, setLowList] = useState([]);

  useEffect(() => {
    if (tab === 'view') {
      (async () => {
        try {
          const res = await fetch('/api/products');
          const data = await res.json();
          if (data?.success) setInventoryList(data.data || []);
        } catch (err) { console.error(err); }
      })();
    }

    if (tab === 'low') {
      (async () => {
        try {
          const res = await fetch('/api/products/admin/low-stock');
          const data = await res.json();
          if (data?.success) setLowList(data.data || []);
        } catch (err) { console.error(err); }
      })();
    }
  }, [tab]);

  return (
    <div className="card inventory-card">
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <h3>Inventory Management</h3>
        <div>
          <button className="btn outline" onClick={() => { setMode('add'); setTab('add'); setSelected(null); setSearch(''); }}>+ Add New Product</button>
        </div>
      </div>

      <div className="inventory-tabs" style={{ margin: '12px 0' }}>
        <button className={`tab ${tab === 'add' ? 'active' : ''}`} onClick={() => { setTab('add'); setMode('add'); }} aria-pressed={tab === 'add'}>
          <span className="tab-icon">➕</span>
          <span className="tab-label">Add / Restock</span>
        </button>

        <button className={`tab ${tab === 'view' ? 'active' : ''}`} onClick={() => setTab('view')} aria-pressed={tab === 'view'}>
          <span className="tab-icon">👁</span>
          <span className="tab-label">View Inventory</span>
        </button>

        <button className={`tab ${tab === 'low' ? 'active' : ''}`} onClick={() => setTab('low')} aria-pressed={tab === 'low'}>
          <span className="tab-icon">⚠️</span>
          <span className="tab-label">Low Stock</span>
        </button>
      </div>

      {tab === 'add' && (
        <>
          <div style={{ margin: '12px 0' }}>
            <input className="inventory-search" placeholder="Search product by name, uid, or keywords..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          <div className="inventory-grid">
            <div className="inventory-left">
              {loading && <div>Searching...</div>}

              {!loading && results.length > 0 && (
                <div className="search-results">
                  <h4>Search Results</h4>
                  <ul>
                    {results.map(r => (
                      <li key={r.id} className="search-row">
                        <div>
                          <strong>{r.name}</strong>
                          <div className="muted">UID: {r.uid} • Stock: {r.totalStock}</div>
                        </div>
                        <div>
                          <button className="btn outline" onClick={() => { setSelected(r); setMode('restock'); prefillForm(r); }}>Restock</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {!loading && mode === 'add' && (
                <div className="inventory-form">
                  <h4>Add New Product</h4>
                  <form onSubmit={handleCreate}>
                    <label>Product name</label>
                    <input required placeholder="Product name" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} />

                    <label>Description</label>
                    <textarea placeholder="Description" value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} />

                    <div className="row">
                      <div className="col">
                        <label>Category</label>
                        <select value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))}>
                          {DEFAULT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="col">
                        <label>Sub-category</label>
                        <input placeholder="Sub-category" value={form.subCategory} onChange={e => setForm(f => ({...f, subCategory: e.target.value}))} />
                      </div>
                    </div>

                    <div className="row">
                      <div className="col">
                        <label>Cost price</label>
                        <input placeholder="Cost price" type="number" value={form.costPrice} onChange={e => setForm(f => ({...f, costPrice: e.target.value}))} />
                      </div>
                      <div className="col">
                        <label>Selling price</label>
                        <input placeholder="Selling price" type="number" value={form.baseSellingPrice} onChange={e => setForm(f => ({...f, baseSellingPrice: e.target.value}))} />
                      </div>
                    </div>

                    <label>Keywords (comma separated)</label>
                    <input placeholder="notebook, classmate, a4" value={form.keywords} onChange={e => setForm(f => ({...f, keywords: e.target.value}))} />

                    <label>Images (upload files)</label>
                    <input type="file" accept="image/*" multiple onChange={handleFileChange} />

                    {/* File previews */}
                    {filePreviews.length > 0 && (
                      <div className="image-preview" style={{ marginTop: 8 }}>
                        {filePreviews.map((p, idx) => (
                          <div key={idx} style={{ position: 'relative' }}>
                            <img src={p.url} alt={p.name} />
                            <button type="button" className="btn outline" style={{ position: 'absolute', top: 4, right: 4, padding: '2px 6px' }} onClick={() => removeSelectedFile(idx)}>×</button>
                          </div>
                        ))}
                      </div>
                    )}

                    <label>Initial quantity</label>
                    <input placeholder="Initial quantity" type="number" value={form.quantityAdded} onChange={e => setForm(f => ({...f, quantityAdded: e.target.value}))} />

                    <div style={{ marginTop: 8 }}>
                      <button className="btn primary" type="submit">Create Product</button>
                    </div>
                  </form>

                  {/* Image preview */}
                  {form.images && form.images.split(',').map(url => url.trim()).filter(Boolean).length > 0 && (
                    <div className="image-preview">
                      {form.images.split(',').map((url, idx) => url.trim()).filter(Boolean).slice(0,6).map((url, idx) => (
                        <img key={idx} src={url} alt={`preview-${idx}`} onError={(e)=>e.target.style.display='none'} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="inventory-right">
              {mode === 'restock' && selected && (
                <div className="restock-box">
                  <h4>Restock: {selected.name}</h4>
                  <div className="muted">UID: {selected.uid}</div>
                  <div style={{ marginTop: 8 }}><strong>Current stock:</strong> {selected.totalStock}</div>
                  <form onSubmit={handleRestock}>
                    <label>Quantity to add</label>
                    <input placeholder="Quantity to add" type="number" value={form.quantityAdded} onChange={e => setForm(f => ({...f, quantityAdded: e.target.value}))} />

                    <label>New cost price (optional)</label>
                    <input placeholder="New cost price" type="number" value={form.costPrice} onChange={e => setForm(f => ({...f, costPrice: e.target.value}))} />

                    <label>New selling price (optional)</label>
                    <input placeholder="New selling price" type="number" value={form.baseSellingPrice} onChange={e => setForm(f => ({...f, baseSellingPrice: e.target.value}))} />

                    <label>Images to add (upload files)</label>
                    <input type="file" accept="image/*" multiple onChange={handleFileChange} />

                    {/* File previews (for restock) */}
                    {filePreviews.length > 0 && (
                      <div className="image-preview" style={{ marginTop: 8 }}>
                        {filePreviews.map((p, idx) => (
                          <div key={idx} style={{ position: 'relative' }}>
                            <img src={p.url} alt={p.name} />
                            <button type="button" className="btn outline" style={{ position: 'absolute', top: 4, right: 4, padding: '2px 6px' }} onClick={() => removeSelectedFile(idx)}>×</button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ marginTop: 8 }}>
                      <button className="btn primary" type="submit">Restock</button>
                    </div>
                  </form>

                  {/* Show product images */}
                  {selected.images && selected.images.length > 0 && (
                    <div className="image-preview">
                      {selected.images.slice(0,6).map((i, idx) => (
                        <img key={idx} src={i.url} alt={`img-${idx}`} onError={(e)=>e.target.style.display='none'} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {mode === 'idle' && (
                <div>
                  <h4>Quick Actions</h4>
                  <p>Search a product to restock or create a new one.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {tab === 'view' && (
        <div>
          <h4>Inventory List</h4>
          <table className="reports-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>UID</th>
                <th>Category</th>
                <th>Stock</th>
                <th>Selling</th>
              </tr>
            </thead>
            <tbody>
              {inventoryList.map(p => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.uid}</td>
                  <td>{p.category}/{p.subCategory}</td>
                  <td>{p.totalStock}</td>
                  <td>{p.baseSellingPrice}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'low' && (
        <div>
          <h4>Low Stock</h4>
          {lowList.length === 0 && <div>No low stock items</div>}
          <ul>
            {lowList.map(p => (
              <li key={p.id} style={{ padding: 6, borderBottom: '1px solid #f1f5f9' }}>
                <strong>{p.name}</strong> — Stock: {p.totalStock} (Threshold: {p.lowStockThreshold})
                <div style={{ marginTop: 6 }}><button className="btn outline" onClick={() => { setSelected(p); setTab('add'); prefillForm(p); }}>Restock</button></div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
