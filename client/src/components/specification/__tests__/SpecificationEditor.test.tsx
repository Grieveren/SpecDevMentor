// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MockedFunction } from 'vitest';
import { SpecificationEditor } from '../SpecificationEditor';
import type { SpecificationEditorProps } from '../SpecificationEditor';
import { SpecificationPhase, DocumentStatus } from '../../../types/project';

const mockDocument = {
  id: 'doc-1',
  phase: SpecificationPhase.REQUIREMENTS,
  content: '# Test Requirements\n\nThis is a test document.',
  status: DocumentStatus.DRAFT,
  version: 1,
  updatedAt: '2023-01-01T00:00:00Z',
};

const mockOnSave: MockedFunction<(content: string) => Promise<void>> = vi.fn();
const mockOnRequestReview: MockedFunction<() => Promise<void>> = vi.fn();

const defaultProps: SpecificationEditorProps = {
  document: mockDocument,
  mode: 'edit',
  onSave: mockOnSave,
};

describe('SpecificationEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSave.mockClear();
    mockOnRequestReview.mockClear();
  });

  it('should render with default props', () => {
    render(<SpecificationEditor {...defaultProps} />);
    
    expect(screen.getByText('Requirements Document')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText('Version 1')).toBeInTheDocument();
  });

  it('should display content in edit mode', () => {
    render(<SpecificationEditor {...defaultProps} />);
    
    const textarea = screen.getByRole('textbox');
    expect(textarea).toHaveValue(mockDocument.content);
  });

  it('should display content in preview mode', () => {
    render(<SpecificationEditor {...defaultProps} mode="readonly" />);
    
    expect(screen.getByText(mockDocument.content)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('should toggle between edit and preview modes', async () => {
    const user = userEvent.setup();
    render(<SpecificationEditor {...defaultProps} />);
    
    // Should start in edit mode
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    
    // Click preview button
    const previewButton = screen.getByText('Preview');
    await user.click(previewButton);
    
    // Should switch to preview mode
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText(mockDocument.content)).toBeInTheDocument();
    
    // Click edit button
    const editButton = screen.getByText('Edit');
    await user.click(editButton);
    
    // Should switch back to edit mode
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('should call onSave when content changes', async () => {
    const user = userEvent.setup();
    mockOnSave.mockResolvedValue(undefined);
    
    render(<SpecificationEditor {...defaultProps} />);
    
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    await user.clear(textarea);
    await user.type(textarea, 'New content');
    
    // Wait for auto-save (2 second delay)
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith('New content');
    }, { timeout: 3000 });
  });

  it('should show unsaved changes indicator', async () => {
    const user = userEvent.setup();
    render(<SpecificationEditor {...defaultProps} />);
    
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    await user.type(textarea, ' Modified');
    
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
  });

  it('should show saving indicator during save', async () => {
    const user = userEvent.setup();
    const mockOnSaveLocal = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    
    render(<SpecificationEditor {...defaultProps} onSave={mockOnSaveLocal} />);
    
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    await user.type(textarea, ' Modified');
    
    // Trigger manual save
    const saveButton = screen.getByText('Save Now');
    await user.click(saveButton);
    
    expect(screen.getByText('Saving...')).toBeInTheDocument();
  });

  it('should display phase-specific toolbar items for requirements', () => {
    render(<SpecificationEditor {...defaultProps} />);
    
    expect(screen.getByText('User Story')).toBeInTheDocument();
    expect(screen.getByText('EARS Format')).toBeInTheDocument();
    expect(screen.getByText('Requirement')).toBeInTheDocument();
  });

  it('should display phase-specific toolbar items for design', () => {
    const designDocument = {
      ...mockDocument,
      phase: SpecificationPhase.DESIGN,
    };
    
    render(<SpecificationEditor {...defaultProps} document={designDocument} />);
    
    expect(screen.getByText('Architecture')).toBeInTheDocument();
    expect(screen.getByText('Component')).toBeInTheDocument();
    expect(screen.getByText('Mermaid Diagram')).toBeInTheDocument();
  });

  it('should display phase-specific toolbar items for tasks', () => {
    const tasksDocument = {
      ...mockDocument,
      phase: SpecificationPhase.TASKS,
    };
    
    render(<SpecificationEditor {...defaultProps} document={tasksDocument} />);
    
    expect(screen.getByText('Task')).toBeInTheDocument();
    expect(screen.getByText('Subtask')).toBeInTheDocument();
    expect(screen.getByText('Requirements Ref')).toBeInTheDocument();
  });

  it('should show request review button for draft documents', () => {
    render(
      <SpecificationEditor 
        {...defaultProps} 
        onRequestReview={mockOnRequestReview}
      />
    );
    
    expect(screen.getByText('Request Review')).toBeInTheDocument();
  });

  it('should not show request review button for approved documents', () => {
    const approvedDocument = {
      ...mockDocument,
      status: DocumentStatus.APPROVED,
    };
    
    const props: SpecificationEditorProps = {
      ...defaultProps,
      document: approvedDocument,
      onRequestReview: mockOnRequestReview
    };
    
    render(<SpecificationEditor {...props} />);
    
    expect(screen.queryByText('Request Review')).not.toBeInTheDocument();
  });

  it('should call onRequestReview when button is clicked', async () => {
    const user = userEvent.setup();
    mockOnRequestReview.mockResolvedValue(undefined);
    
    const props: SpecificationEditorProps = {
      ...defaultProps,
      onRequestReview: mockOnRequestReview
    };
    
    render(<SpecificationEditor {...props} />);
    
    const reviewButton = screen.getByText('Request Review');
    await user.click(reviewButton);
    
    expect(mockOnRequestReview).toHaveBeenCalled();
  });

  it('should show collaboration indicator when enabled', () => {
    const props: SpecificationEditorProps = {
      ...defaultProps,
      collaborationEnabled: true
    };
    render(<SpecificationEditor {...props} />);
    
    expect(screen.getByText('Live collaboration enabled')).toBeInTheDocument();
  });

  it('should display character and line count', () => {
    render(<SpecificationEditor {...defaultProps} />);
    
    expect(screen.getByText(`${mockDocument.content.length} characters`)).toBeInTheDocument();
    expect(screen.getByText(`${mockDocument.content.split('\n').length} lines`)).toBeInTheDocument();
  });

  it('should be readonly when mode is readonly', () => {
    const props: SpecificationEditorProps = {
      ...defaultProps,
      mode: "readonly"
    };
    render(<SpecificationEditor {...props} />);
    
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByText('Save Now')).not.toBeInTheDocument();
    expect(screen.queryByText('Request Review')).not.toBeInTheDocument();
  });

  it('should insert markdown formatting when toolbar buttons are clicked', async () => {
    const user = userEvent.setup();
    render(<SpecificationEditor {...defaultProps} />);
    
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    
    // Select some text
    textarea.setSelectionRange(0, 4); // Select "# Te"
    
    // Click bold button
    const boldButton = screen.getByText('Bold');
    await user.click(boldButton);
    
    // Should wrap selected text with bold markdown
    expect(textarea.value).toContain('**# Te**');
  });
});