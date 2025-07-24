import { PrismaClient, SpecificationPhase, DocumentStatus, SpecificationProject, SpecificationDocument, User } from '@prisma/client';
import Redis from 'ioredis';

export interface PhaseTransitionRequest {
  targetPhase: SpecificationPhase;
  approvalComment?: string;
}

export interface DocumentUpdateRequest {
  content: string;
  version?: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  completionPercentage: number;
}

export interface PhaseValidationRule {
  phase: SpecificationPhase;
  requiredSections: string[];
  minimumWordCount: number;
  requiredApprovals: number;
  customValidators?: ((content: string) => ValidationResult)[];
}

export interface WorkflowState {
  projectId: string;
  currentPhase: SpecificationPhase;
  phaseHistory: PhaseTransition[];
  documentStatuses: Record<SpecificationPhase, DocumentStatus>;
  approvals: Record<SpecificationPhase, Approval[]>;
  canProgress: boolean;
  nextPhase?: SpecificationPhase;
}

export interface PhaseTransition {
  fromPhase: SpecificationPhase;
  toPhase: SpecificationPhase;
  timestamp: Date;
  userId: string;
  approvalComment?: string;
}

export interface Approval {
  userId: string;
  timestamp: Date;
  comment?: string;
  approved: boolean;
}

export class SpecificationWorkflowError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
    public phase?: SpecificationPhase
  ) {
    super(message);
    this.name = 'SpecificationWorkflowError';
  }
}

export class SpecificationWorkflowService {
  private readonly phaseOrder: SpecificationPhase[] = [
    SpecificationPhase.REQUIREMENTS,
    SpecificationPhase.DESIGN,
    SpecificationPhase.TASKS,
    SpecificationPhase.IMPLEMENTATION,
  ];

  private readonly validationRules: Record<SpecificationPhase, PhaseValidationRule> = {
    [SpecificationPhase.REQUIREMENTS]: {
      phase: SpecificationPhase.REQUIREMENTS,
      requiredSections: ['Introduction', 'Requirements'],
      minimumWordCount: 200,
      requiredApprovals: 1,
      customValidators: [this.validateRequirementsFormat.bind(this)],
    },
    [SpecificationPhase.DESIGN]: {
      phase: SpecificationPhase.DESIGN,
      requiredSections: ['Overview', 'Architecture', 'Components'],
      minimumWordCount: 500,
      requiredApprovals: 1,
      customValidators: [this.validateDesignFormat.bind(this)],
    },
    [SpecificationPhase.TASKS]: {
      phase: SpecificationPhase.TASKS,
      requiredSections: ['Implementation Plan'],
      minimumWordCount: 300,
      requiredApprovals: 1,
      customValidators: [this.validateTasksFormat.bind(this)],
    },
    [SpecificationPhase.IMPLEMENTATION]: {
      phase: SpecificationPhase.IMPLEMENTATION,
      requiredSections: ['Implementation Notes'],
      minimumWordCount: 100,
      requiredApprovals: 0,
    },
  };

  constructor(
    private prisma: PrismaClient,
    private redis?: Redis
  ) {}

