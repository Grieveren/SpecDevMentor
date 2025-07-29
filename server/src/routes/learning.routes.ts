import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { LearningService } from '../services/learning.service';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();
const learningService = new LearningService(prisma);

// Validation schemas
const createModuleSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(200),
    description: z.string().min(1),
    phase: z.enum(['REQUIREMENTS', 'DESIGN', 'TASKS', 'IMPLEMENTATION']).optional(),
    difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']),
    prerequisites: z.array(z.string()).default([]),
    content: z.array(z.any()).default([]),
    exercises: z.array(z.any()).default([]),
    estimatedDuration: z.number().min(1),
    isPublished: z.boolean().default(false),
  }),
});

const updateModuleSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().min(1).optional(),
    phase: z.enum(['REQUIREMENTS', 'DESIGN', 'TASKS', 'IMPLEMENTATION']).optional(),
    difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']).optional(),
    prerequisites: z.array(z.string()).optional(),
    content: z.array(z.any()).optional(),
    exercises: z.array(z.any()).optional(),
    estimatedDuration: z.number().min(1).optional(),
    isPublished: z.boolean().optional(),
  }),
});

const updateProgressSchema = z.object({
  body: z.object({
    moduleId: z.string(),
    completedLessons: z.array(z.string()).optional(),
    exerciseResults: z.array(z.any()).optional(),
    skillAssessments: z.array(z.any()).optional(),
    status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED']).optional(),
  }),
});

const assessSkillSchema = z.object({
  params: z.object({
    moduleId: z.string(),
    skillId: z.string(),
  }),
  body: z.object({
    responses: z.record(z.any()),
  }),
});

// Learning Module Management Routes (Admin/Instructor only)
router.post(
  '/modules',
  authMiddleware,
  validateRequest(createModuleSchema),
  async (req, res) => {
    try {
      // Check if user has permission to create modules
      if (req.user.role !== 'ADMIN' && req.user.role !== 'TEAM_LEAD') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const module = await learningService.createModule(req.body);
      res.status(201).json({ success: true, data: module });
    } catch (error) {
      console.error('Error creating learning module:', error);
      res.status(400).json({ 
        error: error instanceof Error ? error.message : 'Failed to create module' 
      });
    }
  }
);

router.get('/modules', authMiddleware, async (req, res) => {
  try {
    const { phase, difficulty, search } = req.query;
    
    const filters: unknown = {};
    if (phase) filters.phase = phase as string;
    if (difficulty) filters.difficulty = difficulty as string;
    if (search) filters.search = search as string;

    const modules = await learningService.getModules(filters);
    res.json({ success: true, data: modules });
  } catch (error) {
    console.error('Error fetching learning modules:', error);
    res.status(500).json({ error: 'Failed to fetch modules' });
  }
});

router.get('/modules/:id', authMiddleware, async (req, res) => {
  try {
    const module = await learningService.getModule(req.params.id);
    
    if (!module) {
      return res.status(404).json({ error: 'Learning module not found' });
    }

    res.json({ success: true, data: module });
  } catch (error) {
    console.error('Error fetching learning module:', error);
    res.status(500).json({ error: 'Failed to fetch module' });
  }
});

router.put(
  '/modules/:id',
  authMiddleware,
  validateRequest(updateModuleSchema),
  async (req, res) => {
    try {
      // Check if user has permission to update modules
      if (req.user.role !== 'ADMIN' && req.user.role !== 'TEAM_LEAD') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const module = await learningService.updateModule(req.params.id, req.body);
      res.json({ success: true, data: module });
    } catch (error) {
      console.error('Error updating learning module:', error);
      res.status(400).json({ 
        error: error instanceof Error ? error.message : 'Failed to update module' 
      });
    }
  }
);

router.delete('/modules/:id', authMiddleware, async (req, res) => {
  try {
    // Check if user has permission to delete modules
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    await learningService.deleteModule(req.params.id);
    res.json({ success: true, message: 'Module deleted successfully' });
  } catch (error) {
    console.error('Error deleting learning module:', error);
    res.status(400).json({ 
      error: error instanceof Error ? error.message : 'Failed to delete module' 
    });
  }
});

