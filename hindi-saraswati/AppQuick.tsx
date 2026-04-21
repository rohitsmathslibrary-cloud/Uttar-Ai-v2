
import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { BlackboardQuick } from './components/BlackboardQuick';
import { InputBar } from './components/InputBar';
import { Sidebar } from './components/Sidebar';
import { Message, UserMode, HistoryItem } from './types';
import { SaraswatiService } from './services/geminiServiceQuick';
import { ErrorBoundary } from './components/ErrorBoundary';
import 'katex/dist/katex.min.css';

const App: React.FC<{onSwitchMode?: () => void}> = ({ onSwitchMode }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isTypingComplete, setIsTypingComplete] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showKeySelector, setShowKeySelector] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]); 
  
  // Session Management
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => Date.now().toString());

  // MCQ State
  const [activeMcqMessageId, setActiveMcqMessageId] = useState<string | null>(null);

  // Helper for safe localStorage saving
  const safeSaveToLocalStorage = (key: string, data: any) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      if (e instanceof Error && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
        console.warn(`LocalStorage quota exceeded for key: ${key}. Attempting to prune...`);
        
        if (key.startsWith('saraswati_chat_') && Array.isArray(data)) {
          // Prune images first
          const prunedMessages = data.map((msg: any) => {
            if (msg.image) {
              const { image, ...rest } = msg;
              return rest;
            }
            return msg;
          });
          
          try {
            localStorage.setItem(key, JSON.stringify(prunedMessages));
            return;
          } catch (e2) {
            // Still failing? Keep only last 15 messages
            const limitedMessages = prunedMessages.slice(-15);
            try {
              localStorage.setItem(key, JSON.stringify(limitedMessages));
              return;
            } catch (e3) {
              console.error("Failed to save even after pruning and limiting messages", e3);
            }
          }
        }
        
        if (key === 'saraswati_history' && Array.isArray(data)) {
           // Keep only 15 most recent sessions in history
           const limitedHistory = data.slice(0, 15);
           try {
             localStorage.setItem(key, JSON.stringify(limitedHistory));
             return;
           } catch (e4) {
             console.error("Failed to save history even after limiting", e4);
           }
        }
      } else {
        console.error("LocalStorage error", e);
      }
    }
  };

  // Check for API Key on mount & Load History
  useEffect(() => {
    const checkApiKey = async () => {
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) {
          setShowKeySelector(true);
        }
      }
    };
    checkApiKey();

    // Load History from LocalStorage
    const savedHistory = localStorage.getItem('saraswati_history');
    if (savedHistory) {
        try {
            setHistory(JSON.parse(savedHistory));
        } catch (e) {
            console.error("Failed to parse history", e);
        }
    }
  }, []);

  // Save Messages to LocalStorage whenever they change
  useEffect(() => {
    if (currentSessionId && messages.length > 0) {
        safeSaveToLocalStorage(`saraswati_chat_${currentSessionId}`, messages);
    }
  }, [messages, currentSessionId]);

  // Save History list to LocalStorage whenever it changes
  useEffect(() => {
      if (history.length > 0) {
          safeSaveToLocalStorage('saraswati_history', history);
          
          // Cleanup orphaned chat data to free up space
          const historyIds = new Set(history.map(h => h.id));
          const keysToRemove: string[] = [];
          
          for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && key.startsWith('saraswati_chat_')) {
                  const id = key.replace('saraswati_chat_', '');
                  if (!historyIds.has(id)) {
                      keysToRemove.push(key);
                  }
              }
          }
          
          keysToRemove.forEach(key => localStorage.removeItem(key));
      }
  }, [history]);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setShowKeySelector(false);
    }
  };

  const handleLoadSession = (sessionId: string) => {
      const savedChat = localStorage.getItem(`saraswati_chat_${sessionId}`);
      if (savedChat) {
          try {
              const loadedMessages = JSON.parse(savedChat);
              setMessages(loadedMessages);
              setCurrentSessionId(sessionId);
              setActiveMcqMessageId(null);
              setIsPaused(false);
              setIsTypingComplete(true);
              
              // Mobile UX: Close sidebar on selection
              setIsSidebarOpen(false);
          } catch (e) {
              console.error("Failed to load chat", e);
          }
      }
  };

  const handleNewTopic = () => {
      setMessages([]);
      setActiveMcqMessageId(null);
      setIsPaused(false);
      setIsTypingComplete(true);
      setCurrentSessionId(Date.now().toString());
  };

  const handleSendMessage = async (text: string, image?: string) => {
    if (!text.trim() && !image) return;

    setActiveMcqMessageId(null); 
    setIsPaused(false); 

    // Save to History if this is the start of a new conversation
    if (messages.length === 0) {
        const newHistoryItem: HistoryItem = {
            id: currentSessionId,
            title: text.length > 25 ? text.substring(0, 25) + '...' : text,
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        };
        setHistory(prev => [newHistoryItem, ...prev]);
        // History saving is handled by useEffect
    }

    const newUserMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: text,
      image: image,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, newUserMsg]);
    setIsLoading(true);
    setIsTypingComplete(false);

    try {
      const response = await SaraswatiService.sendMessage(text, messages, image);
      
      const newAiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: response.text, 
        rawText: response.rawText, 
        groundingMetadata: response.groundingMetadata,
        mcq: response.mcq,
        timestamp: Date.now()
      };

      setIsLoading(false);
      
      setMessages(prev => {
          const updatedMessages = [...prev, newAiMsg];
          if (newAiMsg.mcq) {
              setActiveMcqMessageId(newAiMsg.id);
          }
          return updatedMessages;
      });

    } catch (error) {
      console.error("Error:", error);
      setIsLoading(false);
      setIsTypingComplete(true);
      setActiveMcqMessageId(null); 
      
      const errorMsgId = Date.now().toString();
      const errorText = "I apologize, there was a technical glitch. Please try again.";
      setMessages(prev => [...prev, {
        id: errorMsgId,
        role: 'model',
        text: errorText,
        timestamp: Date.now()
      }]);
    }
  };

  const handleSelectMcqOption = async (messageId: string, optionLabel: string) => {
      setMessages(prevMessages => {
          return prevMessages.map(msg => {
              if (msg.id === messageId && msg.mcq) {
                  return { ...msg, mcq: { ...msg.mcq, selectedOption: optionLabel } };
              }
              return msg;
          });
      });

      const systemReplyText = `My selection is option ${optionLabel}.`;
      
      setIsLoading(true); 
      setIsPaused(false);
      setIsTypingComplete(false);
      setActiveMcqMessageId(null); 

      try {
          const response = await SaraswatiService.sendMessage(systemReplyText, messages);
          
          const newAiMsg: Message = {
            id: (Date.now() + 1).toString(),
            role: 'model',
            text: response.text, 
            rawText: response.rawText, 
            groundingMetadata: response.groundingMetadata,
            mcq: response.mcq, 
            timestamp: Date.now()
          };

          setIsLoading(false);
          
          setMessages(prev => {
              const updatedMessages = [...prev, newAiMsg];
              if (newAiMsg.mcq) {
                  setActiveMcqMessageId(newAiMsg.id);
              }
              return updatedMessages;
          });

      } catch (error) {
          console.error("Error post-MCQ response:", error);
          setIsLoading(false);
          setIsTypingComplete(true);
          setActiveMcqMessageId(null); 
          
          const errorMsgId = Date.now().toString();
          const errorText = "I apologize, there was a technical glitch. Please try again.";
          setMessages(prev => [...prev, {
            id: errorMsgId,
            role: 'model',
            text: errorText,
            timestamp: Date.now()
          }]);
      }
  };

  if (showKeySelector) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#000000] text-white p-6 text-center">
        <h1 className="text-3xl font-bold mb-4 text-yellow-500">Setup Required</h1>
        <p className="mb-8 text-stone-300 max-w-md">
          To use the advanced teaching models (Gemini 3 Flash) and image generation, you must select a paid API key from a billing-enabled Google Cloud project.
        </p>
        <button 
          onClick={handleSelectKey}
          className="px-8 py-3 bg-stone-800 border border-stone-600 hover:border-yellow-500 hover:text-yellow-500 rounded-full font-bold shadow-lg transition transform hover:scale-105"
        >
          Select API Key
        </button>
        <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="mt-8 text-sm text-stone-500 hover:text-stone-300 underline">
          Read about Billing Requirements
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-black text-stone-300 relative">
      
      <Header 
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        onNewTopic={handleNewTopic} onSwitchMode={onSwitchMode} 
      onSwitchMode={onSwitchMode} />
      
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)}
        history={history} 
        onLoadSession={handleLoadSession}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden relative">
          
          {/* Left / Main Column: Chat */}
          <div className="flex-1 flex flex-col relative w-full lg:w-auto min-w-0">
            <ErrorBoundary>
                <BlackboardQuick 
                    messages={messages} 
                    isLoading={isLoading} 
                    isPaused={isPaused}
                    onTogglePause={() => setIsPaused(!isPaused)}
                    onTypingComplete={() => setIsTypingComplete(true)}
                    activeMcqMessageId={activeMcqMessageId} 
                    onSelectMcqOption={handleSelectMcqOption} 
                />
            </ErrorBoundary>
            
            <InputBar 
                onSend={handleSendMessage} 
                disabled={(isLoading || !!activeMcqMessageId) && !isPaused} 
                isPaused={isPaused}
                onTogglePause={() => setIsPaused(!isPaused)}
                isProcessing={(!isLoading && !isTypingComplete) || !!activeMcqMessageId}
            />
          </div>

      </main>
    </div>
  );
};

export default App;
