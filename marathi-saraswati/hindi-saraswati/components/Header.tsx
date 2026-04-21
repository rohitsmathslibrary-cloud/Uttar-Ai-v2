import React from 'react';
import { UserMode } from '../types';

interface HeaderProps {
  mode: UserMode;
  onToggleLive: () => void;
  onToggleSidebar: () => void;
  onNewTopic: () => void;
  onSwitchMode?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ mode, onToggleLive, onToggleSidebar, onNewTopic, onSwitchMode }) => {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 p-1.5 md:p-2 bg-stone-900 border-b border-stone-800 shadow-md">
      <div className="w-full px-2 md:px-6 flex justify-between items-center relative">
        
        {/* Left: Menu & Brand */}
        <div className="flex items-center gap-2 md:gap-3">
          <button onClick={onToggleSidebar} className="text-stone-300 hover:text-white transition-colors p-1.5 rounded-full hover:bg-white/10">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-yellow-500 flex items-center justify-center text-[#0a0a0a] font-bold text-lg md:text-xl shadow-lg leading-none shrink-0 overflow-hidden">
              <span className="flex items-center justify-center w-full h-full">स</span>
            </div>
            <div className="flex flex-col justify-center">
              <h1 className="text-base md:text-lg font-bold text-white tracking-wide font-sans leading-none">Saraswati</h1>
              <span className="text-yellow-500 text-[9px] md:text-[10px] font-bold tracking-wider uppercase">Science</span>
            </div>
          </div>
        </div>

        {/* Centre: Switch Mode */}
        {onSwitchMode && (
          <button
            onClick={onSwitchMode}
            className="absolute left-1/2 -translate-x-1/2 px-3 py-1 md:px-4 md:py-1.5 bg-stone-800 hover:bg-stone-700 border border-stone-600 hover:border-yellow-500 text-stone-300 hover:text-yellow-400 rounded-full text-[10px] md:text-xs font-medium transition-colors"
          >
            ⇄ Switch Mode
          </button>
        )}

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <button onClick={onNewTopic} className="flex items-center gap-1 px-3 py-1 md:px-4 md:py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-[10px] md:text-xs font-medium transition-colors shadow-lg">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
            New Topic
          </button>
        </div>
      </div>
    </header>
  );
};
