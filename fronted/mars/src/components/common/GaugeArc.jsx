import React from 'react';

export function GaugeArc({
  value,
  max = 100,
  color = '#ff4500',
  size = 64,
  label = '',
  unit = '',
}) {
  const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0;
  const safeMax = max > 0 ? max : 100;
  const r = size / 2 - 6;
  const circ = Math.PI * r;
  const pct = Math.min(Math.max(safeValue / safeMax, 0), 1);

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size / 2 + 8} className="overflow-visible">
        <path
          d={`M6,${size / 2} A${r},${r} 0 0 1 ${size - 6},${size / 2}`}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d={`M6,${size / 2} A${r},${r} 0 0 1 ${size - 6},${size / 2}`}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${pct * circ} ${circ}`}
          className="transition-all duration-500 ease-out"
        />
        <text
          x={size / 2}
          y={size / 2 + 2}
          textAnchor="middle"
          className="text-[0.65rem] font-bold font-mono"
          fill={color}
        >
          {safeValue}{unit}
        </text>
      </svg>
      {label && (
        <span className="text-[0.55rem] text-gray-400 uppercase tracking-widest text-center">
          {label}
        </span>
      )}
    </div>
  );
}
