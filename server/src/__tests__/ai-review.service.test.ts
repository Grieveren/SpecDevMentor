import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { AIReviewService, type ReviewRequest } from '../services/ai-review.service.js';
import { AIService, type AIReviewResult } from '../services/ai.service.js';

let result: any;

// Mock Prisma
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(),
}));
const MockedPrismaClient = vi.mocked(PrismaClient);

// Mock AI Service
vi.mock('../services/ai.service.js');
const MockedAIService = vi.mocked(AIService);

describe('AIReviewService', () => {
  let aiReviewService: AIReviewService;
  let mockPrisma: unknown;
  let mockAIService: unknown;

  const mockAIReviewResult: AIReviewResult = {
    id: 'ai-review-123',
    overallScore: 85,
    suggestions: [
      {
        id: 'suggestion-1',
        type: 'improvement',
        severity: 'medium',
        title: 'Improve clarity',
        description: 'Make the requirement more specific',
        reasoning: 'Specific requirements are easier to test',
        category: 'clarity',
        originalText: 'The system should work',
        suggestedText: 'The system SHALL process user requests within 2 seconds',
      },
    ],
    completenessCheck: {
      score: 80,
      missingElements: ['Error handling'],
      recommendations: ['Add error scenarios'],
    },
    qualityMetrics: {
      clarity: 85,
      completeness: 80,
      consistency: 90,
      testability: 75,
      traceability: 85,
    },
    complianceIssues: [],
    generatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Prisma client
    mockPrisma = {
      aIReview: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
      },
      specificationDocument: {
        findUnique: vi.fn(),
      },
    };

    MockedPrismaClient.mockImplementation(() => mockPrisma);

    // Mock AI Service
    mockAIService = {
      reviewSpecification: vi.fn(),
      validateEARSFormat: vi.fn(),
      validateUserStories: vi.fn(),
    };

    MockedAIService.mockImplementation(() => mockAIService);

    aiReviewService = new AIReviewService(mockAIService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('requestReview', () => {
    const mockRequest: ReviewRequest = {
      documentId: 'doc-123',
      phase: 'requirements',
      content: 'Test specification content',
      projectId: 'project-123',
      userId: 'user-123',
    };

    it('should request AI review successfully', async () => {
      // Mock document access validation
      mockPrisma.specificationDocument.findUnique.mockResolvedValue({
        id: 'doc-123',
        project: {
          ownerId: 'user-123',
          team: [],
        },
      });

      // Mock AI service response
      mockAIService.reviewSpecification.mockResolvedValue(mockAIReviewResult);

      // Mock database creation
      mockPrisma.aIReview.create.mockResolvedValue({
        id: 'stored-review-123',
        documentId: 'doc-123',
        overallScore: 85,
        suggestions: mockAIReviewResult.suggestions,
        completeness: mockAIReviewResult.completenessCheck,
        qualityMetrics: mockAIReviewResult.qualityMetrics,
        appliedSuggestions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

       result = await aiReviewService.requestReview(mockRequest);

      expect(result).toBeDefined();
      expect(result.overallScore).toBe(85);
      expect(result.suggestions).toHaveLength(1);
      expect(mockAIService.reviewSpecification).toHaveBeenCalledWith(
        mockRequest.content,
        mockRequest.phase,
        mockRequest.projectId
      );
      expect(mockPrisma.aIReview.create).toHaveBeenCalled();
    });

    it('should validate document access', async () => {
      // Mock document not found
      mockPrisma.specificationDocument.findUnique.mockResolvedValue(null);

      await expect(aiReviewService.requestReview(mockRequest)).rejects.toThrow(
        'Failed to request AI review'
      );
    });

    it('should validate user access to document', async () => {
      // Mock document with no user access
      mockPrisma.specificationDocument.findUnique.mockResolvedValue({
        id: 'doc-123',
        project: {
          ownerId: 'other-user',
          team: [],
        },
      });

      await expect(aiReviewService.requestReview(mockRequest)).rejects.toThrow(
        'Failed to request AI review'
      );
    });

    it('should handle AI service errors', async () => {
      // Mock document access validation
      mockPrisma.specificationDocument.findUnique.mockResolvedValue({
        id: 'doc-123',
        project: {
          ownerId: 'user-123',
          team: [],
        },
      });

      // Mock AI service error
      mockAIService.reviewSpecification.mockRejectedValue(new Error('AI service failed'));

      await expect(aiReviewService.requestReview(mockRequest)).rejects.toThrow(
        'Failed to request AI review'
      );
    });
  });

  describe('getReview', () => {
    it('should get review by ID successfully', async () => {
      const reviewId = 'review-123';
      const userId = 'user-123';

      // Mock review retrieval
      mockPrisma.aIReview.findUnique.mockResolvedValue({
        id: reviewId,
        documentId: 'doc-123',
        overallScore: 85,
        suggestions: mockAIReviewResult.suggestions,
        completeness: mockAIReviewResult.completenessCheck,
        qualityMetrics: mockAIReviewResult.qualityMetrics,
        appliedSuggestions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mock document access validation
      mockPrisma.specificationDocument.findUnique.mockResolvedValue({
        id: 'doc-123',
        project: {
          ownerId: userId,
          team: [],
        },
      });

       result = await aiReviewService.getReview(reviewId, userId);

      expect(result).toBeDefined();
      expect(result?.id).toBe(reviewId);
      expect(result?.overallScore).toBe(85);
    });

    it('should return null for non-existent review', async () => {
      mockPrisma.aIReview.findUnique.mockResolvedValue(null);

       result = await aiReviewService.getReview('non-existent', 'user-123');

      expect(result).toBeNull();
    });
  });

  describe('getDocumentReviews', () => {
    it('should get document reviews with pagination', async () => {
      const documentId = 'doc-123';
      const userId = 'user-123';
      const options = { limit: 10, offset: 0 };

      // Mock document access validation
      mockPrisma.specificationDocument.findUnique.mockResolvedValue({
        id: documentId,
        project: {
          ownerId: userId,
          team: [],
        },
      });

      // Mock reviews retrieval
      const mockReviews = [
        {
          id: 'review-1',
          documentId,
          overallScore: 85,
          suggestions: [],
          completeness: {},
          qualityMetrics: {},
          appliedSuggestions: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'review-2',
          documentId,
          overallScore: 90,
          suggestions: [],
          completeness: {},
          qualityMetrics: {},
          appliedSuggestions: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrisma.aIReview.findMany.mockResolvedValue(mockReviews);
      mockPrisma.aIReview.count.mockResolvedValue(2);

       result = await aiReviewService.getDocumentReviews(documentId, userId, options);

      expect(result.reviews).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockPrisma.aIReview.findMany).toHaveBeenCalledWith({
        where: { documentId },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
      });
    });
  });

  describe('applySuggestion', () => {
    it('should apply suggestion successfully', async () => {
      const request = {
        reviewId: 'review-123',
        suggestionId: 'suggestion-1',
        documentContent: 'The system should work properly',
        userId: 'user-123',
      };

      // Mock review retrieval
      mockPrisma.aIReview.findUnique.mockResolvedValue({
        id: 'review-123',
        documentId: 'doc-123',
        suggestions: mockAIReviewResult.suggestions,
        appliedSuggestions: [],
      });

      // Mock document access validation
      mockPrisma.specificationDocument.findUnique.mockResolvedValue({
        id: 'doc-123',
        project: {
          ownerId: 'user-123',
          team: [],
        },
      });

      // Mock review update
      mockPrisma.aIReview.update.mockResolvedValue({});

       result = await aiReviewService.applySuggestion(request);

      expect(result.success).toBe(true);
      expect(result.modifiedContent).toContain('SHALL process user requests within 2 seconds');
      expect(mockPrisma.aIReview.update).toHaveBeenCalledWith({
        where: { id: 'review-123' },
        data: {
          appliedSuggestions: ['suggestion-1'],
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should handle non-existent review', async () => {
      const request = {
        reviewId: 'non-existent',
        suggestionId: 'suggestion-1',
        documentContent: 'content',
        userId: 'user-123',
      };

      mockPrisma.aIReview.findUnique.mockResolvedValue(null);

      await expect(aiReviewService.applySuggestion(request)).rejects.toThrow(
        'Failed to apply suggestion'
      );
    });

    it('should handle non-existent suggestion', async () => {
      const request = {
        reviewId: 'review-123',
        suggestionId: 'non-existent-suggestion',
        documentContent: 'content',
        userId: 'user-123',
      };

      mockPrisma.aIReview.findUnique.mockResolvedValue({
        id: 'review-123',
        documentId: 'doc-123',
        suggestions: mockAIReviewResult.suggestions,
        appliedSuggestions: [],
      });

      mockPrisma.specificationDocument.findUnique.mockResolvedValue({
        id: 'doc-123',
        project: {
          ownerId: 'user-123',
          team: [],
        },
      });

      await expect(aiReviewService.applySuggestion(request)).rejects.toThrow(
        'Failed to apply suggestion'
      );
    });
  });

  describe('rollbackSuggestion', () => {
    it('should rollback suggestion successfully', async () => {
      const request = {
        reviewId: 'review-123',
        suggestionId: 'suggestion-1',
        userId: 'user-123',
      };

      // Mock review retrieval
      mockPrisma.aIReview.findUnique.mockResolvedValue({
        id: 'review-123',
        documentId: 'doc-123',
        suggestions: mockAIReviewResult.suggestions,
        appliedSuggestions: ['suggestion-1'],
      });

      // Mock document access validation
      mockPrisma.specificationDocument.findUnique.mockResolvedValue({
        id: 'doc-123',
        project: {
          ownerId: 'user-123',
          team: [],
        },
      });

      // Mock review update
      mockPrisma.aIReview.update.mockResolvedValue({});

       result = await aiReviewService.rollbackSuggestion(request);

      expect(result.success).toBe(true);
      expect(result.originalContent).toBeDefined();
      expect(mockPrisma.aIReview.update).toHaveBeenCalledWith({
        where: { id: 'review-123' },
        data: {
          appliedSuggestions: [],
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should handle non-existent review for rollback', async () => {
      const request = {
        reviewId: 'non-existent',
        suggestionId: 'suggestion-1',
        userId: 'user-123',
      };

      mockPrisma.aIReview.findUnique.mockResolvedValue(null);

      await expect(aiReviewService.rollbackSuggestion(request)).rejects.toThrow(
        'Failed to rollback suggestion'
      );
    });
  });

  describe('Access Control', () => {
    it('should allow project owner access', async () => {
      const documentId = 'doc-123';
      const userId = 'owner-123';

      mockPrisma.specificationDocument.findUnique.mockResolvedValue({
        id: documentId,
        project: {
          ownerId: userId,
          team: [],
        },
      });

      // This should not throw
      await expect(
        (aiReviewService as any).validateDocumentAccess(documentId, userId)
      ).resolves.not.toThrow();
    });

    it('should allow team member access', async () => {
      const documentId = 'doc-123';
      const userId = 'team-member-123';

      mockPrisma.specificationDocument.findUnique.mockResolvedValue({
        id: documentId,
        project: {
          ownerId: 'owner-123',
          team: [{ userId, status: 'ACTIVE' }],
        },
      });

      // This should not throw
      await expect(
        (aiReviewService as any).validateDocumentAccess(documentId, userId)
      ).resolves.not.toThrow();
    });

    it('should deny access to unauthorized users', async () => {
      const documentId = 'doc-123';
      const userId = 'unauthorized-123';

      mockPrisma.specificationDocument.findUnique.mockResolvedValue({
        id: documentId,
        project: {
          ownerId: 'owner-123',
          team: [],
        },
      });

      await expect(
        (aiReviewService as any).validateDocumentAccess(documentId, userId)
      ).rejects.toThrow('Access denied to document');
    });
  });
});