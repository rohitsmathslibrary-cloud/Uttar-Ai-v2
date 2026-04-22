import React, { useEffect, useRef, useMemo, memo } from 'react';
import { Message } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { SaraswatiService } from '../services/geminiServiceWeb'; 

interface BlackboardProps {
  messages: Message[];
  isLoading: boolean;
  playingMessageId: string | null;
  playbackProgress: number; // 0 to 1
  isPaused: boolean;
  activeMcqMessageId: string | null;
  onSelectMcqOption: (messageId: string, optionLabel: string) => void;
}

// ----------------------------------------------------------------------
// Constants & Styles
// ----------------------------------------------------------------------

// STRICT FONT CONSISTENCY: All elements must use these classes
const STANDARD_FONT_CLASSES = "font-chalk text-[1.3rem] md:text-[1.45rem] leading-8 md:leading-10 text-stone-300";

// Markdown Components with strict font enforcement
const markdownComponents = {
    p: ({children}: any) => <div className={`mb-4 ${STANDARD_FONT_CLASSES}`} style={{color:'inherit'}}>{children}</div>,
    strong: ({children}: any) => <strong className={`text-yellow-500 font-bold ${STANDARD_FONT_CLASSES}`}>{children}</strong>,
    em: ({children}: any) => <em className={`text-yellow-500 not-italic font-bold ${STANDARD_FONT_CLASSES}`}>{children}</em>, 
    li: ({children}: any) => <li className={`marker:text-yellow-500 mb-2 pl-2 ${STANDARD_FONT_CLASSES}`}>{children}</li>,
    ol: ({children}: any) => <ol className="list-decimal pl-6 mb-4">{children}</ol>,
    ul: ({children}: any) => <ul className="list-disc pl-6 mb-4">{children}</ul>,
    // Headers forced to look like standard text but colored/bolded if needed
    h1: ({children}: any) => <div className={`mb-4 font-bold text-yellow-500 ${STANDARD_FONT_CLASSES}`}>{children}</div>,
    h2: ({children}: any) => <div className={`mb-4 font-bold text-yellow-500 ${STANDARD_FONT_CLASSES}`}>{children}</div>,
    h3: ({children}: any) => <div className={`mb-4 font-bold text-yellow-500 ${STANDARD_FONT_CLASSES}`}>{children}</div>,
    h4: ({children}: any) => <div className={`mb-4 font-bold ${STANDARD_FONT_CLASSES}`}>{children}</div>,
    h5: ({children}: any) => <div className={`mb-4 font-bold ${STANDARD_FONT_CLASSES}`}>{children}</div>,
    h6: ({children}: any) => <div className={`mb-4 font-bold ${STANDARD_FONT_CLASSES}`}>{children}</div>,
    // REQ: Avoid horizontal lines. Render HR as invisible spacer.
    hr: () => <div className="my-8 border-none" />,
};

// ----------------------------------------------------------------------
// Component: Error Boundary for Markdown
// ----------------------------------------------------------------------
class MarkdownErrorBoundary extends React.Component<{content: string, children: React.ReactNode}, {hasError: boolean}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error("Markdown rendering error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return <span className={STANDARD_FONT_CLASSES}>{this.props.content}</span>;
    }
    return this.props.children;
  }
}

