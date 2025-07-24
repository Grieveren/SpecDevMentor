import React from 'react';
import {
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowRightIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { SpecificationPhase, DocumentStatus } from '../../types/project';
import { cn } from '../../utils/cn';

export interface WorkflowState {
  projectId: string;
  currentPhase: SpecificationPhase;
  canProgress: boolean;
  nextPhase?: SpecificationPhase;
  phaseHistory: Array<{
    fromPhase: SpecificationPhase;
    toPhase: SpecificationPhase;
    timestamp: Date;
    userId: string;
    userName: string;
  }>;
  documentStatuses: Record<SpecificationPhase, DocumentStatus>;
  approvals: Record<SpecificationPhase, Array<{
    userId: string;
    userName: string;
    timestamp: Date;
    approved: boolean;
    comment?: string;
  }>>;
}

export interface WorkflowStateDisplayProps {
  workflowState: WorkflowState;
  onTransitionPhase?: (targetPhase: SpecificationPhase) => void;
  onRequestApproval?: (phase: SpecificationPhase) => void;
  className?: string;
}

export const WorkflowStateDisplay: React.FC<WorkflowStateDisplayProps> = ({
  workflowState,
  onTransitionPhase,
  onRequestApproval,
  className,
}) => {
  const getPhaseDisplayName = (phase: SpecificationPhase): string => {
    return phase.charAt(0) + phase.slice(1).toLowerCase();
  };

  const getStatusIcon = (status: DocumentStatus) => {
    switch (status) {
      case DocumentStatus.APPROVED:
        return <CheckCircleIcon className="h-4 w-4 text-green-500" />;
      case DocumentStatus.REVIEW:
        return <ClockIcon className="h-4 w-4 text-yellow-500" />;
      case DocumentStatus.DRAFT:
        return <ClockIcon className="h-4 w-4 text-gray-400" />;
      default:
        return <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusColor = (status: DocumentStatus): string => {
    switch (status) {
      case DocumentStatus.APPROVED:
        return 'text-green-600 bg-green-50 border-green-200';
      case DocumentStatus.REVIEW:
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case DocumentStatus.DRAFT:
        return 'text-gray-600 bg-gray-50 border-gray-200';
      default:
        return 'text-red-600 bg-red-50 border-red-200';
    }
  };

  const currentPhaseApprovals = workflowState.approvals[workflowState.currentPhase] || [];
  const approvedCount = currentPhaseApprovals.filter(a => a.approved).length;
  const totalApprovals = currentPhaseApprovals.length;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Current Status */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Current Status</h3>
          <div className={cn(
            'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border',
            getStatusColor(workflowState.documentStatuses[workflowState.currentPhase])
          )}>
            {getStatusIcon(workflowState.documentStatuses[workflowState.currentPhase])}
            <span className="ml-2">
              {getPhaseDisplayName(workflowState.currentPhase)} - {workflowState.documentStatuses[workflowState.currentPhase]}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">
              {getPhaseDisplayName(workflowState.currentPhase)}
            </div>
            <div className="text-sm text-gray-500">Current Phase</div>
          </div>

          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">
              {approvedCount}/{totalApprovals || 1}
            </div>
            <div className="text-sm text-gray-500">Approvals</div>
          </div>

          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">
              {Object.values(workflowState.documentStatuses).filter(s => s === DocumentStatus.APPROVED).length}
            </div>
            <div className="text-sm text-gray-500">Completed Phases</div>
          </div>
        </div>

        {/* Phase Transition */}
        {workflowState.canProgress && workflowState.nextPhase && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                <span className="text-sm font-medium text-green-800">
                  Ready to proceed to {getPhaseDisplayName(workflowState.nextPhase)}
                </span>
              </div>
              <button
                onClick={() => onTransitionPhase?.(workflowState.nextPhase!)}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Proceed
                <ArrowRightIcon className="ml-2 h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Request Approval */}
        {!workflowState.canProgress && 
         workflowState.documentStatuses[workflowState.currentPhase] === DocumentStatus.DRAFT &&
         onRequestApproval && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <UserGroupIcon className="h-5 w-5 text-blue-500 mr-2" />
                <span className="text-sm font-medium text-blue-800">
                  Request approval for {getPhaseDisplayName(workflowState.currentPhase)} phase
                </span>
              </div>
              <button
                onClick={() => onRequestApproval(workflowState.currentPhase)}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Request Approval
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Phase History */}
      {workflowState.phaseHistory.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Phase History</h3>
          <div className="space-y-3">
            {workflowState.phaseHistory.slice(-5).reverse().map((transition, index) => (
              <div key={index} className="flex items-center space-x-3 text-sm">
                <div className="flex-shrink-0">
                  <ArrowRightIcon className="h-4 w-4 text-gray-400" />
                </div>
                <div className="flex-1">
                  <span className="text-gray-900">
                    Transitioned from <span className="font-medium">{getPhaseDisplayName(transition.fromPhase)}</span> to{' '}
                    <span className="font-medium">{getPhaseDisplayName(transition.toPhase)}</span>
                  </span>
                  <div className="text-gray-500">
                    by {transition.userName} on {transition.timestamp.toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approvals Status */}
      {currentPhaseApprovals.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {getPhaseDisplayName(workflowState.currentPhase)} Approvals
          </h3>
          <div className="space-y-3">
            {currentPhaseApprovals.map((approval, index) => (
              <div key={index} className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-1">
                  {approval.approved ? (
                    <CheckCircleIcon className="h-5 w-5 text-green-500" />
                  ) : (
                    <ClockIcon className="h-5 w-5 text-yellow-500" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-gray-900">{approval.userName}</span>
                    <span className={cn(
                      'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                      approval.approved 
                        ? 'text-green-800 bg-green-100' 
                        : 'text-yellow-800 bg-yellow-100'
                    )}>
                      {approval.approved ? 'Approved' : 'Pending'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {approval.timestamp.toLocaleDateString()} at {approval.timestamp.toLocaleTimeString()}
                  </div>
                  {approval.comment && (
                    <div className="mt-1 text-sm text-gray-700 italic">
                      "{approval.comment}"
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};