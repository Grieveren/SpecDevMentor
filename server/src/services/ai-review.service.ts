// Defer PrismaClient resolution to accommodate module mocks in tests
// Import enums via require to avoid ESM __esModule issues in mocks
import type { PrismaClient as PrismaClientType } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { AIService, type AIReviewResult, type AISuggestion } from './ai.service.js';
import crypto from 'crypto';

// Types
export interface ReviewRequest {
  documentId: string;
  phase: 'requirements' | 'design' | 'tasks';
  content: string;
  projectId?: string;
  userId: string;
}

export interface ApplySuggestionRequest {
  reviewId: string;
  suggestionId: string;
  documentContent: string;
  userId: string;
}

export interface RollbackSuggestionRequest {
  reviewId: string;
  suggestionId: string;
  userId: string;
}

export interface StoredAIReview {
  id: string;
  documentId: string;
  userId: string;
  phase: string;
  overallScore: number;
  suggestions: AISuggestion[];
  completenessCheck: unknown;
  qualityMetrics: unknown;
  complianceIssues: any[];
  appliedSuggestions: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SuggestionApplication {
  id: string;
  reviewId: string;
  suggestionId: string;
  originalContent: string;
  modifiedContent: string;
  appliedAt: Date;
  appliedBy: string;
}

export interface PaginationOptions {
  limit: number;
  offset: number;
}

export class AIReviewService {
  private prisma: PrismaClientType;
  private aiService: AIService;

  constructor(aiService: AIService) {
    // Instantiate PrismaClient in a way compatible with Vitest module mocks
    this.prisma = new PrismaClient();
    this.aiService = aiService;
  }

  /**
   * Request a new AI review for a document
   */
  async requestReview(request: ReviewRequest): Promise<StoredAIReview> {
    try {
      // Check if user has access to the document
      await this.validateDocumentAccess(request.documentId, request.userId);

      // Get AI review
      const aiReview = await this.aiService.reviewSpecification(
        request.content,
        request.phase,
        request.projectId
      );

      // Store review in database
      const storedReview = await this.prisma.aIReview.create({
        data: {
          id: crypto.randomUUID(),
          documentId: request.documentId,
          overallScore: aiReview.overallScore,
          suggestions: aiReview.suggestions as any,
          completeness: aiReview.completenessCheck as any,
          qualityMetrics: aiReview.qualityMetrics as any,
          appliedSuggestions: [],
        },
      });

      return this.mapToStoredReview(storedReview, request.userId);
    } catch (error) {
      console.error('Error requesting AI review:', error);
      throw new Error('Failed to request AI review');
    }
  }

  /**
   * Get an AI review by ID
   */
  async getReview(reviewId: string, userId: string): Promise<StoredAIReview | null> {
    try {
      const review = await this.prisma.aIReview.findUnique({
        where: { id: reviewId },
      });

      if (!review) {
        return null;
      }

      // Validate user access to the document
      await this.validateDocumentAccess(review.documentId, userId);

      return this.mapToStoredReview(review, userId);
    } catch (error) {
      console.error('Error getting AI review:', error);
      throw new Error('Failed to retrieve AI review');
    }
  }

  /**
   * Get all AI reviews for a document
   */
  async getDocumentReviews(
    documentId: string,
    userId: string,
    options: PaginationOptions
  ): Promise<{ reviews: StoredAIReview[]; total: number }> {
    try {
      // Validate user access to the document
      await this.validateDocumentAccess(documentId, userId);

      const [reviews, total] = await Promise.all([
        this.prisma.aIReview.findMany({
          where: { documentId },
          orderBy: { createdAt: 'desc' },
          skip: options.offset,
          take: options.limit,
        }),
        this.prisma.aIReview.count({
          where: { documentId },
        }),
      ]);

      return {
        reviews: reviews.map(review => this.mapToStoredReview(review, userId)),
        total,
      };
    } catch (error) {
      console.error('Error getting document reviews:', error);
      throw new Error('Failed to retrieve document reviews');
    }
  }

  /**
   * Apply an AI suggestion to the document
   */
  async applySuggestion(request: ApplySuggestionRequest): Promise<{
    success: boolean;
    modifiedContent: string;
    appliedSuggestion: AISuggestion;
  }> {
    try {
      // Get the review
      const review = await this.prisma.aIReview.findUnique({
        where: { id: request.reviewId },
      });

      if (!review) {
        throw new Error('Review not found');
      }

      // Validate user access
      await this.validateDocumentAccess(review.documentId, request.userId);

      // Find the suggestion
      const suggestions = review.suggestions as AISuggestion[];
      const suggestion = suggestions.find(s => s.id === request.suggestionId);

      if (!suggestion) {
        throw new Error('Suggestion not found');
      }

      if (!suggestion.originalText || !suggestion.suggestedText) {
        throw new Error('Suggestion does not contain text replacement data');
      }

      // Apply the suggestion
      const modifiedContent = request.documentContent.replace(
        suggestion.originalText,
        suggestion.suggestedText
      );

      // Store the application
      await this.storeSuggestionApplication({
        reviewId: request.reviewId,
        suggestionId: request.suggestionId,
        originalContent: request.documentContent,
        modifiedContent,
        appliedBy: request.userId,
      });

      // Update the review to mark suggestion as applied
      const appliedSuggestions = review.appliedSuggestions as string[];
      if (!appliedSuggestions.includes(request.suggestionId)) {
        await this.prisma.aIReview.update({
          where: { id: request.reviewId },
          data: {
            appliedSuggestions: [...appliedSuggestions, request.suggestionId],
            updatedAt: new Date(),
          },
        });
      }

      return {
        success: true,
        modifiedContent,
        appliedSuggestion: suggestion,
      };
    } catch (error) {
      console.error('Error applying suggestion:', error);
      throw new Error('Failed to apply suggestion');
    }
  }

