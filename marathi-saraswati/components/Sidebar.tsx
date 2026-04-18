import React from 'react';
import { BookOpen, Clock, PlusCircle } from 'lucide-react';
import { NotebookEntry } from '../types';

interface SidebarProps {
  isOpen: boolean;
  notebook: NotebookEntry[];
  currentSessionId: string | null;
  onSelectEntry: (id: string) => void;
  onNewSession: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, notebook, currentSessionId, onSelectEntry, onNewSession }) => {
  return (
    <div 
      className={`fixed top-0 left-0 h-full bg-[#151515] border-r border-stone-800 transition-all duration-300 z-30 ${
        isOpen ? 'w-64' : 'w-0'
      } overflow-hidden font-['Arial']`}
    >
      <div className="p-6 h-full flex flex-col">
        <div className="flex items-center space-x-3 mb-8">
          <div className="w-10 h-10 min-w-[2.5rem] rounded-full bg-yellow-600 flex items-center justify-center text-white font-bold text-xl shadow-lg border border-yellow-500/30">
            ल
          </div>
          <h1 className="text-xl font-bold text-yellow-500 whitespace-nowrap">
            My Notebook
          </h1>
        </div>

        <button 
          onClick={onNewSession}
          className="flex items-center space-x-2 w-full bg-stone-800 hover:bg-stone-700 text-stone-300 p-3 rounded-lg transition-colors mb-6 group"
        >
           <PlusCircle className="w-5 h-5 group-hover:text-yellow-500" />
           <span className="font-medium">New Session</span>
        </button>

        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          <h2 className="text-xs uppercase tracking-wider text-stone-500 font-bold mb-2">Previous Sessions</h2>
          {notebook.length === 0 && (
            <p className="text-stone-600 text-sm italic text-center mt-4">No conversations yet.</p>
          )}
          {notebook.map((entry) => (
            <div 
              key={entry.id}
              onClick={() => onSelectEntry(entry.id)}
              className={`p-3 rounded-lg cursor-pointer group transition-all border border-transparent ${
                currentSessionId === entry.id 
                  ? 'bg-stone-800 border-stone-700' 
                  : 'hover:bg-stone-800/50 hover:border-stone-800'
              }`}
            >
              <h3 className={`text-sm font-medium truncate ${currentSessionId === entry.id ? 'text-yellow-500' : 'text-stone-300 group-hover:text-yellow-400'}`}>
                {entry.title || "Untitled Note"}
              </h3>
              <div className="flex items-center text-stone-600 text-xs mt-1">
                <Clock className="w-3 h-3 mr-1" />
                {entry.date}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;