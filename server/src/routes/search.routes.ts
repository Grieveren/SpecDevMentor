import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';import { query } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { SearchService } from '../services/search.service.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { validationMiddleware } from '../middleware/validation.middleware.js';
import RedisClient from '../utils/redis.js';

const router: ExpressRouter = Router();
const prisma = new PrismaClient();

// Initialize search service
let searchService: SearchService;

const initializeSearchService = async () => {
  const redis = await RedisClient.getInstance();
  searchService = new SearchService(prisma, redis);
};

// Initialize on module load
initializeSearchService();

/**
 * Search across specifications
 */
router.get(
  '/',
  authMiddleware,
  [
    query('q').optional().isString().trim(),
    query('phase').optional().isIn(['REQUIREMENTS', 'DESIGN', 'TASKS', 'IMPLEMENTATION']),
    query('status').optional().isIn(['ACTIVE', 'COMPLETED', 'ARCHIVED', 'SUSPENDED']),
    query('ownerId').optional().isString(),
    query('teamMemberId').optional().isString(),
    query('tags').optional().isString(),
    query('dateFrom').optional().isISO8601().toDate(),
    query('dateTo').optional().isISO8601().toDate(),
    query('sortBy').optional().isIn(['relevance', 'created', 'updated', 'name']),
    query('sortOrder').optional().isIn(['asc', 'desc']),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  validationMiddleware,
  async (req, res) => {
    try {
      const userId = req.user!.id;
      const {
        q: query,
        phase,
        status,
        ownerId,
        teamMemberId,
        tags,
        dateFrom,
        dateTo,
        sortBy,
        sortOrder,
        page,
        limit,
      } = req.query;

      // Parse tags if provided
      const parsedTags = tags ? (tags as string).split(',').map(tag => tag.trim()) : [];

      const searchOptions = {
        query: query as string,
        phase: phase as any,
        status: status as any,
        ownerId: ownerId as string,
        teamMemberId: teamMemberId as string,
        tags: parsedTags,
        dateFrom: dateFrom as Date,
        dateTo: dateTo as Date,
        sortBy: (sortBy as any) || 'relevance',
        sortOrder: (sortOrder as any) || 'desc',
        page: (page as number) || 1,
        limit: (limit as number) || 20,
      };

      const results = await searchService.search(userId, searchOptions);

      // Record search query for analytics
      if (query) {
        await searchService.recordSearch(userId, query as string);
      }

      res.json({
        success: true,
        data: results,
      });
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({
        success: false,
        message: 'Search failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * Get search suggestions
 */
router.get(
  '/suggestions',
  authMiddleware,
  [
    query('q').isString().isLength({ min: 1, max: 100 }).trim(),
  ],
  validationMiddleware,
  async (req, res) => {
    try {
      const { q: query } = req.query;

      // For now, we'll use the search service's suggestion logic
      // In a real implementation, you might want a dedicated suggestion service
      const mockResults = await searchService.search(req.user!.id, {
        query: query as string,
        limit: 1,
      });

      res.json({
        success: true,
        data: {
          suggestions: mockResults.suggestions,
        },
      });
    } catch (error) {
      console.error('Search suggestions error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get search suggestions',
      });
    }
  }
);

/**
 * Get search analytics (admin only)
 */
router.get(
  '/analytics',
  authMiddleware,
  async (req, res) => {
    try {
      if (req.user!.role !== 'ADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Admin access required',
        });
      }

      const analytics = await searchService.getSearchAnalytics();

      res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      console.error('Search analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get search analytics',
      });
    }
  }
);

/**
 * Advanced search with complex filters
 */
router.post(
  '/advanced',
  authMiddleware,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  validationMiddleware,
  async (req, res) => {
    try {
      const userId = req.user!.id;
      const { page = 1, limit = 20 } = req.query;
      
      const searchOptions = {
        ...req.body,
        page: page as number,
        limit: limit as number,
      };

      const results = await searchService.search(userId, searchOptions);

      // Record search query for analytics
      if (searchOptions.query) {
        await searchService.recordSearch(userId, searchOptions.query);
      }

      res.json({
        success: true,
        data: results,
      });
    } catch (error) {
      console.error('Advanced search error:', error);
      res.status(500).json({
        success: false,
        message: 'Advanced search failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * Search within a specific project
 */
router.get(
  '/project/:projectId',
  authMiddleware,
  [
    query('q').optional().isString().trim(),
    query('phase').optional().isIn(['REQUIREMENTS', 'DESIGN', 'TASKS', 'IMPLEMENTATION']),
    query('type').optional().isIn(['document', 'comment', 'template']),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  validationMiddleware,
  async (req, res) => {
    try {
      const userId = req.user!.id;
      const { projectId } = req.params;
      const { q: query, phase, type, page = 1, limit = 20 } = req.query;

      // First check if user has access to the project
      const _project = await prisma.specificationProject.findFirst({
        where: {
          id: projectId,
          OR: [
            { ownerId: userId },
            { team: { some: { userId, status: 'ACTIVE' } } },
          ],
        },
      });

      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found or access denied',
        });
      }

      // Perform search within the project
      const searchOptions = {
        query: query as string,
        phase: phase as any,
        page: page as number,
        limit: limit as number,
      };

      const results = await searchService.search(userId, searchOptions);

      // Filter results to only include items from this project
      const filteredResults = {
        ...results,
        results: results.results.filter(result => {
          if (result.type === 'project') {
            return result.id === projectId;
          }
          if (result.type === 'document' || result.type === 'comment') {
            return result.metadata.projectId === projectId;
          }
          return false; // Exclude templates from project-specific search
        }),
      };

      // Update total and pages based on filtered results
      filteredResults.total = filteredResults.results.length;
      filteredResults.pages = Math.ceil(filteredResults.total / (limit as number));

      res.json({
        success: true,
        data: filteredResults,
      });
    } catch (error) {
      console.error('Project search error:', error);
      res.status(500).json({
        success: false,
        message: 'Project search failed',
      });
    }
  }
);

export default router;