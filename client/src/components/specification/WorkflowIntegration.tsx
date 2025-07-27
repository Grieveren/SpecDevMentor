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
  SparklesIcon,
  CpuChipIcon,
} from '@heroicons/react/24/outline';
import { SpecificationPhase, DocumentStatus } from '../../types/project';
import { workflowService, PhaseValidationResult, WorkflowNavigationState, AIValidationResult } from '../../services/workflow.service';
import { WorkflowProgress, PhaseProgress } from './WorkflowProgress';
import { WorkflowStateDisplay, WorkflowState } from './WorkflowStateDisplay';
import { cn } from '../../utils/cn';

export interface WorkflowIntegrationProps {
  projectId: string;
  currentPhase: SpecificationPhase;
  documentStatuses: Record<SpecificationPhase, DocumentStatus>;
  onPhaseChange?: (phase: SpecificationPhase) => void;
  onRequestApproval?: (phase: SpecificationPhase) => void;
  onTransitionPhase?: (targetPhase: SpecificationPhase) => void;
  showProgress?: boolean;
  showState?: boolean;
  showNavigation?: boolean;
  className?: string;
}

export const WorkflowIntegration: React.FC<WorkflowIntegrationProps> = ({
  projectId,
  currentPhase,
  documentStatuses,
  onPhaseChange,
  onRequestApproval,
  onTransitionPhase,
  showProgress = true,
  showState = true,
  showNavigation = true,
  className,
}) => {
  const [workflowState, setWorkflowState] = useState<WorkflowState | null>(null);
  const [phaseProgress, setPhaseProgress] = useState<PhaseProgress[]>([]);
  const [navigationState, setNavigationState] = useState<WorkflowNavigationState | null>(null);
  const [aiServiceStatus, setAiServiceStatus] = useState<any>(null);
  const [aiValidations, setAiValidations] = useState<Record<SpecificationPhase, AIValidationResult>>({} as any);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    loadWorkflowData();
  }, [projectId, currentPhase, documentStatuses]);

  const loadWorkflowData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load AI service status
      const aiStatus = await workflowService.getAIServiceStatus();
      setAiServiceStatus(aiStatus);

      // Load workflow state
      const state = await workflowService.getWorkflowState(projectId);
      setWorkflowState(state);

      // Validate all phases and build progress data
      const phaseValidations: Record<SpecificationPhase, PhaseValidationResult> = {} as any;
      const progressData: PhaseProgress[] = [];
      const aiValidationResults: Record<SpecificationPhase, AIValidationResult> = {} as any;

      for (const phase of Object.values(SpecificationPhase)) {
        try {
          // Get standard validation
          const validation = await workflowService.validatePhaseCompletion(projectId, phase);
          phaseValidations[phase] = validation;

          // Get AI validation if available
          if (aiStatus.available) {
            const aiValidation = await workflowService.getAIValidation(projectId, phase);
            aiValidationResults[phase] = aiValidation;
          }

          // Build phase progress data
          const phaseApprovals = state.approvals[phase] || [];
          progressData.push({
            phase,
            status: documentStatuses[phase],
            completionPercentage: validation.completionPercentage,
            canTransition: validation.canTransition,
            validationErrors: validation.errors,
            approvals: {
              required: getRequiredApprovals(phase),
              received: phaseApprovals.filter(a => a.approved).length,
              users: phaseApprovals.map(approval => ({
                id: approval.userId,
                name: approval.userName || 'Unknown User',
                approved: approval.approved,
              })),
            },
          });
        } catch (err) {
          console.warn(`Failed to validate phase ${phase}:`, err);
          phaseValidations[phase] = {
            isValid: false,
            errors: ['Validation failed'],
            warnings: [],
            completionPercentage: 0,
            canTransition: false,
          };

          progressData.push({
            phase,
            status: documentStatuses[phase],
            completionPercentage: 0,
            canTransition: false,
            validationErrors: ['Validation failed'],
            approvals: {
              required: getRequiredApprovals(phase),
              received: 0,
              users: [],
            },
          });
        }
      }

      setPhaseProgress(progressData);
      setAiValidations(aiValidationResults);

      // Build navigation state
      const navState = workflowService.getNavigationState(
        currentPhase,
        documentStatuses,
        phaseValidations
      );
      setNavigationState(navState);

    } catch (err) {
      console.error('Failed to load workflow data:', err);
      setError('Failed to load workflow information');
    } finally {
      setIsLoading(false);
    }
  };

  const getRequiredApprovals = (phase: SpecificationPhase): number => {
    // Based on validation rules from the service
    switch (phase) {
      case SpecificationPhase.REQUIREMENTS:
      case SpecificationPhase.DESIGN:
      case SpecificationPhase.TASKS:
        return 1;
      case SpecificationPhase.IMPLEMENTATION:
        return 0;
      default:
        return 1;
    }
  };

  const handlePhaseChange = (phase: SpecificationPhase) => {
    if (navigationState?.accessiblePhases.includes(phase)) {
      onPhaseChange?.(phase);
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
      
      onRequestApproval?.(phase);
      
      // Reload workflow data to reflect approval request
      await loadWorkflowData();
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
      
      onTransitionPhase?.(targetPhase);
      
      // Reload workflow data to reflect phase transition
      await loadWorkflowData();
    } catch (err) {
      console.error('Failed to transition phase:', err);
      setError(err instanceof Error ? err.message : 'Failed to transition phase');
    }
  };

  const handleTriggerAIReview = async (phase: SpecificationPhase) => {
    try {
      setError(null);
      const result = await workflowService.triggerAIReview(projectId, phase);
      
      if (result.success) {
        // Reload workflow data to reflect new AI review
        await loadWorkflowData();
      } else {
        setError(result.error || 'Failed to trigger AI review');
      }
    } catch (err) {
      console.error('Failed to trigger AI review:', err);
      setError(err instanceof Error ? err.message : 'Failed to trigger AI review');
    }
  };

  if (isLoading) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-100 rounded"></div>
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
          <h3 className="text-lg font-medium text-gray-900 mb-2">Workflow Error</h3>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <button
            onClick={loadWorkflowData}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Phase Navigation with Progress Indicators */}
      {showNavigation && navigationState && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Phase Navigation</h3>
          
          {/* Horizontal Progress Indicator */}
          <div className="flex items-center justify-between mb-6 px-2">
            {phases.map((phase, index) => {
              const isActive = phase.id === currentPhase;
              const isCompleted = navigationState.completedPhases.includes(phase.id);
              const isAccessible = navigationState.accessiblePhases.includes(phase.id);

              return (
                <React.Fragment key={phase.id}>
                  <div className="flex flex-col items-center">
                    <button
                      onClick={() => handlePhaseChange(phase.id)}
                      disabled={!isAccessible}
                      className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors',
                        isActive && 'bg-blue-500 text-white border-blue-500',
                        isCompleted && !isActive && 'bg-green-500 text-white border-green-500',
                        !isActive && !isCompleted && isAccessible && 'bg-white text-gray-600 border-gray-300 hover:border-blue-300',
                        !isAccessible && 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                      )}
                    >
                      {isCompleted ? (
                        <CheckCircleIcon className="h-5 w-5" />
                      ) : (
                        index + 1
                      )}
                    </button>
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

          {/* Current Phase Actions */}
          {navigationState.phaseValidations[currentPhase] && (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-900">
                  Current Phase: {workflowService.getPhaseDisplayName(currentPhase)}
                </h4>
                <span className="text-sm text-gray-500">
                  {navigationState.phaseValidations[currentPhase].completionPercentage}% Complete
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                <div
                  className={cn(
                    'h-2 rounded-full transition-all duration-300',
                    documentStatuses[currentPhase] === DocumentStatus.APPROVED ? 'bg-green-500' :
                    navigationState.phaseValidations[currentPhase].completionPercentage > 0 ? 'bg-blue-500' : 'bg-gray-300'
                  )}
                  style={{ width: `${navigationState.phaseValidations[currentPhase].completionPercentage}%` }}
                />
              </div>

              {/* Validation errors */}
              {navigationState.phaseValidations[currentPhase].errors.length > 0 && (
                <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded">
                  <p className="text-xs font-medium text-red-800 mb-1">Issues to resolve:</p>
                  <ul className="text-xs text-red-700 space-y-1">
                    {navigationState.phaseValidations[currentPhase].errors.slice(0, 3).map((error, idx) => (
                      <li key={idx}>• {error}</li>
                    ))}
                    {navigationState.phaseValidations[currentPhase].errors.length > 3 && (
                      <li>• And {navigationState.phaseValidations[currentPhase].errors.length - 3} more...</li>
                    )}
                  </ul>
                </div>
              )}

              {/* AI Validation Status */}
              {aiServiceStatus?.available && aiValidations[currentPhase] && (
                <div className="mb-3 p-2 bg-purple-50 border border-purple-200 rounded">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-1">
                      <SparklesIcon className="h-3 w-3 text-purple-600" />
                      <span className="text-xs font-medium text-purple-800">AI Validation</span>
                    </div>
                    {aiValidations[currentPhase].isValid !== undefined && (
                      <span className={cn(
                        'text-xs px-2 py-0.5 rounded-full',
                        aiValidations[currentPhase].isValid 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      )}>
                        {aiValidations[currentPhase].score}% Score
                      </span>
                    )}
                  </div>
                  
                  {aiValidations[currentPhase].issues && aiValidations[currentPhase].issues!.length > 0 && (
                    <div className="text-xs text-purple-700">
                      <p className="font-medium mb-1">AI-detected issues:</p>
                      <ul className="space-y-0.5">
                        {aiValidations[currentPhase].issues!.slice(0, 2).map((issue, idx) => (
                          <li key={idx}>• {issue}</li>
                        ))}
                        {aiValidations[currentPhase].issues!.length > 2 && (
                          <li>• And {aiValidations[currentPhase].issues!.length - 2} more...</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center space-x-2">
                {aiServiceStatus?.available && (
                  <button
                    onClick={() => handleTriggerAIReview(currentPhase)}
                    className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-purple-700 bg-purple-100 hover:bg-purple-200"
                  >
                    <CpuChipIcon className="h-3 w-3 mr-1" />
                    AI Review
                  </button>
                )}

                {navigationState.phaseValidations[currentPhase].completionPercentage === 100 && 
                 documentStatuses[currentPhase] === DocumentStatus.DRAFT && (
                  <button
                    onClick={() => handleRequestApproval(currentPhase)}
                    className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200"
                  >
                    <UserGroupIcon className="h-3 w-3 mr-1" />
                    Request Approval
                  </button>
                )}

                {navigationState.canProgress && 
                 documentStatuses[currentPhase] === DocumentStatus.APPROVED &&
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
            </div>
          )}
        </div>
      )}

      {/* Detailed Progress Tracking */}
      {showProgress && phaseProgress.length > 0 && (
        <WorkflowProgress
          phases={phaseProgress}
          currentPhase={currentPhase}
          onPhaseSelect={handlePhaseChange}
          onRequestApproval={handleRequestApproval}
        />
      )}

      {/* Workflow State Display */}
      {showState && workflowState && (
        <WorkflowStateDisplay
          workflowState={workflowState}
          onTransitionPhase={handleTransitionPhase}
          onRequestApproval={handleRequestApproval}
        />
      )}
    </div>
  );
};