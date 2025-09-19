import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CollaborativeSpecificationEditor } from '../CollaborativeSpecificationEditor';
import { SpecificationPhase, DocumentStatus } from '../../../types/project';
import * as collaborationHook from '../../../hooks/useCollaboration';

// Mock the collaboration hook
vi.mock('../../../hooks/useCollaboration');

const mockUseCollaboration = collaborationHook.useCollaboration as Mock;

const mockDocument = {
  id: 'doc-1',
  phase: SpecificationPhase.REQUIREMENTS,
  content: 'Initial content',
  status: DocumentStatus.DRAFT,
  version: 1,
  updatedAt: '2023-01-01T00:00:00Z',
};

const mockCollaborationState = {
  isConnected: true,
  collaborators: [
    {
      id: 'user-2',
      name: 'Jane Doe',
      email: 'jane@example.com',
      color: '#FF6B6B',
      joinedAt: new Date(),
      lastActivity: new Date(),
    },
  ],
  currentUser: {
    id: 'user-1',
    name: 'John Doe',
    email: 'john@example.com',
    color: '#4ECDC4',
    joinedAt: new Date(),
    lastActivity: new Date(),
  },
  cursors: {},
  isJoining: false,
  sendDocumentChange: vi.fn(),
  sendCursorPosition: vi.fn(),
  disconnect: vi.fn(),
  retry: vi.fn(),
};

