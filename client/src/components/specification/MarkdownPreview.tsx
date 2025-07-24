import React from 'react';
import { cn } from '../../utils/cn';

export interface MarkdownPreviewProps {
  content: string;
  className?: string;
}

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({
  content,
  className,
}) => {
  // Simple markdown parsing for basic formatting
  const parseMarkdown = (text: string): string => {
    return text
      // Headers
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold text-gray-900 mt-6 mb-3">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold text-gray-900 mt-8 mb-4">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold text-gray-900 mt-8 mb-6">$1</h1>')
      
      // Bold and italic
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
      
      // Code blocks
      .replace(/```mermaid\n([\s\S]*?)\n```/g, '<div class="mermaid-diagram bg-gray-50 p-4 rounded border my-4"><pre class="text-sm">$1</pre></div>')
      .replace(/```(\w+)?\n([\s\S]*?)\n```/g, '<pre class="bg-gray-900 text-gray-100 p-4 rounded my-4 overflow-x-auto"><code class="text-sm">$2</code></pre>')
      .replace(/`([^`]+)`/g, '<code class="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-sm font-mono">$1</code>')
      
      // Lists
      .replace(/^\s*\* (.*$)/gim, '<li class="ml-4">• $1</li>')
      .replace(/^\s*- (.*$)/gim, '<li class="ml-4">• $1</li>')
      .replace(/^\s*\d+\. (.*$)/gim, '<li class="ml-4 list-decimal">$1</li>')
      
      // Task lists
      .replace(/^\s*- \[ \] (.*$)/gim, '<li class="flex items-center ml-4 my-1"><input type="checkbox" disabled class="mr-2 rounded"> $1</li>')
      .replace(/^\s*- \[x\] (.*$)/gim, '<li class="flex items-center ml-4 my-1"><input type="checkbox" disabled checked class="mr-2 rounded"> $1</li>')
      
      // Requirements references (italic)
      .replace(/_Requirements?: ([^_]+)_/g, '<em class="text-blue-600 text-sm">Requirements: $1</em>')
      
      // EARS format highlighting
      .replace(/\b(WHEN|IF|THEN|SHALL)\b/g, '<span class="font-semibold text-purple-600">$1</span>')
      
      // User story format highlighting
      .replace(/\*\*User Story:\*\* (As a .+?, I want .+?, so that .+)/g, '<div class="bg-blue-50 border-l-4 border-blue-400 p-3 my-3"><strong class="text-blue-800">User Story:</strong> <span class="text-blue-700">$1</span></div>')
      
      // Line breaks
      .replace(/\n\n/g, '</p><p class="mb-4">')
      .replace(/\n/g, '<br>');
  };

  const htmlContent = parseMarkdown(content);

  return (
    <div className={cn('prose prose-sm max-w-none', className)}>
      {content ? (
        <div 
          className="text-gray-900 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: `<p class="mb-4">${htmlContent}</p>` }}
        />
      ) : (
        <div className="text-gray-500 italic text-center py-8">
          No content to preview
        </div>
      )}
    </div>
  );
};