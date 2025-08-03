// @ts-nocheck
import React, { useState } from 'react';
import {
  SparklesIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { AIReviewResult, AISuggestion } from '../../services/ai-review.service';
import { cn } from '../../utils/cn';
import { SuggestionCard } from './SuggestionCard';
import { ReviewHistory } from './ReviewHistory';
import { ScoreIndicator } from './ScoreIndicator';
import { QualityMetrics } from './QualityMetrics';

export interface AIReviewPanelProps {
  documentId: string;
  currentReview?: AIReviewResult | null;
  isLoading?: boolean;
  error?: string | null;
  onRequestReview: () => Promise<void>;
  onApplySuggestion: (suggestion: AISuggestion) => Promise<void>;
  onDismissSuggestion: (suggestionId: string) => void;
  onRollbackSuggestion: (suggestionId: string) => Promise<void>;
  className?: string;
}

export const AIReviewPanel: React.FC<AIReviewPanelProps> = ({
  documentId,
  currentReview,
  isLoading = false,
  error = null,
  onRequestReview,
  onApplySuggestion,
  onDismissSuggestion,
  onRollbackSuggestion,
  className,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'suggestions' | 'metrics' | 'history'>('suggestions');
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());

  const handleDismissSuggestion = (suggestionId: string) => {
    setDismissedSuggestions(prev => new Set([...prev, suggestionId]));
    onDismissSuggestion(suggestionId);
  };

  const visibleSuggestions = currentReview?.suggestions.filter(
    suggestion => !dismissedSuggestions.has(suggestion.id)
  ) || [];

  const appliedSuggestions = currentReview?.appliedSuggestions || [];

  const getSeverityCount = (severity: AISuggestion['severity']) => {
    return visibleSuggestions.filter(s => s.severity === severity).length;
  };

  const tabs = [
    {
      id: 'suggestions' as const,
      label: 'Suggestions',
      count: visibleSuggestions.length,
      icon: SparklesIcon,
    },
    {
      id: 'metrics' as const,
      label: 'Quality',
      icon: CheckCircleIcon,
    },
    {
      id: 'history' as const,
      label: 'History',
      icon: ClockIcon,
    },
  ];

  return (
    <div className={cn('bg-white border border-gray-200 rounded-lg shadow-sm', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <SparklesIcon className="h-6 w-6 text-purple-500" />
          <div>
            <h3 className="text-lg font-medium text-gray-900">AI Review</h3>
            {currentReview && (
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <span>Overall Score:</span>
                <ScoreIndicator score={currentReview.overallScore} size="sm" />
                <span>•</span>
                <span>{new Date(currentReview.createdAt).toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {!currentReview && !isLoading && (
            <button
              onClick={onRequestReview}
              className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              Request Review
            </button>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-gray-400 hover:text-gray-600 focus:outline-none"
          >
            {isExpanded ? (
              <ChevronUpIcon className="h-5 w-5" />
            ) : (
              <ChevronDownIcon className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-4">
          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center space-x-2 text-gray-500">
                <SparklesIcon className="h-5 w-5 animate-pulse" />
                <span>Analyzing document...</span>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-md text-red-700">
              <ExclamationTriangleIcon className="h-5 w-5" />
              <span>{error}</span>
            </div>
          )}

          {/* No Review State */}
          {!currentReview && !isLoading && !error && (
            <div className="text-center py-8">
              <SparklesIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">No AI Review Yet</h4>
              <p className="text-gray-500 mb-4">
                Get AI-powered feedback on your specification document
              </p>
              <button
                onClick={onRequestReview}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                Request AI Review
              </button>
            </div>
          )}

          {/* Review Content */}
          {currentReview && !isLoading && (
            <>
              {/* Summary */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-900">Review Summary</h4>
                  <button
                    onClick={onRequestReview}
                    className="text-sm text-purple-600 hover:text-purple-700"
                  >
                    New Review
                  </button>
                </div>
                
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div className="p-3 bg-red-50 rounded-lg">
                    <div className="text-lg font-semibold text-red-600">
                      {getSeverityCount('critical')}
                    </div>
                    <div className="text-xs text-red-500">Critical</div>
                  </div>
                  <div className="p-3 bg-orange-50 rounded-lg">
                    <div className="text-lg font-semibold text-orange-600">
                      {getSeverityCount('high')}
                    </div>
                    <div className="text-xs text-orange-500">High</div>
                  </div>
                  <div className="p-3 bg-yellow-50 rounded-lg">
                    <div className="text-lg font-semibold text-yellow-600">
                      {getSeverityCount('medium')}
                    </div>
                    <div className="text-xs text-yellow-500">Medium</div>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <div className="text-lg font-semibold text-blue-600">
                      {getSeverityCount('low')}
                    </div>
                    <div className="text-xs text-blue-500">Low</div>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="border-b border-gray-200 mb-4">
                <nav className="flex space-x-8">
                  {tabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        'flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm',
                        activeTab === tab.id
                          ? 'border-purple-500 text-purple-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      )}
                    >
                      <tab.icon className="h-4 w-4" />
                      <span>{tab.label}</span>
                      {tab.count !== undefined && (
                        <span className={cn(
                          'px-2 py-0.5 rounded-full text-xs',
                          activeTab === tab.id
                            ? 'bg-purple-100 text-purple-600'
                            : 'bg-gray-100 text-gray-600'
                        )}>
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Tab Content */}
              {activeTab === 'suggestions' && (
                <div className="space-y-4">
                  {visibleSuggestions.length === 0 ? (
                    <div className="text-center py-6">
                      <CheckCircleIcon className="h-8 w-8 text-green-500 mx-auto mb-2" />
                      <p className="text-gray-500">No suggestions - great work!</p>
                    </div>
                  ) : (
                    visibleSuggestions.map(suggestion => (
                      <SuggestionCard
                        key={suggestion.id}
                        suggestion={suggestion}
                        isApplied={appliedSuggestions.includes(suggestion.id)}
                        onApply={() => onApplySuggestion(suggestion)}
                        onDismiss={() => handleDismissSuggestion(suggestion.id)}
                        onRollback={() => onRollbackSuggestion(suggestion.id)}
                      />
                    ))
                  )}
                </div>
              )}

              {activeTab === 'metrics' && (
                <QualityMetrics
                  metrics={currentReview.qualityMetrics}
                  completeness={currentReview.completenessCheck}
                  complianceIssues={currentReview.complianceIssues}
                />
              )}

              {activeTab === 'history' && (
                <ReviewHistory
                  documentId={documentId}
                  currentReviewId={currentReview.id}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};