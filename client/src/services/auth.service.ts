import axios, { AxiosResponse } from 'axios';
import {
  AuthResponse,
  RegisterRequest,
  LoginRequest,
  ResetPasswordRequest,
  ChangePasswordRequest,
  TokenPair,
  User,
  AuthError,
} from '../types/auth';

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
  (config) => {
    const tokens = getStoredTokens();
    if (tokens?.accessToken) {
      config.headers.Authorization = `Bearer ${tokens.accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
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

// Auth API functions
export const authService = {
  async register(data: RegisterRequest): Promise<AuthResponse> {
    try {
      const response: AxiosResponse<AuthResponse> = await apiClient.post('/auth/register', data);
      
      if (response.data.data?.tokens) {
        setStoredTokens(response.data.data.tokens);
      }
      
      return response.data;
    } catch (error) {
      throw handleAuthError(error);
    }
  },

  async login(data: LoginRequest): Promise<AuthResponse> {
    try {
      const response: AxiosResponse<AuthResponse> = await apiClient.post('/auth/login', data);
      
      if (response.data.data?.tokens) {
        setStoredTokens(response.data.data.tokens);
      }
      
      return response.data;
    } catch (error) {
      throw handleAuthError(error);
    }
  },

  async logout(): Promise<void> {
    try {
      const tokens = getStoredTokens();
      if (tokens?.refreshToken) {
        await apiClient.post('/auth/logout', { refreshToken: tokens.refreshToken });
      }
    } catch (error) {
      // Log error but don't throw - logout should always succeed
      console.error('Logout error:', error);
    } finally {
      clearStoredTokens();
    }
  },

  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    try {
      const response: AxiosResponse<{ success: boolean; data: { tokens: TokenPair } }> = 
        await apiClient.post('/auth/refresh', { refreshToken });
      
      const newTokens = response.data.data.tokens;
      setStoredTokens(newTokens);
      
      return newTokens;
    } catch (error) {
      clearStoredTokens();
      throw handleAuthError(error);
    }
  },

  async getCurrentUser(): Promise<User> {
    try {
      const response: AxiosResponse<{ success: boolean; data: { user: User } }> = 
        await apiClient.get('/auth/me');
      
      return response.data.data.user;
    } catch (error) {
      throw handleAuthError(error);
    }
  },

  async requestPasswordReset(email: string): Promise<void> {
    try {
      await apiClient.post('/auth/forgot-password', { email });
    } catch (error) {
      throw handleAuthError(error);
    }
  },

  async resetPassword(data: ResetPasswordRequest): Promise<void> {
    try {
      await apiClient.post('/auth/reset-password', data);
    } catch (error) {
      throw handleAuthError(error);
    }
  },

  async changePassword(data: ChangePasswordRequest): Promise<void> {
    try {
      await apiClient.post('/auth/change-password', data);
    } catch (error) {
      throw handleAuthError(error);
    }
  },

  async validateToken(token?: string): Promise<{ valid: boolean; payload?: any }> {
    try {
      const response: AxiosResponse<{ 
        success: boolean; 
        data: { valid: boolean; payload?: any } 
      }> = await apiClient.post('/auth/validate', { token });
      
      return response.data.data;
    } catch (error) {
      return { valid: false };
    }
  },

  async verifyEmail(token: string): Promise<void> {
    try {
      await apiClient.get(`/auth/verify-email/${token}`);
    } catch (error) {
      throw handleAuthError(error);
    }
  },
};

// Standalone refresh function for interceptor
async function refreshTokens(refreshToken: string): Promise<TokenPair> {
  const response: AxiosResponse<{ success: boolean; data: { tokens: TokenPair } }> = 
    await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
  
  return response.data.data.tokens;
}

// Error handling utility
function handleAuthError(error: any): AuthError {
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
  
  return {
    error: error.message || 'Unknown error',
    code: 'UNKNOWN_ERROR',
  };
}

export default authService;