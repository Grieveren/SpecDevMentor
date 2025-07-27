import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  DocumentTextIcon, 
  EyeIcon, 
  PencilIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  UsersIcon
} from '@heroicons/react/24/outline';
import { SpecificationPhase, DocumentStatus } from '../../types/project';
import { cn } from '../../utils/cn';
import { 
  useCollaboration, 
  ClientOperationalTransform,
  DocumentChange,
  CollaborationUser 
} from '../../hooks/useCollaboration';
import { CollaborationIndicator, CollaborationStatus } from './CollaborationIndicator';
import { CollaborativeCursors, useCursorTracking } from './CollaborativeCursors';
import { 
  CollaborativeComments, 
  CommentThread, 
  Comment, 
  Reaction 
} from './CollaborativeComments';

export interface SpecificationDocument {
  id: string;
  phase: SpecificationPhase;
  content: string;
  status: DocumentStatus;
  version: number;
  updatedAt: string;
}

export interface CollaborativeSpecificationEditorProps {
  document: SpecificationDocument;
  mode: 'edit' | 'review' | 'readonly';
  onSave: (content: string) => Promise<void>;
  onRequestReview?: () => Promise<void>;
  collaborationEnabled?: boolean;
  authToken: string;
  className?: string;
}

export const CollaborativeSpecificationEditor: React.FC<CollaborativeSpecificationEditorProps> = ({
  document,
  mode,
  onSave,
  onRequestReview,
  collaborationEnabled = false,
  authToken,
  className,
}) => {
  const [content, setContent] = useState(document.content);
  const [isEditing, setIsEditing] = useState(mode === 'edit');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentThreads, setCommentThreads] = useState<CommentThread[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  // Collaboration hook
  const collaboration = useCollaboration({
    documentId: document.id,
    token: authToken,
    onDocumentChange: handleRemoteDocumentChange,
    onContentUpdate: handleRemoteContentUpdate,
    onError: (error) => console.error('Collaboration error:', error),
  });

  // Cursor tracking
  useCursorTracking(textareaRef, collaboration.sendCursorPosition);

  // Handle remote document changes
  function handleRemoteDocumentChange(change: DocumentChange) {
    setContent(prevContent => {
      const newContent = ClientOperationalTransform.apply(prevContent, change);
      return newContent;
    });
  }

  // Handle remote content updates (initial sync)
  function handleRemoteContentUpdate(newContent: string) {
    setContent(newContent);
    setHasUnsavedChanges(false);
  }

  // Auto-save functionality
  useEffect(() => {
    if (!hasUnsavedChanges || mode === 'readonly') return;

    const timer = setTimeout(async () => {
      if (content !== document.content) {
        setIsSaving(true);
        try {
          await onSave(content);
          setLastSaved(new Date());
          setHasUnsavedChanges(false);
        } catch (error) {
          console.error('Auto-save failed:', error);
        } finally {
          setIsSaving(false);
        }
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [content, document.content, hasUnsavedChanges, mode, onSave]);

  const handleContentChange = useCallback((newContent: string, changeInfo?: {
    type: 'insert' | 'delete';
    position: number;
    content?: string;
    length?: number;
  }) => {
    setContent(newContent);
    setHasUnsavedChanges(newContent !== document.content);

    // Send change to collaboration service
    if (collaborationEnabled && collaboration.isConnected && changeInfo) {
      const operation = changeInfo.type === 'insert' 
        ? ClientOperationalTransform.createInsertOperation(
            changeInfo.position, 
            changeInfo.content || '', 
            document.id
          )
        : ClientOperationalTransform.createDeleteOperation(
            changeInfo.position, 
            changeInfo.length || 0, 
            document.id
          );

      collaboration.sendDocumentChange(operation);
    }
  }, [document.content, document.id, collaborationEnabled, collaboration]);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    const oldContent = content;
    
    // Calculate the change for operational transformation
    let changeInfo: {
      type: 'insert' | 'delete';
      position: number;
      content?: string;
      length?: number;
    } | undefined;

    if (newContent.length > oldContent.length) {
      // Insert operation
      const position = findChangePosition(oldContent, newContent);
      const insertedText = newContent.substring(position, position + (newContent.length - oldContent.length));
      changeInfo = {
        type: 'insert',
        position,
        content: insertedText,
      };
    } else if (newContent.length < oldContent.length) {
      // Delete operation
      const position = findChangePosition(oldContent, newContent);
      const deletedLength = oldContent.length - newContent.length;
      changeInfo = {
        type: 'delete',
        position,
        length: deletedLength,
      };
    }

    handleContentChange(newContent, changeInfo);
  };

  // Helper function to find where the change occurred
  const findChangePosition = (oldText: string, newText: string): number => {
    let i = 0;
    while (i < Math.min(oldText.length, newText.length) && oldText[i] === newText[i]) {
      i++;
    }
    return i;
  };

  const handleManualSave = async () => {
    if (!hasUnsavedChanges) return;

    setIsSaving(true);
    try {
      await onSave(content);
      setLastSaved(new Date());
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Manual save failed:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleEditMode = () => {
    if (mode === 'readonly') return;
    setIsEditing(!isEditing);
  };

  // Comment handlers
  const handleAddComment = (threadId: string, content: string) => {
    // This would typically make an API call
    console.log('Add comment to thread:', threadId, content);
  };

  const handleCreateThread = (position: { line: number; character: number }, content: string) => {
    // This would typically make an API call
    console.log('Create comment thread at:', position, content);
  };

  const handleResolveThread = (threadId: string) => {
    setCommentThreads(prev => 
      prev.map(thread => 
        thread.id === threadId 
          ? { ...thread, status: 'resolved' as const, resolvedAt: new Date() }
          : thread
      )
    );
  };

  const handleReopenThread = (threadId: string) => {
    setCommentThreads(prev => 
      prev.map(thread => 
        thread.id === threadId 
          ? { ...thread, status: 'open' as const, resolvedAt: undefined }
          : thread
      )
    );
  };

  const handleAddReaction = (commentId: string, type: Reaction['type']) => {
    console.log('Add reaction:', commentId, type);
  };

  const handleRemoveReaction = (commentId: string, type: Reaction['type']) => {
    console.log('Remove reaction:', commentId, type);
  };

  const getPhaseTitle = (phase: SpecificationPhase): string => {
    switch (phase) {
      case SpecificationPhase.REQUIREMENTS:
        return 'Requirements Document';
      case SpecificationPhase.DESIGN:
        return 'Design Document';
      case SpecificationPhase.TASKS:
        return 'Implementation Tasks';
      case SpecificationPhase.IMPLEMENTATION:
        return 'Implementation Notes';
      default:
        return 'Document';
    }
  };

  const getStatusIcon = (status: DocumentStatus) => {
    switch (status) {
      case DocumentStatus.DRAFT:
        return <PencilIcon className="h-4 w-4 text-gray-500" />;
      case DocumentStatus.REVIEW:
        return <EyeIcon className="h-4 w-4 text-yellow-500" />;
      case DocumentStatus.APPROVED:
        return <CheckCircleIcon className="h-4 w-4 text-green-500" />;
      case DocumentStatus.ARCHIVED:
        return <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />;
      default:
        return <DocumentTextIcon className="h-4 w-4 text-gray-500" />;
    }
  };

  const getPhaseToolbarItems = (phase: SpecificationPhase) => {
    const baseItems = [
      { label: 'Bold', shortcut: 'Ctrl+B', action: () => insertMarkdown('**', '**') },
      { label: 'Italic', shortcut: 'Ctrl+I', action: () => insertMarkdown('*', '*') },
      { label: 'Code', shortcut: 'Ctrl+`', action: () => insertMarkdown('`', '`') },
    ];

    switch (phase) {
      case SpecificationPhase.REQUIREMENTS:
        return [
          ...baseItems,
          { label: 'User Story', action: () => insertTemplate('**User Story:** As a [role], I want [feature], so that [benefit]') },
          { label: 'EARS Format', action: () => insertTemplate('WHEN [event] THEN [system] SHALL [response]') },
          { label: 'Requirement', action: () => insertTemplate('### Requirement [number]\n\n**User Story:** \n\n#### Acceptance Criteria\n\n1. ') },
        ];
      case SpecificationPhase.DESIGN:
        return [
          ...baseItems,
          { label: 'Architecture', action: () => insertTemplate('## Architecture\n\n') },
          { label: 'Component', action: () => insertTemplate('### [Component Name]\n\n**Purpose:** \n\n**Interfaces:** \n\n') },
          { label: 'Mermaid Diagram', action: () => insertTemplate('```mermaid\ngraph TD\n    A[Start] --> B[End]\n```') },
        ];
      case SpecificationPhase.TASKS:
        return [
          ...baseItems,
          { label: 'Task', action: () => insertTemplate('- [ ] [Task description]') },
          { label: 'Subtask', action: () => insertTemplate('  - [ ] [Subtask description]') },
          { label: 'Requirements Ref', action: () => insertTemplate('_Requirements: [1.1, 1.2]_') },
        ];
      default:
        return baseItems;
    }
  };

  const insertMarkdown = (before: string, after: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    const newContent = content.substring(0, start) + before + selectedText + after + content.substring(end);
    
    handleContentChange(newContent, {
      type: 'insert',
      position: start,
      content: before + selectedText + after,
    });
    
    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  };

  const insertTemplate = (template: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const newContent = content.substring(0, start) + template + content.substring(start);
    
    handleContentChange(newContent, {
      type: 'insert',
      position: start,
      content: template,
    });
    
    // Position cursor at end of inserted template
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + template.length, start + template.length);
    }, 0);
  };

  // Create user lookup for cursors
  const userLookup = React.useMemo(() => {
    const lookup: Record<string, CollaborationUser> = {};
    collaboration.collaborators.forEach(user => {
      lookup[user.id] = user;
    });
    if (collaboration.currentUser) {
      lookup[collaboration.currentUser.id] = collaboration.currentUser;
    }
    return lookup;
  }, [collaboration.collaborators, collaboration.currentUser]);

  return (
    <div className={cn('flex flex-col h-full bg-white border border-gray-200 rounded-lg shadow-sm', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <DocumentTextIcon className="h-6 w-6 text-gray-400" />
          <div>
            <h2 className="text-lg font-medium text-gray-900">{getPhaseTitle(document.phase)}</h2>
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              {getStatusIcon(document.status)}
              <span className="capitalize">{document.status.toLowerCase()}</span>
              <span>•</span>
              <span>Version {document.version}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {/* Collaboration status and users */}
          {collaborationEnabled && (
            <div className="flex items-center space-x-4">
              <CollaborationStatus
                isConnected={collaboration.isConnected}
                isJoining={collaboration.isJoining}
                error={collaboration.error}
                onRetry={collaboration.retry}
              />
              <CollaborationIndicator
                collaborators={collaboration.collaborators}
                currentUser={collaboration.currentUser}
              />
            </div>
          )}

          {/* Save status */}
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            {isSaving && (
              <>
                <ClockIcon className="h-4 w-4 animate-spin" />
                <span>Saving...</span>
              </>
            )}
            {lastSaved && !isSaving && (
              <>
                <CheckCircleIcon className="h-4 w-4 text-green-500" />
                <span>Saved {lastSaved.toLocaleTimeString()}</span>
              </>
            )}
            {hasUnsavedChanges && !isSaving && (
              <>
                <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500" />
                <span>Unsaved changes</span>
              </>
            )}
          </div>

          {/* Action buttons */}
          {mode !== 'readonly' && (
            <div className="flex space-x-2">
              <button
                onClick={() => setShowComments(!showComments)}
                className={cn(
                  'px-3 py-1 text-sm rounded border flex items-center space-x-1',
                  showComments
                    ? 'bg-blue-100 text-blue-700 border-blue-300'
                    : 'bg-gray-100 text-gray-700 border-gray-300'
                )}
              >
                <UsersIcon className="h-4 w-4" />
                <span>Comments</span>
              </button>

              {hasUnsavedChanges && (
                <button
                  onClick={handleManualSave}
                  disabled={isSaving}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  Save Now
                </button>
              )}
              
              {onRequestReview && document.status === DocumentStatus.DRAFT && (
                <button
                  onClick={onRequestReview}
                  className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Request Review
                </button>
              )}

              <button
                onClick={toggleEditMode}
                className={cn(
                  'px-3 py-1 text-sm rounded border',
                  isEditing
                    ? 'bg-gray-100 text-gray-700 border-gray-300'
                    : 'bg-blue-100 text-blue-700 border-blue-300'
                )}
              >
                {isEditing ? 'Preview' : 'Edit'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Toolbar */}
      {isEditing && mode !== 'readonly' && (
        <div className="flex items-center space-x-1 p-2 border-b border-gray-200 bg-gray-50">
          {getPhaseToolbarItems(document.phase).map((item, index) => (
            <button
              key={index}
              onClick={item.action}
              title={item.shortcut || item.label}
              className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* Editor Content */}
      <div className="flex-1 flex relative" ref={editorRef}>
        {isEditing ? (
          <>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleTextareaChange}
              placeholder={`Enter your ${document.phase.toLowerCase()} content here...`}
              className="flex-1 p-4 border-none resize-none focus:outline-none font-mono text-sm leading-relaxed"
              style={{ minHeight: '400px' }}
            />
            
            {/* Collaborative cursors */}
            {collaborationEnabled && (
              <CollaborativeCursors
                cursors={collaboration.cursors}
                users={userLookup}
                editorRef={textareaRef}
              />
            )}
          </>
        ) : (
          <div className="flex-1 p-4 overflow-auto">
            <div className="prose prose-sm max-w-none">
              {content ? (
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-900">
                  {content}
                </pre>
              ) : (
                <div className="text-gray-500 italic">
                  No content yet. Click "Edit" to start writing.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Comments panel */}
        {showComments && (
          <CollaborativeComments
            threads={commentThreads}
            currentUser={collaboration.currentUser}
            onAddComment={handleAddComment}
            onCreateThread={handleCreateThread}
            onResolveThread={handleResolveThread}
            onReopenThread={handleReopenThread}
            onAddReaction={handleAddReaction}
            onRemoveReaction={handleRemoveReaction}
            editorRef={editorRef}
          />
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between p-2 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
        <div>
          Last updated: {new Date(document.updatedAt).toLocaleString()}
        </div>
        <div className="flex items-center space-x-4">
          {collaborationEnabled && collaboration.isConnected && (
            <span className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span>Live collaboration active</span>
            </span>
          )}
          <span>{content.length} characters</span>
          <span>{content.split('\n').length} lines</span>
        </div>
      </div>
    </div>
  );
};