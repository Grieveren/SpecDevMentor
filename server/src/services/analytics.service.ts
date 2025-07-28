import { PrismaClient, ActivityType, SpecificationPhase, UserRole } from '@prisma/client';
import { Redis } from 'ioredis';

interface AnalyticsService {
  trackUserActivity(data: TrackActivityData): Promise<void>;
  trackWorkflowProgress(data: WorkflowProgressData): Promise<void>;
  calculateTeamPerformanceMetrics(projectId: string, period: string): Promise<TeamPerformanceMetrics>;
  calculateSkillDevelopment(userId: string): Promise<SkillDevelopmentMetrics[]>;
  getProjectAnalytics(projectId: string, timeRange?: TimeRange): Promise<ProjectAnalytics>;
  getTeamAnalytics(projectId: string, timeRange?: TimeRange): Promise<TeamAnalytics>;
  getUserAnalytics(userId: string, timeRange?: TimeRange): Promise<UserAnalytics>;
  aggregateMetrics(period: 'daily' | 'weekly' | 'monthly'): Promise<void>;
}

interface TrackActivityData {
  userId: string;
  action: ActivityType;
  resource: string;
  resourceId: string;
  metadata?: Record<string, any>;
  duration?: number;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
}

interface WorkflowProgressData {
  projectId: string;
  userId: string;
  phase: SpecificationPhase;
  action: 'started' | 'completed' | 'review_cycle' | 'quality_updated';
  qualityScore?: number;
  collaboratorCount?: number;
  commentCount?: number;
  revisionCount?: number;
  aiSuggestionsApplied?: number;
}

interface TimeRange {
  start: Date;
  end: Date;
}

interface ProjectAnalytics {
  projectId: string;
  totalTimeSpent: number;
  phaseMetrics: PhaseMetrics[];
  qualityTrend: QualityTrend[];
  collaborationMetrics: CollaborationMetrics;
  completionRate: number;
  averageReviewCycles: number;
}

interface PhaseMetrics {
  phase: SpecificationPhase;
  averageTimeSpent: number;
  completionRate: number;
  averageQualityScore: number;
  reviewCycles: number;
}

interface QualityTrend {
  date: Date;
  phase: SpecificationPhase;
  score: number;
}

interface CollaborationMetrics {
  averageCollaborators: number;
  totalComments: number;
  averageResponseTime: number;
  collaborationScore: number;
}

interface TeamAnalytics {
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

interface UserAnalytics {
  userId: string;
  totalProjects: number;
  completedProjects: number;
  averageQualityScore: number;
  skillLevels: SkillLevel[];
  activitySummary: ActivitySummary;
  learningProgress: LearningProgress;
}

interface SkillLevel {
  skillArea: string;
  currentLevel: number;
  improvement: number;
  lastAssessment: Date;
}

interface ActivitySummary {
  totalActivities: number;
  dailyAverage: number;
  mostActiveHours: number[];
  activityBreakdown: Record<ActivityType, number>;
}

interface LearningProgress {
  modulesCompleted: number;
  totalModules: number;
  averageScore: number;
  timeSpent: number;
}

interface TeamPerformanceMetrics {
  projectId: string;
  period: string;
  periodStart: Date;
  periodEnd: Date;
  projectsCompleted: number;
  averageQualityScore: number;
  averageCompletionTime: number;
  collaborationScore: number;
  methodologyAdoption: number;
  metrics: Record<string, any>;
}

interface SkillDevelopmentMetrics {
  userId: string;
  phase?: SpecificationPhase;
  skillArea: string;
  currentLevel: number;
  previousLevel?: number;
  improvement?: number;
  assessmentDate: Date;
  assessmentType: string;
  evidence: Record<string, any>;
}

interface SkillDevelopmentSummary {
  skillArea: string;
  averageLevel: number;
  improvement: number;
  teamMembersAssessed: number;
}

interface PerformanceTrend {
  date: Date;
  metric: string;
  value: number;
}

export class AnalyticsServiceImpl implements AnalyticsService {
  constructor(
    private prisma: PrismaClient,
    private redis: Redis
  ) {}

