import React from 'react';

export default function CategoryStrip({ categories = [], selected, onSelect }) {
  return (
    <div className="category-strip">
      <div className="cat-scroll">
        {categories.map((category) => (
          <button 
            key={category} 
            className={`cat-chip ${selected === category ? 'active' : ''}`}
            onClick={() => onSelect && onSelect(category)}
          >
            {category}
          </button>
        ))}
      </div>
    </div>
  );
}