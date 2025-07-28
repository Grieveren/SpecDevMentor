import React from 'react';
import { TeamAnalytics, TimeRange } from '../../services/analytics.service';
import { MetricCard } from './MetricCard';
import {
  UsersIcon,
  TrophyIcon,
  ClockIcon,
  AcademicCapIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';

interface TeamAnalyticsViewProps {
  analytics: TeamAnalytics;
  timeRange?: TimeRange;
  className?: string;
}

export const TeamAnalyticsView: React.FC<TeamAnalyticsViewProps> = ({
  analytics,
  timeRange,
  className = '',
}) => {
  const formatTime = (hours: number): string => {
    if (hours < 1) {
      return `${Math.round(hours * 60)}m`;
    }
    if (hours < 24) {
      return `${hours.toFixed(1)}h`;
    }
    return `${Math.round(hours / 24)}d`;
  };

  const getMethodologyColor = (adoption: number) => {
    if (adoption >= 80) return 'text-green-600 bg-green-100';
    if (adoption >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getSkillLevelColor = (level: number) => {
    if (level >= 80) return 'bg-green-500';
    if (level >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <MetricCard
          title="Team Size"
          value={analytics.teamSize.toString()}
          icon={UsersIcon}
          color="blue"
        />
        <MetricCard
          title="Projects Completed"
          value={analytics.projectsCompleted.toString()}
          icon={TrophyIcon}
          color="green"
        />
        <MetricCard
          title="Avg Quality Score"
          value={analytics.averageQualityScore.toFixed(1)}
          icon={ChartBarIcon}
          trend={analytics.averageQualityScore > 75 ? 'up' : 'down'}
          color="purple"
        />
        <MetricCard
          title="Avg Completion Time"
          value={formatTime(analytics.averageCompletionTime)}
          icon={ClockIcon}
          color="orange"
        />
        <MetricCard
          title="Methodology Adoption"
          value={`${analytics.methodologyAdoption.toFixed(1)}%`}
          icon={AcademicCapIcon}
          trend={analytics.methodologyAdoption > 70 ? 'up' : 'down'}
          color="green"
        />
      </div>

      {/* Skill Development */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Team Skill Development</h3>
        </div>
        <div className="p-6">
          {analytics.skillDevelopment.length > 0 ? (
            <div className="space-y-4">
              {analytics.skillDevelopment.map((skill) => (
                <div key={skill.skillArea} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-medium text-gray-900 capitalize">
                        {skill.skillArea}
                      </span>
                      <span className="text-xs text-gray-500">
                        ({skill.teamMembersAssessed} members assessed)
                      </span>
                    </div>
                    <div className="flex items-center space-x-4 text-sm">
                      <span className="text-gray-600">
                        Level: {skill.averageLevel.toFixed(1)}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        skill.improvement > 0 ? 'bg-green-100 text-green-800' :
                        skill.improvement < 0 ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {skill.improvement > 0 ? '+' : ''}{skill.improvement.toFixed(1)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Skill level bar */}
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${getSkillLevelColor(skill.averageLevel)}`}
                      style={{ width: `${skill.averageLevel}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No skill development data available yet
            </div>
          )}
        </div>
      </div>

      {/* Performance Trends */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Performance Trends</h3>
        </div>
        <div className="p-6">
          {analytics.performanceTrends.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {analytics.performanceTrends.map((trend, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900 capitalize">
                      {trend.metric.replace('_', ' ')}
                    </h4>
                    <span className="text-lg font-semibold text-gray-900">
                      {trend.value.toFixed(1)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {new Date(trend.date).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No performance trend data available yet
            </div>
          )}
        </div>
      </div>

      {/* Team Insights */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Team Insights & Recommendations</h3>
        <div className="space-y-4">
          {analytics.methodologyAdoption < 70 && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-yellow-800">Low Methodology Adoption</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    Consider providing additional training on specification methodology to improve adoption rates.
                  </p>
                </div>
              </div>
            </div>
          )}

          {analytics.averageCompletionTime > 168 && ( // More than a week
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-blue-800">Long Completion Times</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    Projects are taking longer than expected. Consider breaking down work into smaller chunks or providing more resources.
                  </p>
                </div>
              </div>
            </div>
          )}

          {analytics.averageQualityScore > 85 && analytics.methodologyAdoption > 80 && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-md">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-green-800">Excellent Team Performance</h4>
                  <p className="text-sm text-green-700 mt-1">
                    Your team is performing exceptionally well with high quality scores and strong methodology adoption!
                  </p>
                </div>
              </div>
            </div>
          )}

          {analytics.skillDevelopment.some(skill => skill.improvement < -5) && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-red-800">Skill Regression Detected</h4>
                  <p className="text-sm text-red-700 mt-1">
                    Some team members are showing declining skill levels. Consider additional support or training.
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