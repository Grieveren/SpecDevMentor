import React, { useState } from 'react';
import {
  CheckIcon,
  XMarkIcon,
  ArrowUturnLeftIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  LightBulbIcon,
  BugAntIcon,
} from '@heroicons/react/24/outline';
import { AISuggestion } from '../../services/ai-review.service';
import { cn } from '../../utils/cn';
import { DiffVisualization } from './DiffVisualization';

export interface SuggestionCardProps {
  suggestion: AISuggestion;
  isApplied: boolean;
  onApply: () => Promise<void>;
  onDismiss: () => void;
  onRollback: () => Promise<void>;
  className?: string;
}

export const SuggestionCard: React.FC<SuggestionCardProps> = ({
  suggestion,
  isApplied,
  onApply,
  onDismiss,
  onRollback,
  className,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState(false);

  const handleApply = async () => {
    setIsApplying(true);
    try {
      await onApply();
    } catch (error) {
      console.error('Failed to apply suggestion:', error);
    } finally {
      setIsApplying(false);
    }
  };

  const handleRollback = async () => {
    setIsRollingBack(true);
    try {
      await onRollback();
    } catch (error) {
      console.error('Failed to rollback suggestion:', error);
    } finally {
      setIsRollingBack(false);
    }
  };

  const getSeverityColor = (severity: AISuggestion['severity']) => {
    switch (severity) {
      case 'critical':
        return 'border-red-200 bg-red-50';
      case 'high':
        return 'border-orange-200 bg-orange-50';
      case 'medium':
        return 'border-yellow-200 bg-yellow-50';
      case 'low':
        return 'border-blue-200 bg-blue-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const getSeverityTextColor = (severity: AISuggestion['severity']) => {
    switch (severity) {
      case 'critical':
        return 'text-red-700';
      case 'high':
        return 'text-orange-700';
      case 'medium':
        return 'text-yellow-700';
      case 'low':
        return 'text-blue-700';
      default:
        return 'text-gray-700';
    }
  };

  const getTypeIcon = (type: AISuggestion['type']) => {
    switch (type) {
      case 'error':
        return <BugAntIcon className="h-4 w-4" />;
      case 'warning':
        return <ExclamationTriangleIcon className="h-4 w-4" />;
      case 'improvement':
        return <LightBulbIcon className="h-4 w-4" />;
      case 'enhancement':
        return <InformationCircleIcon className="h-4 w-4" />;
      default:
        return <InformationCircleIcon className="h-4 w-4" />;
    }
  };

  const getCategoryLabel = (category: AISuggestion['category']) => {
    switch (category) {
      case 'structure':
        return 'Structure';
      case 'clarity':
        return 'Clarity';
      case 'completeness':
        return 'Completeness';
      case 'format':
        return 'Format';
      case 'best_practice':
        return 'Best Practice';
      case 'security':
        return 'Security';
      case 'performance':
        return 'Performance';
      default:
        return 'General';
    }
  };

  return (
    <div className={cn(
      'border rounded-lg transition-all duration-200',
      getSeverityColor(suggestion.severity),
      isApplied && 'opacity-75',
      className
    )}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <div className={cn('flex items-center space-x-1', getSeverityTextColor(suggestion.severity))}>
                {getTypeIcon(suggestion.type)}
                <span className="text-xs font-medium uppercase tracking-wide">
                  {suggestion.type}
                </span>
              </div>
              
              <span className="text-xs text-gray-500">•</span>
              
              <span className={cn('text-xs font-medium', getSeverityTextColor(suggestion.severity))}>
                {suggestion.severity.toUpperCase()}
              </span>
              
              <span className="text-xs text-gray-500">•</span>
              
              <span className="text-xs text-gray-500">
                {getCategoryLabel(suggestion.category)}
              </span>

              {suggestion.lineNumber && (
                <>
                  <span className="text-xs text-gray-500">•</span>
                  <span className="text-xs text-gray-500">
                    Line {suggestion.lineNumber}
                  </span>
                </>
              )}

              {isApplied && (
                <>
                  <span className="text-xs text-gray-500">•</span>
                  <span className="inline-flex items-center space-x-1 text-xs text-green-600">
                    <CheckIcon className="h-3 w-3" />
                    <span>Applied</span>
                  </span>
                </>
              )}
            </div>

            <h4 className="text-sm font-medium text-gray-900 mb-2">
              {suggestion.title}
            </h4>

            <p className="text-sm text-gray-700 leading-relaxed">
              {suggestion.description}
            </p>
          </div>

          <div className="flex items-center space-x-1 ml-4">
            {!isApplied ? (
              <>
                <button
                  onClick={handleApply}
                  disabled={isApplying}
                  className="p-1.5 text-green-600 hover:bg-green-100 rounded-md transition-colors disabled:opacity-50"
                  title="Apply suggestion"
                >
                  {isApplying ? (
                    <div className="h-4 w-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <CheckIcon className="h-4 w-4" />
                  )}
                </button>
                
                <button
                  onClick={onDismiss}
                  className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-md transition-colors"
                  title="Dismiss suggestion"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </>
            ) : (
              <button
                onClick={handleRollback}
                disabled={isRollingBack}
                className="p-1.5 text-orange-600 hover:bg-orange-100 rounded-md transition-colors disabled:opacity-50"
                title="Rollback suggestion"
              >
                {isRollingBack ? (
                  <div className="h-4 w-4 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <ArrowUturnLeftIcon className="h-4 w-4" />
                )}
              </button>
            )}

            {(suggestion.originalText || suggestion.reasoning) && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-md transition-colors"
                title={isExpanded ? 'Collapse details' : 'Expand details'}
              >
                {isExpanded ? (
                  <ChevronUpIcon className="h-4 w-4" />
                ) : (
                  <ChevronDownIcon className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-200 bg-white">
          {/* Reasoning */}
          {suggestion.reasoning && (
            <div className="p-4 border-b border-gray-100">
              <h5 className="text-xs font-medium text-gray-900 mb-2 uppercase tracking-wide">
                Reasoning
              </h5>
              <p className="text-sm text-gray-700 leading-relaxed">
                {suggestion.reasoning}
              </p>
            </div>
          )}

          {/* Diff Visualization */}
          {suggestion.originalText && suggestion.suggestedText && (
            <div className="p-4">
              <h5 className="text-xs font-medium text-gray-900 mb-3 uppercase tracking-wide">
                Suggested Changes
              </h5>
              <DiffVisualization
                originalText={suggestion.originalText}
                suggestedText={suggestion.suggestedText}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};