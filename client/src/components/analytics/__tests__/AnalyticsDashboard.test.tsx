import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MockedFunction } from 'vitest';
import { AnalyticsDashboard } from '../AnalyticsDashboard';
import type { AnalyticsDashboardProps } from '../AnalyticsDashboard';
import { analyticsService } from '../../../services/analytics.service';

// Mock the analytics service with proper typing
const mockGetDashboardData = vi.fn() as MockedFunction<typeof analyticsService.getDashboardData>;

vi.mock('../../../services/analytics.service', () => ({
  analyticsService: {
    getDashboardData: mockGetDashboardData,
  },
}));

// Mock the child components with proper prop types
interface ProjectAnalyticsProps {
  analytics: { projectId: string };
}

interface TeamAnalyticsProps {
  analytics: { projectId: string };
}

interface UserAnalyticsProps {
  analytics: { userId: string };
}

interface TimeRangeSelectorProps {
  onChange: (range: { start: string; end: string }) => void;
}

interface MetricCardProps {
  title: string;
  value: string | number;
}

vi.mock('../ProjectAnalyticsView', () => ({
  ProjectAnalyticsView: ({ analytics }: ProjectAnalyticsProps) => (
    <div data-testid="project-analytics-view">Project Analytics: {analytics.projectId}</div>
  ),
}));

vi.mock('../TeamAnalyticsView', () => ({
  TeamAnalyticsView: ({ analytics }: TeamAnalyticsProps) => (
    <div data-testid="team-analytics-view">Team Analytics: {analytics.projectId}</div>
  ),
}));

vi.mock('../UserAnalyticsView', () => ({
  UserAnalyticsView: ({ analytics }: UserAnalyticsProps) => (
    <div data-testid="user-analytics-view">User Analytics: {analytics.userId}</div>
  ),
}));

vi.mock('../TimeRangeSelector', () => ({
  TimeRangeSelector: ({ onChange }: TimeRangeSelectorProps) => (
    <button onClick={() => onChange({ start: '2024-01-01', end: '2024-01-31' })}>
      Time Range Selector
    </button>
  ),
}));

vi.mock('../MetricCard', () => ({
  MetricCard: ({ title, value }: MetricCardProps) => (
    <div data-testid="metric-card">
      {title}: {value}
    </div>
  ),
}));

