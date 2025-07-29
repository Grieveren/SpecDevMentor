import { apiClient } from './api.service';

export interface ProjectAnalytics {
  projectId: string;
  totalTimeSpent: number;
  phaseMetrics: PhaseMetrics[];
  qualityTrend: QualityTrend[];
  collaborationMetrics: CollaborationMetrics;
  completionRate: number;
  averageReviewCycles: number;
}

export interface PhaseMetrics {
  phase: 'REQUIREMENTS' | 'DESIGN' | 'TASKS' | 'IMPLEMENTATION';
  averageTimeSpent: number;
  completionRate: number;
  averageQualityScore: number;
  reviewCycles: number;
}

export interface QualityTrend {
  date: string;
  phase: 'REQUIREMENTS' | 'DESIGN' | 'TASKS' | 'IMPLEMENTATION';
  score: number;
}

export interface CollaborationMetrics {
  averageCollaborators: number;
  totalComments: number;
  averageResponseTime: number;
  collaborationScore: number;
}

export interface TeamAnalytics {
  projectId: string;
  period: string;
  teamSize: number;
  projectsCompleted: number;
  averageQualityScore: number;
  averageCompletionTime: number;
  methodologyAdoption: number;
  skillDevelopment: SkillDevelopmentSummary[];
  performanceTrends: PerformanceTrend[];
}

export interface SkillDevelopmentSummary {
  skillArea: string;
  averageLevel: number;
  improvement: number;
  teamMembersAssessed: number;
}

export interface PerformanceTrend {
  date: string;
  metric: string;
  value: number;
}

export interface UserAnalytics {
  userId: string;
  totalProjects: number;
  completedProjects: number;
  averageQualityScore: number;
  skillLevels: SkillLevel[];
  activitySummary: ActivitySummary;
  learningProgress: LearningProgress;
}

export interface SkillLevel {
  skillArea: string;
  currentLevel: number;
  improvement: number;
  lastAssessment: string;
}

export interface ActivitySummary {
  totalActivities: number;
  dailyAverage: number;
  mostActiveHours: number[];
  activityBreakdown: Record<string, number>;
}

export interface LearningProgress {
  modulesCompleted: number;
  totalModules: number;
  averageScore: number;
  timeSpent: number;
}

export interface TeamPerformanceMetrics {
  projectId: string;
  period: string;
  periodStart: string;
  periodEnd: string;
  projectsCompleted: number;
  averageQualityScore: number;
  averageCompletionTime: number;
  collaborationScore: number;
  methodologyAdoption: number;
  metrics: Record<string, any>;
}

export interface SkillDevelopmentMetrics {
  userId: string;
  phase?: 'REQUIREMENTS' | 'DESIGN' | 'TASKS' | 'IMPLEMENTATION';
  skillArea: string;
  currentLevel: number;
  previousLevel?: number;
  improvement?: number;
  assessmentDate: string;
  assessmentType: string;
  evidence: Record<string, any>;
}

export interface DashboardData {
  type: 'project' | 'user';
  projectId?: string;
  userId?: string;
  project?: ProjectAnalytics;
  team?: TeamAnalytics;
  user?: UserAnalytics;
}

export interface RealTimeMetrics {
  [key: string]: number;
}

export interface SystemPerformanceMetric {
  id: string;
  metricType: string;
  value: number;
  unit: string;
  tags: Record<string, any>;
  timestamp: string;
}

export interface TrackActivityRequest {
  action: string;
  resource: string;
  resourceId: string;
  metadata?: Record<string, any>;
  duration?: number;
  sessionId?: string;
}

export interface TrackWorkflowProgressRequest {
  projectId: string;
  phase: 'REQUIREMENTS' | 'DESIGN' | 'TASKS' | 'IMPLEMENTATION';
  action: 'started' | 'completed' | 'review_cycle' | 'quality_updated';
  qualityScore?: number;
  collaboratorCount?: number;
  commentCount?: number;
  revisionCount?: number;
  aiSuggestionsApplied?: number;
}

export interface TimeRange {
  start: string;
  end: string;
}

class AnalyticsService {
  // Activity tracking
  async trackActivity(_data: TrackActivityRequest): Promise<void> {
    await apiClient.post('/analytics/activity', data);
  }

  async trackWorkflowProgress(_data: TrackWorkflowProgressRequest): Promise<void> {
    await apiClient.post('/analytics/workflow-progress', data);
  }

  // Analytics retrieval
  async getProjectAnalytics(projectId: string, timeRange?: TimeRange): Promise<ProjectAnalytics> {
    const params = timeRange ? { start: timeRange.start, end: timeRange.end } : {};
    const _response = await apiClient.get(`/analytics/projects/${projectId}`, { params });
    return response.data;
  }

  async getTeamAnalytics(projectId: string, timeRange?: TimeRange): Promise<TeamAnalytics> {
    const params = timeRange ? { start: timeRange.start, end: timeRange.end } : {};
    const _response = await apiClient.get(`/analytics/teams/${projectId}`, { params });
    return response.data;
  }

  async getUserAnalytics(userId?: string, timeRange?: TimeRange): Promise<UserAnalytics> {
    const params = timeRange ? { start: timeRange.start, end: timeRange.end } : {};
    const endpoint = userId ? `/analytics/users/${userId}` : '/analytics/users';
    const _response = await apiClient.get(endpoint, { params });
    return response.data;
  }

  // Performance metrics
  async calculateTeamPerformanceMetrics(
    projectId: string,
    period: 'daily' | 'weekly' | 'monthly'
  ): Promise<TeamPerformanceMetrics> {
    const _response = await apiClient.post(`/analytics/teams/${projectId}/performance`, { period });
    return response.data;
  }

  async calculateSkillDevelopment(userId?: string): Promise<SkillDevelopmentMetrics[]> {
    const endpoint = userId ? `/analytics/users/${userId}/skills` : '/analytics/users/skills';
    const _response = await apiClient.post(endpoint);
    return response.data;
  }

  // Dashboard data
  async getDashboardData(projectId?: string): Promise<DashboardData> {
    const endpoint = projectId ? `/analytics/dashboard/${projectId}` : '/analytics/dashboard';
    const _response = await apiClient.get(endpoint);
    return response.data;
  }

  // Real-time metrics
  async getRealTimeMetrics(): Promise<RealTimeMetrics> {
    const _response = await apiClient.get('/analytics/realtime');
    return response.data;
  }

  // System performance (admin only)
  async getSystemPerformanceMetrics(
    metricType?: string,
    timeRange?: TimeRange,
    limit?: number
  ): Promise<SystemPerformanceMetric[]> {
    const params: unknown = {};
    if (metricType) params.metricType = metricType;
    if (timeRange) {
      params.start = timeRange.start;
      params.end = timeRange.end;
    }
    if (limit) params.limit = limit;

    const _response = await apiClient.get('/analytics/system/performance', { params });
    return response.data;
  }

  // Aggregation trigger (admin only)
  async triggerMetricsAggregation(period: 'daily' | 'weekly' | 'monthly'): Promise<void> {
    await apiClient.post('/analytics/aggregate', { period });
  }
}

export const analyticsService = new AnalyticsService();