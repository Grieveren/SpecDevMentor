import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

function App() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">CodeMentor AI Platform</h1>
        <p className="text-lg text-gray-600 mb-8">
          Specification-Based Development Learning Platform
        </p>
        <div className="bg-white rounded-lg shadow-md p-6 max-w-md mx-auto">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Development Environment Ready
          </h2>
          <p className="text-gray-600">
            The foundation has been set up successfully. Ready for implementation!
          </p>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
