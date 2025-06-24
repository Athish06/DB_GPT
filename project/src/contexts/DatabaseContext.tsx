import React, { createContext, useContext, useState } from 'react';

export interface DatabaseCredentials {
  type: 'postgresql' | 'mysql' | 'mongodb';
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

export interface TableInfo {
  name: string;
  type: 'table' | 'collection';
  columns?: Array<{ name: string; type: string; nullable: boolean }>;
}

export interface TableData {
  schema: Array<{
    enumValues(enumValues: any): unknown; name: string; type: string; nullable: boolean 
}>;
  rows: Array<Record<string, any>>;
}

interface DatabaseContextType {
  credentials: DatabaseCredentials | null;
  setCredentials: (credentials: DatabaseCredentials) => void;
  isConnected: boolean;
  setIsConnected: (connected: boolean) => void;
  tables: TableInfo[];
  setTables: (tables: TableInfo[]) => void;
  selectedTable: string | null;
  setSelectedTable: (table: string | null) => void;
  tableData: TableData | null;
  setTableData: (data: TableData | null) => void;
  selectedDatabase: string;
  setSelectedDatabase: (db: string) => void;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

export const useDatabase = () => useContext(DatabaseContext);

export const DatabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [credentials, setCredentials] = useState<DatabaseCredentials | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [selectedDatabase, setSelectedDatabase] = useState<string>("");

  const value = {
    credentials,
    setCredentials,
    isConnected,
    setIsConnected,
    tables,
    setTables,
    selectedTable,
    setSelectedTable,
    tableData,
    setTableData,
    selectedDatabase,
    setSelectedDatabase
  };

  return (
    <DatabaseContext.Provider value={value}>
      {children}
    </DatabaseContext.Provider>
  );
};