describe('AnalyticsDashboard', () => {
  const mockProjectDashboardData = {
    type: 'project' as const,
    projectId: 'project-1',
    project: {
      projectId: 'project-1',
      totalTimeSpent: 7200,
      phaseMetrics: [
        {
          phase: 'REQUIREMENTS' as const,
          averageTimeSpent: 1800,
          completionRate: 100,
          averageQualityScore: 85,
          reviewCycles: 2,
        },
      ],
      qualityTrend: [],
      collaborationMetrics: {
        averageCollaborators: 3,
        totalComments: 10,
        averageResponseTime: 24,
        collaborationScore: 75,
      },
      completionRate: 75,
      averageReviewCycles: 2,
    },
    team: {
      projectId: 'project-1',
      period: 'current',
      teamSize: 5,
      projectsCompleted: 2,
      averageQualityScore: 85,
      averageCompletionTime: 48,
      methodologyAdoption: 80,
      skillDevelopment: [],
      performanceTrends: [],
    },
  };

  const mockUserDashboardData = {
    type: 'user' as const,
    userId: 'user-1',
    user: {
      userId: 'user-1',
      totalProjects: 5,
      completedProjects: 3,
      averageQualityScore: 82,
      skillLevels: [],
      activitySummary: {
        totalActivities: 50,
        dailyAverage: 2.5,
        mostActiveHours: [14],
        activityBreakdown: {},
      },
      learningProgress: {
        modulesCompleted: 3,
        totalModules: 5,
        averageScore: 85,
        timeSpent: 180,
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDashboardData.mockClear();
  });

  it('should render loading state initially', () => {
    mockGetDashboardData.mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    const props: AnalyticsDashboardProps = {};
    render(<AnalyticsDashboard {...props} />);

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('should render error state when data loading fails', async () => {
    mockGetDashboardData.mockRejectedValue(
      new Error('Failed to load data')
    );

    const props: AnalyticsDashboardProps = {};
    render(<AnalyticsDashboard {...props} />);

    await waitFor(() => {
      expect(screen.getByText((content, element) => {
        return element?.textContent?.includes('Failed to load data') || false;
      })).toBeInTheDocument();
    });
  });

  it('should render project dashboard overview', async () => {
    mockGetDashboardData.mockResolvedValue(mockProjectDashboardData);

    const props: AnalyticsDashboardProps = { projectId: 'project-1' };
    render(<AnalyticsDashboard {...props} />);

    await waitFor(() => {
      expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Project and team performance insights')).toBeInTheDocument();
    });

    // Should show metric cards
    expect(screen.getAllByTestId('metric-card')).toHaveLength(4);
    
    // Should show navigation buttons
    expect(screen.getByText('Project Analytics')).toBeInTheDocument();
    expect(screen.getByText('Team Performance')).toBeInTheDocument();
  });

  it('should render user dashboard overview', async () => {
    mockGetDashboardData.mockResolvedValue(mockUserDashboardData);

    const props: AnalyticsDashboardProps = {};
    render(<AnalyticsDashboard {...props} />);

    await waitFor(() => {
      expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Your personal development insights')).toBeInTheDocument();
    });

    // Should show user metric cards
    expect(screen.getAllByTestId('metric-card')).toHaveLength(4);
    
    // Should show user analytics button
    expect(screen.getByText('View Detailed Analytics')).toBeInTheDocument();
  });

  it('should navigate to project analytics view', async () => {
    mockGetDashboardData.mockResolvedValue(mockProjectDashboardData);

    const props: AnalyticsDashboardProps = { projectId: 'project-1' };
    render(<AnalyticsDashboard {...props} />);

    await waitFor(() => {
      expect(screen.getByTestId('project-analytics-view')).toBeInTheDocument();
    });

    expect(screen.getByText('Project Analytics: project-1')).toBeInTheDocument();
  });

  it('should navigate to team analytics view', async () => {
    const user = userEvent.setup();
    mockGetDashboardData.mockResolvedValue(mockProjectDashboardData);

    const props: AnalyticsDashboardProps = { projectId: 'project-1' };
    render(<AnalyticsDashboard {...props} />);

    await waitFor(() => {
      expect(screen.getByText('Team')).toBeInTheDocument();
    });

    const teamButton = screen.getByText('Team');
    await user.click(teamButton);

    expect(screen.getByTestId('team-analytics-view')).toBeInTheDocument();
    expect(screen.getByText('Team Analytics: project-1')).toBeInTheDocument();
  });

  it('should navigate to user analytics view', async () => {
    mockGetDashboardData.mockResolvedValue(mockUserDashboardData);

    const props: AnalyticsDashboardProps = {};
    render(<AnalyticsDashboard {...props} />);

    await waitFor(() => {
      expect(screen.getByTestId('user-analytics-view')).toBeInTheDocument();
    });

    expect(screen.getByText('User Analytics: user-1')).toBeInTheDocument();
  });

  it('should handle time range changes', async () => {
    const user = userEvent.setup();
    mockGetDashboardData.mockResolvedValue(mockProjectDashboardData);

    const props: AnalyticsDashboardProps = { projectId: 'project-1' };
    render(<AnalyticsDashboard {...props} />);

    await waitFor(() => {
      expect(screen.getByText('Time Range Selector')).toBeInTheDocument();
    });

    const timeRangeButton = screen.getByText('Time Range Selector');
    await user.click(timeRangeButton);

    // Should trigger a reload with new time range
    await waitFor(() => {
      expect(mockGetDashboardData).toHaveBeenCalledTimes(2);
    });
  });

  it('should show navigation tabs when not in overview', async () => {
    mockGetDashboardData.mockResolvedValue(mockProjectDashboardData);

    const props: AnalyticsDashboardProps = { projectId: 'project-1' };
    render(<AnalyticsDashboard {...props} />);

    await waitFor(() => {
      expect(screen.getByTestId('project-analytics-view')).toBeInTheDocument();
    });

    // Should show navigation tabs
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Project')).toBeInTheDocument();
    expect(screen.getByText('Team')).toBeInTheDocument();
  });

  it('should handle empty dashboard data', async () => {
    mockGetDashboardData.mockResolvedValue(null);

    const props: AnalyticsDashboardProps = {};
    render(<AnalyticsDashboard {...props} />);

    await waitFor(() => {
      expect(screen.getByText((content, element) => {
        return element?.textContent?.includes('Cannot read properties of null') || false;
      })).toBeInTheDocument();
    });
  });

  it('should retry loading data when retry button is clicked', async () => {
    const user = userEvent.setup();
    mockGetDashboardData
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(mockUserDashboardData);

    const props: AnalyticsDashboardProps = {};
    render(<AnalyticsDashboard {...props} />);

    await waitFor(() => {
      expect(screen.getAllByText((content, element) => {
        return element?.textContent?.includes('Network error') || false;
      })[0]).toBeInTheDocument();
    });

    const retryButton = screen.getByText('Retry');
    await user.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
    });

    expect(mockGetDashboardData).toHaveBeenCalledTimes(2);
  });
});