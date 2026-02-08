export default function SummaryCards({ summary }) {
  if (!summary) return (
    <div className="card summary-cards">
      <p>No data</p>
    </div>
  );

  const profitPercent = summary.revenue === 0 ? 0 : ((summary.profit / summary.revenue) * 100).toFixed(2);

  return (
    <div className="card summary-cards">
      <h3>Summary</h3>
      <div className="summary-grid">
        <div className="sum-card rev">
          <div className="label">Revenue</div>
          <div className="value">₹ {summary.revenue.toLocaleString()}</div>
        </div>
        <div className="sum-card cp">
          <div className="label">Cost Price</div>
          <div className="value">₹ {summary.cp.toLocaleString()}</div>
        </div>
        <div className="sum-card profit">
          <div className="label">Profit</div>
          <div className="value">₹ {summary.profit.toLocaleString()}</div>
        </div>
        <div className="sum-card pct">
          <div className="label">Profit %</div>
          <div className="value">{profitPercent} %</div>
        </div>
      </div>
    </div>
  );
}
