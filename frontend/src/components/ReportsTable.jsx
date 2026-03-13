import { useMemo, useState } from "react";

export default function ReportsTable({ rows = [], query = "", pageSize = 8 }) {
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const inName = (r.name || '').toLowerCase().includes(q);
      const inCat = (r.category || '').toLowerCase().includes(q);
      const inSku = (r.sku || '').toString().toLowerCase().includes(q);
      return inName || inCat || inSku;
    });
  }, [rows, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const display = filtered.slice((page - 1) * pageSize, page * pageSize);

  const goto = (p) => setPage(Math.min(Math.max(1, p), totalPages));

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  return (
    <div className="reports-table-wrap">
      {filtered.length === 0 ? (
        <p style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
          {query ? 'No products match your search.' : 'No sales data for selected range.'}
        </p>
      ) : (
        <>
          <table className="reports-table">
            <thead>
              <tr>
                <th>Product Name</th>
                <th>Category</th>
                <th>Qty Sold</th>
                <th>Revenue</th>
                <th>Orders</th>
              </tr>
            </thead>
            <tbody>
              {display.map((r, index) => (
                <tr key={r.sku || index}>
                  <td>{r.name || 'N/A'}</td>
                  <td>{r.category || 'N/A'}</td>
                  <td>{r.qtySold || 0}</td>
                  <td>{formatCurrency(r.revenue)}</td>
                  <td>{r.orders || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="table-pager">
            <button 
              onClick={() => goto(page - 1)} 
              disabled={page === 1}
              style={{
                padding: '8px 16px',
                background: page === 1 ? '#ccc' : '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: page === 1 ? 'not-allowed' : 'pointer'
              }}
            >
              Prev
            </button>
            <span style={{ margin: '0 16px' }}>
              Page {page} / {totalPages}
            </span>
            <button 
              onClick={() => goto(page + 1)} 
              disabled={page === totalPages}
              style={{
                padding: '8px 16px',
                background: page === totalPages ? '#ccc' : '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: page === totalPages ? 'not-allowed' : 'pointer'
              }}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}