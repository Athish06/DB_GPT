import React, { useState, useEffect } from 'react';
import { useDatabase } from '../../contexts/DatabaseContext';
import { api } from '../../services/api';
import DatabaseConnection from '../DatabaseConnection';

const Sidebar: React.FC = () => {
  const databaseContext = useDatabase();
  const [showAddModal, setShowAddModal] = useState(false);
  const [isLoadingTables, setIsLoadingTables] = useState(false);

  // Provide fallbacks to avoid conditional hook execution
  const {
    databases = [],
    fetchDatabases = () => Promise.resolve(),
    selectedDatabaseId = null,
    setSelectedDatabaseId = () => {},
    tables = [],
    setTables = () => {},
    selectedTable = null,
    setSelectedTable = () => {},
  } = databaseContext || {};

  useEffect(() => {
    if (databaseContext) {
      fetchDatabases();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch tables when a DB is selected
  useEffect(() => {
    const fetchTablesData = async () => {
      if (selectedDatabaseId) {
        setIsLoadingTables(true);
        try {
          const res = await api.post('/tables', { db_id: selectedDatabaseId });
          setTables(res.tables || []);
        } catch (e) {
          console.error(e);
          setTables([]);
        } finally {
          setIsLoadingTables(false);
        }
      } else {
        setTables([]);
      }
    };
    fetchTablesData();
  }, [selectedDatabaseId, setTables]);

  const handleAddDbSuccess = async () => {
    setShowAddModal(false);
  };

  return (
    <div className="w-64 bg-surface border-r border-surface-border flex flex-col h-full">
      <div className="p-5 border-b border-surface-border flex justify-between items-center bg-neutral-50">
        <h2 className="text-sm font-semibold text-neutral-900 tracking-wide uppercase">Sources</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="text-xs font-medium text-neutral-600 hover:text-neutral-900 transition-colors bg-white px-2 py-1 rounded border border-neutral-200 shadow-sm"
        >
          Add New
        </button>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* Databases Section */}
        <div className="p-3">
          <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-widest mb-2 px-2">Databases</div>
          {databases.length === 0 ? (
            <div className="px-2 py-3 text-xs text-neutral-500">No databases added.</div>
          ) : (
            <div className="space-y-1">
              {databases.map(db => (
                <button
                  key={db.db_id}
                  onClick={() => setSelectedDatabaseId(db.db_id)}
                  className={`w-full text-left px-3 py-2 text-sm rounded-md transition-all ${
                    selectedDatabaseId === db.db_id 
                      ? 'bg-neutral-900 text-white font-medium shadow-sm' 
                      : 'text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="truncate">{db.display_name}</span>
                    <span className="text-[10px] uppercase opacity-60 ml-2">{db.type}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tables Section */}
        {selectedDatabaseId && (
          <div className="p-3 border-t border-surface-border flex-1">
            <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-widest mb-2 px-2">Targets</div>
            {isLoadingTables ? (
              <div className="px-2 py-3 text-xs text-neutral-500 animate-pulse">Loading targets...</div>
            ) : tables.length === 0 ? (
              <div className="px-2 py-3 text-xs text-neutral-500">No targets found.</div>
            ) : (
              <div className="space-y-1">
                {tables.map(table => (
                  <button
                    key={table}
                    onClick={() => setSelectedTable(table)}
                    className={`w-full text-left px-3 py-2 text-sm rounded-md transition-all ${
                      selectedTable === table 
                        ? 'bg-neutral-100 text-neutral-900 font-medium' 
                        : 'text-neutral-600 hover:bg-neutral-50'
                    }`}
                  >
                    <span className="truncate">{table}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showAddModal && (
        <DatabaseConnection onClose={() => setShowAddModal(false)} onSuccess={handleAddDbSuccess} />
      )}
      {!databaseContext && (
        <div className="hidden">Database context missing</div>
      )}
    </div>
  );
};

export default Sidebar;