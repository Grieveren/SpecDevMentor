/**
 * Shared error types and classes for consistent error handling
 */

// Base error codes
export enum ErrorCode {
  // Generic errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  CONFLICT = 'CONFLICT',
  RATE_LIMITED = 'RATE_LIMITED',

  // Authentication errors
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',

  // Authorization errors
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  RESOURCE_ACCESS_DENIED = 'RESOURCE_ACCESS_DENIED',

  // Business logic errors
  SPECIFICATION_ERROR = 'SPECIFICATION_ERROR',
  PHASE_VALIDATION_FAILED = 'PHASE_VALIDATION_FAILED',
  DOCUMENT_LOCKED = 'DOCUMENT_LOCKED',
  APPROVAL_REQUIRED = 'APPROVAL_REQUIRED',

  // Service errors
  AI_SERVICE_ERROR = 'AI_SERVICE_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  FILE_UPLOAD_ERROR = 'FILE_UPLOAD_ERROR',

  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  CONNECTION_ERROR = 'CONNECTION_ERROR',
}

// Base application error class
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly context?: Record<string, any>;
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
    statusCode: number = 500,
    isOperational: boolean = true,
    context?: Record<string, any>
  ) {
    super(message);

    this.name = (this.constructor as any).name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.context = context;
    this.timestamp = new Date();

    // Maintains proper stack trace for where our error was thrown
    if ((Error as any).captureStackTrace) {
      (Error as any).captureStackTrace(this, this.constructor);
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
  public readonly field?: string;
  public readonly value?: any;

  constructor(message: string, field?: string, value?: any, context?: Record<string, any>) {
    super(message, ErrorCode.VALIDATION_ERROR, 400, true, context);
    this.field = field;
    this.value = value;
  }
}

// Authentication error class
export class AuthenticationError extends AppError {
  constructor(
    message: string = 'Authentication failed',
    code: ErrorCode = ErrorCode.UNAUTHORIZED,
    context?: Record<string, any>
  ) {
    super(message, code, 401, true, context);
  }
}

// Authorization error class
export class AuthorizationError extends AppError {
  public readonly requiredPermission?: string;
  public readonly resource?: string;

  constructor(
    message: string = 'Access denied',
    requiredPermission?: string,
    resource?: string,
    context?: Record<string, any>
  ) {
    super(message, ErrorCode.FORBIDDEN, 403, true, context);
    this.requiredPermission = requiredPermission;
    this.resource = resource;
  }
}

// Not found error class
export class NotFoundError extends AppError {
  public readonly resource?: string;
  public readonly resourceId?: string;

  constructor(
    message: string = 'Resource not found',
    resource?: string,
    resourceId?: string,
    context?: Record<string, any>
  ) {
    super(message, ErrorCode.NOT_FOUND, 404, true, context);
    this.resource = resource;
    this.resourceId = resourceId;
  }
}

// Conflict error class
export class ConflictError extends AppError {
  public readonly conflictingResource?: string;

  constructor(
    message: string = 'Resource conflict',
    conflictingResource?: string,
    context?: Record<string, any>
  ) {
    super(message, ErrorCode.CONFLICT, 409, true, context);
    this.conflictingResource = conflictingResource;
  }
}

// Rate limiting error class
export class RateLimitError extends AppError {
  public readonly retryAfter?: number;
  public readonly limit?: number;

  constructor(
    message: string = 'Rate limit exceeded',
    retryAfter?: number,
    limit?: number,
    context?: Record<string, any>
  ) {
    super(message, ErrorCode.RATE_LIMITED, 429, true, context);
    this.retryAfter = retryAfter;
    this.limit = limit;
  }
}

// Service error class
export class ServiceError extends AppError {
  public readonly service?: string;
  public readonly operation?: string;

  constructor(
    message: string,
    code: ErrorCode,
    service?: string,
    operation?: string,
    context?: Record<string, any>
  ) {
    super(message, code, 500, true, context);
    this.service = service;
    this.operation = operation;
  }
}

// Internal server error class
export class InternalServerError extends ServiceError {
  constructor(
    message: string = 'Internal server error',
    originalError?: Error,
    context?: Record<string, any>
  ) {
    super(message, ErrorCode.UNKNOWN_ERROR, 'internal', undefined, {
      ...context,
      originalError: originalError?.message,
      stack: originalError?.stack,
    });
  }
}

// External service error class
export class ExternalServiceError extends AppError {
  public readonly service?: string;
  public readonly originalError?: string;
  public readonly externalStatusCode?: number;

  constructor(
    message: string,
    service: string,
    originalError?: string,
    externalStatusCode?: number,
    context?: Record<string, any>
  ) {
    super(
      message,
      ErrorCode.EXTERNAL_SERVICE_ERROR,
      externalStatusCode && externalStatusCode >= 500 ? 502 : 400,
      true,
      {
        ...context,
        service,
        originalError,
        externalStatusCode,
      }
    );
    this.service = service;
    this.originalError = originalError;
    this.externalStatusCode = externalStatusCode;
  }
}

// AI service specific error
export class AIServiceError extends ServiceError {
  public readonly tokensUsed?: number;
  public readonly model?: string;

  constructor(message: string, tokensUsed?: number, model?: string, context?: Record<string, any>) {
    super(message, ErrorCode.AI_SERVICE_ERROR, 'ai-service', undefined, context);
    this.tokensUsed = tokensUsed;
    this.model = model;
  }
}

// Database error class
export class DatabaseError extends ServiceError {
  public readonly query?: string;
  public readonly table?: string;

  constructor(message: string, query?: string, table?: string, context?: Record<string, any>) {
    super(message, ErrorCode.DATABASE_ERROR, 'database', undefined, context);
    this.query = query;
    this.table = table;
  }
}

// Network error class
export class NetworkError extends AppError {
  public readonly url?: string;
  public readonly method?: string;
  public readonly timeout?: number;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.NETWORK_ERROR,
    url?: string,
    method?: string,
    timeout?: number,
    context?: Record<string, any>
  ) {
    super(message, code, 500, true, context);
    this.url = url;
    this.method = method;
    this.timeout = timeout;
  }
}

