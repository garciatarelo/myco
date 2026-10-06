import React from 'react';

export function Pulse({ color = '#ff4500', size = 'w-2 h-2', className = '' }) {
  return (
    <span className={`relative inline-flex ${size} ${className}`}>
      <span
        className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
        style={{ backgroundColor: color }}
      />
      <span
        className="relative inline-flex rounded-full h-full w-full"
        style={{ backgroundColor: color }}
      />
    </span>
  );
}
