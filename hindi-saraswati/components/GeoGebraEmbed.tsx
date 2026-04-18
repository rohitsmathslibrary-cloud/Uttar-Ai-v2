import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';

interface GeoGebraEmbedProps {
  expression: string;
}

const GeoGebraEmbed: React.FC<GeoGebraEmbedProps> = ({ expression }) => {
  const [isLoading, setIsLoading] = useState(true);

  // URL Encode the expression to pass as command
  const encoded = encodeURIComponent(expression);
  const src = `https://www.geogebra.org/classic?command=${encoded}`;

  return (
    <div className="w-full h-[400px] my-4 rounded-lg overflow-hidden border border-stone-700 bg-white shadow-lg relative group">
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-stone-900 z-10">
           <Loader2 className="w-8 h-8 text-yellow-500 animate-spin mb-2" />
           <span className="text-stone-400 text-sm font-mono">Generating Graph...</span>
        </div>
      )}
      <iframe
        title="GeoGebra"
        src={src}
        width="100%"
        height="100%"
        style={{ border: 'none' }}
        allowFullScreen
        loading="lazy"
        onLoad={() => setIsLoading(false)}
      />
      <div className="bg-stone-800 p-2 text-xs text-center text-stone-500 font-mono absolute bottom-0 left-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
        Interactive Graph: {expression} (Zoom/Pan enabled)
      </div>
    </div>
  );
};

export default GeoGebraEmbed;