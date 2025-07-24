import { SpecificationPhase, DocumentStatus } from '../types/project';

export interface PhaseValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  completionPercentage: number;
  canTransition: boolean;
  nextPhase?: SpecificationPhase;
}

export interface ApprovalRequest {
  projectId: string;
  phase: SpecificationPhase;
  comment?: string;
}

export interface PhaseTransitionRequest {
  projectId: string;
  targetPhase: SpecificationPhase;
  approvalComment?: string;
}

export interface WorkflowNavigationState {
  currentPhase: SpecificationPhase;
  accessiblePhases: SpecificationPhase[];
  completedPhases: SpecificationPhase[];
  phaseValidations: Record<SpecificationPhase, PhaseValidationResult>;
  canProgress: boolean;
  nextPhase?: SpecificationPhase;
}

export class WorkflowService {
  private readonly phaseOrder: SpecificationPhase[] = [
    SpecificationPhase.REQUIREMENTS,
    SpecificationPhase.DESIGN,
    SpecificationPhase.TASKS,
    SpecificationPhase.IMPLEMENTATION,
  ];

  async validatePhaseCompletion(
    projectId: string,
    phase: SpecificationPhase
  ): Promise<PhaseValidationResult> {
    try {
      const response = await fetch(`/api/projects/${projectId}/workflow/validate/${phase}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Validation failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Determine if can transition to next phase
      const currentPhaseIndex = this.phaseOrder.indexOf(phase);
      const nextPhase = currentPhaseIndex < this.phaseOrder.length - 1 
        ? this.phaseOrder[currentPhaseIndex + 1] 
        : undefined;

      return {
        ...result,
        canTransition: result.isValid && result.completionPercentage === 100,
        nextPhase,
      };
    } catch (error) {
      console.error('Phase validation failed:', error);
      return {
        isValid: false,
        errors: ['Failed to validate phase completion'],
        warnings: [],
        completionPercentage: 0,
        canTransition: false,
      };
    }
  }

  async requestApproval(request: ApprovalRequest): Promise<void> {
    try {
      const response = await fetch(`/api/projects/${request.projectId}/workflow/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`,
        },
        body: JSON.stringify({
          phase: request.phase,
          comment: request.comment,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Approval request failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Approval request failed:', error);
      throw error;
    }
  }

  async transitionPhase(request: PhaseTransitionRequest): Promise<void> {
    try {
      const response = await fetch(`/api/projects/${request.projectId}/workflow/transition`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`,
        },
        body: JSON.stringify({
          targetPhase: request.targetPhase,
          approvalComment: request.approvalComment,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Phase transition failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Phase transition failed:', error);
      throw error;
    }
  }

  async getWorkflowState(projectId: string) {
    try {
      const response = await fetch(`/api/projects/${projectId}/workflow/state`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get workflow state: ${response.statusText}`);
      }

      const workflowState = await response.json();
      
      // Convert date strings back to Date objects
      if (workflowState.phaseHistory) {
        workflowState.phaseHistory = workflowState.phaseHistory.map((transition: any) => ({
          ...transition,
          timestamp: new Date(transition.timestamp),
        }));
      }

      if (workflowState.approvals) {
        Object.keys(workflowState.approvals).forEach(phase => {
          workflowState.approvals[phase] = workflowState.approvals[phase].map((approval: any) => ({
            ...approval,
            timestamp: new Date(approval.timestamp),
          }));
        });
      }

      return workflowState;
    } catch (error) {
      console.error('Failed to get workflow state:', error);
      throw error;
    }
  }

  getNavigationState(
    currentPhase: SpecificationPhase,
    documentStatuses: Record<SpecificationPhase, DocumentStatus>,
    phaseValidations: Record<SpecificationPhase, PhaseValidationResult>
  ): WorkflowNavigationState {
    const currentPhaseIndex = this.phaseOrder.indexOf(currentPhase);
    
    // Determine accessible phases (current and previous phases, plus next if current is approved)
    const accessiblePhases: SpecificationPhase[] = [];
    
    // Always accessible: current phase and all previous phases
    for (let i = 0; i <= currentPhaseIndex; i++) {
      accessiblePhases.push(this.phaseOrder[i]);
    }
    
    // Next phase is accessible if current phase is approved
    if (currentPhaseIndex < this.phaseOrder.length - 1 && 
        documentStatuses[currentPhase] === DocumentStatus.APPROVED) {
      accessiblePhases.push(this.phaseOrder[currentPhaseIndex + 1]);
    }

    // Determine completed phases
    const completedPhases = this.phaseOrder.filter(
      phase => documentStatuses[phase] === DocumentStatus.APPROVED
    );

    // Determine if can progress
    const currentValidation = phaseValidations[currentPhase];
    const canProgress = currentValidation?.canTransition && 
                       documentStatuses[currentPhase] === DocumentStatus.APPROVED;

    const nextPhase = currentPhaseIndex < this.phaseOrder.length - 1 
      ? this.phaseOrder[currentPhaseIndex + 1] 
      : undefined;

    return {
      currentPhase,
      accessiblePhases,
      completedPhases,
      phaseValidations,
      canProgress,
      nextPhase,
    };
  }

  getPhaseDisplayName(phase: SpecificationPhase): string {
    return phase.charAt(0) + phase.slice(1).toLowerCase();
  }

  getPhaseDescription(phase: SpecificationPhase): string {
    const descriptions = {
      [SpecificationPhase.REQUIREMENTS]: 'Define project scope and user needs',
      [SpecificationPhase.DESIGN]: 'Create technical architecture and UI/UX designs',
      [SpecificationPhase.TASKS]: 'Break down implementation into actionable items',
      [SpecificationPhase.IMPLEMENTATION]: 'Execute development work',
    };

    return descriptions[phase];
  }

  isPhaseAccessible(
    phase: SpecificationPhase,
    currentPhase: SpecificationPhase,
    documentStatuses: Record<SpecificationPhase, DocumentStatus>
  ): boolean {
    const currentPhaseIndex = this.phaseOrder.indexOf(currentPhase);
    const targetPhaseIndex = this.phaseOrder.indexOf(phase);
    
    // Can access current phase and previous phases
    if (targetPhaseIndex <= currentPhaseIndex) {
      return true;
    }
    
    // Can access next phase if current is approved
    if (targetPhaseIndex === currentPhaseIndex + 1 && 
        documentStatuses[currentPhase] === DocumentStatus.APPROVED) {
      return true;
    }
    
    return false;
  }

  private getAuthToken(): string {
    // Get token from localStorage or wherever it's stored
    return localStorage.getItem('authToken') || '';
  }
}

export const workflowService = new WorkflowService();