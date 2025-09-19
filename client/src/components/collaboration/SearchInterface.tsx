import {
  CalendarIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  UserIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  SearchOptions,
  SearchResponse,
  SearchResult,
  searchService,
} from '../../services/search.service';
import { cn } from '../../utils/cn';

interface SearchInterfaceProps {
  onResultSelect?: (result: SearchResult) => void;
  initialQuery?: string;
  projectId?: string;
  className?: string;
  children?: React.ReactNode;
}

export const SearchInterface: React.FC<SearchInterfaceProps> = ({
  onResultSelect,
  initialQuery = '',
  projectId,
  className,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filters, setFilters] = useState<SearchOptions>({});
  const [showFilters, setShowFilters] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Debounced search
  const debouncedSearch = useCallback(
    (searchQuery: string, searchFilters: SearchOptions = {}) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(async () => {
        if (!searchQuery.trim() && Object.keys(searchFilters).length === 0) {
          setResults(null);
          return;
        }

        try {
          setLoading(true);
          setError(null);

          const searchOptions = {
            query: searchQuery.trim(),
            ...searchFilters,
          };

          let searchResults: SearchResponse;
          if (projectId) {
            searchResults = await searchService.searchProject(projectId, searchOptions);
          } else {
            searchResults = await searchService.search(searchOptions);
          }

          setResults(searchResults);
        } catch (err: unknown) {
          const searchError = err as { response?: { data?: { message?: string } } };
          setError(searchError.response?.data?.message || 'Search failed');
          setResults(null);
        } finally {
          setLoading(false);
        }
      }, 300);
    },
    [projectId]
  );

  // Get suggestions
  const getSuggestions = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      const searchSuggestions = await searchService.getSuggestions(searchQuery);
      setSuggestions(searchSuggestions);
    } catch (err) {
      setSuggestions([]);
    }
  }, []);

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    if (value.trim()) {
      getSuggestions(value);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }

    debouncedSearch(value, filters);
  };

  // Handle search submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    debouncedSearch(query, filters);
  };

  // Handle suggestion select
  const handleSuggestionSelect = (suggestion: string) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    debouncedSearch(suggestion, filters);
  };

  // Handle filter change
  const handleFilterChange = (newFilters: Partial<SearchOptions>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    debouncedSearch(query, updatedFilters);
  };

  // Handle result click
  const handleResultClick = (result: SearchResult) => {
    onResultSelect?.(result);
  };

  // Handle pagination
  const handlePageChange = (page: number) => {
    const updatedFilters = { ...filters, page };
    setFilters(updatedFilters);
    debouncedSearch(query, updatedFilters);
  };

  // Click outside handler for suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        !searchInputRef.current?.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initial search if query provided
  useEffect(() => {
    if (initialQuery) {
      debouncedSearch(initialQuery, filters);
    }
  }, [initialQuery, debouncedSearch, filters]);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Search Input */}
      <div className="relative">
        <form onSubmit={handleSearchSubmit} className="relative">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={handleSearchChange}
              placeholder={
                projectId
                  ? 'Search within project...'
                  : 'Search specifications, documents, templates...'
              }
              className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
              {loading && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              )}
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  'p-1 rounded hover:bg-gray-100',
                  showFilters ? 'text-blue-600' : 'text-gray-400'
                )}
                title="Filters"
              >
                <FunnelIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </form>

        {/* Search Suggestions */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
          >
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSuggestionSelect(suggestion)}
                className="w-full px-4 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
              >
                <div className="flex items-center space-x-2">
                  <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
                  <span>{suggestion}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Filters */}
      {showFilters && (
        <SearchFilters
          filters={filters}
          onFilterChange={handleFilterChange}
          onClose={() => setShowFilters(false)}
        />
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Results */}
      {results && (
        <SearchResults
          results={results}
          query={query}
          onResultClick={handleResultClick}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
};

interface SearchFiltersProps {
  filters: SearchOptions;
  onFilterChange: (filters: Partial<SearchOptions>) => void;
  onClose: () => void;
}

const SearchFilters: React.FC<SearchFiltersProps> = ({ filters, onFilterChange, onClose }) => {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-900">Filters</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Phase Filter */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Phase</label>
          <select
            value={filters.phase || ''}
            onChange={e => onFilterChange({ phase: e.target.value || undefined })}
            className="w-full text-sm border border-gray-300 rounded px-2 py-1"
          >
            <option value="">All Phases</option>
            <option value="REQUIREMENTS">Requirements</option>
            <option value="DESIGN">Design</option>
            <option value="TASKS">Tasks</option>
            <option value="IMPLEMENTATION">Implementation</option>
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
          <select
            value={filters.status || ''}
            onChange={e => onFilterChange({ status: e.target.value || undefined })}
            className="w-full text-sm border border-gray-300 rounded px-2 py-1"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
            <option value="ARCHIVED">Archived</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </div>

        {/* Sort By */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Sort By</label>
          <select
            value={filters.sortBy || 'relevance'}
            onChange={e => onFilterChange({ sortBy: e.target.value as any })}
            className="w-full text-sm border border-gray-300 rounded px-2 py-1"
          >
            <option value="relevance">Relevance</option>
            <option value="created">Created Date</option>
            <option value="updated">Updated Date</option>
            <option value="name">Name</option>
          </select>
        </div>

        {/* Sort Order */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Order</label>
          <select
            value={filters.sortOrder || 'desc'}
            onChange={e => onFilterChange({ sortOrder: e.target.value as any })}
            className="w-full text-sm border border-gray-300 rounded px-2 py-1"
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>
      </div>

      {/* Date Range */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">From Date</label>
          <input
            type="date"
            value={filters.dateFrom ? filters.dateFrom.toISOString().split('T')[0] : ''}
            onChange={e =>
              onFilterChange({
                dateFrom: e.target.value ? new Date(e.target.value) : undefined,
              })
            }
            className="w-full text-sm border border-gray-300 rounded px-2 py-1"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">To Date</label>
          <input
            type="date"
            value={filters.dateTo ? filters.dateTo.toISOString().split('T')[0] : ''}
            onChange={e =>
              onFilterChange({
                dateTo: e.target.value ? new Date(e.target.value) : undefined,
              })
            }
            className="w-full text-sm border border-gray-300 rounded px-2 py-1"
          />
        </div>
      </div>
    </div>
  );
};

interface SearchResultsProps {
  results: SearchResponse;
  query: string;
  onResultClick: (result: SearchResult) => void;
  onPageChange: (page: number) => void;
}

const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  query,
  onResultClick,
  onPageChange,
}) => {
  if (results.results.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <MagnifyingGlassIcon className="h-12 w-12 mx-auto mb-2 text-gray-300" />
        <p>No results found</p>
        {query && <p className="text-sm">Try different keywords or adjust your filters</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Results Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {results.total} result{results.total !== 1 ? 's' : ''} found
          {query && <span> for "{query}"</span>}
        </p>
        <div className="text-xs text-gray-500">
          Page {results.page} of {results.pages}
        </div>
      </div>

      {/* Results List */}
      <div className="space-y-3">
        {results.results.map(result => (
          <SearchResultItem
            key={`${result.type}-${result.id}`}
            result={result}
            query={query}
            onClick={() => onResultClick(result)}
          />
        ))}
      </div>

      {/* Pagination */}
      {results.pages > 1 && (
        <div className="flex items-center justify-center space-x-2 mt-6">
          <button
            onClick={() => onPageChange(results.page - 1)}
            disabled={results.page <= 1}
            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>

          {Array.from({ length: Math.min(5, results.pages) }, (_, i) => {
            const page = i + Math.max(1, results.page - 2);
            return (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={cn(
                  'px-3 py-1 text-sm border rounded',
                  page === results.page
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-300 hover:bg-gray-50'
                )}
              >
                {page}
              </button>
            );
          })}

          <button
            onClick={() => onPageChange(results.page + 1)}
            disabled={results.page >= results.pages}
            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

interface SearchResultItemProps {
  result: SearchResult;
  query: string;
  onClick: () => void;
}

const SearchResultItem: React.FC<SearchResultItemProps> = ({ result, query, onClick }) => {
  return (
    <div
      onClick={onClick}
      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
    >
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <span className="text-2xl">{searchService.getResultTypeIcon(result.type)}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-1">
            <h3 className="text-sm font-medium text-gray-900 truncate">{result.title}</h3>
            <span
              className={cn(
                'px-2 py-1 text-xs rounded-full',
                searchService.getResultTypeColor(result.type)
              )}
            >
              {searchService.formatResultType(result.type)}
            </span>
          </div>

          <p
            className="text-sm text-gray-600 mb-2"
            dangerouslySetInnerHTML={{
              __html: searchService.highlightSearchTerms(result.excerpt, query),
            }}
          />

          <div className="flex items-center space-x-4 text-xs text-gray-500">
            {result.metadata.author && (
              <div className="flex items-center space-x-1">
                <UserIcon className="h-3 w-3" />
                <span>{result.metadata.author.name}</span>
              </div>
            )}

            <div className="flex items-center space-x-1">
              <CalendarIcon className="h-3 w-3" />
              <span>{formatDistanceToNow(new Date(result.updatedAt), { addSuffix: true })}</span>
            </div>

            {result.metadata.phase && (
              <span className="text-blue-600">{result.metadata.phase}</span>
            )}
          </div>
        </div>

        <div className="flex-shrink-0 text-xs text-gray-400">Score: {result.score.toFixed(1)}</div>
      </div>
    </div>
  );
};
