import React, { useState, useEffect } from 'react';
import { MagnifyingGlassIcon, FunnelIcon, StarIcon, EyeIcon, UserIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { templateService, Template, SearchTemplatesRequest } from '../../services/template.service';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ErrorAlert } from '../common/ErrorAlert';
import { Pagination } from '../common/Pagination';
import { cn } from '../../utils/cn';

interface TemplateBrowserProps {
  onSelectTemplate?: (template: Template) => void;
  onApplyTemplate?: (template: Template) => void;
  selectedPhase?: 'REQUIREMENTS' | 'DESIGN' | 'TASKS' | 'IMPLEMENTATION';
  projectId?: string;
}

const CATEGORIES = [
  { value: 'REQUIREMENTS', label: 'Requirements' },
  { value: 'DESIGN', label: 'Design' },
  { value: 'TASKS', label: 'Tasks' },
  { value: 'GENERAL', label: 'General' },
  { value: 'DOMAIN_SPECIFIC', label: 'Domain Specific' },
];

const PHASES = [
  { value: 'REQUIREMENTS', label: 'Requirements' },
  { value: 'DESIGN', label: 'Design' },
  { value: 'TASKS', label: 'Tasks' },
  { value: 'IMPLEMENTATION', label: 'Implementation' },
];

const SORT_OPTIONS = [
  { value: 'createdAt', label: 'Recently Created' },
  { value: 'usageCount', label: 'Most Used' },
  { value: 'rating', label: 'Highest Rated' },
  { value: 'name', label: 'Name' },
];

export const TemplateBrowser: React.FC<TemplateBrowserProps> = ({
  onSelectTemplate,
  onApplyTemplate,
  selectedPhase,
  projectId,
}) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    pages: 0,
  });

  const [filters, setFilters] = useState<SearchTemplatesRequest>({
    query: '',
    phase: selectedPhase,
    category: undefined,
    tags: [],
    isPublic: undefined,
    page: 1,
    limit: 12,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, [filters]);

  useEffect(() => {
    if (selectedPhase) {
      setFilters(prev => ({ ...prev, phase: selectedPhase, page: 1 }));
    }
  }, [selectedPhase]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await templateService.searchTemplates(filters);
      setTemplates(result.templates);
      setPagination(result.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (query: string) => {
    setFilters(prev => ({ ...prev, query, page: 1 }));
  };

  const handleFilterChange = (key: keyof SearchTemplatesRequest, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setFilters(prev => ({ ...prev, page }));
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <StarIcon
            key={star}
            className={cn(
              'h-4 w-4',
              star <= rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
            )}
          />
        ))}
        <span className="ml-1 text-sm text-gray-600">{rating.toFixed(1)}</span>
      </div>
    );
  };

  const renderTemplateCard = (template: Template) => (
    <div
      key={template.id}
      className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onSelectTemplate?.(template)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-medium text-gray-900 mb-1">{template.name}</h3>
          <p className="text-sm text-gray-600 line-clamp-2">{template.description}</p>
        </div>
        {template.isOfficial && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            Official
          </span>
        )}
      </div>

      <div className="flex items-center space-x-4 mb-3">
        {template.phase && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {template.phase}
          </span>
        )}
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          {CATEGORIES.find(c => c.value === template.category)?.label || template.category}
        </span>
      </div>

      {template.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {template.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-50 text-gray-700"
            >
              {tag}
            </span>
          ))}
          {template.tags.length > 3 && (
            <span className="text-xs text-gray-500">+{template.tags.length - 3} more</span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center text-sm text-gray-500">
            <UserIcon className="h-4 w-4 mr-1" />
            {template.author.name}
          </div>
          <div className="flex items-center text-sm text-gray-500">
            <EyeIcon className="h-4 w-4 mr-1" />
            {template.usageCount}
          </div>
        </div>
        {renderStars(template.rating)}
      </div>

      {onApplyTemplate && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onApplyTemplate(template);
            }}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Apply Template
          </button>
        </div>
      )}
    </div>
  );

  if (loading && templates.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center space-x-4 mb-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search templates..."
              value={filters.query || ''}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'flex items-center px-4 py-2 border rounded-md text-sm font-medium transition-colors',
              showFilters
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            )}
          >
            <FunnelIcon className="h-4 w-4 mr-2" />
            Filters
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
            <div>
              <label htmlFor="phase-filter" className="block text-sm font-medium text-gray-700 mb-1">Phase</label>
              <select
                id="phase-filter"
                value={filters.phase || ''}
                onChange={(e) => handleFilterChange('phase', e.target.value || undefined)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Phases</option>
                {PHASES.map((phase) => (
                  <option key={phase.value} value={phase.value}>
                    {phase.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={filters.category || ''}
                onChange={(e) => handleFilterChange('category', e.target.value || undefined)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Categories</option>
                {CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Visibility</label>
              <select
                value={filters.isPublic === undefined ? '' : filters.isPublic.toString()}
                onChange={(e) => {
                  const value = e.target.value;
                  handleFilterChange('isPublic', value === '' ? undefined : value === 'true');
                }}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Templates</option>
                <option value="true">Public Only</option>
                <option value="false">Private Only</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
              <select
                value={filters.sortBy || 'createdAt'}
                onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && <ErrorAlert message={error} />}

      {/* Templates Grid */}
      {templates.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map(renderTemplateCard)}
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.pages}
              onPageChange={handlePageChange}
            />
          )}
        </>
      ) : (
        !loading && (
          <div className="text-center py-12">
            <div className="text-gray-500 mb-2">No templates found</div>
            <div className="text-sm text-gray-400">
              Try adjusting your search criteria or filters
            </div>
          </div>
        )
      )}

      {/* Loading Overlay */}
      {loading && templates.length > 0 && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      )}
    </div>
  );
};