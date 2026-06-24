import React, { useState, useEffect, useRef } from 'react';
import { useDatabase } from '../contexts/DatabaseContext';
import { api } from '../services/api';
import ReactMarkdown from 'react-markdown';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sqlQuery?: string;
  rawResults?: { rows: number } | null;
  error?: string;
  isPaused?: boolean;
}

interface ConversationHistory {
  _id: string;
  target: string;
  updated_at: string;
  message_count: number;
}

const MessageBubble: React.FC<{ 
  message: ChatMessage; 
  onResume?: () => void; 
  onCancel?: () => void;
  isLastUserMessage?: boolean;
  onEditSubmit?: (newText: string) => void;
}> = ({ message, onResume, onCancel, isLastUserMessage, onEditSubmit }) => {
  const [showQuery, setShowQuery] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);

  if (isEditing) {
    return (
      <div className="flex flex-col items-end">
        <div className="max-w-[85%] w-full bg-neutral-900 text-white rounded-2xl rounded-br-sm px-5 py-4">
          <textarea 
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="w-full bg-neutral-800 text-white border border-neutral-700 rounded-lg p-3 text-[15px] focus:outline-none focus:border-neutral-500 min-h-[100px] resize-y"
          />
          <div className="flex justify-end space-x-3 mt-3">
            <button 
              onClick={() => setIsEditing(false)}
              className="text-sm text-neutral-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={() => {
                setIsEditing(false);
                if (onEditSubmit && editText.trim() !== message.content && editText.trim() !== '') {
                  onEditSubmit(editText);
                }
              }}
              className="bg-white text-neutral-900 px-4 py-1.5 rounded-md text-sm font-medium hover:bg-neutral-100 transition-colors"
            >
              Save & Submit
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
      <div className="relative group max-w-[85%] w-full flex flex-col items-end">
        {isLastUserMessage && (
          <button
            onClick={() => setIsEditing(true)}
            className="absolute -left-10 top-2 p-1.5 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-md transition-colors opacity-0 group-hover:opacity-100"
            title="Edit Prompt"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
        )}
        <div
          className={`w-full rounded-2xl px-5 py-3 ${
            message.role === 'user'
              ? 'bg-neutral-900 text-white rounded-br-sm'
              : 'bg-neutral-100 text-neutral-900 rounded-bl-sm border border-neutral-200'
          }`}
        >
        <div className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
          <ReactMarkdown
            components={{
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              strong: ({ node, ...props }) => <strong className="font-bold" {...props} />,
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              em: ({ node, ...props }) => <em className="italic" {...props} />,
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              code: ({ node, inline, ...props }: React.HTMLAttributes<HTMLElement> & { node?: unknown, inline?: boolean }) => 
                inline ? <code className="bg-black/5 rounded px-1 py-0.5 text-sm font-mono" {...props} /> 
                       : <code className="block bg-black/5 rounded p-2 text-sm font-mono my-2 overflow-x-auto" {...props} />
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
        
        {(message.sqlQuery || message.rawResults || message.isPaused) && (
          <div className="mt-4 flex flex-col space-y-3">
            {message.isPaused && (
              <div className="flex items-center space-x-3 mt-2">
                <button 
                  onClick={onResume}
                  className="bg-neutral-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-neutral-800 transition-colors shadow-sm"
                >
                  Continue Analysis
                </button>
                <button 
                  onClick={onCancel}
                  className="bg-white text-neutral-900 border border-neutral-300 px-4 py-2 rounded-md text-sm font-medium hover:bg-neutral-50 transition-colors shadow-sm"
                >
                  Cancel Analysis
                </button>
              </div>
            )}
            <div className="flex items-center space-x-4 text-xs font-medium text-neutral-500">
              {message.sqlQuery && (
                <button 
                  onClick={() => setShowQuery(!showQuery)}
                  className="hover:text-neutral-700 uppercase tracking-wider transition-colors font-semibold"
                >
                  EXECUTED QUERY
                </button>
              )}
              {message.rawResults && message.role === 'assistant' && (
                <span>Processed {message.rawResults.rows} records.</span>
              )}
            </div>
            {showQuery && message.sqlQuery && (
              <div className="bg-white border border-neutral-200 p-3 rounded-lg text-xs font-mono text-neutral-700 overflow-x-auto shadow-sm">
                <div className="font-semibold text-neutral-400 mb-2 uppercase tracking-wider text-[10px]">Executed Query</div>
                {message.sqlQuery}
              </div>
            )}
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

const AIChat: React.FC = () => {
  const dbContext = useDatabase();
  const selectedTable = dbContext?.selectedTable;
  const selectedDatabaseId = dbContext?.selectedDatabaseId;
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // History states
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyList, setHistoryList] = useState<ConversationHistory[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    if (selectedTable || selectedDatabaseId) {
      startNewChat();
    } else {
      setMessages([]);
      setCurrentConversationId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTable, selectedDatabaseId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const startNewChat = () => {
    setCurrentConversationId(null);
    if (selectedTable) {
      setMessages([
        {
          role: 'assistant',
          content: `Hello. I am connected to '${selectedTable}'. How can I help you analyze this data?`,
          timestamp: new Date(),
        },
      ]);
    } else if (selectedDatabaseId) {
      setMessages([
        {
          role: 'assistant',
          content: `Hello. I am connected to the entire database. I can analyze and join data across all tables. How can I help you?`,
          timestamp: new Date(),
        },
      ]);
    }
  };

  const loadHistoryList = async () => {
    if (!selectedDatabaseId) return;
    const target = selectedTable || "__all__";
    setIsLoadingHistory(true);
    try {
      const response = await api.get(`/api/conversations?db_id=${selectedDatabaseId}&target=${target}`);
      setHistoryList(response);
    } catch (err) {
      console.error("Failed to load history", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleHistoryOpen = () => {
    setIsHistoryOpen(true);
    loadHistoryList();
  };

  const loadConversation = async (id: string) => {
    setIsHistoryOpen(false);
    setCurrentConversationId(id);
    setIsLoading(true);
    setMessages([]);
    try {
      const response = await api.get(`/api/conversations/${id}`);
      const loadedMessages: ChatMessage[] = response.messages.map((m: { role: 'user'|'assistant'; content: string; timestamp: string; metadata?: { generated_query?: string; result_row_count?: number; error?: string; } }) => ({
        role: m.role,
        content: m.content,
        timestamp: new Date(m.timestamp),
        sqlQuery: m.metadata?.generated_query,
        rawResults: m.metadata?.result_row_count !== undefined ? { rows: m.metadata.result_row_count } : null,
        error: m.metadata?.error
      }));
      setMessages(loadedMessages);
    } catch (err) {
      console.error("Failed to load conversation", err);
      startNewChat();
    } finally {
      setIsLoading(false);
    }
  };

  const deleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await api.delete(`/api/conversations/${id}`);
      setHistoryList(prev => prev.filter(c => c._id !== id));
      if (currentConversationId === id) {
        startNewChat();
      }
    } catch (err) {
      console.error("Failed to delete conversation", err);
    }
  };

  const pollJobStatus = async (jobId: string) => {
    while (true) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const statusResponse = await api.get(`/api/chat/status/${jobId}`);
      
      if (statusResponse.status === "completed") {
        if (statusResponse.conversation_id && !currentConversationId) {
          setCurrentConversationId(statusResponse.conversation_id);
        }
        return { status: "completed", result: statusResponse.result };
      } else if (statusResponse.status === "paused_rate_limit") {
        if (statusResponse.conversation_id && !currentConversationId) {
          setCurrentConversationId(statusResponse.conversation_id);
        }
        return { status: "paused_rate_limit", result: null };
      } else if (statusResponse.status === "failed") {
        throw new Error(statusResponse.error || "Background task failed.");
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !selectedDatabaseId) return;

    const currentUserMessage: ChatMessage = {
      role: 'user',
      content: question,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, currentUserMessage]);
    setQuestion('');
    setIsLoading(true);

    try {
      const payload: { db_id: string; target: string; message: string; conversation_id?: string } = {
        db_id: selectedDatabaseId,
        target: selectedTable || "__all__",
        message: currentUserMessage.content
      };
      if (currentConversationId) {
        payload.conversation_id = currentConversationId;
      }

      const response = await api.post('/api/chat', payload);
      
      if (response.status === "accepted" && response.job_id) {
        const { status, result } = await pollJobStatus(response.job_id);

        if (status === "paused_rate_limit") {
          setMessages((prev) => [...prev, {
            role: 'assistant',
            content: "⚠️ **Groq API Rate Limit Reached**\n\nThe analysis has been paused mid-execution to prevent data loss. Please update your API key in Settings, then click Continue to resume exactly where we left off.",
            timestamp: new Date(),
            isPaused: true
          }]);
        } else if (result) {
          const assistantMessage: ChatMessage = {
            role: 'assistant',
            content: result.reply || "No reply generated.",
            timestamp: new Date(),
            sqlQuery: result.generated_query,
            rawResults: result.result_row_count !== undefined ? { rows: result.result_row_count } : null,
            error: result.error
          };
          setMessages((prev) => [...prev, assistantMessage]);
        }
      } else {
        throw new Error(response.error || "Failed to start AI task");
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Failed to communicate with AI.';
      let displayMsg = errMsg;
      
      if (errMsg.includes('Groq API key')) {
        displayMsg = 'Groq API Key is missing. Please configure it in Settings first.';
      }

      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: `Error: ${displayMsg}`,
        timestamp: new Date(),
        error: errMsg
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditSubmit = async (newText: string) => {
    if (!newText.trim() || !selectedDatabaseId) return;

    let lastUserIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUserIndex = i;
        break;
      }
    }
    if (lastUserIndex === -1) return;

    const updatedMessages = messages.slice(0, lastUserIndex);
    const newUserMessage: ChatMessage = {
      role: 'user',
      content: newText,
      timestamp: new Date(),
    };

    setMessages([...updatedMessages, newUserMessage]);
    setIsLoading(true);

    try {
      const payload: { db_id: string; target: string; message: string; conversation_id?: string; overwrite_last?: boolean } = {
        db_id: selectedDatabaseId,
        target: selectedTable || "__all__",
        message: newUserMessage.content,
        overwrite_last: true
      };
      if (currentConversationId) {
        payload.conversation_id = currentConversationId;
      }

      const response = await api.post('/api/chat', payload);
      
      if (response.status === "accepted" && response.job_id) {
        const { status, result } = await pollJobStatus(response.job_id);

        if (status === "paused_rate_limit") {
          setMessages((prev) => [...prev, {
            role: 'assistant',
            content: "⚠️ **Groq API Rate Limit Reached**\n\nThe analysis has been paused mid-execution to prevent data loss. Please update your API key in Settings, then click Continue to resume exactly where we left off.",
            timestamp: new Date(),
            isPaused: true
          }]);
        } else if (result) {
          const assistantMessage: ChatMessage = {
            role: 'assistant',
            content: result.reply || "No reply generated.",
            timestamp: new Date(),
            sqlQuery: result.generated_query,
            rawResults: result.result_row_count !== undefined ? { rows: result.result_row_count } : null,
            error: result.error
          };
          setMessages((prev) => [...prev, assistantMessage]);
        }
      } else {
        throw new Error(response.error || "Failed to start AI task");
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Failed to communicate with AI.';
      let displayMsg = errMsg;
      
      if (errMsg.includes('Groq API key')) {
        displayMsg = 'Groq API Key is missing. Please configure it in Settings first.';
      }

      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: `Error: ${displayMsg}`,
        timestamp: new Date(),
        error: errMsg
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResume = async () => {
    if (!currentConversationId) return;
    setIsLoading(true);
    setMessages(prev => prev.filter(m => !m.isPaused));
    
    try {
      const response = await api.post(`/api/chat/resume/${currentConversationId}`, {});
      if (response.status === "accepted" && response.job_id) {
        const { status, result } = await pollJobStatus(response.job_id);
        
        if (status === "paused_rate_limit") {
          setMessages((prev) => [...prev, {
            role: 'assistant',
            content: "⚠️ **Groq API Rate Limit Reached**\n\nThe analysis has been paused mid-execution to prevent data loss. Please update your API key in Settings, then click Continue to resume exactly where we left off.",
            timestamp: new Date(),
            isPaused: true
          }]);
        } else if (result) {
          const assistantMessage: ChatMessage = {
            role: 'assistant',
            content: result.reply || "No reply generated.",
            timestamp: new Date(),
            sqlQuery: result.generated_query,
            rawResults: result.result_row_count !== undefined ? { rows: result.result_row_count } : null,
            error: result.error
          };
          setMessages((prev) => [...prev, assistantMessage]);
        }
      } else {
        throw new Error(response.error || "Failed to resume task");
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Failed to communicate with AI.';
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${errMsg}`, timestamp: new Date(), error: errMsg }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!currentConversationId) return;
    try {
      await api.post(`/api/chat/cancel/${currentConversationId}`, {});
      setMessages(prev => prev.filter(m => !m.isPaused));
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Analysis aborted by user.",
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error("Failed to cancel", error);
    }
  };

  const isPausedState = messages.length > 0 && messages[messages.length - 1].isPaused;

  return (
    <div className="bg-surface border-l border-surface-border h-full flex flex-col relative overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-surface-border flex justify-between items-center">
        <div>
          <h3 className="font-semibold text-neutral-900 text-lg">AI Assistant</h3>
          <p className="text-sm text-neutral-500 mt-1">
            {selectedTable ? `Querying target: ${selectedTable}` : selectedDatabaseId ? `Querying entire database` : 'Select a target to begin'}
          </p>
        </div>
        
        {/* Actions */}
        <div className="flex items-center space-x-2">
          {(selectedTable || selectedDatabaseId) && (
            <button
              onClick={startNewChat}
              className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
              title="New Chat"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            </button>
          )}
          <button
            onClick={handleHistoryOpen}
            className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
            title="Chat History"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
              <path d="M12 7v5l4 2"/>
            </svg>
          </button>
        </div>
      </div>

      {/* History Slide-out Panel */}
      <div 
        className={`absolute inset-y-0 right-0 w-80 bg-surface border-l border-surface-border shadow-xl transform transition-transform duration-300 z-10 flex flex-col ${
          isHistoryOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-surface-border flex justify-between items-center bg-neutral-50">
          <h3 className="font-semibold text-neutral-900">Chat History</h3>
          <button 
            onClick={() => setIsHistoryOpen(false)}
            className="text-neutral-500 hover:text-neutral-900 p-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoadingHistory ? (
            <div className="text-center text-neutral-500 text-sm mt-4">Loading history...</div>
          ) : historyList.length === 0 ? (
            <div className="text-center text-neutral-400 text-sm mt-4">No past conversations</div>
          ) : (
            historyList.map(conv => (
              <div 
                key={conv._id}
                onClick={() => loadConversation(conv._id)}
                className={`p-3 rounded-lg border cursor-pointer transition-colors group ${
                  currentConversationId === conv._id 
                    ? 'border-neutral-900 bg-neutral-50' 
                    : 'border-neutral-200 hover:border-neutral-300 bg-white'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 truncate pr-2">
                    <p className="text-sm font-medium text-neutral-900 truncate">{conv.target}</p>
                    <p className="text-xs text-neutral-500 mt-1">{new Date(conv.updated_at).toLocaleDateString()}</p>
                  </div>
                  <button 
                    onClick={(e) => deleteConversation(e, conv._id)}
                    className="text-neutral-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                    title="Delete Chat"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Overlay when history is open */}
      {isHistoryOpen && (
        <div 
          className="absolute inset-0 bg-black/10 z-0"
          onClick={() => setIsHistoryOpen(false)}
        />
      )}

      {/* Main Chat Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6 flex flex-col">
        {messages.length === 0 && !selectedDatabaseId ? (
          <div className="flex-1 flex items-center justify-center text-neutral-400">
            <p className="text-sm">Select a database or table from the sidebar.</p>
          </div>
        ) : (() => {
          let lastUserIdx = -1;
          for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'user') {
              lastUserIdx = i;
              break;
            }
          }
          return messages.map((message, index) => (
            <MessageBubble 
              key={index} 
              message={message} 
              onResume={handleResume}
              onCancel={handleCancel}
              isLastUserMessage={index === lastUserIdx && !isLoading && !isPausedState}
              onEditSubmit={handleEditSubmit}
            />
          ));
        })()}
        
        {isLoading && (
          <div className="flex flex-col items-start">
             <div className="max-w-[85%] rounded-2xl px-5 py-4 bg-neutral-100 text-neutral-500 rounded-bl-sm border border-neutral-200 flex items-center space-x-2">
                <div className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-4 bg-surface border-t border-surface-border z-0 relative">
        <div className="relative">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={!selectedDatabaseId || isLoading || isPausedState}
            placeholder={
              isPausedState 
                ? "Analysis paused. Update API key and click Continue above."
                : (!selectedDatabaseId 
                  ? "Select a database from the sidebar to begin" 
                  : "Ask a question about your data..."
                )
            }
            className="w-full pl-4 pr-24 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300 transition-shadow disabled:opacity-75 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={isLoading || !question.trim() || !selectedDatabaseId || isPausedState}
            className="absolute right-2 top-2 bottom-2 px-4 bg-neutral-900 text-white text-sm font-medium rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
};

export default AIChat;