import { useState, useCallback } from 'react';
import { 
  AIReviewResult, 
  AISuggestion, 
  aiReviewService,
  ReviewRequest,
  SuggestionApplicationResult,
  SuggestionRollbackResult
} from '../services/ai-review.service';

export interface UseAIReviewOptions {
  documentId: string;
  phase: 'requirements' | 'design' | 'tasks';
  projectId?: string;
}

export interface UseAIReviewReturn {
  currentReview: AIReviewResult | null;
  isLoading: boolean;
  error: string | null;
  requestReview: (content: string) => Promise<void>;
  applySuggestion: (suggestion: AISuggestion, documentContent: string) => Promise<SuggestionApplicationResult>;
  rollbackSuggestion: (suggestionId: string) => Promise<SuggestionRollbackResult>;
  dismissSuggestion: (suggestionId: string) => void;
  clearError: () => void;
  refreshReview: () => Promise<void>;
}

export const useAIReview = ({ 
  documentId, 
  phase, 
  projectId 
}: UseAIReviewOptions): UseAIReviewReturn => {
  const [currentReview, setCurrentReview] = useState<AIReviewResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const requestReview = useCallback(async (content: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const request: ReviewRequest = {
        documentId,
        phase,
        content,
        projectId,
      };

      const review = await aiReviewService.requestReview(request);
      setCurrentReview(review);
      setDismissedSuggestions(new Set()); // Reset dismissed suggestions for new review
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to request AI review';
      setError(errorMessage);
      console.error('AI review request failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [documentId, phase, projectId]);

  const applySuggestion = useCallback(async (
    suggestion: AISuggestion, 
    documentContent: string
  ): Promise<SuggestionApplicationResult> => {
    if (!currentReview) {
      throw new Error('No current review available');
    }

    try {
      const _result = await aiReviewService.applySuggestion({
        reviewId: currentReview.id,
        suggestionId: suggestion.id,
        documentContent,
      });

      // Update the current review to mark this suggestion as applied
      setCurrentReview(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          appliedSuggestions: [...prev.appliedSuggestions, suggestion.id],
        };
      });

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to apply suggestion';
      setError(errorMessage);
      throw err;
    }
  }, [currentReview]);

  const rollbackSuggestion = useCallback(async (
    suggestionId: string
  ): Promise<SuggestionRollbackResult> => {
    if (!currentReview) {
      throw new Error('No current review available');
    }

    try {
      const _result = await aiReviewService.rollbackSuggestion({
        reviewId: currentReview.id,
        suggestionId,
      });

      // Update the current review to remove this suggestion from applied list
      setCurrentReview(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          appliedSuggestions: prev.appliedSuggestions.filter(id => id !== suggestionId),
        };
      });

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to rollback suggestion';
      setError(errorMessage);
      throw err;
    }
  }, [currentReview]);

  const dismissSuggestion = useCallback((suggestionId: string) => {
    setDismissedSuggestions(prev => new Set([...prev, suggestionId]));
  }, []);

  const refreshReview = useCallback(async () => {
    if (!currentReview) return;

    setIsLoading(true);
    setError(null);

    try {
      const refreshedReview = await aiReviewService.getReview(currentReview.id);
      setCurrentReview(refreshedReview);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh review';
      setError(errorMessage);
      console.error('Review refresh failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentReview]);

  // Filter out dismissed suggestions from the current review
  const filteredReview = currentReview ? {
    ...currentReview,
    suggestions: currentReview.suggestions.filter(
      suggestion => !dismissedSuggestions.has(suggestion.id)
    ),
  } : null;

  return {
    currentReview: filteredReview,
    isLoading,
    error,
    requestReview,
    applySuggestion,
    rollbackSuggestion,
    dismissSuggestion,
    clearError,
    refreshReview,
  };
};