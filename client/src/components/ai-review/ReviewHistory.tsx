import React, { useState, useEffect } from 'react';
import {
  ClockIcon,
  ChevronRightIcon,
  SparklesIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { AIReviewResult, aiReviewService } from '../../services/ai-review.service';
import { cn } from '../../utils/cn';
import { ScoreIndicator } from './ScoreIndicator';

export interface ReviewHistoryProps {
  documentId: string;
  currentReviewId?: string;
  onSelectReview?: (review: AIReviewResult) => void;
  className?: string;
}

export const ReviewHistory: React.FC<ReviewHistoryProps> = ({
  documentId,
  currentReviewId,
  onSelectReview,
  className,
}) => {
  const [reviews, setReviews] = useState<AIReviewResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedReview, setExpandedReview] = useState<string | null>(null);

  useEffect(() => {
    loadReviewHistory();
  }, [documentId]);

  const loadReviewHistory = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await aiReviewService.getDocumentReviews(documentId, {
        limit: 20,
        offset: 0,
      });
      setReviews(response.reviews);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load review history');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReviewClick = (review: AIReviewResult) => {
    if (onSelectReview) {
      onSelectReview(review);
    } else {
      setExpandedReview(expandedReview === review.id ? null : review.id);
    }
  };

  const getPhaseLabel = (phase: string) => {
    switch (phase) {
      case 'requirements':
        return 'Requirements';
      case 'design':
        return 'Design';
      case 'tasks':
        return 'Tasks';
      default:
        return phase.charAt(0).toUpperCase() + phase.slice(1);
    }
  };

  const getSuggestionSummary = (review: AIReviewResult) => {
    const suggestions = review.suggestions;
    const critical = suggestions.filter(s => s.severity === 'critical').length;
    const high = suggestions.filter(s => s.severity === 'high').length;
    const medium = suggestions.filter(s => s.severity === 'medium').length;
    const low = suggestions.filter(s => s.severity === 'low').length;

    return { critical, high, medium, low, total: suggestions.length };
  };

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-8', className)}>
        <div className="flex items-center space-x-2 text-gray-500">
          <ClockIcon className="h-5 w-5 animate-pulse" />
          <span>Loading review history...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('p-4', className)}>
        <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-md text-red-700">
          <ExclamationTriangleIcon className="h-5 w-5" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className={cn('text-center py-8', className)}>
        <ClockIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h4 className="text-lg font-medium text-gray-900 mb-2">No Review History</h4>
        <p className="text-gray-500">
          This document hasn't been reviewed yet. Request an AI review to get started.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-medium text-gray-900">
          Review History ({reviews.length})
        </h4>
        <button
          onClick={loadReviewHistory}
          className="text-sm text-purple-600 hover:text-purple-700"
        >
          Refresh
        </button>
      </div>

      <div className="space-y-2">
        {reviews.map(review => {
          const suggestionSummary = getSuggestionSummary(review);
          const isExpanded = expandedReview === review.id;
          const isCurrent = currentReviewId === review.id;

          return (
            <div
              key={review.id}
              className={cn(
                'border rounded-lg transition-all duration-200',
                isCurrent
                  ? 'border-purple-300 bg-purple-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              )}
            >
              {/* Review Header */}
              <div
                className="p-4 cursor-pointer"
                onClick={() => handleReviewClick(review)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <SparklesIcon className={cn(
                      'h-5 w-5',
                      isCurrent ? 'text-purple-600' : 'text-gray-400'
                    )} />
                    
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-900">
                          {getPhaseLabel(review.phase)} Review
                        </span>
                        {isCurrent && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            Current
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(review.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <ScoreIndicator score={review.overallScore} size="sm" showLabel={false} />
                    
                    <div className="flex items-center space-x-1 text-xs text-gray-500">
                      {suggestionSummary.critical > 0 && (
                        <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded">
                          {suggestionSummary.critical}C
                        </span>
                      )}
                      {suggestionSummary.high > 0 && (
                        <span className="px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded">
                          {suggestionSummary.high}H
                        </span>
                      )}
                      {suggestionSummary.medium > 0 && (
                        <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-600 rounded">
                          {suggestionSummary.medium}M
                        </span>
                      )}
                      {suggestionSummary.low > 0 && (
                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded">
                          {suggestionSummary.low}L
                        </span>
                      )}
                    </div>

                    <ChevronRightIcon className={cn(
                      'h-4 w-4 text-gray-400 transition-transform',
                      isExpanded && 'transform rotate-90'
                    )} />
                  </div>
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="border-t border-gray-200 bg-gray-50 p-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-lg font-semibold text-gray-900">
                        {Math.round(review.overallScore)}%
                      </div>
                      <div className="text-xs text-gray-500">Overall Score</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-gray-900">
                        {suggestionSummary.total}
                      </div>
                      <div className="text-xs text-gray-500">Suggestions</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-gray-900">
                        {review.appliedSuggestions.length}
                      </div>
                      <div className="text-xs text-gray-500">Applied</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-gray-900">
                        {Math.round(review.completenessCheck.score * 100)}%
                      </div>
                      <div className="text-xs text-gray-500">Completeness</div>
                    </div>
                  </div>

                  {/* Quality Metrics */}
                  <div className="grid grid-cols-5 gap-2 text-center text-xs">
                    <div>
                      <div className="font-medium text-gray-900">
                        {Math.round(review.qualityMetrics.clarity * 100)}%
                      </div>
                      <div className="text-gray-500">Clarity</div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {Math.round(review.qualityMetrics.completeness * 100)}%
                      </div>
                      <div className="text-gray-500">Complete</div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {Math.round(review.qualityMetrics.consistency * 100)}%
                      </div>
                      <div className="text-gray-500">Consistent</div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {Math.round(review.qualityMetrics.testability * 100)}%
                      </div>
                      <div className="text-gray-500">Testable</div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {Math.round(review.qualityMetrics.traceability * 100)}%
                      </div>
                      <div className="text-gray-500">Traceable</div>
                    </div>
                  </div>

                  {/* Compliance Issues */}
                  {review.complianceIssues.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="text-xs font-medium text-gray-700 mb-2">
                        Compliance Issues ({review.complianceIssues.length})
                      </div>
                      <div className="space-y-1">
                        {review.complianceIssues.slice(0, 3).map(issue => (
                          <div key={issue.id} className="text-xs text-gray-600">
                            • {issue.description}
                          </div>
                        ))}
                        {review.complianceIssues.length > 3 && (
                          <div className="text-xs text-gray-500">
                            ... and {review.complianceIssues.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};