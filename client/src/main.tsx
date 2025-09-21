import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider } from './components/auth/AuthProvider';
import { LoginForm } from './components/auth/LoginForm';
import { RegisterForm } from './components/auth/RegisterForm';
import { PasswordResetForm } from './components/auth/PasswordResetForm';
import { ProjectDashboard } from './components/projects/ProjectDashboard';
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
          <ProjectDashboard />
        </div>
      </main>
    </div>
  );
}

function UnauthenticatedApp() {
  const [currentView, setCurrentView] = useState<AuthView>('login');

  const handleAuthSuccess = () => {
    // Authentication successful, the AuthProvider will handle the state change
    // // // console.log('Authentication successful');
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
