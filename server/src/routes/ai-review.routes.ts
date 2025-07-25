import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { validateRequest } from '../middleware/validation.middleware.js';
import { AIReviewService } from '../services/ai-review.service.js';
import { createAIService } from '../services/ai.service.js';
import { Redis } from 'ioredis';

const router = Router();

// Initialize services
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const aiService = createAIService(redis);
const aiReviewService = new AIReviewService(aiService);

/**
 * @route POST /api/ai-review/request
 * @desc Request AI review for a specification document
 * @access Private
 */
router.post(
  '/request',
  authenticateToken,
  [
    body('documentId').isString().notEmpty().withMessage('Document ID is required'),
    body('phase').isIn(['requirements', 'design', 'tasks']).withMessage('Invalid phase'),
    body('content').isString().notEmpty().withMessage('Content is required'),
    body('projectId').optional().isString(),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { documentId, phase, content, projectId } = req.body;
      const userId = req.user.id;

      const review = await aiReviewService.requestReview({
        documentId,
        phase,
        content,
        projectId,
        userId,
      });

      res.status(201).json({
        success: true,
        data: review,
        message: 'AI review requested successfully',
      });
    } catch (error) {
      console.error('AI review request error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to request AI review',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route GET /api/ai-review/:reviewId
 * @desc Get AI review by ID
 * @access Private
 */
router.get(
  '/:reviewId',
  authenticateToken,
  [param('reviewId').isString().notEmpty().withMessage('Review ID is required')],
  validateRequest,
  async (req, res) => {
    try {
      const { reviewId } = req.params;
      const userId = req.user.id;

      const review = await aiReviewService.getReview(reviewId, userId);

      if (!review) {
        return res.status(404).json({
          success: false,
          error: 'AI review not found',
        });
      }

      res.json({
        success: true,
        data: review,
      });
    } catch (error) {
      console.error('Get AI review error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve AI review',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route GET /api/ai-review/document/:documentId
 * @desc Get AI reviews for a specific document
 * @access Private
 */
router.get(
  '/document/:documentId',
  authenticateToken,
  [
    param('documentId').isString().notEmpty().withMessage('Document ID is required'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { documentId } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = parseInt(req.query.offset as string) || 0;
      const userId = req.user.id;

      const reviews = await aiReviewService.getDocumentReviews(documentId, userId, {
        limit,
        offset,
      });

      res.json({
        success: true,
        data: reviews,
      });
    } catch (error) {
      console.error('Get document reviews error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve document reviews',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route POST /api/ai-review/:reviewId/apply-suggestion
 * @desc Apply an AI suggestion to the document
 * @access Private
 */
router.post(
  '/:reviewId/apply-suggestion',
  authenticateToken,
  [
    param('reviewId').isString().notEmpty().withMessage('Review ID is required'),
    body('suggestionId').isString().notEmpty().withMessage('Suggestion ID is required'),
    body('documentContent').isString().notEmpty().withMessage('Document content is required'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { reviewId } = req.params;
      const { suggestionId, documentContent } = req.body;
      const userId = req.user.id;

      const result = await aiReviewService.applySuggestion({
        reviewId,
        suggestionId,
        documentContent,
        userId,
      });

      res.json({
        success: true,
        data: result,
        message: 'Suggestion applied successfully',
      });
    } catch (error) {
      console.error('Apply suggestion error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to apply suggestion',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route POST /api/ai-review/:reviewId/rollback-suggestion
 * @desc Rollback an applied AI suggestion
 * @access Private
 */
router.post(
  '/:reviewId/rollback-suggestion',
  authenticateToken,
  [
    param('reviewId').isString().notEmpty().withMessage('Review ID is required'),
    body('suggestionId').isString().notEmpty().withMessage('Suggestion ID is required'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const { reviewId } = req.params;
      const { suggestionId } = req.body;
      const userId = req.user.id;

      const result = await aiReviewService.rollbackSuggestion({
        reviewId,
        suggestionId,
        userId,
      });

      res.json({
        success: true,
        data: result,
        message: 'Suggestion rollback successful',
      });
    } catch (error) {
      console.error('Rollback suggestion error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to rollback suggestion',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route POST /api/ai-review/validate-ears
 * @desc Validate EARS format compliance
 * @access Private
 */
router.post(
  '/validate-ears',
  authenticateToken,
  [body('content').isString().notEmpty().withMessage('Content is required')],
  validateRequest,
  async (req, res) => {
    try {
      const { content } = req.body;

      const issues = await aiService.validateEARSFormat(content);

      res.json({
        success: true,
        data: { complianceIssues: issues },
      });
    } catch (error) {
      console.error('EARS validation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to validate EARS format',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route POST /api/ai-review/validate-user-stories
 * @desc Validate user story structure
 * @access Private
 */
router.post(
  '/validate-user-stories',
  authenticateToken,
  [body('content').isString().notEmpty().withMessage('Content is required')],
  validateRequest,
  async (req, res) => {
    try {
      const { content } = req.body;

      const issues = await aiService.validateUserStories(content);

      res.json({
        success: true,
        data: { complianceIssues: issues },
      });
    } catch (error) {
      console.error('User story validation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to validate user stories',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

export default router;