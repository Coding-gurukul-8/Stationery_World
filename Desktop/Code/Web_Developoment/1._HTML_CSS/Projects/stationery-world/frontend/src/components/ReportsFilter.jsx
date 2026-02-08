export default function ReportsFilter({ rangeType, setRangeType, rangeValue, setRangeValue, groupBy, setGroupBy }) {
  return (
    <div className="filters card">
      <div className="filter-row">
        <div className="segmented">
          <button className={rangeType === "day" ? "active" : ""} onClick={() => setRangeType("day")}>Day</button>
          <button className={rangeType === "week" ? "active" : ""} onClick={() => setRangeType("week")}>Week</button>
          <button className={rangeType === "month" ? "active" : ""} onClick={() => setRangeType("month")}>Month</button>
          <button className={rangeType === "year" ? "active" : ""} onClick={() => setRangeType("year")}>Year</button>
        </div>

        <div className="range-input">
          {rangeType === "day" && (
            <input type="date" value={rangeValue} onChange={(e) => setRangeValue(e.target.value)} />
          )}

          {rangeType === "month" && (
            <input type="month" value={rangeValue.slice(0, 7)} onChange={(e) => setRangeValue(e.target.value + "-01")} />
          )}

          {rangeType === "year" && (
            <input type="number" min={2000} max={2100} value={new Date(rangeValue).getFullYear()} onChange={(e) => setRangeValue(e.target.value + "-01-01")} />
          )}

          {rangeType === "week" && (
            <input type="week" value={rangeValue} onChange={(e) => setRangeValue(e.target.value)} />
          )}
        </div>

        <div className="extra-options">
          <label>Group by</label>
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
            <option value="category">Category</option>
            <option value="subcategory">Subcategory</option>
            <option value="category-subcategory">Category + Subcategory</option>
          </select>
        </div>
      </div>
    </div>
  );
}
