import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import SettingsModal from '../SettingsModal';
import { api } from '../../services/api';

const TopNav: React.FC = () => {
  const { user, logout: originalLogout } = useAuth();
  const [showSettings, setShowSettings] = useState(false);

  const logout = async () => {
    // Just logout directly from auth context, backend connections are stateless now
    originalLogout();
  };

  return (
    <>
      <nav className="bg-surface border-b border-surface-border px-6 py-4 flex items-center justify-between shadow-sm z-10 relative">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center select-none transition-all duration-300 hover:scale-105 drop-shadow-md">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" className="w-10 h-10">
              <path d="M 20 15 L 60 15 C 85 15, 85 75, 60 75 L 45 75 L 45 95 L 20 75 Z" fill="white" stroke="#171717" strokeWidth="4" strokeLinejoin="round" />
              <path d="M 38 38 C 38 34, 42 34, 48 34 L 52 34 C 58 34, 62 34, 62 38 L 62 52 C 62 56, 58 56, 52 56 L 48 56 L 42 63 L 42 56 L 40 56 C 38 56, 38 52, 38 52 Z" fill="#171717" />
              <rect x="49" y="24" width="2" height="10" fill="#171717" />
              <circle cx="50" cy="22" r="3" fill="#171717" />
              <circle cx="44" cy="45" r="3.5" fill="white" />
              <circle cx="56" cy="45" r="3.5" fill="white" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-neutral-900 tracking-tight">DB-GPT</h1>
        </div>
        
        <div className="flex items-center space-x-6">
          <div className="text-sm font-medium text-neutral-600">
            {user?.email}
          </div>
          
          <button
            onClick={() => setShowSettings(true)}
            className="text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
          >
            Settings
          </button>
          
          <button
            onClick={logout}
            className="text-sm font-medium text-neutral-600 hover:text-red-600 transition-colors"
          >
            Logout
          </button>
        </div>
      </nav>

      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}
    </>
  );
};

export default TopNav;