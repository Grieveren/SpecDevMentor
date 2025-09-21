import { BaseService, typedApiClient } from './api.service';

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

class AnalyticsService extends BaseService {
  constructor() {
    super(typedApiClient);
  }

  // Activity tracking
  async trackActivity(data: TrackActivityRequest): Promise<void> {
    try {
      const response = await this.apiClient.post<void>('/analytics/activity', data);
      this.validateResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async trackWorkflowProgress(data: TrackWorkflowProgressRequest): Promise<void> {
    try {
      const response = await this.apiClient.post<void>('/analytics/workflow-progress', data);
      this.validateResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Analytics retrieval
  async getProjectAnalytics(projectId: string, timeRange?: TimeRange): Promise<ProjectAnalytics> {
    try {
      const params = timeRange ? { start: timeRange.start, end: timeRange.end } : {};
      const response = await this.apiClient.get<ProjectAnalytics>(`/analytics/projects/${projectId}`, { params });
      return this.validateResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getTeamAnalytics(projectId: string, timeRange?: TimeRange): Promise<TeamAnalytics> {
    try {
      const params = timeRange ? { start: timeRange.start, end: timeRange.end } : {};
      const response = await this.apiClient.get<TeamAnalytics>(`/analytics/teams/${projectId}`, { params });
      return this.validateResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getUserAnalytics(userId?: string, timeRange?: TimeRange): Promise<UserAnalytics> {
    try {
      const params = timeRange ? { start: timeRange.start, end: timeRange.end } : {};
      const endpoint = userId ? `/analytics/users/${userId}` : '/analytics/users';
      const response = await this.apiClient.get<UserAnalytics>(endpoint, { params });
      return this.validateResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Performance metrics
  async calculateTeamPerformanceMetrics(
    projectId: string,
    period: 'daily' | 'weekly' | 'monthly'
  ): Promise<TeamPerformanceMetrics> {
    try {
      const response = await this.apiClient.post<TeamPerformanceMetrics>(`/analytics/teams/${projectId}/performance`, { period });
      return this.validateResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async calculateSkillDevelopment(userId?: string): Promise<SkillDevelopmentMetrics[]> {
    try {
      const endpoint = userId ? `/analytics/users/${userId}/skills` : '/analytics/users/skills';
      const response = await this.apiClient.post<SkillDevelopmentMetrics[]>(endpoint);
      return this.validateResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Dashboard data
  async getDashboardData(projectId?: string): Promise<DashboardData> {
    try {
      const endpoint = projectId ? `/analytics/dashboard/${projectId}` : '/analytics/dashboard';
      const response = await this.apiClient.get<DashboardData>(endpoint);
      return this.validateResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Real-time metrics
  async getRealTimeMetrics(): Promise<RealTimeMetrics> {
    try {
      const response = await this.apiClient.get<RealTimeMetrics>('/analytics/realtime');
      return this.validateResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // System performance (admin only)
  async getSystemPerformanceMetrics(
    metricType?: string,
    timeRange?: TimeRange,
    limit?: number
  ): Promise<SystemPerformanceMetric[]> {
    try {
      const params: Record<string, string> = {};
      if (metricType) params.metricType = metricType;
      if (timeRange) {
        params.start = timeRange.start;
        params.end = timeRange.end;
      }
      if (limit) params.limit = limit.toString();

      const response = await this.apiClient.get<SystemPerformanceMetric[]>('/analytics/system/performance', { params });
      return this.validateResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Aggregation trigger (admin only)
  async triggerMetricsAggregation(period: 'daily' | 'weekly' | 'monthly'): Promise<void> {
    try {
      const response = await this.apiClient.post<void>('/analytics/aggregate', { period });
      this.validateResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }
}

export const analyticsService = new AnalyticsService();