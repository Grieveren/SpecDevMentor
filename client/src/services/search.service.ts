import { BaseService, typedApiClient } from './api.service';

export interface SearchResult {
  id: string;
  type: 'project' | 'document' | 'template' | 'comment';
  title: string;
  content: string;
  excerpt: string;
  score: number;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface SearchFacets {
  phases: Record<string, number>;
  statuses: Record<string, number>;
  types: Record<string, number>;
  authors: Array<{ id: string; name: string; count: number }>;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  facets: SearchFacets;
  suggestions: string[];
}

export interface SearchOptions {
  query?: string;
  phase?: string;
  status?: string;
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

export interface SearchAnalytics {
  topSearches: Array<{ term: string; count: number }>;
  totalSearches: number;
  uniqueSearchers: number;
}

export class SearchService extends BaseService {
  constructor() {
    super(typedApiClient);
  }

  /**
   * Perform search across specifications
   */
  async search(options: SearchOptions = {}): Promise<SearchResponse> {
    try {
      const params: Record<string, string> = {};

      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            params[key] = value.join(',');
          } else if (value instanceof Date) {
            params[key] = value.toISOString();
          } else {
            params[key] = value.toString();
          }
        }
      });

      const response = await this.apiClient.get<SearchResponse>('/search', { params });
      return this.validateResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get search suggestions
   */
  async getSuggestions(query: string): Promise<string[]> {
    if (!query || query.length < 2) return [];

    try {
      const response = await this.apiClient.get<{ suggestions: string[] }>('/search/suggestions', {
        params: { q: query },
      });
      return this.validateResponse(response).suggestions;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Advanced search with complex filters
   */
  async advancedSearch(
    filters: Record<string, any>,
    page = 1,
    limit = 20
  ): Promise<SearchResponse> {
    try {
      const response = await this.apiClient.post<SearchResponse>('/search/advanced', filters, {
        params: { page, limit },
      });
      return this.validateResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Search within a specific project
   */
  async searchProject(
    projectId: string,
    options: {
      query?: string;
      phase?: string;
      type?: string;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<SearchResponse> {
    try {
      const params: Record<string, string> = {};

      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params[key] = value.toString();
        }
      });

      const response = await this.apiClient.get<SearchResponse>(`/search/project/${projectId}`, { params });
      return this.validateResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Get search analytics (admin only)
   */
  async getAnalytics(): Promise<SearchAnalytics> {
    try {
      const response = await this.apiClient.get<SearchAnalytics>('/search/analytics');
      return this.validateResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Format search result type for display
   */
  formatResultType(type: string): string {
    switch (type) {
      case 'project':
        return 'Project';
      case 'document':
        return 'Document';
      case 'template':
        return 'Template';
      case 'comment':
        return 'Comment';
      default:
        return type;
    }
  }

  /**
   * Get icon for search result type
   */
  getResultTypeIcon(type: string): string {
    switch (type) {
      case 'project':
        return '📁';
      case 'document':
        return '📄';
      case 'template':
        return '📋';
      case 'comment':
        return '💬';
      default:
        return '📄';
    }
  }

  /**
   * Get color class for search result type
   */
  getResultTypeColor(type: string): string {
    switch (type) {
      case 'project':
        return 'text-blue-600 bg-blue-50';
      case 'document':
        return 'text-green-600 bg-green-50';
      case 'template':
        return 'text-purple-600 bg-purple-50';
      case 'comment':
        return 'text-orange-600 bg-orange-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  }

  /**
   * Highlight search terms in text
   */
  highlightSearchTerms(text: string, query: string): string {
    if (!query || !text) return text;

    const terms = query.toLowerCase().split(/\s+/);
    let highlightedText = text;

    terms.forEach(term => {
      if (term.length > 1) {
        const regex = new RegExp(`(${term})`, 'gi');
        highlightedText = highlightedText.replace(
          regex,
          '<mark class="bg-yellow-200 px-1 rounded">$1</mark>'
        );
      }
    });

    return highlightedText;
  }

  /**
   * Build search URL for navigation
   */
  buildSearchUrl(options: SearchOptions): string {
    const params = new URLSearchParams();

    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          params.append(key, value.join(','));
        } else if (value instanceof Date) {
          params.append(key, value.toISOString().split('T')[0]);
        } else {
          params.append(key, value.toString());
        }
      }
    });

    return `/search?${params.toString()}`;
  }

  /**
   * Parse search URL parameters
   */
  parseSearchUrl(searchParams: URLSearchParams): SearchOptions {
    const options: SearchOptions = {};

    const query = searchParams.get('query');
    if (query) options.query = query;

    const phase = searchParams.get('phase');
    if (phase) options.phase = phase;

    const status = searchParams.get('status');
    if (status) options.status = status;

    const ownerId = searchParams.get('ownerId');
    if (ownerId) options.ownerId = ownerId;

    const teamMemberId = searchParams.get('teamMemberId');
    if (teamMemberId) options.teamMemberId = teamMemberId;

    const tags = searchParams.get('tags');
    if (tags) options.tags = tags.split(',');

    const dateFrom = searchParams.get('dateFrom');
    if (dateFrom) options.dateFrom = new Date(dateFrom);

    const dateTo = searchParams.get('dateTo');
    if (dateTo) options.dateTo = new Date(dateTo);

    const sortBy = searchParams.get('sortBy') as SearchOptions['sortBy'];
    if (sortBy) options.sortBy = sortBy;

    const sortOrder = searchParams.get('sortOrder') as SearchOptions['sortOrder'];
    if (sortOrder) options.sortOrder = sortOrder;

    const page = searchParams.get('page');
    if (page) options.page = parseInt(page);

    const limit = searchParams.get('limit');
    if (limit) options.limit = parseInt(limit);

    return options;
  }
}

export const searchService = new SearchService();