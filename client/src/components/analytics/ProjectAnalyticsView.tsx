import React from 'react';
import { ProjectAnalytics, TimeRange } from '../../services/analytics.service';
import { MetricCard } from './MetricCard';
import { PhaseProgressChart } from './PhaseProgressChart';
import { QualityTrendChart } from './QualityTrendChart';
import { CollaborationMetricsCard } from './CollaborationMetricsCard';
import {
  ChartBarIcon,
  ClockIcon,
  ArrowPathIcon,
  TrendingUpIcon,
} from '@heroicons/react/24/outline';

interface ProjectAnalyticsViewProps {
  analytics: ProjectAnalytics;
  timeRange?: TimeRange;
  className?: string;
}

export const ProjectAnalyticsView: React.FC<ProjectAnalyticsViewProps> = ({
  analytics,
  timeRange: _timeRange,
  className = '',
}) => {
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const _getPhaseCompletionRate = () => {
    const completedPhases = analytics.phaseMetrics.filter(p => p.completionRate === 100).length;
    return (completedPhases / analytics.phaseMetrics.length) * 100;
  };

  const getAverageQualityScore = () => {
    const totalScore = analytics.phaseMetrics.reduce((sum, p) => sum + p.averageQualityScore, 0);
    return totalScore / analytics.phaseMetrics.length;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Overall Completion"
          value={`${analytics.completionRate.toFixed(1)}%`}
          icon={ChartBarIcon}
          trend={analytics.completionRate > 75 ? 'up' : 'down'}
          color="blue"
        />
        <MetricCard
          title="Total Time Spent"
          value={formatTime(analytics.totalTimeSpent)}
          icon={ClockIcon}
          color="green"
        />
        <MetricCard
          title="Avg Review Cycles"
          value={analytics.averageReviewCycles.toFixed(1)}
          icon={ArrowPathIcon}
          trend={analytics.averageReviewCycles < 2 ? 'up' : 'down'}
          color="orange"
        />
        <MetricCard
          title="Quality Score"
          value={getAverageQualityScore().toFixed(1)}
          icon={TrendingUpIcon}
          trend="up"
          color="purple"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Phase Progress */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Phase Progress</h3>
          <PhaseProgressChart phaseMetrics={analytics.phaseMetrics} />
        </div>

        {/* Quality Trend */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Quality Trend</h3>
          <QualityTrendChart qualityTrend={analytics.qualityTrend} />
        </div>
      </div>

      {/* Phase Details */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Phase Details</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {analytics.phaseMetrics.map((phase) => (
              <div key={phase.phase} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900 capitalize">
                    {phase.phase.toLowerCase()}
                  </h4>
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      phase.completionRate === 100
                        ? 'bg-green-100 text-green-800'
                        : phase.completionRate > 0
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {phase.completionRate.toFixed(0)}%
                  </span>
                </div>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Time:</span>
                    <span>{formatTime(phase.averageTimeSpent)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Quality:</span>
                    <span>{phase.averageQualityScore.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Reviews:</span>
                    <span>{phase.reviewCycles.toFixed(1)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Collaboration Metrics */}
      <CollaborationMetricsCard metrics={analytics.collaborationMetrics} />

      {/* Insights and Recommendations */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Insights & Recommendations</h3>
        <div className="space-y-4">
          {analytics.completionRate < 50 && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-yellow-800">Low Completion Rate</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    Consider breaking down tasks into smaller, more manageable pieces to improve completion rates.
                  </p>
                </div>
              </div>
            </div>
          )}

          {analytics.averageReviewCycles > 3 && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-blue-800">High Review Cycles</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    Multiple review cycles detected. Consider improving initial quality through better templates or training.
                  </p>
                </div>
              </div>
            </div>
          )}

          {getAverageQualityScore() > 85 && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-md">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-green-800">Excellent Quality</h4>
                  <p className="text-sm text-green-700 mt-1">
                    Great work! Your specifications consistently meet high quality standards.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};