import React from 'react';
import { UserAnalytics, TimeRange } from '../../services/analytics.service';
import { MetricCard } from './MetricCard';
import {
  FolderIcon,
  CheckCircleIcon,
  TrendingUpIcon,
  BookOpenIcon,
  ClockIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';

interface UserAnalyticsViewProps {
  analytics: UserAnalytics;
  timeRange?: TimeRange;
  className?: string;
}

export const UserAnalyticsView: React.FC<UserAnalyticsViewProps> = ({
  analytics,
  timeRange,
  className = '',
}) => {
  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${minutes}m`;
  };

  const getSkillLevelColor = (level: number) => {
    if (level >= 80) return 'bg-green-500';
    if (level >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getSkillLevelLabel = (level: number) => {
    if (level >= 80) return 'Expert';
    if (level >= 60) return 'Intermediate';
    if (level >= 40) return 'Beginner';
    return 'Novice';
  };

  const getMostActiveHour = () => {
    if (analytics.activitySummary.mostActiveHours.length === 0) return 'N/A';
    const hour = analytics.activitySummary.mostActiveHours[0];
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:00 ${period}`;
  };

  const getTopActivity = () => {
    const activities = Object.entries(analytics.activitySummary.activityBreakdown);
    if (activities.length === 0) return 'None';
    
    const topActivity = activities.reduce((max, current) => 
      current[1] > max[1] ? current : max
    );
    
    return topActivity[0].replace('_', ' ').toLowerCase();
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Projects"
          value={analytics.totalProjects.toString()}
          icon={FolderIcon}
          color="blue"
        />
        <MetricCard
          title="Completed Projects"
          value={analytics.completedProjects.toString()}
          icon={CheckCircleIcon}
          color="green"
        />
        <MetricCard
          title="Avg Quality Score"
          value={analytics.averageQualityScore.toFixed(1)}
          icon={TrendingUpIcon}
          trend={analytics.averageQualityScore > 75 ? 'up' : 'down'}
          color="purple"
        />
        <MetricCard
          title="Learning Progress"
          value={`${Math.round(
            (analytics.learningProgress.modulesCompleted / analytics.learningProgress.totalModules) * 100
          )}%`}
          icon={BookOpenIcon}
          color="orange"
        />
      </div>

      {/* Skills Overview */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Your Skills</h3>
        </div>
        <div className="p-6">
          {analytics.skillLevels.length > 0 ? (
            <div className="space-y-4">
              {analytics.skillLevels.map((skill) => (
                <div key={skill.skillArea} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-medium text-gray-900 capitalize">
                        {skill.skillArea}
                      </span>
                      <span className="text-xs text-gray-500">
                        {getSkillLevelLabel(skill.currentLevel)}
                      </span>
                    </div>
                    <div className="flex items-center space-x-4 text-sm">
                      <span className="text-gray-600">
                        {skill.currentLevel.toFixed(1)}
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
                      className={`h-2 rounded-full ${getSkillLevelColor(skill.currentLevel)}`}
                      style={{ width: `${skill.currentLevel}%` }}
                    />
                  </div>
                  
                  <div className="text-xs text-gray-500">
                    Last assessed: {new Date(skill.lastAssessment).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No skill assessments available yet. Complete some projects to see your skill development!
            </div>
          )}
        </div>
      </div>

      {/* Activity Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Stats */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Activity Summary</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Activities</span>
                <span className="text-lg font-semibold text-gray-900">
                  {analytics.activitySummary.totalActivities}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Daily Average</span>
                <span className="text-lg font-semibold text-gray-900">
                  {analytics.activitySummary.dailyAverage.toFixed(1)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Most Active Hour</span>
                <span className="text-lg font-semibold text-gray-900">
                  {getMostActiveHour()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Top Activity</span>
                <span className="text-lg font-semibold text-gray-900 capitalize">
                  {getTopActivity()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Learning Progress */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Learning Progress</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Modules Completed</span>
                <span className="text-lg font-semibold text-gray-900">
                  {analytics.learningProgress.modulesCompleted} / {analytics.learningProgress.totalModules}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="h-2 bg-blue-500 rounded-full"
                  style={{
                    width: `${
                      (analytics.learningProgress.modulesCompleted / analytics.learningProgress.totalModules) * 100
                    }%`,
                  }}
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Average Score</span>
                <span className="text-lg font-semibold text-gray-900">
                  {analytics.learningProgress.averageScore.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Time Spent</span>
                <span className="text-lg font-semibold text-gray-900">
                  {formatTime(analytics.learningProgress.timeSpent)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Breakdown */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Activity Breakdown</h3>
        </div>
        <div className="p-6">
          {Object.keys(analytics.activitySummary.activityBreakdown).length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Object.entries(analytics.activitySummary.activityBreakdown)
                .sort(([, a], [, b]) => b - a)
                .map(([activity, count]) => (
                  <div key={activity} className="text-center p-3 border rounded-lg">
                    <div className="text-2xl font-semibold text-gray-900">{count}</div>
                    <div className="text-sm text-gray-600 capitalize">
                      {activity.replace('_', ' ').toLowerCase()}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No activity data available yet
            </div>
          )}
        </div>
      </div>

      {/* Personal Insights */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Personal Insights</h3>
        <div className="space-y-4">
          {analytics.completedProjects === 0 && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-blue-800">Getting Started</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    Complete your first project to start building your skill profile and track your progress.
                  </p>
                </div>
              </div>
            </div>
          )}

          {analytics.averageQualityScore > 85 && (
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
                    Your specifications consistently meet high quality standards. Keep up the great work!
                  </p>
                </div>
              </div>
            </div>
          )}

          {analytics.learningProgress.modulesCompleted / analytics.learningProgress.totalModules < 0.5 && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-yellow-800">Continue Learning</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    You're making good progress! Complete more learning modules to further develop your skills.
                  </p>
                </div>
              </div>
            </div>
          )}

          {analytics.skillLevels.some(skill => skill.improvement < 0) && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-red-800">Skill Attention Needed</h4>
                  <p className="text-sm text-red-700 mt-1">
                    Some of your skills are showing decline. Consider reviewing learning materials or seeking additional practice.
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