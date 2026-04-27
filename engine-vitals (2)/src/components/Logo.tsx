import React from 'react';
import { cn } from '../lib/utils';

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export default function Logo({ className, showText = false, size = 'md' }: LogoProps) {
  const sizes = {
    sm: 'w-16 h-16',
    md: 'w-32 h-32',
    lg: 'w-48 h-48',
    xl: 'w-64 h-64'
  };

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <div className={cn("relative flex items-center justify-center", sizes[size])}>
        <img 
          src="/logo.png" 
          alt="Engine Vitals Logo" 
          className="w-full h-full object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)] rounded-full" 
          referrerPolicy="no-referrer"
          onError={(e) => {
            // Fallback if they haven't uploaded it yet
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      </div>
    </div>
  );
}
