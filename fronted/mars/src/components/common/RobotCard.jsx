import React from 'react';
import { GaugeArc } from './GaugeArc';
import { StatusBar } from './StatusBar';
import { Pulse } from './Pulse';

export function RobotCard({
  robot,
  onCambiarModo,
  onIrABase,
  onRecargar,
  onOptimizarCarga,
  onConfigurar,
  loading = false,
}) {
  const isLectura = robot.modo === 'lectura';
  const isInyeccion = robot.modo === 'inyeccion';
  const totalCapsulas = (robot.capsulas_minimo || 0) + (robot.capsulas_medio || 0) + (robot.capsulas_alto || 0);
  const capMax = robot.capacidad_capsulas || 30;

  const batteryColor =
    robot.bateria > 50 ? '#22c55e' : robot.bateria > 20 ? '#eab308' : '#ef4444';

  return (
    <div className="bg-[#0d1116] border border-[#21262d] hover:border-[#ff4500]/50 rounded-xl p-4 flex flex-col justify-between gap-4 shadow-xl transition-all duration-300">
      {/* Header: Title & Badges */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-base tracking-wide font-mono">
              {robot.nombre}
            </span>
            <Pulse
              color={robot.estado === 'activo' ? '#22c55e' : '#eab308'}
              size="w-2 h-2"
            />
          </div>
          <span className="text-[0.65rem] text-gray-400 font-mono">
            {robot.modelo || 'Myco-v1'} • SN: {robot.numero_serie || `SN-${robot.id}`}
          </span>
        </div>

        {/* Mode Badge */}
        <div className="flex flex-col items-end gap-1">
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 border ${
              isLectura
                ? 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                : 'bg-[#ff4500]/15 text-[#ff4500] border-[#ff4500]/30'
            }`}
          >
            <i
              className={`fa-solid ${
                isLectura ? 'fa-magnifying-glass-chart' : 'fa-syringe'
              } text-[0.7rem]`}
            />
            <span>{isLectura ? 'Modo Lectura' : 'Modo Inyección'}</span>
          </span>
          <span className="text-[0.6rem] text-gray-400 font-mono">
            {robot.estado === 'retornando_base' ? 'Retornando a base' : robot.estado}
          </span>
        </div>
      </div>

      {/* Main Telemetry: Battery & Wi-Fi */}
      <div className="grid grid-cols-2 gap-3 p-2.5 bg-black/40 rounded-lg border border-white/5">
        <div className="flex items-center gap-3">
          <GaugeArc
            value={robot.bateria}
            max={100}
            color={batteryColor}
            size={56}
            unit="%"
          />
          <div className="flex flex-col text-left">
            <span className="text-[0.65rem] text-gray-400 uppercase font-medium">Batería</span>
            <span className="text-xs font-bold font-mono text-white">{robot.bateria}%</span>
            <span className="text-[0.6rem] text-gray-500">
              {robot.en_estacion_base ? 'En muelle base' : 'En campo'}
            </span>
          </div>
        </div>

        <div className="flex flex-col justify-center border-l border-white/5 pl-3">
          <div className="flex items-center gap-1.5 text-xs text-white">
            <i className={`fa-solid fa-wifi ${robot.wifi_conectado ? 'text-emerald-400' : 'text-rose-400'}`} />
            <span className="font-mono text-[0.75rem] truncate max-w-[95px]">
              {robot.wifi_ssid || 'Myco-Net'}
            </span>
          </div>
          <span className="text-[0.6rem] text-gray-400 mt-0.5">
            Señal: <span className="text-gray-300 font-mono">{robot.wifi_rssi || -60} dBm</span>
          </span>
          <span className="text-[0.6rem] text-gray-500 font-mono truncate">
            IP: {robot.wifi_ip || '192.168.1.x'}
          </span>
        </div>
      </div>

      {/* Capsule Inventory Bar */}
      <div className="flex flex-col gap-1.5">
        <StatusBar
          label="Cápsulas a bordo"
          value={totalCapsulas}
          max={capMax}
          color="#ff4500"
        />
        <div className="grid grid-cols-3 gap-1.5 text-center pt-1">
          <div className="bg-white/5 rounded p-1">
            <div className="text-[0.6rem] text-amber-400">Mínimo</div>
            <div className="text-xs font-bold font-mono text-white">{robot.capsulas_minimo || 0}</div>
          </div>
          <div className="bg-white/5 rounded p-1">
            <div className="text-[0.6rem] text-emerald-400">Medio</div>
            <div className="text-xs font-bold font-mono text-white">{robot.capsulas_medio || 0}</div>
          </div>
          <div className="bg-white/5 rounded p-1">
            <div className="text-[0.6rem] text-[#ff4500]">Alto</div>
            <div className="text-xs font-bold font-mono text-white">{robot.capsulas_alto || 0}</div>
          </div>
        </div>
      </div>

      {/* Location / Coords */}
      <div className="text-[0.65rem] font-mono text-gray-400 flex justify-between px-1">
        <span>Lat: {Number(robot.latitud || robot.latitud_marte || 0).toFixed(5)}</span>
        <span>Lon: {Number(robot.longitud || robot.longitud_marte || 0).toFixed(5)}</span>
      </div>

      {/* Quick Action Buttons */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
        <button
          onClick={() => onCambiarModo?.(robot, isLectura ? 'inyeccion' : 'lectura')}
          disabled={loading}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
            isLectura
              ? 'bg-[#ff4500]/20 hover:bg-[#ff4500]/30 text-[#ff4500] border border-[#ff4500]/30'
              : 'bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 border border-sky-500/30'
          }`}
          title="Alternar modo del robot"
        >
          <i className="fa-solid fa-repeat text-xs" />
          <span>{isLectura ? 'Pasar a Inyección' : 'Pasar a Lectura'}</span>
        </button>

        <button
          onClick={() => onIrABase?.(robot)}
          disabled={loading || robot.en_estacion_base}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40"
          title="Enviar robot a recargar a la estación base"
        >
          <i className="fa-solid fa-charging-station text-xs text-amber-400" />
          <span>Ir a Base</span>
        </button>

        <button
          onClick={() => onOptimizarCarga?.(robot)}
          className="col-span-1 px-2.5 py-1 rounded text-[0.7rem] bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 flex items-center justify-center gap-1 transition-colors"
          title="Determinar cuántas cápsulas poner para optimizar recursos"
        >
          <i className="fa-solid fa-calculator text-[0.65rem]" />
          <span>Optimizar Carga</span>
        </button>

        <button
          onClick={() => onConfigurar?.(robot)}
          className="col-span-1 px-2.5 py-1 rounded text-[0.7rem] bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 flex items-center justify-center gap-1 transition-colors"
          title="Configurar parámetros desde Gemelo Digital"
        >
          <i className="fa-solid fa-sliders text-[0.65rem]" />
          <span>Configurar</span>
        </button>
      </div>
    </div>
  );
}
