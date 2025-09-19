import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { AIReviewPanel } from '../AIReviewPanel';
import { AIReviewResult, AISuggestion } from '../../../services/ai-review.service';

// Mock the child components
vi.mock('../SuggestionCard', () => ({
  SuggestionCard: ({ suggestion, onApply, onDismiss, onRollback }: unknown) => (
    <div data-testid={`suggestion-${suggestion.id}`}>
      <span>{suggestion.title}</span>
      <button onClick={onApply}>Apply</button>
      <button onClick={onDismiss}>Dismiss</button>
      <button onClick={onRollback}>Rollback</button>
    </div>
  ),
}));

vi.mock('../ReviewHistory', () => ({
  ReviewHistory: ({ documentId }: unknown) => (
    <div data-testid="review-history">History for {documentId}</div>
  ),
}));

vi.mock('../ScoreIndicator', () => ({
  ScoreIndicator: ({ score }: unknown) => (
    <div data-testid="score-indicator">{score}%</div>
  ),
}));

vi.mock('../QualityMetrics', () => ({
  QualityMetrics: ({ metrics }: unknown) => (
    <div data-testid="quality-metrics">Quality: {metrics.clarity}</div>
  ),
}));

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

describe('AIReviewPanel', () => {
  const defaultProps = {
    documentId: 'doc-1',
    onRequestReview: vi.fn(),
    onApplySuggestion: vi.fn(),
    onDismissSuggestion: vi.fn(),
    onRollbackSuggestion: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with no review state', () => {
    render(<AIReviewPanel {...defaultProps} />);

    expect(screen.getByText('AI Review')).toBeInTheDocument();
    expect(screen.getByText('No AI Review Yet')).toBeInTheDocument();
    expect(screen.getByText('Request AI Review')).toBeInTheDocument();
  });

  it('should render loading state', () => {
    render(<AIReviewPanel {...defaultProps} isLoading={true} />);

    expect(screen.getByText((content, element) => {
      return element?.textContent?.includes('Analyzing document') || false;
    })).toBeInTheDocument();
  });

  it('should render error state', () => {
    const _error = 'Failed to analyze document';
    render(<AIReviewPanel {...defaultProps} error={error} />);

    expect(screen.getByText(error)).toBeInTheDocument();
  });

  it('should render review content when review is provided', () => {
    render(<AIReviewPanel {...defaultProps} currentReview={mockReview} />);

    expect(screen.getByText('AI Review')).toBeInTheDocument();
    expect(screen.getByText('Overall Score:')).toBeInTheDocument();
    expect(screen.getByTestId('score-indicator')).toHaveTextContent('85%');
    expect(screen.getByText('Review Summary')).toBeInTheDocument();
  });

  it('should display suggestion summary correctly', () => {
    const reviewWithMultipleSuggestions: AIReviewResult = {
      ...mockReview,
      suggestions: [
        { ...mockSuggestion, id: 'sug-1', severity: 'critical' },
        { ...mockSuggestion, id: 'sug-2', severity: 'high' },
        { ...mockSuggestion, id: 'sug-3', severity: 'medium' },
        { ...mockSuggestion, id: 'sug-4', severity: 'low' },
      ],
    };

    render(<AIReviewPanel {...defaultProps} currentReview={reviewWithMultipleSuggestions} />);

    // Check severity counts in summary
    expect(screen.getByText('1')).toBeInTheDocument(); // Critical
    expect(screen.getByText('Critical')).toBeInTheDocument();
  });

  it('should handle tab switching', async () => {
    const _user = userEvent.setup();
    render(<AIReviewPanel {...defaultProps} currentReview={mockReview} />);

    // Default tab should be suggestions
    expect(screen.getByTestId('suggestion-suggestion-1')).toBeInTheDocument();

    // Switch to quality metrics tab
    await user.click(screen.getByText('Quality'));
    expect(screen.getByTestId('quality-metrics')).toBeInTheDocument();

    // Switch to history tab
    await user.click(screen.getByText('History'));
    expect(screen.getByTestId('review-history')).toBeInTheDocument();
  });

  it('should call onRequestReview when request review button is clicked', async () => {
    const _user = userEvent.setup();
    render(<AIReviewPanel {...defaultProps} />);

    await user.click(screen.getByText('Request AI Review'));
    expect(defaultProps.onRequestReview).toHaveBeenCalledTimes(1);
  });

  it('should call onRequestReview from header when review exists', async () => {
    const _user = userEvent.setup();
    render(<AIReviewPanel {...defaultProps} currentReview={mockReview} />);

    await user.click(screen.getByText('New Review'));
    expect(defaultProps.onRequestReview).toHaveBeenCalledTimes(1);
  });

  it('should handle panel expansion/collapse', async () => {
    const _user = userEvent.setup();
    render(<AIReviewPanel {...defaultProps} currentReview={mockReview} />);

    // Panel should be expanded by default
    expect(screen.getByText('Review Summary')).toBeInTheDocument();

    // Find and click the collapse button (ChevronUpIcon)
    const collapseButton = screen.getByRole('button', { name: '' });
    await user.click(collapseButton);

    // Content should be hidden
    expect(screen.queryByText('Review Summary')).not.toBeInTheDocument();
  });

  it('should pass suggestion actions to SuggestionCard', async () => {
    const _user = userEvent.setup();
    render(<AIReviewPanel {...defaultProps} currentReview={mockReview} />);

    // Test apply suggestion
    await user.click(screen.getByText('Apply'));
    expect(defaultProps.onApplySuggestion).toHaveBeenCalledWith(mockSuggestion);

    // Test dismiss suggestion
    await user.click(screen.getByText('Dismiss'));
    expect(defaultProps.onDismissSuggestion).toHaveBeenCalledWith(mockSuggestion.id);

    // Test rollback suggestion
    await user.click(screen.getByText('Rollback'));
    expect(defaultProps.onRollbackSuggestion).toHaveBeenCalledWith(mockSuggestion.id);
  });

  it('should show no suggestions message when all suggestions are dismissed', () => {
    const reviewWithNoSuggestions: AIReviewResult = {
      ...mockReview,
      suggestions: [],
    };

    render(<AIReviewPanel {...defaultProps} currentReview={reviewWithNoSuggestions} />);

    expect(screen.getByText('No suggestions - great work!')).toBeInTheDocument();
  });

  it('should display applied suggestions count correctly', () => {
    const reviewWithAppliedSuggestions: AIReviewResult = {
      ...mockReview,
      appliedSuggestions: ['suggestion-1'],
    };

    render(<AIReviewPanel {...defaultProps} currentReview={reviewWithAppliedSuggestions} />);

    // The suggestion card should receive isApplied=true
    expect(screen.getByTestId('suggestion-suggestion-1')).toBeInTheDocument();
  });

  it('should handle missing optional props gracefully', () => {
    const minimalProps = {
      documentId: 'doc-1',
      onRequestReview: jest.fn(),
      onApplySuggestion: jest.fn(),
      onDismissSuggestion: jest.fn(),
      onRollbackSuggestion: jest.fn(),
    };

    expect(() => render(<AIReviewPanel {...minimalProps} />)).not.toThrow();
  });

  it('should display review timestamp correctly', () => {
    render(<AIReviewPanel {...defaultProps} currentReview={mockReview} />);

    // Check that the timestamp is displayed (format may vary based on locale)
    expect(screen.getByText((content, element) => {
      return element?.textContent?.includes('2024') || false;
    })).toBeInTheDocument();
  });

  it('should maintain tab state when review changes', async () => {
    const _user = userEvent.setup();
    const { rerender } = render(<AIReviewPanel {...defaultProps} currentReview={mockReview} />);

    // Switch to quality tab
    await user.click(screen.getByText('Quality'));
    expect(screen.getByTestId('quality-metrics')).toBeInTheDocument();

    // Update review
    const updatedReview = { ...mockReview, overallScore: 90 };
    rerender(<AIReviewPanel {...defaultProps} currentReview={updatedReview} />);

    // Should still be on quality tab
    expect(screen.getByTestId('quality-metrics')).toBeInTheDocument();
  });
});