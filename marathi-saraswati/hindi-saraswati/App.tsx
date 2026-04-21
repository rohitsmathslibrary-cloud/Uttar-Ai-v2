
import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { Blackboard } from './components/Blackboard';
import { InputBar } from './components/InputBar';
import { Sidebar } from './components/Sidebar';
import { LiveOverlay } from './components/LiveOverlay';
import { Message, UserMode, HistoryItem } from './types';
import { SaraswatiService } from './services/geminiServiceWeb';
import { ErrorBoundary } from './components/ErrorBoundary';
import 'katex/dist/katex.min.css';

const App: React.FC<{onSwitchMode?: () => void}> = ({ onSwitchMode }) => {
  const [mode, setMode] = useState<UserMode>('text');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showKeySelector, setShowKeySelector] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]); 
  
  // Session Management
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => Date.now().toString());

  // MCQ State
  const [activeMcqMessageId, setActiveMcqMessageId] = useState<string | null>(null);

  // Audio Playback State
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);
  const playingMessageIdRef = useRef<string | null>(null);
  const pauseOffsetRef = useRef<number>(0);
  const AUDIO_PLAYBACK_RATE = 0.95;

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
      stopAudio();
      const savedChat = localStorage.getItem(`saraswati_chat_${sessionId}`);
      if (savedChat) {
          try {
              const loadedMessages = JSON.parse(savedChat);
              setMessages(loadedMessages);
              setCurrentSessionId(sessionId);
              setActiveMcqMessageId(null);
              
              // Mobile UX: Close sidebar on selection
              setIsSidebarOpen(false);
          } catch (e) {
              console.error("Failed to load chat", e);
          }
      }
  };

  const handleNewTopic = () => {
      stopAudio();
      setMessages([]);
      setActiveMcqMessageId(null);
      setCurrentSessionId(Date.now().toString());
  };

  const stopAudio = () => {
    if (audioSourceRef.current) {
        try { audioSourceRef.current.stop(); } catch(e) {}
        audioSourceRef.current = null;
    }
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    
    playingMessageIdRef.current = null;
    setPlayingMessageId(null);
    setPlaybackProgress(0);
    setIsPaused(false);
    pauseOffsetRef.current = 0;
  };

  const getAudioContext = () => {
      if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      return audioContextRef.current;
  }

  // Toggle Play/Pause
  const togglePlayback = async () => {
      const ctx = getAudioContext();
      
      if (ctx.state === 'running') {
          await ctx.suspend();
          setIsPaused(true);
      } else if (ctx.state === 'suspended') {
          await ctx.resume();
          setIsPaused(false);
      }
  };

  // Plays an ALREADY DECODED AudioBuffer
  const playDecodedAudio = async (decodedBuffer: AudioBuffer, messageId: string) => {
      stopAudio(); 
      const ctx = getAudioContext();
      
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      
      try {
          // Calculate effective duration based on the slowed down rate
          const effectiveDuration = decodedBuffer.duration / AUDIO_PLAYBACK_RATE;
          
          const source = ctx.createBufferSource();
          source.buffer = decodedBuffer;
          source.playbackRate.value = AUDIO_PLAYBACK_RATE; // Apply slowdown
          source.connect(ctx.destination);
          source.start(0);
          
          audioSourceRef.current = source;
          startTimeRef.current = ctx.currentTime;
          
          playingMessageIdRef.current = messageId;
          setPlayingMessageId(messageId);
          setIsPaused(false);

          // Update message with audio duration (effective)
          setMessages(prev => prev.map(msg => 
              msg.id === messageId ? { ...msg, audioDuration: effectiveDuration } : msg
          ));

          const animate = () => {
              if (!audioSourceRef.current || playingMessageIdRef.current !== messageId) return;

              if (ctx.state === 'suspended') {
                  animationFrameRef.current = requestAnimationFrame(animate);
                  return;
              }

              const elapsed = ctx.currentTime - startTimeRef.current;
              const progress = Math.min(elapsed / effectiveDuration, 1);
              setPlaybackProgress(progress);
              
              if (progress < 1) {
                  animationFrameRef.current = requestAnimationFrame(animate);
              } else {
                  stopAudio();
              }
          };
          animate();

          source.onended = () => {
              // Only stop if we naturally finished, not if paused
              if (playingMessageIdRef.current === messageId && ctx.state === 'running' && Math.abs(ctx.currentTime - startTimeRef.current - effectiveDuration) < 0.5) {
                  stopAudio();
              }
          };
      } catch (e) {
          console.error("Error playing audio", e);
      }
  };

  const handleSendMessage = async (text: string, image?: string) => {
    if (!text.trim() && !image) return;

    // Handle Interruption: If audio is currently playing, we consider this an interruption.
    if (playingMessageIdRef.current) {
        const interruptedId = playingMessageIdRef.current;
        const ctx = getAudioContext();
        setMessages(prev => prev.map(msg => {
            if (msg.id === interruptedId) {
                let progress = 0;
                if (msg.audioDuration && ctx && startTimeRef.current) {
                    const elapsed = ctx.currentTime - startTimeRef.current;
                    progress = Math.min(Math.max(elapsed / msg.audioDuration, 0), 1);
                }
                return { ...msg, interrupted: true, audioPlayedPercentage: progress };
            }
            return msg;
        }));
    }

    stopAudio(); 
    setActiveMcqMessageId(null); 

    // Resume context early to ensure it's active after async generation
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
        try { await ctx.resume(); } catch(e) {}
    }

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

      let decodedAudio: AudioBuffer | null = null;
      try {
        console.log("Attempting to generate TTS for message...");
        const audioBuffer = await SaraswatiService.textToSpeech(response.rawText);
        if (audioBuffer) {
            console.log("TTS generation successful, decoding audio data...");
            const ctx = getAudioContext();
            try {
                decodedAudio = await ctx.decodeAudioData(audioBuffer.slice(0));
                console.log("Audio decoding successful, duration:", decodedAudio.duration);
            } catch (decodeError) {
                console.error("Failed to decode audio data:", decodeError);
            }
        } else {
            console.warn("TTS generation returned null buffer");
        }
      } catch (e) {
        console.warn("Audio generation failed", e);
      }
      
      setIsLoading(false);
      
      if (decodedAudio) {
          setPlayingMessageId(newAiMsg.id);
          setPlaybackProgress(0);
          playingMessageIdRef.current = newAiMsg.id;
      }

      setMessages(prev => {
          const updatedMessages = [...prev, newAiMsg];
          if (newAiMsg.mcq) {
              setActiveMcqMessageId(newAiMsg.id);
          }
          return updatedMessages;
      });

      if (decodedAudio) {
          playDecodedAudio(decodedAudio, newAiMsg.id);
      }

    } catch (error) {
      console.error("Error:", error);
      setIsLoading(false);
      setActiveMcqMessageId(null); 
      
      const errorMsgId = Date.now().toString();
      const errorText = "I apologize, there was a technical glitch. Please try again.";
      setMessages(prev => [...prev, {
        id: errorMsgId,
        role: 'model',
        text: errorText,
        timestamp: Date.now()
      }]);

      try {
          const ab = await SaraswatiService.textToSpeech(errorText);
          if (ab) {
              const ctx = getAudioContext();
              const db = await ctx.decodeAudioData(ab);
              playDecodedAudio(db, errorMsgId);
          }
      } catch(e) {}
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
      stopAudio(); 
      setActiveMcqMessageId(null); 

      // Resume context early
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') {
          try { await ctx.resume(); } catch(e) {}
      }

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

          let decodedAudio: AudioBuffer | null = null;
          try {
            const audioBuffer = await SaraswatiService.textToSpeech(response.rawText);
            if (audioBuffer) {
                const ctx = getAudioContext();
                decodedAudio = await ctx.decodeAudioData(audioBuffer.slice(0));
            }
          } catch (e) {
            console.warn("Audio generation failed for post-MCQ response", e);
          }
          
          setIsLoading(false);
          
          if (decodedAudio) {
              setPlayingMessageId(newAiMsg.id);
              setPlaybackProgress(0);
              playingMessageIdRef.current = newAiMsg.id;
          }

          setMessages(prev => {
              const updatedMessages = [...prev, newAiMsg];
              if (newAiMsg.mcq) {
                  setActiveMcqMessageId(newAiMsg.id);
              }
              return updatedMessages;
          });

          if (decodedAudio) {
              playDecodedAudio(decodedAudio, newAiMsg.id);
          }

      } catch (error) {
          console.error("Error post-MCQ response:", error);
          setIsLoading(false);
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
        mode={mode} 
        onToggleLive={() => setMode(mode === 'text' ? 'live' : 'text')} onSwitchMode={onSwitchMode} onSwitchMode={onSwitchMode} 
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        onNewTopic={handleNewTopic} 
      />
      
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
                <Blackboard 
                    messages={messages} 
                    isLoading={isLoading} 
                    playingMessageId={playingMessageId}
                    playbackProgress={playbackProgress}
                    isPaused={isPaused}
                    activeMcqMessageId={activeMcqMessageId} 
                    onSelectMcqOption={handleSelectMcqOption} 
                />
            </ErrorBoundary>
            
            <InputBar 
                onSend={handleSendMessage} 
                disabled={mode === 'live'} 
                onTogglePlayback={togglePlayback}
                isPlaying={!!playingMessageId}
                isPaused={isPaused}
            />
          </div>

      </main>

      {/* Live Mode Overlay */}
      {mode === 'live' && (
        <LiveOverlay onClose={() => setMode('text')} />
      )}
    </div>
  );
};

export default App;
