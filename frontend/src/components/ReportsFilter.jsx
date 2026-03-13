export default function ReportsFilter({ rangeType, setRangeType, rangeValue, setRangeValue, groupBy, setGroupBy }) {
  return (
    <div className="filters card">
      <div className="filter-row">
        <div className="segmented">
          <button 
            className={rangeType === "daily" ? "active" : ""} 
            onClick={() => setRangeType("daily")}
          >
            Daily
          </button>
          <button 
            className={rangeType === "weekly" ? "active" : ""} 
            onClick={() => setRangeType("weekly")}
          >
            Weekly
          </button>
          <button 
            className={rangeType === "monthly" ? "active" : ""} 
            onClick={() => setRangeType("monthly")}
          >
            Monthly
          </button>
          <button 
            className={rangeType === "yearly" ? "active" : ""} 
            onClick={() => setRangeType("yearly")}
          >
            Yearly
          </button>
        </div>

        <div className="range-input">
          {rangeType === "daily" && (
            <input 
              type="date" 
              value={rangeValue} 
              onChange={(e) => setRangeValue(e.target.value)} 
            />
          )}

          {rangeType === "monthly" && (
            <input 
              type="month" 
              value={rangeValue.slice(0, 7)} 
              onChange={(e) => setRangeValue(e.target.value + "-01")} 
            />
          )}

          {rangeType === "yearly" && (
            <input 
              type="number" 
              min={2000} 
              max={2100} 
              value={new Date(rangeValue).getFullYear()} 
              onChange={(e) => setRangeValue(e.target.value + "-01-01")} 
            />
          )}

          {rangeType === "weekly" && (
            <input 
              type="week" 
              value={rangeValue} 
              onChange={(e) => setRangeValue(e.target.value)} 
            />
          )}
        </div>

        <div className="extra-options">
          <label>Group by</label>
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
            <option value="category">Category</option>
            <option value="product">Product</option>
            <option value="customer">Customer</option>
          </select>
        </div>
      </div>
    </div>
  );
}