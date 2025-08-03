// @ts-nocheck
import React from 'react';
import {
  EyeIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  BeakerIcon,
  LinkIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { QualityMetrics as QualityMetricsType, CompletenessResult, ComplianceIssue } from '../../services/ai-review.service';
import { cn } from '../../utils/cn';
import { ScoreIndicator } from './ScoreIndicator';

export interface QualityMetricsProps {
  metrics: QualityMetricsType;
  completeness: CompletenessResult;
  complianceIssues: ComplianceIssue[];
  className?: string;
}

export const QualityMetrics: React.FC<QualityMetricsProps> = ({
  metrics,
  completeness,
  complianceIssues,
  className,
}) => {
  const metricItems = [
    {
      key: 'clarity',
      label: 'Clarity',
      value: metrics.clarity,
      icon: EyeIcon,
      description: 'How clear and understandable the content is',
    },
    {
      key: 'completeness',
      label: 'Completeness',
      value: metrics.completeness,
      icon: CheckCircleIcon,
      description: 'Whether all required sections and information are present',
    },
    {
      key: 'consistency',
      label: 'Consistency',
      value: metrics.consistency,
      icon: ArrowPathIcon,
      description: 'Consistency in terminology, format, and structure',
    },
    {
      key: 'testability',
      label: 'Testability',
      value: metrics.testability,
      icon: BeakerIcon,
      description: 'How well requirements can be tested and verified',
    },
    {
      key: 'traceability',
      label: 'Traceability',
      value: metrics.traceability,
      icon: LinkIcon,
      description: 'Ability to trace requirements through design and implementation',
    },
  ];

  const getComplianceIssueSeverityColor = (severity: ComplianceIssue['severity']) => {
    switch (severity) {
      case 'high':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'medium':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'low':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getComplianceTypeLabel = (type: ComplianceIssue['type']) => {
    switch (type) {
      case 'ears_format':
        return 'EARS Format';
      case 'user_story':
        return 'User Story';
      case 'acceptance_criteria':
        return 'Acceptance Criteria';
      case 'structure':
        return 'Structure';
      default:
        return 'General';
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Quality Metrics */}
      <div>
        <h4 className="text-sm font-medium text-gray-900 mb-4">Quality Metrics</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {metricItems.map(item => (
            <div
              key={item.key}
              className="p-4 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <item.icon className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-900">
                    {item.label}
                  </span>
                </div>
                <ScoreIndicator score={item.value * 100} size="sm" showLabel={false} />
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Completeness Check */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-medium text-gray-900">Completeness Analysis</h4>
          <ScoreIndicator score={completeness.score * 100} size="sm" />
        </div>

        {completeness.missingElements.length > 0 && (
          <div className="mb-4">
            <h5 className="text-xs font-medium text-gray-700 mb-2 uppercase tracking-wide">
              Missing Elements
            </h5>
            <div className="space-y-2">
              {completeness.missingElements.map((element, index) => (
                <div
                  key={index}
                  className="flex items-start space-x-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm"
                >
                  <ExclamationTriangleIcon className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <span className="text-yellow-800">{element}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {completeness.recommendations.length > 0 && (
          <div>
            <h5 className="text-xs font-medium text-gray-700 mb-2 uppercase tracking-wide">
              Recommendations
            </h5>
            <div className="space-y-2">
              {completeness.recommendations.map((recommendation, index) => (
                <div
                  key={index}
                  className="flex items-start space-x-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm"
                >
                  <CheckCircleIcon className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span className="text-blue-800">{recommendation}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Compliance Issues */}
      {complianceIssues.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-4">
            Compliance Issues ({complianceIssues.length})
          </h4>
          <div className="space-y-3">
            {complianceIssues.map(issue => (
              <div
                key={issue.id}
                className={cn(
                  'p-3 border rounded-lg',
                  getComplianceIssueSeverityColor(issue.severity)
                )}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-medium uppercase tracking-wide">
                      {getComplianceTypeLabel(issue.type)}
                    </span>
                    <span className="text-xs opacity-75">•</span>
                    <span className="text-xs font-medium uppercase">
                      {issue.severity}
                    </span>
                    {issue.lineNumber && (
                      <>
                        <span className="text-xs opacity-75">•</span>
                        <span className="text-xs">Line {issue.lineNumber}</span>
                      </>
                    )}
                  </div>
                </div>

                <p className="text-sm mb-2 leading-relaxed">
                  {issue.description}
                </p>

                <div className="text-xs opacity-90">
                  <strong>Suggestion:</strong> {issue.suggestion}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Summary</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-lg font-semibold text-gray-900">
              {Math.round((metrics.clarity + metrics.completeness + metrics.consistency + metrics.testability + metrics.traceability) / 5 * 100)}%
            </div>
            <div className="text-xs text-gray-500">Overall Quality</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900">
              {Math.round(completeness.score * 100)}%
            </div>
            <div className="text-xs text-gray-500">Completeness</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900">
              {completeness.missingElements.length}
            </div>
            <div className="text-xs text-gray-500">Missing Elements</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900">
              {complianceIssues.length}
            </div>
            <div className="text-xs text-gray-500">Compliance Issues</div>
          </div>
        </div>
      </div>
    </div>
  );
};