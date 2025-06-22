import React, { useState } from 'react';
import { LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Login: React.FC = () => {
  const { login, loading } = useAuth();
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [signupSuccess, setSignupSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSignupSuccess(false);

    if (isSignup) {
      // Signup logic
      try {
        const response = await fetch('http://localhost:5000/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const data = await response.json();
        if (response.ok) {
          setSignupSuccess(true);
          setIsSignup(false);
        } else {
          setError(data.error || 'Signup failed');
        }
      } catch {
        setError('Signup failed. Please try again.');
      }
    } else {
      // Login logic
      try {
        await login(email, password);
      } catch {
        setError('Login failed. Please check your credentials.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-blue-600 rounded-lg flex items-center justify-center">
            {isSignup ? <UserPlus className="h-6 w-6 text-white" /> : <LogIn className="h-6 w-6 text-white" />}
          </div>
          <h2 className="mt-6 text-3xl font-bold text-white">
            {isSignup ? 'Sign Up' : 'Database AI Assistant'}
          </h2>
          <p className="mt-2 text-gray-400">
            {isSignup
              ? 'Create your account to get started'
              : 'Connect your databases and analyze data with AI'}
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-700 placeholder-gray-400 text-white bg-gray-800 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={isSignup ? "new-password" : "current-password"}
                required
                className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-700 placeholder-gray-400 text-white bg-gray-800 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>
          {error && (
            <div className="text-red-500 text-sm text-center">{error}</div>
          )}
          {signupSuccess && (
            <div className="text-green-500 text-sm text-center">
              Signup successful! You can now log in.
            </div>
          )}
          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              {isSignup ? (
                <>
                  <UserPlus className="h-5 w-5 mr-2" />
                  {loading ? 'Signing up...' : 'Sign up'}
                </>
              ) : (
                <>
                  <LogIn className="h-5 w-5 mr-2" />
                  {loading ? 'Signing in...' : 'Sign in'}
                </>
              )}
            </button>
          </div>
        </form>
        <div className="text-center">
          <p className="text-sm text-gray-400">
            Securely connect to PostgreSQL, MySQL, and MongoDB databases
          </p>
        </div>
        <div className="text-center">
          <button
            className="text-blue-400 hover:underline"
            onClick={() => {
              setIsSignup(!isSignup);
              setError(null);
              setSignupSuccess(false);
            }}
          >
            {isSignup
              ? 'Already have an account? Log in'
              : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;