import React from 'react';
import {
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import { SpecificationPhase, DocumentStatus } from '../../types/project';
import { cn } from '../../utils/cn';

export interface PhaseProgress {
  phase: SpecificationPhase;
  status: DocumentStatus;
  completionPercentage: number;
  canTransition: boolean;
  validationErrors: string[];
  approvals: {
    required: number;
    received: number;
    users: Array<{ id: string; name: string; approved: boolean }>;
  };
}

export interface WorkflowProgressProps {
  phases: PhaseProgress[];
  currentPhase: SpecificationPhase;
  onPhaseSelect?: (phase: SpecificationPhase) => void;
  onRequestApproval?: (phase: SpecificationPhase) => void;
  className?: string;
}

export const WorkflowProgress: React.FC<WorkflowProgressProps> = ({
  phases,
  currentPhase,
  onPhaseSelect,
  onRequestApproval,
  className,
}) => {
  const getPhaseIcon = (phase: PhaseProgress) => {
    if (phase.status === DocumentStatus.APPROVED) {
      return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
    }
    if (phase.status === DocumentStatus.REVIEW) {
      return <EyeIcon className="h-5 w-5 text-yellow-500" />;
    }
    if (phase.validationErrors.length > 0) {
      return <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />;
    }
    return <ClockIcon className="h-5 w-5 text-gray-400" />;
  };

  const getPhaseStatusText = (phase: PhaseProgress) => {
    if (phase.status === DocumentStatus.APPROVED) {
      return 'Approved';
    }
    if (phase.status === DocumentStatus.REVIEW) {
      return 'Under Review';
    }
    if (phase.validationErrors.length > 0) {
      return 'Validation Failed';
    }
    if (phase.completionPercentage === 0) {
      return 'Not Started';
    }
    if (phase.completionPercentage < 100) {
      return 'In Progress';
    }
    return 'Ready for Review';
  };

  const getPhaseStatusColor = (phase: PhaseProgress) => {
    if (phase.status === DocumentStatus.APPROVED) {
      return 'text-green-600 bg-green-50';
    }
    if (phase.status === DocumentStatus.REVIEW) {
      return 'text-yellow-600 bg-yellow-50';
    }
    if (phase.validationErrors.length > 0) {
      return 'text-red-600 bg-red-50';
    }
    if (phase.completionPercentage === 0) {
      return 'text-gray-500 bg-gray-50';
    }
    return 'text-blue-600 bg-blue-50';
  };

  const isPhaseAccessible = (phase: PhaseProgress) => {
    const phaseOrder = [
      SpecificationPhase.REQUIREMENTS,
      SpecificationPhase.DESIGN,
      SpecificationPhase.TASKS,
      SpecificationPhase.IMPLEMENTATION,
    ];
    
    const currentIndex = phaseOrder.indexOf(currentPhase);
    const targetIndex = phaseOrder.indexOf(phase.phase);
    
    // Can access current phase and previous phases, or next phase if current is approved
    return targetIndex <= currentIndex || 
           (targetIndex === currentIndex + 1 && phases[currentIndex]?.status === DocumentStatus.APPROVED);
  };

  return (
    <div className={cn('bg-white rounded-lg border border-gray-200 shadow-sm', className)}>
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Workflow Progress</h3>
        <p className="text-sm text-gray-500 mt-1">
          Track your specification development progress
        </p>
      </div>

      <div className="p-4">
        <div className="space-y-4">
          {phases.map((phase, index) => {
            const isActive = phase.phase === currentPhase;
            const isAccessible = isPhaseAccessible(phase);
            const statusColor = getPhaseStatusColor(phase);

            return (
              <div
                key={phase.phase}
                className={cn(
                  'relative flex items-start p-4 rounded-lg border transition-colors',
                  isActive && 'border-blue-200 bg-blue-50',
                  !isActive && 'border-gray-200 hover:border-gray-300',
                  !isAccessible && 'opacity-50'
                )}
              >
                {/* Connection line */}
                {index < phases.length - 1 && (
                  <div className="absolute left-8 top-12 w-0.5 h-8 bg-gray-200" />
                )}

                {/* Phase icon */}
                <div className="flex-shrink-0 mr-4">
                  {getPhaseIcon(phase)}
                </div>

                {/* Phase content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => isAccessible && onPhaseSelect?.(phase.phase)}
                      disabled={!isAccessible}
                      className={cn(
                        'text-left',
                        isAccessible && 'hover:text-blue-600',
                        !isAccessible && 'cursor-not-allowed'
                      )}
                    >
                      <h4 className="text-sm font-medium text-gray-900">
                        {phase.phase.charAt(0) + phase.phase.slice(1).toLowerCase()}
                      </h4>
                    </button>

                    <div className="flex items-center space-x-2">
                      <span className={cn(
                        'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                        statusColor
                      )}>
                        {getPhaseStatusText(phase)}
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>Completion</span>
                      <span>{phase.completionPercentage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={cn(
                          'h-2 rounded-full transition-all duration-300',
                          phase.status === DocumentStatus.APPROVED ? 'bg-green-500' :
                          phase.completionPercentage > 0 ? 'bg-blue-500' : 'bg-gray-300'
                        )}
                        style={{ width: `${phase.completionPercentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Validation errors */}
                  {phase.validationErrors.length > 0 && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                      <p className="text-xs font-medium text-red-800 mb-1">Validation Issues:</p>
                      <ul className="text-xs text-red-700 space-y-1">
                        {phase.validationErrors.slice(0, 3).map((error, idx) => (
                          <li key={idx}>• {error}</li>
                        ))}
                        {phase.validationErrors.length > 3 && (
                          <li>• And {phase.validationErrors.length - 3} more...</li>
                        )}
                      </ul>
                    </div>
                  )}

                  {/* Approvals */}
                  {phase.approvals.required > 0 && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                        <span>Approvals</span>
                        <span>{phase.approvals.received}/{phase.approvals.required}</span>
                      </div>
                      
                      <div className="flex items-center space-x-1">
                        {phase.approvals.users.map((user) => (
                          <div
                            key={user.id}
                            className={cn(
                              'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium',
                              user.approved 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-600'
                            )}
                            title={`${user.name} - ${user.approved ? 'Approved' : 'Pending'}`}
                          >
                            {user.approved ? '✓' : user.name.charAt(0).toUpperCase()}
                          </div>
                        ))}
                      </div>

                      {phase.approvals.received < phase.approvals.required && 
                       phase.completionPercentage === 100 && 
                       onRequestApproval && (
                        <button
                          onClick={() => onRequestApproval(phase.phase)}
                          className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Request Approval
                        </button>
                      )}
                    </div>
                  )}

                  {/* Transition indicator */}
                  {phase.canTransition && phase.phase === currentPhase && (
                    <div className="mt-2 flex items-center text-xs text-green-600">
                      <CheckCircleIcon className="h-3 w-3 mr-1" />
                      <span>Ready to proceed to next phase</span>
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