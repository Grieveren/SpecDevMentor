import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrismaClient, ActivityType, SpecificationPhase } from '@prisma/client';
import { Redis } from 'ioredis';
import { AnalyticsService } from '../services/analytics.service';

let result: any;

// Mock Prisma Client
const mockPrisma = {
  userActivity: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  workflowMetrics: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  },
  teamPerformanceMetrics: {
    upsert: vi.fn(),
  },
  skillDevelopmentMetrics: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  specificationProject: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
  },
  aIReview: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  userProgress: {
    findMany: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  comment: {
    findMany: vi.fn(),
  },
  systemPerformanceMetrics: {
    create: vi.fn(),
  },
  $queryRaw: vi.fn(),
} as unknown as PrismaClient;

// Mock Redis
const mockRedis = {
  incr: vi.fn(),
  expire: vi.fn(),
  keys: vi.fn(),
  get: vi.fn(),
} as unknown as Redis;

describe('AnalyticsService', () => {
  let analyticsService: AnalyticsService;

  beforeEach(() => {
    analyticsService = new AnalyticsService(mockPrisma, mockRedis);
    vi.clearAllMocks();
  });

  describe('trackUserActivity', () => {
    it('should track user activity successfully', async () => {
      const activityData = {
        userId: 'user-1',
        action: ActivityType.PROJECT_CREATED,
        resource: 'project',
        resourceId: 'project-1',
        metadata: { name: 'Test Project' },
        duration: 300,
        sessionId: 'session-1',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
      };

      (mockPrisma.userActivity.create as any).mockResolvedValue({
        id: 'activity-1',
        ...activityData,
        createdAt: new Date(),
      });

      (mockRedis.incr as any).mockResolvedValue(1);
      (mockRedis.expire as any).mockResolvedValue(1);

      await analyticsService.trackUserActivity(activityData);

      expect(mockPrisma.userActivity.create).toHaveBeenCalledWith({
        data: {
          userId: activityData.userId,
          action: activityData.action,
          resource: activityData.resource,
          resourceId: activityData.resourceId,
          metadata: activityData.metadata,
          duration: activityData.duration,
          sessionId: activityData.sessionId,
          ipAddress: activityData.ipAddress,
          userAgent: activityData.userAgent,
        },
      });

      expect(mockRedis.incr).toHaveBeenCalledWith('analytics:realtime:PROJECT_CREATED');
      expect(mockRedis.expire).toHaveBeenCalledWith('analytics:realtime:PROJECT_CREATED', 3600);
    });

    it('should handle errors gracefully without throwing', async () => {
      const activityData = {
        userId: 'user-1',
        action: ActivityType.PROJECT_CREATED,
        resource: 'project',
        resourceId: 'project-1',
      };

      (mockPrisma.userActivity.create as any).mockRejectedValue(new Error('Database error'));

      // Should not throw
      await expect(analyticsService.trackUserActivity(activityData)).resolves.toBeUndefined();
    });
  });

  describe('trackWorkflowProgress', () => {
    it('should create new workflow metric when starting a phase', async () => {
      const progressData = {
        projectId: 'project-1',
        userId: 'user-1',
        phase: SpecificationPhase.REQUIREMENTS,
        action: 'started' as const,
        qualityScore: 85,
        collaboratorCount: 3,
      };

      (mockPrisma.workflowMetrics.findUnique as any).mockResolvedValue(null);
      (mockPrisma.workflowMetrics.create as any).mockResolvedValue({
        id: 'metric-1',
        ...progressData,
        startedAt: new Date(),
      });

      await analyticsService.trackWorkflowProgress(progressData);

      expect(mockPrisma.workflowMetrics.create).toHaveBeenCalledWith({
        data: {
          projectId: progressData.projectId,
          userId: progressData.userId,
          phase: progressData.phase,
          startedAt: expect.any(Date),
          qualityScore: progressData.qualityScore,
          collaboratorCount: progressData.collaboratorCount,
          commentCount: 0,
          revisionCount: 0,
          aiSuggestionsApplied: 0,
        },
      });
    });

    it('should update existing workflow metric when completing a phase', async () => {
      const startedAt = new Date(Date.now() - 3600000); // 1 hour ago
      const existingMetric = {
        id: 'metric-1',
        projectId: 'project-1',
        userId: 'user-1',
        phase: SpecificationPhase.REQUIREMENTS,
        startedAt,
        reviewCycles: 2,
        qualityScore: 80,
        collaboratorCount: 3,
        commentCount: 5,
        revisionCount: 1,
        aiSuggestionsApplied: 3,
      };

      const progressData = {
        projectId: 'project-1',
        userId: 'user-1',
        phase: SpecificationPhase.REQUIREMENTS,
        action: 'completed' as const,
      };

      (mockPrisma.workflowMetrics.findUnique as any).mockResolvedValue(existingMetric);
      (mockPrisma.workflowMetrics.update as any).mockResolvedValue({
        ...existingMetric,
        completedAt: new Date(),
        timeSpent: 3600,
      });

      await analyticsService.trackWorkflowProgress(progressData);

      expect(mockPrisma.workflowMetrics.update).toHaveBeenCalledWith({
        where: {
          projectId_phase_userId: {
            projectId: progressData.projectId,
            phase: progressData.phase,
            userId: progressData.userId,
          },
        },
        data: {
          completedAt: expect.any(Date),
          timeSpent: expect.any(Number),
        },
      });
    });

    it('should increment review cycles when tracking review cycle', async () => {
      const existingMetric = {
        id: 'metric-1',
        projectId: 'project-1',
        userId: 'user-1',
        phase: SpecificationPhase.REQUIREMENTS,
        startedAt: new Date(),
        reviewCycles: 1,
      };

      const progressData = {
        projectId: 'project-1',
        userId: 'user-1',
        phase: SpecificationPhase.REQUIREMENTS,
        action: 'review_cycle' as const,
      };

      (mockPrisma.workflowMetrics.findUnique as any).mockResolvedValue(existingMetric);
      (mockPrisma.workflowMetrics.update as any).mockResolvedValue({
        ...existingMetric,
        reviewCycles: 2,
      });

      await analyticsService.trackWorkflowProgress(progressData);

      expect(mockPrisma.workflowMetrics.update).toHaveBeenCalledWith({
        where: {
          projectId_phase_userId: {
            projectId: progressData.projectId,
            phase: progressData.phase,
            userId: progressData.userId,
          },
        },
        data: {
          reviewCycles: 2,
        },
      });
    });
  });

  describe('calculateTeamPerformanceMetrics', () => {
    it('should calculate team performance metrics correctly', async () => {
      const projectId = 'project-1';
      const period = 'weekly';

      const mockWorkflowMetrics = [
        {
          id: 'metric-1',
          projectId,
          userId: 'user-1',
          phase: SpecificationPhase.REQUIREMENTS,
          startedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
          timeSpent: 3600,
          reviewCycles: 2,
          qualityScore: 85,
          collaboratorCount: 3,
          commentCount: 5,
          aiSuggestionsApplied: 2,
          user: { id: 'user-1', name: 'User 1' },
        },
        {
          id: 'metric-2',
          projectId,
          userId: 'user-2',
          phase: SpecificationPhase.DESIGN,
          startedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
          timeSpent: 7200,
          reviewCycles: 1,
          qualityScore: 90,
          collaboratorCount: 2,
          commentCount: 3,
          aiSuggestionsApplied: 1,
          user: { id: 'user-2', name: 'User 2' },
        },
      ];

      (mockPrisma.workflowMetrics.findMany as any).mockResolvedValue(mockWorkflowMetrics);
      (mockPrisma.teamPerformanceMetrics.upsert as any).mockResolvedValue({
        id: 'team-metric-1',
        projectId,
        period,
        projectsCompleted: 2,
        averageQualityScore: 87.5,
      });

       result = await analyticsService.calculateTeamPerformanceMetrics(projectId, period);

      expect(result.projectId).toBe(projectId);
      expect(result.period).toBe(period);
      expect(result.projectsCompleted).toBe(2);
      expect(result.averageQualityScore).toBe(87.5);
      expect(result.averageCompletionTime).toBeGreaterThan(0);
      expect(result.collaborationScore).toBeGreaterThan(0);
      expect(result.methodologyAdoption).toBe(100); // Both workflows completed

      expect(mockPrisma.teamPerformanceMetrics.upsert).toHaveBeenCalled();
    });

    it('should handle empty workflow metrics', async () => {
      const projectId = 'project-1';
      const period = 'weekly';

      (mockPrisma.workflowMetrics.findMany as any).mockResolvedValue([]);
      (mockPrisma.teamPerformanceMetrics.upsert as any).mockResolvedValue({
        id: 'team-metric-1',
        projectId,
        period,
        projectsCompleted: 0,
        averageQualityScore: 0,
      });

       result = await analyticsService.calculateTeamPerformanceMetrics(projectId, period);

      expect(result.projectsCompleted).toBe(0);
      expect(result.averageQualityScore).toBe(0);
      expect(result.averageCompletionTime).toBe(0);
    });
  });

  describe('calculateSkillDevelopment', () => {
    it('should calculate skill development metrics', async () => {
      const userId = 'user-1';

      const mockReviews = [
        {
          id: 'review-1',
          overallScore: 85,
          createdAt: new Date(),
          document: {
            phase: SpecificationPhase.REQUIREMENTS,
            project: { id: 'project-1' },
          },
        },
        {
          id: 'review-2',
          overallScore: 90,
          createdAt: new Date(),
          document: {
            phase: SpecificationPhase.DESIGN,
            project: { id: 'project-1' },
          },
        },
      ];

      const mockUserProgress = [
        {
          id: 'progress-1',
          userId,
          status: 'COMPLETED',
          module: {
            id: 'module-1',
            title: 'Requirements Engineering',
            phase: SpecificationPhase.REQUIREMENTS,
          },
        },
      ];

      (mockPrisma.aIReview.findMany as any).mockResolvedValue(mockReviews);
      (mockPrisma.userProgress.findMany as any).mockResolvedValue(mockUserProgress);
      (mockPrisma.skillDevelopmentMetrics.findFirst as any).mockResolvedValue(null);
      (mockPrisma.skillDevelopmentMetrics.create as any).mockImplementation((data) => 
        Promise.resolve({ id: 'skill-metric-1', ...data.data })
      );

       result = await analyticsService.calculateSkillDevelopment(userId);

      expect(result).toHaveLength(5); // 5 skill areas
      expect(result[0].userId).toBe(userId);
      expect(result[0].currentLevel).toBeGreaterThan(0);
      expect(result[0].assessmentType).toBe('ai_review');

      expect(mockPrisma.skillDevelopmentMetrics.create).toHaveBeenCalledTimes(5);
    });
  });

  describe('getProjectAnalytics', () => {
    it('should return comprehensive project analytics', async () => {
      const projectId = 'project-1';

      const mockWorkflowMetrics = [
        {
          id: 'metric-1',
          projectId,
          phase: SpecificationPhase.REQUIREMENTS,
          timeSpent: 3600,
          qualityScore: 85,
          reviewCycles: 2,
          completedAt: new Date(),
          user: { id: 'user-1' },
        },
        {
          id: 'metric-2',
          projectId,
          phase: SpecificationPhase.DESIGN,
          timeSpent: 7200,
          qualityScore: 90,
          reviewCycles: 1,
          completedAt: new Date(),
          user: { id: 'user-2' },
        },
      ];

      (mockPrisma.workflowMetrics.findMany as any).mockResolvedValue(mockWorkflowMetrics);
      (mockPrisma.aIReview.findMany as any).mockResolvedValue([
        {
          id: 'review-1',
          overallScore: 85,
          createdAt: new Date(),
          document: { phase: SpecificationPhase.REQUIREMENTS },
        },
      ]);
      (mockPrisma.comment.findMany as any).mockResolvedValue([]);

       result = await analyticsService.getProjectAnalytics(projectId);

      expect(result.projectId).toBe(projectId);
      expect(result.totalTimeSpent).toBe(10800); // 3600 + 7200
      expect(result.phaseMetrics).toHaveLength(4); // 4 phases
      expect(result.completionRate).toBe(100); // Both metrics completed
      expect(result.averageReviewCycles).toBe(1.5); // (2 + 1) / 2
    });
  });

  describe('getUserAnalytics', () => {
    it('should return comprehensive user analytics', async () => {
      const userId = 'user-1';

      const mockUser = {
        id: userId,
        name: 'Test User',
        ownedProjects: [{ id: 'project-1' }],
        teamMemberships: [{ id: 'membership-1', project: { id: 'project-2' } }],
        activities: [
          {
            id: 'activity-1',
            action: ActivityType.PROJECT_CREATED,
            createdAt: new Date(),
          },
        ],
        userProgress: [
          {
            id: 'progress-1',
            status: 'COMPLETED',
            exerciseResults: [{ score: 85 }],
            module: { estimatedDuration: 60 },
          },
        ],
        workflowMetrics: [
          {
            id: 'metric-1',
            completedAt: new Date(),
            qualityScore: 85,
          },
        ],
        skillMetrics: [
          {
            id: 'skill-1',
            skillArea: 'requirements',
            currentLevel: 75,
            improvement: 5,
            assessmentDate: new Date(),
          },
        ],
      };

      (mockPrisma.user.findUnique as any).mockResolvedValue(mockUser);

       result = await analyticsService.getUserAnalytics(userId);

      expect(result.userId).toBe(userId);
      expect(result.totalProjects).toBe(2); // 1 owned + 1 team membership
      expect(result.completedProjects).toBe(1);
      expect(result.averageQualityScore).toBe(85);
      expect(result.skillLevels).toHaveLength(1);
      expect(result.activitySummary.totalActivities).toBe(1);
      expect(result.learningProgress.modulesCompleted).toBe(1);
    });

    it('should throw error for non-existent user', async () => {
      const userId = 'non-existent';

      (mockPrisma.user.findUnique as any).mockResolvedValue(null);

      await expect(analyticsService.getUserAnalytics(userId)).rejects.toThrow('User not found');
    });
  });

  describe('aggregateMetrics', () => {
    it('should aggregate metrics for all active projects', async () => {
      const mockProjects = [
        { id: 'project-1', status: 'ACTIVE' },
        { id: 'project-2', status: 'ACTIVE' },
      ];

      (mockPrisma.specificationProject.findMany as any).mockResolvedValue(mockProjects);
      (mockPrisma.workflowMetrics.findMany as any).mockResolvedValue([]);
      (mockPrisma.teamPerformanceMetrics.upsert as any).mockResolvedValue({});
      (mockPrisma.userActivity.findMany as any).mockResolvedValue([]);
      (mockPrisma.specificationProject.count as any).mockResolvedValue(2);
      (mockPrisma.aIReview.count as any).mockResolvedValue(5);
      (mockPrisma.systemPerformanceMetrics.create as any).mockResolvedValue({});

      await analyticsService.aggregateMetrics('daily');

      expect(mockPrisma.teamPerformanceMetrics.upsert).toHaveBeenCalledTimes(2);
      expect(mockPrisma.systemPerformanceMetrics.create).toHaveBeenCalledTimes(3); // 3 system metrics
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully in trackUserActivity', async () => {
      const activityData = {
        userId: 'user-1',
        action: ActivityType.PROJECT_CREATED,
        resource: 'project',
        resourceId: 'project-1',
      };

      (mockPrisma.userActivity.create as any).mockRejectedValue(new Error('Database connection failed'));

      // Should not throw
      await expect(analyticsService.trackUserActivity(activityData)).resolves.toBeUndefined();
    });

    it('should handle database errors gracefully in trackWorkflowProgress', async () => {
      const progressData = {
        projectId: 'project-1',
        userId: 'user-1',
        phase: SpecificationPhase.REQUIREMENTS,
        action: 'started' as const,
      };

      (mockPrisma.workflowMetrics.findUnique as any).mockRejectedValue(new Error('Database error'));

      // Should not throw
      await expect(analyticsService.trackWorkflowProgress(progressData)).resolves.toBeUndefined();
    });
  });

  describe('time range filtering', () => {
    it('should filter analytics by time range', async () => {
      const projectId = 'project-1';
      const timeRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      };

      (mockPrisma.workflowMetrics.findMany as any).mockResolvedValue([]);
      (mockPrisma.aIReview.findMany as any).mockResolvedValue([]);
      (mockPrisma.comment.findMany as any).mockResolvedValue([]);

      await analyticsService.getProjectAnalytics(projectId, timeRange);

      expect(mockPrisma.workflowMetrics.findMany).toHaveBeenCalledWith({
        where: {
          projectId,
          startedAt: {
            gte: timeRange.start,
            lte: timeRange.end,
          },
        },
        include: {
          user: true,
        },
      });
    });
  });
});