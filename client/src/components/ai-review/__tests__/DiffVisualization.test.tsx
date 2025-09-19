import React from 'react';
import { render, screen } from '@testing-library/react';
import { DiffVisualization } from '../DiffVisualization';

describe('DiffVisualization', () => {
  it('should render inline diff for short single-line text', () => {
    const originalText = 'Hello world';
    const suggestedText = 'Hello universe';

    render(<DiffVisualization originalText={originalText} suggestedText={suggestedText} />);

    expect(screen.getByText('Original')).toBeInTheDocument();
    expect(screen.getByText('Suggested')).toBeInTheDocument();
    expect(screen.getByText((content, element) => {
      return element?.textContent?.includes('Hello world') || false;
    })).toBeInTheDocument();
    expect(screen.getByText((content, element) => {
      return element?.textContent?.includes('Hello universe') || false;
    })).toBeInTheDocument();
  });

  it('should render line-by-line diff for multi-line text', () => {
    const originalText = 'Line 1\nLine 2\nLine 3';
    const suggestedText = 'Line 1\nModified Line 2\nLine 3';

    render(<DiffVisualization originalText={originalText} suggestedText={suggestedText} />);

    expect(screen.getByText('Removed')).toBeInTheDocument();
    expect(screen.getByText('Added')).toBeInTheDocument();
    expect(screen.getByText('Line 1')).toBeInTheDocument();
    expect(screen.getByText('Line 2')).toBeInTheDocument();
    expect(screen.getByText('Modified Line 2')).toBeInTheDocument();
    expect(screen.getByText('Line 3')).toBeInTheDocument();
  });

  it('should render line-by-line diff for long single-line text', () => {
    const originalText = 'This is a very long line of text that exceeds the inline diff threshold and should be displayed as a line diff instead';
    const suggestedText = 'This is a very long line of modified text that exceeds the inline diff threshold and should be displayed as a line diff instead';

    render(<DiffVisualization originalText={originalText} suggestedText={suggestedText} />);

    expect(screen.getByText('Removed')).toBeInTheDocument();
    expect(screen.getByText('Added')).toBeInTheDocument();
    // Should show line numbers
    expect(screen.getAllByText('1')).toHaveLength(2); // One for each diff line
  });

  it('should handle added lines correctly', () => {
    const originalText = 'Line 1\nLine 2';
    const suggestedText = 'Line 1\nLine 2\nLine 3';

    render(<DiffVisualization originalText={originalText} suggestedText={suggestedText} />);

    expect(screen.getByText('Line 3')).toBeInTheDocument();
    expect(screen.getByText('1 additions, 0 deletions')).toBeInTheDocument();
  });

  it('should handle removed lines correctly', () => {
    const originalText = 'Line 1\nLine 2\nLine 3';
    const suggestedText = 'Line 1\nLine 3';

    render(<DiffVisualization originalText={originalText} suggestedText={suggestedText} />);

    expect(screen.getByText('Line 2')).toBeInTheDocument();
    expect(screen.getByText((content, element) => {
      return element?.textContent?.includes('additions') && element?.textContent?.includes('deletions') || false;
    })).toBeInTheDocument();
  });

  it('should handle unchanged lines correctly', () => {
    const originalText = 'Line 1\nLine 2\nLine 3';
    const suggestedText = 'Line 1\nLine 2\nLine 3';

    render(<DiffVisualization originalText={originalText} suggestedText={suggestedText} />);

    expect(screen.getByText('Line 1')).toBeInTheDocument();
    expect(screen.getByText('Line 2')).toBeInTheDocument();
    expect(screen.getByText('Line 3')).toBeInTheDocument();
    expect(screen.getByText('0 additions, 0 deletions')).toBeInTheDocument();
  });

  it('should handle empty original text', () => {
    const originalText = '';
    const suggestedText = 'New content';

    render(<DiffVisualization originalText={originalText} suggestedText={suggestedText} />);

    expect(screen.getAllByText((content, element) => {
      return element?.textContent?.includes('New content') || false;
    })).toHaveLength(1);
  });

  it('should handle empty suggested text', () => {
    const originalText = 'Old content';
    const suggestedText = '';

    render(<DiffVisualization originalText={originalText} suggestedText={suggestedText} />);

    expect(screen.getAllByText((content, element) => {
      return element?.textContent?.includes('Old content') || false;
    })).toHaveLength(1);
  });

  it('should handle both texts being empty', () => {
    const originalText = '';
    const suggestedText = '';

    render(<DiffVisualization originalText={originalText} suggestedText={suggestedText} />);

    // Should render inline diff with empty content
    expect(screen.getByText('Original')).toBeInTheDocument();
    expect(screen.getByText('Suggested')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const originalText = 'Test';
    const suggestedText = 'Modified test';

    const { container } = render(
      <DiffVisualization 
        originalText={originalText} 
        suggestedText={suggestedText} 
        className="custom-class" 
      />
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should show correct line numbers for multi-line diff', () => {
    const originalText = 'Line 1\nLine 2\nLine 3\nLine 4';
    const suggestedText = 'Line 1\nModified Line 2\nLine 3\nLine 4';

    render(<DiffVisualization originalText={originalText} suggestedText={suggestedText} />);

    // Check that line numbers are displayed (multiple instances expected)
    expect(screen.getAllByText('1')).toHaveLength(1);
    expect(screen.getAllByText('2')).toHaveLength(2); // Original and modified
    expect(screen.getAllByText('3')).toHaveLength(1);
    expect(screen.getAllByText('4')).toHaveLength(1);
  });

  it('should handle whitespace-only changes', () => {
    const originalText = 'Line 1\n  Line 2\nLine 3';
    const suggestedText = 'Line 1\nLine 2\nLine 3';

    render(<DiffVisualization originalText={originalText} suggestedText={suggestedText} />);

    expect(screen.getByText((content, element) => {
      return element?.textContent === '  Line 2' || false;
    })).toBeInTheDocument();
    expect(screen.getAllByText('Line 2')).toHaveLength(2); // One with spaces, one without
  });

  it('should preserve empty lines in diff', () => {
    const originalText = 'Line 1\n\nLine 3';
    const suggestedText = 'Line 1\n\nModified Line 3';

    render(<DiffVisualization originalText={originalText} suggestedText={suggestedText} />);

    // Empty line should be preserved (shown as space)
    const diffContent = screen.getByText('Line 1').closest('[class*="overflow-auto"]');
    expect(diffContent).toBeInTheDocument();
  });

  it('should show correct styling for different line types', () => {
    const originalText = 'Line 1\nLine 2';
    const suggestedText = 'Line 1\nModified Line 2';

    render(<DiffVisualization originalText={originalText} suggestedText={suggestedText} />);

    // Check that removed lines have red styling (parent div)
    const removedLine = screen.getByText('Line 2').closest('.bg-red-50');
    expect(removedLine).toBeInTheDocument();

    // Check that added lines have green styling (parent div)
    const addedLine = screen.getByText('Modified Line 2').closest('.bg-green-50');
    expect(addedLine).toBeInTheDocument();

    // Check that unchanged lines have white background (parent div)
    const unchangedLine = screen.getByText('Line 1').closest('.bg-white');
    expect(unchangedLine).toBeInTheDocument();
  });
});