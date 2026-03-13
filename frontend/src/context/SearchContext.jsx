import React, { createContext, useContext, useState, useCallback } from 'react';

const SearchContext = createContext();

export function useSearch() {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch must be used within SearchProvider');
  }
  return context;
}

export function SearchProvider({ children }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMode, setSearchMode] = useState('products');
  const [searchHandler, setSearchHandler] = useState(null);
  const [placeholder, setPlaceholder] = useState('Search...');
  const [resultRenderer, setResultRenderer] = useState(null);

  // Register a search handler for current page
  const registerSearchHandler = useCallback((mode, handler, customPlaceholder, renderer) => {
    setSearchMode(mode);
    setSearchHandler(() => handler);
    setPlaceholder(customPlaceholder || `Search ${mode}...`);
    setResultRenderer(() => renderer);
    setSearchQuery('');
    setSearchResults([]);
  }, []);

  // Unregister when component unmounts
  const unregisterSearchHandler = useCallback(() => {
    setSearchHandler(null);
    setResultRenderer(null);
    setSearchQuery('');
    setSearchResults([]);
  }, []);

  // Perform search
  const performSearch = useCallback(async (query) => {
    setSearchQuery(query);

    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    if (!searchHandler) {
      return;
    }

    setIsSearching(true);

    try {
      const results = await searchHandler(query);
      setSearchResults(results || []);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchHandler]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
  }, []);

  return (
    <SearchContext.Provider
      value={{
        searchQuery,
        searchResults,
        isSearching,
        searchMode,
        placeholder,
        resultRenderer,
        performSearch,
        clearSearch,
        registerSearchHandler,
        unregisterSearchHandler
      }}
    >
      {children}
    </SearchContext.Provider>
  );
}