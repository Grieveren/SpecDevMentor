/**
 * Shared error types and classes for consistent error handling
 */
export declare enum ErrorCode {
    UNKNOWN_ERROR = "UNKNOWN_ERROR",
    VALIDATION_ERROR = "VALIDATION_ERROR",
    NOT_FOUND = "NOT_FOUND",
    UNAUTHORIZED = "UNAUTHORIZED",
    FORBIDDEN = "FORBIDDEN",
    CONFLICT = "CONFLICT",
    RATE_LIMITED = "RATE_LIMITED",
    INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
    TOKEN_EXPIRED = "TOKEN_EXPIRED",
    TOKEN_INVALID = "TOKEN_INVALID",
    ACCOUNT_LOCKED = "ACCOUNT_LOCKED",
    INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS",
    RESOURCE_ACCESS_DENIED = "RESOURCE_ACCESS_DENIED",
    SPECIFICATION_ERROR = "SPECIFICATION_ERROR",
    PHASE_VALIDATION_FAILED = "PHASE_VALIDATION_FAILED",
    DOCUMENT_LOCKED = "DOCUMENT_LOCKED",
    APPROVAL_REQUIRED = "APPROVAL_REQUIRED",
    AI_SERVICE_ERROR = "AI_SERVICE_ERROR",
    DATABASE_ERROR = "DATABASE_ERROR",
    EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR",
    FILE_UPLOAD_ERROR = "FILE_UPLOAD_ERROR",
    NETWORK_ERROR = "NETWORK_ERROR",
    TIMEOUT_ERROR = "TIMEOUT_ERROR",
    CONNECTION_ERROR = "CONNECTION_ERROR"
}
export declare class AppError extends Error {
    readonly code: ErrorCode;
    readonly statusCode: number;
    readonly isOperational: boolean;
    readonly context?: Record<string, any>;
    readonly timestamp: Date;
    constructor(message: string, code?: ErrorCode, statusCode?: number, isOperational?: boolean, context?: Record<string, any>);
    toJSON(): {
        name: string;
        message: string;
        code: ErrorCode;
        statusCode: number;
        context: Record<string, any> | undefined;
        timestamp: Date;
        stack: string | undefined;
    };
}
export declare class ValidationError extends AppError {
    readonly field?: string;
    readonly value?: any;
    constructor(message: string, field?: string, value?: any, context?: Record<string, any>);
}
export declare class AuthenticationError extends AppError {
    constructor(message?: string, code?: ErrorCode, context?: Record<string, any>);
}
export declare class AuthorizationError extends AppError {
    readonly requiredPermission?: string;
    readonly resource?: string;
    constructor(message?: string, requiredPermission?: string, resource?: string, context?: Record<string, any>);
}
export declare class NotFoundError extends AppError {
    readonly resource?: string;
    readonly resourceId?: string;
    constructor(message?: string, resource?: string, resourceId?: string, context?: Record<string, any>);
}
export declare class ConflictError extends AppError {
    readonly conflictingResource?: string;
    constructor(message?: string, conflictingResource?: string, context?: Record<string, any>);
}
export declare class RateLimitError extends AppError {
    readonly retryAfter?: number;
    readonly limit?: number;
    constructor(message?: string, retryAfter?: number, limit?: number, context?: Record<string, any>);
}
export declare class ServiceError extends AppError {
    readonly service?: string;
    readonly operation?: string;
    constructor(message: string, code: ErrorCode, service?: string, operation?: string, context?: Record<string, any>);
}
export declare class InternalServerError extends ServiceError {
    constructor(message?: string, originalError?: Error, context?: Record<string, any>);
}
export declare class ExternalServiceError extends AppError {
    readonly service?: string;
    readonly originalError?: string;
    readonly externalStatusCode?: number;
    constructor(message: string, service: string, originalError?: string, externalStatusCode?: number, context?: Record<string, any>);
}
export declare class AIServiceError extends ServiceError {
    readonly tokensUsed?: number;
    readonly model?: string;
    constructor(message: string, tokensUsed?: number, model?: string, context?: Record<string, any>);
}
export declare class DatabaseError extends ServiceError {
    readonly query?: string;
    readonly table?: string;
    constructor(message: string, query?: string, table?: string, context?: Record<string, any>);
}
export declare class NetworkError extends AppError {
    readonly url?: string;
    readonly method?: string;
    readonly timeout?: number;
    constructor(message: string, code?: ErrorCode, url?: string, method?: string, timeout?: number, context?: Record<string, any>);
}
export declare class SpecificationError extends AppError {
    readonly phase?: string;
    readonly documentId?: string;
    constructor(message: string, code?: ErrorCode, phase?: string, documentId?: string, context?: Record<string, any>);
}
export declare const createValidationError: (message: string, field?: string, value?: any) => ValidationError;
export declare const createNotFoundError: (resource: string, resourceId?: string) => NotFoundError;
export declare const createAuthenticationError: (message?: string) => AuthenticationError;
export declare const createAuthorizationError: (requiredPermission: string, resource?: string) => AuthorizationError;
export declare const isAppError: (error: any) => error is AppError;
export declare const isValidationError: (error: any) => error is ValidationError;
export declare const isAuthenticationError: (error: any) => error is AuthenticationError;
export declare const isAuthorizationError: (error: any) => error is AuthorizationError;
export declare const isNotFoundError: (error: any) => error is NotFoundError;
export declare const isNetworkError: (error: any) => error is NetworkError;
export declare const isServiceError: (error: any) => error is ServiceError;
export declare const isSpecificationError: (error: any) => error is SpecificationError;
export declare const isAIServiceError: (error: any) => error is AIServiceError;
export declare const isDatabaseError: (error: any) => error is DatabaseError;
export declare const isExternalServiceError: (error: any) => error is ExternalServiceError;
export declare const isInternalServerError: (error: any) => error is InternalServerError;
export declare const isRateLimitError: (error: any) => error is RateLimitError;
export declare const isConflictError: (error: any) => error is ConflictError;
export declare enum ErrorSeverity {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high",
    CRITICAL = "critical"
}
export declare const isErrorOfType: <T extends AppError>(error: AppError, errorClass: new (...args: unknown[]) => T) => error is T;
//# sourceMappingURL=errors.d.ts.map