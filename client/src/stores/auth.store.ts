// @ts-nocheck
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  User,
  TokenPair,
  AuthState,
  RegisterRequest,
  LoginRequest,
  ResetPasswordRequest,
  ChangePasswordRequest,
  AuthError,
  AuthResponse,
} from '../types/auth';
import { authService, getStoredTokens, clearStoredTokens } from '../services/auth.service';

// Enhanced error handling types
interface AuthServiceError extends Error {
  error?: string;
  code?: string;
  status?: number;
}

// Token validation response type
interface TokenValidationResponse {
  valid: boolean;
  user?: User;
  error?: string;
}

interface AuthActions {
  // Authentication actions
  register: (data: RegisterRequest) => Promise<void>;
  login: (data: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<void>;
  
  // User actions
  getCurrentUser: () => Promise<void>;
  changePassword: (data: ChangePasswordRequest) => Promise<void>;
  
  // Password reset actions
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (data: ResetPasswordRequest) => Promise<void>;
  
  // Email verification
  verifyEmail: (token: string) => Promise<void>;
  
  // State management
  setUser: (user: User | null) => void;
  setTokens: (tokens: TokenPair | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  clearAuth: () => void;
  
  // Initialization
  initializeAuth: () => Promise<void>;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Authentication actions
      register: async (data: RegisterRequest): Promise<void> => {
        set({ isLoading: true, error: null });
        
        try {
          const response: AuthResponse = await authService.register(data);
          
          set({
            user: response.data.user,
            tokens: response.data.tokens,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error: unknown) {
          const authError = error as AuthServiceError;
          const errorMessage = authError.error || authError.message || 'Registration failed';
          
          set({
            error: errorMessage,
            isLoading: false,
          });
          throw error;
        }
      },

      login: async (data: LoginRequest): Promise<void> => {
        set({ isLoading: true, error: null });
        
        try {
          const response: AuthResponse = await authService.login(data);
          
          set({
            user: response.data.user,
            tokens: response.data.tokens,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error: unknown) {
          const authError = error as AuthServiceError;
          const errorMessage = authError.error || authError.message || 'Login failed';
          
          set({
            error: errorMessage,
            isLoading: false,
          });
          throw error;
        }
      },

      logout: async (): Promise<void> => {
        set({ isLoading: true });
        
        try {
          await authService.logout();
        } catch (error: unknown) {
          console.error('Logout error:', error);
        } finally {
          set({
            user: null,
            tokens: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
      },

      refreshTokens: async (): Promise<void> => {
        const { tokens } = get();
        
        if (!tokens?.refreshToken) {
          throw new Error('No refresh token available');
        }
        
        try {
          const newTokens: TokenPair = await authService.refreshTokens(tokens.refreshToken);
          set({ tokens: newTokens });
        } catch (error: unknown) {
          // Clear auth state if refresh fails
          get().clearAuth();
          throw error;
        }
      },

      // User actions
      getCurrentUser: async (): Promise<void> => {
        set({ isLoading: true, error: null });
        
        try {
          const user: User = await authService.getCurrentUser();
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error: unknown) {
          const authError = error as AuthServiceError;
          const errorMessage = authError.error || authError.message || 'Failed to get user';
          
          set({
            error: errorMessage,
            isLoading: false,
          });
          
          // If unauthorized, clear auth state
          if (authError.code === 'INVALID_TOKEN' || authError.code === 'TOKEN_REVOKED') {
            get().clearAuth();
          }
          
          throw error;
        }
      },

      changePassword: async (data: ChangePasswordRequest): Promise<void> => {
        set({ isLoading: true, error: null });
        
        try {
          await authService.changePassword(data);
          set({ isLoading: false });
        } catch (error: unknown) {
          const authError = error as AuthServiceError;
          const errorMessage = authError.error || authError.message || 'Password change failed';
          
          set({
            error: errorMessage,
            isLoading: false,
          });
          throw error;
        }
      },

      // Password reset actions
      requestPasswordReset: async (email: string): Promise<void> => {
        set({ isLoading: true, error: null });
        
        try {
          await authService.requestPasswordReset(email);
          set({ isLoading: false });
        } catch (error: unknown) {
          const authError = error as AuthServiceError;
          const errorMessage = authError.error || authError.message || 'Password reset request failed';
          
          set({
            error: errorMessage,
            isLoading: false,
          });
          throw error;
        }
      },

      resetPassword: async (data: ResetPasswordRequest): Promise<void> => {
        set({ isLoading: true, error: null });
        
        try {
          await authService.resetPassword(data);
          set({ isLoading: false });
        } catch (error: unknown) {
          const authError = error as AuthServiceError;
          const errorMessage = authError.error || authError.message || 'Password reset failed';
          
          set({
            error: errorMessage,
            isLoading: false,
          });
          throw error;
        }
      },

      // Email verification
      verifyEmail: async (token: string): Promise<void> => {
        set({ isLoading: true, error: null });
        
        try {
          await authService.verifyEmail(token);
          
          // Update user verification status if user is logged in
          const { user } = get();
          if (user) {
            set({
              user: { ...user, isVerified: true },
              isLoading: false,
            });
          } else {
            set({ isLoading: false });
          }
        } catch (error: unknown) {
          const authError = error as AuthServiceError;
          const errorMessage = authError.error || authError.message || 'Email verification failed';
          
          set({
            error: errorMessage,
            isLoading: false,
          });
          throw error;
        }
      },

      // State management
      setUser: (user: User | null) => {
        set({ 
          user, 
          isAuthenticated: !!user 
        });
      },

      setTokens: (tokens: TokenPair | null) => {
        set({ tokens });
      },

      setLoading: (isLoading: boolean) => {
        set({ isLoading });
      },

      setError: (error: string | null) => {
        set({ error });
      },

      clearError: () => {
        set({ error: null });
      },

      clearAuth: (): void => {
        clearStoredTokens();
        set({
          user: null,
          tokens: null,
          isAuthenticated: false,
          error: null,
        });
      },

      // Initialization
      initializeAuth: async (): Promise<void> => {
        const tokens: TokenPair | null = getStoredTokens();
        
        if (!tokens?.accessToken) {
          return;
        }
        
        set({ tokens, isLoading: true });
        
        try {
          // Validate token and get current user
          const validation: TokenValidationResponse = await authService.validateToken(tokens.accessToken);
          
          if (validation.valid) {
            await get().getCurrentUser();
          } else {
            get().clearAuth();
          }
        } catch (error: unknown) {
          console.error('Auth initialization error:', error);
          get().clearAuth();
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({
        user: state.user,
        tokens: state.tokens,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Selectors for common use cases
export const useAuth = () => {
  const store = useAuthStore();
  return {
    user: store.user,
    isAuthenticated: store.isAuthenticated,
    isLoading: store.isLoading,
    error: store.error,
  };
};

export const useAuthActions = () => {
  const store = useAuthStore();
  return {
    register: store.register,
    login: store.login,
    logout: store.logout,
    getCurrentUser: store.getCurrentUser,
    changePassword: store.changePassword,
    requestPasswordReset: store.requestPasswordReset,
    resetPassword: store.resetPassword,
    verifyEmail: store.verifyEmail,
    clearError: store.clearError,
    initializeAuth: store.initializeAuth,
  };
};

// Export types for external use
export type { AuthStore, AuthActions, AuthServiceError, TokenValidationResponse };