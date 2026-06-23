import React, { useEffect, useState } from 'react';
import { useDatabase } from '../contexts/DatabaseContext';
import { api } from '../services/api';

const JsonNode = ({ label, value, initialExpanded = false }: any) => {
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
    const keys = Object.keys(value);
    if (keys.length === 1 && keys[0] === '$oid') {
      return (
        <div className="flex flex-col sm:flex-row py-0.5 font-mono text-sm items-start">
          <span className="font-semibold text-neutral-700 min-w-[150px] shrink-0 mr-2">{label} : </span>
          <span className="text-neutral-600 break-all">ObjectId('{value.$oid}')</span>
        </div>
      );
    }
    if (keys.length === 1 && keys[0] === '$date') {
      return (
        <div className="flex flex-col sm:flex-row py-0.5 font-mono text-sm items-start">
          <span className="font-semibold text-neutral-700 min-w-[150px] shrink-0 mr-2">{label} : </span>
          <span className="text-neutral-600 break-all">{new Date(value.$date).toISOString()}</span>
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

  useEffect(() => {
    if (selectedTable && selectedDatabaseId) {
      loadTableData();
    } else {
      if (setTableData) setTableData(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTable, selectedDatabaseId]);

  const loadTableData = async () => {
    if (!selectedTable || !selectedDatabaseId) return;

    setIsLoading(true);
    try {
      const response = await api.post(`/table/${selectedTable}`, {
        db_id: selectedDatabaseId
      });
      // The backend returns an array of rows. We need to construct schema dynamically if it's MongoDB, or it's just raw rows.
      if (Array.isArray(response)) {
        // Infer schema from first row
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

  const renderCellData = (value: unknown) => {
    if (value === null || value === undefined) return <span className="text-neutral-400 italic">null</span>;
    if (typeof value === 'object') return <span className="font-mono text-[11px] text-neutral-600 whitespace-pre-wrap">{JSON.stringify(value, null, 2)}</span>;
    return String(value);
  };

  if (!selectedTable) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-neutral-400 h-full">
        <div className="text-lg font-medium text-neutral-600">No Table Selected</div>
        <p className="text-sm mt-1">Select a table or collection from the sidebar to view its contents.</p>
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
    <div className="flex-1 p-8 space-y-6 overflow-y-auto min-h-0">
      <div className="flex items-center justify-between pb-4 border-b border-surface-border">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900">{selectedTable}</h2>
          <p className="text-sm text-neutral-500 mt-1">Showing up to 100 rows</p>
        </div>
        <div className="text-sm font-medium text-neutral-600 bg-neutral-100 px-3 py-1 rounded-full">
          {tableData.rows.length} rows
        </div>
      </div>

      <div className="card overflow-hidden">
        {isMongo ? (
          <div className="p-4 space-y-4">
            {tableData.rows.length === 0 ? (
              <div className="text-center text-neutral-500 text-sm py-8">
                No documents found in this collection.
              </div>
            ) : (
              tableData.rows.map((row, index) => (
                <div key={index} className="bg-white border border-surface-border rounded-lg p-4 overflow-x-auto shadow-sm">
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
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead className="bg-neutral-50 border-b border-surface-border">
                <tr>
                  {tableData.schema.map((column: { name: string; type: string; nullable: boolean }) => (
                    <th key={column.name} className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                      {column.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border bg-surface">
                {tableData.rows.map((row, index) => (
                  <tr key={index} className="hover:bg-neutral-50 transition-colors">
                    {tableData.schema.map((column: { name: string; type: string; nullable: boolean }) => (
                      <td key={column.name} className="px-4 py-3 text-sm text-neutral-800">
                        {renderCellData(row[column.name])}
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