import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

interface StorageStats {
  db_id: string;
  target: string;
  schema_cache: { count: number; size_bytes: number };
  parquet_files: { count: number; size_bytes: number };
  redis_keys: { count: number; size_bytes: number };
}

interface ParquetFileDetail {
  filename: string;
  total_rows?: number;
  rows?: Record<string, unknown>[];
  error?: string;
}

interface RedisKeyDetail {
  key: string;
  type: string;
  value: unknown;
}

interface StorageDetailsResponse {
  db_id: string;
  target: string;
  schema_cache?: Record<string, unknown>;
  parquet_files?: ParquetFileDetail[];
  redis_keys?: RedisKeyDetail[];
}

interface GroupedDbStat {
  db_id: string;
  total_bytes: number;
  parquet_count: number;
  redis_count: number;
  schema_count: number;
}

import TopNav from './layout/TopNav';
import { useDatabase } from '../contexts/DatabaseContext';

export const StorageDashboard: React.FC = () => {
  const [stats, setStats] = useState<StorageStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDetails, setSelectedDetails] = useState<StorageDetailsResponse | null>(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedDbView, setSelectedDbView] = useState<string | null>(null);
  
  const databaseContext = useDatabase();
  const databases = databaseContext?.databases || [];

  const getDbName = (dbId: string) => {
    const db = databases.find(d => d.db_id === dbId);
    return db ? db.database_name || db.display_name : `DB: ${dbId.slice(0, 8)}...`;
  };

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/api/storage');
      setStats(response as StorageStats[]);
    } catch (error) {
      console.error("Failed to fetch storage stats", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const fetchDetails = async (db_id: string, target: string) => {
    setIsDetailsLoading(true);
    setShowModal(true);
    try {
      const response = await api.get(`/api/storage/details?db_id=${db_id}&target=${target}`);
      setSelectedDetails({ ...response, db_id, target });
    } catch (error) {
      console.error("Failed to fetch storage details", error);
    } finally {
      setIsDetailsLoading(false);
    }
  };

  const deleteStorage = async (e: React.MouseEvent, db_id: string, target?: string) => {
    e.stopPropagation(); // Prevent opening the modal or clicking the card
    const isEntireDB = !target;
    const confirmMsg = isEntireDB 
      ? `Are you sure you want to delete the ENTIRE storage for this database? This will clear the schema cache and all table caches. This action cannot be undone.`
      : `Are you sure you want to delete the storage for target '${target}'? This action cannot be undone.`;
      
    if (window.confirm(confirmMsg)) {
      setIsLoading(true);
      try {
        let url = `/api/storage?db_id=${db_id}`;
        if (target) url += `&target=${target}`;
        await api.delete(url);
        
        // If we deleted the entire DB and it's the currently viewed one, go back
        if (isEntireDB && selectedDbView === db_id) {
          setSelectedDbView(null);
        }
        
        await fetchStats();
      } catch (error) {
        console.error("Failed to delete storage", error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchStats();
    if (databases.length === 0) {
      databaseContext?.fetchDatabases();
    }
  }, [databases.length, databaseContext]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Group stats by DB
  const groupedStats = React.useMemo(() => {
    const groups: Record<string, GroupedDbStat> = {};
    stats.forEach(stat => {
      if (!groups[stat.db_id]) {
        groups[stat.db_id] = {
          db_id: stat.db_id,
          total_bytes: 0,
          parquet_count: 0,
          redis_count: 0,
          schema_count: 0,
        };
      }
      groups[stat.db_id].total_bytes += stat.schema_cache.size_bytes + stat.parquet_files.size_bytes + stat.redis_keys.size_bytes;
      groups[stat.db_id].parquet_count += stat.parquet_files.count;
      groups[stat.db_id].redis_count += stat.redis_keys.count;
      groups[stat.db_id].schema_count += stat.schema_cache.count;
    });
    return Object.values(groups);
  }, [stats]);

  const activeStats = selectedDbView ? stats.filter(s => s.db_id === selectedDbView) : [];

  return (
    <div className="h-screen bg-neutral-50 flex flex-col overflow-hidden relative">
      <TopNav />
      <div className="flex-1 bg-surface flex flex-col p-8 overflow-y-auto w-full h-full">
        <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">
            {selectedDbView ? getDbName(selectedDbView) : 'Storage Usage'}
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            {selectedDbView ? 'Detailed storage breakdown for this database.' : 'Manage your active cache and queue storage.'}
          </p>
        </div>
        <div className="flex gap-4">
          {selectedDbView && (
            <button 
              onClick={() => setSelectedDbView(null)}
              className="p-2 border border-neutral-200 rounded-md hover:bg-neutral-50 transition-colors flex items-center gap-2 text-sm text-neutral-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
              Back to Storage
            </button>
          )}
          <button 
            onClick={fetchStats}
            className="p-2 border border-neutral-200 rounded-md hover:bg-neutral-50 transition-colors flex items-center gap-2 text-sm text-neutral-700 group"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isLoading ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-500"}>
              <path d="M21 2v6h-6"></path>
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
              <path d="M3 3v5h5"></path>
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {isLoading && stats.length === 0 ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : stats.length === 0 ? (
        <div className="text-center py-12 text-neutral-500 bg-white border border-neutral-200 rounded-xl">
          <svg className="w-12 h-12 mx-auto text-neutral-300 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
          No active storage found.
        </div>
      ) : !selectedDbView ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {groupedStats.map((db, idx) => (
            <div 
              key={idx} 
              onClick={() => setSelectedDbView(db.db_id)}
              className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-neutral-400 group relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300"></div>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-lg text-neutral-900 truncate group-hover:text-blue-600 transition-colors" title={getDbName(db.db_id)}>{getDbName(db.db_id)}</h3>
                  <p className="text-xs text-neutral-500 uppercase tracking-wider mt-1">Entire Database</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="bg-neutral-100 text-neutral-700 px-3 py-1 rounded-full text-xs font-semibold">
                    {formatBytes(db.total_bytes)}
                  </div>
                  <button 
                    onClick={(e) => deleteStorage(e, db.db_id)}
                    title="Delete Entire DB Storage"
                    className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                  </button>
                </div>
              </div>

              <div className="space-y-4 mt-6">
                <div className="flex justify-between items-center text-sm border-b border-neutral-100 pb-3">
                  <div className="flex items-center gap-2 text-neutral-600">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    DuckDB Cache
                  </div>
                  <div className="font-medium">
                    {db.parquet_count > 0 ? (
                      <span>{db.parquet_count} active files</span>
                    ) : (
                      <span className="text-neutral-400">Empty</span>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center text-sm border-b border-neutral-100 pb-3">
                  <div className="flex items-center gap-2 text-neutral-600">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    Redis Queue
                  </div>
                  <div className="font-medium">
                    {db.redis_count > 0 ? (
                      <span>{db.redis_count} active tasks</span>
                    ) : (
                      <span className="text-neutral-400">Empty</span>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2 text-neutral-600">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    MongoDB Schema
                  </div>
                  <div className="font-medium">
                    {db.schema_count > 0 ? (
                      <span>Cached</span>
                    ) : (
                      <span className="text-neutral-400">Not Cached</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-right-8 duration-300">
          {activeStats.map((stat, idx) => {
            const totalBytes = stat.schema_cache.size_bytes + stat.parquet_files.size_bytes + stat.redis_keys.size_bytes;
            return (
              <div 
                key={idx} 
                onClick={() => fetchDetails(stat.db_id, stat.target)}
                className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer hover:border-blue-400 group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold text-neutral-900 truncate group-hover:text-blue-600 transition-colors">
                      {stat.target === '__all__' ? 'Global Context' : stat.target}
                    </h3>
                    <p className="text-xs text-neutral-500 uppercase tracking-wider mt-1">
                      {stat.target === '__all__' ? 'Entire Database' : 'Specific Table'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="bg-blue-50 text-blue-700 border border-blue-100 px-3 py-1 rounded-full text-xs font-semibold">
                      {formatBytes(totalBytes)}
                    </div>
                    <button 
                      onClick={(e) => deleteStorage(e, stat.db_id, stat.target)}
                      title="Delete Target Storage"
                      className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                    </button>
                  </div>
                </div>

                <div className="space-y-4 mt-6">
                  <div className="flex justify-between items-center text-sm border-b border-neutral-100 pb-3">
                    <div className="flex items-center gap-2 text-neutral-600">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      DuckDB Cache
                    </div>
                    <div className="font-medium">
                      {stat.parquet_files.count > 0 ? (
                        <span>{stat.parquet_files.count} files ({formatBytes(stat.parquet_files.size_bytes)})</span>
                      ) : (
                        <span className="text-neutral-400">Empty</span>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-sm border-b border-neutral-100 pb-3">
                    <div className="flex items-center gap-2 text-neutral-600">
                      <div className="w-2 h-2 rounded-full bg-red-500"></div>
                      Redis Queue
                    </div>
                    <div className="font-medium">
                      {stat.redis_keys.count > 0 ? (
                        <span>{stat.redis_keys.count} tasks ({formatBytes(stat.redis_keys.size_bytes)})</span>
                      ) : (
                        <span className="text-neutral-400">Empty</span>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2 text-neutral-600">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      MongoDB Schema
                    </div>
                    <div className="font-medium">
                      {stat.schema_cache.count > 0 ? (
                        <span>Cached ({formatBytes(stat.schema_cache.size_bytes)})</span>
                      ) : (
                        <span className="text-neutral-400">Not Cached</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>

      {/* Details Modal */}
      {showModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
          <div className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm" onClick={() => setShowModal(false)}></div>
          <div className="relative w-full max-w-5xl max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            <div className="flex items-center justify-between p-6 border-b border-neutral-200 bg-neutral-50/50">
              <div>
                <h2 className="text-xl font-bold text-neutral-900">
                  {selectedDetails ? getDbName(selectedDetails.db_id) : 'Loading...'}
                </h2>
                <p className="text-sm text-neutral-500 mt-1 uppercase tracking-wider">
                  Target: {selectedDetails?.target === '__all__' ? 'Global Database' : selectedDetails?.target}
                </p>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-200/50 rounded-full transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-neutral-50/30 space-y-8">
              {isDetailsLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-neutral-500">
                  <div className="w-8 h-8 border-4 border-neutral-900 border-t-transparent rounded-full animate-spin mb-4"></div>
                  Reading cache and queues...
                </div>
              ) : selectedDetails ? (
                <>
                  {/* DuckDB Parquet Previews */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-neutral-800 flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div> DuckDB Parquet Previews
                    </h3>
                    {selectedDetails.parquet_files?.length === 0 ? (
                      <p className="text-sm text-neutral-500 italic px-5">No parquet files found.</p>
                    ) : (
                      selectedDetails.parquet_files?.map((pq: ParquetFileDetail, i: number) => (
                        <div key={i} className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
                          <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-200 flex justify-between items-center">
                            <code className="text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded font-mono">{pq.filename}</code>
                            <span className="text-xs font-medium text-neutral-500 px-2 py-1 bg-neutral-200 rounded-full">Total Rows: {pq.total_rows} (Showing first 50)</span>
                          </div>
                          <div className="overflow-x-auto max-h-64">
                            {pq.error ? (
                              <div className="p-4 text-red-500 text-sm">{pq.error}</div>
                            ) : (
                              <table className="min-w-full divide-y divide-neutral-200 text-sm">
                                <thead className="bg-neutral-50 sticky top-0">
                                  <tr>
                                    {Object.keys(pq.rows?.[0] || {}).map(k => (
                                      <th key={k} className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">{k}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-neutral-100">
                                  {pq.rows?.map((row: Record<string, unknown>, ri: number) => (
                                    <tr key={ri} className="hover:bg-blue-50/30 transition-colors">
                                      {Object.values(row).map((val: unknown, vi: number) => (
                                        <td key={vi} className="px-4 py-2 text-neutral-700 max-w-xs truncate" title={String(val)}>{String(val)}</td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Redis Queue Status */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-neutral-800 flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div> Redis Active Job Queues
                    </h3>
                    {selectedDetails.redis_keys?.length === 0 ? (
                      <p className="text-sm text-neutral-500 italic px-5">No active jobs in Redis.</p>
                    ) : (
                      <div className="grid grid-cols-1 gap-4">
                        {selectedDetails.redis_keys?.map((r: RedisKeyDetail, i: number) => (
                          <div key={i} className="bg-neutral-900 rounded-xl overflow-hidden shadow-sm flex flex-col">
                            <div className="px-4 py-2 border-b border-neutral-800 bg-neutral-950 flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-green-500"></span>
                              <code className="text-xs text-neutral-400 font-mono">{r.key}</code>
                            </div>
                            <div className="p-4 overflow-x-auto max-h-64">
                              <pre className="text-xs text-green-400 font-mono">
                                {JSON.stringify(r.value, null, 2)}
                              </pre>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* MongoDB Schema Cache */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-neutral-800 flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div> MongoDB Schema Cache Payload
                    </h3>
                    {!selectedDetails.schema_cache ? (
                      <p className="text-sm text-neutral-500 italic px-5">Schema not cached.</p>
                    ) : (
                      <div className="bg-[#1e1e1e] rounded-xl overflow-hidden shadow-sm">
                        <div className="p-4 overflow-x-auto max-h-96">
                          <pre className="text-xs text-blue-300 font-mono">
                            {JSON.stringify(selectedDetails.schema_cache, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
};
