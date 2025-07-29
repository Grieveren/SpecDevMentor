import { PrismaClient, LearningModule, UserProgress, SpecificationPhase, DifficultyLevel, ProgressStatus } from '@prisma/client';
import { z } from 'zod';

// Type definitions for learning content
export interface LessonContent {
  id: string;
  type: 'text' | 'video' | 'interactive' | 'quiz';
  title: string;
  content: string;
  duration: number; // in minutes
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
  difficulty: DifficultyLevel;
  points: number;
  timeLimit?: number; // in minutes
  metadata?: Record<string, any>;
}

export interface ExerciseResult {
  exerciseId: string;
  score: number;
  maxScore: number;
  completedAt: Date;
  timeSpent: number; // in minutes
  attempts: number;
  feedback?: string;
}

export interface SkillAssessment {
  skillId: string;
  skillName: string;
  level: DifficultyLevel;
  score: number;
  maxScore: number;
  assessedAt: Date;
  competencies: CompetencyResult[];
}

export interface CompetencyResult {
  competencyId: string;
  name: string;
  score: number;
  maxScore: number;
  feedback: string;
}

export interface CompetencyMapping {
  id: string;
  name: string;
  description: string;
  phase: SpecificationPhase;
  prerequisites: string[];
  skills: string[];
  assessmentCriteria: AssessmentCriteria[];
}

export interface AssessmentCriteria {
  id: string;
  name: string;
  description: string;
  weight: number;
  rubric: RubricLevel[];
}

export interface RubricLevel {
  level: number;
  description: string;
  points: number;
}

// Validation schemas
const createModuleSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  phase: z.nativeEnum(SpecificationPhase).optional(),
  difficulty: z.nativeEnum(DifficultyLevel),
  prerequisites: z.array(z.string()).default([]),
  content: z.array(z.any()).default([]),
  exercises: z.array(z.any()).default([]),
  estimatedDuration: z.number().min(1),
  isPublished: z.boolean().default(false),
});

const updateProgressSchema = z.object({
  moduleId: z.string(),
  completedLessons: z.array(z.string()).optional(),
  exerciseResults: z.array(z.any()).optional(),
  skillAssessments: z.array(z.any()).optional(),
  status: z.nativeEnum(ProgressStatus).optional(),
});

export class LearningService {
  constructor(private prisma: PrismaClient) {}

  // Learning Module Management
  async createModule(data: z.infer<typeof createModuleSchema>): Promise<LearningModule> {
    const validatedData = createModuleSchema.parse(data);

    // Validate prerequisites exist
    if (validatedData.prerequisites.length > 0) {
      const existingModules = await this.prisma.learningModule.findMany({
        where: { id: { in: validatedData.prerequisites } },
        select: { id: true },
      });

      if (existingModules.length !== validatedData.prerequisites.length) {
        throw new Error('Some prerequisite modules do not exist');
      }
    }

    return await this.prisma.learningModule.create({
      data: validatedData,
    });
  }

  async getModule(id: string): Promise<LearningModule | null> {
    return await this.prisma.learningModule.findUnique({
      where: { id },
    });
  }

