import React, { useState } from 'react';
import { Plus, Sparkles, Save } from 'lucide-react';
import { useDatabase } from '../contexts/DatabaseContext';
import LoadingSpinner from './ui/LoadingSpinner';
import { api } from '../services/api';

const DataForm: React.FC = () => {
  const databaseContext = useDatabase();
  const selectedTable = databaseContext?.selectedTable;
  const tableData = databaseContext?.tableData;
  const selectedDatabaseId = databaseContext?.selectedDatabaseId;
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [aiPrompt, setAiPrompt] = useState('');
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAIPopup, setShowAIPopup] = useState(false);
  const [aiGeneratedData, setAIGeneratedData] = useState<Record<string, unknown> | null>(null);

  const handleInputChange = (name: string, value: unknown) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };



  const handleAIAssistedInsert = async () => {
    if (!aiPrompt.trim() || !selectedTable || !selectedDatabaseId) return;

    setIsLoadingAI(true);

    const payload: Record<string, unknown> = {
      db_id: selectedDatabaseId,
      table_name: selectedTable,
      user_prompt: aiPrompt,
    };

    try {
      const result = await api.post('/add_data_ai', payload);
      if (result?.data) {
        setAIGeneratedData(result.data as Record<string, unknown>); // Store AI-generated data
        setShowAIPopup(true); // Show the popup
      } else {
        alert(result?.summary || result?.error || "AI Assistant could not generate data.");
      }
    } catch (err) {
      console.error(err);
      alert("Network or server error during AI-assisted insert.");
    }

    setIsLoadingAI(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTable || !selectedDatabaseId) return;

    setIsSubmitting(true);
    const payload: Record<string, unknown> = {
      db_id: selectedDatabaseId,
      table_name: selectedTable,
      data: formData,
    };

    try {
      const result = await api.post('/add_data', payload);
      if (result?.success) {
        setFormData({});
        // Optionally show a success message
      } else {
        // Optionally show an error message
      }
    } catch (err) {
      console.error(err);
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
              onClick={handleAIAssistedInsert}
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
              .map((column) => {
                const colType = column.type.toLowerCase();
                const isRequired = !column.nullable;
                let inputField: React.ReactNode = null;

                if (colType.includes('int') || colType.includes('number')) {
                  inputField = (
                    <input
                      type="number"
                      value={(formData[column.name] as string | number) || ''}
                      onChange={(e) => handleInputChange(column.name, e.target.value ? Number(e.target.value) : '')}
                      required={isRequired}
                      placeholder={`Enter ${column.name}`}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  );
                } else if (colType.includes('float') || colType.includes('double') || colType.includes('real') || colType.includes('decimal')) {
                  inputField = (
                    <input
                      type="number"
                      step="any"
                      value={(formData[column.name] as string | number) || ''}
                      onChange={(e) => handleInputChange(column.name, e.target.value ? Number(e.target.value) : '')}
                      required={isRequired}
                      placeholder={`Enter ${column.name}`}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  );
                } else if (colType.includes('bool')) {
                  inputField = (
                    <select
                      value={formData[column.name] !== undefined ? String(formData[column.name]) : ''}
                      onChange={(e) => handleInputChange(column.name, e.target.value === 'true')}
                      required={isRequired}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select...</option>
                      <option value="true">True</option>
                      <option value="false">False</option>
                    </select>
                  );
                } else if (colType.includes('date') || colType.includes('timestamp')) {
                  inputField = (
                    <input
                      type="datetime-local"
                      value={(formData[column.name] as string) || ''}
                      onChange={(e) => handleInputChange(column.name, e.target.value)}
                      required={isRequired}
                      placeholder={`Enter ${column.name}`}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  );
                } else if (colType.includes('enum') && 'enumValues' in column && Array.isArray((column as Record<string, unknown>).enumValues)) {
                  inputField = (
                    <select
                      value={String(formData[column.name] || '')}
                      onChange={(e) => handleInputChange(column.name, e.target.value)}
                      required={isRequired}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select...</option>
                      {((column as Record<string, unknown>).enumValues as string[]).map((val: string) => (
                        <option key={val} value={val}>{val}</option>
                      ))}
                    </select>
                  );
                } else {
                  // Default to text input for string and unknown types
                  inputField = (
                    <input
                      type="text"
                      value={(formData[column.name] as string | number) || ''}
                      onChange={(e) => handleInputChange(column.name, e.target.value)}
                      required={isRequired}
                      placeholder={`Enter ${column.name}`}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  );
                }

                return (
                  <div key={column.name}>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {column.name}
                      {isRequired && <span className="text-red-400 ml-1">*</span>}
                    </label>
                    {inputField}
                    <p className="text-xs text-gray-500 mt-1">
                      Type: {column.type} {column.nullable && '(optional)'}
                    </p>
                  </div>
                );
              })}
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

        {/* AI Action Popup */}
        {showAIPopup && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg text-white max-w-sm w-full">
              <h3 className="text-lg font-bold mb-4">How would you like to add data?</h3>
              <div className="flex flex-col space-y-3">
                <button
                  className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded"
                  onClick={async () => {
                    // AI Insert: send the data to backend for actual insertion
                    setShowAIPopup(false);
                    setIsLoadingAI(true);
                    if (!selectedDatabaseId) {
                      alert("Database not selected.");
                      setIsLoadingAI(false);
                      return;
                    }
                    const payload: Record<string, unknown> = {
                      db_id: selectedDatabaseId,
                      table_name: selectedTable,
                      data: aiGeneratedData,
                      auto_insert: true,
                    };
                    try {
                      const result = await api.post('/add_data_ai', payload);
                      if (result?.success) {
                        setFormData({});
                        setAiPrompt('');
                        alert('Data inserted via AI!');
                      } else {
                        alert(result?.summary || result?.error || "AI Assistant failed to insert data.");
                      }
                    } catch (err) {
                      console.error(err);
                      alert("Network or server error during AI insert.");
                    }
                    setIsLoadingAI(false);
                  }}
                >
                  Add via AI
                </button>
                <button
                  className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
                  onClick={() => {
                    setFormData(aiGeneratedData || {});
                    setShowAIPopup(false);
                  }}
                >
                  Add Manually
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DataForm;