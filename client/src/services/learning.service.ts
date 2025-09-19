import { BaseService, typedApiClient } from './api.service';

export interface LearningModule {
  id: string;
  title: string;
  description: string;
  phase?: 'REQUIREMENTS' | 'DESIGN' | 'TASKS' | 'IMPLEMENTATION';
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
  prerequisites: string[];
  content: LessonContent[];
  exercises: Exercise[];
  estimatedDuration: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LessonContent {
  id: string;
  type: 'text' | 'video' | 'interactive' | 'quiz';
  title: string;
  content: string;
  duration: number;
  order: number;
  metadata?: Record<string, any>;
}

export interface Exercise {
  id: string;
  type: 'multiple_choice' | 'code_review' | 'specification_writing' | 'hands_on';
  title: string;
  description: string;
  instructions: string;
  expectedOutput?: string;
  hints: string[];
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
  points: number;
  timeLimit?: number;
  metadata?: Record<string, any>;
}

export interface UserProgress {
  id: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
  completedLessons: string[];
  exerciseResults: ExerciseResult[];
  skillAssessments: SkillAssessment[];
  lastAccessed?: string;
  completedAt?: string;
  module: {
    id: string;
    title: string;
    difficulty: string;
    estimatedDuration: number;
    phase?: string;
  };
}

export interface ExerciseResult {
  exerciseId: string;
  score: number;
  maxScore: number;
  completedAt: string;
  timeSpent: number;
  attempts: number;
  feedback?: string;
}

export interface SkillAssessment {
  skillId: string;
  skillName: string;
  level: string;
  score: number;
  maxScore: number;
  assessedAt: string;
  competencies: CompetencyResult[];
}

export interface CompetencyResult {
  competencyId: string;
  name: string;
  score: number;
  maxScore: number;
  feedback: string;
}

export interface PrerequisiteValidation {
  canAccess: boolean;
  missingPrerequisites: string[];
  completedPrerequisites: string[];
}

class LearningService extends BaseService {
  constructor() {
    super(typedApiClient);
  }

  // Module Management
  async getModules(filters?: {
    phase?: string;
    difficulty?: string;
    search?: string;
  }): Promise<LearningModule[]> {
    try {
      const params: Record<string, string> = {};
      if (filters?.phase) params.phase = filters.phase;
      if (filters?.difficulty) params.difficulty = filters.difficulty;
      if (filters?.search) params.search = filters.search;

      const response = await this.apiClient.get<LearningModule[]>('/learning/modules', { params });
      return this.validateResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getModule(id: string): Promise<LearningModule> {
    try {
      const response = await this.apiClient.get<LearningModule>(`/learning/modules/${id}`);
      return this.validateResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createModule(data: Omit<LearningModule, 'id' | 'createdAt' | 'updatedAt'>): Promise<LearningModule> {
    try {
      const response = await this.apiClient.post<LearningModule>('/learning/modules', data);
      return this.validateResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateModule(id: string, data: Partial<LearningModule>): Promise<LearningModule> {
    try {
      const response = await this.apiClient.put<LearningModule>(`/learning/modules/${id}`, data);
      return this.validateResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async deleteModule(id: string): Promise<void> {
    try {
      const response = await this.apiClient.delete<void>(`/learning/modules/${id}`);
      this.validateResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Progress Tracking
  async getUserProgress(moduleId?: string): Promise<UserProgress[]> {
    try {
      const params = moduleId ? { moduleId } : {};
      const response = await this.apiClient.get<UserProgress[]>('/learning/progress', { params });
      return this.validateResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateProgress(data: {
    moduleId: string;
    completedLessons?: string[];
    exerciseResults?: ExerciseResult[];
    skillAssessments?: SkillAssessment[];
    status?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
  }): Promise<UserProgress> {
    try {
      const response = await this.apiClient.post<UserProgress>('/learning/progress', data);
      return this.validateResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Prerequisites
  async validatePrerequisites(moduleId: string): Promise<PrerequisiteValidation> {
    try {
      const response = await this.apiClient.get<PrerequisiteValidation>(`/learning/modules/${moduleId}/prerequisites`);
      return this.validateResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getRecommendations(): Promise<LearningModule[]> {
    try {
      const response = await this.apiClient.get<LearningModule[]>('/learning/recommendations');
      return this.validateResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Content Delivery
  async getLessonContent(moduleId: string, lessonId: string): Promise<LessonContent> {
    try {
      const response = await this.apiClient.get<LessonContent>(`/learning/modules/${moduleId}/lessons/${lessonId}`);
      return this.validateResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getExercise(moduleId: string, exerciseId: string): Promise<Exercise> {
    try {
      const response = await this.apiClient.get<Exercise>(`/learning/modules/${moduleId}/exercises/${exerciseId}`);
      return this.validateResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Exercise Submission
  async submitExercise(moduleId: string, exerciseId: string, exerciseResponse: unknown): Promise<ExerciseResult> {
    try {
      const response = await this.apiClient.post<ExerciseResult>(`/learning/modules/${moduleId}/exercises/${exerciseId}/submit`, {
        response: exerciseResponse,
        submittedAt: new Date().toISOString(),
      });
      return this.validateResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Skill Assessment
  async assessSkill(moduleId: string, skillId: string, responses: Record<string, any>): Promise<SkillAssessment> {
    try {
      const response = await this.apiClient.post<SkillAssessment>(`/learning/modules/${moduleId}/assess/${skillId}`, {
        responses,
      });
      return this.validateResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Achievement System
  async getAchievements(): Promise<Achievement[]> {
    try {
      const response = await this.apiClient.get<Achievement[]>('/learning/achievements');
      return this.validateResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async unlockAchievement(achievementId: string): Promise<void> {
    try {
      const response = await this.apiClient.post<void>(`/learning/achievements/${achievementId}/unlock`);
      this.validateResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Learning Path
  async getLearningPath(phase?: string): Promise<LearningModule[]> {
    try {
      const params = phase ? { phase } : {};
      const response = await this.apiClient.get<LearningModule[]>('/learning/path', { params });
      return this.validateResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Analytics
  async getLearningAnalytics(timeframe?: 'week' | 'month' | 'year'): Promise<LearningAnalytics> {
    try {
      const params = timeframe ? { timeframe } : {};
      const response = await this.apiClient.get<LearningAnalytics>('/learning/analytics', { params });
      return this.validateResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'completion' | 'performance' | 'streak' | 'special';
  points: number;
  unlockedAt?: string;
  progress?: {
    current: number;
    target: number;
  };
}

export interface LearningAnalytics {
  totalModulesCompleted: number;
  totalTimeSpent: number; // in minutes
  totalPoints: number;
  averageScore: number;
  streakDays: number;
  skillLevels: Record<string, number>;
  weeklyProgress: {
    week: string;
    modulesCompleted: number;
    timeSpent: number;
    points: number;
  }[];
  competencyScores: {
    competencyId: string;
    name: string;
    averageScore: number;
    assessmentCount: number;
  }[];
}

export const learningService = new LearningService();