import React, { useEffect, useState } from 'react';
import { useDatabase } from '../contexts/DatabaseContext';
import { api } from '../services/api';

interface JsonNodeProps {
  label: string;
  value: unknown;
  initialExpanded?: boolean;
}

const JsonNode = ({ label, value, initialExpanded = false }: JsonNodeProps) => {
  const [expanded, setExpanded] = useState(initialExpanded);
  
  if (value === null || value === undefined) {
    return (
      <div className="flex font-mono text-sm py-0.5 items-start">
        <span className="font-semibold text-neutral-700 min-w-[150px] shrink-0 mr-2">{label} : </span>
        <span className="italic text-neutral-400">null</span>
      </div>
    );
  }
  
  if (typeof value === 'object') {
    const valObj = value as Record<string, unknown>;
    const keys = Object.keys(valObj);
    if (keys.length === 1 && keys[0] === '$oid') {
      return (
        <div className="flex flex-col sm:flex-row py-0.5 font-mono text-sm items-start">
          <span className="font-semibold text-neutral-700 min-w-[150px] shrink-0 mr-2">{label} : </span>
          <span className="text-neutral-600 break-all">ObjectId('{String(valObj.$oid)}')</span>
        </div>
      );
    }
    if (keys.length === 1 && keys[0] === '$date') {
      return (
        <div className="flex flex-col sm:flex-row py-0.5 font-mono text-sm items-start">
          <span className="font-semibold text-neutral-700 min-w-[150px] shrink-0 mr-2">{label} : </span>
          <span className="text-neutral-600 break-all">{new Date(String(valObj.$date)).toISOString()}</span>
        </div>
      );
    }

    const isArray = Array.isArray(value);
    return (
      <div className="flex flex-col font-mono text-sm py-0.5">
        <div 
          className="flex items-center cursor-pointer hover:bg-neutral-100 py-0.5 rounded px-1 -ml-1 select-none w-max"
          onClick={() => setExpanded(!expanded)}
        >
          <span className="w-4 inline-block text-center text-neutral-400 text-xs mr-1">
            {expanded ? '▼' : '▶'}
          </span>
          <span className="font-semibold text-neutral-700 shrink-0">{label} : </span>
          {!expanded && (
            <span className="text-neutral-500 italic ml-2 text-xs">
              {isArray ? `Array (${keys.length})` : `Object {${keys.length}}`}
            </span>
          )}
        </div>
        {expanded && (
          <div className="pl-6 border-l border-neutral-200 ml-1 mt-1 space-y-0.5">
            {keys.map(k => (
              <JsonNode key={k} label={k} value={value[k as keyof typeof value]} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row py-0.5 font-mono text-sm items-start">
      <span className="font-semibold text-neutral-700 min-w-[150px] shrink-0 mr-2">{label} : </span>
      <span className="text-neutral-600 break-all">
        {typeof value === 'string' ? `"${value}"` : String(value)}
      </span>
    </div>
  );
};

const ExpandableCell = ({ value }: { value: unknown }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  if (value === null || value === undefined) return <span className="text-neutral-400 italic">null</span>;

  const isObject = typeof value === 'object';
  const stringValue = isObject ? JSON.stringify(value) : String(value);

  if (stringValue.length < 50 && !isObject) {
    return <span className="text-neutral-800">{stringValue}</span>;
  }

  return (
    <div 
      className="max-w-xs xl:max-w-md cursor-pointer group" 
      onClick={() => setIsOpen(!isOpen)}
    >
      <div className={`transition-all ${isOpen ? 'whitespace-pre-wrap break-words bg-neutral-50 p-2 rounded-md border border-neutral-200 shadow-sm relative z-10' : 'truncate text-neutral-800 group-hover:text-blue-600'}`}>
        {isObject && isOpen ? (
          <pre className="font-mono text-xs text-neutral-600 whitespace-pre-wrap leading-relaxed">{JSON.stringify(value, null, 2)}</pre>
        ) : (
          <span className={isObject && !isOpen ? "font-mono text-[11px] text-neutral-600" : "text-sm text-neutral-800"}>
            {stringValue}
          </span>
        )}
      </div>
    </div>
  );
};

const TableViewer: React.FC = () => {
  const databaseContext = useDatabase();
  const selectedTable = databaseContext?.selectedTable;
  const selectedDatabaseId = databaseContext?.selectedDatabaseId;
  const tableData = databaseContext?.tableData;
  const setTableData = databaseContext?.setTableData;
  const databases = databaseContext?.databases || [];
  const currentDb = databases.find(db => db.db_id === selectedDatabaseId);
  const isMongo = currentDb?.type === 'mongodb';
  const [isLoading, setIsLoading] = useState(false);
  const [dbSummary, setDbSummary] = useState<any[] | null>(null);

  useEffect(() => {
    if (selectedTable && selectedDatabaseId) {
      loadTableData();
    } else if (!selectedTable && selectedDatabaseId) {
      loadDbSummary();
    } else {
      if (setTableData) setTableData(null);
      setDbSummary(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTable, selectedDatabaseId]);

  const loadDbSummary = async () => {
    setIsLoading(true);
    try {
      const response = await api.post('/db_summary', { db_id: selectedDatabaseId });
      setDbSummary(response.summary || []);
    } catch {
      setDbSummary(null);
    }
    setIsLoading(false);
  };

  const loadTableData = async () => {
    if (!selectedTable || !selectedDatabaseId) return;

    setIsLoading(true);
    try {
      const response = await api.post(`/table/${selectedTable}`, {
        db_id: selectedDatabaseId
      });
      if (Array.isArray(response)) {
        const schema = response.length > 0 ? Object.keys(response[0]).map(key => ({
          name: key,
          type: typeof response[0][key],
          nullable: true
        })) : [];
        if (setTableData) setTableData({ schema, rows: response });
      }
    } catch {
      if (setTableData) setTableData(null);
    }
    setIsLoading(false);
  };

  if (!selectedTable) {
    if (!selectedDatabaseId) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-neutral-400 h-full">
          <div className="text-lg font-medium text-neutral-600">No Database Selected</div>
          <p className="text-sm mt-1">Select a database from the sidebar to begin.</p>
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="flex-1 flex items-center justify-center h-full">
          <span className="text-neutral-500 font-medium">Loading database summary...</span>
        </div>
      );
    }

    if (!dbSummary) {
      return (
        <div className="flex-1 flex items-center justify-center text-neutral-400 h-full">
          <p>Failed to load database summary</p>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden p-8 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-surface-border flex-shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-semibold text-neutral-900 truncate">Database Overview</h2>
            <p className="text-sm text-neutral-500 mt-1">{dbSummary.length} {isMongo ? 'collections' : 'tables'} available</p>
          </div>
        </div>
        <div className="card flex-1 overflow-auto w-full relative p-6 bg-surface border-0 shadow-none">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {dbSummary.map((t, idx) => (
              <div key={idx} className="bg-white border border-surface-border rounded-xl p-5 shadow-sm hover:shadow transition-shadow">
                <div className="flex justify-between items-start mb-3 border-b border-neutral-100 pb-2">
                  <h3 className="font-semibold text-neutral-900 truncate" title={t.table_name}>{t.table_name}</h3>
                </div>
                <div className="flex space-x-8 text-sm">
                  <div className="flex flex-col">
                    <span className="text-neutral-400 font-medium mb-1 uppercase tracking-wider text-[10px]">Columns</span>
                    <span className="text-neutral-700 font-semibold">{t.columns_count}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-neutral-400 font-medium mb-1 uppercase tracking-wider text-[10px]">Rows</span>
                    <span className="text-neutral-700 font-semibold">{t.row_count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <span className="text-neutral-500 font-medium">Loading data...</span>
      </div>
    );
  }

  if (!tableData) {
    return (
      <div className="flex-1 flex items-center justify-center text-neutral-400 h-full">
        <p>Failed to load table data</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-8 space-y-6">
      {/* Fixed Header */}
      <div className="flex items-center justify-between pb-4 border-b border-surface-border flex-shrink-0">
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-semibold text-neutral-900 truncate">{selectedTable}</h2>
          <p className="text-sm text-neutral-500 mt-1">Showing up to 100 rows</p>
        </div>
        <div className="text-sm font-medium text-neutral-600 bg-neutral-100 px-3 py-1 rounded-full flex-shrink-0 ml-4">
          {tableData.rows.length} rows
        </div>
      </div>

      {/* Scrollable Table Area */}
      <div className="card flex-1 flex flex-col min-h-0 overflow-hidden relative">
        {isMongo ? (
          <div className="p-4 space-y-4 overflow-y-auto h-full">
            {tableData.rows.length === 0 ? (
              <div className="text-center text-neutral-500 text-sm py-8">
                No documents found in this collection.
              </div>
            ) : (
              tableData.rows.map((row, index) => (
                <div key={index} className="bg-white border border-surface-border rounded-lg p-4 shadow-sm">
                  {Object.entries(row).map(([key, value]) => (
                    <div key={key} className="border-b border-neutral-100 last:border-0 py-1">
                      <JsonNode label={key} value={value} />
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-auto relative">
            <table className="w-full text-left border-collapse whitespace-nowrap min-w-full">
              <thead className="bg-neutral-50 sticky top-0 z-20 border-b border-surface-border shadow-sm">
                <tr>
                  {tableData.schema.map((column: { name: string; type: string; nullable: boolean }) => (
                    <th key={column.name} className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wider bg-neutral-50">
                      {column.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border bg-surface">
                {tableData.rows.map((row, index) => (
                  <tr key={index} className="hover:bg-neutral-50 transition-colors group">
                    {tableData.schema.map((column: { name: string; type: string; nullable: boolean }) => (
                      <td key={column.name} className="px-4 py-3 text-sm text-neutral-800 align-top">
                        <ExpandableCell value={row[column.name]} />
                      </td>
                    ))}
                  </tr>
                ))}
                {tableData.rows.length === 0 && (
                  <tr>
                    <td colSpan={tableData.schema.length} className="px-4 py-8 text-center text-neutral-500 text-sm">
                      No data available in this table.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TableViewer;