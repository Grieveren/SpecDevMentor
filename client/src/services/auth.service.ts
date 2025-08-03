// @ts-nocheck
import axios, { AxiosResponse } from 'axios';
import {
  AuthError,
  AuthResponse,
  ChangePasswordRequest,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
  TokenPair,
  User,
} from '../types/auth';
import { BaseService, TypedApiClient } from './api.service';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  config => {
    const tokens = getStoredTokens();
    if (tokens?.accessToken) {
      config.headers.Authorization = `Bearer ${tokens.accessToken}`;
    }
    return config;
  },
  error => Promise.reject(error)
);

// Response interceptor to handle token refresh
apiClient.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const tokens = getStoredTokens();
        if (tokens?.refreshToken) {
          const newTokens = await refreshTokens(tokens.refreshToken);
          setStoredTokens(newTokens);

          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, clear tokens and redirect to login
        clearStoredTokens();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Token storage utilities
const TOKEN_STORAGE_KEY = 'codementor_auth_tokens';

export const getStoredTokens = (): TokenPair | null => {
  try {
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

export const setStoredTokens = (tokens: TokenPair): void => {
  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
};

export const clearStoredTokens = (): void => {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
};

/**
 * Authentication service class extending BaseService
 */
class AuthService extends BaseService {
  constructor() {
    super(new TypedApiClient(apiClient));
  }

  async register(data: RegisterRequest): Promise<AuthResponse> {
    try {
      const response = await this.apiClient.post<{ user: User; tokens: TokenPair }>(
        '/auth/register',
        data
      );

      if (response.data?.tokens) {
        setStoredTokens(response.data.tokens);
      }

      return {
        success: response.success,
        message: response.message || 'Registration successful',
        data: response.data,
      };
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  async login(data: LoginRequest): Promise<AuthResponse> {
    try {
      const response = await this.apiClient.post<{ user: User; tokens: TokenPair }>(
        '/auth/login',
        data
      );

      if (response.data?.tokens) {
        setStoredTokens(response.data.tokens);
      }

      return {
        success: response.success,
        message: response.message || 'Login successful',
        data: response.data,
      };
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  async logout(): Promise<void> {
    try {
      const tokens = getStoredTokens();
      if (tokens?.refreshToken) {
        await this.apiClient.post<void>('/auth/logout', { refreshToken: tokens.refreshToken });
      }
    } catch (error) {
      // Log error but don't throw - logout should always succeed
      console.error('Logout error:', error);
    } finally {
      clearStoredTokens();
    }
  }

  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    try {
      const response = await this.apiClient.post<{ tokens: TokenPair }>('/auth/refresh', {
        refreshToken,
      });

      const newTokens = response.data.tokens;
      setStoredTokens(newTokens);

      return newTokens;
    } catch (error) {
      clearStoredTokens();
      throw this.handleAuthError(error);
    }
  }

  async getCurrentUser(): Promise<User> {
    try {
      const response = await this.apiClient.get<{ user: User }>('/auth/me');
      return response.data.user;
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  async requestPasswordReset(email: string): Promise<void> {
    try {
      await this.apiClient.post<void>('/auth/forgot-password', { email });
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  async resetPassword(data: ResetPasswordRequest): Promise<void> {
    try {
      await this.apiClient.post<void>('/auth/reset-password', data);
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  async changePassword(data: ChangePasswordRequest): Promise<void> {
    try {
      await this.apiClient.post<void>('/auth/change-password', data);
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  async validateToken(token?: string): Promise<{ valid: boolean; payload?: unknown }> {
    try {
      const response = await this.apiClient.post<{ valid: boolean; payload?: unknown }>(
        '/auth/validate',
        { token }
      );
      return response.data;
    } catch (error) {
      return { valid: false };
    }
  }

  async verifyEmail(token: string): Promise<void> {
    try {
      await this.apiClient.get<void>(`/auth/verify-email/${token}`);
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  /**
   * Handle authentication-specific errors
   */
  private handleAuthError(error: unknown): AuthError {
    const apiError = this.handleError(error);

    return {
      error: apiError.message,
      code: apiError.code,
      details: apiError.context
        ? Object.entries(apiError.context).map(([field, message]) => ({
            field,
            message: Array.isArray(message) ? message.join(', ') : String(message),
          }))
        : undefined,
    };
  }
}

// Create service instance
export const authService = new AuthService();

// Standalone refresh function for interceptor
async function refreshTokens(refreshToken: string): Promise<TokenPair> {
  const response: AxiosResponse<{ success: boolean; data: { tokens: TokenPair } }> =
    await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });

  return response.data.data.tokens;
}

// Error handling utility
function handleAuthError(error: unknown): AuthError {
  if (axios.isAxiosError(error)) {
    const response = error.response;

    if (response?.data) {
      return {
        error: response.data.error || 'Authentication failed',
        code: response.data.code,
        details: response.data.details,
      };
    }

    return {
      error: error.message || 'Network error',
      code: 'NETWORK_ERROR',
    };
  }

  if (error instanceof Error) {
    return {
      error: error.message,
      code: 'UNKNOWN_ERROR',
    };
  }

  return {
    error: 'Unknown error occurred',
    code: 'UNKNOWN_ERROR',
  };
}

export default authService;
