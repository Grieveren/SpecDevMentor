// @ts-nocheck
import crypto from 'crypto';
import { Redis } from 'ioredis';
import OpenAI from 'openai';
import { RateLimiterMemory } from 'rate-limiter-flexible';

// Types and interfaces
export interface AIReviewResult {
  id: string;
  overallScore: number; // 0-100
  suggestions: AISuggestion[];
  completenessCheck: CompletenessResult;
  qualityMetrics: QualityMetrics;
  complianceIssues: ComplianceIssue[];
  generatedAt: Date;
}

export interface AISuggestion {
  id: string;
  type: 'improvement' | 'error' | 'warning' | 'enhancement';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  lineNumber?: number;
  originalText?: string;
  suggestedText?: string;
  reasoning: string;
  category: SuggestionCategory;
}

export interface CompletenessResult {
  score: number;
  missingElements: string[];
  recommendations: string[];
}

export interface QualityMetrics {
  clarity: number;
  completeness: number;
  consistency: number;
  testability: number;
  traceability: number;
}

export interface ComplianceIssue {
  id: string;
  type: 'ears_format' | 'user_story' | 'acceptance_criteria' | 'structure';
  severity: 'low' | 'medium' | 'high';
  description: string;
  lineNumber?: number;
  suggestion: string;
}

export type SuggestionCategory =
  | 'structure'
  | 'clarity'
  | 'completeness'
  | 'format'
  | 'best_practice'
  | 'security'
  | 'performance';

export type SpecificationPhase = 'requirements' | 'design' | 'tasks';

export enum AIErrorCode {
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  API_KEY_INVALID = 'API_KEY_INVALID',
  CONTENT_FILTERED = 'CONTENT_FILTERED',
  TOKEN_LIMIT_EXCEEDED = 'TOKEN_LIMIT_EXCEEDED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  TIMEOUT = 'TIMEOUT',
}

// Local AI error class tailored for AI service retries (matches tests)
export class AIServiceError extends Error {
  code: AIErrorCode;
  retryable: boolean;

  constructor(message: string, _unused: unknown = null, code: AIErrorCode, retryable = false) {
    super(message);
    this.name = 'AIServiceError';
    this.code = code;
    this.retryable = retryable;
  }
}

// Configuration interface
interface AIServiceConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  timeout: number;
  retryAttempts: number;
  rateLimitRpm: number; // requests per minute
  rateLimitTpm: number; // tokens per minute
}

// Cache interface
interface AICache {
  get(key: string): Promise<AIReviewResult | null>;
  set(key: string, result: AIReviewResult, ttl?: number): Promise<void>;
  invalidate(pattern: string): Promise<void>;
}

// Redis-based cache implementation
class RedisAICache implements AICache {
  constructor(private redis: Redis) {}

