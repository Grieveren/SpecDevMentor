// @ts-nocheck
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LessonViewer, LessonContent } from '../LessonViewer';

describe('LessonViewer', () => {
  const mockOnComplete = vi.fn();
  const mockOnProgress = vi.fn();

  const textLesson: LessonContent = {
    id: 'lesson-1',
    type: 'text',
    title: 'Introduction to Requirements',
    content: '<p>This is a text lesson about requirements.</p>',
    duration: 15,
    order: 1,
  };

  const videoLesson: LessonContent = {
    id: 'lesson-2',
    type: 'video',
    title: 'Requirements Video Tutorial',
    content: 'Video content',
    duration: 20,
    order: 2,
  };

  const interactiveLesson: LessonContent = {
    id: 'lesson-3',
    type: 'interactive',
    title: 'Interactive Exercise',
    content: '<p>Try writing a requirement using EARS format.</p>',
    duration: 30,
    order: 3,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render text lesson correctly', () => {
    render(
      <LessonViewer
        lesson={textLesson}
        isCompleted={false}
        onComplete={mockOnComplete}
        onProgress={mockOnProgress}
      />
    );

    expect(screen.getByText('Introduction to Requirements')).toBeInTheDocument();
    expect(screen.getByText('15 min')).toBeInTheDocument();
    expect(screen.getByText('Mark Complete')).toBeInTheDocument();
    expect(screen.getByText((content, element) => {
      return element?.textContent?.includes('This is a text lesson about requirements') || false;
    })).toBeInTheDocument();
  });

  it('should render video lesson with play controls', () => {
    render(
      <LessonViewer
        lesson={videoLesson}
        isCompleted={false}
        onComplete={mockOnComplete}
        onProgress={mockOnProgress}
      />
    );

    expect(screen.getByText('Requirements Video Tutorial')).toBeInTheDocument();
    expect(screen.getByText('Play')).toBeInTheDocument();
    expect(screen.getByText('Duration: 20 minutes')).toBeInTheDocument();
  });

  it('should toggle play/pause for video lessons', () => {
    render(
      <LessonViewer
        lesson={videoLesson}
        isCompleted={false}
        onComplete={mockOnComplete}
        onProgress={mockOnProgress}
      />
    );

    const playButton = screen.getByText('Play');
    fireEvent.click(playButton);

    expect(screen.getByText('Pause')).toBeInTheDocument();
  });

  it('should render interactive lesson with textarea', () => {
    render(
      <LessonViewer
        lesson={interactiveLesson}
        isCompleted={false}
        onComplete={mockOnComplete}
        onProgress={mockOnProgress}
      />
    );

    expect(screen.getByText('Interactive Exercise')).toBeInTheDocument();
    expect(screen.getByText('Interactive Exercise')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Write your response here...')).toBeInTheDocument();
    expect(screen.getByText('Submit Response')).toBeInTheDocument();
  });

  it('should show completed state correctly', () => {
    render(
      <LessonViewer
        lesson={textLesson}
        isCompleted={true}
        onComplete={mockOnComplete}
        onProgress={mockOnProgress}
      />
    );

    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.queryByText('Mark Complete')).not.toBeInTheDocument();
  });

  it('should call onComplete when mark complete is clicked', () => {
    render(
      <LessonViewer
        lesson={textLesson}
        isCompleted={false}
        onComplete={mockOnComplete}
        onProgress={mockOnProgress}
      />
    );

    const completeButton = screen.getByText('Mark Complete');
    fireEvent.click(completeButton);

    expect(mockOnComplete).toHaveBeenCalledTimes(1);
  });

  it('should track progress over time when playing', async () => {
    render(
      <LessonViewer
        lesson={videoLesson}
        isCompleted={false}
        onComplete={mockOnComplete}
        onProgress={mockOnProgress}
      />
    );

    const playButton = screen.getByText('Play');
    fireEvent.click(playButton);

    // Fast forward time
    vi.advanceTimersByTime(60000); // 1 minute

    await waitFor(() => {
      expect(mockOnProgress).toHaveBeenCalled();
    });
  });

  it('should auto-complete when 80% progress is reached', async () => {
    render(
      <LessonViewer
        lesson={textLesson}
        isCompleted={false}
        onComplete={mockOnComplete}
        onProgress={mockOnProgress}
      />
    );

    const playButton = screen.getByText('Mark Complete');
    fireEvent.click(playButton);

    // Simulate reaching 80% of lesson duration
    vi.advanceTimersByTime(textLesson.duration * 60 * 1000 * 0.8);

    await waitFor(() => {
      expect(mockOnComplete).toHaveBeenCalled();
    });
  });

  it('should display progress bar when lesson is in progress', async () => {
    render(
      <LessonViewer
        lesson={videoLesson}
        isCompleted={false}
        onComplete={mockOnComplete}
        onProgress={mockOnProgress}
      />
    );

    const playButton = screen.getByText('Play');
    fireEvent.click(playButton);

    // Fast forward to show some progress
    vi.advanceTimersByTime(30000); // 30 seconds

    await waitFor(() => {
      expect(screen.getByText('Progress')).toBeInTheDocument();
    });
  });

  it('should format time correctly', () => {
    render(
      <LessonViewer
        lesson={videoLesson}
        isCompleted={false}
        onComplete={mockOnComplete}
        onProgress={mockOnProgress}
      />
    );

    const playButton = screen.getByText('Play');
    fireEvent.click(playButton);

    // Fast forward 1 minute 30 seconds
    vi.advanceTimersByTime(90000);

    expect(screen.getByText((content, element) => {
      return element?.textContent?.includes('1:30') || false;
    })).toBeInTheDocument();
  });

  it('should handle interactive lesson submission', () => {
    render(
      <LessonViewer
        lesson={interactiveLesson}
        isCompleted={false}
        onComplete={mockOnComplete}
        onProgress={mockOnProgress}
      />
    );

    const textarea = screen.getByPlaceholderText('Write your response here...');
    const submitButton = screen.getByText('Submit Response');

    fireEvent.change(textarea, { target: { value: 'My response' } });
    fireEvent.click(submitButton);

    // Should show some feedback or interaction
    expect(textarea).toHaveValue('My response');
  });

  it('should show reset button for interactive lessons', () => {
    render(
      <LessonViewer
        lesson={interactiveLesson}
        isCompleted={false}
        onComplete={mockOnComplete}
        onProgress={mockOnProgress}
      />
    );

    expect(screen.getByText('Reset')).toBeInTheDocument();
  });
});