import React from 'react';
import { LogIn } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Login: React.FC = () => {
  const { login } = useAuth();

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-blue-600 rounded-lg flex items-center justify-center">
            <LogIn className="h-6 w-6 text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-white">
            Database AI Assistant
          </h2>
          <p className="mt-2 text-gray-400">
            Connect your databases and analyze data with AI
          </p>
        </div>
        
        <div className="mt-8">
          <button
            onClick={login}
            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            <LogIn className="h-5 w-5 mr-2" />
            Sign in with Google
          </button>
        </div>
        
        <div className="text-center">
          <p className="text-sm text-gray-400">
            Securely connect to PostgreSQL, MySQL, and MongoDB databases
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;