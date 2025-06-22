import React, { useEffect, useState } from 'react';
import { Table, Info } from 'lucide-react';
import { useDatabase } from '../contexts/DatabaseContext';
import LoadingSpinner from './ui/LoadingSpinner';

const TableViewer: React.FC = () => {
  const databaseContext = useDatabase();
  const selectedTable = databaseContext?.selectedTable;
  const selectedDatabase = databaseContext?.selectedDatabase;
  const tableData = databaseContext?.tableData;
  const setTableData = databaseContext?.setTableData;
  const credentials = databaseContext?.credentials;
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (selectedTable && credentials) {
      loadTableData();
    } else {
      if (setTableData) setTableData(null);
    }
    // Now reload when credentials (database) changes or selectedTable changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTable, credentials]);

  const loadTableData = async () => {
    if (!selectedTable || !credentials) return;

    setIsLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/table/${selectedTable}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          host: credentials.host,
          database: selectedDatabase,
          user: credentials.username,
          password: credentials.password,
        }),
      });
      const data = await response.json();
      if (data && data.schema && data.rows) {
        if (setTableData) setTableData(data);
      } else {
        if (setTableData) setTableData(null);
      }
    } catch (error) {
      if (setTableData) setTableData(null);
    }
    setIsLoading(false);
  };

  if (!selectedTable) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <div className="text-center">
          <Table className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Select a table to view its data</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!tableData) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <p>Failed to load table data</p>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Table className="h-5 w-5 text-blue-400" />
          <h2 className="text-xl font-semibold text-white">{selectedTable}</h2>
        </div>
        <div className="text-sm text-gray-400">
          {tableData.rows.length} rows
        </div>
      </div>

      {/* Schema Section */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center space-x-2 mb-3">
          <Info className="h-4 w-4 text-blue-400" />
          <h3 className="font-medium text-white">Schema</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {tableData.schema.map((column) => (
            <div key={column.name} className="flex items-center justify-between p-2 bg-gray-700 rounded">
              <span className="text-white text-sm font-medium">{column.name}</span>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-blue-400 bg-blue-900 px-2 py-1 rounded">
                  {column.type}
                </span>
                {column.nullable && (
                  <span className="text-xs text-gray-400 bg-gray-600 px-2 py-1 rounded">
                    NULL
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Data Section */}
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-gray-700">
          <h3 className="font-medium text-white">Data (First 10 rows)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                {tableData.schema.map((column) => (
                  <th key={column.name} className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    {column.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {tableData.rows.map((row, index) => (
                <tr key={index} className="hover:bg-gray-700 transition-colors">
                  {tableData.schema.map((column) => (
                    <td key={column.name} className="px-4 py-3 text-sm text-gray-300">
                      {row[column.name] !== null && row[column.name] !== undefined 
                        ? String(row[column.name])
                        : <span className="text-gray-500 italic">null</span>
                      }
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TableViewer;