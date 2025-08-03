// @ts-nocheck
import { ApiError, ApiResponse } from '@shared/types/api';
import {
  AppError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  ErrorCode,
  ExternalServiceError,
  InternalServerError,
  NetworkError,
  NotFoundError,
  RateLimitError,
  ValidationError,
  isAppError,
} from '@shared/types/errors';
import type { AxiosError } from 'axios';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

// Create axios instance with base configuration
export const apiClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  config => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  error => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

/**
 * Typed API client with generic methods for type-safe API calls
 */
export class TypedApiClient {
  private instance: AxiosInstance;

  constructor(instance: AxiosInstance) {
    this.instance = instance;
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.instance.get<ApiResponse<T>>(url, config);
    return response.data;
  }

  async post<T, D = unknown>(
    url: string,
    data?: D,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    const response = await this.instance.post<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  async put<T, D = unknown>(
    url: string,
    data?: D,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    const response = await this.instance.put<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  async patch<T, D = unknown>(
    url: string,
    data?: D,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    const response = await this.instance.patch<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response = await this.instance.delete<ApiResponse<T>>(url, config);
    return response.data;
  }
}

/**
 * Client-side service error handler
 */
export class ClientServiceErrorHandler {
  /**
   * Transform API errors to AppError instances
   */
  static handleError(error: unknown, requestId?: string): AppError {
    // If already an AppError, return as-is
    if (isAppError(error)) {
      return error;
    }

    // Handle Axios errors
    if (axios.isAxiosError(error)) {
      return this.handleAxiosError(error, requestId);
    }

    // Handle standard errors
    if (error instanceof Error) {
      return new InternalServerError(error.message || 'Client error occurred', error, {
        requestId,
      });
    }

    // Handle unknown errors
    return new InternalServerError(
      'Unknown error occurred',
      error instanceof Error ? error : new Error(String(error)),
      { requestId }
    );
  }

  /**
   * Handle Axios HTTP errors
   */
  private static handleAxiosError(error: AxiosError, requestId?: string): AppError {
    const response = error.response;
    const request = error.request;

    // Network errors (no response received)
    if (!response && request) {
      return new NetworkError(
        'Network request failed',
        ErrorCode.NETWORK_ERROR,
        error.config?.url,
        error.config?.method?.toUpperCase(),
        error.config?.timeout,
        { requestId }
      );
    }

    // Configuration errors
    if (!response && !request) {
      return new InternalServerError('Request configuration error', error, { requestId });
    }

    // HTTP response errors
    if (response) {
      const status = response.status;
      const data = response.data as Record<string, unknown>;

      switch (status) {
        case 400:
          return new ValidationError(
            (data?.message as string) || 'Bad request',
            data?.field as string,
            data?.value,
            { requestId, errors: data?.errors }
          );

        case 401:
          return new AuthenticationError(
            (data?.message as string) || 'Authentication failed',
            (data?.code as ErrorCode) || ErrorCode.UNAUTHORIZED,
            { requestId }
          );

        case 403:
          return new AuthorizationError(
            (data?.message as string) || 'Access denied',
            data?.requiredPermission as string,
            data?.resource as string,
            { requestId }
          );

        case 404:
          return new NotFoundError(
            (data?.message as string) || 'Resource not found',
            data?.resource as string,
            data?.resourceId as string,
            { requestId }
          );

        case 409:
          return new ConflictError(
            (data?.message as string) || 'Resource conflict',
            data?.conflictingResource as string,
            { requestId }
          );

        case 429:
          return new RateLimitError(
            (data?.message as string) || 'Rate limit exceeded',
            data?.retryAfter as number,
            data?.limit as number,
            { requestId }
          );

        case 500:
        case 502:
        case 503:
        case 504:
          return new ExternalServiceError(
            (data?.message as string) || 'Server error',
            'api-server',
            (data?.error as string) || error.message,
            status,
            { requestId }
          );

        default:
          return new ExternalServiceError(
            (data?.message as string) || `HTTP ${status} error`,
            'api-server',
            error.message,
            status,
            { requestId }
          );
      }
    }

    return new NetworkError(
      'Network error occurred',
      ErrorCode.NETWORK_ERROR,
      error.config?.url,
      error.config?.method?.toUpperCase(),
      error.config?.timeout,
      { requestId }
    );
  }

  /**
   * Convert AppError to ApiError format for backward compatibility
   */
  static toApiError(error: AppError): ApiError {
    return {
      message: error.message,
      code: error.code,
      field: error.context?.field as string,
      details: error.context,
    };
  }
}

/**
 * Abstract base service class with improved error handling
 */
export abstract class BaseService {
  protected apiClient: TypedApiClient;

  constructor(apiClient: TypedApiClient) {
    this.apiClient = apiClient;
  }

  /**
   * Handle API errors and transform them to AppError format
   */
  protected handleError(error: unknown, requestId?: string): AppError {
    return ClientServiceErrorHandler.handleError(error, requestId);
  }

  /**
   * Handle API errors and return ApiError for backward compatibility
   */
  protected handleApiError(error: unknown, requestId?: string): ApiError {
    const appError = this.handleError(error, requestId);
    return ClientServiceErrorHandler.toApiError(appError);
  }

  /**
   * Validate API response and extract data
   */
  protected validateResponse<T>(response: ApiResponse<T>): T {
    if (!response.success) {
      throw new ValidationError(response.message || 'API request failed', 'api', response.errors, {
        errors: response.errors,
      });
    }
    return response.data;
  }

  /**
   * Execute API call with error handling
   */
  protected async executeWithErrorHandling<T>(
    operation: () => Promise<T>,
    operationName?: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const requestId = this.generateRequestId();
      const appError = this.handleError(error, requestId);

      // Log error for debugging
      console.error(`Service error in ${operationName || 'unknown operation'}:`, {
        error: appError.toJSON(),
        requestId,
      });

      throw appError;
    }
  }

  /**
   * Generate unique request ID for error tracking
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

// Create typed API client instance
export const typedApiClient = new TypedApiClient(apiClient);

export default apiClient;
