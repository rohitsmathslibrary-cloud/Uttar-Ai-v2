

import React, { useRef, useState, useEffect } from 'react';
import { Mic, Send, Image as ImageIcon, X, Play, Pause } from 'lucide-react';

interface InputAreaProps {
  onSendMessage: (text: string, image?: File, audioBlob?: Blob) => void;
  isRecording: boolean;
  toggleRecording: () => void;
  isAudioPlaying: boolean;
  isAudioPaused: boolean;
  onTogglePause: () => void;
}

const InputArea: React.FC<InputAreaProps> = ({ 
  onSendMessage, 
  isRecording, 
  toggleRecording,
  isAudioPlaying,
  isAudioPaused,
  onTogglePause
}) => {
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [interimTranscript, setInterimTranscript] = useState('');
  
  // Ref to track the recognition instance
  const recognitionRef = useRef<any>(null);
  // Ref to store the input value at the moment recording started
  const baseInputRef = useRef<string>('');
  
  // Lock to prevent double submission
  const isSendingRef = useRef(false);

  // Calculate what to show in the textarea
  const displayValue = isRecording 
    ? input + (interimTranscript ? (input ? ' ' : '') + interimTranscript : '') 
    : input;

  // Auto-expand logic
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + 'px';
    }
  }, [displayValue]);

  // Manage Preview URL safely
  useEffect(() => {
    if (!selectedImage) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedImage);
    setPreviewUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [selectedImage]);

  // Clear interim when recording stops
  useEffect(() => {
    if (!isRecording) {
      setInterimTranscript('');
    }
  }, [isRecording]);

  // Web Speech API for Visual Feedback
  useEffect(() => {
    if (isRecording && 'webkitSpeechRecognition' in window) {
      // 1. Capture the current input as the "base" state before speech is added
      baseInputRef.current = input;

      // Stop any existing instance
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }

      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-IN'; 
      
      recognitionRef.current = recognition;

      recognition.onresult = (event: any) => {
        const finalParts: string[] = [];
        let interim = '';
        
        // 2. Iterate through ALL results provided by the session
        for (let i = 0; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
             // Collect all finalized segments
             finalParts.push(event.results[i][0].transcript.trim());
          } else {
             // Collect current interim hypothesis
             interim += event.results[i][0].transcript;
          }
        }
        
        const currentSessionFinal = finalParts.join(' ');
        const base = baseInputRef.current.trim();
        
        // 3. Reconstruct the full input: Base + Space + New Speech
        let newInput = base;
        if (base && currentSessionFinal) {
          newInput += ' ';
        }
        newInput += currentSessionFinal;

        setInput(newInput);
        setInterimTranscript(interim);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            toggleRecording();
        }
      };

      try {
        recognition.start();
      } catch (e) {
        console.error("Failed to start recognition", e);
      }
    } 

    // Cleanup
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording]); 

  const handleSend = () => {
    if (isSendingRef.current) return;

    const textToSend = displayValue.trim(); 
    if ((!textToSend && !selectedImage)) return;
    
    // Lock submission
    isSendingRef.current = true;

    if (isRecording) {
      toggleRecording();
    }

    onSendMessage(textToSend, selectedImage || undefined);
    
    // Clear Input
    setInput('');
    setInterimTranscript('');
    setSelectedImage(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    // Unlock after delay
    setTimeout(() => {
        isSendingRef.current = false;
    }, 500);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isRecording) {
      toggleRecording();
      setInterimTranscript(''); 
    }
    setInput(e.target.value);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const name = file.name.toLowerCase();
      if (name.endsWith('.heic') || name.endsWith('.heif') || file.type === 'image/heic' || file.type === 'image/heif') {
        alert('HEIC/HEIF images are not supported.\n\nPlease convert to JPG or PNG first:\n• On iPhone: Settings → Camera → Formats → Most Compatible\n• Or take a screenshot of the image instead.');
        e.target.value = '';
        return;
      }
      if (!file.type.startsWith('image/')) {
        alert('Only image files (JPG, PNG, GIF, WebP) are supported.');
        e.target.value = '';
        return;
      }
      setSelectedImage(file);
    }
  };

  return (
    <div className="relative w-full max-w-3xl mx-auto z-30">
      {/* Gradient Mask for fading content behind */}
      <div className="absolute -top-20 left-0 right-0 h-20 bg-gradient-to-t from-[#1a1a1a] via-[#1a1a1a]/95 to-transparent pointer-events-none" />

      {/* File Preview Stack */}
      {selectedImage && previewUrl && (
        <div className="absolute -top-44 left-4 animate-in fade-in slide-in-from-bottom-2 z-50">
          <div className="relative group">
            <img 
              src={previewUrl} 
              alt="Preview" 
              className="h-40 w-auto max-w-[200px] object-contain rounded-lg border border-stone-600 shadow-2xl bg-black" 
            />
            <button 
              onClick={() => setSelectedImage(null)}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-red-600"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Glassmorphic Container */}
      <div className="bg-stone-800/80 backdrop-blur-xl border border-stone-700/50 rounded-2xl p-3 shadow-2xl flex items-center gap-3 transition-all duration-300">
        
        {/* File Attach (Image Icon) */}
        <label className="p-3 text-stone-400 hover:text-yellow-500 hover:bg-stone-700/50 rounded-xl cursor-pointer transition-all active:scale-95" title="Upload Picture">
          <ImageIcon className="w-5 h-5" />
          <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </label>

        {/* Text Input */}
        <div className="flex-1 relative min-h-[48px] flex items-center">
          <textarea
            ref={textareaRef}
            value={displayValue}
            onChange={handleChange}
            autoComplete="off"
            placeholder={isRecording ? "Listening..." : "Ask me anything..."}
            className={`w-full bg-transparent text-stone-300 placeholder-stone-500 resize-none focus:outline-none font-['Roboto'] text-lg py-3 max-h-[150px] ${isRecording && interimTranscript ? 'animate-pulse' : ''}`}
            rows={1}
          />
        </div>

        {/* Audio Controls - Play/Pause (Conditionally Visible) */}
        {isAudioPlaying && (
          <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-right-4 zoom-in-95 duration-300">
             <button
                onClick={onTogglePause}
                className={`p-3 rounded-xl text-white shadow-lg transition-all active:scale-95 ${
                    isAudioPaused ? 'bg-green-600 hover:bg-green-500' : 'bg-amber-600 hover:bg-amber-500'
                }`}
                title={isAudioPaused ? "Resume Explanation" : "Pause Explanation"}
             >
                {isAudioPaused ? <Play className="w-5 h-5 fill-current" /> : <Pause className="w-5 h-5 fill-current" />}
             </button>
          </div>
        )}

        {/* Mic Button */}
        <button
          onClick={toggleRecording}
          className={`p-3 rounded-xl transition-all duration-300 active:scale-95 relative ${
            isRecording 
              ? 'bg-red-500/20 text-red-500' 
              : 'text-stone-400 hover:text-yellow-500 hover:bg-stone-700/50'
          }`}
        >
          {isRecording && (
             <span className="absolute inset-0 rounded-xl bg-red-500/20 animate-ping"></span>
          )}
          <Mic className={`w-6 h-6 ${isRecording ? 'animate-pulse' : ''}`} />
        </button>

        {/* Send Button */}
        <button
          onClick={handleSend}
          className="p-3 bg-yellow-600 hover:bg-yellow-500 text-white rounded-xl shadow-lg hover:shadow-yellow-500/20 transition-all duration-300 active:scale-95 flex items-center justify-center"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
      
      <div className="text-center mt-2">
         <span className="text-xs text-stone-600 font-['Roboto']">
            Saraswati can make mistakes. Check important info.
         </span>
      </div>
    </div>
  );
};

export default InputArea;