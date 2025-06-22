import React, { useEffect } from 'react';
import { Database, Table, Plus } from 'lucide-react';
import { useDatabase } from '../../contexts/DatabaseContext';

const Sidebar: React.FC = () => {
  const databaseContext = useDatabase();

  if (!databaseContext) {
    // Optionally, render a loading or error state here
    return <div className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col justify-center items-center text-gray-400">Database context not available.</div>;
  }

  const { 
    isConnected, 
    tables, 
    setTables,
    selectedTable, 
    setSelectedTable,
    credentials,
    selectedDatabase,
    setSelectedDatabase
  } = databaseContext;

  // State for storing list of databases
  const [dbs, setDbs] = React.useState<string[]>([]);

  // Fetch list of databases
  useEffect(() => {
    const fetchDatabases = async () => {
      if (isConnected) {
        try {
          const response = await fetch('http://localhost:5000/databases', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
          });
          const data = await response.json();
          console
          if (data && data.databases) {
            setDbs(data.databases.map((db: any) => db.database_name));
            if (!selectedDatabase && data.databases.length > 0) {
              setSelectedDatabase(data.databases[0].database_name);
            }
          } else {
            setDbs([]);
          }
        } catch (error) {
          setDbs([]);
        }
      }
    };
    fetchDatabases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  // Fetch tables based on selected database
  useEffect(() => {
    const fetchTables = async () => {
      if (isConnected && credentials && selectedDatabase) {
        try {
          const response = await fetch('http://localhost:5000/tables', {
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
          if (data && data.tables) {
            setTables(data.tables.map((name: string) => ({
              name,
              type: 'table'
            })));
          } else {
            setTables([]);
          }
        } catch (error) {
          setTables([]);
        }
      }
    };
    fetchTables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, credentials, selectedDatabase]);

  return (
    <div className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center space-x-2 text-white">
          <Database className="h-5 w-5" />
          <span className="font-medium">Databases</span>
        </div>
      </div>

      {/* List of Databases */}
      <div className="border-t border-b border-gray-700 p-2 bg-gray-900">
        {dbs.map((db) => (
          <button
            key={db}
            onClick={() => setSelectedDatabase(db)}
            className={`w-full text-left px-3 py-1.5 rounded mb-1 transition-colors text-sm ${
              selectedDatabase === db
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-700 hover:text-white'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Database className="h-4 w-4 opacity-70" />
              <span>{db}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Tables under selected database */}
      <div className="flex-1 overflow-y-auto">
        {!isConnected ? (
          <div className="p-4 text-center text-gray-400">
            <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Connect to a database to view tables</p>
          </div>
        ) : tables.length === 0 ? (
          <div className="p-4 text-center text-gray-400">
            <Table className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No tables found</p>
          </div>
        ) : (
          <div className="p-2">
            {tables.map((table) => (
              <button
                key={table.name}
                onClick={() => setSelectedTable(table.name)}
                className={`w-full text-left px-3 py-2 rounded-lg mb-1 transition-colors ${
                  selectedTable === table.name
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Table className="h-4 w-4" />
                  <span className="text-sm truncate">{table.name}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {isConnected && (
        <div className="p-4 border-t border-gray-700">
          <button className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
            <Plus className="h-4 w-4" />
            <span className="text-sm">Add Data</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default Sidebar;