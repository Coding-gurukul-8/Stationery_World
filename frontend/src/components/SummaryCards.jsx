export default function SummaryCards({ summary }) {
  if (!summary) {
    return (
      <div className="card summary-cards">
        <h3>Summary</h3>
        <p style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
          No data available
        </p>
      </div>
    );
  }

  const profitPercent = summary.revenue === 0 
    ? 0 
    : ((summary.profit / summary.revenue) * 100).toFixed(2);

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  return (
    <div className="card summary-cards">
      <h3>Summary</h3>
      <div className="summary-grid">
        <div className="sum-card rev">
          <div className="label">Revenue</div>
          <div className="value">{formatCurrency(summary.revenue)}</div>
        </div>
        <div className="sum-card cp">
          <div className="label">Cost Price</div>
          <div className="value">{formatCurrency(summary.cp)}</div>
        </div>
        <div className="sum-card profit">
          <div className="label">Profit</div>
          <div className="value">{formatCurrency(summary.profit)}</div>
        </div>
        <div className="sum-card pct">
          <div className="label">Profit %</div>
          <div className="value">{profitPercent}%</div>
        </div>
      </div>
    </div>
  );
}