  async trackUserActivity(data: TrackActivityData): Promise<void> {
    try {
      await this.prisma.userActivity.create({
        data: {
          userId: data.userId,
          action: data.action,
          resource: data.resource,
          resourceId: data.resourceId,
          metadata: data.metadata || {},
          duration: data.duration,
          sessionId: data.sessionId,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
        },
      });

      // Update real-time metrics in Redis
      await this.updateRealTimeMetrics(data);
    } catch (error) {
      console.error('Failed to track user activity:', error);
      // Don't throw - analytics shouldn't break the main flow
    }
  }

  async trackWorkflowProgress(data: WorkflowProgressData): Promise<void> {
    try {
      const existingMetric = await this.prisma.workflowMetrics.findUnique({
        where: {
          projectId_phase_userId: {
            projectId: data.projectId,
            phase: data.phase,
            userId: data.userId,
          },
        },
      });

      if (existingMetric) {
        const updateData: any = {};

        switch (data.action) {
          case 'completed':
            updateData.completedAt = new Date();
            updateData.timeSpent = existingMetric.startedAt
              ? Math.floor((Date.now() - existingMetric.startedAt.getTime()) / 1000)
              : undefined;
            break;
          case 'review_cycle':
            updateData.reviewCycles = existingMetric.reviewCycles + 1;
            break;
          case 'quality_updated':
            updateData.qualityScore = data.qualityScore;
            break;
        }

        if (data.collaboratorCount !== undefined) {
          updateData.collaboratorCount = data.collaboratorCount;
        }
        if (data.commentCount !== undefined) {
          updateData.commentCount = data.commentCount;
        }
        if (data.revisionCount !== undefined) {
          updateData.revisionCount = data.revisionCount;
        }
        if (data.aiSuggestionsApplied !== undefined) {
          updateData.aiSuggestionsApplied = data.aiSuggestionsApplied;
        }

        await this.prisma.workflowMetrics.update({
          where: {
            projectId_phase_userId: {
              projectId: data.projectId,
              phase: data.phase,
              userId: data.userId,
            },
          },
          data: updateData,
        });
      } else if (data.action === 'started') {
        await this.prisma.workflowMetrics.create({
          data: {
            projectId: data.projectId,
            userId: data.userId,
            phase: data.phase,
            startedAt: new Date(),
            qualityScore: data.qualityScore,
            collaboratorCount: data.collaboratorCount || 0,
            commentCount: data.commentCount || 0,
            revisionCount: data.revisionCount || 0,
            aiSuggestionsApplied: data.aiSuggestionsApplied || 0,
          },
        });
      }
    } catch (error) {
      console.error('Failed to track workflow progress:', error);
    }
  }