// Progress Tracking Routes
router.get('/progress', authMiddleware, async (req, res) => {
  try {
    const { moduleId } = req.query;
    const progress = await learningService.getUserProgress(
      req.user.id,
      moduleId as string | undefined
    );
    
    res.json({ success: true, data: progress });
  } catch (error) {
    console.error('Error fetching user progress:', error);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

router.post(
  '/progress',
  authMiddleware,
  validateRequest(updateProgressSchema),
  async (req, res) => {
    try {
      const progress = await learningService.updateUserProgress(req.user.id, req.body);
      res.json({ success: true, data: progress });
    } catch (error) {
      console.error('Error updating user progress:', error);
      res.status(400).json({ 
        error: error instanceof Error ? error.message : 'Failed to update progress' 
      });
    }
  }
);

// Prerequisite Validation
router.get('/modules/:id/prerequisites', authMiddleware, async (req, res) => {
  try {
    const validation = await learningService.validatePrerequisites(
      req.user.id,
      req.params.id
    );
    
    res.json({ success: true, data: validation });
  } catch (error) {
    console.error('Error validating prerequisites:', error);
    res.status(500).json({ error: 'Failed to validate prerequisites' });
  }
});

// Recommendations
router.get('/recommendations', authMiddleware, async (req, res) => {
  try {
    const recommendations = await learningService.getRecommendedModules(req.user.id);
    res.json({ success: true, data: recommendations });
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
});

// Content Delivery
router.get('/modules/:moduleId/lessons/:lessonId', authMiddleware, async (req, res) => {
  try {
    const { moduleId, lessonId } = req.params;
    
    // Validate prerequisites first
    const prerequisiteValidation = await learningService.validatePrerequisites(
      req.user.id,
      moduleId
    );
    
    if (!prerequisiteValidation.canAccess) {
      return res.status(403).json({
        error: 'Prerequisites not met',
        missingPrerequisites: prerequisiteValidation.missingPrerequisites,
      });
    }

    const lesson = await learningService.getLessonContent(moduleId, lessonId);
    
    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    res.json({ success: true, data: lesson });
  } catch (error) {
    console.error('Error fetching lesson content:', error);
    res.status(500).json({ error: 'Failed to fetch lesson content' });
  }
});

router.get('/modules/:moduleId/exercises/:exerciseId', authMiddleware, async (req, res) => {
  try {
    const { moduleId, exerciseId } = req.params;
    
    // Validate prerequisites first
    const prerequisiteValidation = await learningService.validatePrerequisites(
      req.user.id,
      moduleId
    );
    
    if (!prerequisiteValidation.canAccess) {
      return res.status(403).json({
        error: 'Prerequisites not met',
        missingPrerequisites: prerequisiteValidation.missingPrerequisites,
      });
    }

    const exercise = await learningService.getExercise(moduleId, exerciseId);
    
    if (!exercise) {
      return res.status(404).json({ error: 'Exercise not found' });
    }

    res.json({ success: true, data: exercise });
  } catch (error) {
    console.error('Error fetching exercise:', error);
    res.status(500).json({ error: 'Failed to fetch exercise' });
  }
});

// Exercise Submission
router.post(
  '/modules/:moduleId/exercises/:exerciseId/submit',
  authMiddleware,
  async (req, res) => {
    try {
      const { moduleId, exerciseId } = req.params;
      const { response, submittedAt } = req.body;

      // Get the exercise to validate submission
      const exercise = await learningService.getExercise(moduleId, exerciseId);
      if (!exercise) {
        return res.status(404).json({ error: 'Exercise not found' });
      }

      // Calculate score based on exercise type and response
      const _result = await learningService.evaluateExercise(
        req.user.id,
        moduleId,
        exerciseId,
        response
      );

      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Error submitting exercise:', error);
      res.status(400).json({ 
        error: error instanceof Error ? error.message : 'Failed to submit exercise' 
      });
    }
  }
);

// Skill Assessment
router.post(
  '/modules/:moduleId/assess/:skillId',
  authMiddleware,
  validateRequest(assessSkillSchema),
  async (req, res) => {
    try {
      const { moduleId, skillId } = req.params;
      const { responses } = req.body;

      const assessment = await learningService.assessSkill(
        req.user.id,
        moduleId,
        skillId,
        responses
      );

      res.json({ success: true, data: assessment });
    } catch (error) {
      console.error('Error assessing skill:', error);
      res.status(400).json({ 
        error: error instanceof Error ? error.message : 'Failed to assess skill' 
      });
    }
  }
);

// Get skill development tracking
router.get('/skills/development', authMiddleware, async (req, res) => {
  try {
    const development = await learningService.getSkillDevelopment(req.user.id);
    res.json({ success: true, data: development });
  } catch (error) {
    console.error('Error fetching skill development:', error);
    res.status(500).json({ error: 'Failed to fetch skill development' });
  }
});

// Get personalized feedback
router.get('/feedback', authMiddleware, async (req, res) => {
  try {
    const { moduleId } = req.query;
    const feedback = await learningService.getPersonalizedFeedback(
      req.user.id,
      moduleId as string | undefined
    );
    res.json({ success: true, data: feedback });
  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

export default router;