import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { ProjectFilters as ProjectFiltersType, ProjectStatus, SpecificationPhase } from '../../types/project';

interface ProjectFiltersProps {
  filters: ProjectFiltersType;
  onFiltersChange: (filters: Partial<ProjectFiltersType>) => void;
  onClose: () => void;
}

export const ProjectFilters: React.FC<ProjectFiltersProps> = ({
  filters,
  onFiltersChange,
  onClose,
}) => {
  const handleStatusChange = (status: ProjectStatus | '') => {
    onFiltersChange({ status: status || undefined });
  };

  const handlePhaseChange = (phase: SpecificationPhase | '') => {
    onFiltersChange({ phase: phase || undefined });
  };

  const clearFilters = () => {
    onFiltersChange({ status: undefined, phase: undefined, ownerId: undefined });
  };

  const hasActiveFilters = filters.status || filters.phase || filters.ownerId;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Filters</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Status Filter */}
        <div>
          <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-2">
            Status
          </label>
          <select
            id="status-filter"
            value={filters.status || ''}
            onChange={(e) => handleStatusChange(e.target.value as ProjectStatus | '')}
            className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option value="">All Statuses</option>
            <option value={ProjectStatus.ACTIVE}>Active</option>
            <option value={ProjectStatus.COMPLETED}>Completed</option>
            <option value={ProjectStatus.ARCHIVED}>Archived</option>
            <option value={ProjectStatus.SUSPENDED}>Suspended</option>
          </select>
        </div>

        {/* Phase Filter */}
        <div>
          <label htmlFor="phase-filter" className="block text-sm font-medium text-gray-700 mb-2">
            Current Phase
          </label>
          <select
            id="phase-filter"
            value={filters.phase || ''}
            onChange={(e) => handlePhaseChange(e.target.value as SpecificationPhase | '')}
            className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          >
            <option value="">All Phases</option>
            <option value={SpecificationPhase.REQUIREMENTS}>Requirements</option>
            <option value={SpecificationPhase.DESIGN}>Design</option>
            <option value={SpecificationPhase.TASKS}>Tasks</option>
            <option value={SpecificationPhase.IMPLEMENTATION}>Implementation</option>
          </select>
        </div>

        {/* Owner Filter - TODO: Implement user selection */}
        <div>
          <label htmlFor="owner-filter" className="block text-sm font-medium text-gray-700 mb-2">
            Owner
          </label>
          <select
            id="owner-filter"
            value={filters.ownerId || ''}
            onChange={(e) => onFiltersChange({ ownerId: e.target.value || undefined })}
            className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            disabled
          >
            <option value="">All Owners</option>
            {/* TODO: Populate with actual users */}
          </select>
          <p className="mt-1 text-xs text-gray-500">Coming soon</p>
        </div>
      </div>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <button
            onClick={clearFilters}
            className="text-sm text-blue-600 hover:text-blue-500"
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
};