// Specification workflow specific errors
export class SpecificationError extends AppError {
  public readonly phase?: string;
  public readonly documentId?: string;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.SPECIFICATION_ERROR,
    phase?: string,
    documentId?: string,
    context?: Record<string, any>
  ) {
    super(message, code, 400, true, context);
    this.phase = phase;
    this.documentId = documentId;
  }
}

// Error factory functions
export const createValidationError = (
  message: string,
  field?: string,
  value?: any
): ValidationError => {
  return new ValidationError(message, field, value);
};

export const createNotFoundError = (resource: string, resourceId?: string): NotFoundError => {
  return new NotFoundError(`${resource} not found`, resource, resourceId);
};

export const createAuthenticationError = (message?: string): AuthenticationError => {
  return new AuthenticationError(message);
};

export const createAuthorizationError = (
  requiredPermission: string,
  resource?: string
): AuthorizationError => {
  return new AuthorizationError(
    `Permission '${requiredPermission}' required`,
    requiredPermission,
    resource
  );
};

// Error type guards
export const isAppError = (error: any): error is AppError => {
  return error instanceof AppError;
};

export const isValidationError = (error: any): error is ValidationError => {
  return error instanceof ValidationError;
};

export const isAuthenticationError = (error: any): error is AuthenticationError => {
  return error instanceof AuthenticationError;
};

export const isAuthorizationError = (error: any): error is AuthorizationError => {
  return error instanceof AuthorizationError;
};

export const isNotFoundError = (error: any): error is NotFoundError => {
  return error instanceof NotFoundError;
};

export const isNetworkError = (error: any): error is NetworkError => {
  return error instanceof NetworkError;
};

export const isServiceError = (error: any): error is ServiceError => {
  return error instanceof ServiceError;
};

// Additional type guards
export const isSpecificationError = (error: any): error is SpecificationError => {
  return error instanceof SpecificationError;
};

export const isAIServiceError = (error: any): error is AIServiceError => {
  return error instanceof AIServiceError;
};

export const isDatabaseError = (error: any): error is DatabaseError => {
  return error instanceof DatabaseError;
};

export const isExternalServiceError = (error: any): error is ExternalServiceError => {
  return error instanceof ExternalServiceError;
};

export const isInternalServerError = (error: any): error is InternalServerError => {
  return error instanceof InternalServerError;
};

export const isRateLimitError = (error: any): error is RateLimitError => {
  return error instanceof RateLimitError;
};

export const isConflictError = (error: any): error is ConflictError => {
  return error instanceof ConflictError;
};

// Error severity levels for UI components
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Utility function to check if error is of specific type
export const isErrorOfType = <T extends AppError>(
  error: AppError,
  errorClass: new (...args: any[]) => T
): error is T => {
  return error instanceof errorClass;
};
