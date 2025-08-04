/**
 * Shared API types for client-server communication
 */
export interface ApiResponse<T = unknown> {
    data: T;
    success: boolean;
    message?: string;
    errors?: string[];
    meta?: {
        page?: number;
        limit?: number;
        total?: number;
        pages?: number;
    };
}
export interface ApiError {
    message: string;
    code?: string;
    field?: string;
    details?: Record<string, unknown>;
}
export interface PaginationParams {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}
export interface SearchParams extends PaginationParams {
    query?: string;
    filters?: Record<string, unknown>;
}
export interface BaseRequest {
    timestamp?: Date;
    requestId?: string;
}
export interface BaseResponse {
    timestamp: Date;
    requestId?: string;
}
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export interface ApiEndpoint {
    method: HttpMethod;
    path: string;
    requiresAuth?: boolean;
    rateLimit?: {
        requests: number;
        window: number;
    };
}
export interface RequestConfig {
    timeout?: number;
    retries?: number;
    headers?: Record<string, string>;
    params?: Record<string, unknown>;
}
export interface FileUploadRequest {
    file: unknown;
    metadata?: Record<string, unknown>;
}
export interface FileUploadResponse {
    id: string;
    filename: string;
    size: number;
    mimeType: string;
    url: string;
    uploadedAt: Date;
}
export interface ValidationError {
    field: string;
    message: string;
    code: string;
    value?: unknown;
}
export interface BulkRequest<T> {
    items: T[];
    options?: {
        continueOnError?: boolean;
        batchSize?: number;
    };
}
export interface BulkResponse<T> {
    successful: T[];
    failed: Array<{
        item: T;
        error: ApiError;
    }>;
    summary: {
        total: number;
        successful: number;
        failed: number;
    };
}
//# sourceMappingURL=api.d.ts.map