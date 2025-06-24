import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, Sparkles } from 'lucide-react';
import { useDatabase } from '../contexts/DatabaseContext';
import LoadingSpinner from './ui/LoadingSpinner';

interface QueryResult {
  query: string;
  explanation: string;
  timestamp: Date;
}

const AIChat: React.FC = () => {
  const dbContext = useDatabase();
  const selectedTable = dbContext?.selectedTable;
  const selectedDatabase = dbContext?.selectedDatabase;
  const credentials = dbContext?.credentials;
  const tables = dbContext?.tables;
  const [question, setQuestion] = useState('');
  const [results, setResults] = useState<QueryResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // --- DESIGN UPGRADE: Chat bubble style, user/assistant roles, timestamps, SQL, etc. ---
  interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    sqlQuery?: string;
    rawResults?: any;
    error?: string;
  }
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Add an initial welcome message when the component mounts or table changes
  useEffect(() => {
    if (selectedTable && messages.length === 0) {
      setMessages([
        {
          role: 'assistant',
          content: `Hello! I'm your AI database assistant. I can help you query the '${selectedTable}' table in natural language.`,
          timestamp: new Date(),
        },
      ]);
    } else if (!selectedTable && messages.length > 0 && messages[0].content.includes("Hello! I'm your AI database assistant.")) {
      setMessages([]);
    }
    // eslint-disable-next-line
  }, [selectedTable]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !selectedTable || !selectedDatabase || !credentials) return;

    const currentUserMessage: ChatMessage = {
      role: 'user',
      content: question,
      timestamp: new Date(),
    };

    setMessages((prevMessages) => [...prevMessages, currentUserMessage]);
    setQuestion('');
    setIsLoading(true);

    let assistantResponseContent = "I'm sorry, I couldn't process that request.";
    let generatedSqlQuery = "";
    let rawQueryResults: any = null;
    let errorMessage: string | undefined = undefined;

    try {
      const response = await fetch('http://localhost:5000/analyze_table', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          db_config: {
            host: credentials.host,
            database: selectedDatabase,
            user: credentials.username,
            password: credentials.password,
            port: credentials.port,
          },
          table_name: selectedTable,
          prompt: currentUserMessage.content,
        }),
      });
      const data = await response.json();
      console.log("AI response:", data);

      if (response.ok) {
        if (data.summary || data.model_output?.summary) {
          assistantResponseContent = data.summary || data.model_output?.summary;
          if (data.sql_query || data.model_output?.query) {
            generatedSqlQuery = data.sql_query || data.model_output?.query;
          }
          if (data.results) {
            rawQueryResults = data.results;
          } else if (data.action_status) {
            rawQueryResults = data.action_status;
          }
        } else if (data.error) {
          errorMessage = data.error;
          assistantResponseContent = `An error occurred: ${data.error}`;
        } else {
          errorMessage = "Unexpected response from backend.";
          assistantResponseContent = "Received an unexpected response from the AI backend.";
        }
      } else {
        errorMessage = data.error || `Backend responded with status ${response.status}`;
        assistantResponseContent = `Failed to process: ${errorMessage}`;
      }
    } catch (error: any) {
      console.error("Error communicating with AI backend:", error);
      errorMessage = error.message || "Network error.";
      assistantResponseContent = `Could not connect to the AI backend. Please check if the server is running (Error: ${errorMessage}).`;
    } finally {
      setIsLoading(false);

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: assistantResponseContent,
        timestamp: new Date(),
        sqlQuery: generatedSqlQuery,
        rawResults: rawQueryResults,
        error: errorMessage
      };

      setMessages((prevMessages) => [...prevMessages, assistantMessage]);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <MessageSquare className="h-5 w-5 text-blue-400" />
          <h3 className="font-medium text-white">AI Assistant</h3>
        </div>
        <p className="text-sm text-gray-400 mt-1">
          Ask questions about your data in natural language. Table: {selectedTable || 'None Selected'}
        </p>
      </div>

      {/* Chat Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col-reverse">
        {messages.length === 0 && !selectedTable ? (
          <div className="text-center text-gray-400 py-8">
            <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Please select a database and table to start chatting!</p>
            <p className="text-xs mt-1">
              Connect to your database via the "Database" tab.
            </p>
          </div>
        ) : messages.length === 0 && selectedTable ? (
          <div className="text-center text-gray-400 py-8">
            <LoadingSpinner size="md" />
            <p className="text-sm mt-2">Loading AI assistant...</p>
          </div>
        ) : (
          [...messages].reverse().map((message, index) => (
            <div
              key={index}
              className={`flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[70%] rounded-xl p-3 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : 'bg-gray-700 text-gray-200 rounded-bl-none'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                {message.sqlQuery && (
                  <div className="mt-2 bg-gray-900 p-2 rounded-lg text-xs text-blue-300 overflow-x-auto">
                    <p className="font-semibold text-gray-400 mb-1">Generated SQL:</p>
                    <pre className="whitespace-pre-wrap">{message.sqlQuery}</pre>
                  </div>
                )}
                {message.rawResults && message.role === 'assistant' && typeof message.rawResults === 'object' && Object.keys(message.rawResults).length > 0 && (
                  <div className="mt-2 bg-gray-900 p-2 rounded-lg text-xs text-green-300 overflow-x-auto">
                    <p className="font-semibold text-gray-400 mb-1">Raw Result ({message.rawResults.length > 0 ? (message.rawResults.rows_affected !== undefined ? 'Action Status' : 'Data') : 'Empty'}):</p>
                    <pre className="whitespace-pre-wrap">{JSON.stringify(message.rawResults, null, 2)}</pre>
                  </div>
                )}
                <div className="text-right text-xs mt-1 text-gray-400 opacity-70">
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[70%] rounded-xl p-3 bg-gray-700 text-gray-200 rounded-bl-none">
              <LoadingSpinner size="sm" />
              <span className="ml-2 text-sm">Thinking...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-700">
        <div className="flex space-x-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={selectedTable ? `Ask about the '${selectedTable}' table...` : "Select a table to start chatting..."}
            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading || !selectedTable}
          />
          <button
            type="submit"
            disabled={isLoading || !question.trim() || !selectedTable}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <LoadingSpinner size="sm" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AIChat;