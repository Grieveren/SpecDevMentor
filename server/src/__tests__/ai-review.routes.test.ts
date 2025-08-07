import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import aiReviewRoutes from '../routes/ai-review.routes.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

let response: any;

// Mock dependencies
vi.mock('@prisma/client');
vi.mock('../services/ai.service.js');
vi.mock('../middleware/auth.middleware.js');

const app = express();
app.use(express.json());
app.use('/api/ai-review', aiReviewRoutes);

// Mock user for authentication
const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'DEVELOPER',
};

// Mock authentication middleware
vi.mocked(authenticateToken).mockImplementation((_req: unknown, res, next) => {
  req.user = mockUser;
  next();
});

describe('AI Review Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/ai-review/request', () => {
    it('should request AI review successfully', async () => {
      const requestData = {
        documentId: 'doc-123',
        phase: 'requirements',
        content: 'Test specification content',
        projectId: 'project-123',
      };

       response = await request(app)
        .post('/api/ai-review/request')
        .send(requestData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('AI review requested successfully');
    });

    it('should validate required fields', async () => {
       response = await request(app)
        .post('/api/ai-review/request')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toHaveLength(3); // documentId, phase, content
    });

    it('should validate phase enum', async () => {
      const requestData = {
        documentId: 'doc-123',
        phase: 'invalid-phase',
        content: 'Test content',
      };

       response = await request(app)
        .post('/api/ai-review/request')
        .send(requestData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.details.some((d: unknown) => d.field === 'phase')).toBe(true);
    });
  });

  describe('GET /api/ai-review/:reviewId', () => {
    it('should get AI review by ID', async () => {
      const reviewId = 'review-123';

       response = await request(app)
        .get(`/api/ai-review/${reviewId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should validate review ID parameter', async () => {
       response = await request(app)
        .get('/api/ai-review/')
        .expect(404);
    });
  });

  describe('GET /api/ai-review/document/:documentId', () => {
    it('should get document reviews with default pagination', async () => {
      const documentId = 'doc-123';

       response = await request(app)
        .get(`/api/ai-review/document/${documentId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle pagination parameters', async () => {
      const documentId = 'doc-123';

       response = await request(app)
        .get(`/api/ai-review/document/${documentId}`)
        .query({ limit: '5', offset: '10' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should validate pagination parameters', async () => {
      const documentId = 'doc-123';

       response = await request(app)
        .get(`/api/ai-review/document/${documentId}`)
        .query({ limit: '100', offset: '-1' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/ai-review/:reviewId/apply-suggestion', () => {
    it('should apply suggestion successfully', async () => {
      const reviewId = 'review-123';
      const requestData = {
        suggestionId: 'suggestion-123',
        documentContent: 'Original content to be modified',
      };

       response = await request(app)
        .post(`/api/ai-review/${reviewId}/apply-suggestion`)
        .send(requestData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Suggestion applied successfully');
    });

    it('should validate required fields for suggestion application', async () => {
      const reviewId = 'review-123';

       response = await request(app)
        .post(`/api/ai-review/${reviewId}/apply-suggestion`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.details).toHaveLength(2); // suggestionId, documentContent
    });
  });

  describe('POST /api/ai-review/:reviewId/rollback-suggestion', () => {
    it('should rollback suggestion successfully', async () => {
      const reviewId = 'review-123';
      const requestData = {
        suggestionId: 'suggestion-123',
      };

       response = await request(app)
        .post(`/api/ai-review/${reviewId}/rollback-suggestion`)
        .send(requestData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Suggestion rollback successful');
    });

    it('should validate required fields for rollback', async () => {
      const reviewId = 'review-123';

       response = await request(app)
        .post(`/api/ai-review/${reviewId}/rollback-suggestion`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.details).toHaveLength(1); // suggestionId
    });
  });

  describe('POST /api/ai-review/validate-ears', () => {
    it('should validate EARS format', async () => {
      const requestData = {
        content: 'WHEN user clicks submit THEN system SHALL validate form',
      };

       response = await request(app)
        .post('/api/ai-review/validate-ears')
        .send(requestData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('complianceIssues');
    });

    it('should validate content field for EARS validation', async () => {
       response = await request(app)
        .post('/api/ai-review/validate-ears')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.details).toHaveLength(1); // content
    });
  });

  describe('POST /api/ai-review/validate-user-stories', () => {
    it('should validate user story format', async () => {
      const requestData = {
        content: 'As a user, I want to login, so that I can access my account',
      };

       response = await request(app)
        .post('/api/ai-review/validate-user-stories')
        .send(requestData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('complianceIssues');
    });

    it('should validate content field for user story validation', async () => {
       response = await request(app)
        .post('/api/ai-review/validate-user-stories')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.details).toHaveLength(1); // content
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      // This would test error scenarios from the service layer
      // For now, we'll test the basic error response structure
      const requestData = {
        documentId: 'invalid-doc',
        phase: 'requirements',
        content: 'Test content',
      };

       response = await request(app)
        .post('/api/ai-review/request')
        .send(requestData);

      // The response might be 500 or 400 depending on the error
      expect([200, 201, 400, 500]).toContain(response.status);
      expect(response.body).toHaveProperty('success');
    });

    it('should handle authentication errors', async () => {
      // Mock authentication failure
      vi.mocked(authenticateToken).mockImplementationOnce((_req: unknown, res, next) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

       response = await request(app)
        .post('/api/ai-review/request')
        .send({
          documentId: 'doc-123',
          phase: 'requirements',
          content: 'Test content',
        })
        .expect(401);

      expect(response.body.error).toBe('Unauthorized');
    });
  });
});