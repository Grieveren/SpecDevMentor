import React, { useState, useEffect } from 'react';
import {
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowRightIcon,
  UserGroupIcon,
  DocumentTextIcon,
  PencilSquareIcon,
  ListBulletIcon,
  CodeBracketIcon,
} from '@heroicons/react/24/outline';
import { SpecificationPhase, DocumentStatus } from '../../types/project';
import { workflowService, PhaseValidationResult, WorkflowNavigationState } from '../../services/workflow.service';
import { cn } from '../../utils/cn';

export interface WorkflowNavigationProps {
  projectId: string;
  currentPhase: SpecificationPhase;
  documentStatuses: Record<SpecificationPhase, DocumentStatus>;
  onPhaseChange?: (phase: SpecificationPhase) => void;
  onRequestApproval?: (phase: SpecificationPhase) => void;
  onTransitionPhase?: (targetPhase: SpecificationPhase) => void;
  className?: string;
}

export const WorkflowNavigation: React.FC<WorkflowNavigationProps> = ({
  projectId,
  currentPhase,
  documentStatuses,
  onPhaseChange,
  onRequestApproval,
  onTransitionPhase,
  className,
}) => {
  const [navigationState, setNavigationState] = useState<WorkflowNavigationState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const phases = [
    {
      id: SpecificationPhase.REQUIREMENTS,
      name: 'Requirements',
      icon: DocumentTextIcon,
      description: workflowService.getPhaseDescription(SpecificationPhase.REQUIREMENTS),
    },
    {
      id: SpecificationPhase.DESIGN,
      name: 'Design',
      icon: PencilSquareIcon,
      description: workflowService.getPhaseDescription(SpecificationPhase.DESIGN),
    },
    {
      id: SpecificationPhase.TASKS,
      name: 'Tasks',
      icon: ListBulletIcon,
      description: workflowService.getPhaseDescription(SpecificationPhase.TASKS),
    },
    {
      id: SpecificationPhase.IMPLEMENTATION,
      name: 'Implementation',
      icon: CodeBracketIcon,
      description: workflowService.getPhaseDescription(SpecificationPhase.IMPLEMENTATION),
    },
  ];

  useEffect(() => {
    loadNavigationState();
  }, [projectId, currentPhase, documentStatuses]);

  const loadNavigationState = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Validate all phases
      const phaseValidations: Record<SpecificationPhase, PhaseValidationResult> = {} as any;
      
      for (const phase of Object.values(SpecificationPhase)) {
        try {
          phaseValidations[phase] = await workflowService.validatePhaseCompletion(projectId, phase);
        } catch (err) {
          // // // console.warn(`Failed to validate phase ${phase}:`, err);
          phaseValidations[phase] = {
            isValid: false,
            errors: ['Validation failed'],
            warnings: [],
            completionPercentage: 0,
            canTransition: false,
          };
        }
      }

      const navState = workflowService.getNavigationState(
        currentPhase,
        documentStatuses,
        phaseValidations
      );

      setNavigationState(navState);
    } catch (err) {
      console.error('Failed to load navigation state:', err);
      setError('Failed to load workflow navigation');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhaseClick = (phase: SpecificationPhase) => {
    if (!navigationState) return;
    
    const isAccessible = navigationState.accessiblePhases.includes(phase);
    if (isAccessible && onPhaseChange) {
      onPhaseChange(phase);
    }
  };

  const handleRequestApproval = async (phase: SpecificationPhase) => {
    try {
      setError(null);
      await workflowService.requestApproval({
        projectId,
        phase,
        comment: `Requesting approval for ${workflowService.getPhaseDisplayName(phase)} phase`,
      });
      
      if (onRequestApproval) {
        onRequestApproval(phase);
      }
      
      // Reload navigation state to reflect approval request
      await loadNavigationState();
    } catch (err) {
      console.error('Failed to request approval:', err);
      setError(err instanceof Error ? err.message : 'Failed to request approval');
    }
  };

  const handleTransitionPhase = async (targetPhase: SpecificationPhase) => {
    try {
      setError(null);
      await workflowService.transitionPhase({
        projectId,
        targetPhase,
        approvalComment: `Transitioning to ${workflowService.getPhaseDisplayName(targetPhase)} phase`,
      });
      
      if (onTransitionPhase) {
        onTransitionPhase(targetPhase);
      }
      
      // Reload navigation state to reflect phase transition
      await loadNavigationState();
    } catch (err) {
      console.error('Failed to transition phase:', err);
      setError(err instanceof Error ? err.message : 'Failed to transition phase');
    }
  };

  const getPhaseIcon = (phase: SpecificationPhase) => {
    if (!navigationState) return <ClockIcon className="h-5 w-5 text-gray-400" />;
    
    const validation = navigationState.phaseValidations[phase];
    const status = documentStatuses[phase];
    
    if (status === DocumentStatus.APPROVED) {
      return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
    }
    
    if (validation?.errors.length > 0) {
      return <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />;
    }
    
    if (validation?.completionPercentage > 0) {
      return <ClockIcon className="h-5 w-5 text-blue-500" />;
    }
    
    return <ClockIcon className="h-5 w-5 text-gray-400" />;
  };

  const getPhaseStatusText = (phase: SpecificationPhase) => {
    if (!navigationState) return 'Loading...';
    
    const validation = navigationState.phaseValidations[phase];
    const status = documentStatuses[phase];
    
    if (status === DocumentStatus.APPROVED) {
      return 'Approved';
    }
    
    if (status === DocumentStatus.REVIEW) {
      return 'Under Review';
    }
    
    if (validation?.errors.length > 0) {
      return 'Validation Failed';
    }
    
    if (validation?.completionPercentage === 0) {
      return 'Not Started';
    }
    
    if (validation?.completionPercentage < 100) {
      return `${validation.completionPercentage}% Complete`;
    }
    
    return 'Ready for Review';
  };

  const getPhaseStatusColor = (phase: SpecificationPhase) => {
    if (!navigationState) return 'text-gray-500 bg-gray-50';
    
    const validation = navigationState.phaseValidations[phase];
    const status = documentStatuses[phase];
    
    if (status === DocumentStatus.APPROVED) {
      return 'text-green-600 bg-green-50 border-green-200';
    }
    
    if (status === DocumentStatus.REVIEW) {
      return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    }
    
    if (validation?.errors.length > 0) {
      return 'text-red-600 bg-red-50 border-red-200';
    }
    
    if (validation?.completionPercentage === 0) {
      return 'text-gray-500 bg-gray-50 border-gray-200';
    }
    
    return 'text-blue-600 bg-blue-50 border-blue-200';
  };

  if (isLoading) {
    return (
      <div className={cn('bg-white rounded-lg border border-gray-200 shadow-sm p-6', className)}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('bg-white rounded-lg border border-red-200 shadow-sm p-6', className)}>
        <div className="text-center">
          <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Navigation Error</h3>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <button
            onClick={loadNavigationState}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!navigationState) {
    return null;
  }

  return (
    <div className={cn('bg-white rounded-lg border border-gray-200 shadow-sm', className)}>
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Workflow Navigation</h3>
        <p className="text-sm text-gray-500 mt-1">
          Navigate through specification phases
        </p>
      </div>

      <div className="p-4">
        {/* Phase Progress Indicator */}
        <div className="flex items-center justify-between mb-6 px-2">
          {phases.map((phase, index) => {
            const isActive = phase.id === currentPhase;
            const isCompleted = navigationState.completedPhases.includes(phase.id);
            const isAccessible = navigationState.accessiblePhases.includes(phase.id);

            return (
              <React.Fragment key={phase.id}>
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors',
                      isActive && 'bg-blue-500 text-white border-blue-500',
                      isCompleted && !isActive && 'bg-green-500 text-white border-green-500',
                      !isActive && !isCompleted && isAccessible && 'bg-white text-gray-600 border-gray-300 hover:border-blue-300',
                      !isAccessible && 'bg-gray-100 text-gray-400 border-gray-200'
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircleIcon className="h-5 w-5" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <span className={cn(
                    'text-xs mt-2 text-center max-w-16',
                    isActive && 'text-blue-600 font-medium',
                    !isActive && 'text-gray-500'
                  )}>
                    {phase.name}
                  </span>
                </div>
                {index < phases.length - 1 && (
                  <div className={cn(
                    'flex-1 h-0.5 mx-3',
                    isCompleted ? 'bg-green-500' : 'bg-gray-200'
                  )} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Phase Details */}
        <div className="space-y-3">
          {phases.map((phase) => {
            const isActive = phase.id === currentPhase;
            const isAccessible = navigationState.accessiblePhases.includes(phase.id);
            const validation = navigationState.phaseValidations[phase.id];
            const statusColor = getPhaseStatusColor(phase.id);

            return (
              <div
                key={phase.id}
                className={cn(
                  'relative flex items-start p-4 rounded-lg border transition-colors',
                  isActive && 'border-blue-200 bg-blue-50',
                  !isActive && 'border-gray-200 hover:border-gray-300',
                  !isAccessible && 'opacity-50'
                )}
              >
                {/* Phase icon */}
                <div className="flex-shrink-0 mr-4">
                  {getPhaseIcon(phase.id)}
                </div>

                {/* Phase content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => handlePhaseClick(phase.id)}
                      disabled={!isAccessible}
                      className={cn(
                        'text-left',
                        isAccessible && 'hover:text-blue-600',
                        !isAccessible && 'cursor-not-allowed'
                      )}
                    >
                      <h4 className="text-sm font-medium text-gray-900">
                        {phase.name}
                      </h4>
                      <p className="text-xs text-gray-500 mt-1">
                        {phase.description}
                      </p>
                    </button>

                    <div className="flex items-center space-x-2">
                      <span className={cn(
                        'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border',
                        statusColor
                      )}>
                        {getPhaseStatusText(phase.id)}
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  {validation && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                        <span>Completion</span>
                        <span>{validation.completionPercentage}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={cn(
                            'h-2 rounded-full transition-all duration-300',
                            documentStatuses[phase.id] === DocumentStatus.APPROVED ? 'bg-green-500' :
                            validation.completionPercentage > 0 ? 'bg-blue-500' : 'bg-gray-300'
                          )}
                          style={{ width: `${validation.completionPercentage}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Validation errors */}
                  {validation?.errors.length > 0 && (
                    <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded">
                      <p className="text-xs font-medium text-red-800 mb-1">Issues:</p>
                      <ul className="text-xs text-red-700 space-y-1">
                        {validation.errors.slice(0, 2).map((error, idx) => (
                          <li key={idx}>• {error}</li>
                        ))}
                        {validation.errors.length > 2 && (
                          <li>• And {validation.errors.length - 2} more...</li>
                        )}
                      </ul>
                    </div>
                  )}

                  {/* Actions */}
                  {phase.id === currentPhase && validation && (
                    <div className="mt-3 flex items-center space-x-2">
                      {validation.completionPercentage === 100 && 
                       documentStatuses[phase.id] === DocumentStatus.DRAFT && (
                        <button
                          onClick={() => handleRequestApproval(phase.id)}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200"
                        >
                          <UserGroupIcon className="h-3 w-3 mr-1" />
                          Request Approval
                        </button>
                      )}

                      {validation.canTransition && 
                       documentStatuses[phase.id] === DocumentStatus.APPROVED &&
                       navigationState.nextPhase && (
                        <button
                          onClick={() => handleTransitionPhase(navigationState.nextPhase!)}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-green-700 bg-green-100 hover:bg-green-200"
                        >
                          <ArrowRightIcon className="h-3 w-3 mr-1" />
                          Proceed to {workflowService.getPhaseDisplayName(navigationState.nextPhase)}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};