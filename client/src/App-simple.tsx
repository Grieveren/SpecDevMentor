// @ts-nocheck
import React, { useState, useEffect } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

interface Project {
  id: string;
  name: string;
  description: string;
  currentPhase: string;
  status: string;
  owner: {
    id: string;
    name: string;
    email: string;
  };
  _count: {
    documents: number;
    team: number;
  };
}

function App() {
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'projects'>('users');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch users
      const usersResponse = await fetch('http://localhost:3001/api/users');
      const usersData = await usersResponse.json();

      if (usersData.success) {
        setUsers(usersData.data.users);
      }

      // Fetch projects
      const projectsResponse = await fetch('http://localhost:3001/api/projects');
      const projectsData = await projectsResponse.json();

      if (projectsData.success) {
        setProjects(projectsData.data.projects);
      }
    } catch (err) {
      setError('Failed to fetch data. Make sure the server is running on http://localhost:3001');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const testLogin = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'admin@codementor-ai.com',
          password: 'admin123',
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert(`Login successful! Welcome ${data.data.user.name}`);
      } else {
        alert(`Login failed: ${data.error}`);
      }
    } catch (err) {
      alert('Login request failed');
      console.error('Login error:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading CodeMentor AI...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-600 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Connection Error</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={fetchData}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">CodeMentor AI</h1>
              <span className="ml-3 px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                Production Ready
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={testLogin}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Test Login
              </button>
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">U</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('users')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'users'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Users ({users.length})
            </button>
            <button
              onClick={() => setActiveTab('projects')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'projects'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Projects ({projects.length})
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="mt-6">
          {activeTab === 'users' && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Test Users</h2>
                <p className="text-sm text-gray-500">
                  These users were created during database seeding for UAT testing
                </p>
              </div>
              <div className="divide-y divide-gray-200">
                {users.map(user => (
                  <div key={user.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">{user.name}</h3>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            user.role === 'ADMIN'
                              ? 'bg-red-100 text-red-800'
                              : user.role === 'TEAM_LEAD'
                              ? 'bg-blue-100 text-blue-800'
                              : user.role === 'DEVELOPER'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {user.role}
                        </span>
                        <p className="text-xs text-gray-500 mt-1">
                          Created: {new Date(user.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'projects' && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Sample Projects</h2>
                <p className="text-sm text-gray-500">
                  These projects were created during database seeding for UAT testing
                </p>
              </div>
              <div className="divide-y divide-gray-200">
                {projects.map(project => (
                  <div key={project.id} className="px-6 py-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-gray-900">{project.name}</h3>
                        <p className="text-sm text-gray-500 mt-1">{project.description}</p>
                        <div className="flex items-center mt-2 space-x-4">
                          <span className="text-xs text-gray-500">Owner: {project.owner.name}</span>
                          <span className="text-xs text-gray-500">
                            Documents: {project._count.documents}
                          </span>
                          <span className="text-xs text-gray-500">Team: {project._count.team}</span>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            project.status === 'ACTIVE'
                              ? 'bg-green-100 text-green-800'
                              : project.status === 'COMPLETED'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {project.status}
                        </span>
                        <p className="text-xs text-gray-500 mt-1">Phase: {project.currentPhase}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <div className="bg-blue-50 rounded-lg p-6">
            <h3 className="text-lg font-medium text-blue-900 mb-2">
              🎉 CodeMentor AI is Ready for UAT Testing!
            </h3>
            <p className="text-blue-700 mb-4">
              The database is connected and seeded with test data. You can now proceed with
              comprehensive UAT testing.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="bg-white rounded p-3">
                <strong>Test Accounts:</strong>
                <br />
                admin@codementor-ai.com / admin123
                <br />
                developer@codementor-ai.com / developer123
                <br />
                student@codementor-ai.com / student123
              </div>
              <div className="bg-white rounded p-3">
                <strong>Sample Data:</strong>
                <br />
                {users.length} Users
                <br />
                {projects.length} Projects
                <br />
                Learning Modules & Templates
              </div>
              <div className="bg-white rounded p-3">
                <strong>Next Steps:</strong>
                <br />
                Follow UAT_TESTING_GUIDE.md
                <br />
                Test all workflows
                <br />
                Document any issues
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
