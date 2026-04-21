import React, { useEffect, useState, useRef } from 'react';
import { LiveClient } from '../services/live';

interface LiveOverlayProps {
  onClose: () => void;
}

export const LiveOverlay: React.FC<LiveOverlayProps> = ({ onClose }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [volume, setVolume] = useState(0);
  const clientRef = useRef<LiveClient | null>(null);

  useEffect(() => {
    clientRef.current = new LiveClient();
    
    // Set up volume callback
    clientRef.current.onVolumeUpdate = (vol) => {
        setVolume(Math.min(vol, 100));
    };

    clientRef.current.connect(onClose).then(() => {
        setIsConnected(true);
    });

    return () => {
      clientRef.current?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  return (
    <div className="absolute inset-0 bg-gray-900/95 backdrop-blur-md z-50 flex flex-col items-center justify-center p-8 transition-opacity duration-300">
      <div className="text-center space-y-8">
        <h2 className="text-3xl font-bold text-white tracking-wider">LIVE SESSION</h2>
        
        <div className="relative w-64 h-64 flex items-center justify-center">
            {/* Visualizer Circles */}
            <div 
                className="absolute inset-0 rounded-full border-2 border-yellow-500 opacity-20 transition-all duration-100 ease-linear"
                style={{ transform: `scale(${1 + volume/50})` }}
            ></div>
            <div 
                className="absolute inset-0 rounded-full border border-yellow-400 opacity-40 transition-all duration-100 ease-linear"
                style={{ transform: `scale(${1 + volume/80})` }}
            ></div>
            
            {/* Main Avatar */}
            <div className="w-32 h-32 bg-yellow-600 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(234,179,8,0.3)] z-10 relative">
                 <span className="text-5xl font-bold text-white">स</span>
                 {isConnected && (
                     <span className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-900"></span>
                 )}
            </div>
        </div>

        <div className="space-y-2">
            <p className="text-xl text-yellow-200 font-medium">Saraswati is listening...</p>
            <p className="text-gray-400 text-sm">Speak naturally. Ask about Physics, Chemistry, or Biology.</p>
        </div>

        <button 
          onClick={onClose}
          className="mt-8 px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-full font-bold shadow-lg transition transform hover:scale-105"
        >
          End Session
        </button>
      </div>
    </div>
  );
};