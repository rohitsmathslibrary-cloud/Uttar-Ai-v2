
import React, { useState, useRef, useEffect } from 'react';

interface InputBarProps {
  onSend: (text: string, image?: string) => void;
  onTogglePlayback: () => void;
  isPlaying: boolean;
  disabled: boolean; // This prop now controls overall disability (loading, live mode, or active MCQ)
  isPaused: boolean;
}

export const InputBar: React.FC<InputBarProps> = ({ onSend, onTogglePlayback, isPlaying, disabled, isPaused }) => {
  const [text, setText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      if (isFocused || text.length > 0) {
          // If focused, give it a bit more space, up to a max
          const newHeight = Math.max(scrollHeight, isFocused ? 80 : 48);
          textareaRef.current.style.height = `${Math.min(newHeight, 200)}px`;
      } else {
          textareaRef.current.style.height = 'auto';
      }
    }
  }, [text, isFocused]);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true; 
        
        recognitionRef.current.onresult = (event: any) => {
            let finalTranscript = '';
            let interimTranscript = '';
            
            for (let i = 0; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            // Update immediately
            setText(prev => {
                // Determine if we should append or replace. 
                // Simple strategy: if we are recording, the transcript is the source of truth for the current session
                return finalTranscript + interimTranscript;
            });
        };

        recognitionRef.current.onend = () => {
            setIsRecording(false);
        };
    }
  }, []);

  const handleMicClick = () => {
    if (isRecording) {
        recognitionRef.current?.stop();
        setIsRecording(false);
    } else {
        setText(''); 
        recognitionRef.current?.start();
        setIsRecording(true);
        setIsFocused(true); 
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = (reader.result as string).split(',')[1];
        setSelectedImage(base64Data);
        setIsFocused(true); 
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (text.trim() || selectedImage) {
      onSend(text, selectedImage || undefined);
      setText('');
      setSelectedImage(null);
      setIsFocused(false);
      setIsRecording(false);
      recognitionRef.current?.stop();
      if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          textareaRef.current.blur(); 
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Only submit on Ctrl+Enter or Meta+Enter (Cmd+Enter on Mac)
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
    // Normal 'Enter' will perform the default action (insert newline)
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 p-4 z-30 pointer-events-none">
      {/* Gradient to fade content behind the bar */}
      <div className="absolute inset-0 -top-20 bg-gradient-to-t from-black via-black/95 to-transparent pointer-events-none" />
      
      <div className="max-w-2xl mx-auto relative pointer-events-auto">
        {selectedImage && (
          <div className="absolute -top-24 left-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="relative group">
              <img src={`data:image/jpeg;base64,${selectedImage}`} alt="Preview" className="h-20 rounded-lg border border-stone-600 shadow-xl" />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg cursor-pointer" onClick={() => setSelectedImage(null)}>
                 <span className="text-white text-xs font-bold">Remove</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Input Container */}
        <div className={`
            flex items-end gap-2 bg-stone-800/90 backdrop-blur-xl border-[0.5px] border-stone-700/30 p-1.5 rounded-2xl shadow-2xl 
            transition-all duration-300 ease-out hover:border-stone-600/50
            ${isFocused ? 'ring-1 ring-yellow-500/20 shadow-yellow-900/10' : ''}
        `}>
          <button onClick={() => fileInputRef.current?.click()} disabled={disabled} className="p-2 text-stone-400 hover:text-yellow-400 hover:bg-stone-700/50 rounded-full transition-all active:scale-95 flex-shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
          </button>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
          
          <textarea
            ref={textareaRef}
            value={text}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
                // Delay blur collapse slightly in case clicking send
                setTimeout(() => {
                    if (!text.trim() && !isRecording) setIsFocused(false);
                }, 200);
            }}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything"
            rows={1}
            disabled={disabled}
            className={`
                flex-1 bg-transparent text-white placeholder-stone-500 px-2 py-2.5 focus:outline-none resize-none font-sans text-base 
                transition-all duration-300 ease-in-out
                ${isFocused || isRecording ? 'min-h-[4rem]' : 'min-h-[2.5rem]'}
            `}
          />
          
          <div className="flex items-center gap-1 pb-0.5">
             {isPlaying && (
                 <button 
                    onClick={onTogglePlayback} 
                    className={`
                        p-2.5 rounded-xl transition-all active:scale-95 shadow-lg animate-in fade-in zoom-in text-white
                        ${isPaused 
                            ? 'bg-emerald-600 hover:bg-emerald-500' // Resume Action -> Green
                            : 'bg-amber-600 hover:bg-amber-500'      // Pause Action -> Amber
                        }
                    `}
                    title={isPaused ? "Resume Lesson" : "Pause Lesson"}
                 >
                    {isPaused ? 
                        // Resume Icon (Play)
                        <svg className="w-5 h-5 scale-125" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg> : 
                        // Pause Icon (Pause)
                        <svg className="w-5 h-5 scale-125" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                    }
                 </button>
             )}
             
             {/* Mic Button with Red Glow */}
             <button onClick={handleMicClick} className={`p-2 rounded-xl transition-all active:scale-95 relative ${isRecording ? 'text-red-500 bg-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'text-stone-400 hover:bg-stone-700/50 hover:text-white'}`} disabled={disabled}>
                {isRecording && <span className="absolute top-0 right-0 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span></span>}
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
             </button>
             
             <button onClick={() => handleSubmit()} disabled={disabled || (!text.trim() && !selectedImage)} className="p-2 bg-yellow-500 hover:bg-yellow-400 text-stone-900 rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:scale-100 shadow-lg">
                <svg className="w-6 h-6 transform rotate-90" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"></path></svg>
             </button>
          </div>
        </div>
        
        {/* Disclaimer Text */}
        <div className="text-center mt-2">
            <span className="text-[10px] text-stone-600 font-sans tracking-wide">Saraswati can make mistakes. Check important info.</span>
        </div>
      </div>
    </div>
  );
};
