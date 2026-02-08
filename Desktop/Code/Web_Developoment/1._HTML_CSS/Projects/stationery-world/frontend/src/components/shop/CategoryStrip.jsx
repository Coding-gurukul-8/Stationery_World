import React from 'react';

export default function CategoryStrip({ categories = [], onSelect }) {
  return (
    <div className="category-strip">
      <div className="cat-scroll">
        {categories.map((c) => (
          <button key={c} className="cat-chip" onClick={() => onSelect && onSelect(c)}>{c}</button>
        ))}
      </div>
    </div>
  );
}
