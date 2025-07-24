import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { PrismaClient, SpecificationPhase, DocumentStatus, ProjectStatus } from '@prisma/client';
import Redis from 'ioredis';
import { 
  SpecificationWorkflowService, 
  SpecificationWorkflowError,
  PhaseTransitionRequest,
  DocumentUpdateRequest 
} from '../services/specification-workflow.service.js';

// Mock Redis
const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  keys: vi.fn(),
} as any;

// Mock Prisma
const mockPrisma = {
  specificationProject: {
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
  $transaction: vi.fn(),
} as any;

describe('SpecificationWorkflowService', () => {
  let service: SpecificationWorkflowService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SpecificationWorkflowService(mockPrisma, mockRedis);
  });

  describe('validatePhaseCompletion', () => {
    it('should return invalid when document not found', async () => {
      mockPrisma.specificationDocument.findUnique.mockResolvedValue(null);

      const result = await service.validatePhaseCompletion('project1', SpecificationPhase.REQUIREMENTS);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Document not found for phase');
      expect(result.completionPercentage).toBe(0);
    });

    it('should validate requirements document successfully', async () => {
      const mockDocument = {
        id: 'doc1',
        content: `# Requirements Document

## Introduction
This is a comprehensive test project for validating requirements documentation. The system will provide user authentication, project management, and collaboration features. This introduction provides sufficient context about the project scope and objectives to meet validation requirements.

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

This document contains comprehensive requirements with proper formatting, user stories, and acceptance criteria that meet all validation standards including minimum word count requirements for a complete specification document.`,
        projectId: 'project1',
        phase: SpecificationPhase.REQUIREMENTS,
      };

      mockPrisma.specificationDocument.findUnique.mockResolvedValue(mockDocument);

      const result = await service.validatePhaseCompletion('project1', SpecificationPhase.REQUIREMENTS);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.completionPercentage).toBeGreaterThan(0);
    });

    it('should identify missing required sections', async () => {
      const mockDocument = {
        id: 'doc1',
        content: 'This is a short document without proper sections.',
        projectId: 'project1',
        phase: SpecificationPhase.REQUIREMENTS,
      };

      mockPrisma.specificationDocument.findUnique.mockResolvedValue(mockDocument);

      const result = await service.validatePhaseCompletion('project1', SpecificationPhase.REQUIREMENTS);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing required section: Introduction');
      expect(result.errors).toContain('Missing required section: Requirements');
    });

    it('should identify insufficient word count', async () => {
      const mockDocument = {
        id: 'doc1',
        content: `# Requirements Document

## Introduction
Short intro.

## Requirements
One requirement.`,
        projectId: 'project1',
        phase: SpecificationPhase.REQUIREMENTS,
      };

      mockPrisma.specificationDocument.findUnique.mockResolvedValue(mockDocument);

      const result = await service.validatePhaseCompletion('project1', SpecificationPhase.REQUIREMENTS);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('Document too short'))).toBe(true);
    });

    it('should validate design document format', async () => {
      const mockDocument = {
        id: 'doc1',
        content: `# Design Document

## Overview
This is a comprehensive design document for our system that outlines the complete architecture and implementation approach. The system is designed to support specification-based development workflows with real-time collaboration, AI-powered assistance, and comprehensive project management capabilities. The architecture follows modern best practices for scalability, maintainability, and security. The system will serve as a platform for teams to collaborate on specification documents, manage project workflows, and ensure quality through automated validation and review processes.

## Architecture
The system follows a microservices architecture with the following components and detailed implementation specifications:
- API Gateway for request routing, authentication, and rate limiting with comprehensive security measures
- Authentication Service for user management, security, JWT token handling, and session management
- User Service for user profile management, preferences, and team collaboration features
- Project Service for specification project management, workflow orchestration, and document handling
- Workflow Service for phase transition management, validation rules, and approval processes
- Database Layer with PostgreSQL for reliable data persistence and complex query support
- Redis Cache for session management, performance optimization, and real-time collaboration state
- WebSocket Service using Socket.IO for real-time collaboration and live document editing
- AI Integration Service for specification review, validation, and quality assessment
- File Storage Service for document versioning, backup, and recovery capabilities

## Components
Each component has well-defined interfaces, responsibilities, and integration patterns:
- Frontend React application with TypeScript providing a modern, responsive user interface
- Backend Node.js services with Express framework ensuring robust API development
- Database layer with Prisma ORM for type-safe database operations and migrations
- Real-time collaboration using Socket.IO for seamless multi-user editing experiences
- AI integration for specification review, validation, and automated quality assessment
- Security middleware for authentication, authorization, and data protection
- Monitoring and logging components for system observability and debugging
- Testing framework with comprehensive unit, integration, and end-to-end test coverage
- Deployment infrastructure using Docker containers and orchestration platforms
- CI/CD pipeline for automated testing, building, and deployment processes

## Data Models
The system uses PostgreSQL for data persistence with comprehensive data models:
- User model with authentication, profile information, preferences, and security settings
- Project model with specification workflow state, team management, and access controls
- Document model with version history, collaboration features, and content management
- Team model for project collaboration, permissions, and role-based access control
- Workflow model for phase management, transition rules, and approval processes
- Comment model for collaborative feedback, discussions, and review processes
- Analytics model for tracking usage, performance metrics, and system insights

## API Design
RESTful API endpoints are designed following OpenAPI specification with comprehensive error handling, validation, input sanitization, and proper HTTP status codes. The API includes authentication endpoints, project management endpoints, document manipulation endpoints, workflow management endpoints, and real-time collaboration endpoints.

This document contains comprehensive detail and meets all requirements for a complete design phase document with sufficient word count, proper section organization, and detailed technical specifications for successful implementation. The architecture provides scalability, maintainability, and security considerations for enterprise-level deployment.`,
        projectId: 'project1',
        phase: SpecificationPhase.DESIGN,
      };

      mockPrisma.specificationDocument.findUnique.mockResolvedValue(mockDocument);

      const result = await service.validatePhaseCompletion('project1', SpecificationPhase.DESIGN);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate tasks document format', async () => {
      const mockDocument = {
        id: 'doc1',
        content: `# Implementation Plan

- [ ] 1. Set up project foundation and development environment
  - [ ] 1.1 Initialize repository and project structure
    - Create monorepo structure with proper workspace configuration
    - Set up build tools including TypeScript, ESLint, and Prettier
    - Configure package management with pnpm workspaces
    - Set up Git hooks for code quality enforcement
    - _Requirements: 1.1, 1.2_
  
  - [ ] 1.2 Configure development environment and infrastructure
    - Set up Docker containers for development and testing
    - Configure PostgreSQL database with proper schemas
    - Set up Redis for caching and session management
    - Configure environment variables and secrets management
    - _Requirements: 1.3_

- [ ] 2. Implement comprehensive authentication system
  - [ ] 2.1 Create user model and database schema
    - Design comprehensive database schema for user management
    - Implement user model with validation and security features
    - Create authentication middleware and JWT token handling
    - Set up password hashing and security measures
    - _Requirements: 2.1, 2.2_

  - [ ] 2.2 Build authentication API endpoints
    - Implement user registration with email verification
    - Create secure login and logout functionality
    - Add password reset and recovery features
    - Implement session management and token refresh
    - _Requirements: 2.3, 2.4_

- [ ] 3. Develop project management system
  - [ ] 3.1 Create project data models and API
    - Design project schema with workflow state management
    - Implement project CRUD operations with proper validation
    - Add team management and permission systems
    - Create project analytics and reporting features
    - _Requirements: 3.1, 3.2_

- [ ] 4. Build specification workflow system
  - [ ] 4.1 Implement phase management and validation
    - Create workflow state machine for phase transitions
    - Implement validation rules for each specification phase
    - Add approval workflow and permission checking
    - Create audit logging for workflow operations
    - _Requirements: 4.1, 4.2_

This comprehensive implementation plan provides a structured approach to building the complete system with proper task organization, detailed specifications, and comprehensive requirement traceability for successful project delivery.`,
        projectId: 'project1',
        phase: SpecificationPhase.TASKS,
      };

      mockPrisma.specificationDocument.findUnique.mockResolvedValue(mockDocument);

      const result = await service.validatePhaseCompletion('project1', SpecificationPhase.TASKS);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('canTransitionToPhase', () => {
    it('should return false when project not found', async () => {
      mockPrisma.specificationProject.findUnique.mockResolvedValue(null);

      const result = await service.canTransitionToPhase('project1', SpecificationPhase.DESIGN, 'user1');

      expect(result.canTransition).toBe(false);
      expect(result.reason).toBe('Project not found');
    });

    it('should return false when user has insufficient permissions', async () => {
      const mockProject = {
        id: 'project1',
        ownerId: 'owner1',
        currentPhase: SpecificationPhase.REQUIREMENTS,
        team: [],
      };

      mockPrisma.specificationProject.findUnique.mockResolvedValue(mockProject);

      const result = await service.canTransitionToPhase('project1', SpecificationPhase.DESIGN, 'user1');

      expect(result.canTransition).toBe(false);
      expect(result.reason).toBe('Insufficient permissions');
    });

    it('should return false for invalid phase transition', async () => {
      const mockProject = {
        id: 'project1',
        ownerId: 'user1',
        currentPhase: SpecificationPhase.REQUIREMENTS,
        team: [],
      };

      mockPrisma.specificationProject.findUnique.mockResolvedValue(mockProject);

      const result = await service.canTransitionToPhase('project1', SpecificationPhase.TASKS, 'user1');

      expect(result.canTransition).toBe(false);
      expect(result.reason).toBe('Invalid phase transition. Phases must be sequential');
    });

    it('should allow project owner to transition', async () => {
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

      mockPrisma.specificationProject.findUnique.mockResolvedValue(mockProject);
      mockPrisma.specificationDocument.findUnique.mockResolvedValue(mockDocument);
      mockRedis.keys.mockResolvedValue(['approval:project1:REQUIREMENTS:user1']);
      mockRedis.get.mockResolvedValue(JSON.stringify({
        userId: 'user1',
        timestamp: new Date(),
        approved: true,
      }));

      const result = await service.canTransitionToPhase('project1', SpecificationPhase.DESIGN, 'user1');

      expect(result.canTransition).toBe(true);
    });

    it('should allow team lead to transition', async () => {
      const mockProject = {
        id: 'project1',
        ownerId: 'owner1',
        currentPhase: SpecificationPhase.REQUIREMENTS,
        team: [{
          userId: 'user1',
          role: 'LEAD',
          status: 'ACTIVE',
        }],
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

      mockPrisma.specificationProject.findUnique.mockResolvedValue(mockProject);
      mockPrisma.specificationDocument.findUnique.mockResolvedValue(mockDocument);
      mockRedis.keys.mockResolvedValue(['approval:project1:REQUIREMENTS:user1']);
      mockRedis.get.mockResolvedValue(JSON.stringify({
        userId: 'user1',
        timestamp: new Date(),
        approved: true,
      }));

      const result = await service.canTransitionToPhase('project1', SpecificationPhase.DESIGN, 'user1');

      expect(result.canTransition).toBe(true);
    });
  });

  describe('transitionPhase', () => {
    it('should throw error when transition not allowed', async () => {
      const mockProject = {
        id: 'project1',
        ownerId: 'owner1',
        currentPhase: SpecificationPhase.REQUIREMENTS,
        team: [],
      };

      mockPrisma.specificationProject.findUnique.mockResolvedValue(mockProject);

      const request: PhaseTransitionRequest = {
        targetPhase: SpecificationPhase.DESIGN,
        approvalComment: 'Ready to proceed',
      };

      await expect(
        service.transitionPhase('project1', request, 'user1')
      ).rejects.toThrow(SpecificationWorkflowError);
    });

    it('should successfully transition phase', async () => {
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

      mockPrisma.specificationProject.findUnique
        .mockResolvedValueOnce(mockProject)
        .mockResolvedValueOnce(mockUpdatedProject);
      mockPrisma.specificationDocument.findUnique.mockResolvedValue(mockDocument);
      
      // Mock approvals for canTransitionToPhase check
      mockRedis.keys
        .mockResolvedValue(['approval:project1:REQUIREMENTS:user1']); // Always return approval
      
      mockRedis.get.mockResolvedValue(JSON.stringify({
        userId: 'user1',
        timestamp: new Date(),
        approved: true,
      }));

      mockPrisma.$transaction.mockImplementation(async (callback) => {
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

      const request: PhaseTransitionRequest = {
        targetPhase: SpecificationPhase.DESIGN,
        approvalComment: 'Requirements approved',
      };

      // Mock the getWorkflowState call that happens at the end
      const mockWorkflowState = {
        projectId: 'project1',
        currentPhase: SpecificationPhase.DESIGN,
        phaseHistory: [],
        documentStatuses: {
          [SpecificationPhase.REQUIREMENTS]: 'APPROVED',
          [SpecificationPhase.DESIGN]: 'DRAFT',
        },
        approvals: {
          [SpecificationPhase.REQUIREMENTS]: [],
          [SpecificationPhase.DESIGN]: [],
          [SpecificationPhase.TASKS]: [],
          [SpecificationPhase.IMPLEMENTATION]: [],
        },
        canProgress: false,
      };
      
      // Add a third call for getWorkflowState
      mockPrisma.specificationProject.findUnique
        .mockResolvedValueOnce({
          ...mockUpdatedProject,
          documents: [
            { phase: SpecificationPhase.REQUIREMENTS, status: 'APPROVED' },
            { phase: SpecificationPhase.DESIGN, status: 'DRAFT' },
          ],
        });

      // Mock the workflow state cache and retrieval
      mockRedis.get.mockResolvedValueOnce(null); // No cache
      mockRedis.keys.mockResolvedValue([]); // No phase history or approvals
      mockRedis.setex.mockResolvedValue('OK'); // Cache set

      const result = await service.transitionPhase('project1', request, 'user1');

      expect(result.currentPhase).toBe(SpecificationPhase.DESIGN);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('updateDocument', () => {
    it('should throw error when user has insufficient permissions', async () => {
      const mockProject = {
        id: 'project1',
        ownerId: 'owner1',
        team: [], // Empty team means user1 is not a team member
      };

      mockPrisma.specificationProject.findUnique.mockResolvedValue(mockProject);

      const request: DocumentUpdateRequest = {
        content: 'Updated content',
      };

      await expect(
        service.updateDocument('project1', SpecificationPhase.REQUIREMENTS, request, 'user1')
      ).rejects.toThrow(SpecificationWorkflowError);
    });

    it('should throw error when document not found', async () => {
      const mockProject = {
        id: 'project1',
        ownerId: 'user1',
        team: [],
      };

      mockPrisma.specificationProject.findUnique.mockResolvedValue(mockProject);
      mockPrisma.specificationDocument.findUnique.mockResolvedValue(null);

      const request: DocumentUpdateRequest = {
        content: 'Updated content',
      };

      await expect(
        service.updateDocument('project1', SpecificationPhase.REQUIREMENTS, request, 'user1')
      ).rejects.toThrow(SpecificationWorkflowError);
    });

    it('should successfully update document', async () => {
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

      mockPrisma.specificationProject.findUnique.mockResolvedValue(mockProject);
      mockPrisma.specificationDocument.findUnique.mockResolvedValue(mockDocument);
      mockPrisma.documentVersion.create.mockResolvedValue({});
      mockPrisma.specificationDocument.update.mockResolvedValue(mockUpdatedDocument);
      mockPrisma.auditLog.create.mockResolvedValue({});

      const request: DocumentUpdateRequest = {
        content: 'Updated content',
      };

      const result = await service.updateDocument('project1', SpecificationPhase.REQUIREMENTS, request, 'user1');

      expect(result.content).toBe('Updated content');
      expect(result.version).toBe(2);
      expect(mockPrisma.documentVersion.create).toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });
  });

  describe('approvePhase', () => {
    it('should store approval in Redis', async () => {
      mockRedis.setex.mockResolvedValue('OK');
      mockPrisma.auditLog.create.mockResolvedValue({});

      await service.approvePhase('project1', SpecificationPhase.REQUIREMENTS, 'user1', 'Looks good');

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'approval:project1:REQUIREMENTS:user1',
        86400,
        expect.stringContaining('"approved":true')
      );
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });
  });

  describe('getWorkflowState', () => {
    it('should return cached workflow state', async () => {
      const mockWorkflowState = {
        projectId: 'project1',
        currentPhase: SpecificationPhase.REQUIREMENTS,
        phaseHistory: [],
        documentStatuses: {},
        approvals: {},
        canProgress: false,
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(mockWorkflowState));

      const result = await service.getWorkflowState('project1');

      expect(result).toEqual(mockWorkflowState);
      expect(mockRedis.get).toHaveBeenCalledWith('workflow:project1');
      // Should not call database when cache hit
      expect(mockPrisma.specificationProject.findUnique).not.toHaveBeenCalled();
    });

    it('should build workflow state from database', async () => {
      const mockProject = {
        id: 'project1',
        ownerId: 'user1',
        currentPhase: SpecificationPhase.REQUIREMENTS,
        documents: [
          { phase: SpecificationPhase.REQUIREMENTS, status: DocumentStatus.DRAFT },
          { phase: SpecificationPhase.DESIGN, status: DocumentStatus.DRAFT },
        ],
      };

      mockRedis.get.mockResolvedValue(null);
      mockPrisma.specificationProject.findUnique.mockResolvedValue(mockProject);
      mockRedis.keys.mockResolvedValue([]);
      mockRedis.setex.mockResolvedValue('OK');

      const result = await service.getWorkflowState('project1');

      expect(result.projectId).toBe('project1');
      expect(result.currentPhase).toBe(SpecificationPhase.REQUIREMENTS);
      expect(result.documentStatuses[SpecificationPhase.REQUIREMENTS]).toBe(DocumentStatus.DRAFT);
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should throw error when project not found', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.specificationProject.findUnique.mockResolvedValue(null);

      await expect(
        service.getWorkflowState('project1')
      ).rejects.toThrow(SpecificationWorkflowError);
    });

    it('should determine canProgress correctly', async () => {
      const mockProject = {
        id: 'project1',
        ownerId: 'user1',
        currentPhase: SpecificationPhase.REQUIREMENTS,
        documents: [
          { phase: SpecificationPhase.REQUIREMENTS, status: DocumentStatus.APPROVED },
          { phase: SpecificationPhase.DESIGN, status: DocumentStatus.DRAFT },
        ],
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

      mockRedis.get.mockResolvedValue(null);
      mockPrisma.specificationProject.findUnique.mockResolvedValue(mockProject);
      mockPrisma.specificationDocument.findUnique.mockResolvedValue(mockDocument);
      mockRedis.keys.mockResolvedValue(['approval:project1:REQUIREMENTS:user1']);
      mockRedis.get.mockResolvedValue(JSON.stringify({
        userId: 'user1',
        timestamp: new Date(),
        approved: true,
      }));
      mockRedis.setex.mockResolvedValue('OK');

      const result = await service.getWorkflowState('project1');

      expect(result.canProgress).toBe(true);
      expect(result.nextPhase).toBe(SpecificationPhase.DESIGN);
    });
  });

  describe('Complete Workflow Integration', () => {
    it('should handle complete phase validation and approval workflow', async () => {
      const projectId = 'project1';
      const userId = 'user1';
      
      // Mock project setup
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

      mockPrisma.specificationProject.findUnique.mockResolvedValue(mockProject);
      mockPrisma.specificationDocument.findUnique.mockResolvedValue(mockDocument);

      // Step 1: Validate phase completion
      const validation = await service.validatePhaseCompletion(projectId, SpecificationPhase.REQUIREMENTS);
      expect(validation.isValid).toBe(true);
      expect(validation.completionPercentage).toBe(100);

      // Step 2: Request approval
      mockRedis.setex.mockResolvedValue('OK');
      mockPrisma.auditLog.create.mockResolvedValue({});

      await service.approvePhase(projectId, SpecificationPhase.REQUIREMENTS, userId, 'Requirements look good');

      expect(mockRedis.setex).toHaveBeenCalledWith(
        `approval:${projectId}:REQUIREMENTS:${userId}`,
        86400,
        expect.stringContaining('"approved":true')
      );

      // Step 3: Check if can transition
      mockRedis.keys.mockResolvedValue([`approval:${projectId}:REQUIREMENTS:${userId}`]);
      mockRedis.get.mockResolvedValue(JSON.stringify({
        userId,
        timestamp: new Date(),
        approved: true,
      }));

      const canTransition = await service.canTransitionToPhase(projectId, SpecificationPhase.DESIGN, userId);
      expect(canTransition.canTransition).toBe(true);

      // Step 4: Transition phase
      const updatedProject = {
        ...mockProject,
        currentPhase: SpecificationPhase.DESIGN,
      };

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return await callback({
          specificationProject: {
            update: vi.fn().mockResolvedValue(updatedProject),
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
        ...updatedProject,
        documents: [
          { phase: SpecificationPhase.REQUIREMENTS, status: DocumentStatus.APPROVED },
          { phase: SpecificationPhase.DESIGN, status: DocumentStatus.DRAFT },
        ],
      });

      const request: PhaseTransitionRequest = {
        targetPhase: SpecificationPhase.DESIGN,
        approvalComment: 'Requirements approved, moving to design',
      };

      const result = await service.transitionPhase(projectId, request, userId);

      expect(result.currentPhase).toBe(SpecificationPhase.DESIGN);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should prevent transition without proper validation', async () => {
      const projectId = 'project1';
      const userId = 'user1';
      
      const mockProject = {
        id: projectId,
        ownerId: userId,
        currentPhase: SpecificationPhase.REQUIREMENTS,
        team: [],
      };

      // Mock document with validation errors
      const mockDocument = {
        id: 'doc1',
        content: 'Short document without proper sections.',
        projectId,
        phase: SpecificationPhase.REQUIREMENTS,
      };

      mockPrisma.specificationProject.findUnique.mockResolvedValue(mockProject);
      mockPrisma.specificationDocument.findUnique.mockResolvedValue(mockDocument);

      const canTransition = await service.canTransitionToPhase(projectId, SpecificationPhase.DESIGN, userId);
      
      expect(canTransition.canTransition).toBe(false);
      expect(canTransition.reason).toContain('Current phase validation failed');
    });

    it('should prevent transition without sufficient approvals', async () => {
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

      mockPrisma.specificationProject.findUnique.mockResolvedValue(mockProject);
      mockPrisma.specificationDocument.findUnique.mockResolvedValue(mockDocument);
      mockRedis.keys.mockResolvedValue([]); // No approvals

      const canTransition = await service.canTransitionToPhase(projectId, SpecificationPhase.DESIGN, userId);
      
      expect(canTransition.canTransition).toBe(false);
      expect(canTransition.reason).toContain('Insufficient approvals');
    });
  });
});