// ----------------------------------------------------------------------
// Component: Typewriter Text
// ----------------------------------------------------------------------
// Renders text that reveals itself based on the global progress
const TypewriterText: React.FC<{ 
    content: string; 
    isVisible: boolean;
    isTyping: boolean;
    charsToShow: number;
    isMath?: boolean;
}> = memo(({ content, isVisible, isTyping, charsToShow, isMath }) => {
    
    // If it's math, we fade it in as a block (LaTeX rendering issues with partial strings)
    if (isMath) {
        if (!isVisible) return null;
        return (
            <div className={`animate-in fade-in duration-500 my-4`}>
                 <MarkdownErrorBoundary content={content}>
                     <ReactMarkdown 
                        remarkPlugins={[remarkMath]} 
                        rehypePlugins={[rehypeKatex]}
                        components={markdownComponents}
                        unwrapDisallowed={true}
                    >
                        {content}
                    </ReactMarkdown>
                 </MarkdownErrorBoundary>
            </div>
        );
    }

    // Normal text handling with blinking cursor
    const visibleContent = isTyping ? content.slice(0, charsToShow) : content;
    
    if (!isVisible) return null;

    return (
        <div className="relative">
            <div className="prose prose-invert max-w-none">
                 <MarkdownErrorBoundary content={visibleContent}>
                     <ReactMarkdown 
                        remarkPlugins={[remarkMath]} 
                        rehypePlugins={[rehypeKatex]}
                        components={markdownComponents}
                        unwrapDisallowed={true}
                    >
                        {visibleContent}
                    </ReactMarkdown>
                 </MarkdownErrorBoundary>
            </div>
            {/* Blinking Cursor - only show if typing and not finished */}
            {isTyping && charsToShow < content.length && (
                <span className="inline-block w-2 h-6 bg-yellow-500 ml-1 align-middle animate-pulse shadow-[0_0_8px_rgba(234,179,8,0.8)] rounded-full"></span>
            )}
        </div>
    );
});


