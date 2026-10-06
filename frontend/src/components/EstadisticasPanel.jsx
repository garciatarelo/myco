import React from 'react';
import { GraficaPredictiva } from './GraficaPredictiva';
import { GraficaProgresoSuelo } from './GraficaProgresoSuelo';

export function EstadisticasPanel({ arsenicLevel, area, soilProgressHistory = [] }) {
  const MAX_ARSENICO_NOM147 = 22;
  const baseCapsules = Math.max(1, Math.ceil(area / 10));
  const arsenicExcess = Math.max(0, arsenicLevel - MAX_ARSENICO_NOM147);
  const remediationFactor = 1 + (arsenicExcess / MAX_ARSENICO_NOM147) * 0.5;
  const totalCapsules = Math.max(1, Math.ceil(baseCapsules * remediationFactor));

  const esToxico = arsenicLevel > MAX_ARSENICO_NOM147;
  const toxColor = esToxico ? '#ff4500' : '#22c55e'; // match colors used in Home.tsx

  return (
    <div className="flex flex-col gap-4 text-white font-mono">
      <div className="bg-black/40 border border-white/10 rounded-lg p-4 flex flex-col gap-3">
        <span className="text-[0.6rem] text-gray-400 uppercase tracking-widest block mb-1">Auditoría Ambiental (NOM-147)</span>

        <div className="grid grid-cols-2 gap-4 items-center">
          <div>
            <span className="text-[0.55rem] text-gray-400 uppercase tracking-widest block mb-1">Área del Terreno</span>
            <strong className="text-2xl text-white">
              {area.toLocaleString()} <span className="text-sm text-gray-500">m²</span>
            </strong>
          </div>
          <div>
            <span className="text-[0.55rem] text-gray-400 uppercase tracking-widest block mb-1">Cápsulas Requeridas</span>
            <strong className="text-2xl text-[#ff4500]">
              {totalCapsules.toLocaleString()} <span className="text-sm text-gray-500">uds</span>
            </strong>
          </div>
        </div>

        <div className="text-[0.65rem] text-gray-400 leading-snug">
          Base por terreno: {baseCapsules} | Exceso As: {arsenicExcess.toFixed(1)} mg/kg sobre {MAX_ARSENICO_NOM147}
        </div>

        <div className="mt-2">
          <span className="text-[0.6rem] flex justify-between items-center tracking-widest uppercase mb-1.5">
            <span className="text-gray-400">Toxicidad Promedio (As)</span>
            <strong style={{ color: toxColor }}>
              {arsenicLevel} mg/kg {esToxico ? '(⚠️ ALTO)' : '(SEGURO)'}
            </strong>
          </span>
          <div className="h-1.5 rounded-full bg-white/5 relative overflow-hidden mt-1">
            <div className="absolute left-[22%] top-0 bottom-0 w-0.5 bg-white opacity-40 z-10" />
            <div className="h-full transition-all duration-300" style={{ width: `${Math.min(arsenicLevel, 100)}%`, backgroundColor: toxColor }} />
          </div>
          <span className="text-[0.55rem] text-gray-500 mt-1 block uppercase tracking-widest">Límite NOM: {MAX_ARSENICO_NOM147} mg/kg (Línea blanca)</span>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-4">
          <div className="bg-black/30 p-3 rounded border border-white/5">
            <GraficaPredictiva arsenicLevel={arsenicLevel} />
          </div>
          <div className="bg-black/30 p-3 rounded border border-white/5">
            <GraficaProgresoSuelo soilProgressHistory={soilProgressHistory} />
          </div>
        </div>
      </div>
    </div>
  );
}