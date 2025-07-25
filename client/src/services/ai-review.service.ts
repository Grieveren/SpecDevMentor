import { apiClient } from './api.service';

// Types
export interface AIReviewResult {
  id: string;
  documentId: string;
  userId: string;
  phase: 'requirements' | 'design' | 'tasks';
  overallScore: number;
  suggestions: AISuggestion[];
  completenessCheck: CompletenessResult;
  qualityMetrics: QualityMetrics;
  complianceIssues: ComplianceIssue[];
  appliedSuggestions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AISuggestion {
  id: string;
  type: 'improvement' | 'error' | 'warning' | 'enhancement';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  lineNumber?: number;
  originalText?: string;
  suggestedText?: string;
  reasoning: string;
  category: SuggestionCategory;
}

export interface CompletenessResult {
  score: number;
  missingElements: string[];
  recommendations: string[];
}

export interface QualityMetrics {
  clarity: number;
  completeness: number;
  consistency: number;
  testability: number;
  traceability: number;
}

export interface ComplianceIssue {
  id: string;
  type: 'ears_format' | 'user_story' | 'acceptance_criteria' | 'structure';
  severity: 'low' | 'medium' | 'high';
  description: string;
  lineNumber?: number;
  suggestion: string;
}

export type SuggestionCategory = 
  | 'structure' 
  | 'clarity' 
  | 'completeness' 
  | 'format' 
  | 'best_practice' 
  | 'security' 
  | 'performance';

export interface ReviewRequest {
  documentId: string;
  phase: 'requirements' | 'design' | 'tasks';
  content: string;
  projectId?: string;
}

export interface ApplySuggestionRequest {
  reviewId: string;
  suggestionId: string;
  documentContent: string;
}

export interface RollbackSuggestionRequest {
  reviewId: string;
  suggestionId: string;
}

export interface ValidationRequest {
  content: string;
}

export interface ValidationResult {
  complianceIssues: ComplianceIssue[];
}

export interface DocumentReviewsResponse {
  reviews: AIReviewResult[];
  total: number;
}

export interface SuggestionApplicationResult {
  success: boolean;
  modifiedContent: string;
  appliedSuggestion: AISuggestion;
}

export interface SuggestionRollbackResult {
  success: boolean;
  originalContent: string;
  rolledBackSuggestion: AISuggestion;
}

class AIReviewService {
  /**
   * Request a new AI review for a document
   */
  async requestReview(request: ReviewRequest): Promise<AIReviewResult> {
    const response = await apiClient.post('/ai-review/request', request);
    return response.data;
  }

  /**
   * Get an AI review by ID
   */
  async getReview(reviewId: string): Promise<AIReviewResult> {
    const response = await apiClient.get(`/ai-review/${reviewId}`);
    return response.data;
  }

  /**
   * Get all AI reviews for a document
   */
  async getDocumentReviews(
    documentId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<DocumentReviewsResponse> {
    const { limit = 10, offset = 0 } = options;
    const response = await apiClient.get(`/ai-review/document/${documentId}`, {
      params: { limit, offset },
    });
    return response.data;
  }

  /**
   * Apply an AI suggestion to the document
   */
  async applySuggestion(request: ApplySuggestionRequest): Promise<SuggestionApplicationResult> {
    const response = await apiClient.post(
      `/ai-review/${request.reviewId}/apply-suggestion`,
      {
        suggestionId: request.suggestionId,
        documentContent: request.documentContent,
      }
    );
    return response.data;
  }

  /**
   * Rollback an applied AI suggestion
   */
  async rollbackSuggestion(request: RollbackSuggestionRequest): Promise<SuggestionRollbackResult> {
    const response = await apiClient.post(
      `/ai-review/${request.reviewId}/rollback-suggestion`,
      {
        suggestionId: request.suggestionId,
      }
    );
    return response.data;
  }

  /**
   * Validate EARS format compliance
   */
  async validateEARSFormat(request: ValidationRequest): Promise<ValidationResult> {
    const response = await apiClient.post('/ai-review/validate-ears', request);
    return response.data;
  }

  /**
   * Validate user story structure
   */
  async validateUserStories(request: ValidationRequest): Promise<ValidationResult> {
    const response = await apiClient.post('/ai-review/validate-user-stories', request);
    return response.data;
  }
}

export const aiReviewService = new AIReviewService();