// ----------------------------------------------------------------------
// Component: Single Message (User or AI)
// ----------------------------------------------------------------------
const BlackboardMessage = memo(({ 
    msg, 
    playingMessageId, 
    progress, 
    isPaused, 
    activeMcqMessageId,
    onSelectMcqOption
}: { 
    msg: Message; 
    playingMessageId: string | null; 
    progress: number; 
    isPaused: boolean; 
    activeMcqMessageId: string | null;
    onSelectMcqOption: (messageId: string, optionLabel: string) => void;
}) => {
    const isPlaying = playingMessageId === msg.id;
    const isInterrupted = !!msg.interrupted;
    const isFinished = !isPlaying && !isInterrupted && msg.role === 'model'; // Assumed finished if not playing and is model

    // User Message
    if (msg.role === 'user') {
        return (
            <div className="flex justify-end animate-in slide-in-from-bottom-4 fade-in duration-500 mb-12">
                <div className="max-w-[65%] bg-stone-800 text-stone-300 border border-stone-700 backdrop-blur-sm px-6 py-4 rounded-2xl rounded-tr-none shadow-lg chalk-text">
                    {msg.image && (
                        <img src={`data:image/jpeg;base64,${msg.image}`} alt="Input" className="mb-3 rounded-lg border border-stone-600 max-h-40" />
                    )}
                    <div className={STANDARD_FONT_CLASSES}>{msg.text}</div>
                </div>
            </div>
        );
    }

    // AI Message Logic
    // SYNC FIX: Ensure text is strictly 1% ahead of audio.
    let effectiveProgress = 0;
    if (isPlaying) {
        effectiveProgress = Math.min(progress + 0.01, 1);
    } else if (isInterrupted && msg.audioPlayedPercentage !== undefined) {
        effectiveProgress = Math.min(msg.audioPlayedPercentage + 0.01, 1);
    } else {
        effectiveProgress = 1; // Show all
    }

    // 2. Prepare Data Structure (Splitting text, mcq)
    const { renderableParts, totalChars } = useMemo(() => {
        const parts: { type: 'text' | 'mcq'; content?: string; mcq?: Message['mcq']; length: number; isMath?: boolean }[] = [];
        let count = 0;

        const processTextSegment = (txt: string) => {
            if (!txt) return;
            
            // Do NOT split by newlines. Split ONLY by Block Math ($$...$$).
            const segments = txt.split(/(\$\$[\s\S]*?\$\$)/g);
            
            segments.forEach(segment => {
                if (!segment) return;
                
                // CRITICAL FIX FOR LAG: Use RAW SEGMENT LENGTH (segment.length), not cleaned length.
                // This ensures the slicing logic has enough 'budget' to reveal the full raw string.
                if (segment.startsWith('$$') && segment.endsWith('$$')) {
                    parts.push({
                         type: 'text',
                         content: segment,
                         length: segment.length, // Raw length for math block (dwell time)
                         isMath: true
                     });
                     count += segment.length;
                } else {
                    // For text, we definitely need RAW LENGTH to fix the slicing bug.
                    if (segment.length > 0) {
                        parts.push({
                            type: 'text',
                            content: segment,
                            length: segment.length, // Raw length to allow full slicing
                            isMath: false
                        });
                        count += segment.length;
                    }
                }
            });
        };

        // Split Logic (MCQ)
        const displayTxt = SaraswatiService.cleanTextForDisplay(msg.rawText || '');

        if (msg.mcq && msg.mcq.mcqActivationCharIndex !== undefined) {
             const safeIndex = Math.min(msg.mcq.mcqActivationCharIndex, displayTxt.length);
             processTextSegment(displayTxt.substring(0, safeIndex));
             parts.push({ type: 'mcq', mcq: msg.mcq, length: 15 }); // Virtual length cost for MCQ
             count += 15;
             processTextSegment(displayTxt.substring(safeIndex));
        } else {
             processTextSegment(displayTxt);
        }

        return { renderableParts: parts, totalChars: count };
    }, [msg.id, msg.text, msg.rawText, msg.mcq]);


    // 3. Render Loop
    let cursor = 0;
    const safeTotalChars = Math.max(totalChars, 1);
    const currentVisibleChars = Math.floor(safeTotalChars * effectiveProgress);

    // Glowing Avatar Logic
    const avatarGlowClass = isPlaying 
        ? "border-yellow-500 bg-yellow-500/10 shadow-[0_0_15px_rgba(234,179,8,0.3)]" 
        : "border-stone-700 bg-[#0a0a0a]";
    
    const avatarTextClass = isPlaying ? "text-yellow-500" : "text-stone-500";

    if (renderableParts.length === 0 && msg.role === 'model') {
        return null; // Or some fallback
    }

    return (
        <div className="flex gap-4 md:gap-6 relative mb-16 group items-stretch">
            
            {/* LEFT COLUMN: Avatar & Timeline */}
            <div className="flex flex-col items-center shrink-0 w-8 md:w-10 relative">
                
                {/* 1. Static Grey Track (Timeline) */}
                {/* Connects from BOTTOM of this avatar to bottom of the message gap. z-0 keeps it behind. */}
                {/* top-8 (2rem) matches w-8 height. top-10 (2.5rem) matches w-10 height. */}
                <div className="absolute top-8 md:top-10 bottom-[-4rem] left-1/2 -ml-0.5 w-1 bg-stone-800 z-0 group-last:bottom-0 rounded-full"></div>

                {/* 2. Dynamic Yellow Progress Bar */}
                {/* 
                   SYNC FIX: Uses bottom-0 to fill from the avatar DOWN to the end of text.
                   Since 'items-stretch' makes this column match the text column height, bottom-0 works perfectly.
                */}
                {(isPlaying || isFinished) && (
                    <div className="absolute top-8 md:top-10 bottom-0 left-1/2 -ml-0.5 w-1 z-0 overflow-hidden rounded-full">
                         <div className="w-full h-full bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]"></div>
                    </div>
                )}

                {/* 3. Avatar */}
                {/* z-20 ensures it sits ON TOP of any lines. bg-[#0a0a0a] hides the lines passing through (if any). */}
                <div className={`
                    w-8 h-8 md:w-10 md:h-10 rounded-full border-2 flex items-center justify-center leading-none shrink-0 overflow-hidden relative z-20 bg-[#0a0a0a]
                    transition-all duration-300 ${avatarGlowClass}
                `}>
                    <span className={`font-bold text-lg md:text-xl pb-0.5 flex items-center justify-center w-full h-full ${avatarTextClass}`}>स</span>
                </div>
            </div>

            {/* RIGHT COLUMN: Content Stream */}
            <div className="flex-1 pb-4 pt-1">
                
                {renderableParts.map((part, idx) => {
                    const start = cursor;
                    const end = cursor + (part.length || 0);
                    cursor = end;

                    // Visibility Check
                    if (currentVisibleChars < start) return null; // Not yet reached

                    if (part.type === 'text') {
                        // Calculate how many chars of *this specific part* to show
                        const partCharsToShow = Math.min(part.length || 0, currentVisibleChars - start);
                        return (
                            <TypewriterText 
                                key={`${msg.id}-part-${idx}`}
                                content={part.content || ''}
                                isVisible={true}
                                isTyping={isPlaying && partCharsToShow < (part.length || 0)} // Only show cursor if strictly typing this part
                                charsToShow={partCharsToShow}
                                isMath={part.isMath}
                            />
                        );
                    } else if (part.type === 'mcq') {
                        // MCQ Logic
                        const mcqData = part.mcq;
                        const isMcqActive = msg.id === activeMcqMessageId;
                        const isMcqAnswered = !!mcqData?.selectedOption;
                        const canSelect = isMcqActive && !isMcqAnswered && !isPlaying && !isInterrupted;
                        const isRevealed = currentVisibleChars >= end; // Only show full options if past the MCQ block
                        
                        return (
                            <div key={idx} className="mt-6 mb-8 pl-4 border-l-2 border-yellow-500/30 animate-in slide-in-from-left-4 duration-500">
                                <div className={`mb-4 text-yellow-500 ${STANDARD_FONT_CLASSES}`}>
                                    <MarkdownErrorBoundary content={mcqData?.question || ''}>
                                        <ReactMarkdown 
                                            remarkPlugins={[remarkMath]} 
                                            rehypePlugins={[rehypeKatex]}
                                            components={markdownComponents}
                                            unwrapDisallowed={true}
                                        >
                                            {mcqData?.question || ''}
                                        </ReactMarkdown>
                                    </MarkdownErrorBoundary>
                                </div>
                                {isRevealed && mcqData?.options && (
                                    <div className="grid grid-cols-1 gap-3">
                                        {mcqData.options.map((option, optIdx) => {
                                            const isSelected = option.label === mcqData?.selectedOption;
                                            return (
                                                <div
                                                    key={optIdx}
                                                    onClick={() => canSelect && onSelectMcqOption(msg.id, option.label)}
                                                    className={`
                                                        p-4 rounded-xl border-2 text-left transition-all duration-300 group cursor-pointer relative
                                                        ${isSelected 
                                                            ? 'bg-yellow-700/40 border-yellow-500 text-white shadow-lg' 
                                                            : 'bg-stone-800/50 border-stone-700 text-stone-300 hover:bg-stone-800'
                                                        }
                                                        ${!canSelect && !isSelected ? 'opacity-60 pointer-events-none' : 'hover:border-yellow-500/50'}
                                                    `}
                                                    style={{animationDelay: `${optIdx * 100}ms`}} 
                                                    role="button"
                                                    tabIndex={canSelect ? 0 : -1}
                                                >
                                                    <div className="flex items-start">
                                                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-yellow-500 text-stone-900 font-bold mr-3 text-lg shrink-0 mt-1">
                                                            {option.label}
                                                        </span>
                                                        <div className={STANDARD_FONT_CLASSES + " !mb-0"}>
                                                            <MarkdownErrorBoundary content={option.text}>
                                                                <ReactMarkdown 
                                                                    remarkPlugins={[remarkMath]} 
                                                                    rehypePlugins={[rehypeKatex]}
                                                                    components={markdownComponents}
                                                                    unwrapDisallowed={true}
                                                                >
                                                                    {option.text}
                                                                </ReactMarkdown>
                                                            </MarkdownErrorBoundary>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    }
                    return null;
                })}

                {/* Grounding Chips */}
                {msg.groundingMetadata?.groundingChunks && !msg.interrupted && effectiveProgress === 1 && (
                    <div className="mt-4 flex flex-wrap gap-2 animate-in fade-in">
                        {msg.groundingMetadata.groundingChunks.map((chunk, i) => (
                            chunk.web ? (
                                <a key={i} href={chunk.web.uri} target="_blank" rel="noreferrer" className="text-xs bg-stone-800 text-yellow-500 hover:text-white px-3 py-1.5 rounded-full border border-stone-700 transition-colors">
                                    {chunk.web.title}
                                </a>
                            ) : null
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
});


// ----------------------------------------------------------------------
// Main Blackboard Container
// ----------------------------------------------------------------------
export const Blackboard: React.FC<BlackboardProps> = ({ messages, isLoading, playingMessageId, playbackProgress, isPaused, activeMcqMessageId, onSelectMcqOption }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new message insertion and during playback
  useEffect(() => {
    const isLastMessagePlaying = messages.length > 0 && playingMessageId === messages[messages.length - 1].id;
    
    if (isLastMessagePlaying || !playingMessageId || isLoading) {
        // Use 'smooth' for new messages/loading, 'auto' for progress updates to avoid jitter
        const behavior = (playingMessageId && isLastMessagePlaying) ? 'auto' : 'smooth';
        bottomRef.current?.scrollIntoView({ behavior });
    }
  }, [messages.length, playingMessageId, playbackProgress, isLoading]);

  if (messages.length === 0 && !isLoading) {
      return (
          <div className="flex-1 w-full h-full flex flex-col items-center justify-center relative pb-40">
              <div className="flex flex-col items-center justify-center opacity-60 mt-[-60px]">
                  <div className="w-20 h-20 rounded-full bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center animate-pulse mb-6 leading-none shrink-0 overflow-hidden">
                      <span className="text-5xl font-bold text-yellow-500 font-sans">स</span>
                  </div>
                  <h1 className="text-4xl md:text-5xl font-bold text-white/80 tracking-wider font-sans mb-3">Namaste!</h1>
                  <p className="text-lg text-gray-400 max-w-md text-center font-sans leading-relaxed mt-2">
                    I am Saraswati, I will help you with Physics, Chemistry, and Biology.
                  </p>
              </div>
          </div>
      );
  }

  return (
    <div className="flex-1 overflow-y-auto w-full relative pb-40 pt-36 overscroll-contain [&::-webkit-scrollbar]:hidden">
       <div className="max-w-5xl mx-auto px-4 relative z-10">
           <div className="pl-0 md:pl-4">
               {messages.map((msg) => (
                   <BlackboardMessage 
                        key={msg.id}
                        msg={msg}
                        playingMessageId={playingMessageId} 
                        progress={playbackProgress}
                        isPaused={isPaused}
                        activeMcqMessageId={activeMcqMessageId}
                        onSelectMcqOption={onSelectMcqOption}
                   />
               ))}

               {isLoading && (
                   <div className="flex gap-4 md:gap-6 animate-in fade-in duration-500">
                        {/* Loading Avatar - Reduced Size */}
                        <div className="flex flex-col items-center shrink-0 w-8 md:w-10">
                             <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-stone-800 border-2 border-stone-700 flex items-center justify-center animate-bounce leading-none pb-0.5 shrink-0 overflow-hidden">
                                  <span className="text-yellow-500/50 font-bold flex items-center justify-center w-full h-full mt-1 text-lg md:text-xl">स</span>
                             </div>
                             <div className="w-1 h-full bg-stone-800 rounded-full mt-2 opacity-30"></div>
                        </div>
                        
                        {/* Loading Text */}
                        <div className="pt-2">
                            <div className="flex items-center gap-1 text-stone-400 font-sans text-lg">
                                <span className="animate-pulse">Saraswati is thinking</span>
                                <div className="flex gap-1 ml-1 pt-2">
                                    <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-bounce-deep [animation-delay:-0.3s]"></span>
                                    <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-bounce-deep [animation-delay:-0.15s]"></span>
                                    <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-bounce-deep"></span>
                                </div>
                            </div>
                            {/* NEW: Expected Time */}
                            <p className="text-xs text-stone-500 mt-1 font-[Arial] tracking-wide">
                                Expected time: 1-3 mins
                            </p>
                        </div>
                   </div>
               )}
               <div ref={bottomRef} className="h-20" /> 
           </div>
       </div>
    </div>
  );
};