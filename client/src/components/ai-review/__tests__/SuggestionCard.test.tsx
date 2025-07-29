import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { SuggestionCard } from '../SuggestionCard';
import { AISuggestion } from '../../../services/ai-review.service';

// Mock the DiffVisualization component
vi.mock('../DiffVisualization', () => ({
  DiffVisualization: ({ originalText, suggestedText }: unknown) => (
    <div data-testid="diff-visualization">
      <div>Original: {originalText}</div>
      <div>Suggested: {suggestedText}</div>
    </div>
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

describe('SuggestionCard', () => {
  const defaultProps = {
    suggestion: mockSuggestion,
    isApplied: false,
    onApply: vi.fn(),
    onDismiss: vi.fn(),
    onRollback: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render suggestion information correctly', () => {
    render(<SuggestionCard {...defaultProps} />);

    expect(screen.getByText('Improve clarity')).toBeInTheDocument();
    expect(screen.getByText('This section could be clearer')).toBeInTheDocument();
    expect(screen.getByText('improvement')).toBeInTheDocument();
    expect(screen.getByText('MEDIUM')).toBeInTheDocument();
    expect(screen.getByText('Clarity')).toBeInTheDocument();
    expect(screen.getAllByText((content, element) => {
      return element?.textContent?.includes('Line 10') || false;
    })).toHaveLength(1);
  });

  it('should render different severity styles correctly', () => {
    const criticalSuggestion = { ...mockSuggestion, severity: 'critical' as const };
    render(<SuggestionCard {...defaultProps} suggestion={criticalSuggestion} />);

    expect(screen.getByText('CRITICAL')).toBeInTheDocument();
    // Check that the card has the critical severity styling
    const card = screen.getByText('CRITICAL').closest('.border-red-200');
    expect(card).toBeInTheDocument();
  });

  it('should render different suggestion types correctly', () => {
    const errorSuggestion = { ...mockSuggestion, type: 'error' as const };
    render(<SuggestionCard {...defaultProps} suggestion={errorSuggestion} />);

    expect(screen.getByText('error')).toBeInTheDocument();
  });

  it('should show apply and dismiss buttons when not applied', () => {
    render(<SuggestionCard {...defaultProps} />);

    expect(screen.getByTitle('Apply suggestion')).toBeInTheDocument();
    expect(screen.getByTitle('Dismiss suggestion')).toBeInTheDocument();
    expect(screen.queryByTitle('Rollback suggestion')).not.toBeInTheDocument();
  });

  it('should show rollback button when applied', () => {
    render(<SuggestionCard {...defaultProps} isApplied={true} />);

    expect(screen.getByTitle('Rollback suggestion')).toBeInTheDocument();
    expect(screen.queryByTitle('Apply suggestion')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Dismiss suggestion')).not.toBeInTheDocument();
    expect(screen.getByText('Applied')).toBeInTheDocument();
  });

  it('should call onApply when apply button is clicked', async () => {
    const _user = userEvent.setup();
    render(<SuggestionCard {...defaultProps} />);

    await user.click(screen.getByTitle('Apply suggestion'));
    expect(defaultProps.onApply).toHaveBeenCalledTimes(1);
  });

  it('should call onDismiss when dismiss button is clicked', async () => {
    const _user = userEvent.setup();
    render(<SuggestionCard {...defaultProps} />);

    await user.click(screen.getByTitle('Dismiss suggestion'));
    expect(defaultProps.onDismiss).toHaveBeenCalledTimes(1);
  });

  it('should call onRollback when rollback button is clicked', async () => {
    const _user = userEvent.setup();
    render(<SuggestionCard {...defaultProps} isApplied={true} />);

    await user.click(screen.getByTitle('Rollback suggestion'));
    expect(defaultProps.onRollback).toHaveBeenCalledTimes(1);
  });

  it('should expand and collapse details', async () => {
    const _user = userEvent.setup();
    render(<SuggestionCard {...defaultProps} />);

    // Details should be collapsed initially
    expect(screen.queryByText('Reasoning')).not.toBeInTheDocument();
    expect(screen.queryByTestId('diff-visualization')).not.toBeInTheDocument();

    // Click expand button
    await user.click(screen.getByTitle('Expand details'));

    // Details should be visible
    expect(screen.getByText('Reasoning')).toBeInTheDocument();
    expect(screen.getByText('The current wording is ambiguous')).toBeInTheDocument();
    expect(screen.getByTestId('diff-visualization')).toBeInTheDocument();

    // Click collapse button
    await user.click(screen.getByTitle('Collapse details'));

    // Details should be hidden again
    expect(screen.queryByText('Reasoning')).not.toBeInTheDocument();
    expect(screen.queryByTestId('diff-visualization')).not.toBeInTheDocument();
  });

  it('should not show expand button when no expandable content', () => {
    const suggestionWithoutDetails = {
      ...mockSuggestion,
      reasoning: '',
      originalText: undefined,
      suggestedText: undefined,
    };

    render(<SuggestionCard {...defaultProps} suggestion={suggestionWithoutDetails} />);

    expect(screen.queryByTitle('Expand details')).not.toBeInTheDocument();
  });

  it('should show loading state when applying suggestion', async () => {
    const _user = userEvent.setup();
    const slowOnApply = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)));
    
    render(<SuggestionCard {...defaultProps} onApply={slowOnApply} />);

    const applyButton = screen.getByTitle('Apply suggestion');
    await user.click(applyButton);

    // Should show loading spinner
    expect(applyButton).toBeDisabled();

    await waitFor(() => {
      expect(slowOnApply).toHaveBeenCalledTimes(1);
    });
  });

  it('should show loading state when rolling back suggestion', async () => {
    const _user = userEvent.setup();
    const slowOnRollback = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)));
    
    render(<SuggestionCard {...defaultProps} isApplied={true} onRollback={slowOnRollback} />);

    const rollbackButton = screen.getByTitle('Rollback suggestion');
    await user.click(rollbackButton);

    // Should show loading spinner
    expect(rollbackButton).toBeDisabled();

    await waitFor(() => {
      expect(slowOnRollback).toHaveBeenCalledTimes(1);
    });
  });

  it('should handle different categories correctly', () => {
    const securitySuggestion = { ...mockSuggestion, category: 'security' as const };
    render(<SuggestionCard {...defaultProps} suggestion={securitySuggestion} />);

    expect(screen.getByText('Security')).toBeInTheDocument();
  });

  it('should handle suggestion without line number', () => {
    const suggestionWithoutLine = { ...mockSuggestion, lineNumber: undefined };
    render(<SuggestionCard {...defaultProps} suggestion={suggestionWithoutLine} />);

    expect(screen.queryByText((content, element) => {
      return element?.textContent?.includes('Line') || false;
    })).not.toBeInTheDocument();
  });

  it('should apply correct styling for applied suggestions', () => {
    render(<SuggestionCard {...defaultProps} isApplied={true} />);

    const card = screen.getByText('Improve clarity').closest('.opacity-75');
    expect(card).toBeInTheDocument();
  });

  it('should handle error in apply action gracefully', async () => {
    const _user = userEvent.setup();
    const errorOnApply = vi.fn().mockRejectedValue(new Error('Apply failed'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    render(<SuggestionCard {...defaultProps} onApply={errorOnApply} />);

    await user.click(screen.getByTitle('Apply suggestion'));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to apply suggestion:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });

  it('should handle error in rollback action gracefully', async () => {
    const _user = userEvent.setup();
    const errorOnRollback = vi.fn().mockRejectedValue(new Error('Rollback failed'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    render(<SuggestionCard {...defaultProps} isApplied={true} onRollback={errorOnRollback} />);

    await user.click(screen.getByTitle('Rollback suggestion'));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to rollback suggestion:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });
});