/**
 * Shared types index - exports all shared types for easy importing
 */
// API types
export * from './api';
// Error types (excluding ValidationError to avoid conflict with api.ts)
export { AIServiceError, AppError, AuthenticationError, AuthorizationError, ConflictError, DatabaseError, ErrorCode, ErrorSeverity, ExternalServiceError, InternalServerError, NetworkError, NotFoundError, RateLimitError, ServiceError, SpecificationError, createAuthenticationError, createAuthorizationError, createNotFoundError, createValidationError, isAIServiceError, isAppError, isAuthenticationError, isAuthorizationError, isConflictError, isDatabaseError, isErrorOfType, isExternalServiceError, isInternalServerError, isNetworkError, isNotFoundError, isRateLimitError, isServiceError, isSpecificationError, isValidationError, } from './errors';
// Re-export ValidationError from errors with alias to avoid conflict
export { ValidationError as ValidationErrorClass } from './errors';
//# sourceMappingURL=index.js.map