import React, { useState, useEffect } from 'react';
import { ChartBarIcon, UsersIcon, ClockIcon, TrendingUpIcon } from '@heroicons/react/24/outline';
import { analyticsService, DashboardData, TimeRange } from '../../services/analytics.service';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ErrorAlert } from '../common/ErrorAlert';
import { ProjectAnalyticsView } from './ProjectAnalyticsView';
import { TeamAnalyticsView } from './TeamAnalyticsView';
import { UserAnalyticsView } from './UserAnalyticsView';
import { TimeRangeSelector } from './TimeRangeSelector';
import { MetricCard } from './MetricCard';

interface AnalyticsDashboardProps {
  projectId?: string;
  userId?: string;
  className?: string;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  projectId,
  userId,
  className = '',
}) => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange | undefined>();
  const [activeView, setActiveView] = useState<'overview' | 'project' | 'team' | 'user'>('overview');

  useEffect(() => {
    loadDashboardData();
  }, [projectId, userId, timeRange]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const _data = await analyticsService.getDashboardData(projectId);
      setDashboardData(data);
      
      // Set default view based on data type
      if (data.type === 'project') {
        setActiveView('project');
      } else {
        setActiveView('user');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleTimeRangeChange = (newTimeRange: TimeRange | undefined) => {
    setTimeRange(newTimeRange);
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className={className}>
        <ErrorAlert message={error} onRetry={loadDashboardData} />
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className={`text-center p-8 ${className}`}>
        <p className="text-gray-500">No analytics data available</p>
      </div>
    );
  }

  const renderOverview = () => {
    if (dashboardData.type === 'project' && dashboardData.project && dashboardData.team) {
      return (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              title="Completion Rate"
              value={`${dashboardData.project.completionRate.toFixed(1)}%`}
              icon={ChartBarIcon}
              trend={dashboardData.project.completionRate > 75 ? 'up' : 'down'}
              color="blue"
            />
            <MetricCard
              title="Team Size"
              value={dashboardData.team.teamSize.toString()}
              icon={UsersIcon}
              color="green"
            />
            <MetricCard
              title="Avg Quality Score"
              value={dashboardData.project.phaseMetrics
                .reduce((sum, p) => sum + p.averageQualityScore, 0)
                .toFixed(1)}
              icon={TrendingUpIcon}
              trend="up"
              color="purple"
            />
            <MetricCard
              title="Total Time"
              value={`${Math.round(dashboardData.project.totalTimeSpent / 3600)}h`}
              icon={ClockIcon}
              color="orange"
            />
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Analytics Views</h3>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setActiveView('project')}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Project Analytics
              </button>
              <button
                onClick={() => setActiveView('team')}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                Team Performance
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (dashboardData.type === 'user' && dashboardData.user) {
      return (
        <div className="space-y-6">
          {/* User Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              title="Total Projects"
              value={dashboardData.user.totalProjects.toString()}
              icon={ChartBarIcon}
              color="blue"
            />
            <MetricCard
              title="Completed"
              value={dashboardData.user.completedProjects.toString()}
              icon={TrendingUpIcon}
              color="green"
            />
            <MetricCard
              title="Avg Quality"
              value={dashboardData.user.averageQualityScore.toFixed(1)}
              icon={TrendingUpIcon}
              trend="up"
              color="purple"
            />
            <MetricCard
              title="Learning Progress"
              value={`${Math.round(
                (dashboardData.user.learningProgress.modulesCompleted /
                  dashboardData.user.learningProgress.totalModules) *
                  100
              )}%`}
              icon={ClockIcon}
              color="orange"
            />
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Your Analytics</h3>
            <button
              onClick={() => setActiveView('user')}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              View Detailed Analytics
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  const renderActiveView = () => {
    switch (activeView) {
      case 'project':
        return dashboardData.project ? (
          <ProjectAnalyticsView analytics={dashboardData.project} timeRange={timeRange} />
        ) : null;
      case 'team':
        return dashboardData.team ? (
          <TeamAnalyticsView analytics={dashboardData.team} timeRange={timeRange} />
        ) : null;
      case 'user':
        return dashboardData.user ? (
          <UserAnalyticsView analytics={dashboardData.user} timeRange={timeRange} />
        ) : null;
      case 'overview':
      default:
        return renderOverview();
    }
  };

  return (
    <div className={className}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
            <p className="text-gray-600 mt-1">
              {dashboardData.type === 'project'
                ? 'Project and team performance insights'
                : 'Your personal development insights'}
            </p>
          </div>
          <TimeRangeSelector value={timeRange} onChange={handleTimeRangeChange} />
        </div>

        {/* Navigation */}
        {activeView !== 'overview' && (
          <div className="mt-4">
            <nav className="flex space-x-4">
              <button
                onClick={() => setActiveView('overview')}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeView === 'overview'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Overview
              </button>
              {dashboardData.project && (
                <button
                  onClick={() => setActiveView('project')}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeView === 'project'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Project
                </button>
              )}
              {dashboardData.team && (
                <button
                  onClick={() => setActiveView('team')}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeView === 'team'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Team
                </button>
              )}
              {dashboardData.user && (
                <button
                  onClick={() => setActiveView('user')}
                  className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeView === 'user'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Personal
                </button>
              )}
            </nav>
          </div>
        )}
      </div>

      {/* Content */}
      {renderActiveView()}
    </div>
  );
};