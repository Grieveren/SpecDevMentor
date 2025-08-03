// @ts-nocheck
import React, { useState } from 'react';
import {
  Bars3Icon,
  XMarkIcon,
  DocumentTextIcon,
  PencilSquareIcon,
  ListBulletIcon,
  CodeBracketIcon,
} from '@heroicons/react/24/outline';
import { SpecificationPhase, DocumentStatus } from '../../types/project';
import { WorkflowNavigation } from './WorkflowNavigation';
import { BreadcrumbNavigation } from './BreadcrumbNavigation';
import { cn } from '../../utils/cn';

export interface SpecificationProject {
  id: string;
  name: string;
  description?: string;
  currentPhase: SpecificationPhase;
  phases: {
    requirements: { status: DocumentStatus; completionPercentage: number };
    design: { status: DocumentStatus; completionPercentage: number };
    tasks: { status: DocumentStatus; completionPercentage: number };
    implementation: { status: DocumentStatus; completionPercentage: number };
  };
}

export interface SpecificationLayoutProps {
  currentPhase: SpecificationPhase;
  onPhaseChange?: (phase: SpecificationPhase) => void;
  onRequestApproval?: (phase: SpecificationPhase) => void;
  onTransitionPhase?: (targetPhase: SpecificationPhase) => void;
  onNavigateToProject?: () => void;
  project?: SpecificationProject;
  showSidebar?: boolean;
  sidebarCollapsed?: boolean;
  children: React.ReactNode;
}

export const SpecificationLayout: React.FC<SpecificationLayoutProps> = ({
  currentPhase,
  onPhaseChange,
  onRequestApproval,
  onTransitionPhase,
  onNavigateToProject,
  project,
  showSidebar = true,
  sidebarCollapsed: initialCollapsed = false,
  children,
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(initialCollapsed);

  const phases = [
    {
      id: SpecificationPhase.REQUIREMENTS,
      name: 'Requirements',
      icon: DocumentTextIcon,
      description: 'Define project scope and user needs',
    },
    {
      id: SpecificationPhase.DESIGN,
      name: 'Design',
      icon: PencilSquareIcon,
      description: 'Create technical architecture and UI/UX designs',
    },
    {
      id: SpecificationPhase.TASKS,
      name: 'Tasks',
      icon: ListBulletIcon,
      description: 'Break down implementation into actionable items',
    },
    {
      id: SpecificationPhase.IMPLEMENTATION,
      name: 'Implementation',
      icon: CodeBracketIcon,
      description: 'Execute development work',
    },
  ];

  // Convert project phases to document statuses format
  const getDocumentStatuses = (): Record<SpecificationPhase, DocumentStatus> => {
    if (!project) {
      return {
        [SpecificationPhase.REQUIREMENTS]: DocumentStatus.DRAFT,
        [SpecificationPhase.DESIGN]: DocumentStatus.DRAFT,
        [SpecificationPhase.TASKS]: DocumentStatus.DRAFT,
        [SpecificationPhase.IMPLEMENTATION]: DocumentStatus.DRAFT,
      };
    }

    return {
      [SpecificationPhase.REQUIREMENTS]: project.phases.requirements.status,
      [SpecificationPhase.DESIGN]: project.phases.design.status,
      [SpecificationPhase.TASKS]: project.phases.tasks.status,
      [SpecificationPhase.IMPLEMENTATION]: project.phases.implementation.status,
    };
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      {showSidebar && (
        <div className={cn(
          'bg-white border-r border-gray-200 transition-all duration-300',
          sidebarCollapsed ? 'w-16' : 'w-80'
        )}>
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            {!sidebarCollapsed && (
              <div className="flex-1">
                <h1 className="text-lg font-semibold text-gray-900">
                  {project?.name || 'Specification'}
                </h1>
                {project?.description && (
                  <p className="text-sm text-gray-500 mt-1">{project.description}</p>
                )}
              </div>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1 rounded hover:bg-gray-100"
            >
              {sidebarCollapsed ? (
                <Bars3Icon className="h-5 w-5 text-gray-500" />
              ) : (
                <XMarkIcon className="h-5 w-5 text-gray-500" />
              )}
            </button>
          </div>

          {/* Workflow Navigation */}
          {!sidebarCollapsed && project && (
            <div className="flex-1 overflow-auto">
              <WorkflowNavigation
                projectId={project.id}
                currentPhase={currentPhase}
                documentStatuses={getDocumentStatuses()}
                onPhaseChange={onPhaseChange}
                onRequestApproval={onRequestApproval}
                onTransitionPhase={onTransitionPhase}
                className="border-0 shadow-none"
              />
            </div>
          )}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex flex-col space-y-4">
            {/* Breadcrumb Navigation */}
            {project && (
              <BreadcrumbNavigation
                projectName={project.name}
                currentPhase={currentPhase}
                onNavigateToProject={onNavigateToProject}
                onNavigateToPhase={onPhaseChange}
              />
            )}
            
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {phases.find(p => p.id === currentPhase)?.name || 'Specification'}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {phases.find(p => p.id === currentPhase)?.description}
                </p>
              </div>
              
              {project && (
                <div className="flex items-center space-x-4">
                  <div className="text-sm text-gray-500">
                    Current Phase: <span className="font-medium text-gray-900">
                      {project.currentPhase.charAt(0) + project.currentPhase.slice(1).toLowerCase()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};