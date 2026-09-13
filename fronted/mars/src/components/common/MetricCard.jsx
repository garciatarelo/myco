import React from 'react';

export function MetricCard({
  icon,
  label,
  value,
  sublabel,
  accentColor = '#ff4500',
  className = '',
  children,
}) {
  return (
    <div
      className={`bg-[#0d1116] border border-[#21262d] rounded-xl p-3.5 flex flex-col justify-between shadow-lg relative overflow-hidden transition-all duration-300 hover:border-opacity-50 hover:shadow-xl ${className}`}
      style={{ borderColor: `${accentColor}33` }}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[0.7rem] uppercase tracking-wider text-gray-400 font-medium">
          {label}
        </span>
        {icon && (
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
            style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
          >
            <i className={icon} />
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="text-xl font-bold font-mono tracking-tight text-white">
          {value}
        </span>
        {sublabel && (
          <span className="text-[0.65rem] text-gray-400">
            {sublabel}
          </span>
        )}
      </div>

      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}
