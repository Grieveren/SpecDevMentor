// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReviewWorkflow, ReviewRequest, ReviewAssignment } from '../ReviewWorkflow';
import { CollaborationUser } from '../../../hooks/useCollaboration';

const mockCurrentUser: CollaborationUser = {
  id: 'user1',
  name: 'John Doe',
  email: 'john@example.com',
  color: '#4ECDC4',
  joinedAt: new Date(),
  lastActivity: new Date(),
};

const mockRequester: CollaborationUser = {
  id: 'user2',
  name: 'Alice Johnson',
  email: 'alice@example.com',
  color: '#FF6B6B',
  joinedAt: new Date(),
  lastActivity: new Date(),
};

const mockReviewer: CollaborationUser = {
  id: 'user3',
  name: 'Bob Smith',
  email: 'bob@example.com',
  color: '#45B7D1',
  joinedAt: new Date(),
  lastActivity: new Date(),
};

const mockReviewAssignment: ReviewAssignment = {
  id: 'assignment1',
  reviewer: mockReviewer,
  status: 'pending',
  assignedAt: new Date(),
  comments: [],
};

const mockReviewRequest: ReviewRequest = {
  id: 'review1',
  documentId: 'doc1',
  requestedBy: mockRequester,
  reviewers: [mockReviewAssignment],
  status: 'pending',
  createdAt: new Date(),
  priority: 'medium',
};

