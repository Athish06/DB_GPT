import React from 'react';
import { useDatabase } from '../contexts/DatabaseContext';
import TopNav from './layout/TopNav';
import Sidebar from './layout/Sidebar';
import TableViewer from './TableViewer';
import AIChat from './AIChat';
import DataForm from './DataForm';

const Dashboard: React.FC = () => {
  const dbContext = useDatabase();
  const isConnected = dbContext?.isConnected ?? false;

  return (
    <div className="h-screen bg-gray-900 flex flex-col">
      <TopNav />
      
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        
        <div className="flex-1 flex flex-col lg:flex-row">
          {/* Main Content */}
          <div className="flex-1 flex flex-col min-h-0">
            <TableViewer />
          </div>
          
          {/* Right Panel */}
          {isConnected && (
            <div className="w-full lg:w-96 border-l border-gray-700 flex flex-col">
              <div className="flex-1 min-h-0">
                <AIChat />
              </div>
              <div className="h-96 border-t border-gray-700">
                <DataForm />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;