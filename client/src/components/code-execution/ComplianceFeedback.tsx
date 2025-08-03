// @ts-nocheck
import React from 'react';
import { ComplianceResult, ComplianceDetail } from '../../types/code-execution';
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  ExclamationTriangleIcon,
  LightBulbIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';

interface ComplianceFeedbackProps {
  result: ComplianceResult;
  isLoading?: boolean;
  className?: string;
}

export const ComplianceFeedback: React.FC<ComplianceFeedbackProps> = ({
  result,
  isLoading = false,
  className = '',
}) => {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBackgroundColor = (score: number) => {
    if (score >= 80) return 'bg-green-100';
    if (score >= 60) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  const getStatusIcon = (status: ComplianceDetail['status']) => {
    switch (status) {
      case 'passed':
        return <CheckCircleIcon className="w-4 h-4 text-green-500" />;
      case 'partial':
        return <ExclamationTriangleIcon className="w-4 h-4 text-yellow-500" />;
      case 'failed':
        return <XCircleIcon className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusBadgeColor = (status: ComplianceDetail['status']) => {
    switch (status) {
      case 'passed':
        return 'bg-green-100 text-green-800';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className={`border border-gray-200 rounded-lg bg-white ${className}`}>
        <div className="p-6 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Validating code compliance...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`border border-gray-200 rounded-lg bg-white ${className}`}>
      {/* Header with Score */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <ChartBarIcon className="w-6 h-6 text-gray-600" />
            <h3 className="text-lg font-medium text-gray-900">Compliance Report</h3>
          </div>
          <div className="flex items-center space-x-4">
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${getScoreBackgroundColor(result.score)}`}>
              <span className={getScoreColor(result.score)}>
                Score: {result.score}%
              </span>
            </div>
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              result.passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {result.passed ? 'PASSED' : 'FAILED'}
            </div>
          </div>
        </div>
      </div>

      {/* Requirements Details */}
      <div className="p-6">
        <h4 className="text-md font-medium text-gray-900 mb-4">Requirements Analysis</h4>
        <div className="space-y-4">
          {result.details.map((detail, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                {getStatusIcon(detail.status)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {detail.requirement}
                    </p>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeColor(detail.status)}`}>
                      {detail.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    {detail.message}
                  </p>
                  {detail.evidence && (
                    <div className="bg-gray-50 rounded p-2">
                      <p className="text-xs text-gray-700">
                        <span className="font-medium">Evidence:</span> {detail.evidence}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Suggestions */}
      {result.suggestions.length > 0 && (
        <div className="px-6 py-4 border-t border-gray-200 bg-blue-50">
          <div className="flex items-start space-x-3">
            <LightBulbIcon className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-medium text-blue-900 mb-2">Improvement Suggestions</h4>
              <ul className="space-y-1">
                {result.suggestions.map((suggestion, index) => (
                  <li key={index} className="text-sm text-blue-800">
                    • {suggestion}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-semibold text-green-600">
              {result.details.filter(d => d.status === 'passed').length}
            </div>
            <div className="text-xs text-gray-600">Passed</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-yellow-600">
              {result.details.filter(d => d.status === 'partial').length}
            </div>
            <div className="text-xs text-gray-600">Partial</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-red-600">
              {result.details.filter(d => d.status === 'failed').length}
            </div>
            <div className="text-xs text-gray-600">Failed</div>
          </div>
        </div>
      </div>
    </div>
  );
};