  async validatePhaseCompletion(
    projectId: string,
    phase: SpecificationPhase
  ): Promise<ValidationResult> {
    const document = await this.prisma.specificationDocument.findUnique({
      where: {
        projectId_phase: {
          projectId,
          phase,
        },
      },
    });

    if (!document) {
      return {
        isValid: false,
        errors: ['Document not found for phase'],
        warnings: [],
        completionPercentage: 0,
      };
    }

    const rule = this.validationRules[phase];
    const errors: string[] = [];
    const warnings: string[] = [];
    let completionPercentage = 0;

    // Check required sections
    const sectionChecks = rule.requiredSections.map(section => {
      const hasSection = document.content.toLowerCase().includes(section.toLowerCase());
      if (!hasSection) {
        errors.push(`Missing required section: ${section}`);
      }
      return hasSection;
    });

    // Check word count
    const wordCount = document.content.split(/\s+/).length;
    if (wordCount < rule.minimumWordCount) {
      errors.push(`Document too short. Minimum ${rule.minimumWordCount} words required, found ${wordCount}`);
    }

    // Run custom validators
    if (rule.customValidators) {
      for (const validator of rule.customValidators) {
        const result = validator(document.content);
        errors.push(...result.errors);
        warnings.push(...result.warnings);
      }
    }

    // Calculate completion percentage
    const sectionsComplete = sectionChecks.filter(Boolean).length;
    const wordCountComplete = wordCount >= rule.minimumWordCount ? 1 : 0;
    
    let customValidationComplete = 1;
    if (rule.customValidators) {
      for (const validator of rule.customValidators) {
        const result = validator(document.content);
        if (!result.isValid) {
          customValidationComplete = 0;
          break;
        }
      }
    }

    const totalChecks = rule.requiredSections.length + 1 + (rule.customValidators ? 1 : 0);
    completionPercentage = Math.round(
      ((sectionsComplete + wordCountComplete + customValidationComplete) / totalChecks) * 100
    );

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      completionPercentage,
    };
  }

  async canTransitionToPhase(
    projectId: string,
    targetPhase: SpecificationPhase,
    userId: string
  ): Promise<{ canTransition: boolean; reason?: string }> {
    const project = await this.prisma.specificationProject.findUnique({
      where: { id: projectId },
      include: {
        owner: true,
        team: {
          where: { status: 'ACTIVE' },
          include: { user: true },
        },
      },
    });

    if (!project) {
      return { canTransition: false, reason: 'Project not found' };
    }

    // Check if user has permission
    const hasPermission = this.checkTransitionPermission(project, userId);
    if (!hasPermission) {
      return { canTransition: false, reason: 'Insufficient permissions' };
    }

    // Check if transition is valid (sequential)
    const currentPhaseIndex = this.phaseOrder.indexOf(project.currentPhase);
    const targetPhaseIndex = this.phaseOrder.indexOf(targetPhase);

    if (targetPhaseIndex !== currentPhaseIndex + 1 && targetPhaseIndex !== currentPhaseIndex - 1) {
      return { canTransition: false, reason: 'Invalid phase transition. Phases must be sequential' };
    }

    // If moving forward, validate current phase completion
    if (targetPhaseIndex > currentPhaseIndex) {
      const validation = await this.validatePhaseCompletion(projectId, project.currentPhase);
      if (!validation.isValid) {
        return { 
          canTransition: false, 
          reason: `Current phase validation failed: ${validation.errors.join(', ')}` 
        };
      }

      // Check approvals
      const approvals = await this.getPhaseApprovals(projectId, project.currentPhase);
      const rule = this.validationRules[project.currentPhase];
      if (approvals.filter(a => a.approved).length < rule.requiredApprovals) {
        return { 
          canTransition: false, 
          reason: `Insufficient approvals. Required: ${rule.requiredApprovals}, Found: ${approvals.filter(a => a.approved).length}` 
        };
      }
    }

    return { canTransition: true };
  }

  async transitionPhase(
    projectId: string,
    request: PhaseTransitionRequest,
    userId: string
  ): Promise<WorkflowState> {
    const canTransition = await this.canTransitionToPhase(projectId, request.targetPhase, userId);
    
    if (!canTransition.canTransition) {
      throw new SpecificationWorkflowError(
        canTransition.reason || 'Phase transition not allowed',
        'TRANSITION_NOT_ALLOWED',
        403,
        request.targetPhase
      );
    }

    const project = await this.prisma.specificationProject.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new SpecificationWorkflowError('Project not found', 'PROJECT_NOT_FOUND', 404);
    }

    // Perform transition in transaction
    await this.prisma.$transaction(async (tx) => {
      // Update project phase
      await tx.specificationProject.update({
        where: { id: projectId },
        data: {
          currentPhase: request.targetPhase,
          updatedAt: new Date(),
        },
      });

      // Record phase transition
      await this.recordPhaseTransition(
        tx,
        projectId,
        project.currentPhase,
        request.targetPhase,
        userId,
        request.approvalComment
      );

      // Update document status for new phase
      await tx.specificationDocument.updateMany({
        where: {
          projectId,
          phase: request.targetPhase,
        },
        data: {
          status: DocumentStatus.DRAFT,
        },
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          userId,
          action: 'phase_transition',
          resource: 'project',
          resourceId: projectId,
          details: {
            fromPhase: project.currentPhase,
            toPhase: request.targetPhase,
            comment: request.approvalComment,
          },
          success: true,
        },
      });
    });

    // Invalidate cache
    await this.invalidateWorkflowCache(projectId);

    return await this.getWorkflowState(projectId);
  }

  async updateDocument(
    projectId: string,
    phase: SpecificationPhase,
    request: DocumentUpdateRequest,
    userId: string
  ): Promise<SpecificationDocument> {
    // Check permissions
    const hasPermission = await this.checkDocumentUpdatePermission(projectId, userId);
    if (!hasPermission) {
      throw new SpecificationWorkflowError(
        'Insufficient permissions to update document',
        'INSUFFICIENT_PERMISSIONS',
        403,
        phase
      );
    }

    const document = await this.prisma.specificationDocument.findUnique({
      where: {
        projectId_phase: {
          projectId,
          phase,
        },
      },
    });

    if (!document) {
      throw new SpecificationWorkflowError(
        'Document not found',
        'DOCUMENT_NOT_FOUND',
        404,
        phase
      );
    }

    // Create version history entry
    await this.prisma.documentVersion.create({
      data: {
        documentId: document.id,
        version: document.version,
        content: document.content,
        changes: {},
        createdBy: userId,
      },
    });

    // Update document
    const updatedDocument = await this.prisma.specificationDocument.update({
      where: { id: document.id },
      data: {
        content: request.content,
        version: document.version + 1,
        status: DocumentStatus.DRAFT,
        updatedAt: new Date(),
      },
    });

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'document_update',
        resource: 'document',
        resourceId: document.id,
        details: {
          phase,
          projectId,
          version: updatedDocument.version,
        },
        success: true,
      },
    });

    // Invalidate cache
    await this.invalidateWorkflowCache(projectId);

    return updatedDocument;
  }

  async getWorkflowState(projectId: string): Promise<WorkflowState> {
    const cacheKey = `workflow:${projectId}`;

    // Try cache first
    if (this.redis) {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        const workflowState = JSON.parse(cached);
        // Convert date strings back to Date objects
        workflowState.phaseHistory = workflowState.phaseHistory.map((transition: any) => ({
          ...transition,
          timestamp: new Date(transition.timestamp),
        }));
        return workflowState;
      }
    }

    const project = await this.prisma.specificationProject.findUnique({
      where: { id: projectId },
      include: {
        documents: {
          select: {
            phase: true,
            status: true,
          },
        },
      },
    });

    if (!project) {
      throw new SpecificationWorkflowError('Project not found', 'PROJECT_NOT_FOUND', 404);
    }

    // Get phase history
    const phaseHistory = await this.getPhaseHistory(projectId);

    // Get approvals for all phases
    const approvals: Record<SpecificationPhase, Approval[]> = {} as any;
    for (const phase of this.phaseOrder) {
      approvals[phase] = await this.getPhaseApprovals(projectId, phase);
    }

    // Build document statuses
    const documentStatuses: Record<SpecificationPhase, DocumentStatus> = {} as any;
    for (const doc of project.documents) {
      documentStatuses[doc.phase] = doc.status;
    }

    // Determine if can progress
    const currentPhaseIndex = this.phaseOrder.indexOf(project.currentPhase);
    const nextPhase = currentPhaseIndex < this.phaseOrder.length - 1 
      ? this.phaseOrder[currentPhaseIndex + 1] 
      : undefined;

    let canProgress = false;
    if (nextPhase) {
      const canTransition = await this.canTransitionToPhase(projectId, nextPhase, project.ownerId);
      canProgress = canTransition.canTransition;
    }

    const workflowState: WorkflowState = {
      projectId,
      currentPhase: project.currentPhase,
      phaseHistory,
      documentStatuses,
      approvals,
      canProgress,
      nextPhase,
    };

    // Cache result
    if (this.redis) {
      await this.redis.setex(cacheKey, 300, JSON.stringify(workflowState)); // 5 minutes
    }

    return workflowState;
  }

  async approvePhase(
    projectId: string,
    phase: SpecificationPhase,
    userId: string,
    comment?: string
  ): Promise<void> {
    // Store approval in Redis (temporary storage)
    const approvalKey = `approval:${projectId}:${phase}:${userId}`;
    const approval: Approval = {
      userId,
      timestamp: new Date(),
      comment,
      approved: true,
    };

    if (this.redis) {
      await this.redis.setex(approvalKey, 86400, JSON.stringify(approval)); // 24 hours
    }

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'phase_approval',
        resource: 'project',
        resourceId: projectId,
        details: {
          phase,
          comment,
          approved: true,
        },
        success: true,
      },
    });

    // Invalidate workflow cache
    await this.invalidateWorkflowCache(projectId);
  }

  private validateRequirementsFormat(content: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for user stories format
    const userStoryPattern = /As a .+, I want .+, so that .+/gi;
    const userStories = content.match(userStoryPattern) || [];
    
    if (userStories.length === 0) {
      errors.push('No user stories found. Use format: "As a [role], I want [feature], so that [benefit]"');
    }

    // Check for EARS format (WHEN/IF/THEN)
    const earsPattern = /(WHEN|IF).+(THEN).+(SHALL)/gi;
    const earsStatements = content.match(earsPattern) || [];
    
    if (earsStatements.length === 0) {
      warnings.push('Consider using EARS format for acceptance criteria: "WHEN [event] THEN [system] SHALL [response]"');
    }

    // Check for numbered requirements
    const numberedReqPattern = /### Requirement \d+/gi;
    const numberedReqs = content.match(numberedReqPattern) || [];
    
    if (numberedReqs.length === 0) {
      warnings.push('Consider numbering requirements for better traceability');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      completionPercentage: 0, // Not used in custom validators
    };
  }

  private validateDesignFormat(content: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for architecture diagrams or descriptions
    const hasArchitecture = content.toLowerCase().includes('architecture') || 
                           content.toLowerCase().includes('diagram') ||
                           content.includes('```mermaid');
    
    if (!hasArchitecture) {
      warnings.push('Consider adding architecture diagrams or detailed architecture descriptions');
    }

    // Check for data models
    const hasDataModels = content.toLowerCase().includes('data model') || 
                         content.toLowerCase().includes('database') ||
                         content.toLowerCase().includes('schema');
    
    if (!hasDataModels) {
      warnings.push('Consider adding data model descriptions');
    }

    // Check for API design
    const hasApiDesign = content.toLowerCase().includes('api') || 
                        content.toLowerCase().includes('endpoint') ||
                        content.toLowerCase().includes('interface');
    
    if (!hasApiDesign) {
      warnings.push('Consider adding API design specifications');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      completionPercentage: 0,
    };
  }

  private validateTasksFormat(content: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for checkbox format
    const checkboxPattern = /- \[ \]/g;
    const checkboxes = content.match(checkboxPattern) || [];
    
    if (checkboxes.length === 0) {
      errors.push('No task checkboxes found. Use format: "- [ ] Task description"');
    }

    // Check for requirement references
    const reqRefPattern = /_Requirements?: [\d\., ]+_/gi;
    const reqRefs = content.match(reqRefPattern) || [];
    
    if (reqRefs.length === 0) {
      warnings.push('Consider adding requirement references to tasks: "_Requirements: 1.1, 1.2_"');
    }

    // Check for task hierarchy
    const hasHierarchy = content.includes('  - [ ]') || content.match(/\d+\.\d+/);
    
    if (!hasHierarchy) {
      warnings.push('Consider organizing tasks in a hierarchical structure');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      completionPercentage: 0,
    };
  }

  private checkTransitionPermission(
    project: any,
    userId: string
  ): boolean {
    // Project owner can always transition
    if (project.ownerId === userId) {
      return true;
    }

    // Team leads can transition
    const teamMember = project.team.find(
      (member: any) => member.userId === userId && member.role === 'LEAD'
    );

    return !!teamMember;
  }

  private async checkDocumentUpdatePermission(
    projectId: string,
    userId: string
  ): Promise<boolean> {
    const project = await this.prisma.specificationProject.findUnique({
      where: { id: projectId },
      include: {
        team: {
          where: { 
            userId,
            status: 'ACTIVE',
          },
        },
      },
    });

    if (!project) {
      return false;
    }

    // Project owner can always update
    if (project.ownerId === userId) {
      return true;
    }

    // Active team members can update
    return project.team.length > 0;
  }

  private async recordPhaseTransition(
    tx: any,
    projectId: string,
    fromPhase: SpecificationPhase,
    toPhase: SpecificationPhase,
    userId: string,
    comment?: string
  ): Promise<void> {
    // Store in Redis for workflow history
    if (this.redis) {
      const transitionKey = `transition:${projectId}:${Date.now()}`;
      const transition: PhaseTransition = {
        fromPhase,
        toPhase,
        timestamp: new Date(),
        userId,
        approvalComment: comment,
      };
      
      await this.redis.setex(transitionKey, 86400 * 30, JSON.stringify(transition)); // 30 days
    }
  }

  private async getPhaseHistory(projectId: string): Promise<PhaseTransition[]> {
    if (!this.redis) {
      return [];
    }

    const pattern = `transition:${projectId}:*`;
    const keys = await this.redis.keys(pattern);
    
    const transitions: PhaseTransition[] = [];
    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        const transition = JSON.parse(data);
        transition.timestamp = new Date(transition.timestamp);
        transitions.push(transition);
      }
    }

    return transitions.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private async getPhaseApprovals(
    projectId: string,
    phase: SpecificationPhase
  ): Promise<Approval[]> {
    if (!this.redis) {
      return [];
    }

    const pattern = `approval:${projectId}:${phase}:*`;
    const keys = await this.redis.keys(pattern);
    
    const approvals: Approval[] = [];
    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        const approval = JSON.parse(data);
        approval.timestamp = new Date(approval.timestamp);
        approvals.push(approval);
      }
    }

    return approvals;
  }

  private async invalidateWorkflowCache(projectId: string): Promise<void> {
    if (!this.redis) return;

    const pattern = `workflow:${projectId}*`;
    const keys = await this.redis.keys(pattern);

    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}