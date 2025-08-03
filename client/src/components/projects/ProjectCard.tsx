// @ts-nocheck
import React from 'react';
import { 
  EllipsisVerticalIcon, 
  UserGroupIcon, 
  DocumentTextIcon,
  CalendarIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import { Project, SpecificationPhase, ProjectStatus } from '../../types/project';
import { formatDistanceToNow } from 'date-fns';

interface ProjectCardProps {
  project: Project;
  onEdit?: (project: Project) => void;
  onDelete?: (project: Project) => void;
  onView?: (project: Project) => void;
}

const phaseColors = {
  [SpecificationPhase.REQUIREMENTS]: 'bg-blue-100 text-blue-800',
  [SpecificationPhase.DESIGN]: 'bg-purple-100 text-purple-800',
  [SpecificationPhase.TASKS]: 'bg-yellow-100 text-yellow-800',
  [SpecificationPhase.IMPLEMENTATION]: 'bg-green-100 text-green-800',
};

const statusColors = {
  [ProjectStatus.ACTIVE]: 'bg-green-100 text-green-800',
  [ProjectStatus.COMPLETED]: 'bg-blue-100 text-blue-800',
  [ProjectStatus.ARCHIVED]: 'bg-gray-100 text-gray-800',
  [ProjectStatus.SUSPENDED]: 'bg-red-100 text-red-800',
};

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onEdit,
  onDelete,
  onView,
}) => {
  const handleCardClick = () => {
    if (onView) {
      onView(project);
    }
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // TODO: Implement dropdown menu
  };

  return (
    <div
      className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow cursor-pointer"
      onClick={handleCardClick}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-medium text-gray-900 truncate">
              {project.name}
            </h3>
            {project.description && (
              <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                {project.description}
              </p>
            )}
          </div>
          <button
            onClick={handleMenuClick}
            className="ml-2 flex-shrink-0 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <EllipsisVerticalIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Status and Phase */}
        <div className="mt-4 flex items-center space-x-2">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              statusColors[project.status]
            }`}
          >
            {project.status}
          </span>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              phaseColors[project.currentPhase]
            }`}
          >
            {project.currentPhase}
          </span>
        </div>

        {/* Stats */}
        <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <UserGroupIcon className="h-4 w-4 mr-1" />
              <span>{project._count.team + 1}</span> {/* +1 for owner */}
            </div>
            <div className="flex items-center">
              <DocumentTextIcon className="h-4 w-4 mr-1" />
              <span>{project._count.documents}</span>
            </div>
          </div>
          <div className="flex items-center">
            <CalendarIcon className="h-4 w-4 mr-1" />
            <span>{formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}</span>
          </div>
        </div>

        {/* Team Members Preview */}
        {project.team.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center">
              <div className="flex -space-x-2">
                {/* Owner */}
                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-xs font-medium text-white border-2 border-white">
                  {project.owner.name.charAt(0).toUpperCase()}
                </div>
                
                {/* Team members (show up to 3) */}
                {project.team.slice(0, 3).map((member) => (
                  <div
                    key={member.id}
                    className="w-6 h-6 rounded-full bg-gray-500 flex items-center justify-center text-xs font-medium text-white border-2 border-white"
                    title={member.user.name}
                  >
                    {member.user.name.charAt(0).toUpperCase()}
                  </div>
                ))}
                
                {/* Show more indicator */}
                {project.team.length > 3 && (
                  <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs font-medium text-gray-600 border-2 border-white">
                    +{project.team.length - 3}
                  </div>
                )}
              </div>
              
              <span className="ml-2 text-xs text-gray-500">
                {project.team.length === 1 ? '1 member' : `${project.team.length} members`}
              </span>
            </div>
          </div>
        )}

        {/* Progress Indicator */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Progress</span>
            <span>{getPhaseProgress(project.currentPhase)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${getPhaseProgress(project.currentPhase)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-50 px-6 py-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            Created by {project.owner.name}
          </span>
          <ChevronRightIcon className="h-4 w-4 text-gray-400" />
        </div>
      </div>
    </div>
  );
};

function getPhaseProgress(phase: SpecificationPhase): number {
  switch (phase) {
    case SpecificationPhase.REQUIREMENTS:
      return 25;
    case SpecificationPhase.DESIGN:
      return 50;
    case SpecificationPhase.TASKS:
      return 75;
    case SpecificationPhase.IMPLEMENTATION:
      return 100;
    default:
      return 0;
  }
}