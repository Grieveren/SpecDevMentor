import { apiClient } from './api.service';

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

class LearningService {
  // Module Management
  async getModules(filters?: {
    phase?: string;
    difficulty?: string;
    search?: string;
  }): Promise<LearningModule[]> {
    const params = new URLSearchParams();
    if (filters?.phase) params.append('phase', filters.phase);
    if (filters?.difficulty) params.append('difficulty', filters.difficulty);
    if (filters?.search) params.append('search', filters.search);

    const _response = await apiClient.get(`/learning/modules?${params.toString()}`);
    return response.data.data;
  }

  async getModule(id: string): Promise<LearningModule> {
    const _response = await apiClient.get(`/learning/modules/${id}`);
    return response.data.data;
  }

  async createModule(data: Omit<LearningModule, 'id' | 'createdAt' | 'updatedAt'>): Promise<LearningModule> {
    const _response = await apiClient.post('/learning/modules', data);
    return response.data.data;
  }

  async updateModule(id: string, data: Partial<LearningModule>): Promise<LearningModule> {
    const _response = await apiClient.put(`/learning/modules/${id}`, data);
    return response.data.data;
  }

  async deleteModule(id: string): Promise<void> {
    await apiClient.delete(`/learning/modules/${id}`);
  }

  // Progress Tracking
  async getUserProgress(moduleId?: string): Promise<UserProgress[]> {
    const params = moduleId ? `?moduleId=${moduleId}` : '';
    const _response = await apiClient.get(`/learning/progress${params}`);
    return response.data.data;
  }

  async updateProgress(data: {
    moduleId: string;
    completedLessons?: string[];
    exerciseResults?: ExerciseResult[];
    skillAssessments?: SkillAssessment[];
    status?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
  }): Promise<UserProgress> {
    const _response = await apiClient.post('/learning/progress', data);
    return response.data.data;
  }

  // Prerequisites
  async validatePrerequisites(moduleId: string): Promise<PrerequisiteValidation> {
    const _response = await apiClient.get(`/learning/modules/${moduleId}/prerequisites`);
    return response.data.data;
  }

  async getRecommendations(): Promise<LearningModule[]> {
    const _response = await apiClient.get('/learning/recommendations');
    return response.data.data;
  }

  // Content Delivery
  async getLessonContent(moduleId: string, lessonId: string): Promise<LessonContent> {
    const _response = await apiClient.get(`/learning/modules/${moduleId}/lessons/${lessonId}`);
    return response.data.data;
  }

  async getExercise(moduleId: string, exerciseId: string): Promise<Exercise> {
    const _response = await apiClient.get(`/learning/modules/${moduleId}/exercises/${exerciseId}`);
    return response.data.data;
  }

  // Exercise Submission
  async submitExercise(moduleId: string, exerciseId: string, _response: unknown): Promise<ExerciseResult> {
    const submitResponse = await apiClient.post(`/learning/modules/${moduleId}/exercises/${exerciseId}/submit`, {
      response,
      submittedAt: new Date().toISOString(),
    });
    return submitResponse.data.data;
  }

  // Skill Assessment
  async assessSkill(moduleId: string, skillId: string, responses: Record<string, any>): Promise<SkillAssessment> {
    const _response = await apiClient.post(`/learning/modules/${moduleId}/assess/${skillId}`, {
      responses,
    });
    return response.data.data;
  }

  // Achievement System
  async getAchievements(): Promise<Achievement[]> {
    const _response = await apiClient.get('/learning/achievements');
    return response.data.data;
  }

  async unlockAchievement(achievementId: string): Promise<void> {
    await apiClient.post(`/learning/achievements/${achievementId}/unlock`);
  }

  // Learning Path
  async getLearningPath(phase?: string): Promise<LearningModule[]> {
    const params = phase ? `?phase=${phase}` : '';
    const _response = await apiClient.get(`/learning/path${params}`);
    return response.data.data;
  }

  // Analytics
  async getLearningAnalytics(timeframe?: 'week' | 'month' | 'year'): Promise<LearningAnalytics> {
    const params = timeframe ? `?timeframe=${timeframe}` : '';
    const _response = await apiClient.get(`/learning/analytics${params}`);
    return response.data.data;
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