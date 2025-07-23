import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider } from './components/auth/AuthProvider';
import { LoginForm } from './components/auth/LoginForm';
import { RegisterForm } from './components/auth/RegisterForm';
import { PasswordResetForm } from './components/auth/PasswordResetForm';
import { useAuth, useAuthActions } from './stores/auth.store';
import './index.css';

type AuthView = 'login' | 'register' | 'forgot-password';

function AuthenticatedApp() {
  const { user } = useAuth();
  const { logout } = useAuthActions();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">CodeMentor AI</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">Welcome, {user?.name}</span>
              <button
                onClick={handleLogout}
                className="text-sm text-blue-600 hover:text-blue-500"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>
      
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Welcome to CodeMentor AI Platform
            </h2>
            <p className="text-lg text-gray-600 mb-8">
              Specification-Based Development Learning Platform
            </p>
            <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl mx-auto">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">
                Authentication System Ready
              </h3>
              <p className="text-gray-600 mb-4">
                The authentication system has been successfully implemented with:
              </p>
              <ul className="text-left text-gray-600 space-y-2">
                <li>• JWT-based authentication with refresh tokens</li>
                <li>• Secure password hashing and validation</li>
                <li>• User registration and login</li>
                <li>• Password reset functionality</li>
                <li>• Protected routes and role-based access</li>
                <li>• Persistent authentication state</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function UnauthenticatedApp() {
  const [currentView, setCurrentView] = useState<AuthView>('login');

  const handleAuthSuccess = () => {
    // Authentication successful, the AuthProvider will handle the state change
    console.log('Authentication successful');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        {currentView === 'login' && (
          <LoginForm
            onSuccess={handleAuthSuccess}
            onSwitchToRegister={() => setCurrentView('register')}
            onForgotPassword={() => setCurrentView('forgot-password')}
          />
        )}
        
        {currentView === 'register' && (
          <RegisterForm
            onSuccess={handleAuthSuccess}
            onSwitchToLogin={() => setCurrentView('login')}
          />
        )}
        
        {currentView === 'forgot-password' && (
          <PasswordResetForm
            onBack={() => setCurrentView('login')}
            onSuccess={() => setCurrentView('login')}
          />
        )}
      </div>
    </div>
  );
}

function App() {
  const { isAuthenticated } = useAuth();

  return isAuthenticated ? <AuthenticatedApp /> : <UnauthenticatedApp />;
}

function AppWithAuth() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppWithAuth />
  </React.StrictMode>
);
