import React from 'react';
import { ChevronRightIcon, HomeIcon } from '@heroicons/react/24/outline';
import { SpecificationPhase } from '../../types/project';
import { cn } from '../../utils/cn';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
  current?: boolean;
}

export interface BreadcrumbNavigationProps {
  projectName: string;
  currentPhase: SpecificationPhase;
  onNavigateToProject?: () => void;
  onNavigateToPhase?: (phase: SpecificationPhase) => void;
  className?: string;
}

export const BreadcrumbNavigation: React.FC<BreadcrumbNavigationProps> = ({
  projectName,
  currentPhase,
  onNavigateToProject,
  onNavigateToPhase,
  className,
}) => {
  const phases = [
    { id: SpecificationPhase.REQUIREMENTS, label: 'Requirements' },
    { id: SpecificationPhase.DESIGN, label: 'Design' },
    { id: SpecificationPhase.TASKS, label: 'Tasks' },
    { id: SpecificationPhase.IMPLEMENTATION, label: 'Implementation' },
  ];

  const currentPhaseIndex = phases.findIndex(p => p.id === currentPhase);
  const accessiblePhases = phases.slice(0, currentPhaseIndex + 1);

  const breadcrumbItems: BreadcrumbItem[] = [
    {
      label: 'Projects',
      onClick: onNavigateToProject,
    },
    {
      label: projectName,
      onClick: onNavigateToProject,
    },
    ...accessiblePhases.map((phase, index) => ({
      label: phase.label,
      onClick: () => onNavigateToPhase?.(phase.id),
      current: phase.id === currentPhase,
    })),
  ];

  return (
    <nav className={cn('flex', className)} aria-label="Breadcrumb">
      <ol className="flex items-center space-x-2">
        <li>
          <div>
            <button
              onClick={onNavigateToProject}
              className="text-gray-400 hover:text-gray-500"
            >
              <HomeIcon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
              <span className="sr-only">Home</span>
            </button>
          </div>
        </li>
        
        {breadcrumbItems.map((item, index) => (
          <li key={index}>
            <div className="flex items-center">
              <ChevronRightIcon
                className="h-5 w-5 flex-shrink-0 text-gray-400"
                aria-hidden="true"
              />
              {item.current ? (
                <span
                  className="ml-2 text-sm font-medium text-gray-500"
                  aria-current="page"
                >
                  {item.label}
                </span>
              ) : (
                <button
                  onClick={item.onClick}
                  className="ml-2 text-sm font-medium text-gray-500 hover:text-gray-700"
                >
                  {item.label}
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>
    </nav>
  );
};