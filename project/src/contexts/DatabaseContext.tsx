/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState } from 'react';
import { api } from '../services/api';

interface DatabaseConnection {
  db_id: string;
  display_name: string;
  type: string;
  database_name: string;
  host: string;
  port: number;
  connection_status: string;
}

interface TableData {
  schema: Array<{ name: string; type: string; nullable: boolean }>;
  rows: Array<Record<string, unknown>>;
}

interface DatabaseContextType {
  databases: DatabaseConnection[];
  fetchDatabases: () => Promise<void>;
  selectedDatabaseId: string | null;
  setSelectedDatabaseId: (id: string | null) => void;
  tables: string[];
  setTables: (tables: string[]) => void;
  selectedTable: string | null;
  setSelectedTable: (table: string | null) => void;
  tableData: TableData | null;
  setTableData: (data: TableData | null) => void;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

export const useDatabase = () => useContext(DatabaseContext);

export const DatabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [databases, setDatabases] = useState<DatabaseConnection[]>([]);
  const [selectedDatabaseId, setSelectedDatabaseId] = useState<string | null>(null);
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<TableData | null>(null);

  const fetchDatabases = async () => {
    try {
      const res = await api.get('/databases');
      if (res.databases) {
        setDatabases(res.databases);
      }
    } catch (e) {
      console.error("Failed to fetch databases", e);
    }
  };

  const value = {
    databases,
    fetchDatabases,
    selectedDatabaseId,
    setSelectedDatabaseId,
    tables,
    setTables,
    selectedTable,
    setSelectedTable,
    tableData,
    setTableData
  };

  return (
    <DatabaseContext.Provider value={value}>
      {children}
    </DatabaseContext.Provider>
  );
};