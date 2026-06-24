import React, { useState } from 'react';
import { useDatabase } from '../contexts/DatabaseContext';
import TopNav from './layout/TopNav';
import Sidebar from './layout/Sidebar';
import TableViewer from './TableViewer';
import AIChat from './AIChat';
// DataForm removed as it was legacy LLaMA3 route.

const Dashboard: React.FC = () => {
  const dbContext = useDatabase();
  const selectedDatabaseId = dbContext?.selectedDatabaseId;
  const [activeTab, setActiveTab] = useState<'table' | 'ai'>('table');

  return (
    <div className="h-screen bg-neutral-50 flex flex-col overflow-hidden">
      <TopNav />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar />

        <div className="flex-1 flex flex-col bg-surface relative min-w-0">
          {/* Header tabs */}
          {selectedDatabaseId && (
            <div className="flex border-b border-surface-border bg-neutral-50 px-6 pt-4 flex-shrink-0">
              <button
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'table'
                    ? 'border-neutral-900 text-neutral-900'
                    : 'border-transparent text-neutral-500 hover:text-neutral-700'
                }`}
                onClick={() => setActiveTab('table')}
              >
                Data Explorer
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ml-4 ${
                  activeTab === 'ai'
                    ? 'border-neutral-900 text-neutral-900'
                    : 'border-transparent text-neutral-500 hover:text-neutral-700'
                }`}
                onClick={() => setActiveTab('ai')}
              >
                AI Agent
              </button>
            </div>
          )}

          {/* Main Content Area */}
          <div className="flex-1 overflow-hidden flex flex-col relative min-w-0">
            {!selectedDatabaseId ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-400">
                <div className="text-xl font-medium text-neutral-600 mb-2">Welcome to DB_GPT</div>
                <p className="text-sm">Please select a database from the sidebar to begin.</p>
              </div>
            ) : (
              <>
                {activeTab === 'table' && <TableViewer />}
                {activeTab === 'ai' && <AIChat />}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;