  async get(key: string): Promise<AIReviewResult | null> {
    try {
      const cached = await this.redis.get(`ai:${key}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set(key: string, result: AIReviewResult, ttl: number = 3600): Promise<void> {
    try {
      await this.redis.setex(`ai:${key}`, ttl, JSON.stringify(result));
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  async invalidate(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(`ai:${pattern}`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error('Cache invalidate error:', error);
    }
  }
}

// Main AI Service class
export class AIService {
  private client: OpenAI;
  private rateLimiter: RateLimiterMemory;
  private tokenRateLimiter: RateLimiterMemory;
  private cache: AICache;
  private config: AIServiceConfig;

  constructor(config: AIServiceConfig, redis: Redis) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      timeout: config.timeout,
    });

    // Rate limiters
    this.rateLimiter = new RateLimiterMemory({
      points: config.rateLimitRpm,
      duration: 60, // per minute
    });

    this.tokenRateLimiter = new RateLimiterMemory({
      points: config.rateLimitTpm,
      duration: 60, // per minute
    });

    this.cache = new RedisAICache(redis);
  }

  /**
   * Review a specification document
   */
  async reviewSpecification(
    content: string,
    phase: SpecificationPhase,
    projectId?: string
  ): Promise<AIReviewResult> {
    const cacheKey = this.generateCacheKey(content, phase);

    // Check cache first
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Sanitize content before sending to AI
    const sanitizedContent = this.sanitizeContent(content);

    // Get appropriate prompt for the phase
    const prompt = this.getReviewPrompt(phase, sanitizedContent);

    try {
      const response = await this.generateCompletion(prompt);
      const result = this.parseReviewResponse(response, phase);

      // Cache the result
      await this.cache.set(cacheKey, result);

      return result;
    } catch (_error) {
      const code = this.mapErrorCode(_error);
      const retryable = [AIErrorCode.RATE_LIMIT_EXCEEDED, AIErrorCode.SERVICE_UNAVAILABLE, AIErrorCode.TIMEOUT].includes(code);
      throw new AIServiceError(`Failed to review ${phase} specification`, null, code, retryable);
    }
  }

  /**
   * Validate EARS format compliance
   */
  async validateEARSFormat(content: string): Promise<ComplianceIssue[]> {
    const prompt = this.getEARSValidationPrompt(content);

    try {
      const response = await this.generateCompletion(prompt);
      return this.parseComplianceResponse(response);
    } catch (_error) {
      const code = this.mapErrorCode(_error);
      const retryable = [AIErrorCode.RATE_LIMIT_EXCEEDED, AIErrorCode.SERVICE_UNAVAILABLE, AIErrorCode.TIMEOUT].includes(code);
      throw new AIServiceError('Failed to validate EARS format', null, code, retryable);
    }
  }

  /**
   * Validate user story structure
   */
  async validateUserStories(content: string): Promise<ComplianceIssue[]> {
    const prompt = this.getUserStoryValidationPrompt(content);

    try {
      const response = await this.generateCompletion(prompt);
      return this.parseComplianceResponse(response);
    } catch (_error) {
      const code = this.mapErrorCode(_error);
      const retryable = [AIErrorCode.RATE_LIMIT_EXCEEDED, AIErrorCode.SERVICE_UNAVAILABLE, AIErrorCode.TIMEOUT].includes(code);
      throw new AIServiceError('Failed to validate user stories', null, code, retryable);
    }
  }

  /**
   * Generate completion with rate limiting and error handling
   */
  private async generateCompletion(prompt: string): Promise<string> {
    // Apply rate limiting
    await this.rateLimiter.consume('ai-service');

    // Estimate tokens and apply token rate limiting
    const estimatedTokens = Math.ceil(prompt.length / 4);
    await this.tokenRateLimiter.consume('ai-service', estimatedTokens);

    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
      });
      return response.choices[0]?.message?.content || '';
    } catch (_error: any) {
      const status = _error?.status;
      if (status === 429) {
        throw new AIServiceError('Rate limit exceeded', null, AIErrorCode.RATE_LIMIT_EXCEEDED, true);
      }
      if (status === 401) {
        throw new AIServiceError('Invalid API key', null, AIErrorCode.API_KEY_INVALID, false);
      }
      if (status === 400 && _error?.message?.includes('content_filter')) {
        throw new AIServiceError('Content filtered by OpenAI', null, AIErrorCode.CONTENT_FILTERED, false);
      }
      throw new AIServiceError('OpenAI API request failed', null, AIErrorCode.SERVICE_UNAVAILABLE, true);
    }
  }

  /**
   * Generate cache key based on content hash and phase
   */
  private generateCacheKey(content: string, phase: SpecificationPhase): string {
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    return `${phase}:${hash}`;
  }

  /**
   * Sanitize content before sending to AI
   */
  private sanitizeContent(content: string): string {
    return content
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]')
      .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD]')
      .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[IP]')
      .replace(/\b[A-Z0-9]{20,}\b/g, '[TOKEN]');
  }

  /**
   * Get review prompt based on phase
   */
  private getReviewPrompt(phase: SpecificationPhase, content: string): string {
    const prompts = {
      requirements: `
Analyze the following requirements document for a specification-based development project.
Evaluate and provide a JSON response with the following structure:

{
  "overallScore": number (0-100),
  "suggestions": [
    {
      "id": "unique-id",
      "type": "improvement|error|warning|enhancement",
      "severity": "low|medium|high|critical",
      "title": "Brief title",
      "description": "Detailed description",
      "lineNumber": number (optional),
      "originalText": "text to replace (optional)",
      "suggestedText": "replacement text (optional)",
      "reasoning": "Why this suggestion is important",
      "category": "structure|clarity|completeness|format|best_practice"
    }
  ],
  "completenessCheck": {
    "score": number (0-100),
    "missingElements": ["list of missing elements"],
    "recommendations": ["list of recommendations"]
  },
  "qualityMetrics": {
    "clarity": number (0-100),
    "completeness": number (0-100),
    "consistency": number (0-100),
    "testability": number (0-100),
    "traceability": number (0-100)
  },
  "complianceIssues": [
    {
      "id": "unique-id",
      "type": "ears_format|user_story|acceptance_criteria|structure",
      "severity": "low|medium|high",
      "description": "Issue description",
      "lineNumber": number (optional),
      "suggestion": "How to fix"
    }
  ]
}

Focus on:
1. EARS format compliance (WHEN/IF/THEN structure)
2. User story completeness (As a/I want/So that)
3. Acceptance criteria clarity and testability
4. Missing edge cases or error conditions
5. Requirement traceability and numbering

Document:
${content}
`,

      design: `
Review this technical design document and provide a JSON response with the same structure as requirements review.

Focus on:
1. Architecture clarity and scalability
2. Component interface definitions
3. Data model completeness
4. Error handling strategy
5. Testing approach coverage
6. Security considerations
7. Performance implications

Document:
${content}
`,

      tasks: `
Review this implementation task list and provide a JSON response with the same structure as requirements review.

Focus on:
1. Task clarity and actionability
2. Proper breakdown and sequencing
3. Dependencies and prerequisites
4. Test coverage requirements
5. Implementation feasibility
6. Missing integration points

Document:
${content}
`,
    };

    return prompts[phase];
  }

  /**
   * Get EARS format validation prompt
   */
  private getEARSValidationPrompt(content: string): string {
    return `
Validate the following content for EARS (Easy Approach to Requirements Syntax) format compliance.
Return a JSON array of compliance issues:

[
  {
    "id": "unique-id",
    "type": "ears_format",
    "severity": "low|medium|high",
    "description": "Issue description",
    "lineNumber": number (optional),
    "suggestion": "How to fix"
  }
]

EARS format rules:
- WHEN [event] THEN [system] SHALL [response]
- IF [precondition] THEN [system] SHALL [response]
- WHERE [feature] [system] SHALL [response]

Content:
${content}
`;
  }

  /**
   * Get user story validation prompt
   */
  private getUserStoryValidationPrompt(content: string): string {
    return `
Validate the following content for proper user story structure.
Return a JSON array of compliance issues:

[
  {
    "id": "unique-id",
    "type": "user_story",
    "severity": "low|medium|high",
    "description": "Issue description",
    "lineNumber": number (optional),
    "suggestion": "How to fix"
  }
]

User story format: "As a [role], I want [feature], so that [benefit]"

Content:
${content}
`;
  }

  /**
   * Parse AI review response
   */
  private parseReviewResponse(response: string, _phase: SpecificationPhase): AIReviewResult {
    try {
      const parsed = JSON.parse(response);

      return {
        id: crypto.randomUUID(),
        overallScore: parsed.overallScore || 0,
        suggestions: parsed.suggestions || [],
        completenessCheck: parsed.completenessCheck || {
          score: 0,
          missingElements: [],
          recommendations: [],
        },
        qualityMetrics: parsed.qualityMetrics || {
          clarity: 0,
          completeness: 0,
          consistency: 0,
          testability: 0,
          traceability: 0,
        },
        complianceIssues: parsed.complianceIssues || [],
        generatedAt: new Date(),
      };
    } catch (_error) {
      // Fallback if JSON parsing fails
      return {
        id: crypto.randomUUID(),
        overallScore: 50,
        suggestions: [
          {
            id: crypto.randomUUID(),
            type: 'warning',
            severity: 'medium',
            title: 'AI Response Parsing Failed',
            description: 'The AI service returned an invalid response format.',
            reasoning: 'Technical issue with AI service response parsing',
            category: 'structure',
          },
        ],
        completenessCheck: { score: 50, missingElements: [], recommendations: [] },
        qualityMetrics: {
          clarity: 50,
          completeness: 50,
          consistency: 50,
          testability: 50,
          traceability: 50,
        },
        complianceIssues: [],
        generatedAt: new Date(),
      };
    }
  }

  /**
   * Parse compliance response
   */
  private parseComplianceResponse(response: string): ComplianceIssue[] {
    try {
      return JSON.parse(response) || [];
    } catch (_error) {
      return [];
    }
  }

  /**
   * Map error to error code
   */
  private mapErrorCode(error: any): AIErrorCode {
    if (error?.status === 429) return AIErrorCode.RATE_LIMIT_EXCEEDED;
    if (error?.status === 401) return AIErrorCode.API_KEY_INVALID;
    if (error?.message?.includes?.('content_filter')) return AIErrorCode.CONTENT_FILTERED;
    if (error?.message?.includes?.('token')) return AIErrorCode.TOKEN_LIMIT_EXCEEDED;
    if (error?.code === 'ECONNABORTED') return AIErrorCode.TIMEOUT;
    return AIErrorCode.SERVICE_UNAVAILABLE;
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof AIServiceError) return error.retryable;
    const code = this.mapErrorCode(error);
    return [AIErrorCode.RATE_LIMIT_EXCEEDED, AIErrorCode.SERVICE_UNAVAILABLE, AIErrorCode.TIMEOUT].includes(code);
  }
}

/**
 * Retry logic for AI service calls
 */
export const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  backoffMs: number = 1000
): Promise<T> => {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error as Error;

      if (error instanceof AIServiceError && !error.retryable) {
        throw error;
      }

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, backoffMs * Math.pow(2, attempt)));
      }
    }
  }

  throw lastError!;
};

// Factory function to create AI service instance
export const createAIService = (redis: Redis): AIService => {
  const config: AIServiceConfig = {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4',
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '2000'),
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.3'),
    timeout: parseInt(process.env.OPENAI_TIMEOUT || '30000'),
    retryAttempts: parseInt(process.env.OPENAI_RETRY_ATTEMPTS || '3'),
    rateLimitRpm: parseInt(process.env.OPENAI_RATE_LIMIT_RPM || '60'),
    rateLimitTpm: parseInt(process.env.OPENAI_RATE_LIMIT_TPM || '90000'),
  };

  if (!config.apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }

  return new AIService(config, redis);
};
