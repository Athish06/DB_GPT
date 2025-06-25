import React, { useState } from 'react'; // Import useState
import { useDatabase } from '../contexts/DatabaseContext';
import TopNav from './layout/TopNav';
import Sidebar from './layout/Sidebar';
import TableViewer from './TableViewer';
import AIChat from './AIChat';
import DataForm from './DataForm';
import { ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react'; // Import Chevron icons and MessageSquare

const Dashboard: React.FC = () => {
  const dbContext = useDatabase();
  const isConnected = dbContext?.isConnected ?? false;
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true); // State for right panel toggle
  const [activeTab, setActiveTab] = useState<'ai' | 'data'>('ai'); // Add this state at the top of your component

  const toggleRightPanel = () => {
    setIsRightPanelOpen(!isRightPanelOpen);
  };

  return (
    <div className="h-screen bg-gray-900 flex flex-col">
      <TopNav />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar />

        <div className="flex-1 flex flex-col lg:flex-row relative"> {/* Added relative to Dashboard's main content area */}
          {/* Main Content (TableViewer) */}
          <div className="flex-1 flex flex-col min-h-0 max-w-full overflow-auto">
            <div className="w-full max-w-4xl overflow-auto mx-auto">
              <TableViewer />
            </div>
          </div>

          {/* Right Panel */}
          {isConnected && (
            <div
              className={`border-l border-gray-700 flex flex-col bg-gray-800
                transition-all duration-300 ease-in-out overflow-hidden
                ${isRightPanelOpen ? 'w-full lg:w-96 translate-x-0' : 'w-16 translate-x-[calc(100%-4rem)]'}`}
              // When closed: w-16 (4rem), and translate 100% of its current width minus 4rem to the right
            >
              {/* Right Panel Header with Toggle */}
              <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                {isRightPanelOpen && ( // Only show text content when panel is open
                  <div className="flex items-center space-x-2">
                    <MessageSquare className="h-5 w-5 text-blue-400" />
                    <h3 className="font-medium text-white whitespace-nowrap">AI & Data Entry</h3>
                  </div>
                )}
                <button
                  onClick={toggleRightPanel}
                  className={`text-gray-400 hover:text-white transition-colors focus:outline-none ${isRightPanelOpen ? '' : 'mx-auto'}`}
                  // mx-auto centers the button when panel is closed
                  aria-label={isRightPanelOpen ? 'Collapse right panel' : 'Expand right panel'}
                >
                  {isRightPanelOpen ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
                </button>
              </div>

              {/* Content of the right panel, visible only when panel is open */}
              {isRightPanelOpen && (
                <>
                  {/* Tabs */}
                  <div className="flex border-b border-gray-700 bg-gray-800">
                    <button
                      className={`flex-1 py-2 text-sm font-medium transition-colors ${
                        activeTab === 'ai'
                          ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-900'
                          : 'text-gray-400 hover:text-white'
                      }`}
                      onClick={() => setActiveTab('ai')}
                    >
                      <MessageSquare className="inline h-4 w-4 mr-1" />
                      AI Chat
                    </button>
                    <button
                      className={`flex-1 py-2 text-sm font-medium transition-colors ${
                        activeTab === 'data'
                          ? 'text-green-400 border-b-2 border-green-400 bg-gray-900'
                          : 'text-gray-400 hover:text-white'
                      }`}
                      onClick={() => setActiveTab('data')}
                    >
                      <ChevronRight className="inline h-4 w-4 mr-1" />
                      Data Entry
                    </button>
                  </div>
                  {/* Tab Content */}
                  <div className="flex-1 min-h-0 rounded-b-lg h-full">
                    {activeTab === 'ai' && (
                      <div className="h-full flex flex-col">
                        <AIChat />
                      </div>
                    )}
                    {activeTab === 'data' && (
                      <div className="h-96 border-t border-gray-700 rounded-t-lg flex flex-col">
                        <DataForm />
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;