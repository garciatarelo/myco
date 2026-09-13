import React from 'react';

export function StatusBar({ label, value, max = 100, color = '#ff4500', unit = '' }) {
  const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0;
  const safeMax = max > 0 ? max : 100;
  const pct = Math.min(Math.max((safeValue / safeMax) * 100, 0), 100);

  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="flex justify-between text-[0.65rem] uppercase tracking-wider text-gray-400">
        <span>{label}</span>
        <strong style={{ color }}>
          {safeValue}{unit} <span className="font-normal text-gray-600">/{safeMax}{unit}</span>
        </strong>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden w-full">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
