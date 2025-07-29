import React, { useState, useEffect } from 'react';
import { 
  LightBulbIcon, 
  ExclamationTriangleIcon, 
  CheckCircleIcon, 
  DocumentTextIcon,
  ChevronDownIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import { bestPracticesService, ContextualGuidance, InteractiveTip, Example } from '../../services/best-practices.service';
import { cn } from '../../utils/cn';

interface ContextualGuidanceProps {
  phase: 'REQUIREMENTS' | 'DESIGN' | 'TASKS' | 'IMPLEMENTATION';
  content: string;
  context?: string;
  className?: string;
}

const TIP_ICONS = {
  tip: LightBulbIcon,
  warning: ExclamationTriangleIcon,
  'best-practice': CheckCircleIcon,
  example: DocumentTextIcon,
};

const TIP_COLORS = {
  tip: 'text-blue-500 bg-blue-50 border-blue-200',
  warning: 'text-yellow-500 bg-yellow-50 border-yellow-200',
  'best-practice': 'text-green-500 bg-green-50 border-green-200',
  example: 'text-purple-500 bg-purple-50 border-purple-200',
};

export const ContextualGuidancePanel: React.FC<ContextualGuidanceProps> = ({
  phase,
  content,
  context,
  className,
}) => {
  const [guidance, setGuidance] = useState<ContextualGuidance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedTips, setExpandedTips] = useState<Set<string>>(new Set());
  const [expandedExamples, setExpandedExamples] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (content.trim()) {
      loadGuidance();
    }
  }, [phase, content, context]);

  const loadGuidance = async () => {
    try {
      setLoading(true);
      setError(null);
      const _result = await bestPracticesService.getContextualGuidance({
        phase,
        content,
        context,
      });
      setGuidance(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load guidance');
    } finally {
      setLoading(false);
    }
  };

  const toggleTip = (tipId: string) => {
    const newExpanded = new Set(expandedTips);
    if (newExpanded.has(tipId)) {
      newExpanded.delete(tipId);
    } else {
      newExpanded.add(tipId);
    }
    setExpandedTips(newExpanded);
  };

  const toggleExample = (exampleId: string) => {
    const newExpanded = new Set(expandedExamples);
    if (newExpanded.has(exampleId)) {
      newExpanded.delete(exampleId);
    } else {
      newExpanded.add(exampleId);
    }
    setExpandedExamples(newExpanded);
  };

  const renderTip = (tip: InteractiveTip) => {
    const Icon = TIP_ICONS[tip.type];
    const isExpanded = expandedTips.has(tip.id);

    return (
      <div
        key={tip.id}
        className={cn(
          'border rounded-lg p-3 transition-colors',
          TIP_COLORS[tip.type]
        )}
      >
        <div
          className="flex items-start space-x-2 cursor-pointer"
          onClick={() => toggleTip(tip.id)}
        >
          <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">{tip.title}</h4>
              {isExpanded ? (
                <ChevronDownIcon className="h-4 w-4" />
              ) : (
                <ChevronRightIcon className="h-4 w-4" />
              )}
            </div>
            {isExpanded && (
              <p className="text-sm mt-2 opacity-90">{tip.description}</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderExample = (example: Example) => {
    const isExpanded = expandedExamples.has(example.id);

    return (
      <div key={example.id} className="border border-gray-200 rounded-lg p-3">
        <div
          className="flex items-start justify-between cursor-pointer"
          onClick={() => toggleExample(example.id)}
        >
          <div className="flex-1">
            <h4 className="font-medium text-sm text-gray-900">{example.title}</h4>
            <p className="text-xs text-gray-600 mt-1">{example.description}</p>
          </div>
          {isExpanded ? (
            <ChevronDownIcon className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronRightIcon className="h-4 w-4 text-gray-500" />
          )}
        </div>

        {isExpanded && (
          <div className="mt-3 space-y-3">
            {example.goodExample && (
              <div>
                <h5 className="text-xs font-medium text-green-700 mb-1">✓ Good Example</h5>
                <pre className="text-xs bg-green-50 border border-green-200 rounded p-2 overflow-x-auto">
                  {example.goodExample}
                </pre>
              </div>
            )}

            {example.badExample && (
              <div>
                <h5 className="text-xs font-medium text-red-700 mb-1">✗ Avoid</h5>
                <pre className="text-xs bg-red-50 border border-red-200 rounded p-2 overflow-x-auto">
                  {example.badExample}
                </pre>
              </div>
            )}

            <div>
              <h5 className="text-xs font-medium text-gray-700 mb-1">Explanation</h5>
              <p className="text-xs text-gray-600">{example.explanation}</p>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className={cn('bg-white border border-gray-200 rounded-lg p-4', className)}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-3"></div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('bg-red-50 border border-red-200 rounded-lg p-4', className)}>
        <div className="flex items-center space-x-2">
          <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
          <span className="text-sm text-red-700">Failed to load guidance: {error}</span>
        </div>
      </div>
    );
  }

  if (!guidance || (!guidance.tips.length && !guidance.examples.length && !guidance.recommendations.length)) {
    return (
      <div className={cn('bg-gray-50 border border-gray-200 rounded-lg p-4', className)}>
        <div className="text-center text-sm text-gray-500">
          <LightBulbIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No specific guidance available for this content.</p>
          <p className="text-xs mt-1">Keep writing to get contextual tips and examples!</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-white border border-gray-200 rounded-lg', className)}>
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-sm font-medium text-gray-900 flex items-center">
          <LightBulbIcon className="h-4 w-4 mr-2" />
          Best Practices Guidance
        </h3>
      </div>

      <div className="p-4 space-y-4">
        {/* Tips */}
        {guidance.tips.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-gray-700 mb-2 uppercase tracking-wide">
              Tips & Recommendations
            </h4>
            <div className="space-y-2">
              {guidance.tips.map(renderTip)}
            </div>
          </div>
        )}

        {/* Examples */}
        {guidance.examples.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-gray-700 mb-2 uppercase tracking-wide">
              Examples
            </h4>
            <div className="space-y-2">
              {guidance.examples.map(renderExample)}
            </div>
          </div>
        )}

        {/* General Recommendations */}
        {guidance.recommendations.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-gray-700 mb-2 uppercase tracking-wide">
              Recommendations
            </h4>
            <div className="space-y-1">
              {guidance.recommendations.map((recommendation, index) => (
                <div key={index} className="flex items-start space-x-2 text-sm">
                  <CheckCircleIcon className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">{recommendation}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};