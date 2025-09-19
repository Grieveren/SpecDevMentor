import React, { useState, useEffect, useCallback } from 'react';
import { 
  DocumentTextIcon, 
  EyeIcon, 
  PencilIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { SpecificationPhase, DocumentStatus } from '../../types/project';
import { cn } from '../../utils/cn';

export interface SpecificationDocument {
  id: string;
  phase: SpecificationPhase;
  content: string;
  status: DocumentStatus;
  version: number;
  updatedAt: string;
}

interface ToolbarItem {
  label: string;
  action: () => void;
  shortcut?: string;
}

export interface SpecificationEditorProps {
  document: SpecificationDocument;
  mode: 'edit' | 'review' | 'readonly';
  onSave: (content: string) => Promise<void>;
  onRequestReview?: () => Promise<void>;
  collaborationEnabled?: boolean;
  className?: string;
}

export const SpecificationEditor: React.FC<SpecificationEditorProps> = ({
  document: specDocument,
  mode,
  onSave,
  onRequestReview,
  collaborationEnabled = false,
  className,
}) => {
  const [content, setContent] = useState(specDocument.content);
  const [isEditing, setIsEditing] = useState(mode === 'edit');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Auto-save functionality
  useEffect(() => {
    if (!hasUnsavedChanges || mode === 'readonly') return;

    const timer = setTimeout(async () => {
      if (content !== specDocument.content) {
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
  }, [content, specDocument.content, hasUnsavedChanges, mode, onSave]);

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent);
    setHasUnsavedChanges(newContent !== specDocument.content);
  }, [specDocument.content]);

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

  const getPhaseToolbarItems = (phase: SpecificationPhase): ToolbarItem[] => {
    const baseItems: ToolbarItem[] = [
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
    const textarea = (document.querySelector('textarea') as HTMLTextAreaElement) || null;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    const newContent = content.substring(0, start) + before + selectedText + after + content.substring(end);
    
    handleContentChange(newContent);
    
    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  };

  const insertTemplate = (template: string) => {
    const textarea = (document.querySelector('textarea') as HTMLTextAreaElement) || null;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const newContent = content.substring(0, start) + template + content.substring(start);
    
    handleContentChange(newContent);
    
    // Position cursor at end of inserted template
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + template.length, start + template.length);
    }, 0);
  };

  return (
    <div className={cn('flex flex-col h-full bg-white border border-gray-200 rounded-lg shadow-sm', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <DocumentTextIcon className="h-6 w-6 text-gray-400" />
          <div>
            <h2 className="text-lg font-medium text-gray-900">{getPhaseTitle(specDocument.phase)}</h2>
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              {getStatusIcon(specDocument.status)}
              <span className="capitalize">{specDocument.status.toLowerCase()}</span>
              <span>•</span>
              <span>Version {specDocument.version}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
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
              {hasUnsavedChanges && (
                <button
                  onClick={handleManualSave}
                  disabled={isSaving}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  Save Now
                </button>
              )}
              
              {onRequestReview && specDocument.status === DocumentStatus.DRAFT && (
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
          {getPhaseToolbarItems(specDocument.phase).map((item, index) => (
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
      <div className="flex-1 flex">
        {isEditing ? (
          <textarea
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder={`Enter your ${specDocument.phase.toLowerCase()} content here...`}
            className="flex-1 p-4 border-none resize-none focus:outline-none font-mono text-sm leading-relaxed"
            style={{ minHeight: '400px' }}
          />
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
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between p-2 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
        <div>
          Last updated: {new Date(specDocument.updatedAt).toLocaleString()}
        </div>
        <div className="flex items-center space-x-4">
          {collaborationEnabled && (
            <span className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span>Live collaboration enabled</span>
            </span>
          )}
          <span>{content.length} characters</span>
          <span>{content.split('\n').length} lines</span>
        </div>
      </div>
    </div>
  );
};