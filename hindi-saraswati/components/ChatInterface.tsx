

import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Message, Role, MessageType } from '../types';
import TypewriterText from './TypewriterText';
import ThinkingIndicator from './ThinkingIndicator';
import { X } from 'lucide-react';

interface ChatInterfaceProps {
  messages: Message[];
  isThinking: boolean;
  isAudioPaused: boolean;
  currentlyPlayingMessageId: string | null; 
  estimatedWaitTime?: string;
  onSendMessage: (text: string) => void;
}

// Internal component for the Audio Progress Line
const TimelineProgress: React.FC<{ duration?: number; isPlaying: boolean; isPaused: boolean }> = ({ duration, isPlaying, isPaused }) => {
  const [heightPercent, setHeightPercent] = useState(0);
  const reqRef = useRef<number>();
  const startTimeRef = useRef<number | null>(null);
  const pausedDurationRef = useRef(0);
  const pauseStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isPlaying) {
      setHeightPercent(0);
      startTimeRef.current = null;
      pausedDurationRef.current = 0;
      pauseStartRef.current = null;
      if (reqRef.current) cancelAnimationFrame(reqRef.current); // Stop animation frame
      return;
    }

    const animate = (time: number) => {
      if (startTimeRef.current === null) startTimeRef.current = time;

      if (isPaused) {
        if (pauseStartRef.current === null) pauseStartRef.current = performance.now();
        reqRef.current = requestAnimationFrame(animate);
        return;
      }

      if (pauseStartRef.current !== null) {
        pausedDurationRef.current += (performance.now() - pauseStartRef.current);
        pauseStartRef.current = null;
      }

      const elapsed = time - startTimeRef.current - pausedDurationRef.current;
      // Removed 0.98 factor for exact 1:1 sync with audio duration
      const totalDur = (duration || 1) * 1000; 
      
      const p = Math.min(elapsed / totalDur, 1);
      setHeightPercent(p * 100);

      if (p < 1) {
        reqRef.current = requestAnimationFrame(animate);
      }
    };

    reqRef.current = requestAnimationFrame(animate);
    return () => {
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
    };
  }, [isPlaying, isPaused, duration]);

  return (
    <div className="absolute left-0 top-0 bottom-0 w-1 bg-stone-700 rounded-full overflow-hidden">
      <div 
        className="w-full bg-yellow-500 rounded-full origin-top" 
        style={{ height: `${heightPercent}%` }} 
      />
    </div>
  );
};

