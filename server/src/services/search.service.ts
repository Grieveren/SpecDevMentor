// @ts-nocheck
import { Prisma, PrismaClient, ProjectStatus, SpecificationPhase } from '@prisma/client';
import { Redis } from 'ioredis';

interface SearchOptions {
  query?: string;
  phase?: SpecificationPhase;
  status?: ProjectStatus;
  ownerId?: string;
  teamMemberId?: string;
  tags?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  sortBy?: 'relevance' | 'created' | 'updated' | 'name';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

interface SearchResult {
  id: string;
  type: 'project' | 'document' | 'template' | 'comment';
  title: string;
  content: string;
  excerpt: string;
  score: number;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

interface SearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  facets: {
    phases: Record<SpecificationPhase, number>;
    statuses: Record<ProjectStatus, number>;
    types: Record<string, number>;
    authors: Array<{ id: string; name: string; count: number }>;
  };
  suggestions: string[];
}

export class SearchService {
  private prisma: PrismaClient;
  private redis: Redis;
  private searchIndex: Map<string, unknown> = new Map();

  constructor(prisma: PrismaClient, redis: Redis) {
    this.prisma = prisma;
    this.redis = redis;
  }

  /**
   * Perform full-text search across specifications
   */
  async search(userId: string, options: SearchOptions = {}): Promise<SearchResponse> {
    const {
      query = '',
      phase,
      status,
      ownerId,
      teamMemberId,
      tags = [],
      dateFrom,
      dateTo,
      sortBy = 'relevance',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
    } = options;

    const skip = (page - 1) * limit;
    const cacheKey = this.generateCacheKey(userId, options);

    // Try to get cached results
    const cached = await this.getCachedResults(cacheKey);
    if (cached) {
      return cached;
    }

    // Build search results from different sources
    const [projectResults, documentResults, templateResults, commentResults] = await Promise.all([
      this.searchProjects(userId, query, options),
      this.searchDocuments(userId, query, options),
      this.searchTemplates(userId, query, options),
      this.searchComments(userId, query, options),
    ]);

    // Combine and score results
    let allResults = [...projectResults, ...documentResults, ...templateResults, ...commentResults];

    // Apply filters
    allResults = this.applyFilters(allResults, options);

    // Calculate relevance scores
    allResults = this.calculateRelevanceScores(allResults, query);

    // Sort results
    allResults = this.sortResults(allResults, sortBy, sortOrder);

    // Generate facets
    const facets = this.generateFacets(allResults);

    // Paginate results
    const paginatedResults = allResults.slice(skip, skip + limit);

    // Generate search suggestions
    const suggestions = await this.generateSuggestions(query);

    const response: SearchResponse = {
      results: paginatedResults,
      total: allResults.length,
      page,
      limit,
      pages: Math.ceil(allResults.length / limit),
      facets,
      suggestions,
    };

    // Cache results
    await this.cacheResults(cacheKey, response);

    return response;
  }

  /**
   * Search projects
   */
  private async searchProjects(
    userId: string,
    query: string,
    options: SearchOptions
  ): Promise<SearchResult[]> {
    // Build base access conditions
    const accessConditions: Prisma.SpecificationProjectWhereInput[] = [
      { ownerId: userId },
      { team: { some: { userId, status: 'ACTIVE' } } },
    ];

    // Build search conditions
    const searchConditions: Prisma.SpecificationProjectWhereInput[] = [];
    if (query) {
      searchConditions.push(
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } }
      );
    }

    // Combine access and search conditions
    const whereClause: Prisma.SpecificationProjectWhereInput = {
      AND: [
        { OR: accessConditions },
        ...(searchConditions.length > 0 ? [{ OR: searchConditions }] : []),
      ],
    };

    // Add additional filters
    if (options.status) {
      whereClause.status = options.status;
    }

    if (options.ownerId) {
      whereClause.ownerId = options.ownerId;
    }

    if (options.dateFrom || options.dateTo) {
      const dateFilter: Prisma.DateTimeFilter = {};
      if (options.dateFrom) dateFilter.gte = options.dateFrom;
      if (options.dateTo) dateFilter.lte = options.dateTo;
      whereClause.createdAt = dateFilter;
    }

    const projects = await this.prisma.specificationProject.findMany({
      where: whereClause,
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
        team: {
          where: { status: 'ACTIVE' },
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        documents: {
          select: { phase: true, status: true },
        },
        _count: {
          select: {
            documents: true,
            team: true,
          },
        },
      },
    });

