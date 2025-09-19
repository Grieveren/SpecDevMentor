export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: UserRole;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export enum UserRole {
  STUDENT = 'STUDENT',
  DEVELOPER = 'DEVELOPER',
  TEAM_LEAD = 'TEAM_LEAD',
  ADMIN = 'ADMIN',
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    tokens: TokenPair;
  };
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface AuthError {
  error: string;
  code?: string;
  details?: Array<{
    field: string;
    message: string;
  }>;
}

export interface AuthState {
  user: User | null;
  tokens: TokenPair | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}