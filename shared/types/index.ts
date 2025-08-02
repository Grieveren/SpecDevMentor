/**
 * Shared types index - exports all shared types for easy importing
 */

// API types
export * from './api';

// Error types (excluding ValidationError to avoid conflict with api.ts)
export {
  AIServiceError,
  AppError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  DatabaseError,
  ErrorCode,
  ErrorSeverity,
  ExternalServiceError,
  InternalServerError,
  NetworkError,
  NotFoundError,
  RateLimitError,
  ServiceError,
  SpecificationError,
  createAuthenticationError,
  createAuthorizationError,
  createNotFoundError,
  createValidationError,
  isAIServiceError,
  isAppError,
  isAuthenticationError,
  isAuthorizationError,
  isConflictError,
  isDatabaseError,
  isErrorOfType,
  isExternalServiceError,
  isInternalServerError,
  isNetworkError,
  isNotFoundError,
  isRateLimitError,
  isServiceError,
  isSpecificationError,
  isValidationError,
} from './errors';

// Re-export ValidationError from errors with alias to avoid conflict
export { ValidationError as ValidationErrorClass } from './errors';

// Common utility types
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type Maybe<T> = T | null | undefined;

// Generic ID type
export type ID = string;

// Timestamp types
export type Timestamp = Date | string;

// Status types
export type Status = 'active' | 'inactive' | 'pending' | 'archived';

// Common entity base
export interface BaseEntity {
  id: ID;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Audit fields
export interface AuditFields {
  createdBy?: ID;
  updatedBy?: ID;
  deletedAt?: Timestamp;
  deletedBy?: ID;
}

// Full entity with audit
export interface AuditableEntity extends BaseEntity, AuditFields {}

// Generic list response
export interface ListResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// Generic key-value pair
export interface KeyValuePair<K = string, V = any> {
  key: K;
  value: V;
}

// Environment types
export type Environment = 'development' | 'staging' | 'production' | 'test';

// Log levels
export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';

// Generic callback types
export type Callback<T = void> = () => T;
export type AsyncCallback<T = void> = () => Promise<T>;
export type EventCallback<T = any> = (event: T) => void;
export type AsyncEventCallback<T = any> = (event: T) => Promise<void>;

// Generic handler types
export type Handler<TInput = any, TOutput = void> = (input: TInput) => TOutput;
export type AsyncHandler<TInput = any, TOutput = void> = (input: TInput) => Promise<TOutput>;

// Utility types for partial updates
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredBy<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Deep partial type
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Pick by type
export type PickByType<T, U> = {
  [K in keyof T as T[K] extends U ? K : never]: T[K];
};

// Omit by type
export type OmitByType<T, U> = {
  [K in keyof T as T[K] extends U ? never : K]: T[K];
};