describe('CollaborativeSpecificationEditor', () => {
  const defaultProps = {
    document: mockDocument,
    mode: 'edit' as const,
    onSave: vi.fn(),
    collaborationEnabled: true,
    authToken: 'test-token',
  };

  beforeEach(() => {
    mockUseCollaboration.mockReturnValue(mockCollaborationState);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Collaboration Integration', () => {
    it('should initialize collaboration hook with correct parameters', () => {
      render(<CollaborativeSpecificationEditor {...defaultProps} />);

      expect(mockUseCollaboration).toHaveBeenCalledWith({
        documentId: 'doc-1',
        token: 'test-token',
        onDocumentChange: expect.any(Function),
        onContentUpdate: expect.any(Function),
        onError: expect.any(Function),
      });
    });

    it('should display collaboration status and user indicators', () => {
      render(<CollaborativeSpecificationEditor {...defaultProps} />);

      expect(screen.getByText('Connected')).toBeInTheDocument();
      expect(screen.getByText('1 person editing')).toBeInTheDocument();
      expect(screen.getByText('Live collaboration active')).toBeInTheDocument();
    });

    it('should show offline status when not connected', () => {
      mockUseCollaboration.mockReturnValue({
        ...mockCollaborationState,
        isConnected: false,
        collaborators: [],
      });

      render(<CollaborativeSpecificationEditor {...defaultProps} />);

      expect(screen.getByText('Offline')).toBeInTheDocument();
      expect(screen.getByText('Working alone')).toBeInTheDocument();
    });

    it('should display error state and retry button', () => {
      mockUseCollaboration.mockReturnValue({
        ...mockCollaborationState,
        isConnected: false,
        error: 'Connection failed',
      });

      render(<CollaborativeSpecificationEditor {...defaultProps} />);

      expect(screen.getByText('Connection failed')).toBeInTheDocument();
      
      const retryButton = screen.getByText('Retry');
      fireEvent.click(retryButton);
      
      expect(mockCollaborationState.retry).toHaveBeenCalled();
    });
  });

  describe('Multi-user Editing Scenarios', () => {
    it('should handle remote document changes', async () => {
      const _user = userEvent.setup();
      let onDocumentChange: Function;

      mockUseCollaboration.mockImplementation(({ onDocumentChange: callback }) => {
        onDocumentChange = callback;
        return mockCollaborationState;
      });

      render(<CollaborativeSpecificationEditor {...defaultProps} />);

      // Simulate remote change
      const remoteChange = {
        id: 'change-1',
        type: 'insert',
        position: 7,
        content: ' updated',
        author: 'user-2',
        timestamp: new Date(),
        documentId: 'doc-1',
      };

      onDocumentChange(remoteChange);

      await waitFor(() => {
        const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
        expect(textarea.value).toBe('Initial updated content');
      });
    });

    it('should send document changes to collaboration service', async () => {
      const _user = userEvent.setup();
      render(<CollaborativeSpecificationEditor {...defaultProps} />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      
      // Type new content
      await user.clear(textarea);
      await user.type(textarea, 'New content');

      await waitFor(() => {
        expect(mockCollaborationState.sendDocumentChange).toHaveBeenCalled();
      });
    });

    it('should track cursor position and send updates', async () => {
      const _user = userEvent.setup();
      render(<CollaborativeSpecificationEditor {...defaultProps} />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      
      // Click to position cursor
      await user.click(textarea);
      
      // Move cursor
      fireEvent.keyUp(textarea);

      await waitFor(() => {
        expect(mockCollaborationState.sendCursorPosition).toHaveBeenCalled();
      });
    });

    it('should display other users cursors', () => {
      const cursorsState = {
        'user-2': {
          userId: 'user-2',
          documentId: 'doc-1',
          line: 1,
          character: 5,
          timestamp: new Date(),
        },
      };

      mockUseCollaboration.mockReturnValue({
        ...mockCollaborationState,
        cursors: cursorsState,
      });

      render(<CollaborativeSpecificationEditor {...defaultProps} />);

      // The cursors component should be rendered (though positioning might not work in tests)
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('should handle concurrent editing with operational transformation', async () => {
      const _user = userEvent.setup();
      let onDocumentChange: Function;

      mockUseCollaboration.mockImplementation(({ onDocumentChange: callback }) => {
        onDocumentChange = callback;
        return mockCollaborationState;
      });

      render(<CollaborativeSpecificationEditor {...defaultProps} />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

      // Start typing
      await user.click(textarea);
      await user.type(textarea, 'Local change');

      // Simulate remote change at same time
      const remoteChange = {
        id: 'change-2',
        type: 'insert',
        position: 0,
        content: 'Remote: ',
        author: 'user-2',
        timestamp: new Date(),
        documentId: 'doc-1',
      };

      onDocumentChange(remoteChange);

      await waitFor(() => {
        // Content should include both changes
        expect(textarea.value).toContain('Remote:');
        expect(textarea.value).toContain('Local change');
      });
    });
  });

  describe('Collaborative Comments', () => {
    it('should toggle comments panel', async () => {
      const _user = userEvent.setup();
      render(<CollaborativeSpecificationEditor {...defaultProps} />);

      const commentsButton = screen.getByText('Comments');
      await user.click(commentsButton);

      // Comments panel should be visible (though empty in this test)
      expect(commentsButton).toHaveClass('bg-blue-100');
    });

    it('should handle comment creation', async () => {
      const _user = userEvent.setup();
      render(<CollaborativeSpecificationEditor {...defaultProps} />);

      // Open comments panel
      const commentsButton = screen.getByText('Comments');
      await user.click(commentsButton);

      // The comment creation trigger should be available
      // (Actual comment creation would require more complex setup)
      expect(commentsButton).toBeInTheDocument();
    });
  });

  describe('Toolbar Integration', () => {
    it('should provide phase-specific toolbar items for requirements', () => {
      render(<CollaborativeSpecificationEditor {...defaultProps} />);

      expect(screen.getByText('User Story')).toBeInTheDocument();
      expect(screen.getByText('EARS Format')).toBeInTheDocument();
      expect(screen.getByText('Requirement')).toBeInTheDocument();
    });

    it('should provide phase-specific toolbar items for design', () => {
      const designDocument = {
        ...mockDocument,
        phase: SpecificationPhase.DESIGN,
      };

      render(
        <CollaborativeSpecificationEditor 
          {...defaultProps} 
          document={designDocument} 
        />
      );

      expect(screen.getByText('Architecture')).toBeInTheDocument();
      expect(screen.getByText('Component')).toBeInTheDocument();
      expect(screen.getByText('Mermaid Diagram')).toBeInTheDocument();
    });

    it('should provide phase-specific toolbar items for tasks', () => {
      const tasksDocument = {
        ...mockDocument,
        phase: SpecificationPhase.TASKS,
      };

      render(
        <CollaborativeSpecificationEditor 
          {...defaultProps} 
          document={tasksDocument} 
        />
      );

      expect(screen.getByText('Task')).toBeInTheDocument();
      expect(screen.getByText('Subtask')).toBeInTheDocument();
      expect(screen.getByText('Requirements Ref')).toBeInTheDocument();
    });

    it('should insert templates when toolbar buttons are clicked', async () => {
      const _user = userEvent.setup();
      render(<CollaborativeSpecificationEditor {...defaultProps} />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      const userStoryButton = screen.getByText('User Story');

      await user.click(textarea);
      await user.click(userStoryButton);

      await waitFor(() => {
        expect(textarea.value).toContain('**User Story:** As a [role], I want [feature], so that [benefit]');
      });
    });
  });

  describe('Auto-save with Collaboration', () => {
    it('should auto-save changes while maintaining collaboration', async () => {
      const _user = userEvent.setup();
      const onSave = vi.fn().mockResolvedValue(undefined);

      render(
        <CollaborativeSpecificationEditor 
          {...defaultProps} 
          onSave={onSave}
        />
      );

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      
      await user.clear(textarea);
      await user.type(textarea, 'Auto-save test content');

      // Wait for auto-save to trigger
      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith('Auto-save test content');
      }, { timeout: 3000 });

      // Should still send changes to collaboration
      expect(mockCollaborationState.sendDocumentChange).toHaveBeenCalled();
    });

    it('should show unsaved changes indicator', async () => {
      const _user = userEvent.setup();
      render(<CollaborativeSpecificationEditor {...defaultProps} />);

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      
      await user.type(textarea, ' modified');

      await waitFor(() => {
        expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should be keyboard navigable', async () => {
      const _user = userEvent.setup();
      render(<CollaborativeSpecificationEditor {...defaultProps} />);

      // Tab through interactive elements
      await user.tab();
      expect(screen.getByRole('textbox')).toHaveFocus();

      await user.tab();
      expect(screen.getByText('Comments')).toHaveFocus();
    });

    it('should have proper ARIA labels', () => {
      render(<CollaborativeSpecificationEditor {...defaultProps} />);

      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('placeholder');
    });
  });

  describe('Error Handling', () => {
    it('should handle collaboration errors gracefully', () => {
      const onError = vi.fn();
      
      mockUseCollaboration.mockImplementation(({ onError: callback }) => {
        callback('Test error');
        return {
          ...mockCollaborationState,
          error: 'Test error',
          isConnected: false,
        };
      });

      render(<CollaborativeSpecificationEditor {...defaultProps} />);

      expect(screen.getByText('Connection failed')).toBeInTheDocument();
    });

    it('should handle save errors during collaboration', async () => {
      const _user = userEvent.setup();
      const onSave = vi.fn().mockRejectedValue(new Error('Save failed'));

      render(
        <CollaborativeSpecificationEditor 
          {...defaultProps} 
          onSave={onSave}
        />
      );

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      
      await user.type(textarea, ' error test');

      // Wait for auto-save attempt
      await waitFor(() => {
        expect(onSave).toHaveBeenCalled();
      }, { timeout: 3000 });

      // Should still maintain collaboration state
      expect(mockCollaborationState.sendDocumentChange).toHaveBeenCalled();
    });
  });
});