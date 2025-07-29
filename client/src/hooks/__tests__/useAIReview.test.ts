import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
import { useAIReview } from '../useAIReview';
import { aiReviewService, AIReviewResult, AISuggestion } from '../../services/ai-review.service';

// Mock the AI review service
vi.mock('../../services/ai-review.service', () => ({
  aiReviewService: {
    requestReview: vi.fn(),
    applySuggestion: vi.fn(),
    rollbackSuggestion: vi.fn(),
    getReview: vi.fn(),
  },
}));

const mockAiReviewService = aiReviewService as any;

const mockSuggestion: AISuggestion = {
  id: 'suggestion-1',
  type: 'improvement',
  severity: 'medium',
  title: 'Improve clarity',
  description: 'This section could be clearer',
  reasoning: 'The current wording is ambiguous',
  category: 'clarity',
  lineNumber: 10,
  originalText: 'Original text',
  suggestedText: 'Suggested text',
};

const mockReview: AIReviewResult = {
  id: 'review-1',
  documentId: 'doc-1',
  userId: 'user-1',
  phase: 'requirements',
  overallScore: 85,
  suggestions: [mockSuggestion],
  completenessCheck: {
    score: 0.9,
    missingElements: ['Missing element'],
    recommendations: ['Add more details'],
  },
  qualityMetrics: {
    clarity: 0.8,
    completeness: 0.9,
    consistency: 0.85,
    testability: 0.75,
    traceability: 0.8,
  },
  complianceIssues: [],
  appliedSuggestions: [],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('useAIReview', () => {
  const defaultOptions = {
    documentId: 'doc-1',
    phase: 'requirements' as const,
    projectId: 'project-1',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useAIReview(defaultOptions));

    expect(result.current.currentReview).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should request review successfully', async () => {
    mockAiReviewService.requestReview.mockResolvedValue(mockReview);

    const { result } = renderHook(() => useAIReview(defaultOptions));

    await act(async () => {
      await result.current.requestReview('Test content');
    });

    expect(mockAiReviewService.requestReview).toHaveBeenCalledWith({
      documentId: 'doc-1',
      phase: 'requirements',
      content: 'Test content',
      projectId: 'project-1',
    });

    expect(result.current.currentReview).toEqual(mockReview);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should handle request review error', async () => {
    const _error = new Error('Review failed');
    mockAiReviewService.requestReview.mockRejectedValue(error);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useAIReview(defaultOptions));

    await act(async () => {
      await result.current.requestReview('Test content');
    });

    expect(result.current.currentReview).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe('Review failed');
    expect(consoleSpy).toHaveBeenCalledWith('AI review request failed:', error);

    consoleSpy.mockRestore();
  });

  it('should set loading state during request review', async () => {
    let resolveReview: (_value: AIReviewResult) => void;
    const reviewPromise = new Promise<AIReviewResult>((resolve) => {
      resolveReview = resolve;
    });
    mockAiReviewService.requestReview.mockReturnValue(reviewPromise);

    const { result } = renderHook(() => useAIReview(defaultOptions));

    act(() => {
      result.current.requestReview('Test content');
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveReview!(mockReview);
      await reviewPromise;
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('should apply suggestion successfully', async () => {
    const appliedResult = {
      success: true,
      modifiedContent: 'Modified content',
      appliedSuggestion: mockSuggestion,
    };
    mockAiReviewService.applySuggestion.mockResolvedValue(appliedResult);

    const { result } = renderHook(() => useAIReview(defaultOptions));

    // Set initial review
    act(() => {
      result.current.requestReview = vi.fn();
    });
    
    // Manually set the current review for testing
    await act(async () => {
      mockAiReviewService.requestReview.mockResolvedValue(mockReview);
      await result.current.requestReview('Test content');
    });

    const applyResult = await act(async () => {
      return await result.current.applySuggestion(mockSuggestion, 'Document content');
    });

    expect(mockAiReviewService.applySuggestion).toHaveBeenCalledWith({
      reviewId: 'review-1',
      suggestionId: 'suggestion-1',
      documentContent: 'Document content',
    });

    expect(applyResult).toEqual(appliedResult);
    expect(result.current.currentReview?.appliedSuggestions).toContain('suggestion-1');
  });

  it('should handle apply suggestion error', async () => {
    const _error = new Error('Apply failed');
    mockAiReviewService.applySuggestion.mockRejectedValue(error);

    const { result } = renderHook(() => useAIReview(defaultOptions));

    // Set initial review
    await act(async () => {
      mockAiReviewService.requestReview.mockResolvedValue(mockReview);
      await result.current.requestReview('Test content');
    });

    await act(async () => {
      try {
        await result.current.applySuggestion(mockSuggestion, 'Document content');
      } catch (e) {
        // Expected to throw
      }
    });

    expect(result.current.error).toBe('Failed to apply suggestion');
  });

  it('should rollback suggestion successfully', async () => {
    const rollbackResult = {
      success: true,
      originalContent: 'Original content',
      rolledBackSuggestion: mockSuggestion,
    };
    mockAiReviewService.rollbackSuggestion.mockResolvedValue(rollbackResult);

    const { result } = renderHook(() => useAIReview(defaultOptions));

    // Set initial review with applied suggestion
    const reviewWithApplied = {
      ...mockReview,
      appliedSuggestions: ['suggestion-1'],
    };

    await act(async () => {
      mockAiReviewService.requestReview.mockResolvedValue(reviewWithApplied);
      await result.current.requestReview('Test content');
    });

    const rollbackResultActual = await act(async () => {
      return await result.current.rollbackSuggestion('suggestion-1');
    });

    expect(mockAiReviewService.rollbackSuggestion).toHaveBeenCalledWith({
      reviewId: 'review-1',
      suggestionId: 'suggestion-1',
    });

    expect(rollbackResultActual).toEqual(rollbackResult);
    expect(result.current.currentReview?.appliedSuggestions).not.toContain('suggestion-1');
  });

  it('should handle rollback suggestion error', async () => {
    const _error = new Error('Rollback failed');
    mockAiReviewService.rollbackSuggestion.mockRejectedValue(error);

    const { result } = renderHook(() => useAIReview(defaultOptions));

    // Set initial review
    await act(async () => {
      mockAiReviewService.requestReview.mockResolvedValue(mockReview);
      await result.current.requestReview('Test content');
    });

    await act(async () => {
      try {
        await result.current.rollbackSuggestion('suggestion-1');
      } catch (e) {
        // Expected to throw
      }
    });

    expect(result.current.error).toBe('Failed to rollback suggestion');
  });

  it('should dismiss suggestion locally', () => {
    const { result } = renderHook(() => useAIReview(defaultOptions));

    // Set initial review
    act(() => {
      // Manually set current review for testing
      (result.current as any).currentReview = mockReview;
    });

    act(() => {
      result.current.dismissSuggestion('suggestion-1');
    });

    // The suggestion should be filtered out from the current review
    expect(result.current.currentReview?.suggestions).toHaveLength(0);
  });

  it('should clear error', () => {
    const { result } = renderHook(() => useAIReview(defaultOptions));

    // Set error state
    act(() => {
      (result.current as any).error = 'Some error';
    });

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it('should refresh review successfully', async () => {
    const refreshedReview = { ...mockReview, overallScore: 90 };
    mockAiReviewService.getReview.mockResolvedValue(refreshedReview);

    const { result } = renderHook(() => useAIReview(defaultOptions));

    // Set initial review
    await act(async () => {
      mockAiReviewService.requestReview.mockResolvedValue(mockReview);
      await result.current.requestReview('Test content');
    });

    await act(async () => {
      await result.current.refreshReview();
    });

    expect(mockAiReviewService.getReview).toHaveBeenCalledWith('review-1');
    expect(result.current.currentReview?.overallScore).toBe(90);
  });

  it('should handle refresh review error', async () => {
    const _error = new Error('Refresh failed');
    mockAiReviewService.getReview.mockRejectedValue(error);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useAIReview(defaultOptions));

    // Set initial review
    await act(async () => {
      mockAiReviewService.requestReview.mockResolvedValue(mockReview);
      await result.current.requestReview('Test content');
    });

    await act(async () => {
      await result.current.refreshReview();
    });

    expect(result.current.error).toBe('Failed to refresh review');
    expect(consoleSpy).toHaveBeenCalledWith('Review refresh failed:', error);

    consoleSpy.mockRestore();
  });

  it('should not refresh when no current review', async () => {
    const { result } = renderHook(() => useAIReview(defaultOptions));

    await act(async () => {
      await result.current.refreshReview();
    });

    expect(mockAiReviewService.getReview).not.toHaveBeenCalled();
  });

  it('should throw error when applying suggestion without current review', async () => {
    const { result } = renderHook(() => useAIReview(defaultOptions));

    await act(async () => {
      try {
        await result.current.applySuggestion(mockSuggestion, 'Document content');
      } catch (error) {
        expect(error).toEqual(new Error('No current review available'));
      }
    });
  });

  it('should throw error when rolling back suggestion without current review', async () => {
    const { result } = renderHook(() => useAIReview(defaultOptions));

    await act(async () => {
      try {
        await result.current.rollbackSuggestion('suggestion-1');
      } catch (error) {
        expect(error).toEqual(new Error('No current review available'));
      }
    });
  });

  it('should reset dismissed suggestions on new review', async () => {
    const { result } = renderHook(() => useAIReview(defaultOptions));

    // Set initial review and dismiss a suggestion
    await act(async () => {
      mockAiReviewService.requestReview.mockResolvedValue(mockReview);
      await result.current.requestReview('Test content');
    });

    act(() => {
      result.current.dismissSuggestion('suggestion-1');
    });

    expect(result.current.currentReview?.suggestions).toHaveLength(0);

    // Request new review
    await act(async () => {
      await result.current.requestReview('New content');
    });

    // Dismissed suggestions should be reset
    expect(result.current.currentReview?.suggestions).toHaveLength(1);
  });
});