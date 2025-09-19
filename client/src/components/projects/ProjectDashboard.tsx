import { FunnelIcon, MagnifyingGlassIcon, PlusIcon } from '@heroicons/react/24/outline';
import { InternalServerError } from '@shared/types/errors';
import React, { useEffect, useState } from 'react';
import { useProjectActions, useProjects } from '../../stores/project.store';
import { ErrorAlert } from '../common/ErrorAlert';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { Pagination } from '../common/Pagination';
import { CreateProjectModal } from './CreateProjectModal';
import { ProjectCard } from './ProjectCard';
import { ProjectFilters } from './ProjectFilters';

export const ProjectDashboard: React.FC = () => {
  const { projects, pagination, filters, loading, error } = useProjects();
  const { loadProjects, setFilters, clearError } = useProjectActions();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState(filters.search || '');

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters({ ...filters, search: searchQuery });
    loadProjects({ page: 1, limit: pagination.limit });
  };

  const handleFilterChange = (newFilters: Partial<typeof filters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    loadProjects({ page: 1, limit: pagination.limit });
  };

  const handlePageChange = (page: number) => {
    loadProjects({ page, limit: pagination.limit });
  };

  const handleProjectCreated = () => {
    setShowCreateModal(false);
    loadProjects({ page: 1, limit: pagination.limit });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your specification projects and collaborate with your team
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
            New Project
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <form onSubmit={handleSearch} className="flex-1">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search projects..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </form>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <FunnelIcon className="-ml-1 mr-2 h-5 w-5" />
          Filters
        </button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <ProjectFilters
          filters={filters}
          onFiltersChange={handleFilterChange}
          onClose={() => setShowFilters(false)}
        />
      )}

      {/* Error Alert */}
      {error && <ErrorAlert error={new InternalServerError(error)} onDismiss={clearError} />}

      {/* Loading State */}
      {loading && projects.length === 0 && (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {/* Empty State */}
      {!loading && projects.length === 0 && !error && (
        <div className="text-center py-12">
          <div className="mx-auto h-12 w-12 text-gray-400">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No projects</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by creating your first specification project.
          </p>
          <div className="mt-6">
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
              New Project
            </button>
          </div>
        </div>
      )}

      {/* Projects Grid */}
      {projects.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map(project => (
              <ProjectCard key={project.id} project={project} />
            ))}
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
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <CreateProjectModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleProjectCreated}
        />
      )}
    </div>
  );
};
