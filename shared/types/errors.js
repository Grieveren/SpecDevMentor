/**
 * Shared error types and classes for consistent error handling
 */
// Base error codes
export var ErrorCode;
(function (ErrorCode) {
    // Generic errors
    ErrorCode["UNKNOWN_ERROR"] = "UNKNOWN_ERROR";
    ErrorCode["VALIDATION_ERROR"] = "VALIDATION_ERROR";
    ErrorCode["NOT_FOUND"] = "NOT_FOUND";
    ErrorCode["UNAUTHORIZED"] = "UNAUTHORIZED";
    ErrorCode["FORBIDDEN"] = "FORBIDDEN";
    ErrorCode["CONFLICT"] = "CONFLICT";
    ErrorCode["RATE_LIMITED"] = "RATE_LIMITED";
    // Authentication errors
    ErrorCode["INVALID_CREDENTIALS"] = "INVALID_CREDENTIALS";
    ErrorCode["TOKEN_EXPIRED"] = "TOKEN_EXPIRED";
    ErrorCode["TOKEN_INVALID"] = "TOKEN_INVALID";
    ErrorCode["ACCOUNT_LOCKED"] = "ACCOUNT_LOCKED";
    // Authorization errors
    ErrorCode["INSUFFICIENT_PERMISSIONS"] = "INSUFFICIENT_PERMISSIONS";
    ErrorCode["RESOURCE_ACCESS_DENIED"] = "RESOURCE_ACCESS_DENIED";
    // Business logic errors
    ErrorCode["SPECIFICATION_ERROR"] = "SPECIFICATION_ERROR";
    ErrorCode["PHASE_VALIDATION_FAILED"] = "PHASE_VALIDATION_FAILED";
    ErrorCode["DOCUMENT_LOCKED"] = "DOCUMENT_LOCKED";
    ErrorCode["APPROVAL_REQUIRED"] = "APPROVAL_REQUIRED";
    // Service errors
    ErrorCode["AI_SERVICE_ERROR"] = "AI_SERVICE_ERROR";
    ErrorCode["DATABASE_ERROR"] = "DATABASE_ERROR";
    ErrorCode["EXTERNAL_SERVICE_ERROR"] = "EXTERNAL_SERVICE_ERROR";
    ErrorCode["FILE_UPLOAD_ERROR"] = "FILE_UPLOAD_ERROR";
    // Network errors
    ErrorCode["NETWORK_ERROR"] = "NETWORK_ERROR";
    ErrorCode["TIMEOUT_ERROR"] = "TIMEOUT_ERROR";
    ErrorCode["CONNECTION_ERROR"] = "CONNECTION_ERROR";
})(ErrorCode || (ErrorCode = {}));
// Base application error class
export class AppError extends Error {
    code;
    statusCode;
    isOperational;
    context;
    timestamp;
    constructor(message, code = ErrorCode.UNKNOWN_ERROR, statusCode = 500, isOperational = true, context) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.context = context;
        this.timestamp = new Date();
        // Maintains proper stack trace for where our error was thrown
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            statusCode: this.statusCode,
            context: this.context,
            timestamp: this.timestamp,
            stack: this.stack,
        };
    }
}
// Validation error class
export class ValidationError extends AppError {
    field;
    value;
    constructor(message, field, value, context) {
        super(message, ErrorCode.VALIDATION_ERROR, 400, true, context);
        this.field = field;
        this.value = value;
    }
}
// Authentication error class
export class AuthenticationError extends AppError {
    constructor(message = 'Authentication failed', code = ErrorCode.UNAUTHORIZED, context) {
        super(message, code, 401, true, context);
    }
}
// Authorization error class
export class AuthorizationError extends AppError {
    requiredPermission;
    resource;
    constructor(message = 'Access denied', requiredPermission, resource, context) {
        super(message, ErrorCode.FORBIDDEN, 403, true, context);
        this.requiredPermission = requiredPermission;
        this.resource = resource;
    }
}
// Not found error class
export class NotFoundError extends AppError {
    resource;
    resourceId;
    constructor(message = 'Resource not found', resource, resourceId, context) {
        super(message, ErrorCode.NOT_FOUND, 404, true, context);
        this.resource = resource;
        this.resourceId = resourceId;
    }
}
// Conflict error class
export class ConflictError extends AppError {
    conflictingResource;
    constructor(message = 'Resource conflict', conflictingResource, context) {
        super(message, ErrorCode.CONFLICT, 409, true, context);
        this.conflictingResource = conflictingResource;
    }
}
// Rate limiting error class
export class RateLimitError extends AppError {
    retryAfter;
    limit;
    constructor(message = 'Rate limit exceeded', retryAfter, limit, context) {
        super(message, ErrorCode.RATE_LIMITED, 429, true, context);
        this.retryAfter = retryAfter;
        this.limit = limit;
    }
}
// Service error class
export class ServiceError extends AppError {
    service;
    operation;
    constructor(message, code, service, operation, context) {
        super(message, code, 500, true, context);
        this.service = service;
        this.operation = operation;
    }
}
// Internal server error class
export class InternalServerError extends ServiceError {
    constructor(message = 'Internal server error', originalError, context) {
        super(message, ErrorCode.UNKNOWN_ERROR, 'internal', undefined, {
            ...context,
            originalError: originalError?.message,
            stack: originalError?.stack,
        });
    }
}
// External service error class
export class ExternalServiceError extends AppError {
    service;
    originalError;
    externalStatusCode;
    constructor(message, service, originalError, externalStatusCode, context) {
        super(message, ErrorCode.EXTERNAL_SERVICE_ERROR, externalStatusCode && externalStatusCode >= 500 ? 502 : 400, true, {
            ...context,
            service,
            originalError,
            externalStatusCode,
        });
        this.service = service;
        this.originalError = originalError;
        this.externalStatusCode = externalStatusCode;
    }
}
// AI service specific error
export class AIServiceError extends ServiceError {
    tokensUsed;
    model;
    constructor(message, tokensUsed, model, context) {
        super(message, ErrorCode.AI_SERVICE_ERROR, 'ai-service', undefined, context);
        this.tokensUsed = tokensUsed;
        this.model = model;
    }
}
// Database error class
export class DatabaseError extends ServiceError {
    query;
    table;
    constructor(message, query, table, context) {
        super(message, ErrorCode.DATABASE_ERROR, 'database', undefined, context);
        this.query = query;
        this.table = table;
    }
}
// Network error class
export class NetworkError extends AppError {
    url;
    method;
    timeout;
    constructor(message, code = ErrorCode.NETWORK_ERROR, url, method, timeout, context) {
        super(message, code, 500, true, context);
        this.url = url;
        this.method = method;
        this.timeout = timeout;
    }
}
// Specification workflow specific errors
export class SpecificationError extends AppError {
    phase;
    documentId;
    constructor(message, code = ErrorCode.SPECIFICATION_ERROR, phase, documentId, context) {
        super(message, code, 400, true, context);
        this.phase = phase;
        this.documentId = documentId;
    }
}
// Error factory functions
export const createValidationError = (message, field, value) => {
    return new ValidationError(message, field, value);
};
export const createNotFoundError = (resource, resourceId) => {
    return new NotFoundError(`${resource} not found`, resource, resourceId);
};
export const createAuthenticationError = (message) => {
    return new AuthenticationError(message);
};
export const createAuthorizationError = (requiredPermission, resource) => {
    return new AuthorizationError(`Permission '${requiredPermission}' required`, requiredPermission, resource);
};
// Error type guards
export const isAppError = (error) => {
    return error instanceof AppError;
};
export const isValidationError = (error) => {
    return error instanceof ValidationError;
};
export const isAuthenticationError = (error) => {
    return error instanceof AuthenticationError;
};
export const isAuthorizationError = (error) => {
    return error instanceof AuthorizationError;
};
export const isNotFoundError = (error) => {
    return error instanceof NotFoundError;
};
export const isNetworkError = (error) => {
    return error instanceof NetworkError;
};
export const isServiceError = (error) => {
    return error instanceof ServiceError;
};
// Additional type guards
export const isSpecificationError = (error) => {
    return error instanceof SpecificationError;
};
export const isAIServiceError = (error) => {
    return error instanceof AIServiceError;
};
export const isDatabaseError = (error) => {
    return error instanceof DatabaseError;
};
export const isExternalServiceError = (error) => {
    return error instanceof ExternalServiceError;
};
export const isInternalServerError = (error) => {
    return error instanceof InternalServerError;
};
export const isRateLimitError = (error) => {
    return error instanceof RateLimitError;
};
export const isConflictError = (error) => {
    return error instanceof ConflictError;
};
// Error severity levels for UI components
export var ErrorSeverity;
(function (ErrorSeverity) {
    ErrorSeverity["LOW"] = "low";
    ErrorSeverity["MEDIUM"] = "medium";
    ErrorSeverity["HIGH"] = "high";
    ErrorSeverity["CRITICAL"] = "critical";
})(ErrorSeverity || (ErrorSeverity = {}));
// Utility function to check if error is of specific type
export const isErrorOfType = (error, errorClass) => {
    return error instanceof errorClass;
};
//# sourceMappingURL=errors.js.map