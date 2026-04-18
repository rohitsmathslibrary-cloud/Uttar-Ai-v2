

import React, { useEffect, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface TypewriterTextProps {
  content: string;
  audioDuration?: number; // Duration in seconds
  isPaused?: boolean;
  onUpdate?: () => void;
  shouldStopAnimation?: boolean; // New prop: if true, freeze immediately
  onTypingComplete?: () => () => void; // Callback when typing finishes
  textColor?: string; // New prop for text color override
}

const TypewriterText: React.FC<TypewriterTextProps> = ({ 
  content, 
  audioDuration, 
  isPaused = false, 
  onUpdate,
  shouldStopAnimation = false,
  onTypingComplete,
  textColor = "text-stone-300" // Default color
}) => {
  const [displayedLength, setDisplayedLength] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);
  
  // Refs for timing control
  const startTimeRef = useRef<number | null>(null);
  const pausedTimeRef = useRef<number>(0); 
  const pauseStartRef = useRef<number | null>(null);
  const requestRef = useRef<number>(0);
  const previousLengthRef = useRef(0);

  // Constants for typing speed control
  const FALLBACK_MS_PER_CHAR = 50; // 20 characters per second
  const MIN_CPS = 18; // Minimum 18 characters per second for readability
  // Factor < 1.0 means text finishes slightly BEFORE audio (Leading). 
  // 0.99 ensures text is ~1% ahead, syncing almost perfectly as requested.
  const SYNC_FACTOR = 0.99; 

  // Reset state when content changes significantly
  useEffect(() => {
    setDisplayedLength(0);
    setIsComplete(false);
    setIsFrozen(false);
    startTimeRef.current = null;
    pausedTimeRef.current = 0;
    pauseStartRef.current = null;
    previousLengthRef.current = 0;
  }, [content]);

  // Handle Interruption Logic: Freeze text wherever it is
  useEffect(() => {
    if (shouldStopAnimation && !isComplete && !isFrozen) {
      setIsFrozen(true);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
  }, [shouldStopAnimation, isComplete, isFrozen]);

  // Handle Pause Timer logic
  useEffect(() => {
    if (isPaused && !isFrozen) {
      if (pauseStartRef.current === null) {
        pauseStartRef.current = performance.now();
      }
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    } else if (!isPaused && !isFrozen) {
      if (pauseStartRef.current !== null) {
        const pausedDuration = performance.now() - pauseStartRef.current;
        pausedTimeRef.current += pausedDuration;
        pauseStartRef.current = null;
      }
    }
  }, [isPaused, isFrozen]);

  useEffect(() => {
    if (isComplete || isPaused || isFrozen || shouldStopAnimation) return;

    const animate = (time: number) => {
      // Initialize start time on first frame
      if (startTimeRef.current === null) {
        startTimeRef.current = time;
      }

      // Calculate elapsed "active" time
      const elapsed = time - startTimeRef.current - pausedTimeRef.current;
      
      let targetDuration: number;
      if (audioDuration && audioDuration > 0) {
        // Direct Audio Sync
        // We do NOT Clamp to MIN_CPS here because if the audio is fast, the text MUST be fast to keep up.
        // Clamping forces the text to lag behind the audio, which is the exact bug we are fixing.
        targetDuration = audioDuration * 1000 * SYNC_FACTOR;

      } else {
        // Fallback for no audio: 50ms per character (20 CPS)
        targetDuration = content.length * FALLBACK_MS_PER_CHAR;
      }

      // Calculate progress (0 to 1)
      const progress = Math.min(elapsed / targetDuration, 1);
      
      // Map progress to character length
      const currentLength = Math.floor(content.length * progress);

      setDisplayedLength(currentLength);

      // Trigger scroll update
      if (currentLength > previousLengthRef.current && onUpdate) {
        onUpdate();
        previousLengthRef.current = currentLength;
      }

      if (progress < 1) {
        requestRef.current = requestAnimationFrame(animate);
      } else {
        setIsComplete(true);
        if (onTypingComplete) onTypingComplete();
      }
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(requestRef.current);
  }, [content, audioDuration, isPaused, isComplete, isFrozen, shouldStopAnimation, onUpdate, onTypingComplete]);

  // If frozen, stick to current length. If complete, show all.
  const visibleContent = isComplete ? content : content.slice(0, displayedLength);

  return (
    <div className={`font-['Patrick_Hand'] text-xl md:text-2xl leading-[3rem] tracking-wide ${textColor} w-full overflow-hidden transition-colors duration-300`} style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
           p: ({node, ...props}) => <p className="mb-4 whitespace-pre-wrap" {...props} />,
           // IMPORTANT: Map strong (bold) to Yellow. This allows the AI to highlight text by bolding it.
           strong: ({node, ...props}) => <span className="text-yellow-500 font-bold" {...props} />,
           code: ({node, ...props}) => (
              <code className="bg-stone-800 px-1 rounded text-sm font-mono text-yellow-200 break-all whitespace-pre-wrap" {...props} />
           ),
           pre: ({node, ...props}) => (
              <pre className="bg-stone-900 p-4 rounded-lg overflow-x-auto max-w-full my-4 border border-stone-800" {...props} />
           ),
           // Suppress horizontal rules
           hr: () => null,
        }}
      >
        {visibleContent}
      </ReactMarkdown>
      {!isComplete && !isPaused && !isFrozen && (
        <span className="inline-block w-2 h-5 bg-yellow-500 ml-1 animate-blink" />
      )}
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .animate-blink {
          animation: blink 1s infinite;
        }
        /* Ensure math equations don't overflow the page width */
        .katex-display {
           overflow-x: auto;
           overflow-y: hidden;
           max-width: 100%;
           padding-bottom: 4px;
           margin: 0.5em 0;
        }
        .katex {
            white-space: normal !important;
            max-width: 100%;
        }
        .katex-html {
            overflow-x: auto;
            overflow-y: hidden;
        }
      `}</style>
    </div>
  );
};

export default TypewriterText;