  async getModules(filters: {
    phase?: SpecificationPhase;
    difficulty?: DifficultyLevel;
    isPublished?: boolean;
    search?: string;
  } = {}): Promise<LearningModule[]> {
    const { phase, difficulty, isPublished = true, search } = filters;

    return await this.prisma.learningModule.findMany({
      where: {
        ...(phase && { phase }),
        ...(difficulty && { difficulty }),
        isPublished,
        ...(search && {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        }),
      },
      orderBy: [{ difficulty: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async updateModule(id: string, data: Partial<z.infer<typeof createModuleSchema>>): Promise<LearningModule> {
    const existingModule = await this.prisma.learningModule.findUnique({
      where: { id },
    });

    if (!existingModule) {
      throw new Error('Learning module not found');
    }

    // Validate prerequisites if provided
    if (data.prerequisites && data.prerequisites.length > 0) {
      const existingModules = await this.prisma.learningModule.findMany({
        where: { id: { in: data.prerequisites } },
        select: { id: true },
      });

      if (existingModules.length !== data.prerequisites.length) {
        throw new Error('Some prerequisite modules do not exist');
      }
    }

    return await this.prisma.learningModule.update({
      where: { id },
      data,
    });
  }

  async deleteModule(id: string): Promise<void> {
    // Check if module is used as prerequisite
    const dependentModules = await this.prisma.learningModule.findMany({
      where: {
        prerequisites: {
          has: id,
        },
      },
      select: { id: true, title: true },
    });

    if (dependentModules.length > 0) {
      throw new Error(
        `Cannot delete module. It is a prerequisite for: ${dependentModules
          .map(m => m.title)
          .join(', ')}`
      );
    }

    await this.prisma.learningModule.delete({
      where: { id },
    });
  }

  // Progress Tracking
  async getUserProgress(userId: string, moduleId?: string): Promise<UserProgress[]> {
    return await this.prisma.userProgress.findMany({
      where: {
        userId,
        ...(moduleId && { moduleId }),
      },
      include: {
        module: {
          select: {
            id: true,
            title: true,
            difficulty: true,
            estimatedDuration: true,
            phase: true,
          },
        },
      },
      orderBy: { lastAccessed: 'desc' },
    });
  }

  async updateUserProgress(
    userId: string,
    data: z.infer<typeof updateProgressSchema>
  ): Promise<UserProgress> {
    const validatedData = updateProgressSchema.parse(data);

    // Verify module exists
    const module = await this.prisma.learningModule.findUnique({
      where: { id: validatedData.moduleId },
    });

    if (!module) {
      throw new Error('Learning module not found');
    }

    // Get or create progress record
    const existingProgress = await this.prisma.userProgress.findUnique({
      where: {
        userId_moduleId: {
          userId,
          moduleId: validatedData.moduleId,
        },
      },
    });

    const updateData: unknown = {
      lastAccessed: new Date(),
      ...(validatedData.completedLessons && { completedLessons: validatedData.completedLessons }),
      ...(validatedData.exerciseResults && { exerciseResults: validatedData.exerciseResults }),
      ...(validatedData.skillAssessments && { skillAssessments: validatedData.skillAssessments }),
      ...(validatedData.status && { status: validatedData.status }),
    };

    // Set completion date if status is COMPLETED
    if (validatedData.status === ProgressStatus.COMPLETED) {
      updateData.completedAt = new Date();
    }

    if (existingProgress) {
      return await this.prisma.userProgress.update({
        where: {
          userId_moduleId: {
            userId,
            moduleId: validatedData.moduleId,
          },
        },
        data: updateData,
      });
    } else {
      return await this.prisma.userProgress.create({
        data: {
          userId,
          moduleId: validatedData.moduleId,
          status: validatedData.status || ProgressStatus.IN_PROGRESS,
          ...updateData,
        },
      });
    }
  }

  // Skill Assessment Logic
  async assessSkill(
    userId: string,
    moduleId: string,
    skillId: string,
    responses: Record<string, any>
  ): Promise<SkillAssessment> {
    const module = await this.prisma.learningModule.findUnique({
      where: { id: moduleId },
    });

    if (!module) {
      throw new Error('Learning module not found');
    }

    // Get competency mapping for the skill
    const competencyMapping = this.getCompetencyMapping(skillId, module.phase);
    
    // Calculate competency scores
    const competencies = await this.assessCompetencies(competencyMapping, responses);
    
    // Calculate overall skill score
    const totalScore = competencies.reduce((sum, comp) => sum + comp.score, 0);
    const maxScore = competencies.reduce((sum, comp) => sum + comp.maxScore, 0);
    
    const skillAssessment: SkillAssessment = {
      skillId,
      skillName: competencyMapping.name,
      level: module.difficulty,
      score: totalScore,
      maxScore,
      assessedAt: new Date(),
      competencies,
    };

    // Update user progress with assessment
    const progress = await this.prisma.userProgress.findUnique({
      where: {
        userId_moduleId: { userId, moduleId },
      },
    });

    if (progress) {
      const existingAssessments = (progress.skillAssessments as SkillAssessment[]) || [];
      const updatedAssessments = existingAssessments.filter(a => a.skillId !== skillId);
      updatedAssessments.push(skillAssessment);

      await this.prisma.userProgress.update({
        where: {
          userId_moduleId: { userId, moduleId },
        },
        data: {
          skillAssessments: updatedAssessments,
          lastAccessed: new Date(),
        },
      });
    }

    return skillAssessment;
  }

  // Competency Mapping and Prerequisite Validation
  async validatePrerequisites(userId: string, moduleId: string): Promise<{
    canAccess: boolean;
    missingPrerequisites: string[];
    completedPrerequisites: string[];
  }> {
    const module = await this.prisma.learningModule.findUnique({
      where: { id: moduleId },
    });

    if (!module || module.prerequisites.length === 0) {
      return {
        canAccess: true,
        missingPrerequisites: [],
        completedPrerequisites: [],
      };
    }

    const userProgress = await this.prisma.userProgress.findMany({
      where: {
        userId,
        moduleId: { in: module.prerequisites },
        status: ProgressStatus.COMPLETED,
      },
      select: { moduleId: true },
    });

    const completedPrerequisites = userProgress.map(p => p.moduleId);
    const missingPrerequisites = module.prerequisites.filter(
      prereq => !completedPrerequisites.includes(prereq)
    );

    return {
      canAccess: missingPrerequisites.length === 0,
      missingPrerequisites,
      completedPrerequisites,
    };
  }

  async getRecommendedModules(userId: string): Promise<LearningModule[]> {
    // Get user's completed modules
    const completedProgress = await this.prisma.userProgress.findMany({
      where: {
        userId,
        status: ProgressStatus.COMPLETED,
      },
      select: { moduleId: true },
    });

    const completedModuleIds = completedProgress.map(p => p.moduleId);

    // Find modules where prerequisites are met but not yet started
    const availableModules = await this.prisma.learningModule.findMany({
      where: {
        isPublished: true,
        id: { notIn: completedModuleIds },
      },
    });

    const recommendedModules: LearningModule[] = [];

    for (const module of availableModules) {
      if (module.prerequisites.length === 0 || 
          module.prerequisites.every(prereq => completedModuleIds.includes(prereq))) {
        recommendedModules.push(module);
      }
    }

    return recommendedModules.sort((a, b) => {
      // Sort by difficulty, then by creation date
      if (a.difficulty !== b.difficulty) {
        const difficultyOrder = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'];
        return difficultyOrder.indexOf(a.difficulty) - difficultyOrder.indexOf(b.difficulty);
      }
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }

  // Content Delivery API
  async getLessonContent(moduleId: string, lessonId: string): Promise<LessonContent | null> {
    const module = await this.prisma.learningModule.findUnique({
      where: { id: moduleId },
    });

    if (!module) {
      return null;
    }

    const lessons = module.content as LessonContent[];
    return lessons.find(lesson => lesson.id === lessonId) || null;
  }

  async getExercise(moduleId: string, exerciseId: string): Promise<Exercise | null> {
    const module = await this.prisma.learningModule.findUnique({
      where: { id: moduleId },
    });

    if (!module) {
      return null;
    }

    const exercises = module.exercises as Exercise[];
    return exercises.find(exercise => exercise.id === exerciseId) || null;
  }

  // Helper methods
  private getCompetencyMapping(skillId: string, phase?: SpecificationPhase): CompetencyMapping {
    // This would typically come from a configuration file or database
    // For now, return a basic mapping based on phase
    const baseCompetencies: Record<string, CompetencyMapping> = {
      'requirements-analysis': {
        id: 'requirements-analysis',
        name: 'Requirements Analysis',
        description: 'Ability to analyze and write clear, testable requirements',
        phase: SpecificationPhase.REQUIREMENTS,
        prerequisites: [],
        skills: ['ears-format', 'user-stories', 'acceptance-criteria'],
        assessmentCriteria: [
          {
            id: 'clarity',
            name: 'Clarity and Precision',
            description: 'Requirements are clear, unambiguous, and precise',
            weight: 0.3,
            rubric: [
              { level: 1, description: 'Vague or ambiguous', points: 1 },
              { level: 2, description: 'Somewhat clear', points: 2 },
              { level: 3, description: 'Clear and precise', points: 3 },
              { level: 4, description: 'Exceptionally clear', points: 4 },
            ],
          },
          {
            id: 'testability',
            name: 'Testability',
            description: 'Requirements can be easily tested and verified',
            weight: 0.4,
            rubric: [
              { level: 1, description: 'Not testable', points: 1 },
              { level: 2, description: 'Somewhat testable', points: 2 },
              { level: 3, description: 'Easily testable', points: 3 },
              { level: 4, description: 'Comprehensive test criteria', points: 4 },
            ],
          },
          {
            id: 'completeness',
            name: 'Completeness',
            description: 'All necessary requirements are covered',
            weight: 0.3,
            rubric: [
              { level: 1, description: 'Major gaps', points: 1 },
              { level: 2, description: 'Some gaps', points: 2 },
              { level: 3, description: 'Mostly complete', points: 3 },
              { level: 4, description: 'Comprehensive', points: 4 },
            ],
          },
        ],
      },
    };

    return baseCompetencies[skillId] || baseCompetencies['requirements-analysis'];
  }

  private async assessCompetencies(
    mapping: CompetencyMapping,
    responses: Record<string, any>
  ): Promise<CompetencyResult[]> {
    const results: CompetencyResult[] = [];

    for (const criteria of mapping.assessmentCriteria) {
      const _response = responses[criteria.id];
      const score = this.calculateCriteriaScore(criteria, response);
      const maxScore = Math.max(...criteria.rubric.map(r => r.points));

      results.push({
        competencyId: criteria.id,
        name: criteria.name,
        score,
        maxScore,
        feedback: this.generateFeedback(criteria, score, maxScore),
      });
    }

    return results;
  }

  private calculateCriteriaScore(criteria: AssessmentCriteria, _response: unknown): number {
    // This is a simplified scoring mechanism
    // In a real implementation, this would use more sophisticated analysis
    if (typeof response === 'number' && response >= 1 && response <= 4) {
      const rubricLevel = criteria.rubric.find(r => r.level === response);
      return rubricLevel ? rubricLevel.points : 0;
    }

    // Default scoring based on response quality (simplified)
    if (typeof response === 'string') {
      const length = response.length;
      if (length < 50) return 1;
      if (length < 150) return 2;
      if (length < 300) return 3;
      return 4;
    }

    return 0;
  }

  private generateFeedback(criteria: AssessmentCriteria, score: number, maxScore: number): string {
    const percentage = (score / maxScore) * 100;

    if (percentage >= 90) {
      return `Excellent work on ${criteria.name.toLowerCase()}! You've demonstrated mastery of this competency.`;
    } else if (percentage >= 70) {
      return `Good understanding of ${criteria.name.toLowerCase()}. Consider reviewing the rubric for areas of improvement.`;
    } else if (percentage >= 50) {
      return `Basic understanding of ${criteria.name.toLowerCase()}. Additional practice and study recommended.`;
    } else {
      return `${criteria.name} needs significant improvement. Please review the learning materials and practice more.`;
    }
  }

  // Exercise Evaluation
  async evaluateExercise(
    userId: string,
    moduleId: string,
    exerciseId: string,
    response: unknown
  ): Promise<ExerciseResult> {
    const module = await this.prisma.learningModule.findUnique({
      where: { id: moduleId },
    });

    if (!module) {
      throw new Error('Learning module not found');
    }

    const exercises = module.exercises as Exercise[];
    const exercise = exercises.find(ex => ex.id === exerciseId);

    if (!exercise) {
      throw new Error('Exercise not found');
    }

    // Get current progress to track attempts
    const progress = await this.prisma.userProgress.findUnique({
      where: {
        userId_moduleId: { userId, moduleId },
      },
    });

    const existingResults = (progress?.exerciseResults as ExerciseResult[]) || [];
    const previousResult = existingResults.find(r => r.exerciseId === exerciseId);
    const attempts = previousResult ? previousResult.attempts + 1 : 1;

    // Calculate score based on exercise type
    const { score, maxScore, feedback } = this.calculateExerciseScore(exercise, response);

    const result: ExerciseResult = {
      exerciseId,
      score,
      maxScore,
      completedAt: new Date(),
      timeSpent: 0, // This would be tracked on the frontend
      attempts,
      feedback,
    };

    // Update user progress with exercise result
    const updatedResults = existingResults.filter(r => r.exerciseId !== exerciseId);
    updatedResults.push(result);

    await this.prisma.userProgress.upsert({
      where: {
        userId_moduleId: { userId, moduleId },
      },
      create: {
        userId,
        moduleId,
        status: ProgressStatus.IN_PROGRESS,
        exerciseResults: updatedResults,
        lastAccessed: new Date(),
      },
      update: {
        exerciseResults: updatedResults,
        lastAccessed: new Date(),
      },
    });

    return result;
  }

  private calculateExerciseScore(exercise: Exercise, _response: unknown): {
    score: number;
    maxScore: number;
    feedback: string;
  } {
    const maxScore = exercise.points;
    let score = 0;
    let feedback = '';

    switch (exercise.type) {
      case 'multiple_choice':
        const correctAnswer = exercise.metadata?.correctAnswer;
        if (response === correctAnswer) {
          score = maxScore;
          feedback = 'Correct! Well done.';
        } else {
          score = 0;
          feedback = `Incorrect. The correct answer was ${correctAnswer}. ${exercise.metadata?.explanation || ''}`;
        }
        break;

      case 'code_review':
        // Simple keyword-based scoring for code review
        const keywords = exercise.metadata?.keywords || [];
        const responseText = response.toLowerCase();
        const foundKeywords = keywords.filter((keyword: string) => 
          responseText.includes(keyword.toLowerCase())
        );
        
        score = Math.round((foundKeywords.length / keywords.length) * maxScore);
        feedback = `You identified ${foundKeywords.length} out of ${keywords.length} key issues. ${
          score >= maxScore * 0.8 ? 'Excellent analysis!' : 
          score >= maxScore * 0.6 ? 'Good work, but consider reviewing the hints for additional insights.' :
          'Review the code more carefully and consider the hints provided.'
        }`;
        break;

      case 'specification_writing':
        // Check for EARS format compliance
        const hasEarsFormat = /\b(when|if|then|shall)\b/i.test(response);
        const hasUserStory = /\bas\s+a\b.*\bi\s+want\b.*\bso\s+that\b/i.test(response);
        
        let specScore = 0;
        if (hasEarsFormat) specScore += maxScore * 0.6;
        if (hasUserStory) specScore += maxScore * 0.4;
        
        score = Math.round(specScore);
        feedback = `Your specification ${hasEarsFormat ? 'includes' : 'lacks'} EARS format and ${
          hasUserStory ? 'includes' : 'lacks'} proper user story structure. ${
          score >= maxScore * 0.8 ? 'Excellent work!' : 'Consider reviewing the requirements writing guidelines.'
        }`;
        break;

      case 'hands_on':
        // Basic length and keyword check for hands-on exercises
        const minLength = exercise.metadata?.minLength || 100;
        const requiredConcepts = exercise.metadata?.requiredConcepts || [];
        
        let handsOnScore = 0;
        if (response.length >= minLength) handsOnScore += maxScore * 0.5;
        
        const mentionedConcepts = requiredConcepts.filter((concept: string) =>
          response.toLowerCase().includes(concept.toLowerCase())
        );
        handsOnScore += (mentionedConcepts.length / requiredConcepts.length) * maxScore * 0.5;
        
        score = Math.round(handsOnScore);
        feedback = `Your response demonstrates ${
          score >= maxScore * 0.8 ? 'excellent' :
          score >= maxScore * 0.6 ? 'good' : 'basic'
        } understanding. ${
          mentionedConcepts.length === requiredConcepts.length ? 
          'You covered all key concepts.' :
          `Consider addressing: ${requiredConcepts.filter((c: string) => !mentionedConcepts.includes(c)).join(', ')}`
        }`;
        break;

      default:
        score = Math.round(maxScore * 0.5); // Default partial credit
        feedback = 'Response received and evaluated.';
    }

    return { score, maxScore, feedback };
  }

  // Skill Development Tracking
  async getSkillDevelopment(userId: string): Promise<SkillDevelopment> {
    const userProgress = await this.prisma.userProgress.findMany({
      where: { userId },
      include: {
        module: {
          select: {
            id: true,
            title: true,
            phase: true,
            difficulty: true,
          },
        },
      },
    });

    const skillLevels: Record<string, SkillLevel> = {};
    const competencyScores: Record<string, CompetencyScore> = {};
    const improvementAreas: string[] = [];
    const strengths: string[] = [];

    // Analyze skill assessments across all modules
    for (const progress of userProgress) {
      const assessments = progress.skillAssessments as SkillAssessment[];
      
      for (const assessment of assessments) {
        const skillId = assessment.skillId;
        const percentage = (assessment.score / assessment.maxScore) * 100;

        // Track skill level progression
        if (!skillLevels[skillId]) {
          skillLevels[skillId] = {
            skillId,
            skillName: assessment.skillName,
            currentLevel: assessment.level as DifficultyLevel,
            progression: [],
            averageScore: 0,
            assessmentCount: 0,
          };
        }

        skillLevels[skillId].progression.push({
          date: new Date(assessment.assessedAt),
          score: percentage,
          level: assessment.level as DifficultyLevel,
        });
        skillLevels[skillId].assessmentCount++;

        // Track competency scores
        for (const competency of assessment.competencies) {
          const compId = competency.competencyId;
          if (!competencyScores[compId]) {
            competencyScores[compId] = {
              competencyId: compId,
              name: competency.name,
              scores: [],
              averageScore: 0,
              trend: 'stable',
            };
          }
          competencyScores[compId].scores.push({
            score: (competency.score / competency.maxScore) * 100,
            date: new Date(assessment.assessedAt),
          });
        }

        // Identify strengths and improvement areas
        if (percentage >= 80) {
          if (!strengths.includes(assessment.skillName)) {
            strengths.push(assessment.skillName);
          }
        } else if (percentage < 60) {
          if (!improvementAreas.includes(assessment.skillName)) {
            improvementAreas.push(assessment.skillName);
          }
        }
      }
    }

    // Calculate averages and trends
    Object.values(skillLevels).forEach(skill => {
      const totalScore = skill.progression.reduce((sum, p) => sum + p.score, 0);
      skill.averageScore = totalScore / skill.progression.length;
    });

    Object.values(competencyScores).forEach(comp => {
      const totalScore = comp.scores.reduce((sum, s) => sum + s.score, 0);
      comp.averageScore = totalScore / comp.scores.length;
      
      // Calculate trend
      if (comp.scores.length >= 2) {
        const recent = comp.scores.slice(-3);
        const older = comp.scores.slice(0, -3);
        if (older.length > 0) {
          const recentAvg = recent.reduce((sum, s) => sum + s.score, 0) / recent.length;
          const olderAvg = older.reduce((sum, s) => sum + s.score, 0) / older.length;
          comp.trend = recentAvg > olderAvg + 5 ? 'improving' : 
                      recentAvg < olderAvg - 5 ? 'declining' : 'stable';
        }
      }
    });

    return {
      userId,
      skillLevels: Object.values(skillLevels),
      competencyScores: Object.values(competencyScores),
      overallProgress: {
        completedModules: userProgress.filter(p => p.status === ProgressStatus.COMPLETED).length,
        totalModules: userProgress.length,
        averageScore: Object.values(skillLevels).reduce((sum, s) => sum + s.averageScore, 0) / Object.values(skillLevels).length || 0,
      },
      strengths,
      improvementAreas,
      lastUpdated: new Date(),
    };
  }

  // Personalized Feedback
  async getPersonalizedFeedback(userId: string, moduleId?: string): Promise<PersonalizedFeedback> {
    const skillDevelopment = await this.getSkillDevelopment(userId);
    const recommendations: FeedbackRecommendation[] = [];
    const achievements: Achievement[] = [];

    // Generate recommendations based on skill development
    for (const skill of skillDevelopment.skillLevels) {
      if (skill.averageScore < 60) {
        recommendations.push({
          type: 'improvement',
          title: `Improve ${skill.skillName}`,
          description: `Your current average score is ${Math.round(skill.averageScore)}%. Focus on practicing this skill.`,
          priority: 'high',
          suggestedActions: [
            'Review the learning materials',
            'Practice with additional exercises',
            'Seek help from mentors or peers',
          ],
          relatedModules: [], // Would be populated with actual module IDs
        });
      } else if (skill.averageScore >= 90) {
        achievements.push({
          id: `mastery-${skill.skillId}`,
          title: `${skill.skillName} Mastery`,
          description: `You've achieved mastery in ${skill.skillName} with an average score of ${Math.round(skill.averageScore)}%`,
          icon: 'trophy',
          category: 'mastery',
          points: 100,
          unlockedAt: new Date().toISOString(),
        });
      }
    }

    // Check for improvement trends
    for (const competency of skillDevelopment.competencyScores) {
      if (competency.trend === 'improving') {
        recommendations.push({
          type: 'encouragement',
          title: `Great Progress in ${competency.name}`,
          description: `You're showing consistent improvement in ${competency.name}. Keep up the good work!`,
          priority: 'medium',
          suggestedActions: [
            'Continue current learning approach',
            'Challenge yourself with advanced exercises',
          ],
          relatedModules: [],
        });
      } else if (competency.trend === 'declining') {
        recommendations.push({
          type: 'warning',
          title: `Review ${competency.name}`,
          description: `Your performance in ${competency.name} has been declining. Consider reviewing the fundamentals.`,
          priority: 'high',
          suggestedActions: [
            'Review previous lessons',
            'Practice basic exercises',
            'Schedule regular review sessions',
          ],
          relatedModules: [],
        });
      }
    }

    // Learning path recommendations
    const nextModules = await this.getRecommendedModules(userId);
    if (nextModules.length > 0) {
      recommendations.push({
        type: 'next_steps',
        title: 'Continue Your Learning Journey',
        description: `Based on your progress, we recommend these next modules: ${nextModules.slice(0, 3).map(m => m.title).join(', ')}`,
        priority: 'medium',
        suggestedActions: [
          'Start with the recommended modules',
          'Complete prerequisites if needed',
        ],
        relatedModules: nextModules.slice(0, 3).map(m => m.id),
      });
    }

    return {
      userId,
      moduleId,
      recommendations,
      achievements,
      overallFeedback: this.generateOverallFeedback(skillDevelopment),
      generatedAt: new Date(),
    };
  }

  private generateOverallFeedback(skillDevelopment: SkillDevelopment): string {
    const { overallProgress, strengths, improvementAreas } = skillDevelopment;
    const completionRate = (overallProgress.completedModules / overallProgress.totalModules) * 100;

    let feedback = `You've completed ${overallProgress.completedModules} out of ${overallProgress.totalModules} modules (${Math.round(completionRate)}%). `;

    if (overallProgress.averageScore >= 80) {
      feedback += "You're performing excellently across all skills! ";
    } else if (overallProgress.averageScore >= 60) {
      feedback += "You're making good progress with room for improvement. ";
    } else {
      feedback += "Focus on strengthening your foundational skills. ";
    }

    if (strengths.length > 0) {
      feedback += `Your strengths include: ${strengths.slice(0, 3).join(', ')}. `;
    }

    if (improvementAreas.length > 0) {
      feedback += `Areas for improvement: ${improvementAreas.slice(0, 3).join(', ')}. `;
    }

    feedback += "Keep up the great work and continue learning!";

    return feedback;
  }
}

// Additional interfaces for skill development
export interface SkillDevelopment {
  userId: string;
  skillLevels: SkillLevel[];
  competencyScores: CompetencyScore[];
  overallProgress: {
    completedModules: number;
    totalModules: number;
    averageScore: number;
  };
  strengths: string[];
  improvementAreas: string[];
  lastUpdated: Date;
}

export interface SkillLevel {
  skillId: string;
  skillName: string;
  currentLevel: DifficultyLevel;
  progression: {
    date: Date;
    score: number;
    level: DifficultyLevel;
  }[];
  averageScore: number;
  assessmentCount: number;
}

export interface CompetencyScore {
  competencyId: string;
  name: string;
  scores: {
    score: number;
    date: Date;
  }[];
  averageScore: number;
  trend: 'improving' | 'declining' | 'stable';
}

export interface PersonalizedFeedback {
  userId: string;
  moduleId?: string;
  recommendations: FeedbackRecommendation[];
  achievements: Achievement[];
  overallFeedback: string;
  generatedAt: Date;
}

export interface FeedbackRecommendation {
  type: 'improvement' | 'encouragement' | 'warning' | 'next_steps';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  suggestedActions: string[];
  relatedModules: string[];
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'completion' | 'performance' | 'streak' | 'mastery';
  points: number;
  unlockedAt?: string;
  progress?: {
    current: number;
    target: number;
  };
}