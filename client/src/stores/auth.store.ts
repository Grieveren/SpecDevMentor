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
} from '../types/auth';
import { authService, getStoredTokens, clearStoredTokens } from '../services/auth.service';

interface AuthActions {
  // Authentication actions
  register: (_data: RegisterRequest) => Promise<void>;
  login: (_data: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<void>;
  
  // User actions
  getCurrentUser: () => Promise<void>;
  changePassword: (_data: ChangePasswordRequest) => Promise<void>;
  
  // Password reset actions
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (_data: ResetPasswordRequest) => Promise<void>;
  
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
      register: async (_data: RegisterRequest) => {
        set({ isLoading: true, error: null });
        
        try {
          const _response = await authService.register(data);
          
          set({
            user: response.data.user,
            tokens: response.data.tokens,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (_error: unknown) {
          set({
            error: error.error || 'Registration failed',
            isLoading: false,
          });
          throw error;
        }
      },

      login: async (_data: LoginRequest) => {
        set({ isLoading: true, error: null });
        
        try {
          const _response = await authService.login(data);
          
          set({
            user: response.data.user,
            tokens: response.data.tokens,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (_error: unknown) {
          set({
            error: error.error || 'Login failed',
            isLoading: false,
          });
          throw error;
        }
      },

      logout: async () => {
        set({ isLoading: true });
        
        try {
          await authService.logout();
        } catch (error) {
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

      refreshTokens: async () => {
        const { tokens } = get();
        
        if (!tokens?.refreshToken) {
          throw new Error('No refresh token available');
        }
        
        try {
          const newTokens = await authService.refreshTokens(tokens.refreshToken);
          set({ tokens: newTokens });
        } catch (error) {
          // Clear auth state if refresh fails
          get().clearAuth();
          throw error;
        }
      },

      // User actions
      getCurrentUser: async () => {
        set({ isLoading: true, error: null });
        
        try {
          const _user = await authService.getCurrentUser();
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (_error: unknown) {
          set({
            error: error.error || 'Failed to get user',
            isLoading: false,
          });
          
          // If unauthorized, clear auth state
          if (error.code === 'INVALID_TOKEN' || error.code === 'TOKEN_REVOKED') {
            get().clearAuth();
          }
          
          throw error;
        }
      },

      changePassword: async (_data: ChangePasswordRequest) => {
        set({ isLoading: true, error: null });
        
        try {
          await authService.changePassword(data);
          set({ isLoading: false });
        } catch (_error: unknown) {
          set({
            error: error.error || 'Password change failed',
            isLoading: false,
          });
          throw error;
        }
      },

      // Password reset actions
      requestPasswordReset: async (email: string) => {
        set({ isLoading: true, error: null });
        
        try {
          await authService.requestPasswordReset(email);
          set({ isLoading: false });
        } catch (_error: unknown) {
          set({
            error: error.error || 'Password reset request failed',
            isLoading: false,
          });
          throw error;
        }
      },

      resetPassword: async (_data: ResetPasswordRequest) => {
        set({ isLoading: true, error: null });
        
        try {
          await authService.resetPassword(data);
          set({ isLoading: false });
        } catch (_error: unknown) {
          set({
            error: error.error || 'Password reset failed',
            isLoading: false,
          });
          throw error;
        }
      },

      // Email verification
      verifyEmail: async (token: string) => {
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
        } catch (_error: unknown) {
          set({
            error: error.error || 'Email verification failed',
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

      clearAuth: () => {
        clearStoredTokens();
        set({
          user: null,
          tokens: null,
          isAuthenticated: false,
          error: null,
        });
      },

      // Initialization
      initializeAuth: async () => {
        const tokens = getStoredTokens();
        
        if (!tokens?.accessToken) {
          return;
        }
        
        set({ tokens, isLoading: true });
        
        try {
          // Validate token and get current user
          const validation = await authService.validateToken(tokens.accessToken);
          
          if (validation.valid) {
            await get().getCurrentUser();
          } else {
            get().clearAuth();
          }
        } catch (error) {
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