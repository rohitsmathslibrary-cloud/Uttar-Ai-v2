
import React, { useState } from 'react';
import { VisualState } from '../types';
import GeoGebraEmbed from './GeoGebraEmbed';
import { Maximize2, X } from 'lucide-react';

interface VisualPanelProps {
  visual: VisualState;
  onClose?: () => void;
}

const VisualPanel: React.FC<VisualPanelProps> = ({ visual, onClose }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="h-full flex flex-col bg-[#1a1a1a] shadow-lg overflow-hidden font-['Roboto'] relative border-l border-stone-800">
      {/* Header */}
      <div className="p-4 bg-[#1a1a1a] border-b border-stone-800 flex justify-between items-center">
        <div className="flex items-center">
            <h3 className="text-yellow-500 font-bold uppercase tracking-wider text-sm flex items-center">
                <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2 animate-pulse"></span>
                Visual Board
            </h3>
            {visual.title && (
                <span className="ml-3 text-stone-500 text-xs border-l border-stone-700 pl-3 truncate max-w-[150px]">
                    {visual.title}
                </span>
            )}
        </div>
        
        {onClose && (
            <button 
                onClick={onClose}
                className="text-stone-500 hover:text-red-400 p-1 rounded transition-colors"
                title="Close Visual Board"
            >
                <X size={18} />
            </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 flex items-center justify-center relative bg-[#1a1a1a]">
        {visual.type === 'graph' ? (
          <div className="w-full h-full min-h-[400px]">
             {/* Key prop ensures the component is destroyed and recreated when timestamp changes */}
             <GeoGebraEmbed 
                expression={visual.content} 
                key={`${visual.content}-${visual.timestamp}`}
             />
          </div>
        ) : (
          <div className="relative group w-full h-full flex items-center justify-center">
             <img 
               src={visual.content} 
               alt="Visual Content" 
               className="max-w-full max-h-full object-contain rounded-lg"
             />
             <button 
                onClick={() => setIsExpanded(true)}
                className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
             >
                <Maximize2 size={16} />
             </button>
          </div>
        )}
      </div>

      {/* Expanded Modal */}
      {isExpanded && visual.type === 'image' && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4" onClick={() => setIsExpanded(false)}>
           <button 
                className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all"
                onClick={() => setIsExpanded(false)}
            >
                <X size={24} />
            </button>
            <img 
                src={visual.content} 
                alt="Expanded Visual" 
                className="max-w-full max-h-full object-contain"
                onClick={(e) => e.stopPropagation()}
            />
        </div>
      )}
    </div>
  );
};

export default VisualPanel;