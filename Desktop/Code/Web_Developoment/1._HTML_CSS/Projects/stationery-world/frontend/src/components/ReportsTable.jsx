import { useMemo, useState } from "react";

export default function ReportsTable({ rows = [], query = "", pageSize = 8 }) {
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const inName = r.name.toLowerCase().includes(q);
      const inCat = r.category.toLowerCase().includes(q);
      const inCustomers = r.customers.join(" ").toLowerCase().includes(q);
      return inName || inCat || inCustomers;
    });
  }, [rows, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const display = filtered.slice((page - 1) * pageSize, page * pageSize);

  const goto = (p) => setPage(Math.min(Math.max(1, p), totalPages));

  return (
    <div className="reports-table-wrap">
      {filtered.length === 0 ? (
        <p>No sales data for selected range.</p>
      ) : (
        <>
          <table className="reports-table">
            <thead>
              <tr>
                <th>Product Name</th>
                <th>Category</th>
                <th>Quantity Sold</th>
                <th>Customer Names</th>
                <th>Total Orders</th>
              </tr>
            </thead>
            <tbody>
              {display.map((r) => (
                <tr key={r.sku}>
                  <td>{r.name}</td>
                  <td>{r.category}</td>
                  <td>{r.qtySold}</td>
                  <td>{r.customers.length <= 6 ? r.customers.join(", ") : `${r.customers.length} customers`}</td>
                  <td>{r.orders}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="table-pager">
            <button onClick={() => goto(page - 1)} disabled={page === 1}>Prev</button>
            <span>Page {page} / {totalPages}</span>
            <button onClick={() => goto(page + 1)} disabled={page === totalPages}>Next</button>
          </div>
        </>
      )}
    </div>
  );
}
