import React, { useState } from 'react';
import { useDatabase } from '../contexts/DatabaseContext';
import { api } from '../services/api';

interface DatabaseConnectionProps {
  onClose?: () => void;
  onSuccess?: () => void;
}

const DatabaseConnection: React.FC<DatabaseConnectionProps> = ({ onClose, onSuccess }) => {
  const databaseContext = useDatabase();
  const fetchDatabases = databaseContext?.fetchDatabases;

  const [formData, setFormData] = useState({
    type: 'postgresql',
    display_name: '',
    host: '',
    port: 5432,
    username: '',
    password: '',
    database_name: '',
    connection_string: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const payload: Record<string, string | number> = {
        type: formData.type,
        display_name: formData.display_name || formData.database_name || 'My Database',
      };

      if (formData.type === 'mongodb' || formData.type === 'supabase') {
        payload.connection_string = formData.connection_string;
        payload.database_name = formData.database_name;
      } else {
        payload.host = formData.host;
        payload.port = formData.port;
        payload.user_name = formData.username;
        payload.password = formData.password;
        payload.database_name = formData.database_name;
      }

      await api.post('/add_db', payload);
      
      if (fetchDatabases) {
        await fetchDatabases();
      }
      
      if (onSuccess) onSuccess();
      if (onClose) onClose();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Connection failed.';
      setError(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'port' ? parseInt(value) || 0 : value
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-surface border border-surface-border w-full max-w-md rounded-lg shadow-md overflow-hidden">
        <div className="p-6 border-b border-surface-border">
          <h2 className="text-xl font-semibold text-neutral-900">Connect Database</h2>
          <p className="text-sm text-neutral-500 mt-1">Add a new data source to your workspace.</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md border border-red-200">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Display Name (Optional)</label>
            <input
              type="text"
              name="display_name"
              value={formData.display_name}
              onChange={handleInputChange}
              placeholder="e.g. Production DB"
              className="w-full input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Database Type</label>
            <select
              name="type"
              value={formData.type}
              onChange={handleInputChange}
              className="w-full input-field"
              required
            >
              <option value="postgresql">PostgreSQL</option>
              <option value="supabase">Supabase</option>
              <option value="mongodb">MongoDB</option>
            </select>
          </div>

          {formData.type === 'mongodb' || formData.type === 'supabase' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Connection String (URI)</label>
                <input
                  type="password"
                  name="connection_string"
                  value={formData.connection_string}
                  onChange={handleInputChange}
                  placeholder={formData.type === 'supabase' ? "postgresql://postgres.[ref]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres" : "mongodb+srv://..."}
                  className="w-full input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Database Name</label>
                <input
                  type="text"
                  name="database_name"
                  value={formData.database_name}
                  onChange={handleInputChange}
                  className="w-full input-field"
                  required
                />
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Host</label>
                  <input
                    type="text"
                    name="host"
                    value={formData.host}
                    onChange={handleInputChange}
                    className="w-full input-field"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Port</label>
                  <input
                    type="number"
                    name="port"
                    value={formData.port}
                    onChange={handleInputChange}
                    className="w-full input-field"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Database Name</label>
                <input
                  type="text"
                  name="database_name"
                  value={formData.database_name}
                  onChange={handleInputChange}
                  className="w-full input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Username</label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  className="w-full input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Password</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full input-field"
                  required
                />
              </div>
            </>
          )}

          <div className="pt-4 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary"
            >
              {isLoading ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DatabaseConnection;