
import React from 'react';
import { HistoryItem } from '../types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryItem[];
  onLoadSession: (id: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, history, onLoadSession }) => {
  return (
    <div className={`fixed inset-y-0 left-0 w-80 bg-[#1a1a1a] border-r border-stone-800 transform transition-transform duration-300 ease-in-out z-50 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="p-6 h-full flex flex-col">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-xl font-bold text-white tracking-wide">My Notes</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4">
          {history.length === 0 ? (
            <div className="text-stone-500 text-center italic mt-10">
              No study records yet.
              <br/>Start a conversation!
            </div>
          ) : (
            history.map((item) => (
              <div 
                key={item.id} 
                onClick={() => onLoadSession(item.id)}
                className="p-4 rounded-lg bg-stone-900 border border-stone-800 hover:border-yellow-600/50 cursor-pointer transition-colors group"
              >
                <h3 className="text-stone-300 font-medium group-hover:text-yellow-500 transition-colors line-clamp-2">{item.title}</h3>
                <p className="text-xs text-stone-500 mt-2">{item.date}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
