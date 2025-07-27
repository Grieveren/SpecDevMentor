import React from 'react';
import { ExecutionResult } from '../../types/code-execution';
import { CheckCircleIcon, XCircleIcon, ClockIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface ExecutionResultsProps {
  result: ExecutionResult;
  isLoading?: boolean;
  className?: string;
}

export const ExecutionResults: React.FC<ExecutionResultsProps> = ({
  result,
  isLoading = false,
  className = '',
}) => {
  const getStatusIcon = () => {
    if (isLoading) {
      return <ClockIcon className="w-5 h-5 text-blue-500 animate-spin" />;
    }

    if (result.timedOut) {
      return <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />;
    }

    return result.success ? (
      <CheckCircleIcon className="w-5 h-5 text-green-500" />
    ) : (
      <XCircleIcon className="w-5 h-5 text-red-500" />
    );
  };

  const getStatusText = () => {
    if (isLoading) return 'Executing...';
    if (result.timedOut) return 'Execution Timed Out';
    return result.success ? 'Execution Successful' : 'Execution Failed';
  };

  const getStatusColor = () => {
    if (isLoading) return 'text-blue-600';
    if (result.timedOut) return 'text-yellow-600';
    return result.success ? 'text-green-600' : 'text-red-600';
  };

  const getBorderColor = () => {
    if (isLoading) return 'border-blue-200';
    if (result.timedOut) return 'border-yellow-200';
    return result.success ? 'border-green-200' : 'border-red-200';
  };

  const getBackgroundColor = () => {
    if (isLoading) return 'bg-blue-50';
    if (result.timedOut) return 'bg-yellow-50';
    return result.success ? 'bg-green-50' : 'bg-red-50';
  };

  return (
    <div className={`border rounded-lg ${getBorderColor()} ${getBackgroundColor()} ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {getStatusIcon()}
            <span className={`font-medium ${getStatusColor()}`}>
              {getStatusText()}
            </span>
          </div>
          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <span>Exit Code: {result.exitCode}</span>
            <span>Time: {result.executionTime}ms</span>
          </div>
        </div>
      </div>

      {/* Output Section */}
      {result.output && (
        <div className="p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Output:</h4>
          <pre className="bg-gray-900 text-green-400 p-3 rounded text-sm overflow-x-auto whitespace-pre-wrap font-mono">
            {result.output}
          </pre>
        </div>
      )}

      {/* Error Section */}
      {result.error && (
        <div className="p-4 border-t border-gray-200">
          <h4 className="text-sm font-medium text-red-700 mb-2">Error:</h4>
          <pre className="bg-red-900 text-red-100 p-3 rounded text-sm overflow-x-auto whitespace-pre-wrap font-mono">
            {result.error}
          </pre>
        </div>
      )}

      {/* Timeout Warning */}
      {result.timedOut && (
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center space-x-2 text-yellow-700">
            <ExclamationTriangleIcon className="w-4 h-4" />
            <span className="text-sm">
              Execution was terminated due to timeout. Consider optimizing your code or increasing the timeout limit.
            </span>
          </div>
        </div>
      )}

      {/* No Output Message */}
      {!result.output && !result.error && !isLoading && (
        <div className="p-4 text-center text-gray-500">
          <span className="text-sm">No output generated</span>
        </div>
      )}
    </div>
  );
};