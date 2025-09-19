import React, { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useProjectActions } from '../../stores/project.store';
import { CreateProjectRequest } from '../../types/project';
import { LoadingSpinner } from '../common/LoadingSpinner';

interface CreateProjectModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  onClose,
  onSuccess,
}) => {
  const { createProject } = useProjectActions();
  
  const [formData, setFormData] = useState<CreateProjectRequest>({
    name: '',
    description: '',
    teamMemberIds: [],
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Project name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await createProject({
        name: formData.name.trim(),
        description: formData.description?.trim() || undefined,
        teamMemberIds: formData.teamMemberIds?.length ? formData.teamMemberIds : undefined,
      });
      
      onSuccess();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create project';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  function handleInputChange<K extends keyof CreateProjectRequest>(
    field: K,
    value: CreateProjectRequest[K]
  ) {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (error) setError(null);
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
          <div className="absolute top-0 right-0 pt-4 pr-4">
            <button
              type="button"
              className="bg-white rounded-md text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              onClick={onClose}
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="sm:flex sm:items-start">
            <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Create New Project
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Project Name */}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Enter project name"
                    maxLength={100}
                    required
                  />
                </div>

                {/* Project Description */}
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <textarea
                    id="description"
                    rows={3}
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Describe your project (optional)"
                    maxLength={500}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {formData.description?.length || 0}/500 characters
                  </p>
                </div>

                {/* Team Members - TODO: Implement user search/selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Team Members
                  </label>
                  <p className="mt-1 text-sm text-gray-500">
                    You can add team members after creating the project.
                  </p>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="rounded-md bg-red-50 p-4">
                    <div className="text-sm text-red-700">{error}</div>
                  </div>
                )}

                {/* Form Actions */}
                <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                  <button
                    type="submit"
                    disabled={loading || !formData.name.trim()}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:col-start-2 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <LoadingSpinner size="sm" className="mr-2" />
                        Creating...
                      </>
                    ) : (
                      'Create Project'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={loading}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:col-start-1 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};