import { randomUUID } from 'crypto';
import type {
  CreateProjectRequest,
  ProjectOverview,
  ProjectSummary,
  SpecificationDocumentSummary,
  SpecificationPhase,
  WorkflowProgress
} from '@codementor-ai/shared/project';
import { DOCUMENT_STATUSES, SPECIFICATION_PHASES } from '@codementor-ai/shared/project';

interface StoredProject {
  summary: ProjectSummary;
  documents: Map<SpecificationPhase, SpecificationDocumentSummary>;
  workflow: WorkflowProgress;
}

export class ProjectService {
  #projects = new Map<string, StoredProject>();

  async listProjects(): Promise<ProjectSummary[]> {
    return Array.from(this.#projects.values()).map((project) => project.summary);
  }

  async getProject(projectId: string): Promise<ProjectOverview | undefined> {
    const stored = this.#projects.get(projectId);
    if (!stored) return undefined;

    return {
      ...stored.summary,
      workflow: stored.workflow,
      documents: Array.from(stored.documents.values())
    };
  }

  async createProject(input: CreateProjectRequest): Promise<ProjectOverview> {
    const now = new Date().toISOString();
    const id = randomUUID();

    const summary: ProjectSummary = {
      id,
      name: input.name,
      description: input.description ?? '',
      createdAt: now
    };

    const documents = new Map<SpecificationPhase, SpecificationDocumentSummary>();
    for (const phase of SPECIFICATION_PHASES) {
      documents.set(phase, {
        id: randomUUID(),
        phase,
        title: `${input.name} – ${phase.charAt(0).toUpperCase()}${phase.slice(1)}`,
        status: DOCUMENT_STATUSES[0],
        updatedAt: now
      });
    }

    const workflow: WorkflowProgress = {
      currentPhase: 'requirements',
      completedPhases: [],
      pendingApproval: false,
      progressPercentage: 0
    };

    this.#projects.set(id, { summary, documents, workflow });

    return {
      ...summary,
      workflow,
      documents: Array.from(documents.values())
    };
  }
}
