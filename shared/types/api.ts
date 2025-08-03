/**
 * Shared API types for client-server communication
 */

// Standard API response wrapper
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

// API error response
export interface ApiError {
  message: string;
  code?: string;
  field?: string;
  details?: Record<string, unknown>;
}

// Pagination parameters
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Search parameters
export interface SearchParams extends PaginationParams {
  query?: string;
  filters?: Record<string, unknown>;
}

// Base request interface
export interface BaseRequest {
  timestamp?: Date;
  requestId?: string;
}

// Base response interface
export interface BaseResponse {
  timestamp: Date;
  requestId?: string;
}

// HTTP method types
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

// API endpoint configuration
export interface ApiEndpoint {
  method: HttpMethod;
  path: string;
  requiresAuth?: boolean;
  rateLimit?: {
    requests: number;
    window: number; // in seconds
  };
}

// Request configuration
export interface RequestConfig {
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
  params?: Record<string, unknown>;
}

// File upload types
export interface FileUploadRequest {
  file: File | Blob | Buffer; // File or Blob type (browser) or Buffer (Node.js)
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

// Validation error
export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: unknown;
}

// Bulk operation types
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
