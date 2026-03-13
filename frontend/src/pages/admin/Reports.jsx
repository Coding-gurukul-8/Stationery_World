import { useEffect, useMemo, useState, useCallback } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Legend, CartesianGrid,
  LineChart, Line
} from "recharts";
import { authUtils } from "../../utils/auth";
import "./Reports.css";
import { downloadCSV, downloadPDF } from "../../utils/reportExport";

const API = "http://localhost:3000";

const PIE_COLORS    = ["#2563eb","#16a34a","#d97706","#dc2626","#7c3aed","#0891b2","#db2777","#65a30d"];
const STATUS_COLORS = {
  DELIVERED:  "#16a34a",
  PENDING:    "#d97706",
  CONFIRMED:  "#7c3aed",
  SHIPPED:    "#0891b2",
  PROCESSING: "#2563eb",
  CANCELLED:  "#dc2626",
  RETURNED:   "#f43f5e",
};

const fmt    = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);
const fmtNum = (n) => new Intl.NumberFormat("en-IN").format(n || 0);

/* ─── Spinner ─── */
function Spinner() {
  return (
    <div className="reports-loading">
      <div className="reports-loading-spinner" />
      <span style={{ fontSize: 14 }}>Fetching your reports…</span>
    </div>
  );
}

/* ─── Empty chart ─── */
function ChartEmpty({ icon = "📊", msg = "No data for this period" }) {
  return (
    <div className="chart-empty">
      <div>{icon}</div>
      <strong>{msg}</strong>
      <span>Orders will appear here as they are placed and delivered</span>
    </div>
  );
}

