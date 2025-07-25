import React from 'react';
import { cn } from '../../utils/cn';

export interface DiffVisualizationProps {
  originalText: string;
  suggestedText: string;
  className?: string;
}

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  lineNumber?: number;
}

export const DiffVisualization: React.FC<DiffVisualizationProps> = ({
  originalText,
  suggestedText,
  className,
}) => {
  // Simple diff algorithm - in a real implementation, you might want to use a more sophisticated diff library
  const generateDiff = (original: string, suggested: string): DiffLine[] => {
    const originalLines = original.split('\n');
    const suggestedLines = suggested.split('\n');
    const diff: DiffLine[] = [];

    // Simple line-by-line comparison
    const maxLines = Math.max(originalLines.length, suggestedLines.length);
    
    for (let i = 0; i < maxLines; i++) {
      const originalLine = originalLines[i];
      const suggestedLine = suggestedLines[i];

      if (originalLine === undefined) {
        // Line was added
        diff.push({
          type: 'added',
          content: suggestedLine,
          lineNumber: i + 1,
        });
      } else if (suggestedLine === undefined) {
        // Line was removed
        diff.push({
          type: 'removed',
          content: originalLine,
          lineNumber: i + 1,
        });
      } else if (originalLine === suggestedLine) {
        // Line unchanged
        diff.push({
          type: 'unchanged',
          content: originalLine,
          lineNumber: i + 1,
        });
      } else {
        // Line was modified - show both removed and added
        diff.push({
          type: 'removed',
          content: originalLine,
          lineNumber: i + 1,
        });
        diff.push({
          type: 'added',
          content: suggestedLine,
          lineNumber: i + 1,
        });
      }
    }

    return diff;
  };

  // For very short texts, show inline diff instead of line diff
  const isInlineDiff = originalText.length < 100 && !originalText.includes('\n') && !suggestedText.includes('\n');

  if (isInlineDiff) {
    return (
      <div className={cn('space-y-2', className)}>
        <div className="flex items-center space-x-2 text-xs text-gray-500">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-red-100 border border-red-300 rounded"></div>
            <span>Original</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-green-100 border border-green-300 rounded"></div>
            <span>Suggested</span>
          </div>
        </div>
        
        <div className="space-y-1">
          <div className="p-2 bg-red-50 border border-red-200 rounded text-sm font-mono">
            <span className="text-red-700">- </span>
            <span className="text-red-800">{originalText}</span>
          </div>
          <div className="p-2 bg-green-50 border border-green-200 rounded text-sm font-mono">
            <span className="text-green-700">+ </span>
            <span className="text-green-800">{suggestedText}</span>
          </div>
        </div>
      </div>
    );
  }

  const diffLines = generateDiff(originalText, suggestedText);

  return (
    <div className={cn('border border-gray-200 rounded-md overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center space-x-4 text-xs text-gray-500">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-red-100 border border-red-300 rounded"></div>
            <span>Removed</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-green-100 border border-green-300 rounded"></div>
            <span>Added</span>
          </div>
        </div>
        <span className="text-xs text-gray-500">
          {diffLines.filter(l => l.type === 'added').length} additions, {diffLines.filter(l => l.type === 'removed').length} deletions
        </span>
      </div>

      {/* Diff Content */}
      <div className="max-h-64 overflow-auto">
        {diffLines.map((line, index) => (
          <div
            key={index}
            className={cn(
              'flex items-start font-mono text-sm',
              line.type === 'added' && 'bg-green-50',
              line.type === 'removed' && 'bg-red-50',
              line.type === 'unchanged' && 'bg-white'
            )}
          >
            {/* Line Number */}
            <div className="flex-shrink-0 w-12 px-2 py-1 text-xs text-gray-400 text-right border-r border-gray-200 bg-gray-50">
              {line.lineNumber}
            </div>

            {/* Change Indicator */}
            <div className="flex-shrink-0 w-6 px-1 py-1 text-center">
              {line.type === 'added' && (
                <span className="text-green-600 font-bold">+</span>
              )}
              {line.type === 'removed' && (
                <span className="text-red-600 font-bold">-</span>
              )}
              {line.type === 'unchanged' && (
                <span className="text-gray-400"> </span>
              )}
            </div>

            {/* Content */}
            <div className={cn(
              'flex-1 px-2 py-1 whitespace-pre-wrap',
              line.type === 'added' && 'text-green-800',
              line.type === 'removed' && 'text-red-800',
              line.type === 'unchanged' && 'text-gray-700'
            )}>
              {line.content || ' '}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};