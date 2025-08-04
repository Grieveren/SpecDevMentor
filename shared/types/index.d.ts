/**
 * Shared types index - exports all shared types for easy importing
 */
export * from './api';
export { AIServiceError, AppError, AuthenticationError, AuthorizationError, ConflictError, DatabaseError, ErrorCode, ErrorSeverity, ExternalServiceError, InternalServerError, NetworkError, NotFoundError, RateLimitError, ServiceError, SpecificationError, createAuthenticationError, createAuthorizationError, createNotFoundError, createValidationError, isAIServiceError, isAppError, isAuthenticationError, isAuthorizationError, isConflictError, isDatabaseError, isErrorOfType, isExternalServiceError, isInternalServerError, isNetworkError, isNotFoundError, isRateLimitError, isServiceError, isSpecificationError, isValidationError, } from './errors';
export { ValidationError as ValidationErrorClass } from './errors';
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type Maybe<T> = T | null | undefined;
export type ID = string;
export type Timestamp = Date | string;
export type Status = 'active' | 'inactive' | 'pending' | 'archived';
export interface BaseEntity {
    id: ID;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}
export interface AuditFields {
    createdBy?: ID;
    updatedBy?: ID;
    deletedAt?: Timestamp;
    deletedBy?: ID;
}
export interface AuditableEntity extends BaseEntity, AuditFields {
}
export interface ListResponse<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
    pages: number;
}
export interface KeyValuePair<K = string, V = any> {
    key: K;
    value: V;
}
export type Environment = 'development' | 'staging' | 'production' | 'test';
export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';
export type Callback<T = void> = () => T;
export type AsyncCallback<T = void> = () => Promise<T>;
export type EventCallback<T = any> = (event: T) => void;
export type AsyncEventCallback<T = any> = (event: T) => Promise<void>;
export type Handler<TInput = any, TOutput = void> = (input: TInput) => TOutput;
export type AsyncHandler<TInput = any, TOutput = void> = (input: TInput) => Promise<TOutput>;
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredBy<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
export type PickByType<T, U> = {
    [K in keyof T as T[K] extends U ? K : never]: T[K];
};
export type OmitByType<T, U> = {
    [K in keyof T as T[K] extends U ? never : K]: T[K];
};
//# sourceMappingURL=index.d.ts.map