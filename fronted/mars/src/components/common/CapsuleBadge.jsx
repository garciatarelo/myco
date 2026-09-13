import React from 'react';

const GRADE_CONFIG = {
  minimo: {
    label: 'Grado Mínimo',
    color: '#eab308',
    bg: 'rgba(234, 179, 8, 0.12)',
    border: 'rgba(234, 179, 8, 0.3)',
    icon: 'fa-solid fa-seedling',
  },
  medio: {
    label: 'Grado Medio',
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.12)',
    border: 'rgba(16, 185, 129, 0.3)',
    icon: 'fa-solid fa-leaf',
  },
  alto: {
    label: 'Grado Alto',
    color: '#ff4500',
    bg: 'rgba(255, 69, 0, 0.15)',
    border: 'rgba(255, 69, 0, 0.35)',
    icon: 'fa-solid fa-dna',
  },
};

export function CapsuleBadge({ grado = 'medio', micorrizas, className = '' }) {
  const conf = GRADE_CONFIG[grado] || GRADE_CONFIG.medio;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${className}`}
      style={{
        backgroundColor: conf.bg,
        borderColor: conf.border,
        color: conf.color,
      }}
    >
      <i className={`${conf.icon} text-[0.7rem]`} />
      <span>{conf.label}</span>
      {micorrizas && (
        <span className="opacity-75 font-mono text-[0.65rem]">
          ({Number(micorrizas).toLocaleString()} UFC/g)
        </span>
      )}
    </span>
  );
}
