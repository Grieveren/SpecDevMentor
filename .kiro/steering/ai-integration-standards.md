---
inclusion: always
---

# AI Integration Standards

## Core AI Service Patterns

### Required Service Structure

- All AI services MUST extend base `AIService` class with rate limiting
- Use centralized `OpenAIService` in `server/src/services/ai.service.ts`
- Implement proper error handling with `AIServiceError` types
- Cache responses using Redis with content-based keys
- Always sanitize content before sending to AI APIs

## Specification Review Standards

### Phase-Specific Review Criteria

**Requirements Phase:**
- EARS format compliance (WHEN/IF/THEN structure)
- User story completeness (As a/I want/So that)
- Acceptance criteria clarity and testability
- Edge cases and error conditions coverage

**Design Phase:**
- Architecture clarity and scalability
- Component interface definitions
- Data model completeness
- Security considerations

**Tasks Phase:**
- Implementation task breakdown
- Dependency identification
- Effort estimation accuracy

### AI Review Response Format

All AI reviews MUST return structured `AIReviewResult` with:
- `overallScore`: 0-100 numeric score
- `suggestions`: Array of actionable suggestions with line numbers
- `completenessCheck`: Missing elements analysis
- `qualityMetrics`: Measurable quality indicators

### Suggestion Types and Severity
- **Types**: `improvement`, `error`, `warning`, `enhancement`
- **Severity**: `low`, `medium`, `high`, `critical`
- Always include `reasoning` for suggestions
- Provide `originalText` and `suggestedText` when applicable

## Error Handling Requirements

### Mandatory Error Types
- `RATE_LIMIT_EXCEEDED`: Implement exponential backoff
- `TOKEN_LIMIT_EXCEEDED`: Split content or reduce context
- `CONTENT_FILTERED`: Log and provide user-friendly message
- `SERVICE_UNAVAILABLE`: Retry with circuit breaker pattern

### Retry Strategy
- Max 3 retries with exponential backoff
- Only retry on retryable errors
- Log all AI service failures for monitoring

## Performance and Caching

### Caching Strategy
- Cache all AI responses using content SHA-256 hash as key
- Default TTL: 1 hour for reviews, 24 hours for static analysis
- Invalidate cache on document updates
- Use Redis with `ai:` prefix for all AI-related cache keys

### Rate Limiting
- OpenAI: 90,000 tokens/minute, 3,500 requests/minute
- Implement token bucket algorithm
- Queue requests during rate limit periods

## Frontend Integration

### Required UI Components
- `AIReviewPanel`: Main review interface with score indicator
- `SuggestionCard`: Individual suggestion with apply/dismiss actions
- `ScoreIndicator`: Visual score representation (0-100)
- `QualityMetrics`: Detailed metrics display

### State Management
- Use `useAIReview` hook for review operations
- Implement loading states for all AI operations
- Handle errors gracefully with user-friendly messages
- Track applied suggestions to prevent re-application

## Security and Privacy

### Content Sanitization (MANDATORY)
Before sending any content to AI services:
- Mask emails: `[EMAIL]`
- Mask SSNs: `[SSN]`
- Mask credit cards: `[CARD]`
- Mask IP addresses: `[IP]`
- Remove API keys and secrets

### Audit Requirements
Log all AI interactions with:
- User ID and document ID
- Action performed
- Tokens used and estimated cost
- Response time and success status

### Data Retention
- AI responses cached for max 24 hours
- Audit logs retained for 90 days
- No persistent storage of user content in AI services
