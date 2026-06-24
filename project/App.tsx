import React from 'react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { DatabaseProvider } from './src/contexts/DatabaseContext';
import Login from './src/components/Login';
import Dashboard from './src/components/Dashboard';
import LoadingSpinner from './src/components/ui/LoadingSpinner';
import { StorageDashboard } from './src/components/StorageDashboard';

const AppContent: React.FC = () => {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  // Only show DatabaseConnection if user has no saved databases
  ///const userDatabases = localStorage.getItem('user_databases');
  ///if (!isConnected && (!userDatabases || JSON.parse(userDatabases).length === -1)) {
   /// return <DatabaseConnection />;
 /// }

  if (window.location.pathname === '/storage') {
    return <StorageDashboard />;
  }

  return <Dashboard />;
};

function App() {
  return (
    <AuthProvider>
      <DatabaseProvider>
        <div className="min-h-screen bg-gray-900">
          <AppContent />
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#374151',
                color: '#fff',
                border: '1px solid #4B5563',
              },
              success: {
                iconTheme: {
                  primary: '#10B981',
                  secondary: '#fff',
                },
              },
              error: {
                iconTheme: {
                  primary: '#EF4444',
                  secondary: '#fff',
                },
              },
            }}
          />
        </div>
      </DatabaseProvider>
    </AuthProvider>
  );
}

export default App;