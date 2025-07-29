import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Redis } from 'ioredis';
import OpenAI from 'openai';
import { 
  AIService, 
  AIServiceError, 
  AIErrorCode, 
  withRetry,
  createAIService,
  type AIReviewResult,
  type ComplianceIssue 
} from '../services/ai.service.js';

// Mock OpenAI
vi.mock('openai');
const MockedOpenAI = vi.mocked(OpenAI);

// Mock Redis
vi.mock('ioredis');
const MockedRedis = vi.mocked(Redis);

// Mock rate limiter with proper implementation
const mockRateLimiter = {
  consume: vi.fn(),
};

vi.mock('rate-limiter-flexible', () => ({
  RateLimiterMemory: vi.fn().mockImplementation(() => mockRateLimiter),
}));

describe('AIService', () => {
  let aiService: AIService;
  let mockOpenAI: unknown;
  let mockRedis: unknown;

  const mockConfig = {
    apiKey: 'test-api-key',
    model: 'gpt-4',
    maxTokens: 2000,
    temperature: 0.3,
    timeout: 30000,
    retryAttempts: 3,
    rateLimitRpm: 60,
    rateLimitTpm: 90000,
  };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Reset rate limiter mock to resolve successfully
    mockRateLimiter.consume.mockResolvedValue(undefined);

    // Mock Redis instance
    mockRedis = {
      get: vi.fn(),
      setex: vi.fn(),
      keys: vi.fn(),
      del: vi.fn(),
    };

    // Mock OpenAI instance
    mockOpenAI = {
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
    };

    MockedOpenAI.mockImplementation(() => mockOpenAI);
    MockedRedis.mockImplementation(() => mockRedis);

    aiService = new AIService(mockConfig, mockRedis as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('reviewSpecification', () => {
    const mockContent = `
# Requirements Document

## Requirement 1
**User Story:** As a developer, I want to create specifications, so that I can document requirements.

### Acceptance Criteria
1. WHEN a user creates a specification THEN the system SHALL save it to the database
2. IF the specification is invalid THEN the system SHALL display validation errors
`;

    const mockAIResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            overallScore: 85,
            suggestions: [
              {
                id: 'suggestion-1',
                type: 'improvement',
                severity: 'medium',
                title: 'Add more specific acceptance criteria',
                description: 'The acceptance criteria could be more detailed',
                lineNumber: 8,
                reasoning: 'More specific criteria improve testability',
                category: 'completeness'
              }
            ],
            completenessCheck: {
              score: 80,
              missingElements: ['Error handling scenarios'],
              recommendations: ['Add edge case handling']
            },
            qualityMetrics: {
              clarity: 85,
              completeness: 80,
              consistency: 90,
              testability: 75,
              traceability: 85
            },
            complianceIssues: []
          })
        }
      }]
    };

    it('should successfully review requirements specification', async () => {
      // Mock cache miss
      mockRedis.get.mockResolvedValue(null);
      
      // Mock successful AI response
      mockOpenAI.chat.completions.create.mockResolvedValue(mockAIResponse);
      
      // Mock cache set
      mockRedis.setex.mockResolvedValue('OK');

      const _result = await aiService.reviewSpecification(mockContent, 'requirements');

      expect(result).toBeDefined();
      expect(result.overallScore).toBe(85);
      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].title).toBe('Add more specific acceptance criteria');
      expect(result.completenessCheck.score).toBe(80);
      expect(result.qualityMetrics.clarity).toBe(85);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledOnce();
      expect(mockRedis.setex).toHaveBeenCalledOnce();
    });

    it('should return cached result when available', async () => {
      const cachedResult: AIReviewResult = {
        id: 'cached-id',
        overallScore: 90,
        suggestions: [],
        completenessCheck: { score: 90, missingElements: [], recommendations: [] },
        qualityMetrics: { clarity: 90, completeness: 90, consistency: 90, testability: 90, traceability: 90 },
        complianceIssues: [],
        generatedAt: new Date(),
      };

      // Mock cache hit
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedResult));

      const _result = await aiService.reviewSpecification(mockContent, 'requirements');

      expect(result.overallScore).toBe(90);
      expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
      expect(mockRedis.get).toHaveBeenCalledOnce();
    });

    it('should sanitize sensitive content before sending to AI', async () => {
      const sensitiveContent = `
Email: user@example.com
SSN: 123-45-6789
Credit Card: 1234 5678 9012 3456
IP: 192.168.1.1
Token: ABCDEFGHIJKLMNOPQRSTUVWXYZ123456
`;

      mockRedis.get.mockResolvedValue(null);
      mockOpenAI.chat.completions.create.mockResolvedValue(mockAIResponse);

      await aiService.reviewSpecification(sensitiveContent, 'requirements');

      const calledPrompt = mockOpenAI.chat.completions.create.mock.calls[0][0].messages[0].content;
      expect(calledPrompt).toContain('[EMAIL]');
      expect(calledPrompt).toContain('[SSN]');
      expect(calledPrompt).toContain('[CARD]');
      expect(calledPrompt).toContain('[IP]');
      expect(calledPrompt).toContain('[TOKEN]');
      expect(calledPrompt).not.toContain('user@example.com');
      expect(calledPrompt).not.toContain('123-45-6789');
    });

    it('should handle malformed AI response gracefully', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'Invalid JSON response' } }]
      });

      const _result = await aiService.reviewSpecification(mockContent, 'requirements');

      expect(result.overallScore).toBe(50);
      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].title).toBe('AI Response Parsing Failed');
    });
  });

  describe('validateEARSFormat', () => {
    const mockContent = `
1. WHEN a user clicks submit THEN the system SHALL validate the form
2. The system should process the request
3. IF the user is authenticated THEN the system SHALL allow access
`;

    const mockComplianceResponse = {
      choices: [{
        message: {
          content: JSON.stringify([
            {
              id: 'ears-1',
              type: 'ears_format',
              severity: 'medium',
              description: 'Statement 2 does not follow EARS format',
              lineNumber: 2,
              suggestion: 'Rewrite as: WHEN a user submits a request THEN the system SHALL process it'
            }
          ])
        }
      }]
    };

    it('should validate EARS format and return compliance issues', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue(mockComplianceResponse);

      const _result = await aiService.validateEARSFormat(mockContent);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('ears_format');
      expect(result[0].description).toBe('Statement 2 does not follow EARS format');
      expect(result[0].lineNumber).toBe(2);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('EARS (Easy Approach to Requirements Syntax)')
            })
          ])
        })
      );
    });

    it('should handle empty compliance response', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: '[]' } }]
      });

      const _result = await aiService.validateEARSFormat(mockContent);

      expect(result).toHaveLength(0);
    });

    it('should handle malformed compliance response', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'Invalid JSON' } }]
      });

      const _result = await aiService.validateEARSFormat(mockContent);

      expect(result).toHaveLength(0);
    });
  });

  describe('validateUserStories', () => {
    const mockContent = `
**User Story:** As a developer, I want to create specifications, so that I can document requirements.
**User Story:** I want to save my work
**User Story:** As a user, I want to login so that I can access my account.
`;

    const mockUserStoryResponse = {
      choices: [{
        message: {
          content: JSON.stringify([
            {
              id: 'story-1',
              type: 'user_story',
              severity: 'high',
              description: 'User story 2 is missing role and benefit',
              lineNumber: 2,
              suggestion: 'Rewrite as: As a [role], I want to save my work, so that [benefit]'
            }
          ])
        }
      }]
    };

    it('should validate user stories and return compliance issues', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValue(mockUserStoryResponse);

      const _result = await aiService.validateUserStories(mockContent);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('user_story');
      expect(result[0].description).toBe('User story 2 is missing role and benefit');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('As a [role], I want [feature], so that [benefit]')
            })
          ])
        })
      );
    });
  });

  describe('Cache Operations', () => {
    it('should handle cache errors gracefully', async () => {
      const mockContent = 'Test content';
      
      // Mock cache error
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));
      mockRedis.setex.mockRejectedValue(new Error('Redis connection failed'));
      
      // Mock successful AI response
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              overallScore: 75,
              suggestions: [],
              completenessCheck: { score: 75, missingElements: [], recommendations: [] },
              qualityMetrics: { clarity: 75, completeness: 75, consistency: 75, testability: 75, traceability: 75 },
              complianceIssues: []
            })
          }
        }]
      });

      // Should not throw error despite cache failures
      const _result = await aiService.reviewSpecification(mockContent, 'requirements');
      
      expect(result.overallScore).toBe(75);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledOnce();
    });
  });
});

