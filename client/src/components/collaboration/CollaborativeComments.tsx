// @ts-nocheck
import React, { useState, useRef, useEffect } from 'react';
import { ChatBubbleLeftIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';
import { CollaborationUser } from '../../hooks/useCollaboration';
import { UserAvatar } from './CollaborationIndicator';
import { cn } from '../../utils/cn';

export interface CommentThread {
  id: string;
  documentId: string;
  position: { line: number; character: number };
  comments: Comment[];
  status: 'open' | 'resolved';
  createdAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export interface Comment {
  id: string;
  threadId: string;
  author: CollaborationUser;
  content: string;
  createdAt: Date;
  editedAt?: Date;
  reactions: Reaction[];
}

export interface Reaction {
  id: string;
  type: 'like' | 'dislike' | 'helpful' | 'confused';
  user: CollaborationUser;
  createdAt: Date;
}

interface CollaborativeCommentsProps {
  threads: CommentThread[];
  currentUser?: CollaborationUser;
  onAddComment: (threadId: string, content: string) => void;
  onCreateThread: (position: { line: number; character: number }, content: string) => void;
  onResolveThread: (threadId: string) => void;
  onReopenThread: (threadId: string) => void;
  onAddReaction: (commentId: string, type: Reaction['type']) => void;
  onRemoveReaction: (commentId: string, type: Reaction['type']) => void;
  editorRef?: React.RefObject<HTMLElement>;
  className?: string;
}

export const CollaborativeComments: React.FC<CollaborativeCommentsProps> = ({
  threads,
  currentUser,
  onAddComment,
  onCreateThread,
  onResolveThread,
  onReopenThread,
  onAddReaction,
  onRemoveReaction,
  editorRef,
  className,
}) => {
  const [selectedPosition, setSelectedPosition] = useState<{ line: number; character: number } | null>(null);
  const [isCreatingComment, setIsCreatingComment] = useState(false);

  const handleCreateComment = (position: { line: number; character: number }) => {
    setSelectedPosition(position);
    setIsCreatingComment(true);
  };

  const handleCancelCreate = () => {
    setSelectedPosition(null);
    setIsCreatingComment(false);
  };

  const handleSubmitNewThread = (content: string) => {
    if (selectedPosition) {
      onCreateThread(selectedPosition, content);
      handleCancelCreate();
    }
  };

  return (
    <div className={cn('relative', className)}>
      {/* Comment threads positioned relative to editor */}
      {threads.map(thread => (
        <CommentThreadComponent
          key={thread.id}
          thread={thread}
          currentUser={currentUser}
          onAddComment={onAddComment}
          onResolve={onResolveThread}
          onReopen={onReopenThread}
          onAddReaction={onAddReaction}
          onRemoveReaction={onRemoveReaction}
          editorRef={editorRef}
        />
      ))}

      {/* New comment creation */}
      {isCreatingComment && selectedPosition && (
        <NewCommentForm
          position={selectedPosition}
          currentUser={currentUser}
          onSubmit={handleSubmitNewThread}
          onCancel={handleCancelCreate}
          editorRef={editorRef}
        />
      )}

      {/* Comment creation trigger (could be integrated with text selection) */}
      <CommentCreationTrigger onCreateComment={handleCreateComment} />
    </div>
  );
};

interface CommentThreadComponentProps {
  thread: CommentThread;
  currentUser?: CollaborationUser;
  onAddComment: (threadId: string, content: string) => void;
  onResolve: (threadId: string) => void;
  onReopen: (threadId: string) => void;
  onAddReaction: (commentId: string, type: Reaction['type']) => void;
  onRemoveReaction: (commentId: string, type: Reaction['type']) => void;
  editorRef?: React.RefObject<HTMLElement>;
}

const CommentThreadComponent: React.FC<CommentThreadComponentProps> = ({
  thread,
  currentUser,
  onAddComment,
  onResolve,
  onReopen,
  onAddReaction,
  onRemoveReaction,
  editorRef,
}) => {
  const [isReplying, setIsReplying] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const getPixelPosition = (): { x: number; y: number } | null => {
    if (!editorRef?.current) return null;

    try {
      const lineHeight = 24;
      const rect = editorRef.current.getBoundingClientRect();
      
      return {
        x: rect.right + 10, // Position to the right of the editor
        y: rect.top + (thread.position.line * lineHeight),
      };
    } catch (error) {
      return null;
    }
  };

  const pixelPosition = getPixelPosition();
  if (!pixelPosition) return null;

  const canModerate = currentUser?.id === thread.comments[0]?.author.id || 
                     currentUser?.id === 'admin'; // Add proper role checking

  return (
    <div
      className="absolute z-30 w-80"
      style={{
        left: pixelPosition.x,
        top: pixelPosition.y,
      }}
    >
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg">
        {/* Thread header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-100">
          <div className="flex items-center space-x-2">
            <ChatBubbleLeftIcon className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium">
              {thread.comments.length} comment{thread.comments.length !== 1 ? 's' : ''}
            </span>
            <div
              className={cn(
                'px-2 py-1 text-xs rounded-full',
                thread.status === 'open'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-green-100 text-green-800'
              )}
            >
              {thread.status}
            </div>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
            >
              {isExpanded ? '−' : '+'}
            </button>
            {canModerate && (
              <button
                onClick={() => thread.status === 'open' ? onResolve(thread.id) : onReopen(thread.id)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                {thread.status === 'open' ? <CheckIcon className="w-4 h-4" /> : <XMarkIcon className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>

        {/* Comments */}
        {isExpanded && (
          <div className="max-h-96 overflow-y-auto">
            <div className="p-3 space-y-3">
              {thread.comments.map(comment => (
                <CommentComponent
                  key={comment.id}
                  comment={comment}
                  currentUser={currentUser}
                  onAddReaction={onAddReaction}
                  onRemoveReaction={onRemoveReaction}
                />
              ))}
            </div>

            {/* Reply form */}
            {thread.status === 'open' && (
              <div className="border-t border-gray-100 p-3">
                {isReplying ? (
                  <CommentForm
                    onSubmit={(content) => {
                      onAddComment(thread.id, content);
                      setIsReplying(false);
                    }}
                    onCancel={() => setIsReplying(false)}
                    placeholder="Write a reply..."
                    currentUser={currentUser}
                  />
                ) : (
                  <button
                    onClick={() => setIsReplying(true)}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Reply
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

interface CommentComponentProps {
  comment: Comment;
  currentUser?: CollaborationUser;
  onAddReaction: (commentId: string, type: Reaction['type']) => void;
  onRemoveReaction: (commentId: string, type: Reaction['type']) => void;
}

const CommentComponent: React.FC<CommentComponentProps> = ({
  comment,
  currentUser,
  onAddReaction,
  onRemoveReaction,
}) => {
  const reactionCounts = comment.reactions.reduce((acc, reaction) => {
    acc[reaction.type] = (acc[reaction.type] || 0) + 1;
    return acc;
  }, {} as Record<Reaction['type'], number>);

  const userReactions = comment.reactions
    .filter(r => r.user.id === currentUser?.id)
    .map(r => r.type);

  const handleReactionToggle = (type: Reaction['type']) => {
    if (userReactions.includes(type)) {
      onRemoveReaction(comment.id, type);
    } else {
      onAddReaction(comment.id, type);
    }
  };

  return (
    <div className="flex space-x-2">
      <UserAvatar user={comment.author} size="sm" />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2 mb-1">
          <span className="text-sm font-medium text-gray-900">
            {comment.author.name}
          </span>
          <span className="text-xs text-gray-500">
            {new Date(comment.createdAt).toLocaleTimeString()}
          </span>
          {comment.editedAt && (
            <span className="text-xs text-gray-400">(edited)</span>
          )}
        </div>
        
        <div className="text-sm text-gray-700 mb-2">
          {comment.content}
        </div>

        {/* Reactions */}
        <div className="flex items-center space-x-1">
          {(['like', 'helpful', 'confused'] as const).map(type => (
            <button
              key={type}
              onClick={() => handleReactionToggle(type)}
              className={cn(
                'px-2 py-1 text-xs rounded-full border transition-colors',
                userReactions.includes(type)
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
              )}
            >
              {getReactionEmoji(type)} {reactionCounts[type] || 0}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

interface NewCommentFormProps {
  position: { line: number; character: number };
  currentUser?: CollaborationUser;
  onSubmit: (content: string) => void;
  onCancel: () => void;
  editorRef?: React.RefObject<HTMLElement>;
}

const NewCommentForm: React.FC<NewCommentFormProps> = ({
  position,
  currentUser,
  onSubmit,
  onCancel,
  editorRef,
}) => {
  const getPixelPosition = (): { x: number; y: number } | null => {
    if (!editorRef?.current) return null;

    try {
      const lineHeight = 24;
      const rect = editorRef.current.getBoundingClientRect();
      
      return {
        x: rect.right + 10,
        y: rect.top + (position.line * lineHeight),
      };
    } catch (error) {
      return null;
    }
  };

  const pixelPosition = getPixelPosition();
  if (!pixelPosition) return null;

  return (
    <div
      className="absolute z-40 w-80"
      style={{
        left: pixelPosition.x,
        top: pixelPosition.y,
      }}
    >
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
        <div className="flex items-center space-x-2 mb-3">
          <ChatBubbleLeftIcon className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium">New comment</span>
        </div>
        
        <CommentForm
          onSubmit={onSubmit}
          onCancel={onCancel}
          placeholder="Add a comment..."
          currentUser={currentUser}
        />
      </div>
    </div>
  );
};

interface CommentFormProps {
  onSubmit: (content: string) => void;
  onCancel: () => void;
  placeholder: string;
  currentUser?: CollaborationUser;
}

const CommentForm: React.FC<CommentFormProps> = ({
  onSubmit,
  onCancel,
  placeholder,
  currentUser,
}) => {
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (content.trim()) {
      onSubmit(content.trim());
      setContent('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit(e);
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex items-start space-x-2">
        {currentUser && <UserAvatar user={currentUser} size="sm" />}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 p-2 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={3}
        />
      </div>
      
      <div className="flex justify-end space-x-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!content.trim()}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Comment
        </button>
      </div>
      
      <div className="text-xs text-gray-500">
        Press Cmd+Enter to submit, Esc to cancel
      </div>
    </form>
  );
};

interface CommentCreationTriggerProps {
  onCreateComment: (position: { line: number; character: number }) => void;
}

const CommentCreationTrigger: React.FC<CommentCreationTriggerProps> = ({
  onCreateComment,
}) => {
  // This would typically be integrated with text selection in the editor
  // For now, it's a simple floating button
  return (
    <button
      onClick={() => onCreateComment({ line: 0, character: 0 })}
      className="fixed bottom-4 right-4 p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors"
      title="Add comment"
    >
      <ChatBubbleLeftIcon className="w-5 h-5" />
    </button>
  );
};

const getReactionEmoji = (type: Reaction['type']): string => {
  switch (type) {
    case 'like': return '👍';
    case 'dislike': return '👎';
    case 'helpful': return '💡';
    case 'confused': return '❓';
    default: return '👍';
  }
};