/* ─── Summary section ─── */
function SummarySection({ summary }) {
  if (!summary) return null;
  const margin = summary.revenue > 0 ? ((summary.profit / summary.revenue) * 100).toFixed(1) : 0;
  return (
    <div className="card summary-cards">
      <h3>📋 Summary</h3>
      <div className="summary-grid">
        <div className="sum-card rev">
          <div className="label">Revenue</div>
          <div className="value">{fmt(summary.revenue)}</div>
        </div>
        <div className="sum-card cp">
          <div className="label">Total Cost</div>
          <div className="value">{fmt(summary.cp)}</div>
        </div>
        <div className="sum-card profit">
          <div className="label">Profit</div>
          <div className="value">{fmt(summary.profit)}</div>
        </div>
        <div className="sum-card pct">
          <div className="label">Margin</div>
          <div className="value">{margin}%</div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════ Main Component ═══════════════ */
export default function Reports() {
  const [rangeType,  setRangeType]  = useState("month");
  // start/end for selected period; day/month/year will keep them equal or computed
  const [rangeStart, setRangeStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [rangeEnd,   setRangeEnd]   = useState(rangeStart);
  const [tableQuery, setTableQuery] = useState("");
  const [loading,    setLoading]    = useState(true);
  const [weeklyLoading, setWeeklyLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(true);
  const [error,      setError]      = useState(null);

  /* ── data state ── */
  const [summary,      setSummary]      = useState(null);
  const [categoryData, setCategoryData] = useState([]);
  const [salesByDate,  setSalesByDate]  = useState([]);   // NEW: direct date field
  const [products,     setProducts]     = useState([]);
  const [demandData,   setDemandData]   = useState([]);
  const [weeklyData,   setWeeklyData]   = useState([]);   // NEW: weekly stats
  const [weeklyOrders, setWeeklyOrders] = useState([]);   // NEW: weekly orders
  const [statusData,   setStatusData]   = useState([]);   // NEW: order status distribution

  /* ── period label ── */
  const periodLabel = {
    day: "Daily", week: "Weekly", month: "Monthly", year: "Yearly"
  }[rangeType] || "Monthly";

  // derive actual start/end string used for current selection
  const { startDate, endDate } = (() => {
    let s = rangeStart;
    let e = rangeEnd;
    if (rangeType === 'day') {
      s = e = rangeStart;
    } else if (rangeType === 'week') {
      // already stored correctly
    } else if (rangeType === 'month') {
      const [y,m] = rangeStart.split('-');
      s = `${y}-${m}-01`;
      const last = new Date(y, parseInt(m), 0).getDate();
      e = `${y}-${m}-${last}`;
    } else if (rangeType === 'year') {
      const y = rangeStart.slice(0,4);
      s = `${y}-01-01`;
      e = `${y}-12-31`;
    }
    return { startDate: s, endDate: e };
  })();

  // whenever the range type changes we'll initialize start/end appropriately
  useEffect(() => {
    const today = new Date().toISOString().slice(0,10);
    if (rangeType === 'day') {
      setRangeStart(today);
      setRangeEnd(today);
    } else if (rangeType === 'week') {
      const end = today;
      const d = new Date(today);
      d.setDate(d.getDate() - 6);
      setRangeStart(d.toISOString().slice(0,10));
      setRangeEnd(end);
    } else if (rangeType === 'month') {
      const y = today.slice(0,4);
      const m = today.slice(5,7);
      setRangeStart(`${y}-${m}-01`);
      setRangeEnd(today);
    } else if (rangeType === 'year') {
      const y = today.slice(0,4);
      setRangeStart(`${y}-01-01`);
      setRangeEnd(`${y}-12-31`);
    }
  }, [rangeType]);

  /* ── fetch weekly stats ── */
  const fetchWeeklyStats = useCallback(async () => {
    setWeeklyLoading(true);
    const token = authUtils.getToken();

    // compute the same range used for the main report
    const periodMap = { day: "daily", week: "weekly", month: "monthly", year: "yearly" };
    const period = periodMap[rangeType] || "monthly";
    const computeRange = () => {
      let start = rangeStart;
      let end = rangeEnd;
      if (rangeType === 'day') {
        start = end = rangeStart;
      } else if (rangeType === 'month') {
        const [y,m] = rangeStart.split('-');
        start = `${y}-${m}-01`;
        const last = new Date(y, parseInt(m), 0).getDate();
        end = `${y}-${m}-${last}`;
      } else if (rangeType === 'year') {
        const y = rangeStart.slice(0,4);
        start = `${y}-01-01`;
        end   = `${y}-12-31`;
      }
      return { startDate: start, endDate: end };
    };
    const { startDate, endDate } = computeRange();

    try {
      const qs = new URLSearchParams();
      qs.set('filter', period);
      if (startDate) qs.set('startDate', startDate);
      if (endDate)   qs.set('endDate', endDate);

      const res = await fetch(`${API}/api/reports/weekly-stats?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        if (d?.success) {
          setWeeklyData(d.data?.weeklyRevenue || []);
          setWeeklyOrders(d.data?.weeklyOrders || d.data?.weeklyRevenue || []);
        }
      }
    } catch (e) {
      console.error("Weekly stats error:", e);
    } finally {
      setWeeklyLoading(false);
    }
  }, [rangeType, rangeStart, rangeEnd]);

  /* ── fetch order status distribution ── */
  const fetchStatusDist = useCallback(async () => {
    setStatusLoading(true);
    const token = authUtils.getToken();
    try {
      const res = await fetch(`${API}/api/reports/order-status-distribution`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const d = await res.json();
        if (d?.success && Array.isArray(d.data)) {
          setStatusData(d.data);
        }
      }
    } catch (e) {
      console.error("Status dist error:", e);
    } finally {
      setStatusLoading(false);
    }
  }, []);

  /* ── fetch main report data ── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const token = authUtils.getToken();
    const h = { Authorization: `Bearer ${token}` };

        const periodMap = { day: "daily", week: "weekly", month: "monthly", year: "yearly" };
    const period    = periodMap[rangeType] || "monthly";

    // ensure start/end reflect type constraints
    const computeRange = () => {
      let start = rangeStart;
      let end   = rangeEnd;
      if (rangeType === 'day') {
        start = end = rangeStart;
      } else if (rangeType === 'month') {
        const [y,m] = rangeStart.split('-');
        start = `${y}-${m}-01`;
        const last = new Date(y, parseInt(m), 0).getDate();
        end = `${y}-${m}-${last}`;
      } else if (rangeType === 'year') {
        const y = rangeStart.slice(0,4);
        start = `${y}-01-01`;
        end   = `${y}-12-31`;
      }
      return { startDate: start, endDate: end };
    };

    const { startDate, endDate } = computeRange();

    try {
      // build query string including filter for sales and period for revenue
      const qs = new URLSearchParams();
      qs.set('filter', period);           // sales endpoint expects "filter"
      qs.set('period', period);           // revenue endpoint uses "period"
      if (startDate) qs.set('startDate', startDate);
      if (endDate)   qs.set('endDate', endDate);

      const [salesRes, revenueRes, catRes, topRes, demandRes] = await Promise.all([
        fetch(`${API}/api/reports/sales?${qs.toString()}`,    { headers: h }),
        fetch(`${API}/api/reports/revenue?${qs.toString()}`,  { headers: h }),
        fetch(`${API}/api/reports/category-performance?${qs.toString()}`,      { headers: h }),
        fetch(`${API}/api/reports/top-products?${qs.toString()}`,              { headers: h }),
        fetch(`${API}/api/reports/demand?${qs.toString()}`,                    { headers: h }),
      ]);

      /* sales summary */
      if (salesRes.ok) {
        const d = (await salesRes.json()).data || {};
        setSummary({
          revenue:         parseFloat(d.totalRevenue  || 0),
          cp:              parseFloat(d.totalCost     || 0),
          profit:          parseFloat(d.totalProfit   || 0),
          orders:          parseInt(d.totalOrders    || 0),
          uniqueCustomers: parseInt(d.uniqueCustomers || 0),
        });
      }

      /* revenue timeline — use `date` field directly as X-axis label (no manipulation) */
      if (revenueRes.ok) {
        const raw = await revenueRes.json();
        const rd = raw.data || [];
        // backend may return:
        // 1) array of points (legacy)
        // 2) object with revenueByDay key (new)
        // 3) object with salesByDate key (older mapping)
        let items = [];
        if (Array.isArray(rd)) {
          items = rd;
        } else if (rd.revenueByDay && Array.isArray(rd.revenueByDay)) {
          items = rd.revenueByDay;
        } else if (rd.salesByDate && Array.isArray(rd.salesByDate)) {
          items = rd.salesByDate;
        }
        setSalesByDate(
          items.map((item, i) => ({
            date:    item.date || item.period || `#${i + 1}`,
            revenue: parseFloat(item.revenue ?? item.totalRevenue ?? 0),
            profit:  parseFloat(item.profit  ?? 0),
            orders:  parseInt(item.orders    ?? item.orderCount ?? 0),
          }))
        );
      }

      /* category pie */
      if (catRes.ok) {
        const cd = (await catRes.json()).data || [];
        setCategoryData(
          cd.map(c => ({
            name:  c.category,
            value: parseFloat(c.totalRevenue || 0),
            qty:   parseInt(c.orderCount    || 0),
          }))
        );
      }

      /* top products table */
      if (topRes.ok) {
        const td = (await topRes.json()).data || [];
        setProducts(
          td.map(p => ({
            sku:      p.productId || p.id || "",
            name:     p.productName || p.name || "Unknown",
            category: p.category || "N/A",
            qtySold:  parseInt(p.totalQuantity || 0),
            orders:   parseInt(p.orderCount    || 0),
          }))
        );
      }

      /* demand / notify-me */
      if (demandRes.ok) {
        const dr = await demandRes.json();
        if (dr?.success && Array.isArray(dr.data)) {
          setDemandData(
            dr.data
              .filter(x => x.requestCount > 0)
              .map(x => ({
                name:     x.product?.name || "Unknown",
                requests: x.requestCount,
                inStock:  x.isInStock,
              }))
              .sort((a, b) => b.requests - a.requests)
              .slice(0, 10)
          );
        }
      }
    } catch (err) {
      console.error("Reports fetch error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [rangeType, rangeStart, rangeEnd]);

  // refresh whenever period or selected dates change
  useEffect(() => { fetchData(); }, [fetchData]);

  /* one-time fetches (don't depend on period) */
  useEffect(() => {
    fetchWeeklyStats();
    fetchStatusDist();
  }, [fetchWeeklyStats, fetchStatusDist]);

  /* listen for order events */
  useEffect(() => {
    const handler = () => { fetchData(); fetchWeeklyStats(); fetchStatusDist(); };
    window.addEventListener("orderStatusChanged", handler);
    window.addEventListener("orderCreated",       handler);
    return () => {
      window.removeEventListener("orderStatusChanged", handler);
      window.removeEventListener("orderCreated",       handler);
    };
  }, [fetchData, fetchWeeklyStats, fetchStatusDist]);

  /* ── category pie ── */
  const pieData  = useMemo(() => categoryData.map(c => ({ name: c.name, value: c.qty || c.value })), [categoryData]);
  const pieTotal = useMemo(() => pieData.reduce((s, c) => s + c.value, 0), [pieData]);
  const renderPieLabel = ({ name, value }) => {
    const pct = pieTotal ? Math.round((value / pieTotal) * 100) : 0;
    return pct > 4 ? `${name} ${pct}%` : "";
  };

  /* ── status pie ── */
  const statusPieLabel = ({ status, percentage }) => {
    const pct = typeof percentage === "number" ? percentage.toFixed(1) : 0;
    return pct > 5 ? `${status} (${pct}%)` : "";
  };

  /* ── filtered products ── */
  const filteredProducts = useMemo(() => {
    const q = tableQuery.toLowerCase();
    if (!q) return products;
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  }, [products, tableQuery]);

  /* ── export ── */
  const rangeLabel = useMemo(() => {
    if (rangeType === 'week') return `${rangeStart}_${rangeEnd}`;
    if (rangeType === 'year') return rangeStart.slice(0,4);
    // day/month default to start date
    return rangeStart;
  }, [rangeType, rangeStart, rangeEnd]);

  const handleCSV = () => downloadCSV(`reports-${rangeType}-${rangeLabel}.csv`, products);
  const handlePDF = () => downloadPDF(`reports-${rangeType}-${rangeLabel}.pdf`, ".reports-page");

  /* ── error ── */
  if (error && !summary) {
    return (
      <div className="reports-page">
        <div className="reports-error">
          <div style={{ fontSize: 40, marginBottom: 8 }}>⚠️</div>
          <h2>Error loading reports</h2>
          <p>{error}</p>
          <button className="btn primary" onClick={fetchData}>Retry</button>
        </div>
      </div>
    );
  }

  /* ─── helpers ─── */
  const hasSalesData = salesByDate.length > 0;

  return (
    <div className="reports-page">

      {/* ── Header ── */}
      <div className="reports-header">
        <h1>📈 Sales Reports</h1>
        <div className="reports-actions">
          <button className="btn outline" onClick={() => { fetchData(); fetchWeeklyStats(); fetchStatusDist(); }} title="Refresh">
            🔄 Refresh
          </button>
          <button className="btn outline" onClick={handleCSV}>⬇️ CSV</button>
          <button className="btn outline" onClick={handlePDF}>📄 PDF</button>
          <button className="btn email"   onClick={() => alert("Email feature coming soon!")}>
            📧 Send Email
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="filters">
        <div className="filter-row">
          <strong className="filter-label">Period:</strong>
          <div className="segmented">
            { ["day","week","month","year"].map(r => (
              <button key={r} className={rangeType === r ? "active" : ""}
                onClick={() => setRangeType(r)}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            )) }
          </div>

          {/* date picker tailored to period */}
          {rangeType === 'week' ? (
            <>
              <input
                type="date"
                value={rangeStart}
                onChange={e => {
                  const v = e.target.value;
                  setRangeStart(v);
                  if (new Date(v) > new Date(rangeEnd)) {
                    setRangeEnd(v);
                  }
                }}
                className="reports-input"
              />
              <span className="reports-range-sep">to</span>
              <input
                type="date"
                value={rangeEnd}
                onChange={e => {
                  const v = e.target.value;
                  setRangeEnd(v);
                  if (new Date(v) < new Date(rangeStart)) {
                    setRangeStart(v);
                  }
                }}
                className="reports-input"
              />
            </>
          ) : rangeType === 'month' ? (
            <input
              type="month"
              value={rangeStart.slice(0,7)}
              onChange={e => setRangeStart(`${e.target.value}-01`)}
              className="reports-input"
            />
          ) : rangeType === 'year' ? (
            <input
              type="number" min="2000" max="2100"
              value={rangeStart.slice(0,4)}
              onChange={e => setRangeStart(`${e.target.value}-01-01`)}
              className="reports-input"
              style={{ width: 100 }}
            />
          ) : (
            <input
              type="date"
              value={rangeStart}
              onChange={e => { setRangeStart(e.target.value); setRangeEnd(e.target.value); }}
              className="reports-input"
            />
          )}
          {/* display actual computed range */}
          <span className="reports-range-label">
            {startDate} – {endDate}
          </span>
        </div>
      </div>

      {/* ─── WEEKLY CHARTS ROW (always visible, own loading state) ─── */}
      <div className="weekly-charts-row">
        {/* Weekly Revenue */}
        <div className="card chart-card">
          <h3>📆 {periodLabel} Revenue</h3>
          {weeklyLoading ? (
            <div className="chart-empty"><div className="reports-loading-spinner" /></div>
          ) : weeklyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={weeklyData} margin={{ top: 4, right: 12, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.14)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  height={46}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={v => `₹${v >= 1000 ? (v/1000).toFixed(0)+"k" : v}`}
                />
                <Tooltip
                  formatter={v => [fmt(v), "Revenue"]}
                  contentStyle={{
                    borderRadius: 8,
                    fontSize: 13,
                    background: "rgba(20,18,16,0.92)",
                    border: "1px solid rgba(255,255,255,0.12)",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  dot={{ fill: "#2563eb", r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmpty icon="📅" msg={`No ${periodLabel.toLowerCase()} revenue data`} />
          )}
        </div>

        {/* Weekly Orders */}
        <div className="card chart-card">
          <h3>🛒 {periodLabel} Orders</h3>
          {weeklyLoading ? (
            <div className="chart-empty"><div className="reports-loading-spinner" /></div>
          ) : weeklyOrders.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={weeklyOrders} margin={{ top: 4, right: 12, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.14)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  height={46}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  formatter={v => [fmtNum(v), "Orders"]}
                  contentStyle={{
                    borderRadius: 8,
                    fontSize: 13,
                    background: "rgba(20,18,16,0.92)",
                    border: "1px solid rgba(255,255,255,0.12)",
                  }}
                />
                <Bar dataKey="orders" name="Orders" radius={[5, 5, 0, 0]} fill="#7c3aed" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmpty icon="🛒" msg={`No ${periodLabel.toLowerCase()} orders data`} />
          )}
        </div>
      </div>

      {/* ─── Order Status Pie ─── */}
      <div className="card chart-card status-pie-chart">
        <h3>📊 Order Status Distribution</h3>
        {statusLoading ? (
          <Spinner />
        ) : statusData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                outerRadius={110}
                innerRadius={44}
                paddingAngle={3}
                dataKey="count"
                nameKey="status"
                label={statusPieLabel}
                labelLine={false}
              >
                {statusData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={STATUS_COLORS[entry.status] || PIE_COLORS[i % PIE_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(v, name, p) => [
                  `${fmtNum(v)} orders (${(p.payload.percentage ?? 0).toFixed(1)}%)`,
                  p.payload.status,
                ]}
                contentStyle={{ borderRadius: 8, fontSize: 13 }}
              />
              <Legend
                iconType="circle"
                iconSize={10}
                wrapperStyle={{ fontSize: 12 }}
                formatter={(value, entry) => `${entry.payload?.status ?? value}`}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <ChartEmpty icon="📊" msg="No order status data yet" />
        )}
      </div>

      {loading ? (
        <div className="card"><Spinner /></div>
      ) : (
        <div className="reports-main">

          {/* ── Left col ── */}
          <div className="charts-col">

            {/* Category pie */}
            <div className="card chart-card">
              <h3>🏷️ Sales by Category</h3>
              {pieData.length > 0 && pieTotal > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="48%"
                      outerRadius={100}
                      innerRadius={38}
                      paddingAngle={3}
                      label={renderPieLabel}
                      labelLine={false}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v, name) => [`${fmtNum(v)} orders`, name]}
                      contentStyle={{
                        borderRadius: 8,
                        fontSize: 13,
                        background: "rgba(20,18,16,0.92)",
                        border: "1px solid rgba(255,255,255,0.12)",
                      }}
                    />
                    <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <ChartEmpty icon="🥧" msg="No category data yet" />
              )}
            </div>

            {/* Revenue timeline — uses salesByDate, date field direct */}
            <div className="card chart-card">
              <h3>
                {rangeType === "year"  ? "📅 Monthly Revenue" :
                 rangeType === "month" ? "📅 Daily Revenue" :
                 rangeType === "week"  ? "📅 This Week's Revenue" :
                                         "📅 Revenue Timeline"}
              </h3>
              {hasSalesData ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={salesByDate} margin={{ top: 4, right: 8, left: 0, bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.14)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
                      tickLine={false}
                      axisLine={false}
                      interval={rangeType === "month" ? 2 : 0}
                      angle={rangeType === "month" ? 0 : -20}
                      textAnchor={rangeType === "month" ? "middle" : "end"}
                      height={44}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={v => v >= 1000 ? `₹${(v/1000).toFixed(0)}k` : `₹${v}`}
                    />
                    <Tooltip
                      formatter={v => [fmt(v), "Revenue"]}
                      contentStyle={{
                        borderRadius: 8,
                        fontSize: 13,
                        background: "rgba(20,18,16,0.92)",
                        border: "1px solid rgba(255,255,255,0.12)",
                      }}
                    />
                    <Bar dataKey="revenue" name="Revenue" radius={[4, 4, 0, 0]} fill="#2563eb" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ChartEmpty icon="📉" msg="No revenue data for this period" />
              )}
            </div>

            {/* Profit timeline */}
            {hasSalesData && salesByDate.some(d => d.profit > 0) && (
              <div className="card chart-card">
                <h3>💹 {periodLabel} Profit Trend</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={salesByDate} margin={{ top: 4, right: 8, left: 0, bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.14)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
                      tickLine={false}
                      axisLine={false}
                      interval={rangeType === "month" ? 2 : 0}
                      angle={rangeType === "month" ? 0 : -20}
                      textAnchor={rangeType === "month" ? "middle" : "end"}
                      height={44}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={v => v >= 1000 ? `₹${(v/1000).toFixed(0)}k` : `₹${v}`}
                    />
                    <Tooltip
                      formatter={v => [fmt(v), "Profit"]}
                      contentStyle={{
                        borderRadius: 8,
                        fontSize: 13,
                        background: "rgba(20,18,16,0.92)",
                        border: "1px solid rgba(255,255,255,0.12)",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="profit"
                      stroke="#16a34a"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Demand chart */}
            <div className="card chart-card">
              <h3>🔔 Product Demand — Notify Me Requests</h3>
              {demandData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={demandData} layout="vertical"
                    margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.14)" />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={160}
                      tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      formatter={(v, _, p) => [`${v} requests${p.payload.inStock ? " (now in stock)" : ""}`, "Demand"]}
                      contentStyle={{
                        borderRadius: 8,
                        fontSize: 13,
                        background: "rgba(20,18,16,0.92)",
                        border: "1px solid rgba(255,255,255,0.12)",
                      }}
                    />
                    <Bar dataKey="requests" name="Notify Requests" radius={[0, 5, 5, 0]}>
                      {demandData.map((d, i) => (
                        <Cell key={i} fill={d.inStock ? "#16a34a" : "#dc2626"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ChartEmpty icon="🔕" msg="No notify-me requests yet" />
              )}
            </div>

            {/* Products table */}
            <div className="card table-card">
              <div className="table-header">
                <h3>📦 Top Products Sold</h3>
                <div className="table-controls">
                  <input
                    className="search-input"
                    placeholder="Search product or category…"
                    value={tableQuery}
                    onChange={e => setTableQuery(e.target.value)}
                  />
                </div>
              </div>
              {filteredProducts.length > 0 ? (
                <table className="reports-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Product</th>
                      <th>Category</th>
                      <th>Qty Sold</th>
                      <th>Orders</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((p, i) => (
                      <tr key={p.sku || i}>
                        <td className="index">{i + 1}</td>
                        <td style={{ fontWeight: 600 }}>{p.name}</td>
                        <td>
                          <span className="product-category-badge">
                            {p.category}
                          </span>
                        </td>
                        <td className="qty">{fmtNum(p.qtySold)}</td>
                        <td>{fmtNum(p.orders)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="reports-empty">
                  {tableQuery ? "No products match your search" : "No products sold in this period"}
                </div>
              )}
            </div>

          </div>
          {/* ── End charts col ── */}

          {/* ── Right col: summary + metrics ── */}
          <div className="summary-col">
            <SummarySection summary={summary} />

            <div className="metrics-card">
              <h3>⚡ Quick Metrics</h3>
              <ul>
                <li>Total Orders <strong>{fmtNum(summary?.orders)}</strong></li>
                <li>Unique Customers <strong>{fmtNum(summary?.uniqueCustomers)}</strong></li>
                <li>Revenue <strong>{fmt(summary?.revenue)}</strong></li>
                <li>Total Cost <strong>{fmt(summary?.cp)}</strong></li>
                <li>Net Profit <strong style={{ color: "#4ade80" }}>{fmt(summary?.profit)}</strong></li>
                <li>
                  Margin
                  <strong style={{ color: "#4ade80" }}>
                    {summary?.revenue > 0
                      ? `${((summary.profit / summary.revenue) * 100).toFixed(1)}%`
                      : "—"}
                  </strong>
                </li>
                <li>Categories <strong>{categoryData.length}</strong></li>
                <li>
                  Top Product
                  <strong style={{ fontSize: 12, maxWidth: 120, textAlign: "right", wordBreak: "break-word" }}>
                    {products[0]?.name || "—"}
                  </strong>
                </li>
              </ul>
            </div>

            {/* Status distribution mini-list */}
            {statusData.length > 0 && (
              <div className="card" style={{ marginTop: 0 }}>
                <h3>📊 Status Breakdown</h3>
                {statusData.map((d, i) => (
                  <div key={i} className="small-list-row">
                    <span className="status-label">
                      <span className="status-dot" style={{ background: STATUS_COLORS[d.status] || "var(--border)" }} />
                      {d.status}
                    </span>
                    <span className="status-pill">
                      {fmtNum(d.count)} ({(d.percentage ?? 0).toFixed(1)}%)
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Demand mini-list */}
            {demandData.length > 0 && (
              <div className="card" style={{ marginTop: 0 }}>
                <h3>🔔 Top Demanded</h3>
                {demandData.slice(0, 5).map((d, i) => (
                  <div key={i} className="small-list-row">
                    <span className="status-label">{d.name}</span>
                    <span
                      className="status-pill"
                      style={{
                        background: d.inStock ? "rgba(16, 185, 129, 0.18)" : "rgba(239, 68, 68, 0.18)",
                        color: d.inStock ? "#16a34a" : "#dc2626",
                        border: `1px solid ${d.inStock ? "rgba(16, 185, 129, 0.35)" : "rgba(239, 68, 68, 0.35)"}`,
                      }}
                    >
                      {d.requests} req{d.requests !== 1 ? "s" : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}