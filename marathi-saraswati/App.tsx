

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Menu, PlusCircle } from 'lucide-react';
import ChatInterface from './components/ChatInterface';
import InputArea from './components/InputArea';
import Sidebar from './components/Sidebar';
import { AppState, Message, Role, MessageType } from './types';

import { trackStudentPrompt, trackSessionStart, isMCQResponse } from './services/analyticsService';
import { generateMathResponse, getTTSAudioBuffer, initAudioContext, getAudioContext, getEstimatedWaitTime } from './services/geminiServiceWeb';

// Helper to generate IDs
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

const App: React.FC = () => {
  // State
  const [state, setState] = useState<AppState>({
    messages: [],
    isRecording: false,
    isThinking: false,
    isConnectedToLive: false,
    inputMode: 'text',
    notebook: [],
    isAudioPlaying: false,
    isAudioPaused: false,
    currentlyPlayingMessageId: null, 
    estimatedWaitTime: undefined
  });
  
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [liveManager, setLiveManager] = useState<LiveManager | null>(null);
  const [isTTSActive, setIsTTSActive] = useState(true);
  
  // Audio Refs
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);
  // Changed NodeJS.Timeout to number as setTimeout in browser returns a number
  const audioTimeoutRef = useRef<number | null>(null); 
  
  // Deduplication Ref (Critical for preventing 20 -> 2020 issue)
  const lastProcessedMessageRef = useRef<{ content: string; timestamp: number } | null>(null);

  // Ref to hold the most current messages array (updated synchronously)
  const latestMessagesRef = useRef<Message[]>();

  // Update the ref whenever state.messages changes
  useEffect(() => {
    latestMessagesRef.current = state.messages;
  }, [state.messages]);

  // --- Persistence Logic ---
  
  useEffect(() => {
    try {
      const savedNotebook = localStorage.getItem('uttar_ai_notebook');
      if (savedNotebook) {
        setState(prev => ({ ...prev, notebook: JSON.parse(savedNotebook) }));
      }
      handleNewNote(); 
    } catch (e) {
      console.error("Failed to load notebook", e);
    }
  }, []);

  useEffect(() => {
    if (!currentSessionId || state.messages.length === 0) return;

    const sessionKey = `uttar_ai_session_${currentSessionId}`;
    localStorage.setItem(sessionKey, JSON.stringify(state.messages));

    const title = state.messages[0].content.slice(0, 30) + (state.messages[0].content.length > 30 ? '...' : '');
    const date = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

    setState(prev => {
      const existingEntryIndex = prev.notebook.findIndex(n => n.id === currentSessionId);
      let updatedNotebook;
      if (existingEntryIndex >= 0) {
        updatedNotebook = [...prev.notebook];
        updatedNotebook[existingEntryIndex] = { ...updatedNotebook[existingEntryIndex], title, summary: title };
      } else {
        // This path should ideally not be taken if currentSessionId exists and has messages,
        // but ensures the notebook entry is created if somehow missing.
        updatedNotebook = [{ id: currentSessionId, title, date, summary: title }, ...prev.notebook];
      }
      localStorage.setItem('uttar_ai_notebook', JSON.stringify(updatedNotebook));
      return { ...prev, notebook: updatedNotebook };
    });
  }, [state.messages, currentSessionId]);

  const stopAudio = () => {
    if (audioSourceRef.current) {
      try { audioSourceRef.current.stop(); } catch (e) { console.warn("Error stopping audio source:", e); }
      audioSourceRef.current = null;
    }
    if (audioTimeoutRef.current) { // Clear safety timeout if audio is stopped manually
        clearTimeout(audioTimeoutRef.current);
        audioTimeoutRef.current = null;
    }
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'running') {
        try { ctx.suspend(); } catch (e) { console.warn("Error suspending audio context:", e); }
    }
    setState(prev => ({ ...prev, isAudioPlaying: false, isAudioPaused: false, currentlyPlayingMessageId: null }));
  };

  const togglePauseAudio = () => {
    const ctx = getAudioContext();
    if (!ctx) {
        console.warn("AudioContext not initialized.");
        return;
    }

    if (state.isAudioPaused) {
      try { ctx.resume(); } catch (e) { console.error("Error resuming audio context:", e); return; }
      setState(prev => ({ ...prev, isAudioPaused: false }));
    } else {
      try { ctx.suspend(); } catch (e) { console.error("Error suspending audio context:", e); return; }
      setState(prev => ({ ...prev, isAudioPaused: true }));
    }
  };

  const handleNewNote = () => {
    stopAudio();
    activeRequestIdRef.current = null;
    lastProcessedMessageRef.current = null; // Reset deduplication on new note

    // Synchronously save the *current* session's messages before changing currentSessionId
    if (currentSessionId && latestMessagesRef.current && latestMessagesRef.current.length > 0) {
      const sessionKey = `uttar_ai_session_${currentSessionId}`;
      localStorage.setItem(sessionKey, JSON.stringify(latestMessagesRef.current)); // Use ref for latest messages

      // Update notebook entry title/summary for the session being closed
      const title = latestMessagesRef.current[0].content.slice(0, 30) + (latestMessagesRef.current[0].content.length > 30 ? '...' : '');
      const date = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

      setState(prev => {
        const existingEntryIndex = prev.notebook.findIndex(n => n.id === currentSessionId);
        let updatedNotebook;
        if (existingEntryIndex >= 0) {
          updatedNotebook = [...prev.notebook];
          updatedNotebook[existingEntryIndex] = { ...updatedNotebook[existingEntryIndex], title, date, summary: title };
        } else {
          // This path should ideally not be taken if currentSessionId exists and has messages,
          // but ensures the notebook entry is created if somehow missing.
          updatedNotebook = [{ id: currentSessionId, title, date, summary: title }, ...prev.notebook];
        }
        localStorage.setItem('uttar_ai_notebook', JSON.stringify(updatedNotebook));
        return { ...prev, notebook: updatedNotebook };
      });
    }

    const newId = generateId();
    setCurrentSessionId(newId);
    trackSessionStart(newId);
    setState(prev => ({
      ...prev,
      messages: [], // Clear messages for the new session
      isThinking: false,
      isRecording: false,
      isAudioPlaying: false,
      isAudioPaused: false,
      currentlyPlayingMessageId: null,
      estimatedWaitTime: undefined
    }));
    setSidebarOpen(false);
  };

  const loadSession = (sessionId: string) => {
    if (sessionId === currentSessionId) {
      setSidebarOpen(false); // Already on this session, just close sidebar
      return;
    }

    stopAudio();
    activeRequestIdRef.current = null;
    lastProcessedMessageRef.current = null; // Reset deduplication on load

    // Synchronously save the *current* session's messages before loading a new one
    if (currentSessionId && latestMessagesRef.current && latestMessagesRef.current.length > 0) {
      const sessionKey = `uttar_ai_session_${currentSessionId}`;
      localStorage.setItem(sessionKey, JSON.stringify(latestMessagesRef.current)); // Use ref for latest messages

      // Update notebook entry title/summary for the session being closed
      const title = latestMessagesRef.current[0].content.slice(0, 30) + (latestMessagesRef.current[0].content.length > 30 ? '...' : '');
      const date = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      setState(prev => {
        const existingEntryIndex = prev.notebook.findIndex(n => n.id === currentSessionId);
        let updatedNotebook;
        if (existingEntryIndex >= 0) {
          updatedNotebook = [...prev.notebook];
          updatedNotebook[existingEntryIndex] = { ...updatedNotebook[existingEntryIndex], title, date, summary: title };
        } else {
          // This path should ideally not be taken if currentSessionId exists and has messages
          updatedNotebook = [{ id: currentSessionId, title, date, summary: title }, ...prev.notebook];
        }
        localStorage.setItem('uttar_ai_notebook', JSON.stringify(updatedNotebook));
        return { ...prev, notebook: updatedNotebook };
      });
    }

    try {
      const sessionData = localStorage.getItem(`uttar_ai_session_${sessionId}`);
      if (sessionData) {
        setCurrentSessionId(sessionId);
        setState(prev => ({
          ...prev,
          messages: JSON.parse(sessionData),
          isThinking: false,
          isAudioPlaying: false,
          currentlyPlayingMessageId: null
        }));
        setSidebarOpen(false);
      } else {
        console.warn(`Session data not found for ID: ${sessionId}, starting new empty session.`);
        // If data is not found, it implies a new session will be effectively loaded,
        // so ensure the currentSessionId is set, and messages are cleared.
        setCurrentSessionId(sessionId); // Set to the requested ID, even if empty
        setState(prev => ({
          ...prev,
          messages: [],
          isThinking: false,
          isAudioPlaying: false,
          currentlyPlayingMessageId: null
        }));
        setSidebarOpen(false);
      }
    } catch (e) {
      console.error("Failed to load session", e);
      // Fallback: If loading fails, just clear to an empty new session
      handleNewNote(); // This will create a completely fresh session.
    }
  };

  const fileToDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleSendMessage = async (text: string, image?: File) => {
    // --- ROBUST DEDUPLICATION CHECK ---
    const now = Date.now();
    if (lastProcessedMessageRef.current && 
        lastProcessedMessageRef.current.content === text && 
        (now - lastProcessedMessageRef.current.timestamp < 2000)) {
        console.warn("Duplicate message blocked by Ref check:", text);
        return;
    }
    lastProcessedMessageRef.current = { content: text, timestamp: now };
    // ----------------------------------

    stopAudio();
    const currentRequestId = generateId();
    activeRequestIdRef.current = currentRequestId;
    const ctx = initAudioContext(); // Ensure audio context is ready

    let imageDataUrl: string | undefined = undefined;
    if (image) {
      try { imageDataUrl = await fileToDataURL(image); } catch (e) { }
    }

    // Track prompt
    const lastAiMsg = state.messages.filter(m => m.role === Role.MODEL).slice(-1)[0];
    const lastMCQOpts = lastAiMsg?.mcqOptions || [];
    const isFromMCQ = isMCQResponse(text, lastMCQOpts);
    if (currentSessionId && !isFromMCQ) trackStudentPrompt(text, currentSessionId, false);

    const newMessage: Message = {
      id: currentRequestId,
      role: Role.USER,
      type: imageDataUrl ? MessageType.IMAGE : MessageType.TEXT,
      content: text,
      timestamp: Date.now(),
      imageData: imageDataUrl
    };

    const estimatedTime = getEstimatedWaitTime('math', text);

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, newMessage],
      isThinking: true,
      estimatedWaitTime: estimatedTime
    }));

    try {
      // FIX: Use 'state.messages' (history BEFORE the new message) 
      // AND handle image-only messages where 'content' might be empty string.
      const history = state.messages.map(m => {
        // Fallback text if content is empty (e.g. image message) to prevent API errors
        const safeContent = m.content && m.content.trim().length > 0 
            ? m.content 
            : (m.imageData ? "[User sent an image]" : "...");
        
        return {
          role: m.role,
          parts: [{ text: safeContent }] 
        };
      });

      let imagePart;
      if (image && imageDataUrl) {
        const base64Data = imageDataUrl.split(',')[1];
        imagePart = { inlineData: { mimeType: image.type, data: base64Data } };
      }

      // Call Gemini
      const { text: aiResponseText, groundingChunks } = await generateMathResponse(history, text, imagePart);
      
      if (activeRequestIdRef.current !== currentRequestId) return;

      let finalContent = aiResponseText;
      let mcqOptions: string[] | undefined;

      // 1. ROBUST MCQ TAG PARSING
      // Use Regex to find the START to handle spaces like "<< MCQ:" or "<<MCQ :"
      // Use lastIndexOf for the END to handle nested brackets/content safely
      const startMatch = finalContent.match(/<<\s*MCQ\s*:/i);
      const startIdx = startMatch ? startMatch.index : -1;
      const mcqEndTag = '>>';

      if (startIdx !== -1 && startMatch) {
          // Find the last occurrence of '>>' to capture the entire block
          const endIdx = finalContent.lastIndexOf(mcqEndTag);
          
          if (endIdx > startIdx) {
              const rawJson = finalContent.substring(startIdx + startMatch[0].length, endIdx).trim();
              const fullTagString = finalContent.substring(startIdx, endIdx + mcqEndTag.length);
              
              // IMMEDIATELY remove the tag from content so it is NOT visible in UI or read by TTS
              finalContent = finalContent.replace(fullTagString, '').trim();

              try {
                  // Attempt Parse
                  mcqOptions = JSON.parse(rawJson);
                  
                   // Malformed LaTeX check
                  if (mcqOptions && Array.isArray(mcqOptions) && mcqOptions.some((o: string) => /[\u000C\t]/.test(o))) {
                      throw new Error("Malformated LaTeX escapes detected");
                  }
              } catch (e) {
                  console.warn("MCQ JSON parse failed, attempting sanitization...", e);
                  try {
                      // Sanitization Fallback
                      const sanitized = rawJson
                        .replace(/\\"/g, '___QUOTE___') 
                        .replace(/\\/g, '\\\\') 
                        .replace(/___QUOTE___/g, '\\"');
                      mcqOptions = JSON.parse(sanitized);
                  } catch (e2) {
                      console.error("MCQ Sanitization failed completely", e2);
                  }
              }
          }
      }

      // TTS Generation
      let audioBuffer: AudioBuffer | null = null;
      let duration = 0;
      const responseMessageId = generateId();
      
      // FIX: Check if there is actual content to speak (ignoring whitespace)
      if (isTTSActive && !state.isConnectedToLive && finalContent.replace(/\s/g, '').length > 0) {
         try {
             // Pass the CLEANED content (without MCQ tag) to TTS
             audioBuffer = await getTTSAudioBuffer(finalContent);
             if (activeRequestIdRef.current !== currentRequestId) return; 
             if (audioBuffer) duration = audioBuffer.duration;
         } catch (e) {
             console.error("TTS generation failed, proceeding with text only", e);
         }
      }

      // Adjust duration for playback rate (0.94)
      // This ensures the TypewriterText and TimelineProgress match the ACTUAL time it takes to play
      const playbackRate = 0.94;
      const adjustedDuration = duration > 0 ? duration / playbackRate : 0;

      const responseMessage: Message = {
        id: responseMessageId,
        role: Role.MODEL,
        type: MessageType.TEXT,
        content: finalContent,
        groundingChunks: groundingChunks,
        mcqOptions: mcqOptions,
        timestamp: Date.now(),
        audioDuration: adjustedDuration 
      };

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, responseMessage],
        isThinking: false,
        estimatedWaitTime: undefined
      }));

      if (audioBuffer && ctx) {
        if (ctx.state === 'suspended') {
            try { await ctx.resume(); } catch (e) { console.error("Error resuming AudioContext for TTS playback:", e); }
        }
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        // Adjusted speed to 0.94 (slightly decreased)
        source.playbackRate.value = playbackRate; 
        source.connect(ctx.destination);
        
        source.onended = () => {
          setState(prev => ({ ...prev, isAudioPlaying: false, currentlyPlayingMessageId: null }));
          if (audioTimeoutRef.current) { 
              clearTimeout(audioTimeoutRef.current);
              audioTimeoutRef.current = null;
          }
        };
        audioSourceRef.current = source;
        
        if (activeRequestIdRef.current === currentRequestId) {
           source.start(0); 
           setState(prev => ({ ...prev, isAudioPlaying: true, isAudioPaused: false, currentlyPlayingMessageId: responseMessageId }));

           if (audioTimeoutRef.current) clearTimeout(audioTimeoutRef.current);
           
           // Use adjustedDuration for the timeout
           audioTimeoutRef.current = setTimeout(() => {
               if (audioSourceRef.current === source) {
                   console.warn("Audio playback timeout: Forcing audio stop and state reset.");
                   stopAudio();
               }
           }, adjustedDuration * 1000 + 40000);
        }
      }

    } catch (error: any) {
       console.error("Generation Error:", error);
       lastProcessedMessageRef.current = null;
       if (activeRequestIdRef.current === currentRequestId) {
         const isNetwork = error?.message?.includes('fetch') || error?.message?.includes('network') || error?.message?.includes('Failed to fetch') || error?.code === 'ERR_NETWORK';
         const errorMsg = isNetwork
           ? "⚠️ Connection lost. Please check your internet and try again."
           : "⚠️ Saraswati couldn't respond. Please try again in a moment.";
         const errMessage = {
           id: generateId(),
           role: 'model' as any,
           type: 'text' as any,
           content: errorMsg,
           timestamp: Date.now(),
         };
         setState(prev => ({
           ...prev,
           isThinking: false,
           estimatedWaitTime: undefined,
           messages: [...prev.messages, errMessage],
         }));
         activeRequestIdRef.current = null;
       }
    }
  };

  const toggleRecording = () => {
    initAudioContext();
    if (state.isRecording) setState(prev => ({ ...prev, isRecording: false }));
    else { stopAudio(); setState(prev => ({ ...prev, isRecording: true })); }
  };

  return (
    <div className="flex h-screen bg-[#1a1a1a] relative text-stone-300 font-sans overflow-hidden">
      <Sidebar 
        isOpen={isSidebarOpen} 
        notebook={state.notebook} 
        currentSessionId={currentSessionId}
        onSelectEntry={loadSession} 
        onNewSession={handleNewNote}
      />
      <div className={`flex-1 flex flex-col h-full transition-all duration-300 ${isSidebarOpen ? 'ml-64' : 'ml-0'}`}>
        <header className="h-16 border-b border-stone-800 flex items-center justify-between px-4 bg-[#1a1a1a]/90 backdrop-blur-md z-20">
          <div className="flex items-center space-x-4">
            <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-stone-800 rounded-lg">
              <Menu className="w-6 h-6 text-stone-400" />
            </button>
            <div className="flex items-center">
              <div className="w-9 h-9 rounded-full bg-yellow-500 flex items-center justify-center text-stone-900 font-bold text-xl font-['Arial'] mr-2 relative shadow-md shadow-yellow-500/10">
                <span className="-mt-0.5">स</span>
              </div>
              <div className="flex items-center h-10">
                <span className="text-2xl font-bold text-stone-200 font-['Arial'] mt-1">Saraswati</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
             <button 
               onClick={handleNewNote}
               className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-full text-white transition-colors border border-indigo-700 shadow-lg"
             >
               <PlusCircle className="w-4 h-4" />
               <span className="text-sm font-medium">New Note</span>
             </button>
          </div>
        </header>

        <ChatInterface 
          messages={state.messages} 
          isThinking={state.isThinking}
          isAudioPaused={state.isAudioPaused}
          currentlyPlayingMessageId={state.currentlyPlayingMessageId} 
          estimatedWaitTime={state.estimatedWaitTime}
          onSendMessage={(text) => handleSendMessage(text)}
        />

        <div className="p-4 pb-6">
          <InputArea 
            onSendMessage={handleSendMessage} 
            isRecording={state.isRecording}
            toggleRecording={toggleRecording}
            isAudioPlaying={state.isAudioPlaying}
            isAudioPaused={state.isAudioPaused}
            onTogglePause={togglePauseAudio}
          />
        </div>
      </div>
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-10 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  );
};

export default App;