describe('withRetry', () => {
  it('should retry retryable operations', async () => {
    let attempts = 0;
    const operation = vi.fn().mockImplementation(() => {
      attempts++;
      if (attempts < 3) {
        throw new AIServiceError('Temporary failure', null, AIErrorCode.SERVICE_UNAVAILABLE, true);
      }
      return 'success';
    });

    const _result = await withRetry(operation, 3, 10);

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('should not retry non-retryable operations', async () => {
    const operation = vi.fn().mockRejectedValue(
      new AIServiceError('Invalid API key', null, AIErrorCode.API_KEY_INVALID, false)
    );

    await expect(withRetry(operation, 3, 10)).rejects.toThrow(AIServiceError);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should throw last error after max retries', async () => {
    const operation = vi.fn().mockRejectedValue(
      new AIServiceError('Service unavailable', null, AIErrorCode.SERVICE_UNAVAILABLE, true)
    );

    await expect(withRetry(operation, 2, 10)).rejects.toThrow(AIServiceError);
    expect(operation).toHaveBeenCalledTimes(3); // initial + 2 retries
  });
});

describe('createAIService', () => {
  beforeEach(() => {
    // Set environment variables
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.OPENAI_MODEL = 'gpt-4';
    process.env.OPENAI_MAX_TOKENS = '2000';
    process.env.OPENAI_TEMPERATURE = '0.3';
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
    delete process.env.OPENAI_MAX_TOKENS;
    delete process.env.OPENAI_TEMPERATURE;
  });

  it('should create AI service with environment configuration', () => {
    const mockRedis = {} as Redis;
    
    const service = createAIService(mockRedis);
    
    expect(service).toBeInstanceOf(AIService);
    expect(MockedOpenAI).toHaveBeenCalledWith({
      apiKey: 'test-key',
      timeout: 30000,
    });
  });

  it('should throw error when API key is missing', () => {
    delete process.env.OPENAI_API_KEY;
    const mockRedis = {} as Redis;
    
    expect(() => createAIService(mockRedis)).toThrow('OPENAI_API_KEY environment variable is required');
  });

  it('should use default values for optional environment variables', () => {
    // Only set required API key
    process.env.OPENAI_API_KEY = 'test-key';
    delete process.env.OPENAI_MODEL;
    delete process.env.OPENAI_MAX_TOKENS;
    delete process.env.OPENAI_TEMPERATURE;
    
    const mockRedis = {} as Redis;
    const service = createAIService(mockRedis);
    
    expect(service).toBeInstanceOf(AIService);
  });
});