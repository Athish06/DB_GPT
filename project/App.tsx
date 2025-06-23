import React, { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { DatabaseProvider, useDatabase } from './src/contexts/DatabaseContext';
import Login from './src/components/Login';
import Dashboard from './src/components/Dashboard';
import LoadingSpinner from './src/components/ui/LoadingSpinner';

const AppContent: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const databaseContext = useDatabase();
  const { isConnected, setCredentials, setIsConnected } = databaseContext || {};

  // Try to auto-connect if user has databases in localStorage and not already connected
  useEffect(() => {
    if (user && !isConnected) {
      const dbs = localStorage.getItem('user_databases');
      if (dbs) {
        const databases = JSON.parse(dbs);
        if (databases.length > 0) {
          // You can let user pick, or auto-connect to the first one
          const db = databases[0];
          setCredentials && setCredentials({
            type: 'postgresql',
            host: db.host,
            port: db.port,
            username: db.user_name,
            password: db.password,
            database: db.database_name,
          });
          setIsConnected && setIsConnected(true);
        }
      }
    }
  }, [user, isConnected, setCredentials, setIsConnected]);

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