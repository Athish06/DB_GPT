import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const Login: React.FC = () => {
  const { login } = useAuth();
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSignupSuccess(false);
    setIsSubmitting(true);

    if (isSignup) {
      // Signup logic
      try {
        const API_URL = import.meta.env.VITE_API_URL;
        const response = await fetch(`${API_URL}/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const data = await response.json();
        
        if (response.ok) {
          setSignupSuccess(true);
          setIsSignup(false);
          setPassword('');
        } else {
          // User-friendly error message abstraction
          if (data.error && data.error.includes('already exists')) {
            setError('This email is already registered. Please log in.');
          } else {
            setError('Signup failed. Please try again with a valid email and password.');
          }
        }
      } catch {
        setError('Network error. Please check your connection and try again.');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Login logic
      try {
        await login(email, password);
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Login failed.';
        if (errMsg.includes('Invalid credentials')) {
          setError('Incorrect email or password. Please try again.');
        } else {
          setError('Login failed. Please verify your credentials and try again.');
        }
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-surface border border-surface-border rounded-xl shadow-sm overflow-hidden p-8">
        <div className="text-center mb-8">
          <div className="mx-auto flex items-center justify-center mb-6 transition-all duration-500 hover:-translate-y-1 hover:scale-105 drop-shadow-xl">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" className="w-16 h-16">
              <path d="M 20 15 L 60 15 C 85 15, 85 75, 60 75 L 45 75 L 45 95 L 20 75 Z" fill="white" stroke="#171717" strokeWidth="4" strokeLinejoin="round" />
              <path d="M 38 38 C 38 34, 42 34, 48 34 L 52 34 C 58 34, 62 34, 62 38 L 62 52 C 62 56, 58 56, 52 56 L 48 56 L 42 63 L 42 56 L 40 56 C 38 56, 38 52, 38 52 Z" fill="#171717" />
              <rect x="49" y="24" width="2" height="10" fill="#171717" />
              <circle cx="50" cy="22" r="3" fill="#171717" />
              <circle cx="44" cy="45" r="3.5" fill="white" />
              <circle cx="56" cy="45" r="3.5" fill="white" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-neutral-900 tracking-tight">
            {isSignup ? 'Create Account' : 'Welcome Back'}
          </h2>
          <p className="mt-2 text-sm text-neutral-500">
            {isSignup
              ? 'Join DB-GPT to build intelligent data agents.'
              : 'Sign in to access your databases and agents.'}
          </p>
        </div>

        {signupSuccess && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm text-center font-medium">
            Account created successfully! Please log in with your new credentials.
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm text-center font-medium">
            {error}
          </div>
        )}

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Email Address</label>
            <input
              type="email"
              required
              className="input-field w-full"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Password</label>
            <input
              type="password"
              required
              className="input-field w-full"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting || !email || !password}
            className="btn-primary w-full py-2.5 flex justify-center mt-2 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
          >
            {isSignup ? (
              isSubmitting ? 'Signing up...' : 'Sign up'
            ) : (
              isSubmitting ? 'Signing in...' : 'Sign in'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            className="text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
            onClick={() => {
              setIsSignup(!isSignup);
              setError(null);
              setSignupSuccess(false);
            }}
            disabled={isSubmitting}
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