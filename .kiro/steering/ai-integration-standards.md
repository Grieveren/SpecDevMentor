# AI Integration Standards

## OpenAI API Integration Patterns

### Service Configuration

```typescript
// Centralized OpenAI client configuration
interface OpenAIConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  timeout: number;
  retryAttempts: number;
}

class OpenAIService {
  private client: OpenAI;
  private rateLimiter: RateLimiter;
  
  constructor(config: OpenAIConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      timeout: config.timeout
    });
    this.rateLimiter = new RateLimiter({
      tokensPerMinute: 90000,
      requestsPerMinute: 3500
    });
  }
  
  async generateCompletion(prompt: string, options?: CompletionOptions): Promise<string> {
    await this.rateLimiter.waitForToken();
    
    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: options?.maxTokens || this.config.maxTokens,
        temperature: options?.temperature || this.config.temperature
      });
      
      return response.choices[0]?.message?.content || '';
    } catch (error) {
      throw new AIServiceError('OpenAI API request failed', error);
    }
  }
}
```

### Specification Review Prompts

```typescript
// Standardized prompts for specification analysis
const SPECIFICATION_PROMPTS = {
  requirements: {
    review: `
Analyze the following requirements document for a specification-based development project.
Evaluate:
1. EARS format compliance (WHEN/IF/THEN structure)
2. User story completeness (As a/I want/So that)
3. Acceptance criteria clarity and testability
4. Missing edge cases or error conditions
5. Requirement traceability and numbering

Document:
{content}

Provide specific, actionable feedback with line references where possible.
`,
    
    validate: `
Validate this requirements document against specification best practices:
- Are all requirements testable and measurable?
- Do user stories follow proper format?
- Are acceptance criteria in EARS format?
- Are there any ambiguous or conflicting requirements?

Document:
{content}

Return a JSON response with validation results.
`
  },
  
  design: {
    review: `
Review this technical design document for completeness and quality:
1. Architecture clarity and scalability
2. Component interface definitions
3. Data model completeness
4. Error handling strategy
5. Testing approach coverage
6. Security considerations

Document:
{content}

Provide detailed feedback on improvements and missing elements.
`,
    
    compliance: `
Check if this design document addresses all requirements:

Requirements:
{requirements}

Design:
{design}

Identify any requirements not addressed in the design and suggest additions.
`
  }
};
```

### AI Review Result Processing

```typescript
// Structured AI review response handling
interface AIReviewResult {
  overallScore: number; // 0-100
  suggestions: AISuggestion[];
  completenessCheck: CompletenessResult;
  qualityMetrics: QualityMetrics;
  complianceIssues: ComplianceIssue[];
}

interface AISuggestion {
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

// AI suggestion application pattern
const useAISuggestions = (document: SpecificationDocument) => {
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [appliedSuggestions, setAppliedSuggestions] = useState<string[]>([]);
  
  const applySuggestion = async (suggestion: AISuggestion) => {
    if (suggestion.suggestedText && suggestion.originalText) {
      const updatedContent = document.content.replace(
        suggestion.originalText,
        suggestion.suggestedText
      );
      
      await updateDocument(document.id, updatedContent);
      setAppliedSuggestions(prev => [...prev, suggestion.id]);
    }
  };
  
  const revertSuggestion = async (suggestion: AISuggestion) => {
    // Implementation for reverting applied suggestions
  };
  
  return { suggestions, applySuggestion, revertSuggestion, appliedSuggestions };
};
```

## Error Handling for AI Services

### AI Service Error Types

```typescript
class AIServiceError extends Error {
  constructor(
    message: string,
    public originalError?: any,
    public errorCode?: AIErrorCode,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'AIServiceError';
  }
}

enum AIErrorCode {
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  API_KEY_INVALID = 'API_KEY_INVALID',
  CONTENT_FILTERED = 'CONTENT_FILTERED',
  TOKEN_LIMIT_EXCEEDED = 'TOKEN_LIMIT_EXCEEDED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  TIMEOUT = 'TIMEOUT'
}

// Retry logic for AI service calls
const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  backoffMs: number = 1000
): Promise<T> => {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
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
```

## Caching and Performance

### AI Response Caching

```typescript
// Cache AI responses to reduce API calls and costs
interface AICache {
  get(key: string): Promise<AIReviewResult | null>;
  set(key: string, result: AIReviewResult, ttl?: number): Promise<void>;
  invalidate(pattern: string): Promise<void>;
}

class RedisAICache implements AICache {
  constructor(private redis: Redis) {}
  
  async get(key: string): Promise<AIReviewResult | null> {
    const cached = await this.redis.get(`ai:${key}`);
    return cached ? JSON.parse(cached) : null;
  }
  
  async set(key: string, result: AIReviewResult, ttl: number = 3600): Promise<void> {
    await this.redis.setex(`ai:${key}`, ttl, JSON.stringify(result));
  }
}

// Generate cache keys based on content hash
const generateCacheKey = (content: string, reviewType: string): string => {
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  return `${reviewType}:${hash}`;
};
```

## Frontend AI Integration Patterns

### AI Review UI Components

```typescript
// Consistent AI review interface
const AIReviewPanel: React.FC<{
  review: AIReviewResult;
  onApplySuggestion: (suggestion: AISuggestion) => void;
  onDismiss: (suggestionId: string) => void;
}> = ({ review, onApplySuggestion, onDismiss }) => {
  return (
    <div className="bg-white border rounded-lg shadow-sm">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">AI Review</h3>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">Overall Score:</span>
            <ScoreIndicator score={review.overallScore} />
          </div>
        </div>
      </div>
      
      <div className="p-4 space-y-4">
        {review.suggestions.map(suggestion => (
          <SuggestionCard
            key={suggestion.id}
            suggestion={suggestion}
            onApply={() => onApplySuggestion(suggestion)}
            onDismiss={() => onDismiss(suggestion.id)}
          />
        ))}
      </div>
    </div>
  );
};

// Loading states for AI operations
const useAIReview = (documentId: string) => {
  const [isLoading, setIsLoading] = useState(false);
  const [review, setReview] = useState<AIReviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const requestReview = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await aiService.reviewDocument(documentId);
      setReview(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI review failed');
    } finally {
      setIsLoading(false);
    }
  };
  
  return { review, isLoading, error, requestReview };
};
```

## Security and Privacy

### Content Sanitization

```typescript
// Sanitize content before sending to AI services
const sanitizeForAI = (content: string): string => {
  // Remove or mask sensitive information
  return content
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]')
    .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD]')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[IP]');
};

// Audit logging for AI interactions
const logAIInteraction = async (interaction: {
  userId: string;
  documentId: string;
  action: string;
  tokensUsed: number;
  cost: number;
}) => {
  await auditLogger.log('ai_interaction', interaction);
};
```