import React from 'react';

export default function PageLoader() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-8">
      <div className="relative flex items-center justify-center">
        {/* Outer glowing pulsing aura */}
        <div className="w-16 h-16 rounded-full border-2 border-primary/20 animate-ping absolute" />
        
        {/* Spinning gradient ring */}
        <div className="w-14 h-14 rounded-full border-3 border-transparent border-t-primary border-r-primary/50 animate-spin" />
        
        {/* Inner pulsing core */}
        <div className="w-4 h-4 bg-primary rounded-full shadow-[0_0_15px_rgba(245,158,11,0.6)] animate-pulse" />
      </div>

      {/* Subtle loading indicator text */}
      <div className="mt-5 flex items-center space-x-1">
        <span className="text-xs uppercase tracking-widest text-text-secondary font-mono animate-pulse">
          Loading Codexia
        </span>
      </div>
    </div>
  );
}