  /**
   * Rollback an applied AI suggestion
   */
  async rollbackSuggestion(request: RollbackSuggestionRequest): Promise<{
    success: boolean;
    originalContent: string;
    rolledBackSuggestion: AISuggestion;
  }> {
    try {
      // Get the review
      const review = await this.prisma.aIReview.findUnique({
        where: { id: request.reviewId },
      });

      if (!review) {
        throw new Error('Review not found');
      }

      // Validate user access
      await this.validateDocumentAccess(review.documentId, request.userId);

      // Find the suggestion application
      const application = await this.getSuggestionApplication(
        request.reviewId,
        request.suggestionId
      );

      if (!application) {
        throw new Error('Suggestion application not found');
      }

      // Find the suggestion
      const suggestions = review.suggestions as AISuggestion[];
      const suggestion = suggestions.find(s => s.id === request.suggestionId);

      if (!suggestion) {
        throw new Error('Suggestion not found');
      }

      // Remove suggestion from applied list
      const appliedSuggestions = review.appliedSuggestions as string[];
      const updatedAppliedSuggestions = appliedSuggestions.filter(
        id => id !== request.suggestionId
      );

      await this.prisma.aIReview.update({
        where: { id: request.reviewId },
        data: {
          appliedSuggestions: updatedAppliedSuggestions,
          updatedAt: new Date(),
        },
      });

      // Remove the application record
      await this.removeSuggestionApplication(request.reviewId, request.suggestionId);

      return {
        success: true,
        originalContent: application.originalContent,
        rolledBackSuggestion: suggestion,
      };
    } catch (error) {
      console.error('Error rolling back suggestion:', error);
      throw new Error('Failed to rollback suggestion');
    }
  }

  /**
   * Validate user access to a document
   */
  private async validateDocumentAccess(documentId: string, userId: string): Promise<void> {
    // Get the document and check if user has access
    const document = await this.prisma.specificationDocument.findUnique({
      where: { id: documentId },
      include: {
        project: {
          include: {
            owner: true,
            team: {
              where: { status: 'ACTIVE' },
            },
          },
        },
      },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    const hasAccess =
      document.project.ownerId === userId ||
      document.project.team.some((tm: any) => tm.userId === userId && tm.status === 'ACTIVE');

    if (!hasAccess) {
      throw new Error('Access denied to document');
    }
  }

  /**
   * Store a suggestion application
   */
  private async storeSuggestionApplication(application: {
    reviewId: string;
    suggestionId: string;
    originalContent: string;
    modifiedContent: string;
    appliedBy: string;
  }): Promise<void> {
    // For now, we'll store this in a simple JSON structure
    // In a production system, you might want a separate table
    const key = `suggestion_application:${application.reviewId}:${application.suggestionId}`;
    
    // This would typically be stored in Redis or a database table
    // For this implementation, we'll use a simple in-memory approach
    // In production, implement proper persistence
  }

  /**
   * Get a suggestion application
   */
  private async getSuggestionApplication(
    reviewId: string,
    suggestionId: string
  ): Promise<SuggestionApplication | null> {
    // This would retrieve from persistent storage
    // For now, return a mock implementation
    return {
      id: crypto.randomUUID(),
      reviewId,
      suggestionId,
      originalContent: 'mock original content',
      modifiedContent: 'mock modified content',
      appliedAt: new Date(),
      appliedBy: 'mock-user-id',
    };
  }

  /**
   * Remove a suggestion application
   */
  private async removeSuggestionApplication(
    reviewId: string,
    suggestionId: string
  ): Promise<void> {
    // This would remove from persistent storage
    // For now, this is a no-op
  }

  /**
   * Map database review to stored review format
   */
  private mapToStoredReview(review: unknown, userId: string): StoredAIReview {
    return {
      id: review.id,
      documentId: review.documentId,
      userId,
      phase: 'requirements', // This should come from the review data
      overallScore: review.overallScore,
      suggestions: review.suggestions as AISuggestion[],
      completenessCheck: review.completeness,
      qualityMetrics: review.qualityMetrics,
      complianceIssues: [], // This should come from the review data
      appliedSuggestions: review.appliedSuggestions as string[],
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    };
  }
}