describe('ReviewWorkflow', () => {
  const defaultProps = {
    documentId: 'doc1',
    currentUser: mockCurrentUser,
    onRequestReview: vi.fn(),
    onSubmitReview: vi.fn(),
    onAddComment: vi.fn(),
    onResolveComment: vi.fn(),
    onCancelReview: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('No Active Review State', () => {
    it('should display empty state when no review request exists', () => {
      render(<ReviewWorkflow {...defaultProps} />);

      expect(screen.getByText('No active review')).toBeInTheDocument();
      expect(screen.getByText('Request a review to get feedback on this document.')).toBeInTheDocument();
      expect(screen.getByText('Request Review')).toBeInTheDocument();
    });

    it('should show request review button when user can request review', () => {
      render(<ReviewWorkflow {...defaultProps} />);

      const requestButton = screen.getByText('Request Review');
      expect(requestButton).toBeInTheDocument();
      expect(requestButton).not.toBeDisabled();
    });
  });

  describe('Request Review Flow', () => {
    it('should open request review form when button is clicked', async () => {
      const _user = userEvent.setup();
      render(<ReviewWorkflow {...defaultProps} />);

      const requestButton = screen.getByText('Request Review');
      await user.click(requestButton);

      expect(screen.getByText('Select Reviewers *')).toBeInTheDocument();
      expect(screen.getByText('Description (optional)')).toBeInTheDocument();
      expect(screen.getByText('Due Date (optional)')).toBeInTheDocument();
    });

    it('should allow selecting reviewers and submitting request', async () => {
      const _user = userEvent.setup();
      render(<ReviewWorkflow {...defaultProps} />);

      // Open form
      await user.click(screen.getByText('Request Review'));

      // Select a reviewer
      const checkbox = screen.getByLabelText('Alice Johnson');
      await user.click(checkbox);

      // Add description
      const descriptionTextarea = screen.getByPlaceholderText('Provide context or specific areas to focus on...');
      await user.type(descriptionTextarea, 'Please review the requirements section');

      // Submit
      const submitButton = screen.getByRole('button', { name: 'Request Review' });
      await user.click(submitButton);

      expect(defaultProps.onRequestReview).toHaveBeenCalledWith(
        ['reviewer1'],
        'Please review the requirements section',
        undefined
      );
    });

    it('should require at least one reviewer to be selected', async () => {
      const _user = userEvent.setup();
      render(<ReviewWorkflow {...defaultProps} />);

      await user.click(screen.getByText('Request Review'));

      const submitButton = screen.getByRole('button', { name: 'Request Review' });
      expect(submitButton).toBeDisabled();
    });

    it('should allow setting due date', async () => {
      const _user = userEvent.setup();
      render(<ReviewWorkflow {...defaultProps} />);

      await user.click(screen.getByText('Request Review'));

      // Select reviewer
      await user.click(screen.getByLabelText('Alice Johnson'));

      // Set due date
      const dueDateInput = screen.getByLabelText('Due Date (optional)');
      await user.type(dueDateInput, '2023-12-31');

      // Submit
      await user.click(screen.getByRole('button', { name: 'Request Review' }));

      expect(defaultProps.onRequestReview).toHaveBeenCalledWith(
        ['reviewer1'],
        undefined,
        new Date('2023-12-31')
      );
    });

    it('should close form when cancelled', async () => {
      const _user = userEvent.setup();
      render(<ReviewWorkflow {...defaultProps} />);

      await user.click(screen.getByText('Request Review'));
      expect(screen.getByText('Select Reviewers *')).toBeInTheDocument();

      await user.click(screen.getByText('Cancel'));
      expect(screen.queryByText('Select Reviewers *')).not.toBeInTheDocument();
    });
  });

  describe('Active Review Display', () => {
    it('should display review request details', () => {
      render(<ReviewWorkflow {...defaultProps} reviewRequest={mockReviewRequest} />);

      expect(screen.getByText('Review Request')).toBeInTheDocument();
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
      expect(screen.getByText('requested a review')).toBeInTheDocument();
      expect(screen.getByText('Reviewers (1)')).toBeInTheDocument();
    });

    it('should show review status and priority', () => {
      const urgentReview = {
        ...mockReviewRequest,
        status: 'in_progress' as const,
        priority: 'urgent' as const,
      };

      render(<ReviewWorkflow {...defaultProps} reviewRequest={urgentReview} />);

      expect(screen.getByText('In progress')).toBeInTheDocument();
      expect(screen.getByText('URGENT')).toBeInTheDocument();
    });

    it('should display reviewer assignments with status', () => {
      const reviewWithAssignment = {
        ...mockReviewRequest,
        reviewers: [{
          ...mockReviewAssignment,
          status: 'approved' as const,
          decision: {
            action: 'approve' as const,
            summary: 'Looks good to me',
            comments: 'Well written requirements',
            createdAt: new Date(),
          },
        }],
      };

      render(<ReviewWorkflow {...defaultProps} reviewRequest={reviewWithAssignment} />);

      expect(screen.getByText('Bob Smith')).toBeInTheDocument();
      expect(screen.getByText('APPROVED')).toBeInTheDocument();
      expect(screen.getByText('Looks good to me')).toBeInTheDocument();
      expect(screen.getByText('Well written requirements')).toBeInTheDocument();
    });

    it('should show cancel button for review requester', () => {
      const userAsRequester = {
        ...defaultProps,
        currentUser: mockRequester,
      };

      render(<ReviewWorkflow {...userAsRequester} reviewRequest={mockReviewRequest} />);

      expect(screen.getByText('Cancel Review')).toBeInTheDocument();
    });

    it('should call onCancelReview when cancel button is clicked', async () => {
      const _user = userEvent.setup();
      const userAsRequester = {
        ...defaultProps,
        currentUser: mockRequester,
      };

      render(<ReviewWorkflow {...userAsRequester} reviewRequest={mockReviewRequest} />);

      await user.click(screen.getByText('Cancel Review'));
      expect(defaultProps.onCancelReview).toHaveBeenCalled();
    });
  });

  describe('Review Submission Flow', () => {
    const reviewerProps = {
      ...defaultProps,
      currentUser: mockReviewer,
      reviewRequest: mockReviewRequest,
    };

    it('should show submit review button for assigned reviewers', () => {
      render(<ReviewWorkflow {...reviewerProps} />);

      expect(screen.getByText('Submit Review')).toBeInTheDocument();
    });

    it('should open review submission form', async () => {
      const _user = userEvent.setup();
      render(<ReviewWorkflow {...reviewerProps} />);

      await user.click(screen.getByText('Submit Review'));

      expect(screen.getByText('Decision *')).toBeInTheDocument();
      expect(screen.getByText('Summary *')).toBeInTheDocument();
      expect(screen.getByText('Comments (optional)')).toBeInTheDocument();
    });

    it('should allow selecting approve decision', async () => {
      const _user = userEvent.setup();
      render(<ReviewWorkflow {...reviewerProps} />);

      await user.click(screen.getByText('Submit Review'));

      const approveRadio = screen.getByLabelText('Approve');
      await user.click(approveRadio);

      expect(approveRadio).toBeChecked();
    });

    it('should allow selecting request changes decision', async () => {
      const _user = userEvent.setup();
      render(<ReviewWorkflow {...reviewerProps} />);

      await user.click(screen.getByText('Submit Review'));

      const changesRadio = screen.getByLabelText('Request Changes');
      await user.click(changesRadio);

      expect(changesRadio).toBeChecked();
    });

    it('should allow selecting reject decision', async () => {
      const _user = userEvent.setup();
      render(<ReviewWorkflow {...reviewerProps} />);

      await user.click(screen.getByText('Submit Review'));

      const rejectRadio = screen.getByLabelText('Reject');
      await user.click(rejectRadio);

      expect(rejectRadio).toBeChecked();
    });

    it('should require summary to submit review', async () => {
      const _user = userEvent.setup();
      render(<ReviewWorkflow {...reviewerProps} />);

      await user.click(screen.getByText('Submit Review'));

      const submitButton = screen.getByRole('button', { name: 'Submit Review' });
      expect(submitButton).toBeDisabled();

      const summaryInput = screen.getByPlaceholderText('Brief summary of your review...');
      await user.type(summaryInput, 'Review completed');

      expect(submitButton).not.toBeDisabled();
    });

    it('should submit review with all details', async () => {
      const _user = userEvent.setup();
      render(<ReviewWorkflow {...reviewerProps} />);

      await user.click(screen.getByText('Submit Review'));

      // Select decision
      await user.click(screen.getByLabelText('Request Changes'));

      // Fill summary
      const summaryInput = screen.getByPlaceholderText('Brief summary of your review...');
      await user.type(summaryInput, 'Needs improvements');

      // Fill comments
      const commentsTextarea = screen.getByPlaceholderText('Detailed feedback and suggestions...');
      await user.type(commentsTextarea, 'Please add more detail to section 2');

      // Submit
      await user.click(screen.getByRole('button', { name: 'Submit Review' }));

      expect(defaultProps.onSubmitReview).toHaveBeenCalledWith({
        action: 'request_changes',
        summary: 'Needs improvements',
        comments: 'Please add more detail to section 2',
        createdAt: expect.any(Date),
      });
    });

    it('should close form when cancelled', async () => {
      const _user = userEvent.setup();
      render(<ReviewWorkflow {...reviewerProps} />);

      await user.click(screen.getByText('Submit Review'));
      expect(screen.getByText('Decision *')).toBeInTheDocument();

      await user.click(screen.getByText('Cancel'));
      expect(screen.queryByText('Decision *')).not.toBeInTheDocument();
    });
  });

  describe('Comments and Resolution', () => {
    const reviewWithComments = {
      ...mockReviewRequest,
      reviewers: [{
        ...mockReviewAssignment,
        comments: [{
          id: 'comment1',
          content: 'This section needs clarification',
          author: mockReviewer,
          createdAt: new Date(),
          resolved: false,
          replies: [],
          position: { line: 10, character: 5 },
        }],
      }],
    };

    it('should display review comments', () => {
      render(<ReviewWorkflow {...defaultProps} reviewRequest={reviewWithComments} />);

      // Click to show comments
      fireEvent.click(screen.getByText('1 comment'));

      expect(screen.getByText('This section needs clarification')).toBeInTheDocument();
      expect(screen.getByText('Line 10')).toBeInTheDocument();
    });

    it('should show resolve button for comment author', () => {
      const reviewerProps = {
        ...defaultProps,
        currentUser: mockReviewer,
        reviewRequest: reviewWithComments,
      };

      render(<ReviewWorkflow {...reviewerProps} />);

      fireEvent.click(screen.getByText('1 comment'));
      expect(screen.getByText('Resolve')).toBeInTheDocument();
    });

    it('should call onResolveComment when resolve is clicked', async () => {
      const _user = userEvent.setup();
      const reviewerProps = {
        ...defaultProps,
        currentUser: mockReviewer,
        reviewRequest: reviewWithComments,
      };

      render(<ReviewWorkflow {...reviewerProps} />);

      fireEvent.click(screen.getByText('1 comment'));
      await user.click(screen.getByText('Resolve'));

      expect(defaultProps.onResolveComment).toHaveBeenCalledWith('comment1');
    });

    it('should display resolved comments differently', () => {
      const resolvedCommentReview = {
        ...reviewWithComments,
        reviewers: [{
          ...reviewWithComments.reviewers[0],
          comments: [{
            ...reviewWithComments.reviewers[0].comments![0],
            resolved: true,
          }],
        }],
      };

      render(<ReviewWorkflow {...defaultProps} reviewRequest={resolvedCommentReview} />);

      fireEvent.click(screen.getByText('1 comment'));
      
      // Should have green styling for resolved comments
      const commentElement = screen.getByText('This section needs clarification').closest('div');
      expect(commentElement).toHaveClass('border-green-400');
    });
  });

  describe('Role-based Permissions', () => {
    it('should not show request review button when user is already a reviewer', () => {
      const reviewerProps = {
        ...defaultProps,
        currentUser: mockReviewer,
        reviewRequest: mockReviewRequest,
      };

      render(<ReviewWorkflow {...reviewerProps} />);

      expect(screen.queryByText('Request Review')).not.toBeInTheDocument();
    });

    it('should not show submit review button for non-reviewers', () => {
      render(<ReviewWorkflow {...defaultProps} reviewRequest={mockReviewRequest} />);

      expect(screen.queryByText('Submit Review')).not.toBeInTheDocument();
    });

    it('should not show cancel button for non-requesters', () => {
      render(<ReviewWorkflow {...defaultProps} reviewRequest={mockReviewRequest} />);

      expect(screen.queryByText('Cancel Review')).not.toBeInTheDocument();
    });

    it('should hide submit review button when review is completed', () => {
      const completedReview = {
        ...mockReviewRequest,
        status: 'completed' as const,
      };

      const reviewerProps = {
        ...defaultProps,
        currentUser: mockReviewer,
        reviewRequest: completedReview,
      };

      render(<ReviewWorkflow {...reviewerProps} />);

      expect(screen.queryByText('Submit Review')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should be keyboard navigable', async () => {
      const _user = userEvent.setup();
      render(<ReviewWorkflow {...defaultProps} />);

      // Tab to request review button
      await user.tab();
      expect(screen.getByText('Request Review')).toHaveFocus();

      // Enter to open form
      await user.keyboard('{Enter}');
      expect(screen.getByText('Select Reviewers *')).toBeInTheDocument();
    });

    it('should have proper form labels', async () => {
      const _user = userEvent.setup();
      render(<ReviewWorkflow {...defaultProps} />);

      await user.click(screen.getByText('Request Review'));

      expect(screen.getByLabelText('Alice Johnson')).toBeInTheDocument();
      expect(screen.getByLabelText('Description (optional)')).toBeInTheDocument();
      expect(screen.getByLabelText('Due Date (optional)')).toBeInTheDocument();
    });

    it('should have proper ARIA attributes for status indicators', () => {
      render(<ReviewWorkflow {...defaultProps} reviewRequest={mockReviewRequest} />);

      const statusElement = screen.getByText('Pending');
      expect(statusElement).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing review request gracefully', () => {
      render(<ReviewWorkflow {...defaultProps} reviewRequest={undefined} />);

      expect(screen.getByText('No active review')).toBeInTheDocument();
      expect(screen.queryByText('Review Request')).not.toBeInTheDocument();
    });

    it('should handle empty reviewers list', () => {
      const emptyReview = {
        ...mockReviewRequest,
        reviewers: [],
      };

      render(<ReviewWorkflow {...defaultProps} reviewRequest={emptyReview} />);

      expect(screen.getByText('Reviewers (0)')).toBeInTheDocument();
    });

    it('should handle missing user information', () => {
      const incompleteUser = {
        ...mockCurrentUser,
        name: '',
      };

      render(<ReviewWorkflow {...defaultProps} currentUser={incompleteUser} />);

      // Should still render without crashing
      expect(screen.getByText('Document Review')).toBeInTheDocument();
    });
  });
});