// Helper function to render MCQ content safely with Math support
const renderMCQOption = (text: string) => {
    // Robust detection of LaTeX content that might be missing delimiters
    const hasLatexCommand = /\\[a-zA-Z]+/.test(text); // e.g., \frac, \sqrt, \alpha
    const hasMathSymbols = /[=\^<>]/.test(text); // e.g., x^2, =, <
    const hasDelimiters = /\$|\\\(|\\\[/.test(text); // Already has $, \(, or \[
    
    let content = text;
    
    // If it looks like math but lacks delimiters, wrap it in $
    if ((hasLatexCommand || hasMathSymbols) && !hasDelimiters) {
        content = `$${text}$`;
    }

    return (
        <ReactMarkdown
            remarkPlugins={[remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{
                p: ({node, ...props}) => <span className="block w-full break-words leading-relaxed" {...props} />,
                // Ensure KaTeX spans don't cause layout issues
                span: ({node, ...props}) => {
                    const isMath = props.className?.includes('katex');
                    return (
                      <span 
                        {...props} 
                        className={`${props.className || ''} ${isMath ? 'inline-block align-middle' : ''}`}
                        onClick={(e) => e.stopPropagation()} 
                      />
                    );
                }
            }}
        >
            {content}
        </ReactMarkdown>
    );
};

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  messages, 
  isThinking, 
  isAudioPaused, 
  currentlyPlayingMessageId,
  estimatedWaitTime,
  onSendMessage
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [completedTypingIds, setCompletedTypingIds] = useState<Set<string>>(new Set());

  // Initial scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isThinking]);

  // Enhanced Scroll Logic
  const handleContentUpdate = (msgId?: string) => {
    if (scrollContainerRef.current) {
        const { scrollHeight, scrollTop, clientHeight } = scrollContainerRef.current;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 200;
        
        // Force scroll if this specific message is currently playing (Audio Sync Scroll)
        // OR if the user is already near the bottom (Sticky Scroll)
        if ((msgId && msgId === currentlyPlayingMessageId) || isNearBottom) {
           scrollContainerRef.current.scrollTo({
               top: scrollHeight,
               behavior: 'smooth'
           });
        }
    }
  };

  const handleTypingComplete = (msgId: string) => {
    setCompletedTypingIds(prev => new Set(prev).add(msgId));
  };

  return (
    <div className="flex flex-1 h-full overflow-hidden bg-[#1a1a1a] relative">
      
      {/* Full Width Chat Stream */}
      <div 
        ref={scrollContainerRef}
        className="h-full flex-1 overflow-y-auto p-4 md:p-8 pb-32 scroll-smooth transition-all duration-300 w-full"
      >
        <div className="w-full max-w-4xl mx-auto space-y-16 relative z-10 pl-2 md:pl-24"> 
          
          {/* Welcome Screen */}
          {messages.length === 0 && (
             <div className="flex flex-col items-center justify-center h-[60vh] text-center opacity-50 font-['Arial'] -ml-2 md:-ml-24">
                <div className="w-24 h-24 bg-yellow-600/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
                   <span className="text-6xl font-['Arial'] text-yellow-500 leading-none pb-1.5">स</span>
                </div>
                <h2 className="text-3xl font-['Arial'] text-stone-300 mb-2">Namaste! I am Saraswati.</h2>
                <p className="text-stone-500 max-w-md font-['Arial']">
                  Ask me any math question. I can write formulas and help you learn step-by-step.
                </p>
             </div>
          )}

          {messages.map((msg, index) => {
            const isCurrentlyPlaying = msg.id === currentlyPlayingMessageId;
            const isLatest = index === messages.length - 1;
            const shouldStopAnimation = !isCurrentlyPlaying && !isLatest;
            const showOptions = !isLatest || completedTypingIds.has(msg.id);

            return (
              <div
                key={msg.id}
                className={`flex ${msg.role === Role.USER ? 'justify-end' : 'justify-start w-full'} animate-in slide-in-from-bottom-4 fade-in duration-500`}
              >
                <div
                  className={`${
                    msg.role === Role.USER
                      ? 'max-w-[85%] md:max-w-[60%] bg-stone-800/50 text-stone-300 rounded-2xl rounded-tr-none p-4 border border-stone-700/50 backdrop-blur-sm'
                      : 'w-full text-stone-300 relative group pl-14 md:pl-20' 
                  }`}
                >
                  {/* Model Timeline Logic */}
                  {msg.role === Role.MODEL && (
                    <>
                      {/* Vertical Line with Progress */}
                      <TimelineProgress 
                        duration={msg.audioDuration} 
                        isPlaying={isCurrentlyPlaying} 
                        isPaused={isCurrentlyPlaying && isAudioPaused}
                      />
                      
                      <div className={`absolute left-3 md:left-6 top-1 w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500 z-10 ${
                          isCurrentlyPlaying 
                          ? 'bg-yellow-500/10 border-yellow-500 text-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.3)]' 
                          : 'bg-stone-800 border-stone-700 text-stone-500'
                      }`}>
                          <span className="font-['Arial'] font-bold text-2xl leading-none">स</span>
                      </div>
                    </>
                  )}

                  <div className={msg.role === Role.USER ? "text-xl font-['Patrick_Hand']" : ""}>
                     {msg.role === Role.USER && (
                        <>
                          {msg.imageData && (
                             <div className="mb-2 cursor-pointer" onClick={() => setZoomedImage(msg.imageData!)}>
                               <img src={msg.imageData} alt="User Upload" className="rounded-lg max-h-64 border border-stone-600" />
                             </div>
                          )}
                          {/* Render User Text with Math Support */}
                          <div className="text-left">
                              <ReactMarkdown
                                remarkPlugins={[remarkMath]}
                                rehypePlugins={[rehypeKatex]}
                                components={{
                                    p: ({node, ...props}) => <p className="mb-0 whitespace-pre-wrap break-words" {...props} />,
                                    code: ({node, ...props}) => <code className="bg-stone-900/50 px-1 rounded text-sm font-mono text-yellow-200 break-all" {...props} />
                                }}
                              >
                                {msg.content}
                              </ReactMarkdown>
                          </div>
                        </>
                     )}

                     {msg.role === Role.MODEL && (
                       <>
                          <TypewriterText 
                              content={msg.content} 
                              audioDuration={msg.audioDuration}
                              isPaused={isLatest ? isAudioPaused : false}
                              onUpdate={() => handleContentUpdate(msg.id)}
                              shouldStopAnimation={shouldStopAnimation}
                              onTypingComplete={() => handleTypingComplete(msg.id)}
                              textColor="text-stone-300"
                          />
                          
                          {/* MCQ Options Rendering */}
                          {msg.mcqOptions && showOptions && (
                             <div className="flex flex-col gap-3 mt-6 animate-in fade-in slide-in-from-bottom-2 duration-700 w-full md:w-3/4">
                               {msg.mcqOptions.map((option, i) => (
                                 <button
                                   key={i}
                                   onClick={() => onSendMessage(option)}
                                   className="relative bg-stone-800/80 hover:bg-stone-700 text-stone-300 border border-stone-600 hover:border-yellow-500 px-5 py-4 rounded-xl text-left transition-all duration-200 font-['Patrick_Hand'] text-lg shadow-md active:scale-[0.99] flex items-center group overflow-hidden"
                                 >
                                    {/* Prominent Label */}
                                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-yellow-500 text-stone-900 flex items-center justify-center mr-4 text-sm font-bold shadow-lg group-hover:scale-110 transition-transform">
                                        {String.fromCharCode(65 + i)}
                                    </span>
                                    
                                    <div className="flex-1">
                                        {renderMCQOption(option)}
                                    </div>
                                    
                                    {/* Hover Effect Line */}
                                    <div className="absolute bottom-0 left-0 w-0 h-1 bg-yellow-500 group-hover:w-full transition-all duration-300"></div>
                                 </button>
                               ))}
                             </div>
                          )}

                          {msg.imageData && (
                            <div className="mt-6 group/image relative cursor-pointer" onClick={() => setZoomedImage(msg.imageData!)}>
                                <div className="absolute -top-3 left-2 bg-yellow-600 text-white text-[10px] px-2 py-0.5 rounded-full shadow-sm font-bold z-10 tracking-wide uppercase">
                                  AI Diagram
                                </div>
                                <img 
                                    src={msg.imageData} 
                                    alt="AI Diagram" 
                                    className="rounded-lg max-h-80 border-2 border-stone-700 shadow-xl bg-black/40" 
                                />
                            </div>
                          )}
                       </>
                     )}
                  </div>
                </div>
              </div>
            );
          })}

          {isThinking && (
             <div className="flex justify-start w-full animate-in fade-in">
                <div className="w-full text-stone-300 relative group pl-14 md:pl-20">
                   {/* Thinking Timeline Line */}
                   <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-stone-700 to-transparent rounded-full opacity-50" />
                   
                   {/* Thinking Avatar */}
                   <div className="absolute left-3 md:left-6 top-1 w-8 h-8 rounded-full flex items-center justify-center border-2 border-stone-700 bg-stone-800/50 text-stone-500 animate-pulse">
                      <span className="font-['Arial'] font-bold text-2xl leading-none">स</span>
                   </div>

                   {/* Content */}
                   <ThinkingIndicator estimatedTime={estimatedWaitTime} />
                </div>
             </div>
          )}
          
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Fullscreen Image Zoom Modal */}
      {zoomedImage && (
        <div 
            className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => setZoomedImage(null)}
        >
            <button 
                className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all"
                onClick={() => setZoomedImage(null)}
            >
                <X size={24} />
            </button>
            <img 
                src={zoomedImage} 
                alt="Zoomed" 
                className="max-w-full max-h-full object-contain rounded-md"
                onClick={(e) => e.stopPropagation()} 
            />
        </div>
      )}

    </div>
  );
};

export default ChatInterface;