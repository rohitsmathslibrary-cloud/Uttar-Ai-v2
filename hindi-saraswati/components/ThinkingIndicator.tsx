

import React from 'react';

interface ThinkingIndicatorProps {
  estimatedTime?: string;
}

const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({ estimatedTime }) => {
  return (
    <div className="flex flex-col pt-1">
      <div className="flex items-center space-x-2 animate-pulse">
        <span className="text-stone-400 font-['Arial'] text-lg">Saraswati is thinking</span>
        <div className="flex space-x-1">
            {/* Wave Dots */}
          <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
      {estimatedTime && (
        <span className="text-xs text-stone-600 mt-1 font-['Arial']">
          Expected time: {estimatedTime}
        </span>
      )}
    </div>
  );
};

export default ThinkingIndicator;