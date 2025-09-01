import { DocumentStatus, SpecificationPhase } from '@prisma/client';
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import workflowRoutes, {
  __setTestPrisma,
  __setTestRedis,
} from '../routes/specification-workflow.routes.js';

// Mock dependencies
const mockPrisma = {
  specificationProject: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  specificationDocument: {
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  documentVersion: {
    create: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
  },
  $transaction: vi.fn(),
} as any;

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  keys: vi.fn(),
} as any;

// Mock the auth middleware
const mockAuthMiddleware = (req: any, _res: any, next: any) => {
  req.user = { id: 'user1', email: 'test@example.com', name: 'Test User' };
  next();
};

// Create test app
const createTestApp = () => {
  const app = express();
  app.use(express.json());

  // Replace auth middleware with mock
  vi.doMock('../middleware/auth.middleware.js', () => ({
    authenticateToken: mockAuthMiddleware,
  }));

  app.use('/api', workflowRoutes);
  return app;
};

describe('Specification Workflow Routes Integration', () => {
  let app: express.Application;
  let response: any;

  beforeEach(() => {
    vi.clearAllMocks();
    __setTestPrisma(mockPrisma);
    __setTestRedis(mockRedis);
    app = createTestApp();
  });

  describe('GET /projects/:projectId/workflow/validate/:phase', () => {
    it('should validate phase completion successfully', async () => {
      const mockProject = {
        id: 'project1',
        ownerId: 'user1',
        currentPhase: SpecificationPhase.REQUIREMENTS,
      };

      const mockDocument = {
        id: 'doc1',
        content: `# Requirements Document

## Introduction
This is a comprehensive requirements document with sufficient content for validation testing. The system provides authentication, project management, and collaboration features. This document outlines all functional and non-functional requirements needed for successful implementation and contains adequate detail.

## Requirements

### Requirement 1: User Authentication

**User Story:** As a user, I want to log in, so that I can access my account securely

#### Acceptance Criteria

1. WHEN user enters valid credentials THEN system SHALL authenticate user successfully
2. IF credentials are invalid THEN system SHALL display appropriate error message
3. WHEN user attempts multiple failed logins THEN system SHALL implement rate limiting
4. IF user forgets password THEN system SHALL provide secure password reset functionality

### Requirement 2: Project Management

**User Story:** As a project manager, I want to create and manage projects, so that I can organize my team's work effectively

#### Acceptance Criteria

1. WHEN user creates new project THEN system SHALL initialize project with default structure
2. IF user lacks permissions THEN system SHALL deny project creation
3. WHEN project is created THEN system SHALL notify team members automatically

This document meets all validation requirements including word count and proper formatting with comprehensive requirements coverage for the complete system functionality.`,
        projectId: 'project1',
        phase: SpecificationPhase.REQUIREMENTS,
      };

      mockPrisma.specificationProject.findFirst.mockResolvedValue(mockProject);
      mockPrisma.specificationDocument.findUnique.mockResolvedValue(mockDocument);

      response = await request(app)
        .get('/api/projects/project1/workflow/validate/REQUIREMENTS')
        .expect(200);

      expect(response.body.isValid).toBe(true);
      expect(response.body.completionPercentage).toBeGreaterThan(0);
      expect(response.body.errors).toHaveLength(0);
    });

    it('should return 404 when project not found', async () => {
      mockPrisma.specificationProject.findFirst.mockResolvedValue(null);

      response = await request(app)
        .get('/api/projects/nonexistent/workflow/validate/REQUIREMENTS')
        .expect(404);

      expect(response.body.error).toBe('Project not found or access denied');
    });

    it('should return validation errors for incomplete document', async () => {
      const mockProject = {
        id: 'project1',
        ownerId: 'user1',
        currentPhase: SpecificationPhase.REQUIREMENTS,
      };

      const mockDocument = {
        id: 'doc1',
        content: 'Short document without proper sections.',
        projectId: 'project1',
        phase: SpecificationPhase.REQUIREMENTS,
      };

      mockPrisma.specificationProject.findFirst.mockResolvedValue(mockProject);
      mockPrisma.specificationDocument.findUnique.mockResolvedValue(mockDocument);

      response = await request(app)
        .get('/api/projects/project1/workflow/validate/REQUIREMENTS')
        .expect(200);

      expect(response.body.isValid).toBe(false);
      expect(response.body.errors.length).toBeGreaterThan(0);
      expect(response.body.completionPercentage).toBeLessThan(100);
    });
  });

  describe('GET /projects/:projectId/workflow/state', () => {
    it('should return workflow state with user information', async () => {
      const mockProject = {
        id: 'project1',
        ownerId: 'user1',
        currentPhase: SpecificationPhase.REQUIREMENTS,
        documents: [
          { phase: SpecificationPhase.REQUIREMENTS, status: DocumentStatus.DRAFT },
          { phase: SpecificationPhase.DESIGN, status: DocumentStatus.DRAFT },
        ],
      };

      const mockUsers = [
        { id: 'user1', name: 'Test User', email: 'test@example.com', avatar: null },
      ];

      mockPrisma.specificationProject.findFirst.mockResolvedValue(mockProject);
      mockPrisma.specificationProject.findUnique.mockResolvedValue(mockProject);
      mockPrisma.user.findMany.mockResolvedValue(mockUsers);
      mockRedis.get.mockResolvedValue(null); // No cache
      mockRedis.keys.mockResolvedValue([]);
      mockRedis.setex.mockResolvedValue('OK');

      response = await request(app).get('/api/projects/project1/workflow/state').expect(200);

      expect(response.body.projectId).toBe('project1');
      expect(response.body.currentPhase).toBe(SpecificationPhase.REQUIREMENTS);
      expect(response.body.documentStatuses).toBeDefined();
      expect(response.body.phaseHistory).toBeDefined();
      expect(response.body.approvals).toBeDefined();
    });

    it('should return cached workflow state', async () => {
      const mockWorkflowState = {
        projectId: 'project1',
        currentPhase: SpecificationPhase.REQUIREMENTS,
        phaseHistory: [],
        documentStatuses: {
          [SpecificationPhase.REQUIREMENTS]: DocumentStatus.DRAFT,
        },
        approvals: {
          [SpecificationPhase.REQUIREMENTS]: [],
        },
        canProgress: false,
      };

      const mockProject = {
        id: 'project1',
        ownerId: 'user1',
      };

      mockPrisma.specificationProject.findFirst.mockResolvedValue(mockProject);
      mockRedis.get.mockResolvedValue(JSON.stringify(mockWorkflowState));
      mockPrisma.user.findMany.mockResolvedValue([]);

      response = await request(app).get('/api/projects/project1/workflow/state').expect(200);

      expect(response.body.projectId).toBe('project1');
      expect(response.body.currentPhase).toBe(SpecificationPhase.REQUIREMENTS);
      // Should not call database for project details when cache hit
      expect(mockPrisma.specificationProject.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('POST /projects/:projectId/workflow/approve', () => {
    it('should record phase approval successfully', async () => {
      const mockProject = {
        id: 'project1',
        ownerId: 'user1',
        currentPhase: SpecificationPhase.REQUIREMENTS,
      };

      mockPrisma.specificationProject.findFirst.mockResolvedValue(mockProject);
      mockRedis.setex.mockResolvedValue('OK');
      mockPrisma.auditLog.create.mockResolvedValue({});

      response = await request(app)
        .post('/api/projects/project1/workflow/approve')
        .send({
          phase: SpecificationPhase.REQUIREMENTS,
          comment: 'Requirements look good to me',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Approval recorded successfully');
      expect(mockRedis.setex).toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });

    it('should return 404 for non-existent project', async () => {
      mockPrisma.specificationProject.findFirst.mockResolvedValue(null);

      response = await request(app)
        .post('/api/projects/nonexistent/workflow/approve')
        .send({
          phase: SpecificationPhase.REQUIREMENTS,
          comment: 'Test approval',
        })
        .expect(404);

      expect(response.body.error).toBe('Project not found or access denied');
    });
  });

  describe('POST /projects/:projectId/workflow/transition', () => {
    it('should transition phase successfully', async () => {
      const mockProject = {
        id: 'project1',
        ownerId: 'user1',
        currentPhase: SpecificationPhase.REQUIREMENTS,
        team: [],
      };

      const mockDocument = {
        id: 'doc1',
        content: `# Requirements Document

## Introduction
This is a comprehensive requirements document with sufficient content for validation testing. The system provides authentication, project management, and collaboration features. This document outlines all functional and non-functional requirements needed for successful implementation and contains adequate detail.

## Requirements

### Requirement 1: User Authentication

**User Story:** As a user, I want to log in, so that I can access my account securely

#### Acceptance Criteria

1. WHEN user enters valid credentials THEN system SHALL authenticate user successfully
2. IF credentials are invalid THEN system SHALL display appropriate error message
3. WHEN user attempts multiple failed logins THEN system SHALL implement rate limiting
4. IF user forgets password THEN system SHALL provide secure password reset functionality

### Requirement 2: Project Management

**User Story:** As a project manager, I want to create and manage projects, so that I can organize my team's work effectively

#### Acceptance Criteria

1. WHEN user creates new project THEN system SHALL initialize project with default structure
2. IF user lacks permissions THEN system SHALL deny project creation
3. WHEN project is created THEN system SHALL notify team members automatically

This document meets all validation requirements including word count and proper formatting with comprehensive requirements coverage for the complete system functionality.`,
        projectId: 'project1',
        phase: SpecificationPhase.REQUIREMENTS,
      };

      const mockUpdatedProject = {
        ...mockProject,
        currentPhase: SpecificationPhase.DESIGN,
      };

      mockPrisma.specificationProject.findFirst.mockResolvedValue(mockProject);
      mockPrisma.specificationProject.findUnique
        .mockResolvedValueOnce(mockProject)
        .mockResolvedValueOnce({
          ...mockUpdatedProject,
          documents: [
            { phase: SpecificationPhase.REQUIREMENTS, status: DocumentStatus.APPROVED },
            { phase: SpecificationPhase.DESIGN, status: DocumentStatus.DRAFT },
          ],
        });

      mockPrisma.specificationDocument.findUnique.mockResolvedValue(mockDocument);
      mockRedis.keys.mockResolvedValue(['approval:project1:REQUIREMENTS:user1']);
      mockRedis.get
        .mockResolvedValueOnce(
          JSON.stringify({
            userId: 'user1',
            timestamp: new Date(),
            approved: true,
          })
        )
        .mockResolvedValueOnce(null); // No cache for workflow state

      mockPrisma.$transaction.mockImplementation(async callback => {
        return await callback({
          specificationProject: {
            update: vi.fn().mockResolvedValue(mockUpdatedProject),
          },
          specificationDocument: {
            updateMany: vi.fn(),
          },
          auditLog: {
            create: vi.fn(),
          },
        });
      });

      mockRedis.setex.mockResolvedValue('OK');

      response = await request(app)
        .post('/api/projects/project1/workflow/transition')
        .send({
          targetPhase: SpecificationPhase.DESIGN,
          approvalComment: 'Requirements approved, moving to design',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Successfully transitioned to DESIGN');
      expect(response.body.workflowState).toBeDefined();
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should return error for invalid transition', async () => {
      const mockProject = {
        id: 'project1',
        ownerId: 'user2', // Different owner
        currentPhase: SpecificationPhase.REQUIREMENTS,
        team: [], // User not in team
      };

      mockPrisma.specificationProject.findFirst.mockResolvedValue(mockProject);
      mockPrisma.specificationProject.findUnique.mockResolvedValue(mockProject);

      response = await request(app)
        .post('/api/projects/project1/workflow/transition')
        .send({
          targetPhase: SpecificationPhase.DESIGN,
          approvalComment: 'Test transition',
        })
        .expect(403);

      expect(response.body.error).toContain('Insufficient permissions');
    });
  });

  describe('PUT /projects/:projectId/workflow/documents/:phase', () => {
    it('should update document content successfully', async () => {
      const mockProject = {
        id: 'project1',
        ownerId: 'user1',
        team: [],
      };

      const mockDocument = {
        id: 'doc1',
        content: 'Original content',
        version: 1,
        projectId: 'project1',
        phase: SpecificationPhase.REQUIREMENTS,
      };

      const mockUpdatedDocument = {
        ...mockDocument,
        content: 'Updated content',
        version: 2,
        status: DocumentStatus.DRAFT,
      };

      mockPrisma.specificationProject.findFirst.mockResolvedValue(mockProject);
      mockPrisma.specificationDocument.findUnique.mockResolvedValue(mockDocument);
      mockPrisma.documentVersion.create.mockResolvedValue({});
      mockPrisma.specificationDocument.update.mockResolvedValue(mockUpdatedDocument);
      mockPrisma.auditLog.create.mockResolvedValue({});

      response = await request(app)
        .put('/api/projects/project1/workflow/documents/REQUIREMENTS')
        .send({
          content: 'Updated content',
          version: 1,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Document updated successfully');
      expect(response.body.document.content).toBe('Updated content');
      expect(response.body.document.version).toBe(2);
    });

    it('should return error for insufficient permissions', async () => {
      const mockProject = {
        id: 'project1',
        ownerId: 'other-user',
        team: [], // User not in team
      };

      mockPrisma.specificationProject.findFirst.mockResolvedValue(mockProject);

      response = await request(app)
        .put('/api/projects/project1/workflow/documents/REQUIREMENTS')
        .send({
          content: 'Updated content',
        })
        .expect(400);

      expect(response.body.error).toContain('Insufficient permissions');
    });
  });

  describe('GET /workflow/validation-rules', () => {
    it('should return validation rules for all phases', async () => {
      response = await request(app).get('/api/workflow/validation-rules').expect(200);

      expect(response.body.REQUIREMENTS).toBeDefined();
      expect(response.body.DESIGN).toBeDefined();
      expect(response.body.TASKS).toBeDefined();
      expect(response.body.IMPLEMENTATION).toBeDefined();

      expect(response.body.REQUIREMENTS.requiredSections).toContain('Introduction');
      expect(response.body.REQUIREMENTS.requiredSections).toContain('Requirements');
      expect(response.body.REQUIREMENTS.minimumWordCount).toBe(200);
      expect(response.body.REQUIREMENTS.requiredApprovals).toBe(1);
    });
  });

  describe('GET /projects/:projectId/workflow/can-transition/:targetPhase', () => {
    it('should return true when transition is allowed', async () => {
      const mockProject = {
        id: 'project1',
        ownerId: 'user1',
        currentPhase: SpecificationPhase.REQUIREMENTS,
        team: [],
      };

      const mockDocument = {
        id: 'doc1',
        content: `# Requirements Document

## Introduction
This is a comprehensive requirements document with sufficient content for validation testing. The system provides authentication, project management, and collaboration features. This document outlines all functional and non-functional requirements needed for successful implementation and contains adequate detail.

## Requirements

### Requirement 1: User Authentication

**User Story:** As a user, I want to log in, so that I can access my account securely

#### Acceptance Criteria

1. WHEN user enters valid credentials THEN system SHALL authenticate user successfully
2. IF credentials are invalid THEN system SHALL display appropriate error message
3. WHEN user attempts multiple failed logins THEN system SHALL implement rate limiting
4. IF user forgets password THEN system SHALL provide secure password reset functionality

### Requirement 2: Project Management

**User Story:** As a project manager, I want to create and manage projects, so that I can organize my team's work effectively

#### Acceptance Criteria

1. WHEN user creates new project THEN system SHALL initialize project with default structure
2. IF user lacks permissions THEN system SHALL deny project creation
3. WHEN project is created THEN system SHALL notify team members automatically

This document meets all validation requirements including word count and proper formatting with comprehensive requirements coverage for the complete system functionality.`,
        projectId: 'project1',
        phase: SpecificationPhase.REQUIREMENTS,
      };

      mockPrisma.specificationProject.findFirst.mockResolvedValue(mockProject);
      mockPrisma.specificationProject.findUnique.mockResolvedValue(mockProject);
      mockPrisma.specificationDocument.findUnique.mockResolvedValue(mockDocument);
      mockRedis.keys.mockResolvedValue(['approval:project1:REQUIREMENTS:user1']);
      mockRedis.get.mockResolvedValue(
        JSON.stringify({
          userId: 'user1',
          timestamp: new Date(),
          approved: true,
        })
      );

      response = await request(app)
        .get('/api/projects/project1/workflow/can-transition/DESIGN')
        .expect(200);

      expect(response.body.canTransition).toBe(true);
    });

    it('should return false when transition is not allowed', async () => {
      const mockProject = {
        id: 'project1',
        ownerId: 'other-user',
        currentPhase: SpecificationPhase.REQUIREMENTS,
        team: [],
      };

      mockPrisma.specificationProject.findFirst.mockResolvedValue(mockProject);
      mockPrisma.specificationProject.findUnique.mockResolvedValue(mockProject);

      response = await request(app)
        .get('/api/projects/project1/workflow/can-transition/DESIGN')
        .expect(200);

      expect(response.body.canTransition).toBe(false);
      expect(response.body.reason).toBe('Insufficient permissions');
    });
  });

  describe('Complete Workflow API Integration', () => {
    it('should handle complete workflow progression through API', async () => {
      const projectId = 'project1';
      const userId = 'user1';

      const mockProject = {
        id: projectId,
        ownerId: userId,
        currentPhase: SpecificationPhase.REQUIREMENTS,
        team: [],
      };

      const mockDocument = {
        id: 'doc1',
        content: `# Requirements Document

## Introduction
This is a comprehensive requirements document with sufficient content for validation testing. The system provides authentication, project management, and collaboration features. This document outlines all functional and non-functional requirements needed for successful implementation and contains adequate detail.

## Requirements

### Requirement 1: User Authentication

**User Story:** As a user, I want to log in, so that I can access my account securely

#### Acceptance Criteria

1. WHEN user enters valid credentials THEN system SHALL authenticate user successfully
2. IF credentials are invalid THEN system SHALL display appropriate error message
3. WHEN user attempts multiple failed logins THEN system SHALL implement rate limiting
4. IF user forgets password THEN system SHALL provide secure password reset functionality

### Requirement 2: Project Management

**User Story:** As a project manager, I want to create and manage projects, so that I can organize my team's work effectively

#### Acceptance Criteria

1. WHEN user creates new project THEN system SHALL initialize project with default structure
2. IF user lacks permissions THEN system SHALL deny project creation
3. WHEN project is created THEN system SHALL notify team members automatically

This document meets all validation requirements including word count and proper formatting with comprehensive requirements coverage for the complete system functionality.`,
        projectId,
        phase: SpecificationPhase.REQUIREMENTS,
      };

      // Setup mocks for all API calls
      mockPrisma.specificationProject.findFirst.mockResolvedValue(mockProject);
      mockPrisma.specificationProject.findUnique.mockResolvedValue(mockProject);
      mockPrisma.specificationDocument.findUnique.mockResolvedValue(mockDocument);

      // Step 1: Validate phase completion
      response = await request(app)
        .get(`/api/projects/${projectId}/workflow/validate/REQUIREMENTS`)
        .expect(200);

      expect(response.body.isValid).toBe(true);
      expect(response.body.completionPercentage).toBe(100);

      // Step 2: Request approval
      mockRedis.setex.mockResolvedValue('OK');
      mockPrisma.auditLog.create.mockResolvedValue({});

      response = await request(app)
        .post(`/api/projects/${projectId}/workflow/approve`)
        .send({
          phase: SpecificationPhase.REQUIREMENTS,
          comment: 'Requirements look comprehensive and well-structured',
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Step 3: Check if can transition
      mockRedis.keys.mockResolvedValue([`approval:${projectId}:REQUIREMENTS:${userId}`]);
      mockRedis.get.mockResolvedValue(
        JSON.stringify({
          userId,
          timestamp: new Date(),
          approved: true,
        })
      );

      response = await request(app)
        .get(`/api/projects/${projectId}/workflow/can-transition/DESIGN`)
        .expect(200);

      expect(response.body.canTransition).toBe(true);

      // Step 4: Transition phase
      const mockUpdatedProject = {
        ...mockProject,
        currentPhase: SpecificationPhase.DESIGN,
      };

      mockPrisma.$transaction.mockImplementation(async callback => {
        return await callback({
          specificationProject: {
            update: vi.fn().mockResolvedValue(mockUpdatedProject),
          },
          specificationDocument: {
            updateMany: vi.fn(),
          },
          auditLog: {
            create: vi.fn(),
          },
        });
      });

      // Mock getWorkflowState for the final result
      mockPrisma.specificationProject.findUnique.mockResolvedValueOnce({
        ...mockUpdatedProject,
        documents: [
          { phase: SpecificationPhase.REQUIREMENTS, status: DocumentStatus.APPROVED },
          { phase: SpecificationPhase.DESIGN, status: DocumentStatus.DRAFT },
        ],
      });

      mockRedis.get.mockResolvedValueOnce(null); // No cache
      mockRedis.keys.mockResolvedValue([]); // No phase history
      mockRedis.setex.mockResolvedValue('OK');
      mockPrisma.user.findMany.mockResolvedValue([]);

      response = await request(app)
        .post(`/api/projects/${projectId}/workflow/transition`)
        .send({
          targetPhase: SpecificationPhase.DESIGN,
          approvalComment: 'Requirements approved, proceeding to design phase',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.workflowState.currentPhase).toBe(SpecificationPhase.DESIGN);

      // Step 5: Verify workflow state
      response = await request(app).get(`/api/projects/${projectId}/workflow/state`).expect(200);

      expect(response.body.currentPhase).toBe(SpecificationPhase.DESIGN);
      expect(response.body.documentStatuses[SpecificationPhase.REQUIREMENTS]).toBe(
        DocumentStatus.APPROVED
      );
      expect(response.body.documentStatuses[SpecificationPhase.DESIGN]).toBe(DocumentStatus.DRAFT);
    });
  });
});
