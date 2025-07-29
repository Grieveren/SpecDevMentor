import React from 'react';
import { CursorPosition, CollaborationUser } from '../../hooks/useCollaboration';
import { cn } from '../../utils/cn';

interface CollaborativeCursorsProps {
  cursors: Record<string, CursorPosition>;
  users: Record<string, CollaborationUser>;
  editorRef?: React.RefObject<HTMLElement>;
  className?: string;
}

export const CollaborativeCursors: React.FC<CollaborativeCursorsProps> = ({
  cursors,
  users,
  editorRef,
  className,
}) => {
  // Convert line/character positions to pixel coordinates
  const getPixelPosition = (position: CursorPosition): { x: number; y: number } | null => {
    if (!editorRef?.current) return null;

    try {
      // This is a simplified implementation
      // In a real editor, you'd need to calculate based on line height, character width, etc.
      const lineHeight = 24; // Approximate line height in pixels
      const charWidth = 8; // Approximate character width in pixels
      
      const rect = editorRef.current.getBoundingClientRect();
      const x = rect.left + (position.character * charWidth);
      const y = rect.top + (position.line * lineHeight);

      return { x, y };
    } catch (error) {
      // // // console.warn('Failed to calculate cursor position:', error);
      return null;
    }
  };

  return (
    <div className={cn('pointer-events-none fixed inset-0 z-50', className)}>
      {Object.entries(cursors).map(([userId, position]) => {
        const _user = users[userId];
        if (!user) return null;

        const pixelPos = getPixelPosition(position);
        if (!pixelPos) return null;

        return (
          <RemoteCursor
            key={userId}
            user={user}
            position={pixelPos}
            isActive={Date.now() - position.timestamp.getTime() < 5000} // Show for 5 seconds
          />
        );
      })}
    </div>
  );
};

interface RemoteCursorProps {
  user: CollaborationUser;
  position: { x: number; y: number };
  isActive: boolean;
}

const RemoteCursor: React.FC<RemoteCursorProps> = ({ user, position, isActive }) => {
  if (!isActive) return null;

  return (
    <div
      className="absolute transition-all duration-100 ease-out"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translateX(-1px)',
      }}
    >
      {/* Cursor line */}
      <div
        className="w-0.5 h-6 animate-pulse"
        style={{ backgroundColor: user.color }}
      />
      
      {/* User label */}
      <div
        className="absolute -top-8 left-0 px-2 py-1 text-xs text-white rounded-md whitespace-nowrap shadow-lg transform -translate-y-1"
        style={{ backgroundColor: user.color }}
      >
        {user.name}
        <div
          className="absolute top-full left-2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent"
          style={{ borderTopColor: user.color }}
        />
      </div>
    </div>
  );
};

interface TextSelectionProps {
  userId: string;
  user: CollaborationUser;
  startLine: number;
  startChar: number;
  endLine: number;
  endChar: number;
  editorRef?: React.RefObject<HTMLElement>;
}

export const TextSelection: React.FC<TextSelectionProps> = ({
  user,
  startLine,
  startChar,
  endLine,
  endChar,
  editorRef,
}) => {
  const getSelectionRects = (): Array<{ x: number; y: number; width: number; height: number }> => {
    if (!editorRef?.current) return [];

    try {
      const lineHeight = 24;
      const charWidth = 8;
      const rect = editorRef.current.getBoundingClientRect();

      const rects: Array<{ x: number; y: number; width: number; height: number }> = [];

      if (startLine === endLine) {
        // Single line selection
        rects.push({
          x: rect.left + (startChar * charWidth),
          y: rect.top + (startLine * lineHeight),
          width: (endChar - startChar) * charWidth,
          height: lineHeight,
        });
      } else {
        // Multi-line selection
        for (let line = startLine; line <= endLine; line++) {
          const isFirstLine = line === startLine;
          const isLastLine = line === endLine;
          
          const startX = isFirstLine ? startChar * charWidth : 0;
          const endX = isLastLine ? endChar * charWidth : rect.width;
          
          rects.push({
            x: rect.left + startX,
            y: rect.top + (line * lineHeight),
            width: endX - startX,
            height: lineHeight,
          });
        }
      }

      return rects;
    } catch (error) {
      // // // console.warn('Failed to calculate selection rects:', error);
      return [];
    }
  };

  const selectionRects = getSelectionRects();

  return (
    <div className="pointer-events-none fixed inset-0 z-40">
      {selectionRects.map((rect, index) => (
        <div
          key={index}
          className="absolute opacity-20 transition-all duration-100"
          style={{
            left: rect.x,
            top: rect.y,
            width: rect.width,
            height: rect.height,
            backgroundColor: user.color,
          }}
        />
      ))}
    </div>
  );
};

// Hook for managing cursor tracking in text areas/editors
export const useCursorTracking = (
  textareaRef: React.RefObject<HTMLTextAreaElement>,
  onCursorMove: (position: { line: number; character: number }) => void
) => {
  const handleSelectionChange = React.useCallback(() => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const selectionStart = textarea.selectionStart;
    const content = textarea.value;

    // Calculate line and character position
    const lines = content.substring(0, selectionStart).split('\n');
    const line = lines.length - 1;
    const character = lines[lines.length - 1].length;

    onCursorMove({ line, character });
  }, [textareaRef, onCursorMove]);

  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Track cursor/selection changes
    textarea.addEventListener('selectionchange', handleSelectionChange);
    textarea.addEventListener('keyup', handleSelectionChange);
    textarea.addEventListener('mouseup', handleSelectionChange);
    textarea.addEventListener('focus', handleSelectionChange);

    return () => {
      textarea.removeEventListener('selectionchange', handleSelectionChange);
      textarea.removeEventListener('keyup', handleSelectionChange);
      textarea.removeEventListener('mouseup', handleSelectionChange);
      textarea.removeEventListener('focus', handleSelectionChange);
    };
  }, [handleSelectionChange]);

  return { handleSelectionChange };
};