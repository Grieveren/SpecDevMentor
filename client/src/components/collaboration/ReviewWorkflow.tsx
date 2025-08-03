// @ts-nocheck
import React, { useState } from 'react';
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  UserIcon,
  ChatBubbleLeftIcon,
  ExclamationTriangleIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import { CollaborationUser } from '../../hooks/useCollaboration';
import { UserAvatar } from './CollaborationIndicator';
import { cn } from '../../utils/cn';

export interface ReviewRequest {
  id: string;
  documentId: string;
  requestedBy: CollaborationUser;
  reviewers: ReviewAssignment[];
  status: 'pending' | 'in_progress' | 'completed' | 'rejected';
  createdAt: Date;
  dueDate?: Date;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

export interface ReviewAssignment {
  id: string;
  reviewer: CollaborationUser;
  status: 'pending' | 'in_progress' | 'approved' | 'rejected' | 'changes_requested';
  assignedAt: Date;
  completedAt?: Date;
  comments?: ReviewComment[];
  decision?: ReviewDecision;
}

export interface ReviewComment {
  id: string;
  content: string;
  author: CollaborationUser;
  createdAt: Date;
  position?: { line: number; character: number };
  resolved: boolean;
  replies: ReviewComment[];
}

export interface ReviewDecision {
  action: 'approve' | 'reject' | 'request_changes';
  summary: string;
  comments: string;
  createdAt: Date;
}

export interface ReviewWorkflowProps {
  documentId: string;
  currentUser: CollaborationUser;
  reviewRequest?: ReviewRequest;
  onRequestReview: (reviewers: string[], description?: string, dueDate?: Date) => void;
  onSubmitReview: (decision: ReviewDecision) => void;
  onAddComment: (content: string, position?: { line: number; character: number }) => void;
  onResolveComment: (commentId: string) => void;
  onCancelReview: () => void;
  className?: string;
}

export const ReviewWorkflow: React.FC<ReviewWorkflowProps> = ({
  documentId,
  currentUser,
  reviewRequest,
  onRequestReview,
  onSubmitReview,
  onAddComment,
  onResolveComment,
  onCancelReview,
  className,
}) => {
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);

  const isReviewer = reviewRequest?.reviewers.some(r => r.reviewer.id === currentUser.id);
  const isRequester = reviewRequest?.requestedBy.id === currentUser.id;
  const canRequestReview = !reviewRequest && !isReviewer;
  const canReview = isReviewer && reviewRequest?.status !== 'completed';

