import React from 'react';
import { CollaborationMetrics } from '../../services/analytics.service';
import { UsersIcon, ChatBubbleLeftRightIcon, ClockIcon, ChartBarIcon } from '@heroicons/react/24/outline';

interface CollaborationMetricsCardProps {
  metrics: CollaborationMetrics;
  className?: string;
}

export const CollaborationMetricsCard: React.FC<CollaborationMetricsCardProps> = ({
  metrics,
  className = '',
}) => {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const formatResponseTime = (hours: number) => {
    if (hours < 1) {
      return `${Math.round(hours * 60)}m`;
    }
    if (hours < 24) {
      return `${Math.round(hours)}h`;
    }
    return `${Math.round(hours / 24)}d`;
  };

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Collaboration Metrics</h3>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Average Collaborators */}
          <div className="text-center">
            <div className="flex justify-center mb-2">
              <div className="p-3 bg-blue-100 rounded-full">
                <UsersIcon className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="text-2xl font-semibold text-gray-900">
              {metrics.averageCollaborators.toFixed(1)}
            </div>
            <div className="text-sm text-gray-600">Avg Collaborators</div>
          </div>

          {/* Total Comments */}
          <div className="text-center">
            <div className="flex justify-center mb-2">
              <div className="p-3 bg-green-100 rounded-full">
                <ChatBubbleLeftRightIcon className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <div className="text-2xl font-semibold text-gray-900">
              {metrics.totalComments}
            </div>
            <div className="text-sm text-gray-600">Total Comments</div>
          </div>

          {/* Average Response Time */}
          <div className="text-center">
            <div className="flex justify-center mb-2">
              <div className="p-3 bg-orange-100 rounded-full">
                <ClockIcon className="h-6 w-6 text-orange-600" />
              </div>
            </div>
            <div className="text-2xl font-semibold text-gray-900">
              {formatResponseTime(metrics.averageResponseTime)}
            </div>
            <div className="text-sm text-gray-600">Avg Response Time</div>
          </div>

          {/* Collaboration Score */}
          <div className="text-center">
            <div className="flex justify-center mb-2">
              <div className="p-3 bg-purple-100 rounded-full">
                <ChartBarIcon className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            <div className="text-2xl font-semibold text-gray-900">
              {metrics.collaborationScore.toFixed(0)}
            </div>
            <div className="text-sm text-gray-600">Collaboration Score</div>
            <div className={`inline-flex px-2 py-1 text-xs rounded-full mt-1 ${getScoreColor(metrics.collaborationScore)}`}>
              {metrics.collaborationScore >= 80 ? 'Excellent' : 
               metrics.collaborationScore >= 60 ? 'Good' : 'Needs Improvement'}
            </div>
          </div>
        </div>

        {/* Insights */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Collaboration Insights</h4>
          <div className="space-y-2 text-sm text-gray-600">
            {metrics.averageCollaborators < 2 && (
              <div className="flex items-start space-x-2">
                <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full mt-2 flex-shrink-0" />
                <span>Consider involving more team members in the specification process for better coverage.</span>
              </div>
            )}
            {metrics.averageResponseTime > 48 && (
              <div className="flex items-start space-x-2">
                <div className="w-1.5 h-1.5 bg-red-400 rounded-full mt-2 flex-shrink-0" />
                <span>Response times are high. Consider setting up notification systems or regular check-ins.</span>
              </div>
            )}
            {metrics.totalComments === 0 && (
              <div className="flex items-start space-x-2">
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-2 flex-shrink-0" />
                <span>No comments yet. Encourage team members to provide feedback and suggestions.</span>
              </div>
            )}
            {metrics.collaborationScore >= 80 && (
              <div className="flex items-start space-x-2">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full mt-2 flex-shrink-0" />
                <span>Excellent collaboration! Your team is working well together on specifications.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};