import { useState, useEffect, useCallback, useRef } from "react";
import "./Dashboard.css";
import { authUtils } from "../../utils/auth";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid, AreaChart, Area
} from "recharts";

/* ─── Constants ─────────────────────────────────────────── */
const API = "http://localhost:3000";
const POLL_INTERVAL = 20_000;

const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 150 150'%3E%3Ccircle cx='75' cy='75' r='75' fill='%232563eb'/%3E%3Cpath d='M75 40c-11 0-20 9-20 20s9 20 20 20 20-9 20-20-9-20-20-20zm0 60c-16.5 0-30 8.5-30 19v6h60v-6c0-10.5-13.5-19-30-19z' fill='%23fff'/%3E%3C/svg%3E";

const getImageUrl = (u) => {
  if (!u) return DEFAULT_AVATAR;
  if (u.startsWith("http://") || u.startsWith("https://") || u.startsWith("data:")) return u;
  if (u.startsWith("/uploads/")) return `${API}${u}`;
  return u;
};

const fmt = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);
const fmtNum = (n) => new Intl.NumberFormat("en-IN").format(n || 0);

const timeAgo = (dt) => {
  const diff = (Date.now() - new Date(dt)) / 1000;
  if (diff < 60)    return `${Math.floor(diff)}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(dt).toLocaleDateString("en-IN");
};

const BAR_COLORS = ["#2563eb","#1d4ed8","#3b82f6","#60a5fa","#1e40af","#0284c7","#0369a1","#075985"];
const PIE_COLORS = ["#2563eb","#16a34a","#d97706","#dc2626","#7c3aed","#0891b2","#db2777","#65a30d"];

/* ─── Sub-components ─────────────────────────────────────── */

function StatCard({ icon, label, value, sub, color = "blue", onClick, pulse }) {
  return (
    <div
      className={`dash-stat-card ${color}${onClick ? " clickable" : ""}`}
      onClick={onClick}
      style={onClick ? { cursor: "pointer" } : {}}
    >
      <div className="sc-accent-bar" />
      <div className="sc-icon">{icon}</div>
      <div className="sc-label">{label}</div>
      <div className={`sc-value${pulse ? " value-pulse" : ""}`}>{value}</div>
      {sub && <div className="sc-sub">{sub}</div>}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="dash-stat-card" style={{ cursor: "default" }}>
      <div className="sc-accent-bar" style={{ background: "#e2e8f0" }} />
      <div className="dash-skeleton" style={{ width: 40, height: 40, borderRadius: 10, marginBottom: 14 }} />
      <div className="dash-skeleton" style={{ width: "60%", height: 12, marginBottom: 10 }} />
      <div className="dash-skeleton" style={{ width: "40%", height: 26, marginBottom: 8 }} />
      <div className="dash-skeleton" style={{ width: "70%", height: 10 }} />
    </div>
  );
}

function PendingRow({ order }) {
  const customer = order.user?.name || order.recipientName || "Unknown";
  const amount   = order.totalAmount || order.totalSp || 0;
  return (
    <div className="dash-pending-row">
      <span className="dash-pending-order-id">
        #{(order.uid || order.id || "").toString().slice(-6).toUpperCase()}
      </span>
      <div className="dash-pending-info">
        <strong>{customer}</strong>
        <div className="sub">
          {(order.items || []).length} item{order.items?.length !== 1 ? "s" : ""}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
        <span className="dash-pending-amount">{fmt(amount)}</span>
        <span className={`dash-status-badge ${order.status}`}>{order.status}</span>
      </div>
      <span className="dash-pending-time">{timeAgo(order.createdAt)}</span>
    </div>
  );
}

/* ─── Today's stats mini-banner ────────────────────────── */
function TodayBanner({ stats }) {
  if (!stats?.todayRevenue && !stats?.todayProfit) return null;
  return (
    <div className="dash-today-banner">
      <div className="today-banner-title">
        <span>☀️</span>
        <strong>Today's Snapshot</strong>
        <span className="today-date">
          {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
        </span>
      </div>
      <div className="today-banner-stats">
        <div className="today-stat">
          <div className="today-stat-label">Revenue</div>
          <div className="today-stat-value green">{fmt(stats.todayRevenue)}</div>
        </div>
        <div className="today-divider" />
        <div className="today-stat">
          <div className="today-stat-label">Profit</div>
          <div className="today-stat-value emerald">{fmt(stats.todayProfit)}</div>
        </div>
        <div className="today-divider" />
        <div className="today-stat">
          <div className="today-stat-label">Avg Order</div>
          <div className="today-stat-value blue">{fmt(stats.todayAverageOrderValue)}</div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────── */
export default function Dashboard() {
  const admin = authUtils.getUser();

  const [stats,         setStats]         = useState(null);
  const [revenueData,   setRevenueData]   = useState([]);
  const [categoryData,  setCategoryData]  = useState([]);
  // report controls
  const [reportPeriod,   setReportPeriod]   = useState('monthly');
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate,   setReportEndDate]   = useState('');
  const [pendingOrders, setPendingOrders] = useState([]);
  const [recentOrders,  setRecentOrders]  = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [lastUpdated,   setLastUpdated]   = useState(null);
  const [error,         setError]         = useState(null);
  const [flashKeys,     setFlashKeys]     = useState({});

  const prevStatsRef = useRef(null);
  const timerRef     = useRef(null);

  /* ── Build query string for reports based on controls ── */
  const buildReportQuery = () => {
    const params = new URLSearchParams();
    if (reportPeriod) params.set('period', reportPeriod);
    if (reportStartDate) params.set('startDate', reportStartDate);
    if (reportEndDate)   params.set('endDate', reportEndDate);
    return params.toString() ? `?${params.toString()}` : '';
  };

  /* ── Fetch all data ── */
  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    const token = authUtils.getToken();
    const h = { Authorization: `Bearer ${token}` };

    const reportQuery = buildReportQuery();

    try {
      const [dashRes, revRes, catRes, ordersRes] = await Promise.all([
        fetch(`${API}/api/reports/dashboard`,              { headers: h }),
        fetch(`${API}/api/reports/revenue${reportQuery}`, { headers: h }),
        fetch(`${API}/api/reports/category-performance${reportQuery}`,   { headers: h }),
        fetch(`${API}/api/orders/admin/all`,               { headers: h }),
      ]);

      if (dashRes.ok) {
        const d = (await dashRes.json()).data || {};
        if (prevStatsRef.current) {
          const changed = {};
          ["totalOrders","totalRevenue","totalProfit","pendingOrders","deliveredOrders",
           "totalProducts","totalAssets","activeCash","todayRevenue","todayProfit",
           "stockValue","totalCostPrice"].forEach(k => {
            if (prevStatsRef.current[k] !== d[k]) changed[k] = true;
          });
          if (Object.keys(changed).length) setFlashKeys(changed);
          setTimeout(() => setFlashKeys({}), 1800);
        }
        prevStatsRef.current = d;
        setStats(d);
      }

      if (revRes.ok) {
        const json = await revRes.json();
        const payload = json.data || {};
        let rd = [];
        if (Array.isArray(payload)) {
          // old shape (monthly-only array)
          rd = payload.map((item, i) => ({ date: item.day || item.date }));
        } else {
          rd = payload.revenueByDay || [];
        }
        // transform according to period
        let transformed = rd.map((item, i) => ({
          day: item.date || item.day || `Day ${i + 1}`,
          rev: parseFloat(item.totalRevenue || item.revenue) || 0,
        }));
        // if yearly, group by month
        if (reportPeriod === 'yearly') {
          const byMonth = {};
          transformed.forEach(d => {
            const m = new Date(d.day).toLocaleString('en-IN', { month: 'short' });
            byMonth[m] = (byMonth[m] || 0) + d.rev;
          });
          transformed = Object.entries(byMonth).map(([m, v]) => ({ day: m, rev: v }));
        }
        setRevenueData(transformed.length
          ? transformed
          : Array.from({ length: 30 }, (_, i) => ({ day: `${i + 1}`, rev: 0 }))
        );
      }

      if (catRes.ok) {
        const cd = (await catRes.json()).data || [];
        setCategoryData(
          cd.length
            ? cd.map(c => ({
                name:   c.category,
                value:  parseFloat(c.totalRevenue) || 0,
                orders: parseInt(c.orderCount) || 0,
              }))
            : [{ name: "No data", value: 1, orders: 0 }]
        );
      }

      if (ordersRes.ok) {
        const all = (await ordersRes.json()).data || [];
        const sorted = [...all].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setPendingOrders(
          sorted.filter(o => ["PENDING","PROCESSING","CONFIRMED"].includes(o.status)).slice(0, 10)
        );
        setRecentOrders(sorted.slice(0, 6));
      }

      setLastUpdated(new Date());
      setError(null);
      // if the user didn't choose dates yet, prefill to current period bounds
      if (!reportStartDate && !reportEndDate) {
        const today = new Date();
        if (reportPeriod === 'monthly') {
          setReportStartDate(`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-01`);
          setReportEndDate(`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${new Date(today.getFullYear(), today.getMonth()+1,0).getDate()}`);
        }
        if (reportPeriod === 'weekly') {
          const dow = today.getDay(); // 0 sunday
          const monday = new Date(today);
          monday.setDate(today.getDate() - ((dow + 6)%7));
          const sunday = new Date(monday);
          sunday.setDate(monday.getDate() + 6);
          setReportStartDate(monday.toISOString().slice(0,10));
          setReportEndDate(sunday.toISOString().slice(0,10));
        }
        if (reportPeriod === 'yearly') {
          setReportStartDate(`${today.getFullYear()}-01-01`);
          setReportEndDate(`${today.getFullYear()}-12-31`);
        }
        if (reportPeriod === 'daily') {
          setReportStartDate(today.toISOString().slice(0,10));
          setReportEndDate(today.toISOString().slice(0,10));
        }
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAll(false);
    timerRef.current = setInterval(() => fetchAll(true), POLL_INTERVAL);
    return () => clearInterval(timerRef.current);
  }, [fetchAll]);

  // when period selector changes, prefill date inputs
  useEffect(() => {
    const today = new Date();
    if (reportPeriod === 'monthly') {
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      setReportStartDate(`${y}-${m}-01`);
      const last = new Date(y, today.getMonth() + 1, 0).getDate();
      setReportEndDate(`${y}-${m}-${last}`);
    } else if (reportPeriod === 'weekly') {
      const dow = today.getDay();
      const mon = new Date(today);
      mon.setDate(today.getDate() - ((dow + 6) % 7));
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      setReportStartDate(mon.toISOString().slice(0,10));
      setReportEndDate(sun.toISOString().slice(0,10));
    } else if (reportPeriod === 'yearly') {
      const y = today.getFullYear();
      setReportStartDate(`${y}-01-01`);
      setReportEndDate(`${y}-12-31`);
    } else if (reportPeriod === 'daily') {
      const d = today.toISOString().slice(0,10);
      setReportStartDate(d);
      setReportEndDate(d);
    }
  }, [reportPeriod]);

  useEffect(() => {
    const handler = () => fetchAll(true);
    window.addEventListener("orderStatusChanged", handler);
    window.addEventListener("orderCreated",       handler);
    window.addEventListener("userUpdated",        handler);
    return () => {
      window.removeEventListener("orderStatusChanged", handler);
      window.removeEventListener("orderCreated",       handler);
      window.removeEventListener("userUpdated",        handler);
    };
  }, [fetchAll]);

  /* ── Derived values ── */
  const totalAssets  = stats?.totalAssets  ?? ((stats?.stockValue || 0) + (stats?.activeCash || 0));
  const activeCash   = stats?.activeCash   ?? ((stats?.paidRevenue || 0) - (stats?.selfPurchaseCp || 0));
  const stockValue   = stats?.stockValue   ?? stats?.stockCpValue ?? 0;
  const totalCostPrice = stats?.totalCostPrice ?? 0;

  const pulse = (k) => flashKeys[k] ? " value-pulse" : "";

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="admin-dashboard">
        <div className="dash-page-header">
          <h1>📊 Admin Dashboard</h1>
          <div className="dash-live-badge"><div className="dash-live-dot" /> Loading…</div>
        </div>
        <div className="dash-stats-grid" style={{ marginBottom: 16 }}>
          {Array(8).fill(0).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  /* ── Error ── */
  if (error && !stats) {
    return (
      <div className="admin-dashboard">
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: 28, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
          <strong style={{ color: "#dc2626" }}>Could not load dashboard</strong>
          <p style={{ margin: "8px 0 16px", color: "#7f1d1d", fontSize: 14 }}>{error}</p>
          <button onClick={() => fetchAll(false)}
            style={{ padding: "10px 24px", background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <style>{`
        .value-pulse { animation: valuePop 0.6s cubic-bezier(0.34,1.56,0.64,1); }
        @keyframes valuePop { 0%{transform:scale(1)} 40%{transform:scale(1.12)} 100%{transform:scale(1)} }

        .dash-live-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 999px;
          border: 1px solid rgba(34, 197, 94, 0.35);
          background: rgba(34, 197, 94, 0.12);
          font-size: 12px;
          font-weight: 700;
          color: #16a34a;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .dash-live-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #16a34a;
          box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.75);
          animation: livePulse 1.8s ease-out infinite;
        }

        @keyframes livePulse {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.75); }
          50% { transform: scale(1.25); box-shadow: 0 0 0 10px rgba(34, 197, 94, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
        }

        .dash-stat-card.clickable:hover .sc-value { color: var(--accent); }
      `}</style>

      {/* ── Page header ── */}
      <div className="dash-page-header">
        <h1>📊 Admin Dashboard</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {lastUpdated && (
            <span style={{ fontSize: 11, color: "#94a3b8" }}>
              Updated {timeAgo(lastUpdated)}
            </span>
          )}
          <div className="dash-live-badge"><div className="dash-live-dot" /> Live</div>
          <button
            className={`dash-refresh-btn${refreshing ? " spinning" : ""}`}
            onClick={() => fetchAll(true)}
            title="Refresh now"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
            </svg>
            Refresh
        </button>
        </div>
      </div>

      {/* ── Report controls ── */}
      <div className="report-controls" style={{ margin: '16px 0', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <label>
          Period:&nbsp;
          <select value={reportPeriod} onChange={e => setReportPeriod(e.target.value)}>
            <option value="daily">Day</option>
            <option value="weekly">Week</option>
            <option value="monthly">Month</option>
            <option value="yearly">Year</option>
          </select>
        </label>
        {(reportPeriod === 'daily' || reportPeriod === 'weekly') && (
          <>
            <label>
              From:&nbsp;
              <input type="date" value={reportStartDate} onChange={e => setReportStartDate(e.target.value)} />
            </label>
            {reportPeriod === 'weekly' && (
              <label>
                To:&nbsp;
                <input type="date" value={reportEndDate} onChange={e => setReportEndDate(e.target.value)} />
              </label>
            )}
          </>
        )}
        {reportPeriod === 'monthly' && (
          <label>
            Month:&nbsp;
            <input type="month"
              value={reportStartDate ? reportStartDate.slice(0,7) : ''}
              onChange={e => {
                const [y,m] = e.target.value.split('-');
                setReportStartDate(`${y}-${m}-01`);
                const last = new Date(y, parseInt(m), 0).getDate();
                setReportEndDate(`${y}-${m}-${last}`);
              }}
            />
          </label>
        )}
        {reportPeriod === 'yearly' && (
          <label>
            Year:&nbsp;
            <input type="number" min="2000" max="2100"
              value={reportStartDate ? reportStartDate.slice(0,4) : ''}
              onChange={e => {
                const yr = e.target.value;
                setReportStartDate(`${yr}-01-01`);
                setReportEndDate(`${yr}-12-31`);
              }}
            />
          </label>
        )}
        <button className="btn primary" onClick={() => fetchAll(false)}>Apply</button>
      </div>

      {/* ── Profile card ── */}
      <div className="dash-profile-card">
        <div className="dash-profile-left">
          <img className="dash-profile-avatar" src={getImageUrl(admin?.photoUrl)} alt={admin?.name}
            onError={e => { e.target.src = DEFAULT_AVATAR; }} />
          <div className="dash-profile-info">
            <h2>{admin?.name || "Admin"}</h2>
            <p>{admin?.email || "—"}</p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>ID: #{admin?.id || "N/A"}</p>
            <div className="dash-profile-badge">⚡ {admin?.role || "ADMIN"}</div>
          </div>
        </div>
        <div className="dash-profile-right">
          <div className="dash-profile-stat">
            <div className="val">{fmtNum(stats?.totalOrders)}</div>
            <div className="lbl">Orders</div>
          </div>
          <div className="dash-profile-divider" />
          <div className="dash-profile-stat">
            <div className="val">{fmt(stats?.totalRevenue)}</div>
            <div className="lbl">Revenue</div>
          </div>
          <div className="dash-profile-divider" />
          <div className="dash-profile-stat">
            <div className="val">{fmt(stats?.totalProfit)}</div>
            <div className="lbl">Profit</div>
          </div>
          <div className="dash-profile-divider" />
          <div className="dash-profile-stat">
            <div className="val">{fmtNum(stats?.totalProducts)}</div>
            <div className="lbl">Products</div>
          </div>
        </div>
      </div>

      {/* ── Today's snapshot banner ── */}
      <TodayBanner stats={stats} />

      {/* ── Row 1: Core metrics ── */}
      <div className="dash-stats-grid">
        <StatCard
          icon="📦" label="Total Orders" color="blue"
          value={<span className={pulse("totalOrders")}>{fmtNum(stats?.totalOrders)}</span>}
          sub="All orders on your products"
          onClick={() => window.location.href = "/admin/orders"}
        />
        <StatCard
          icon="💰" label="Total Revenue" color="green"
          value={<span className={pulse("totalRevenue")}>{fmt(stats?.totalRevenue)}</span>}
          sub="SP collected on your products"
        />
        <StatCard
          icon="📈" label="Total Profit" color="emerald"
          value={<span className={pulse("totalProfit")}>{fmt(stats?.totalProfit)}</span>}
          sub="Revenue − Cost price"
        />
        <StatCard
          icon="🏪" label="Active Products" color="purple"
          value={<span className={pulse("totalProducts")}>{fmtNum(stats?.totalProducts)}</span>}
          sub="Live in store"
          onClick={() => window.location.href = "/admin/inventory"}
        />
      </div>

      {/* ── Row 2: Today's metrics ── */}
      <div className="dash-stats-grid" style={{ marginBottom: 16 }}>
        <StatCard
          icon="☀️" label="Today's Revenue" color="green"
          value={<span className={pulse("todayRevenue")}>{fmt(stats?.todayRevenue)}</span>}
          sub="Revenue earned today"
        />
        <StatCard
          icon="💹" label="Today's Profit" color="emerald"
          value={<span className={pulse("todayProfit")}>{fmt(stats?.todayProfit)}</span>}
          sub="Net profit earned today"
        />
        <StatCard
          icon="🛒" label="Today's Avg Order" color="blue"
          value={<span className={pulse("todayAverageOrderValue")}>{fmt(stats?.todayAverageOrderValue)}</span>}
          sub="Average order value today"
        />
        <StatCard
          icon="📊" label="Avg Order Value" color="cyan"
          value={fmt(stats?.averageOrderValue)}
          sub="All-time per order average"
        />
      </div>

      {/* ── Row 3: Asset & liquidity metrics ── */}
      <div className="dash-stats-grid-2">
        <StatCard
          icon="🏦" label="Total Assets" color="dark"
          value={<span className={pulse("totalAssets")}>{fmt(totalAssets)}</span>}
          sub={`Stock: ${fmt(stockValue)} + Cash: ${fmt(activeCash)}`}
        />
        <StatCard
          icon="💵" label="Active Cash" color="cyan"
          value={<span className={pulse("activeCash")}>{fmt(activeCash)}</span>}
          sub="Paid revenue − own-purchase CP"
        />
        <StatCard
          icon="📦" label="Stock Value" color="purple"
          value={<span className={pulse("stockValue")}>{fmt(stockValue)}</span>}
          sub="Current inventory at cost"
        />
        <StatCard
          icon="🏷️" label="Total Cost Price" color="amber"
          value={<span className={pulse("totalCostPrice")}>{fmt(totalCostPrice)}</span>}
          sub="Sum of all product CPs sold"
        />
      </div>

      {/* ── Row 4: Operations ── */}
      <div className="dash-stats-grid" style={{ marginBottom: 24 }}>
        <StatCard
          icon="⏳" label="Pending Orders" color="amber"
          value={<span className={pulse("pendingOrders")}>{fmtNum(stats?.pendingOrders ?? pendingOrders.length)}</span>}
          sub="Awaiting action"
          onClick={() => window.location.href = "/admin/orders"}
        />
        <StatCard
          icon="⚠️" label="Low Stock Items" color="red"
          value={fmtNum(stats?.lowStockProducts)}
          sub="Below threshold"
          onClick={() => window.location.href = "/admin/inventory"}
        />
        <StatCard
          icon="👥" label="Total Customers" color="purple"
          value={fmtNum(stats?.totalCustomers)}
          sub="Unique buyers"
        />
        <StatCard
          icon="✅" label="Delivered" color="green"
          value={fmtNum(stats?.deliveredOrders)}
          sub="Completed orders"
        />
      </div>

      {/* ── Pending orders live panel ── */}
      <div className="dash-pending-section">
        <div className="dash-section-header">
          <div className="dash-section-title">
            ⏳ Pending &amp; Active Orders
            {pendingOrders.length > 0 && (
              <span className={`dash-section-count${pendingOrders.length > 5 ? " red" : ""}`}>
                {pendingOrders.length}
              </span>
            )}
          </div>
          <button
            className={`dash-refresh-btn${refreshing ? " spinning" : ""}`}
            onClick={() => fetchAll(true)}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
            </svg>
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {pendingOrders.length === 0 ? (
          <div className="dash-pending-empty">
            <div style={{ fontSize: 36, marginBottom: 8 }}>🎉</div>
            <strong style={{ color: "#16a34a" }}>No pending orders!</strong>
            <div style={{ marginTop: 4 }}>All orders have been processed.</div>
          </div>
        ) : (
          <div className="dash-pending-list">
            {pendingOrders.map(o => <PendingRow key={o.id} order={o} />)}
          </div>
        )}
      </div>

      {/* ── Charts ── */}
      <div className="dash-charts-row">
        <div className="dash-chart-card">
          <h3>📅 Daily Revenue — Current Month</h3>
          {revenueData.some(d => d.rev > 0) ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={revenueData} margin={{ top: 4, right: 8, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }}
                  label={{ value: "Day", position: "insideBottom", offset: -12, fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }}
                  tickFormatter={v => `₹${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`} />
                <Tooltip formatter={v => fmt(v)} labelFormatter={l => `Day ${l}`}
                  contentStyle={{ borderRadius: 8, fontSize: 13, border: "1px solid #e2e8f0" }} />
                <Bar dataKey="rev" name="Revenue" radius={[5, 5, 0, 0]}>
                  {revenueData.map((_, i) => (
                    <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="dash-chart-empty">
              <div style={{ fontSize: 40 }}>📉</div>
              <span>No revenue recorded this month yet</span>
            </div>
          )}
        </div>

        <div className="dash-chart-card">
          <h3>🏷️ Sales by Category</h3>
          {categoryData.some(c => c.value > 0) ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={categoryData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="45%"
                  outerRadius={95}
                  innerRadius={40}
                  paddingAngle={3}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {categoryData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v, name, p) => [`${fmt(v)} · ${p.payload.orders} orders`, name]}
                  contentStyle={{ borderRadius: 8, fontSize: 13 }}
                />
                <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="dash-chart-empty">
              <div style={{ fontSize: 40 }}>🥧</div>
              <span>No category data yet</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Recent activity ── */}
      {recentOrders.length > 0 && (
        <div className="dash-activity-card">
          <h3>🕒 Recent Orders</h3>
          <div className="dash-activity-list">
            {recentOrders.map(o => {
              const statusColor = {
                DELIVERED: "#16a34a", PENDING: "#d97706", CANCELLED: "#dc2626",
                PROCESSING: "#2563eb", CONFIRMED: "#7c3aed", SHIPPED: "#0891b2"
              }[o.status] || "#94a3b8";
              return (
                <div key={o.id} className="dash-activity-row">
                  <div className="dash-activity-dot" style={{ background: statusColor }} />
                  <div className="dash-activity-text">
                    <strong>{o.user?.name || o.recipientName || "Unknown"}</strong>
                    {" ordered "}
                    {(o.items || []).map(it => it.productName).join(", ") || "items"}
                  </div>
                  <span className={`dash-status-badge ${o.status}`}>{o.status}</span>
                  <span className="dash-activity-time">{timeAgo(o.createdAt)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Quick links ── */}
      <div className="dash-quick-links">
        <div className="dash-quick-link" onClick={() => window.location.href = "/admin/orders"}>
          <div className="ql-icon" style={{ background: "#eff6ff" }}>📦</div>
          <div className="ql-text">
            <strong>Manage Orders</strong>
            <span>View, update &amp; track all orders</span>
          </div>
        </div>
        <div className="dash-quick-link" onClick={() => window.location.href = "/admin/inventory"}>
          <div className="ql-icon" style={{ background: "#f0fdf4" }}>🏪</div>
          <div className="ql-text">
            <strong>Inventory</strong>
            <span>Add products, restock, low stock</span>
          </div>
        </div>
        <div className="dash-quick-link" onClick={() => window.location.href = "/admin/reports"}>
          <div className="ql-icon" style={{ background: "#faf5ff" }}>📈</div>
          <div className="ql-text">
            <strong>Reports &amp; Analytics</strong>
            <span>Sales, revenue, category insights</span>
          </div>
        </div>
      </div>

    </div>
  );
}