    return projects.map(project => ({
      id: project.id,
      type: 'project' as const,
      title: project.name,
      content: project.description || '',
      excerpt: this.generateExcerpt(project.description || '', query),
      score: 0, // Will be calculated later
      metadata: {
        phase: project.currentPhase,
        status: project.status,
        owner: project.owner,
        teamSize: project._count.team,
        documentCount: project._count.documents,
        documents: project.documents,
      },
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    }));
  }

  /**
   * Search documents
   */
  private async searchDocuments(
    userId: string,
    query: string,
    options: SearchOptions
  ): Promise<SearchResult[]> {
    // Build where clause with proper type safety
    const whereClause: Prisma.SpecificationDocumentWhereInput = {
      project: {
        OR: [{ ownerId: userId }, { team: { some: { userId, status: 'ACTIVE' } } }],
      },
    };

    // Add content search if query provided
    if (query) {
      whereClause.content = { contains: query, mode: 'insensitive' };
    }

    // Add phase filter
    if (options.phase) {
      whereClause.phase = options.phase;
    }

    // Add date range filter
    if (options.dateFrom || options.dateTo) {
      const dateFilter: Prisma.DateTimeFilter = {};
      if (options.dateFrom) dateFilter.gte = options.dateFrom;
      if (options.dateTo) dateFilter.lte = options.dateTo;
      whereClause.updatedAt = dateFilter;
    }

    const documents = await this.prisma.specificationDocument.findMany({
      where: whereClause,
      include: {
        project: {
          select: {
            id: true,
            name: true,
            owner: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        comments: {
          where: { status: 'OPEN' },
          select: { id: true },
        },
        reviews: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { overallScore: true },
        },
      },
    });

    return documents.map(document => ({
      id: document.id,
      type: 'document' as const,
      title: `${document.project.name} - ${document.phase}`,
      content: document.content,
      excerpt: this.generateExcerpt(document.content, query),
      score: 0, // Will be calculated later
      metadata: {
        phase: document.phase,
        status: document.status,
        projectId: document.project.id,
        projectName: document.project.name,
        owner: document.project.owner,
        commentCount: document.comments.length,
        qualityScore: document.reviews[0]?.overallScore,
      },
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    }));
  }

  /**
   * Search templates
   */
  private async searchTemplates(
    userId: string,
    query: string,
    options: SearchOptions
  ): Promise<SearchResult[]> {
    // Build base access conditions
    const accessConditions: Prisma.TemplateWhereInput[] = [
      { isPublic: true },
      { authorId: userId },
      { teamShares: { some: { project: { team: { some: { userId } } } } } },
    ];

    // Build search conditions
    const searchConditions: Prisma.TemplateWhereInput[] = [];
    if (query) {
      searchConditions.push(
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { content: { contains: query, mode: 'insensitive' } }
      );
    }

    // Combine access and search conditions
    const whereClause: Prisma.TemplateWhereInput = {
      AND: [
        { OR: accessConditions },
        ...(searchConditions.length > 0 ? [{ OR: searchConditions }] : []),
      ],
    };

    // Add additional filters
    if (options.phase) {
      whereClause.phase = options.phase;
    }

    if (options.tags && options.tags.length > 0) {
      whereClause.tags = { hasSome: options.tags };
    }

    const templates = await this.prisma.template.findMany({
      where: whereClause,
      include: {
        author: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return templates.map(template => ({
      id: template.id,
      type: 'template' as const,
      title: template.name,
      content: template.content,
      excerpt: this.generateExcerpt(template.description, query),
      score: 0, // Will be calculated later
      metadata: {
        phase: template.phase,
        category: template.category,
        author: template.author,
        isPublic: template.isPublic,
        isOfficial: template.isOfficial,
        usageCount: template.usageCount,
        rating: template.rating,
        tags: template.tags,
      },
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    }));
  }

  /**
   * Search comments
   */
  private async searchComments(
    userId: string,
    query: string,
    options: SearchOptions
  ): Promise<SearchResult[]> {
    if (!query) return []; // Only search comments when there's a query

    const whereClause: Prisma.CommentWhereInput = {
      content: { contains: query, mode: 'insensitive' },
      thread: {
        document: {
          project: {
            OR: [{ ownerId: userId }, { team: { some: { userId, status: 'ACTIVE' } } }],
          },
        },
      },
    };

    if (options.dateFrom || options.dateTo) {
      const dateFilter: Prisma.DateTimeFilter = {};
      if (options.dateFrom) dateFilter.gte = options.dateFrom;
      if (options.dateTo) dateFilter.lte = options.dateTo;
      whereClause.createdAt = dateFilter;
    }

    const comments = await this.prisma.comment.findMany({
      where: whereClause,
      include: {
        author: {
          select: { id: true, name: true, email: true },
        },
        thread: {
          include: {
            document: {
              include: {
                project: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        },
      },
    });

    return comments.map(comment => ({
      id: comment.id,
      type: 'comment' as const,
      title: `Comment in ${comment.thread.document.project.name}`,
      content: comment.content,
      excerpt: this.generateExcerpt(comment.content, query),
      score: 0, // Will be calculated later
      metadata: {
        author: comment.author,
        documentId: comment.thread.document.id,
        projectId: comment.thread.document.project.id,
        projectName: comment.thread.document.project.name,
        phase: comment.thread.document.phase,
        threadStatus: comment.thread.status,
      },
      createdAt: comment.createdAt,
      updatedAt: comment.editedAt || comment.createdAt,
    }));
  }

  /**
   * Apply additional filters to results
   */
  private applyFilters(results: SearchResult[], options: SearchOptions): SearchResult[] {
    let filtered = results;

    if (options.teamMemberId) {
      filtered = filtered.filter(result => {
        if (result.type === 'project') {
          const team = result.metadata.team as
            | Array<{ user: { id: string; name: string; email: string } }>
            | undefined;
          return (
            result.metadata.owner.id === options.teamMemberId ||
            team?.some(member => member.user.id === options.teamMemberId)
          );
        }
        return result.metadata.author?.id === options.teamMemberId;
      });
    }

    return filtered;
  }

  /**
   * Calculate relevance scores for search results
   */
  private calculateRelevanceScores(results: SearchResult[], query: string): SearchResult[] {
    if (!query) {
      return results.map(result => ({ ...result, score: 1 }));
    }

    const queryTerms = query.toLowerCase().split(/\s+/);

    return results.map(result => {
      let score = 0;

      // Title matches are more important
      const titleLower = result.title.toLowerCase();
      queryTerms.forEach(term => {
        if (titleLower.includes(term)) {
          score += 3;
        }
      });

      // Content matches
      const contentLower = result.content.toLowerCase();
      queryTerms.forEach(term => {
        const matches = (contentLower.match(new RegExp(term, 'g')) || []).length;
        score += matches * 1;
      });

      // Boost based on result type
      switch (result.type) {
        case 'project':
          score *= 1.5;
          break;
        case 'document':
          score *= 1.2;
          break;
        case 'template':
          score *= 1.1;
          break;
        case 'comment':
          score *= 0.8;
          break;
      }

      // Boost recent content
      const daysSinceUpdate = (Date.now() - result.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate < 7) {
        score *= 1.2;
      } else if (daysSinceUpdate < 30) {
        score *= 1.1;
      }

      return { ...result, score: Math.max(score, 0.1) };
    });
  }

  /**
   * Sort search results
   */
  private sortResults(results: SearchResult[], sortBy: string, sortOrder: string): SearchResult[] {
    return results.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'relevance':
          comparison = b.score - a.score;
          break;
        case 'created':
          comparison = b.createdAt.getTime() - a.createdAt.getTime();
          break;
        case 'updated':
          comparison = b.updatedAt.getTime() - a.updatedAt.getTime();
          break;
        case 'name':
          comparison = a.title.localeCompare(b.title);
          break;
        default:
          comparison = b.score - a.score;
      }

      return sortOrder === 'asc' ? -comparison : comparison;
    });
  }

  /**
   * Generate search facets
   */
  private generateFacets(results: SearchResult[]): SearchResponse['facets'] {
    const facets = {
      phases: {} as Record<SpecificationPhase, number>,
      statuses: {} as Record<ProjectStatus, number>,
      types: {} as Record<string, number>,
      authors: [] as Array<{ id: string; name: string; count: number }>,
    };

    const authorCounts = new Map<string, { name: string; count: number }>();

    results.forEach(result => {
      // Count types
      facets.types[result.type] = (facets.types[result.type] || 0) + 1;

      // Count phases
      if (result.metadata.phase) {
        facets.phases[result.metadata.phase] = (facets.phases[result.metadata.phase] || 0) + 1;
      }

      // Count statuses
      if (result.metadata.status) {
        facets.statuses[result.metadata.status] =
          (facets.statuses[result.metadata.status] || 0) + 1;
      }

      // Count authors
      const author = result.metadata.author || result.metadata.owner;
      if (author) {
        const existing = authorCounts.get(author.id);
        if (existing) {
          existing.count++;
        } else {
          authorCounts.set(author.id, { name: author.name, count: 1 });
        }
      }
    });

    // Convert author counts to array and sort
    facets.authors = Array.from(authorCounts.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 authors

    return facets;
  }

  /**
   * Generate search suggestions
   */
  private async generateSuggestions(query: string): Promise<string[]> {
    if (!query || query.length < 2) return [];

    const suggestions: string[] = [];

    // Get common terms from recent searches
    const recentSearches = await this.redis.lrange('recent_searches', 0, 100);
    const filteredSearches = recentSearches
      .filter(search => search.toLowerCase().includes(query.toLowerCase()) && search !== query)
      .slice(0, 5);

    suggestions.push(...filteredSearches);

    // Add common specification terms
    const commonTerms = [
      'requirements',
      'design',
      'tasks',
      'implementation',
      'user story',
      'acceptance criteria',
      'architecture',
      'component',
      'interface',
      'data model',
      'testing',
      'security',
      'performance',
      'scalability',
    ];

    const matchingTerms = commonTerms
      .filter(term => term.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 3);

    suggestions.push(...matchingTerms);

    return Array.from(new Set(suggestions)).slice(0, 8);
  }

  /**
   * Generate excerpt from content
   */
  private generateExcerpt(content: string, query: string, maxLength = 200): string {
    if (!content) return '';

    if (!query) {
      return content.length > maxLength ? content.substring(0, maxLength) + '...' : content;
    }

    // Find the first occurrence of the query term
    const queryIndex = content.toLowerCase().indexOf(query.toLowerCase());

    if (queryIndex === -1) {
      return content.length > maxLength ? content.substring(0, maxLength) + '...' : content;
    }

    // Extract context around the query
    const start = Math.max(0, queryIndex - 50);
    const end = Math.min(content.length, queryIndex + query.length + 150);

    let excerpt = content.substring(start, end);

    if (start > 0) excerpt = '...' + excerpt;
    if (end < content.length) excerpt = excerpt + '...';

    return excerpt;
  }

  /**
   * Generate cache key for search results
   */
  private generateCacheKey(userId: string, options: SearchOptions): string {
    const key = `search:${userId}:${JSON.stringify(options)}`;
    return key.replace(/[^a-zA-Z0-9:]/g, '_');
  }

  /**
   * Get cached search results
   */
  private async getCachedResults(cacheKey: string): Promise<SearchResponse | null> {
    try {
      const cached = await this.redis.get(cacheKey);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Failed to get cached search results:', error);
      return null;
    }
  }

  /**
   * Cache search results
   */
  private async cacheResults(cacheKey: string, results: SearchResponse): Promise<void> {
    try {
      await this.redis.setex(cacheKey, 300, JSON.stringify(results)); // Cache for 5 minutes
    } catch (error) {
      console.error('Failed to cache search results:', error);
    }
  }

  /**
   * Record search query for analytics and suggestions
   */
  async recordSearch(userId: string, query: string): Promise<void> {
    if (!query || query.length < 2) return;

    try {
      // Add to recent searches
      await this.redis.lpush('recent_searches', query);
      await this.redis.ltrim('recent_searches', 0, 999); // Keep last 1000 searches

      // Record user search
      await this.redis.lpush(`user_searches:${userId}`, query);
      await this.redis.ltrim(`user_searches:${userId}`, 0, 99); // Keep last 100 user searches

      // Increment search count
      await this.redis.zincrby('search_terms', 1, query.toLowerCase());
    } catch (error) {
      console.error('Failed to record search:', error);
    }
  }

  /**
   * Get search analytics
   */
  async getSearchAnalytics(): Promise<{
    topSearches: Array<{ term: string; count: number }>;
    totalSearches: number;
    uniqueSearchers: number;
  }> {
    try {
      const topSearches = await this.redis.zrevrange('search_terms', 0, 9, 'WITHSCORES');
      const formattedTopSearches = [];

      for (let i = 0; i < topSearches.length; i += 2) {
        formattedTopSearches.push({
          term: topSearches[i],
          count: parseInt(topSearches[i + 1]),
        });
      }

      const totalSearches = await this.redis.llen('recent_searches');

      // Get unique searchers (approximate)
      const userKeys = await this.redis.keys('user_searches:*');
      const uniqueSearchers = userKeys.length;

      return {
        topSearches: formattedTopSearches,
        totalSearches,
        uniqueSearchers,
      };
    } catch (error) {
      console.error('Failed to get search analytics:', error);
      return {
        topSearches: [],
        totalSearches: 0,
        uniqueSearchers: 0,
      };
    }
  }
}