  async calculateTeamPerformanceMetrics(
    projectId: string,
    period: string
  ): Promise<TeamPerformanceMetrics> {
    const { periodStart, periodEnd } = this.getPeriodRange(period);

    // Get workflow metrics for the period
    const workflowMetrics = await this.prisma.workflowMetrics.findMany({
      where: {
        projectId,
        startedAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
      include: {
        user: true,
      },
    });

    // Calculate metrics
    const completedProjects = workflowMetrics.filter(m => m.completedAt).length;
    const averageQualityScore = workflowMetrics.reduce((sum, m) => sum + (m.qualityScore || 0), 0) / workflowMetrics.length;
    const averageCompletionTime = this.calculateAverageCompletionTime(workflowMetrics);
    const collaborationScore = this.calculateCollaborationScore(workflowMetrics);
    const methodologyAdoption = this.calculateMethodologyAdoption(workflowMetrics);

    const metrics = {
      projectId,
      period,
      periodStart,
      periodEnd,
      projectsCompleted: completedProjects,
      averageQualityScore: averageQualityScore || 0,
      averageCompletionTime,
      collaborationScore,
      methodologyAdoption,
      metrics: {
        totalWorkflowsStarted: workflowMetrics.length,
        averageReviewCycles: workflowMetrics.reduce((sum, m) => sum + m.reviewCycles, 0) / workflowMetrics.length,
        totalAISuggestionsApplied: workflowMetrics.reduce((sum, m) => sum + m.aiSuggestionsApplied, 0),
        totalComments: workflowMetrics.reduce((sum, m) => sum + m.commentCount, 0),
      },
    };

    // Store the calculated metrics
    await this.prisma.teamPerformanceMetrics.upsert({
      where: {
        projectId_period_periodStart: {
          projectId,
          period,
          periodStart,
        },
      },
      update: metrics,
      create: metrics,
    });

    return metrics;
  }

  async calculateSkillDevelopment(userId: string): Promise<SkillDevelopmentMetrics[]> {
    // Get recent AI reviews and assessments
    const recentReviews = await this.prisma.aIReview.findMany({
      where: {
        document: {
          project: {
            OR: [
              { ownerId: userId },
              { team: { some: { userId } } },
            ],
          },
        },
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
      include: {
        document: {
          include: {
            project: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Get user progress data
    const userProgress = await this.prisma.userProgress.findMany({
      where: { userId },
      include: {
        module: true,
      },
    });

    // Calculate skill levels based on various data sources
    const skillAreas = ['requirements', 'design', 'tasks', 'collaboration', 'quality'];
    const skillMetrics: SkillDevelopmentMetrics[] = [];

    for (const skillArea of skillAreas) {
      const currentLevel = await this.calculateSkillLevel(userId, skillArea, recentReviews, userProgress);
      const previousLevel = await this.getPreviousSkillLevel(userId, skillArea);

      const metric: SkillDevelopmentMetrics = {
        userId,
        skillArea,
        currentLevel,
        previousLevel,
        improvement: previousLevel ? currentLevel - previousLevel : undefined,
        assessmentDate: new Date(),
        assessmentType: 'ai_review',
        evidence: {
          reviewCount: recentReviews.length,
          averageQualityScore: recentReviews.reduce((sum, r) => sum + r.overallScore, 0) / recentReviews.length,
          completedModules: userProgress.filter(p => p.status === 'COMPLETED').length,
        },
      };

      skillMetrics.push(metric);

      // Store the skill metric
      await this.prisma.skillDevelopmentMetrics.create({
        data: metric,
      });
    }

    return skillMetrics;
  }

  async getProjectAnalytics(projectId: string, timeRange?: TimeRange): Promise<ProjectAnalytics> {
    const whereClause = timeRange
      ? {
          projectId,
          startedAt: {
            gte: timeRange.start,
            lte: timeRange.end,
          },
        }
      : { projectId };

    const workflowMetrics = await this.prisma.workflowMetrics.findMany({
      where: whereClause,
      include: {
        user: true,
      },
    });

    const totalTimeSpent = workflowMetrics.reduce((sum, m) => sum + (m.timeSpent || 0), 0);
    const phaseMetrics = this.calculatePhaseMetrics(workflowMetrics);
    const qualityTrend = await this.calculateQualityTrend(projectId, timeRange);
    const collaborationMetrics = await this.calculateCollaborationMetrics(projectId, timeRange);
    const completionRate = this.calculateCompletionRate(workflowMetrics);
    const averageReviewCycles = workflowMetrics.reduce((sum, m) => sum + m.reviewCycles, 0) / workflowMetrics.length;

    return {
      projectId,
      totalTimeSpent,
      phaseMetrics,
      qualityTrend,
      collaborationMetrics,
      completionRate,
      averageReviewCycles,
    };
  }

  async getTeamAnalytics(projectId: string, timeRange?: TimeRange): Promise<TeamAnalytics> {
    const project = await this.prisma.specificationProject.findUnique({
      where: { id: projectId },
      include: {
        team: {
          include: {
            user: true,
          },
        },
        workflowMetrics: timeRange
          ? {
              where: {
                startedAt: {
                  gte: timeRange.start,
                  lte: timeRange.end,
                },
              },
            }
          : undefined,
        teamPerformanceMetrics: {
          orderBy: {
            periodStart: 'desc',
          },
          take: 1,
        },
      },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    const teamSize = project.team.length + 1; // Include owner
    const latestMetrics = project.teamPerformanceMetrics[0];

    // Calculate skill development for team members
    const skillDevelopment: SkillDevelopmentSummary[] = [];
    const skillAreas = ['requirements', 'design', 'tasks', 'collaboration', 'quality'];

    for (const skillArea of skillAreas) {
      const teamSkillMetrics = await this.prisma.skillDevelopmentMetrics.findMany({
        where: {
          skillArea,
          userId: {
            in: [project.ownerId, ...project.team.map(t => t.userId)],
          },
          assessmentDate: timeRange
            ? {
                gte: timeRange.start,
                lte: timeRange.end,
              }
            : {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
              },
        },
      });

      if (teamSkillMetrics.length > 0) {
        skillDevelopment.push({
          skillArea,
          averageLevel: teamSkillMetrics.reduce((sum, m) => sum + m.currentLevel, 0) / teamSkillMetrics.length,
          improvement: teamSkillMetrics.reduce((sum, m) => sum + (m.improvement || 0), 0) / teamSkillMetrics.length,
          teamMembersAssessed: teamSkillMetrics.length,
        });
      }
    }

    // Get performance trends
    const performanceTrends = await this.getPerformanceTrends(projectId, timeRange);

    return {
      projectId,
      period: 'current',
      teamSize,
      projectsCompleted: latestMetrics?.projectsCompleted || 0,
      averageQualityScore: latestMetrics?.averageQualityScore || 0,
      averageCompletionTime: latestMetrics?.averageCompletionTime || 0,
      methodologyAdoption: latestMetrics?.methodologyAdoption || 0,
      skillDevelopment,
      performanceTrends,
    };
  }

  async getUserAnalytics(userId: string, timeRange?: TimeRange): Promise<UserAnalytics> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        ownedProjects: true,
        teamMemberships: {
          include: {
            project: true,
          },
        },
        activities: timeRange
          ? {
              where: {
                createdAt: {
                  gte: timeRange.start,
                  lte: timeRange.end,
                },
              },
            }
          : {
              where: {
                createdAt: {
                  gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                },
              },
            },
        userProgress: {
          include: {
            module: true,
          },
        },
        workflowMetrics: timeRange
          ? {
              where: {
                startedAt: {
                  gte: timeRange.start,
                  lte: timeRange.end,
                },
              },
            }
          : undefined,
        skillMetrics: {
          orderBy: {
            assessmentDate: 'desc',
          },
          take: 50,
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const totalProjects = user.ownedProjects.length + user.teamMemberships.length;
    const completedProjects = user.workflowMetrics?.filter(m => m.completedAt).length || 0;
    const averageQualityScore = user.workflowMetrics?.length
      ? user.workflowMetrics.reduce((sum, m) => sum + (m.qualityScore || 0), 0) / user.workflowMetrics.length
      : 0;

    // Calculate skill levels
    const skillLevels: SkillLevel[] = [];
    const skillAreas = ['requirements', 'design', 'tasks', 'collaboration', 'quality'];

    for (const skillArea of skillAreas) {
      const latestMetric = user.skillMetrics.find(m => m.skillArea === skillArea);
      if (latestMetric) {
        skillLevels.push({
          skillArea,
          currentLevel: latestMetric.currentLevel,
          improvement: latestMetric.improvement || 0,
          lastAssessment: latestMetric.assessmentDate,
        });
      }
    }

    // Calculate activity summary
    const activityBreakdown: Record<ActivityType, number> = {} as any;
    user.activities.forEach(activity => {
      activityBreakdown[activity.action] = (activityBreakdown[activity.action] || 0) + 1;
    });

    const activitySummary: ActivitySummary = {
      totalActivities: user.activities.length,
      dailyAverage: user.activities.length / 30, // Assuming 30-day period
      mostActiveHours: this.calculateMostActiveHours(user.activities),
      activityBreakdown,
    };

    // Calculate learning progress
    const completedModules = user.userProgress.filter(p => p.status === 'COMPLETED').length;
    const totalModules = user.userProgress.length;
    const averageScore = user.userProgress.length
      ? user.userProgress.reduce((sum, p) => {
          const results = Array.isArray(p.exerciseResults) ? p.exerciseResults as any[] : [];
          const scores = results.map((r: any) => r.score || 0);
          return sum + (scores.length ? scores.reduce((s, score) => s + score, 0) / scores.length : 0);
        }, 0) / user.userProgress.length
      : 0;

    const learningProgress: LearningProgress = {
      modulesCompleted: completedModules,
      totalModules,
      averageScore,
      timeSpent: user.userProgress.reduce((sum, p) => {
        const module = p.module;
        return sum + (p.status === 'COMPLETED' ? module.estimatedDuration : 0);
      }, 0),
    };

    return {
      userId,
      totalProjects,
      completedProjects,
      averageQualityScore,
      skillLevels,
      activitySummary,
      learningProgress,
    };
  }

  async aggregateMetrics(period: 'daily' | 'weekly' | 'monthly'): Promise<void> {
    const projects = await this.prisma.specificationProject.findMany({
      where: {
        status: 'ACTIVE',
      },
    });

    for (const project of projects) {
      await this.calculateTeamPerformanceMetrics(project.id, period);
    }

    // Aggregate system-wide metrics
    await this.aggregateSystemMetrics(period);
  }

  // Private helper methods
  private async updateRealTimeMetrics(data: TrackActivityData): Promise<void> {
    const key = `analytics:realtime:${data.action}`;
    await this.redis.incr(key);
    await this.redis.expire(key, 3600); // Expire after 1 hour
  }

  private getPeriodRange(period: string): { periodStart: Date; periodEnd: Date } {
    const now = new Date();
    let periodStart: Date;
    let periodEnd: Date = now;

    switch (period) {
      case 'daily':
        periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'weekly':
        const dayOfWeek = now.getDay();
        periodStart = new Date(now.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
        periodStart.setHours(0, 0, 0, 0);
        break;
      case 'monthly':
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    return { periodStart, periodEnd };
  }

  private calculateAverageCompletionTime(metrics: any[]): number {
    const completedMetrics = metrics.filter(m => m.completedAt && m.startedAt);
    if (completedMetrics.length === 0) return 0;

    const totalTime = completedMetrics.reduce((sum, m) => {
      return sum + (m.completedAt.getTime() - m.startedAt.getTime());
    }, 0);

    return Math.floor(totalTime / completedMetrics.length / (1000 * 60 * 60)); // Convert to hours
  }

  private calculateCollaborationScore(metrics: any[]): number {
    if (metrics.length === 0) return 0;

    const avgCollaborators = metrics.reduce((sum, m) => sum + m.collaboratorCount, 0) / metrics.length;
    const avgComments = metrics.reduce((sum, m) => sum + m.commentCount, 0) / metrics.length;

    // Simple scoring algorithm - can be enhanced
    return Math.min(100, (avgCollaborators * 20) + (avgComments * 5));
  }

  private calculateMethodologyAdoption(metrics: any[]): number {
    if (metrics.length === 0) return 0;

    const completedPhases = metrics.filter(m => m.completedAt).length;
    const totalPhases = metrics.length;

    return (completedPhases / totalPhases) * 100;
  }

  private async calculateSkillLevel(
    userId: string,
    skillArea: string,
    reviews: any[],
    progress: any[]
  ): Promise<number> {
    // This is a simplified calculation - can be enhanced with more sophisticated algorithms
    let score = 50; // Base score

    // Factor in AI review scores
    const relevantReviews = reviews.filter(r => this.isReviewRelevantToSkill(r, skillArea));
    if (relevantReviews.length > 0) {
      const avgReviewScore = relevantReviews.reduce((sum, r) => sum + r.overallScore, 0) / relevantReviews.length;
      score = (score + avgReviewScore) / 2;
    }

    // Factor in learning progress
    const relevantProgress = progress.filter(p => this.isModuleRelevantToSkill(p.module, skillArea));
    const completedRelevant = relevantProgress.filter(p => p.status === 'COMPLETED').length;
    if (relevantProgress.length > 0) {
      const completionRate = completedRelevant / relevantProgress.length;
      score = score + (completionRate * 20); // Boost for completed modules
    }

    return Math.min(100, Math.max(0, score));
  }

  private async getPreviousSkillLevel(userId: string, skillArea: string): Promise<number | undefined> {
    const previousMetric = await this.prisma.skillDevelopmentMetrics.findFirst({
      where: {
        userId,
        skillArea,
      },
      orderBy: {
        assessmentDate: 'desc',
      },
      skip: 1, // Skip the most recent one
    });

    return previousMetric?.currentLevel;
  }

  private calculatePhaseMetrics(workflowMetrics: any[]): PhaseMetrics[] {
    const phases = ['REQUIREMENTS', 'DESIGN', 'TASKS', 'IMPLEMENTATION'] as SpecificationPhase[];
    
    return phases.map(phase => {
      const phaseMetrics = workflowMetrics.filter(m => m.phase === phase);
      
      if (phaseMetrics.length === 0) {
        return {
          phase,
          averageTimeSpent: 0,
          completionRate: 0,
          averageQualityScore: 0,
          reviewCycles: 0,
        };
      }

      const completed = phaseMetrics.filter(m => m.completedAt);
      const avgTimeSpent = completed.reduce((sum, m) => sum + (m.timeSpent || 0), 0) / completed.length;
      const completionRate = (completed.length / phaseMetrics.length) * 100;
      const avgQualityScore = phaseMetrics.reduce((sum, m) => sum + (m.qualityScore || 0), 0) / phaseMetrics.length;
      const avgReviewCycles = phaseMetrics.reduce((sum, m) => sum + m.reviewCycles, 0) / phaseMetrics.length;

      return {
        phase,
        averageTimeSpent: avgTimeSpent || 0,
        completionRate,
        averageQualityScore: avgQualityScore || 0,
        reviewCycles: avgReviewCycles,
      };
    });
  }

  private async calculateQualityTrend(projectId: string, timeRange?: TimeRange): Promise<QualityTrend[]> {
    const reviews = await this.prisma.aIReview.findMany({
      where: {
        document: {
          projectId,
        },
        createdAt: timeRange
          ? {
              gte: timeRange.start,
              lte: timeRange.end,
            }
          : undefined,
      },
      include: {
        document: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return reviews.map(review => ({
      date: review.createdAt,
      phase: review.document.phase,
      score: review.overallScore,
    }));
  }

  private async calculateCollaborationMetrics(
    projectId: string,
    timeRange?: TimeRange
  ): Promise<CollaborationMetrics> {
    const comments = await this.prisma.comment.findMany({
      where: {
        thread: {
          document: {
            projectId,
          },
        },
        createdAt: timeRange
          ? {
              gte: timeRange.start,
              lte: timeRange.end,
            }
          : undefined,
      },
      include: {
        thread: {
          include: {
            document: true,
          },
        },
      },
    });

    const workflowMetrics = await this.prisma.workflowMetrics.findMany({
      where: {
        projectId,
        startedAt: timeRange
          ? {
              gte: timeRange.start,
              lte: timeRange.end,
            }
          : undefined,
      },
    });

    const avgCollaborators = workflowMetrics.length
      ? workflowMetrics.reduce((sum, m) => sum + m.collaboratorCount, 0) / workflowMetrics.length
      : 0;

    // Calculate average response time (simplified)
    const averageResponseTime = 24; // Placeholder - would need more complex calculation

    const collaborationScore = this.calculateCollaborationScore(workflowMetrics);

    return {
      averageCollaborators: avgCollaborators,
      totalComments: comments.length,
      averageResponseTime,
      collaborationScore,
    };
  }

  private calculateCompletionRate(workflowMetrics: any[]): number {
    if (workflowMetrics.length === 0) return 0;
    const completed = workflowMetrics.filter(m => m.completedAt).length;
    return (completed / workflowMetrics.length) * 100;
  }

  private async getPerformanceTrends(projectId: string, timeRange?: TimeRange): Promise<PerformanceTrend[]> {
    // This would typically aggregate data over time periods
    // For now, return a simplified version
    return [
      {
        date: new Date(),
        metric: 'quality_score',
        value: 85,
      },
      {
        date: new Date(),
        metric: 'completion_rate',
        value: 75,
      },
    ];
  }

  private calculateMostActiveHours(activities: any[]): number[] {
    const hourCounts: Record<number, number> = {};
    
    activities.forEach(activity => {
      const hour = activity.createdAt.getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    return Object.entries(hourCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => parseInt(hour));
  }

  private isReviewRelevantToSkill(review: any, skillArea: string): boolean {
    // Map skill areas to document phases or review content
    const skillPhaseMap: Record<string, SpecificationPhase[]> = {
      requirements: ['REQUIREMENTS'],
      design: ['DESIGN'],
      tasks: ['TASKS'],
      collaboration: ['REQUIREMENTS', 'DESIGN', 'TASKS'],
      quality: ['REQUIREMENTS', 'DESIGN', 'TASKS'],
    };

    return skillPhaseMap[skillArea]?.includes(review.document.phase) || false;
  }

  private isModuleRelevantToSkill(module: any, skillArea: string): boolean {
    // Check if module phase matches skill area or if module content is relevant
    if (module.phase && skillArea === module.phase.toLowerCase()) {
      return true;
    }

    // Check module title/description for skill area keywords
    const content = `${module.title} ${module.description}`.toLowerCase();
    return content.includes(skillArea);
  }

  private async aggregateSystemMetrics(period: string): Promise<void> {
    // Aggregate system-wide performance metrics
    const { periodStart, periodEnd } = this.getPeriodRange(period);

    // Example system metrics
    const metrics = [
      {
        metricType: 'active_users',
        value: await this.getActiveUsersCount(periodStart, periodEnd),
        unit: 'count',
        tags: { period },
      },
      {
        metricType: 'projects_created',
        value: await this.getProjectsCreatedCount(periodStart, periodEnd),
        unit: 'count',
        tags: { period },
      },
      {
        metricType: 'ai_reviews_requested',
        value: await this.getAIReviewsCount(periodStart, periodEnd),
        unit: 'count',
        tags: { period },
      },
    ];

    for (const metric of metrics) {
      await this.prisma.systemPerformanceMetrics.create({
        data: {
          metricType: metric.metricType,
          value: metric.value,
          unit: metric.unit,
          tags: metric.tags,
        },
      });
    }
  }

  private async getActiveUsersCount(start: Date, end: Date): Promise<number> {
    const activeUsers = await this.prisma.userActivity.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      distinct: ['userId'],
    });

    return activeUsers.length;
  }

  private async getProjectsCreatedCount(start: Date, end: Date): Promise<number> {
    return await this.prisma.specificationProject.count({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
      },
    });
  }

  private async getAIReviewsCount(start: Date, end: Date): Promise<number> {
    return await this.prisma.aIReview.count({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
      },
    });
  }
}

export { AnalyticsServiceImpl as AnalyticsService };