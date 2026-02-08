import { useEffect, useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Legend,
  CartesianGrid,
} from "recharts";

import ReportsFilter from "../../components/ReportsFilter";
import ReportsTable from "../../components/ReportsTable";
import SummaryCards from "../../components/SummaryCards";
import { getDayMockData, getWeekMockData, getMonthMockData, getYearMockData } from "../../mocks/reportsMock";
import "./Reports.css";
import { downloadCSV, downloadPDF } from "../../utils/reportExport";

const COLORS = ["#4CAF50", "#2196F3", "#FF9800", "#9C27B0", "#F44336", "#607D8B", "#00ACC1"];

export default function Reports() {
  const [rangeType, setRangeType] = useState("day"); // day | week | month | year
  const [rangeValue, setRangeValue] = useState(() => new Date().toISOString().slice(0, 10));
  const [mockData, setMockData] = useState(null);
  const [groupBy, setGroupBy] = useState("category");
  const [tableQuery, setTableQuery] = useState("");

  // helper: compute pie total quickly
  const pieTotal = useMemo(() => {
    return (mockData?.categorySummary || []).reduce((s, c) => s + (c.qty || 0), 0);
  }, [mockData]);

  const renderPieLabel = (props) => {
    const { name, value } = props; // Recharts passes props
    const pct = pieTotal ? Math.round((value / pieTotal) * 100) : 0;
    return `${name} ${pct}%`;
  };

  useEffect(() => {
    // Ensure rangeValue defaults are sensible when changing granularity
    if (rangeType === "month") {
      const m = new Date().toISOString().slice(0, 7);
      setRangeValue((v) => (v && v.startsWith(m) ? v : `${m}-01`));
    }
    if (rangeType === "year") {
      const y = new Date().getFullYear();
      setRangeValue((v) => (v && v.startsWith(String(y)) ? v : `${y}-01-01`));
    }

    // Fetch mock data according to the selected range
    if (rangeType === "day") {
      setMockData(getDayMockData(rangeValue));
    } else if (rangeType === "week") {
      setMockData(getWeekMockData(rangeValue));
    } else if (rangeType === "month") {
      setMockData(getMonthMockData(rangeValue));
    } else if (rangeType === "year") {
      setMockData(getYearMockData(rangeValue));
    }
  }, [rangeType, rangeValue]);

  const pieData = useMemo(() => {
    if (!mockData) return [];
    return mockData.categorySummary.map((c) => ({ name: c.category, value: c.qty }));
  }, [mockData]);

  return (
    <div className="reports-page">
      <div className="reports-header">
        <h1>Monthly Reports</h1>
        <div className="reports-actions">
          <button className="btn outline" onClick={() => downloadCSV(`reports-${rangeType}-${rangeValue}.csv`, mockData?.products || [])}>Download CSV</button>
          <button className="btn outline" onClick={() => downloadPDF(`reports-${rangeType}-${rangeValue}.pdf`, '.reports-page')}>Download PDF</button>
          <button className="btn email" onClick={() => alert('Send to Email (mock)')}>Send to Email</button>
        </div>
      </div>

      <ReportsFilter
        rangeType={rangeType}
        setRangeType={setRangeType}
        rangeValue={rangeValue}
        setRangeValue={setRangeValue}
        groupBy={groupBy}
        setGroupBy={setGroupBy}
      />

      <div className="reports-main">
        <div className="charts-col">
          {/* Pie chart (available in all ranges) */}
          <div className="card chart-card">
            <h3>{rangeType === "day" ? "Category Distribution (Day)" : "Category Distribution"}</h3>
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={renderPieLabel}
                    labelLine={false}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value}`} />
                  <Legend layout="horizontal" verticalAlign="bottom" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bar chart for timeline */}
          <div className="card chart-card">
            <h3>{rangeType === "year" ? "Monthly Revenue" : rangeType === "month" ? "Daily Revenue" : "Revenue Timeline"}</h3>
            <div style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={mockData?.timeline || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="revenue" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card table-card">
            <div className="table-header">
              <h3>Products Sold</h3>
              <div className="table-controls">
                <input className="search-input" placeholder="Search product or customer..." value={tableQuery} onChange={(e) => setTableQuery(e.target.value)} />
              </div>
            </div>
            <ReportsTable rows={mockData?.products || []} query={tableQuery} pageSize={8} />
          </div>
        </div>

        <div className="summary-col">
          <SummaryCards summary={mockData?.summary} />

          <div className="card metrics-card">
            <h3>Quick Metrics</h3>
            <ul>
              <li>Total Orders: {mockData?.summary?.orders ?? 0}</li>
              <li>Unique Customers: {mockData?.summary?.uniqueCustomers ?? 0}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
