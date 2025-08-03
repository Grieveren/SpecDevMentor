// @ts-nocheck
import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, useAuthActions } from '../../stores/auth.store';
import { UserRole } from '../../types/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: UserRole[];
  fallbackPath?: string;
  requireVerification?: boolean;
  className?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRoles,
  fallbackPath = '/login',
  requireVerification = false,
}) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { initializeAuth } = useAuthActions();
  const location = useLocation();

  useEffect(() => {
    // Initialize auth on mount if not already authenticated
    if (!isAuthenticated && !isLoading) {
      initializeAuth();
    }
  }, [isAuthenticated, isLoading, initializeAuth]);

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    return <Navigate to={fallbackPath} state={{ from: location }} replace />;
  }

  // Check email verification requirement
  if (requireVerification && !user.isVerified) {
    return <Navigate to="/verify-email" state={{ from: location }} replace />;
  }

  // Check role requirements
  if (requiredRoles && requiredRoles.length > 0) {
    const hasRequiredRole = requiredRoles.includes(user.role);

    if (!hasRequiredRole) {
      return <Navigate to="/unauthorized" state={{ from: location, requiredRoles }} replace />;
    }
  }

  return <>{children}</>;
};

// Higher-order component for role-based access
export const withRoleProtection = <P extends object>(
  Component: React.ComponentType<P>,
  requiredRoles: UserRole[]
) => {
  return (props: P) => (
    <ProtectedRoute requiredRoles={requiredRoles}>
      <Component {...props} />
    </ProtectedRoute>
  );
};

// Specific role protection components
export const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute requiredRoles={[UserRole.ADMIN]}>{children}</ProtectedRoute>
);

export const TeamLeadRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute requiredRoles={[UserRole.TEAM_LEAD, UserRole.ADMIN]}>{children}</ProtectedRoute>
);

export const VerifiedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute requireVerification>{children}</ProtectedRoute>
);
