import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader } from 'lucide-react';
import './SearchDropdown.css';

export default function SearchDropdown({ results, isSearching, query, onClose, resultRenderer }) {
  const navigate = useNavigate();

  const handleResultClick = (result) => {
    if (result.onClick) {
      result.onClick();
    } else if (result.path) {
      navigate(result.path);
    }
    onClose();
  };

  if (isSearching) {
    return (
      <div className="search-dropdown">
        <div className="search-loading">
          <Loader className="spin" size={20} />
          <span>Searching...</span>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="search-dropdown">
        <div className="search-empty">
          No results found for "{query}"
        </div>
      </div>
    );
  }

  return (
    <div className="search-dropdown">
      <div className="search-results-header">
        Found {results.length} result{results.length !== 1 ? 's' : ''}
      </div>
      <div className="search-results-list">
        {results.map((result, index) => (
          <div
            key={result.id || index}
            className="search-result-item"
            onClick={() => handleResultClick(result)}
          >
            {resultRenderer ? resultRenderer(result) : (
              <div className="search-result-default">
                {result.image && (
                  <img src={result.image} alt={result.title} className="result-image" />
                )}
                <div className="result-content">
                  <div className="result-title">{result.title}</div>
                  {result.subtitle && (
                    <div className="result-subtitle">{result.subtitle}</div>
                  )}
                </div>
                {result.badge && (
                  <span className="result-badge">{result.badge}</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}