  const getStatusIcon = (status: ReviewRequest['status']) => {
    switch (status) {
      case 'pending':
        return <ClockIcon className="h-5 w-5 text-yellow-500" />;
      case 'in_progress':
        return <EyeIcon className="h-5 w-5 text-blue-500" />;
      case 'completed':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'rejected':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const getAssignmentStatusColor = (status: ReviewAssignment['status']) => {
    switch (status) {
      case 'approved':
        return 'text-green-600 bg-green-50';
      case 'rejected':
        return 'text-red-600 bg-red-50';
      case 'changes_requested':
        return 'text-yellow-600 bg-yellow-50';
      case 'in_progress':
        return 'text-blue-600 bg-blue-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getPriorityColor = (priority: ReviewRequest['priority']) => {
    switch (priority) {
      case 'urgent':
        return 'text-red-600 bg-red-100';
      case 'high':
        return 'text-orange-600 bg-orange-100';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className={cn('bg-white border border-gray-200 rounded-lg shadow-sm', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <ChatBubbleLeftIcon className="h-6 w-6 text-gray-400" />
          <div>
            <h3 className="text-lg font-medium text-gray-900">Document Review</h3>
            {reviewRequest && (
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                {getStatusIcon(reviewRequest.status)}
                <span className="capitalize">{reviewRequest.status.replace('_', ' ')}</span>
                {reviewRequest.priority !== 'low' && (
                  <>
                    <span>•</span>
                    <span className={cn('px-2 py-1 rounded-full text-xs font-medium', getPriorityColor(reviewRequest.priority))}>
                      {reviewRequest.priority.toUpperCase()}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex space-x-2">
          {canRequestReview && (
            <button
              onClick={() => setShowRequestForm(true)}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Request Review
            </button>
          )}
          
          {canReview && (
            <button
              onClick={() => setShowReviewForm(true)}
              className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
            >
              Submit Review
            </button>
          )}

          {isRequester && reviewRequest?.status === 'pending' && (
            <button
              onClick={onCancelReview}
              className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Cancel Review
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {!reviewRequest ? (
          <div className="text-center py-8">
            <ChatBubbleLeftIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No active review</h3>
            <p className="mt-1 text-sm text-gray-500">
              Request a review to get feedback on this document.
            </p>
          </div>
        ) : (
          <ReviewDetails
            reviewRequest={reviewRequest}
            currentUser={currentUser}
            onResolveComment={onResolveComment}
          />
        )}
      </div>

      {/* Request Review Form */}
      {showRequestForm && (
        <RequestReviewForm
          onSubmit={(reviewers, description, dueDate) => {
            onRequestReview(reviewers, description, dueDate);
            setShowRequestForm(false);
          }}
          onCancel={() => setShowRequestForm(false)}
        />
      )}

      {/* Submit Review Form */}
      {showReviewForm && reviewRequest && (
        <SubmitReviewForm
          reviewRequest={reviewRequest}
          currentUser={currentUser}
          onSubmit={(decision) => {
            onSubmitReview(decision);
            setShowReviewForm(false);
          }}
          onCancel={() => setShowReviewForm(false)}
        />
      )}
    </div>
  );
};

interface ReviewDetailsProps {
  reviewRequest: ReviewRequest;
  currentUser: CollaborationUser;
  onResolveComment: (commentId: string) => void;
}

const ReviewDetails: React.FC<ReviewDetailsProps> = ({
  reviewRequest,
  currentUser,
  onResolveComment,
}) => {
  return (
    <div className="space-y-6">
      {/* Review Info */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-900">Review Request</h4>
          <span className="text-xs text-gray-500">
            Requested {new Date(reviewRequest.createdAt).toLocaleDateString()}
          </span>
        </div>
        
        <div className="flex items-start space-x-3">
          <UserAvatar user={reviewRequest.requestedBy} size="sm" />
          <div className="flex-1">
            <p className="text-sm text-gray-900">
              <span className="font-medium">{reviewRequest.requestedBy.name}</span> requested a review
            </p>
            {reviewRequest.description && (
              <p className="mt-1 text-sm text-gray-600">{reviewRequest.description}</p>
            )}
            {reviewRequest.dueDate && (
              <p className="mt-1 text-xs text-gray-500">
                Due: {new Date(reviewRequest.dueDate).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Reviewers */}
      <div>
        <h4 className="text-sm font-medium text-gray-900 mb-3">
          Reviewers ({reviewRequest.reviewers.length})
        </h4>
        <div className="space-y-3">
          {reviewRequest.reviewers.map((assignment) => (
            <ReviewerAssignment
              key={assignment.id}
              assignment={assignment}
              currentUser={currentUser}
              onResolveComment={onResolveComment}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

interface ReviewerAssignmentProps {
  assignment: ReviewAssignment;
  currentUser: CollaborationUser;
  onResolveComment: (commentId: string) => void;
}

const ReviewerAssignment: React.FC<ReviewerAssignmentProps> = ({
  assignment,
  currentUser,
  onResolveComment,
}) => {
  const [showComments, setShowComments] = useState(false);

  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <UserAvatar user={assignment.reviewer} size="sm" />
          <div>
            <p className="text-sm font-medium text-gray-900">
              {assignment.reviewer.name}
            </p>
            <p className="text-xs text-gray-500">
              Assigned {new Date(assignment.assignedAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className={cn(
            'px-2 py-1 text-xs font-medium rounded-full',
            getAssignmentStatusColor(assignment.status)
          )}>
            {assignment.status.replace('_', ' ').toUpperCase()}
          </span>
          
          {assignment.comments && assignment.comments.length > 0 && (
            <button
              onClick={() => setShowComments(!showComments)}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              {assignment.comments.length} comment{assignment.comments.length !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>

      {/* Review Decision */}
      {assignment.decision && (
        <div className="mt-3 p-3 bg-gray-50 rounded-md">
          <div className="flex items-center space-x-2 mb-2">
            {assignment.decision.action === 'approve' && (
              <CheckCircleIcon className="h-4 w-4 text-green-500" />
            )}
            {assignment.decision.action === 'reject' && (
              <XCircleIcon className="h-4 w-4 text-red-500" />
            )}
            {assignment.decision.action === 'request_changes' && (
              <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500" />
            )}
            <span className="text-sm font-medium text-gray-900">
              {assignment.decision.summary}
            </span>
          </div>
          {assignment.decision.comments && (
            <p className="text-sm text-gray-600">{assignment.decision.comments}</p>
          )}
        </div>
      )}

      {/* Comments */}
      {showComments && assignment.comments && (
        <div className="mt-3 space-y-2">
          {assignment.comments.map((comment) => (
            <ReviewCommentItem
              key={comment.id}
              comment={comment}
              currentUser={currentUser}
              onResolve={() => onResolveComment(comment.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface ReviewCommentItemProps {
  comment: ReviewComment;
  currentUser: CollaborationUser;
  onResolve: () => void;
}

const ReviewCommentItem: React.FC<ReviewCommentItemProps> = ({
  comment,
  currentUser,
  onResolve,
}) => {
  return (
    <div className={cn(
      'p-2 rounded border-l-4',
      comment.resolved ? 'border-green-400 bg-green-50' : 'border-blue-400 bg-blue-50'
    )}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-2">
          <UserAvatar user={comment.author} size="sm" />
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-900">
                {comment.author.name}
              </span>
              <span className="text-xs text-gray-500">
                {new Date(comment.createdAt).toLocaleTimeString()}
              </span>
              {comment.position && (
                <span className="text-xs text-gray-500">
                  Line {comment.position.line}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-gray-700">{comment.content}</p>
          </div>
        </div>

        {!comment.resolved && (comment.author.id === currentUser.id || currentUser.id === 'admin') && (
          <button
            onClick={onResolve}
            className="text-xs text-green-600 hover:text-green-800"
          >
            Resolve
          </button>
        )}
      </div>

      {/* Replies */}
      {comment.replies.length > 0 && (
        <div className="mt-2 ml-6 space-y-1">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="flex items-start space-x-2">
              <UserAvatar user={reply.author} size="sm" />
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-medium text-gray-900">
                    {reply.author.name}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(reply.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-xs text-gray-700">{reply.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface RequestReviewFormProps {
  onSubmit: (reviewers: string[], description?: string, dueDate?: Date) => void;
  onCancel: () => void;
}

const RequestReviewForm: React.FC<RequestReviewFormProps> = ({
  onSubmit,
  onCancel,
}) => {
  const [selectedReviewers, setSelectedReviewers] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');

  // Mock available reviewers - in real app, this would come from props or API
  const availableReviewers = [
    { id: 'reviewer1', name: 'Alice Johnson', email: 'alice@example.com' },
    { id: 'reviewer2', name: 'Bob Smith', email: 'bob@example.com' },
    { id: 'reviewer3', name: 'Carol Davis', email: 'carol@example.com' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedReviewers.length === 0) return;

    onSubmit(
      selectedReviewers,
      description || undefined,
      dueDate ? new Date(dueDate) : undefined
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Request Review</h3>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Reviewers *
            </label>
            <div className="space-y-2">
              {availableReviewers.map((reviewer) => (
                <label key={reviewer.id} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedReviewers.includes(reviewer.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedReviewers([...selectedReviewers, reviewer.id]);
                      } else {
                        setSelectedReviewers(selectedReviewers.filter(id => id !== reviewer.id));
                      }
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-900">{reviewer.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide context or specific areas to focus on..."
              className="w-full p-2 border border-gray-300 rounded-md resize-none"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Due Date (optional)
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={selectedReviewers.length === 0}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Request Review
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface SubmitReviewFormProps {
  reviewRequest: ReviewRequest;
  currentUser: CollaborationUser;
  onSubmit: (decision: ReviewDecision) => void;
  onCancel: () => void;
}

const SubmitReviewForm: React.FC<SubmitReviewFormProps> = ({
  reviewRequest,
  currentUser,
  onSubmit,
  onCancel,
}) => {
  const [action, setAction] = useState<ReviewDecision['action']>('approve');
  const [summary, setSummary] = useState('');
  const [comments, setComments] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.trim()) return;

    onSubmit({
      action,
      summary: summary.trim(),
      comments: comments.trim(),
      createdAt: new Date(),
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Submit Review</h3>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Decision *
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="action"
                  value="approve"
                  checked={action === 'approve'}
                  onChange={(e) => setAction(e.target.value as ReviewDecision['action'])}
                  className="text-green-600 focus:ring-green-500"
                />
                <CheckCircleIcon className="ml-2 h-4 w-4 text-green-500" />
                <span className="ml-1 text-sm text-gray-900">Approve</span>
              </label>
              
              <label className="flex items-center">
                <input
                  type="radio"
                  name="action"
                  value="request_changes"
                  checked={action === 'request_changes'}
                  onChange={(e) => setAction(e.target.value as ReviewDecision['action'])}
                  className="text-yellow-600 focus:ring-yellow-500"
                />
                <ExclamationTriangleIcon className="ml-2 h-4 w-4 text-yellow-500" />
                <span className="ml-1 text-sm text-gray-900">Request Changes</span>
              </label>
              
              <label className="flex items-center">
                <input
                  type="radio"
                  name="action"
                  value="reject"
                  checked={action === 'reject'}
                  onChange={(e) => setAction(e.target.value as ReviewDecision['action'])}
                  className="text-red-600 focus:ring-red-500"
                />
                <XCircleIcon className="ml-2 h-4 w-4 text-red-500" />
                <span className="ml-1 text-sm text-gray-900">Reject</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Summary *
            </label>
            <input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Brief summary of your review..."
              className="w-full p-2 border border-gray-300 rounded-md"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Comments (optional)
            </label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Detailed feedback and suggestions..."
              className="w-full p-2 border border-gray-300 rounded-md resize-none"
              rows={4}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!summary.trim()}
              className={cn(
                'px-4 py-2 text-sm text-white rounded disabled:opacity-50 disabled:cursor-not-allowed',
                action === 'approve' && 'bg-green-600 hover:bg-green-700',
                action === 'request_changes' && 'bg-yellow-600 hover:bg-yellow-700',
                action === 'reject' && 'bg-red-600 hover:bg-red-700'
              )}
            >
              Submit Review
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

function getAssignmentStatusColor(status: ReviewAssignment['status']): string {
  switch (status) {
    case 'approved':
      return 'text-green-600 bg-green-50';
    case 'rejected':
      return 'text-red-600 bg-red-50';
    case 'changes_requested':
      return 'text-yellow-600 bg-yellow-50';
    case 'in_progress':
      return 'text-blue-600 bg-blue-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
}