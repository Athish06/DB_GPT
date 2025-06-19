import React, { useState } from 'react';
import { Plus, Sparkles, Save } from 'lucide-react';
import { useDatabase } from '../contexts/DatabaseContext';
import LoadingSpinner from './ui/LoadingSpinner';

const DataForm: React.FC = () => {
  const { selectedTable, tableData, credentials } = useDatabase();
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [aiPrompt, setAiPrompt] = useState('');
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (name: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim() || !tableData) return;

    setIsLoadingAI(true);
    // ...your AI logic here...
    setIsLoadingAI(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTable || !credentials) return;

    setIsSubmitting(true);
    const payload = {
      db_config: {
        host: credentials.host,
        database: credentials.database,
        user: credentials.username,
        password: credentials.password,
      },
      table_name: selectedTable,
      data: formData,
    };

    try {
      const response = await fetch('http://localhost:5000/add_data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (result?.success) {
        setFormData({});
        // Optionally show a success message
      } else {
        // Optionally show an error message
      }
    } catch (error) {
      // Optionally show an error message
    }
    setIsSubmitting(false);
  };

  if (!selectedTable || !tableData) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 text-center text-gray-400">
        <Plus className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Select a table to add data</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg h-full flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <Plus className="h-5 w-5 text-green-400" />
          <h3 className="font-medium text-white">Add Data to {selectedTable}</h3>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* AI Assistant */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Sparkles className="h-4 w-4 text-purple-400" />
            <span className="text-sm font-medium text-white">AI Assistant</span>
          </div>
          <div className="flex space-x-2">
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="e.g., Add a new user with name John Doe and age 25"
              className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              onClick={handleAIGenerate}
              disabled={isLoadingAI || !aiPrompt.trim()}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoadingAI ? (
                <LoadingSpinner size="sm" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tableData.schema
              .filter(column => column.name.toLowerCase() !== 'id') // Skip auto-increment IDs
              .map((column) => (
                <div key={column.name}>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {column.name}
                    {!column.nullable && <span className="text-red-400 ml-1">*</span>}
                  </label>
                  {column.type.includes('text') || column.type.includes('varchar') || column.type.includes('string') ? (
                    <input
                      type="text"
                      value={formData[column.name] || ''}
                      onChange={(e) => handleInputChange(column.name, e.target.value)}
                      required={!column.nullable}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : column.type.includes('int') || column.type.includes('number') ? (
                    <input
                      type="number"
                      value={formData[column.name] || ''}
                      onChange={(e) => handleInputChange(column.name, e.target.value ? Number(e.target.value) : '')}
                      required={!column.nullable}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : column.type.includes('bool') ? (
                    <select
                      value={formData[column.name] !== undefined ? String(formData[column.name]) : ''}
                      onChange={(e) => handleInputChange(column.name, e.target.value === 'true')}
                      required={!column.nullable}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select...</option>
                      <option value="true">True</option>
                      <option value="false">False</option>
                    </select>
                  ) : column.type.includes('date') || column.type.includes('timestamp') ? (
                    <input
                      type="datetime-local"
                      value={formData[column.name] || ''}
                      onChange={(e) => handleInputChange(column.name, e.target.value)}
                      required={!column.nullable}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <input
                      type="text"
                      value={formData[column.name] || ''}
                      onChange={(e) => handleInputChange(column.name, e.target.value)}
                      required={!column.nullable}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Type: {column.type} {column.nullable && '(optional)'}
                  </p>
                </div>
              ))}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <LoadingSpinner size="sm" />
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Insert Data</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default DataForm;