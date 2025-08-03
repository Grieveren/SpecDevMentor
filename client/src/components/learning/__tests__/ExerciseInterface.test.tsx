// @ts-nocheck
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExerciseInterface, Exercise, ExerciseResult } from '../ExerciseInterface';

describe('ExerciseInterface', () => {
  const mockOnSubmit = vi.fn();
  const mockOnComplete = vi.fn();

  const multipleChoiceExercise: Exercise = {
    id: 'exercise-1',
    type: 'multiple_choice',
    title: 'Requirements Quiz',
    description: 'Test your knowledge of requirements engineering',
    instructions: 'Choose the best answer for each question',
    hints: ['Think about clarity', 'Consider testability'],
    difficulty: 'BEGINNER',
    points: 10,
    timeLimit: 15,
    metadata: {
      options: [
        { value: 'a', label: 'Option A' },
        { value: 'b', label: 'Option B' },
        { value: 'c', label: 'Option C' },
      ],
    },
  };

  const codeReviewExercise: Exercise = {
    id: 'exercise-2',
    type: 'code_review',
    title: 'Code Review Exercise',
    description: 'Review the following code for issues',
    instructions: 'Identify problems and suggest improvements',
    hints: ['Look for security issues', 'Check for best practices'],
    difficulty: 'INTERMEDIATE',
    points: 20,
    metadata: {
      code: 'function validateUser(user) {\n  return user.name && user.email;\n}',
    },
  };

  const mockResult: ExerciseResult = {
    exerciseId: 'exercise-1',
    score: 8,
    maxScore: 10,
    completedAt: new Date(),
    timeSpent: 5,
    attempts: 1,
    feedback: 'Good work! Consider reviewing the hints for improvement.',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render multiple choice exercise correctly', () => {
    render(
      <ExerciseInterface
        exercise={multipleChoiceExercise}
        onSubmit={mockOnSubmit}
        onComplete={mockOnComplete}
      />
    );

    expect(screen.getByText('Requirements Quiz')).toBeInTheDocument();
    expect(screen.getByText('Test your knowledge of requirements engineering')).toBeInTheDocument();
    expect(screen.getByText('BEGINNER')).toBeInTheDocument();
    expect(screen.getByText('10 points')).toBeInTheDocument();
    expect(screen.getByText('15 min limit')).toBeInTheDocument();
    
    expect(screen.getByText('Option A')).toBeInTheDocument();
    expect(screen.getByText('Option B')).toBeInTheDocument();
    expect(screen.getByText('Option C')).toBeInTheDocument();
  });

  it('should render code review exercise correctly', () => {
    render(
      <ExerciseInterface
        exercise={codeReviewExercise}
        onSubmit={mockOnSubmit}
        onComplete={mockOnComplete}
      />
    );

    expect(screen.getByText('Code Review Exercise')).toBeInTheDocument();
    expect(screen.getByText('INTERMEDIATE')).toBeInTheDocument();
    expect(screen.getByText('20 points')).toBeInTheDocument();
    
    expect(screen.getByText((content, element) => {
      return element?.textContent?.includes('function validateUser') || false;
    })).toBeInTheDocument();
    
    expect(screen.getByPlaceholderText('Provide your code review feedback here...')).toBeInTheDocument();
  });

  it('should handle multiple choice selection', () => {
    render(
      <ExerciseInterface
        exercise={multipleChoiceExercise}
        onSubmit={mockOnSubmit}
        onComplete={mockOnComplete}
      />
    );

    const optionA = screen.getByLabelText('Option A');
    fireEvent.click(optionA);

    expect(optionA).toBeChecked();
  });

  it('should show and hide hints', () => {
    render(
      <ExerciseInterface
        exercise={multipleChoiceExercise}
        onSubmit={mockOnSubmit}
        onComplete={mockOnComplete}
      />
    );

    const hintsButton = screen.getByText((content, element) => {
      return element?.textContent?.includes('Show Hints') || false;
    });
    
    fireEvent.click(hintsButton);

    expect(screen.getByText('Think about clarity')).toBeInTheDocument();
    
    const hideHintsButton = screen.getByText((content, element) => {
      return element?.textContent?.includes('Hide Hints') || false;
    });
    
    fireEvent.click(hideHintsButton);

    expect(screen.queryByText('Think about clarity')).not.toBeInTheDocument();
  });

  it('should navigate through hints', () => {
    render(
      <ExerciseInterface
        exercise={multipleChoiceExercise}
        onSubmit={mockOnSubmit}
        onComplete={mockOnComplete}
      />
    );

    const hintsButton = screen.getByText((content, element) => {
      return element?.textContent?.includes('Show Hints') || false;
    });
    
    fireEvent.click(hintsButton);

    expect(screen.getByText('Think about clarity')).toBeInTheDocument();

    const nextHintButton = screen.getByText('Next Hint');
    fireEvent.click(nextHintButton);

    expect(screen.getByText('Consider testability')).toBeInTheDocument();
  });

  it('should track time spent', async () => {
    render(
      <ExerciseInterface
        exercise={multipleChoiceExercise}
        onSubmit={mockOnSubmit}
        onComplete={mockOnComplete}
      />
    );

    // Fast forward 2 minutes
    vi.advanceTimersByTime(120000);

    await waitFor(() => {
      expect(screen.getByText('Time: 2:00')).toBeInTheDocument();
    });
  });

  it('should submit exercise and show result', async () => {
    mockOnSubmit.mockResolvedValue(mockResult);

    render(
      <ExerciseInterface
        exercise={multipleChoiceExercise}
        onSubmit={mockOnSubmit}
        onComplete={mockOnComplete}
      />
    );

    const optionA = screen.getByLabelText('Option A');
    fireEvent.click(optionA);

    const submitButton = screen.getByText('Submit');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        exerciseId: 'exercise-1',
        response: 'a',
        timeSpent: 0,
        attempts: 1,
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Score: 8/10 (80%)')).toBeInTheDocument();
      expect(screen.getByText('Good work! Consider reviewing the hints for improvement.')).toBeInTheDocument();
    });

    expect(mockOnComplete).toHaveBeenCalledWith(mockResult);
  });

  it('should disable submit button when no response', () => {
    render(
      <ExerciseInterface
        exercise={multipleChoiceExercise}
        onSubmit={mockOnSubmit}
        onComplete={mockOnComplete}
      />
    );

    const submitButton = screen.getByText('Submit');
    expect(submitButton).toBeDisabled();
  });

  it('should enable submit button when response is provided', () => {
    render(
      <ExerciseInterface
        exercise={multipleChoiceExercise}
        onSubmit={mockOnSubmit}
        onComplete={mockOnComplete}
      />
    );

    const optionA = screen.getByLabelText('Option A');
    fireEvent.click(optionA);

    const submitButton = screen.getByText('Submit');
    expect(submitButton).not.toBeDisabled();
  });

  it('should show try again button for low scores', async () => {
    const lowScoreResult: ExerciseResult = {
      ...mockResult,
      score: 4,
      maxScore: 10,
    };

    mockOnSubmit.mockResolvedValue(lowScoreResult);

    render(
      <ExerciseInterface
        exercise={multipleChoiceExercise}
        onSubmit={mockOnSubmit}
        onComplete={mockOnComplete}
      />
    );

    const optionA = screen.getByLabelText('Option A');
    fireEvent.click(optionA);

    const submitButton = screen.getByText('Submit');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });
  });

  it('should reset exercise state', () => {
    render(
      <ExerciseInterface
        exercise={multipleChoiceExercise}
        onSubmit={mockOnSubmit}
        onComplete={mockOnComplete}
      />
    );

    const optionA = screen.getByLabelText('Option A');
    fireEvent.click(optionA);

    expect(optionA).toBeChecked();

    const resetButton = screen.getByText('Reset');
    fireEvent.click(resetButton);

    expect(optionA).not.toBeChecked();
  });

  it('should show previous result if provided', () => {
    render(
      <ExerciseInterface
        exercise={multipleChoiceExercise}
        onSubmit={mockOnSubmit}
        onComplete={mockOnComplete}
        previousResult={mockResult}
      />
    );

    expect(screen.getByText('Score: 8/10 (80%)')).toBeInTheDocument();
    expect(screen.getByText('Attempts: 1')).toBeInTheDocument();
  });

  it('should handle code review exercise input', () => {
    render(
      <ExerciseInterface
        exercise={codeReviewExercise}
        onSubmit={mockOnSubmit}
        onComplete={mockOnComplete}
      />
    );

    const textarea = screen.getByPlaceholderText('Provide your code review feedback here...');
    fireEvent.change(textarea, { target: { value: 'The function lacks input validation' } });

    expect(textarea).toHaveValue('The function lacks input validation');
  });

  it('should show difficulty-specific styling', () => {
    render(
      <ExerciseInterface
        exercise={multipleChoiceExercise}
        onSubmit={mockOnSubmit}
        onComplete={mockOnComplete}
      />
    );

    const difficultyBadge = screen.getByText('BEGINNER');
    expect(difficultyBadge).toHaveClass('text-green-600', 'bg-green-100');
  });

  it('should show submitting state', async () => {
    mockOnSubmit.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(mockResult), 1000)));

    render(
      <ExerciseInterface
        exercise={multipleChoiceExercise}
        onSubmit={mockOnSubmit}
        onComplete={mockOnComplete}
      />
    );

    const optionA = screen.getByLabelText('Option A');
    fireEvent.click(optionA);

    const submitButton = screen.getByText('Submit');
    fireEvent.click(submitButton);

    expect(screen.getByText('Submitting...')).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
  });
});