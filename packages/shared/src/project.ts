export const SPECIFICATION_PHASES = ['requirements', 'design', 'tasks', 'implementation'] as const;
export type SpecificationPhase = (typeof SPECIFICATION_PHASES)[number];

export const DOCUMENT_STATUSES = ['draft', 'in_review', 'approved'] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export interface SpecificationDocumentSummary {
  id: string;
  phase: SpecificationPhase;
  title: string;
  status: DocumentStatus;
  updatedAt: string;
}

export interface WorkflowProgress {
  currentPhase: SpecificationPhase;
  completedPhases: SpecificationPhase[];
  pendingApproval: boolean;
  progressPercentage: number;
}

export interface ProjectSummary {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

export interface ProjectOverview extends ProjectSummary {
  workflow: WorkflowProgress;
  documents: SpecificationDocumentSummary[];
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
}
