import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SearchService } from '../services/search.service.js';

// Mock dependencies
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(),
}));

vi.mock('ioredis', () => ({
  Redis: vi.fn(),
}));

describe('SearchService', () => {
  let searchService: SearchService;
  let mockPrisma: any;
  let mockRedis: any;

  beforeEach(() => {
    mockPrisma = {
      specificationProject: {
        findMany: vi.fn(),
      },
      specificationDocument: {
        findMany: vi.fn(),
      },
      template: {
        findMany: vi.fn(),
      },
      comment: {
        findMany: vi.fn(),
      },
    };

    mockRedis = {
      get: vi.fn(),
      setex: vi.fn(),
      lpush: vi.fn(),
      ltrim: vi.fn(),
      zincrby: vi.fn(),
      llen: vi.fn(),
      keys: vi.fn(),
      lrange: vi.fn(),
      zrevrange: vi.fn(),
    };

    searchService = new SearchService(mockPrisma, mockRedis);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('search', () => {
    it('should perform comprehensive search across all content types', async () => {
      const mockProjects = [
        {
          id: 'project1',
          name: 'Test Project',
          description: 'A test project description',
          currentPhase: 'REQUIREMENTS',
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date(),
          owner: { id: 'user1', name: 'User 1', email: 'user1@example.com' },
          team: [],
          documents: [],
          _count: { documents: 1, team: 0 },
        },
      ];

      const mockDocuments = [
        {
          id: 'doc1',
          phase: 'REQUIREMENTS',
          status: 'DRAFT',
          content: 'This is a test document with requirements',
          createdAt: new Date(),
          updatedAt: new Date(),
          project: {
            id: 'project1',
            name: 'Test Project',
            owner: { id: 'user1', name: 'User 1' },
          },
          comments: [],
          reviews: [],
        },
      ];

      const mockTemplates = [
        {
          id: 'template1',
          name: 'Test Template',
          description: 'A test template',
          content: 'Template content for testing',
          phase: 'REQUIREMENTS',
          category: 'REQUIREMENTS',
          isPublic: true,
          isOfficial: false,
          usageCount: 5,
          rating: 4.5,
          tags: ['test', 'requirements'],
          createdAt: new Date(),
          updatedAt: new Date(),
          author: { id: 'user1', name: 'User 1', email: 'user1@example.com' },
        },
      ];

      const mockComments = [
        {
          id: 'comment1',
          content: 'This is a test comment',
          createdAt: new Date(),
          editedAt: null,
          author: { id: 'user1', name: 'User 1', email: 'user1@example.com' },
          thread: {
            status: 'OPEN',
            document: {
              id: 'doc1',
              phase: 'REQUIREMENTS',
              project: { id: 'project1', name: 'Test Project' },
            },
          },
        },
      ];

      mockPrisma.specificationProject.findMany.mockResolvedValue(mockProjects);
      mockPrisma.specificationDocument.findMany.mockResolvedValue(mockDocuments);
      mockPrisma.template.findMany.mockResolvedValue(mockTemplates);
      mockPrisma.comment.findMany.mockResolvedValue(mockComments);

      mockRedis.get.mockResolvedValue(null); // No cached results
      mockRedis.lrange.mockResolvedValue(['test search', 'another search']);

      const result = await searchService.search('user1', {
        query: 'test',
        page: 1,
        limit: 20,
      });

      expect(result.results).toHaveLength(4); // 1 project + 1 document + 1 template + 1 comment
      expect(result.total).toBe(4);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.pages).toBe(1);

      // Check that results have proper structure
      const projectResult = result.results.find(r => r.type === 'project');
      expect(projectResult).toBeDefined();
      expect(projectResult?.title).toBe('Test Project');
      expect(projectResult?.score).toBeGreaterThan(0);

      const documentResult = result.results.find(r => r.type === 'document');
      expect(documentResult).toBeDefined();
      expect(documentResult?.title).toBe('Test Project - REQUIREMENTS');

      const templateResult = result.results.find(r => r.type === 'template');
      expect(templateResult).toBeDefined();
      expect(templateResult?.title).toBe('Test Template');

      const commentResult = result.results.find(r => r.type === 'comment');
      expect(commentResult).toBeDefined();
      expect(commentResult?.title).toBe('Comment in Test Project');
    });

    it('should apply filters correctly', async () => {
      mockPrisma.specificationProject.findMany.mockResolvedValue([]);
      mockPrisma.specificationDocument.findMany.mockResolvedValue([]);
      mockPrisma.template.findMany.mockResolvedValue([]);
      mockPrisma.comment.findMany.mockResolvedValue([]);
      mockRedis.get.mockResolvedValue(null);
      mockRedis.lrange.mockResolvedValue([]);

      await searchService.search('user1', {
        query: 'test',
        phase: 'REQUIREMENTS',
        status: 'ACTIVE',
        dateFrom: new Date('2023-01-01'),
        dateTo: new Date('2023-12-31'),
      });

      // Check that filters were applied to project search
      expect(mockPrisma.specificationProject.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          status: 'ACTIVE',
          createdAt: {
            gte: new Date('2023-01-01'),
            lte: new Date('2023-12-31'),
          },
        }),
        include: expect.any(Object),
      });

      // Check that filters were applied to document search
      expect(mockPrisma.specificationDocument.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          phase: 'REQUIREMENTS',
          updatedAt: {
            gte: new Date('2023-01-01'),
            lte: new Date('2023-12-31'),
          },
        }),
        include: expect.any(Object),
      });
    });

    it('should calculate relevance scores correctly', async () => {
      const mockProjects = [
        {
          id: 'project1',
          name: 'Test Project with test in title',
          description: 'Description without the search term',
          currentPhase: 'REQUIREMENTS',
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date(),
          owner: { id: 'user1', name: 'User 1', email: 'user1@example.com' },
          team: [],
          documents: [],
          _count: { documents: 1, team: 0 },
        },
        {
          id: 'project2',
          name: 'Another Project',
          description: 'Description with test mentioned once',
          currentPhase: 'REQUIREMENTS',
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date(),
          owner: { id: 'user1', name: 'User 1', email: 'user1@example.com' },
          team: [],
          documents: [],
          _count: { documents: 1, team: 0 },
        },
      ];

      mockPrisma.specificationProject.findMany.mockResolvedValue(mockProjects);
      mockPrisma.specificationDocument.findMany.mockResolvedValue([]);
      mockPrisma.template.findMany.mockResolvedValue([]);
      mockPrisma.comment.findMany.mockResolvedValue([]);
      mockRedis.get.mockResolvedValue(null);
      mockRedis.lrange.mockResolvedValue([]);

      const result = await searchService.search('user1', {
        query: 'test',
        sortBy: 'relevance',
      });

      expect(result.results).toHaveLength(2);
      
      // The first result should have higher score due to title match
      const firstResult = result.results[0];
      const secondResult = result.results[1];
      
      expect(firstResult.score).toBeGreaterThan(secondResult.score);
      expect(firstResult.title).toContain('Test Project with test in title');
    });

    it('should generate facets correctly', async () => {
      const mockProjects = [
        {
          id: 'project1',
          name: 'Project 1',
          description: 'Description',
          currentPhase: 'REQUIREMENTS',
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date(),
          owner: { id: 'user1', name: 'User 1', email: 'user1@example.com' },
          team: [],
          documents: [],
          _count: { documents: 1, team: 0 },
        },
        {
          id: 'project2',
          name: 'Project 2',
          description: 'Description',
          currentPhase: 'DESIGN',
          status: 'COMPLETED',
          createdAt: new Date(),
          updatedAt: new Date(),
          owner: { id: 'user2', name: 'User 2', email: 'user2@example.com' },
          team: [],
          documents: [],
          _count: { documents: 1, team: 0 },
        },
      ];

      mockPrisma.specificationProject.findMany.mockResolvedValue(mockProjects);
      mockPrisma.specificationDocument.findMany.mockResolvedValue([]);
      mockPrisma.template.findMany.mockResolvedValue([]);
      mockPrisma.comment.findMany.mockResolvedValue([]);
      mockRedis.get.mockResolvedValue(null);
      mockRedis.lrange.mockResolvedValue([]);

      const result = await searchService.search('user1', { query: 'project' });

      expect(result.facets.phases).toEqual({
        REQUIREMENTS: 1,
        DESIGN: 1,
      });

      expect(result.facets.statuses).toEqual({
        ACTIVE: 1,
        COMPLETED: 1,
      });

      expect(result.facets.types).toEqual({
        project: 2,
      });

      expect(result.facets.authors).toHaveLength(2);
      expect(result.facets.authors[0].name).toBe('User 1');
      expect(result.facets.authors[1].name).toBe('User 2');
    });
  });

  describe('recordSearch', () => {
    it('should record search queries for analytics', async () => {
      await searchService.recordSearch('user1', 'test query');

      expect(mockRedis.lpush).toHaveBeenCalledWith('recent_searches', 'test query');
      expect(mockRedis.ltrim).toHaveBeenCalledWith('recent_searches', 0, 999);
      expect(mockRedis.lpush).toHaveBeenCalledWith('user_searches:user1', 'test query');
      expect(mockRedis.ltrim).toHaveBeenCalledWith('user_searches:user1', 0, 99);
      expect(mockRedis.zincrby).toHaveBeenCalledWith('search_terms', 1, 'test query');
    });

    it('should not record empty or short queries', async () => {
      await searchService.recordSearch('user1', '');
      await searchService.recordSearch('user1', 'a');

      expect(mockRedis.lpush).not.toHaveBeenCalled();
    });
  });

  describe('getSearchAnalytics', () => {
    it('should return search analytics', async () => {
      mockRedis.zrevrange.mockResolvedValue(['test', '5', 'query', '3']);
      mockRedis.llen.mockResolvedValue(100);
      mockRedis.keys.mockResolvedValue(['user_searches:user1', 'user_searches:user2']);

      const analytics = await searchService.getSearchAnalytics();

      expect(analytics).toEqual({
        topSearches: [
          { term: 'test', count: 5 },
          { term: 'query', count: 3 },
        ],
        totalSearches: 100,
        uniqueSearchers: 2,
      });
    });
  });
});