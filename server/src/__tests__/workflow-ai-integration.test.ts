import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient, SpecificationPhase, DocumentStatus } from '@prisma/client';
import Redis from 'ioredis';
import { SpecificationWorkflowService } from '../services/specification-workflow.service';
import { AIService, AIReviewResult } from '../services/ai.service';

// Mock dependencies
vi.mock('ioredis');
vi.mock('../services/ai.service');

describe('Workflow-AI Integration', () => {
  let prisma: PrismaClient;
  let redis: Redis;
  let aiService: any;
  let workflowService: SpecificationWorkflowService;

  const mockProject = {
    id: 'project-1',
    name: 'Test Project',
    ownerId: 'user-1',
    currentPhase: SpecificationPhase.REQUIREMENTS,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDocument = {
    id: 'doc-1',
    projectId: 'project-1',
    phase: SpecificationPhase.REQUIREMENTS,
    content: `# Requirements Document

## Introduction
This is a test requirements document.

## Requirements

### Requirement 1
**User Story:** As a user, I want to login, so that I can access the system.

#### Acceptance Criteria
1. WHEN user enters valid credentials THEN system SHALL authenticate user
2. WHEN user enters invalid credentials THEN system SHALL show error message
`,
    version: 1,
    status: DocumentStatus.DRAFT,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAIReview: AIReviewResult = {
    id: 'ai-review-1',
    overallScore: 85,
    suggestions: [
      {
        id: 'suggestion-1',
        type: 'improvement',
        severity: 'medium',
        title: 'Add more detailed acceptance criteria',
        description: 'Consider adding more specific acceptance criteria for edge cases',
        reasoning: 'More detailed criteria improve testability',
        category: 'completeness',
      },
    ],
    completenessCheck: {
      score: 80,
      missingElements: ['Error handling requirements'],
      recommendations: ['Add security requirements', 'Include performance criteria'],
    },
    qualityMetrics: {
      clarity: 85,
      completeness: 80,
      consistency: 90,
      testability: 75,
      traceability: 85,
    },
    complianceIssues: [
      {
        id: 'compliance-1',
        type: 'ears_format',
        severity: 'low',
        description: 'Some acceptance criteria could use better EARS format',
        suggestion: 'Use WHEN/THEN/SHALL structure consistently',
      },
    ],
    generatedAt: new Date(),
  };

  beforeEach(() => {
    // Setup mocks
    prisma = {
      specificationProject: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      specificationDocument: {
        findUnique: vi.fn(),
        updateMany: vi.fn(),
      },
      aIReview: {
        create: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      $transaction: vi.fn(),
    } as any;

    redis = {
      get: vi.fn(),
      setex: vi.fn(),
      keys: vi.fn(),
      del: vi.fn(),
    } as any;

    aiService = {
      reviewSpecification: vi.fn(),
      validateEARSFormat: vi.fn(),
      validateUserStories: vi.fn(),
    } as any;

    workflowService = new SpecificationWorkflowService(prisma, redis, aiService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('validatePhaseCompletion with AI integration', () => {
    it('should include AI validation in phase completion check', async () => {
      // Setup mocks
      (prisma.specificationDocument.findUnique as any).mockResolvedValue(mockDocument);
      (aiService.reviewSpecification as any).mockResolvedValue(mockAIReview);

      // Execute
      const result = await workflowService.validatePhaseCompletion(
        'project-1',
        SpecificationPhase.REQUIREMENTS
      );

      // Verify AI service was called
      expect(aiService.reviewSpecification).toHaveBeenCalledWith(
        mockDocument.content,
        'requirements',
        'project-1'
      );

      // Verify AI review is included in result
      expect(result.aiReview).toEqual(mockAIReview);
      expect(result.aiValidationScore).toBe(85);

      // Verify AI suggestions are included as warnings/errors
      expect(result.warnings.some(warning => 
        warning.includes('AI: Add more detailed acceptance criteria')
      )).toBe(true);
      expect(result.warnings.some(warning => 
        warning.includes('AI Compliance: Some acceptance criteria could use better EARS format')
      )).toBe(true);
    });

    it('should handle AI service failures gracefully', async () => {
      // Setup mocks
      (prisma.specificationDocument.findUnique as any).mockResolvedValue(mockDocument);
      (aiService.reviewSpecification as any).mockRejectedValue(new Error('AI service unavailable'));

      // Execute
      const result = await workflowService.validatePhaseCompletion(
        'project-1',
        SpecificationPhase.REQUIREMENTS
      );

      // Verify AI failure doesn't break validation
      expect(result.warnings).toContain('AI validation temporarily unavailable');
      expect(result.aiReview).toBeUndefined();
      expect(result.aiValidationScore).toBeUndefined();
    });

    it('should adjust completion percentage based on AI validation', async () => {
      // Setup mocks with low AI score
      const lowScoreAIReview = { ...mockAIReview, overallScore: 60 };
      (prisma.specificationDocument.findUnique as any).mockResolvedValue(mockDocument);
      (aiService.reviewSpecification as any).mockResolvedValue(lowScoreAIReview);

      // Execute
      const result = await workflowService.validatePhaseCompletion(
        'project-1',
        SpecificationPhase.REQUIREMENTS
      );

      // Verify completion percentage is affected by AI score
      expect(result.completionPercentage).toBeLessThan(100);
      expect(result.aiValidationScore).toBe(60);
    });
  });

  describe('triggerAutoAIReview', () => {
    it('should trigger AI review and store results', async () => {
      // Setup mocks
      (prisma.specificationDocument.findUnique as any).mockResolvedValue(mockDocument);
      (aiService.reviewSpecification as any).mockResolvedValue(mockAIReview);
      (prisma.aIReview.create as any).mockResolvedValue({});
      (prisma.auditLog.create as any).mockResolvedValue({});

      // Execute
      const result = await workflowService.triggerAutoAIReview(
        'project-1',
        SpecificationPhase.REQUIREMENTS,
        'user-1'
      );

      // Verify AI service was called
      expect(aiService.reviewSpecification).toHaveBeenCalledWith(
        mockDocument.content,
        'requirements',
        'project-1'
      );

      // Verify AI review was stored
      expect(prisma.aIReview.create).toHaveBeenCalledWith({
        data: {
          id: mockAIReview.id,
          documentId: mockDocument.id,
          overallScore: mockAIReview.overallScore,
          suggestions: mockAIReview.suggestions,
          completeness: mockAIReview.completenessCheck,
          qualityMetrics: mockAIReview.qualityMetrics,
          appliedSuggestions: [],
        },
      });

      // Verify audit log was created
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          action: 'auto_ai_review',
          resource: 'document',
          resourceId: mockDocument.id,
          details: {
            phase: SpecificationPhase.REQUIREMENTS,
            projectId: 'project-1',
            overallScore: 85,
            suggestionsCount: 1,
            trigger: 'phase_transition',
          },
          success: true,
        },
      });

      expect(result).toEqual(mockAIReview);
    });

    it('should handle AI review failures and log them', async () => {
      // Setup mocks
      (prisma.specificationDocument.findUnique as any).mockResolvedValue(mockDocument);
      (aiService.reviewSpecification as any).mockRejectedValue(new Error('AI service error'));
      (prisma.auditLog.create as any).mockResolvedValue({});

      // Execute
      const result = await workflowService.triggerAutoAIReview(
        'project-1',
        SpecificationPhase.REQUIREMENTS,
        'user-1'
      );

      // Verify failure was logged
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          action: 'auto_ai_review',
          resource: 'document',
          resourceId: 'project-1',
          details: {
            phase: SpecificationPhase.REQUIREMENTS,
            projectId: 'project-1',
            error: 'AI service error',
            trigger: 'phase_transition',
          },
          success: false,
        },
      });

      expect(result).toBeNull();
    });

    it('should return null if document not found', async () => {
      // Setup mocks
      (prisma.specificationDocument.findUnique as any).mockResolvedValue(null);

      // Execute
      const result = await workflowService.triggerAutoAIReview(
        'project-1',
        SpecificationPhase.REQUIREMENTS,
        'user-1'
      );

      expect(result).toBeNull();
      expect(aiService.reviewSpecification).not.toHaveBeenCalled();
    });
  });

  describe('getPhaseAIValidation', () => {
    it('should return AI validation results', async () => {
      // Setup mocks
      (prisma.specificationDocument.findUnique as any).mockResolvedValue(mockDocument);
      (aiService.reviewSpecification as any).mockResolvedValue(mockAIReview);

      // Execute
      const result = await workflowService.getPhaseAIValidation(
        'project-1',
        SpecificationPhase.REQUIREMENTS
      );

      // Verify result
      expect(result.isValid).toBe(true); // Score 85 >= 70 and no high severity issues
      expect(result.score).toBe(85);
      expect(result.issues).toEqual([]);
    });

    it('should identify high severity issues as validation failures', async () => {
      // Setup mocks with high severity issues
      const highSeverityReview = {
        ...mockAIReview,
        suggestions: [
          {
            ...mockAIReview.suggestions[0],
            severity: 'high' as const,
          },
        ],
        complianceIssues: [
          {
            ...mockAIReview.complianceIssues[0],
            severity: 'high' as const,
          },
        ],
      };

      (prisma.specificationDocument.findUnique as any).mockResolvedValue(mockDocument);
      (aiService.reviewSpecification as any).mockResolvedValue(highSeverityReview);

      // Execute
      const result = await workflowService.getPhaseAIValidation(
        'project-1',
        SpecificationPhase.REQUIREMENTS
      );

      // Verify result
      expect(result.isValid).toBe(false);
      expect(result.score).toBe(85);
      expect(result.issues).toHaveLength(2);
      expect(result.issues[0]).toContain('Add more detailed acceptance criteria');
      expect(result.issues[1]).toContain('ears_format');
    });

    it('should return default values when AI service is not available', async () => {
      // Create service without AI
      const serviceWithoutAI = new SpecificationWorkflowService(prisma, redis);

      // Execute
      const result = await serviceWithoutAI.getPhaseAIValidation(
        'project-1',
        SpecificationPhase.REQUIREMENTS
      );

      // Verify default result
      expect(result.isValid).toBe(true);
      expect(result.score).toBe(100);
      expect(result.issues).toEqual([]);
    });
  });

  describe('transitionPhase with AI integration', () => {
    it('should trigger automatic AI review after phase transition', async () => {
      // Setup mocks
      const mockTransactionFn = vi.fn().mockImplementation(async (callback) => {
        return await callback({
          specificationProject: { update: vi.fn() },
          specificationDocument: { updateMany: vi.fn() },
          auditLog: { create: vi.fn() },
        });
      });

      (prisma.$transaction as any).mockImplementation(mockTransactionFn);
      (prisma.specificationProject.findUnique as any).mockResolvedValue(mockProject);
      (prisma.specificationDocument.findUnique as any).mockResolvedValue(mockDocument);
      (aiService.reviewSpecification as any).mockResolvedValue(mockAIReview);
      (prisma.aIReview.create as any).mockResolvedValue({});
      (prisma.auditLog.create as any).mockResolvedValue({});
      (redis.keys as any).mockResolvedValue([]);

      // Mock canTransitionToPhase to return true
      vi.spyOn(workflowService, 'canTransitionToPhase').mockResolvedValue({
        canTransition: true,
      });

      // Mock getWorkflowState
      vi.spyOn(workflowService, 'getWorkflowState').mockResolvedValue({
        projectId: 'project-1',
        currentPhase: SpecificationPhase.DESIGN,
        phaseHistory: [],
        documentStatuses: {} as any,
        approvals: {} as any,
        canProgress: false,
      });

      // Execute
      await workflowService.transitionPhase(
        'project-1',
        { targetPhase: SpecificationPhase.DESIGN },
        'user-1'
      );

      // Verify AI review was triggered for the new phase
      expect(aiService.reviewSpecification).toHaveBeenCalled();
    });

    it('should not fail transition if AI review fails', async () => {
      // Setup mocks
      const mockTransactionFn = vi.fn().mockImplementation(async (callback) => {
        return await callback({
          specificationProject: { update: vi.fn() },
          specificationDocument: { updateMany: vi.fn() },
          auditLog: { create: vi.fn() },
        });
      });

      (prisma.$transaction as any).mockImplementation(mockTransactionFn);
      (prisma.specificationProject.findUnique as any).mockResolvedValue(mockProject);
      (prisma.specificationDocument.findUnique as any).mockResolvedValue(mockDocument);
      (aiService.reviewSpecification as any).mockRejectedValue(new Error('AI service error'));
      (redis.keys as any).mockResolvedValue([]);

      // Mock canTransitionToPhase to return true
      vi.spyOn(workflowService, 'canTransitionToPhase').mockResolvedValue({
        canTransition: true,
      });

      // Mock getWorkflowState
      vi.spyOn(workflowService, 'getWorkflowState').mockResolvedValue({
        projectId: 'project-1',
        currentPhase: SpecificationPhase.DESIGN,
        phaseHistory: [],
        documentStatuses: {} as any,
        approvals: {} as any,
        canProgress: false,
      });

      // Execute - should not throw
      await expect(
        workflowService.transitionPhase(
          'project-1',
          { targetPhase: SpecificationPhase.DESIGN },
          'user-1'
        )
      ).resolves.not.toThrow();

      // Verify transaction still completed
      expect(mockTransactionFn).toHaveBeenCalled();
    });
  });

  describe('mapPhaseToAIPhase', () => {
    it('should map specification phases to AI phases correctly', () => {
      // Access private method through any cast for testing
      const service = workflowService as any;

      expect(service.mapPhaseToAIPhase(SpecificationPhase.REQUIREMENTS)).toBe('requirements');
      expect(service.mapPhaseToAIPhase(SpecificationPhase.DESIGN)).toBe('design');
      expect(service.mapPhaseToAIPhase(SpecificationPhase.TASKS)).toBe('tasks');
      expect(service.mapPhaseToAIPhase(SpecificationPhase.IMPLEMENTATION)).toBe('tasks');
    });
  });
});