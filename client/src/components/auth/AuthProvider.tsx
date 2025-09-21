import React, { useEffect, useState } from 'react';
import { useAuthActions } from '../../stores/auth.store';

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const { initializeAuth } = useAuthActions();

  useEffect(() => {
    const initialize = async () => {
      try {
        await initializeAuth();
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setIsInitialized(true);
      }
    };

    initialize();
  }, [initializeAuth]);

  // Show loading screen while initializing
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing CodeMentor AI...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};