import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

interface SettingsModalProps {
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const [groqKey, setGroqKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get('/api/settings');
        setHasKey(res.has_groq_key);
      } catch (e) {
        console.error(e);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groqKey.trim()) return;
    setIsLoading(true);
    setStatus('');
    
    try {
      await api.post('/api/settings/groq-key', { groq_api_key: groqKey });
      setStatus('Key saved securely.');
      setHasKey(true);
      setGroqKey('');
    } catch (e: unknown) {
      setStatus(`Error: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div className="bg-surface border border-surface-border w-full max-w-md rounded-lg shadow-md overflow-hidden">
        <div className="p-6 border-b border-surface-border flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-neutral-900">Workspace Settings</h2>
            <p className="text-sm text-neutral-500 mt-1">Configure your AI pipeline.</p>
          </div>
        </div>

        <div className="p-6">
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Groq API Key</label>
              <div className="flex space-x-2">
                <input
                  type="password"
                  value={groqKey}
                  onChange={(e) => setGroqKey(e.target.value)}
                  placeholder={hasKey ? "•••••••••••••••• (Key Configured)" : "gsk_..."}
                  className="flex-1 input-field"
                />
                <button
                  type="submit"
                  disabled={isLoading || !groqKey.trim()}
                  className="btn-primary whitespace-nowrap"
                >
                  {isLoading ? 'Saving...' : 'Save Key'}
                </button>
              </div>
              <p className="text-xs text-neutral-500 mt-2">
                Your key is symmetrically encrypted using Fernet cryptography before being stored in the database.
              </p>
              {status && (
                <p className={`text-sm mt-3 font-medium ${status.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
                  {status}
                </p>
              )}
            </div>
          </form>
        </div>

        <div className="p-4 border-t border-surface-border flex justify-end bg-neutral-50">
          <button onClick={onClose} className="btn-secondary">
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
