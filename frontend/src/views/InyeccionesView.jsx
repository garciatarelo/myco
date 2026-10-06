import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { MetricCard } from '../components/common/MetricCard';
import { CapsuleBadge } from '../components/common/CapsuleBadge';

export default function InyeccionesView() {
  const [inyecciones, setInyecciones] = useState([]);
  const [robots, setRobots] = useState([]);
  const [estadisticas, setEstadisticas] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Estados del Optimizador Interactivo
  const [coordsStart, setCoordsStart] = useState({ lat: 29.0731, lon: -110.9554 });
  const [coordsEnd, setCoordsEnd] = useState({ lat: 29.0745, lon: -110.9540 });
  const [calculating, setCalculating] = useState(false);
  const [optimizacionResult, setOptimizacionResult] = useState(null);

  // Ejecución de inyección
  const [selectedRobotId, setSelectedRobotId] = useState('');
  const [injecting, setInjecting] = useState(false);
  const [injectFeedback, setInjectFeedback] = useState(null);

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setLoading(true);
    setError('');
    try {
      const [resIny, resRobots, resStats] = await Promise.all([
        apiService.getInyecciones({ per_page: 30 }),
        apiService.getRobots(),
        apiService.getEstadisticasInyecciones(),
      ]);

      const lista = resIny.data || resIny;
      setInyecciones(Array.isArray(lista) ? lista : []);
      setRobots(resRobots || []);
      setEstadisticas(resStats || null);

      // Elegir por defecto un robot en modo inyección
      const robotIny = resRobots.find((r) => r.modo === 'inyeccion') || resRobots[0];
      if (robotIny && !selectedRobotId) {
        setSelectedRobotId(robotIny.id);
      }
    } catch (err) {
      setError('Error al cargar inyecciones: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCalcularOptimo() {
    setCalculating(true);
    setInjectFeedback(null);
    try {
      const res = await apiService.recomendarPuntoInyeccion({
        start: coordsStart,
        end: coordsEnd,
      });
      setOptimizacionResult(res);
    } catch (err) {
      alert('Error al calcular punto óptimo: ' + err.message);
    } finally {
      setCalculating(false);
    }
  }

  async function handleEjecutarInyeccion() {
    if (!selectedRobotId) {
      alert('Por favor selecciona un robot');
      return;
    }

    if (!optimizacionResult) {
      alert('Primero calcula el punto óptimo');
      return;
    }

    setInjecting(true);
    setInjectFeedback(null);
    try {
      const { punto_optimo } = optimizacionResult;
      const res = await apiService.ejecutarInyeccionOptimizada({
        robot_id: selectedRobotId,
        latitud: punto_optimo.lat,
        longitud: punto_optimo.lon,
        humedad: punto_optimo.humedad,
        ph: punto_optimo.ph,
        temperatura: punto_optimo.temperatura,
      });

      setInjectFeedback({
        type: 'success',
        text: res.message || 'Inyección ejecutada exitosamente',
        detalles: res,
      });

      await cargarDatos();
    } catch (err) {
      setInjectFeedback({
        type: 'error',
        text: err.message || 'Error al ejecutar inyección',
      });
    } finally {
      setInjecting(false);
    }
  }

  function presetCoords(tipo) {
    if (tipo === 'humedad-alta') {
      setCoordsStart({ lat: 29.0731, lon: -110.9554 });
      setCoordsEnd({ lat: 29.0743, lon: -110.9542 });
    } else if (tipo === 'jezero-marte') {
      setCoordsStart({ lat: 18.3801, lon: 77.5801 });
      setCoordsEnd({ lat: 18.3815, lon: 77.5820 });
    } else {
      setCoordsStart({ lat: 29.0735, lon: -110.9550 });
      setCoordsEnd({ lat: 29.0740, lon: -110.9545 });
    }
    setOptimizacionResult(null);
  }

  return (
    <div className="min-h-[calc(100vh-65px)] bg-[#131313] p-4 sm:p-6 max-w-7xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#21262d]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold font-mono text-white tracking-wide">
              Inyecciones & Algoritmo de Optimización
            </h1>
            <span className="px-2 py-0.5 rounded text-[0.65rem] font-bold bg-[#ff4500]/20 text-[#ff4500] border border-[#ff4500]/30 font-mono">
              EXPANSIÓN MICELIAL
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            En <strong>Modo Inyección</strong>, el Myco inocula micorrizas calculando el tipo de cápsula en función de la humedad del terreno para maximizar la expansión micelar y ahorrar recursos.
          </p>
        </div>

        <button
          onClick={cargarDatos}
          className="self-start sm:self-center p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 text-xs transition-colors"
          title="Recargar datos"
        >
          <i className={`fa-solid fa-arrows-rotate ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* KPI Stats */}
      {estadisticas && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard
            icon="fa-solid fa-syringe"
            label="Inyecciones Totales"
            value={estadisticas.total_inyecciones}
            sublabel="eventos de inoculación"
            accentColor="#ff4500"
          />
          <MetricCard
            icon="fa-solid fa-chart-line"
            label="Cobertura Micelial"
            value={`${estadisticas.expansion_estimada_acumulada_metros} m`}
            sublabel="radio de red acumulado"
            accentColor="#10b981"
          />
          <MetricCard
            icon="fa-solid fa-piggy-bank"
            label="Ahorro Promedio"
            value={`${estadisticas.ahorro_promedio_recursos_pct}%`}
            sublabel="de recursos preservados"
            accentColor="#00e5ff"
          />
          <MetricCard
            icon="fa-solid fa-dna"
            label="Grado Alto Inyectado"
            value={estadisticas.distribucion_grado?.alto || 0}
            sublabel="en zonas de alta humedad"
            accentColor="#a855f7"
          />
        </div>
      )}

      {/* Interactive Optimization Calculator */}
      <div className="bg-[#0d1116] border border-[#ff4500]/30 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/10 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#ff4500]/20 text-[#ff4500] flex items-center justify-center">
              <i className="fa-solid fa-calculator text-sm" />
            </div>
            <div>
              <h2 className="text-sm font-bold font-mono text-white">
                Calculador de Punto Óptimo e Inyección Inteligente
              </h2>
              <span className="text-[0.65rem] text-gray-400 font-mono">
                Detecta entre dos puntos la coordenada de mayor humedad para aplicar Grado Alto
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[0.65rem] text-gray-400 font-mono mr-1">Preajustes:</span>
            <button
              onClick={() => presetCoords('humedad-alta')}
              className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-300 text-[0.65rem] font-mono border border-white/10"
            >
              Parche Húmedo (Alpha)
            </button>
            <button
              onClick={() => presetCoords('jezero-marte')}
              className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-300 text-[0.65rem] font-mono border border-white/10"
            >
              Cráter Jezero (Marte)
            </button>
          </div>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="p-3 bg-black/40 rounded-xl border border-white/5">
            <span className="text-[0.7rem] font-bold text-sky-400 font-mono block mb-2">
              <i className="fa-solid fa-location-dot mr-1" /> Coordenada Inicio (A)
            </span>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="0.0001"
                value={coordsStart.lat}
                onChange={(e) => setCoordsStart({ ...coordsStart, lat: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 rounded-lg bg-black border border-[#21262d] text-white text-xs font-mono outline-none"
              />
              <input
                type="number"
                step="0.0001"
                value={coordsStart.lon}
                onChange={(e) => setCoordsStart({ ...coordsStart, lon: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 rounded-lg bg-black border border-[#21262d] text-white text-xs font-mono outline-none"
              />
            </div>
          </div>

          <div className="p-3 bg-black/40 rounded-xl border border-white/5">
            <span className="text-[0.7rem] font-bold text-[#ff4500] font-mono block mb-2">
              <i className="fa-solid fa-location-crosshairs mr-1" /> Coordenada Fin (B)
            </span>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="0.0001"
                value={coordsEnd.lat}
                onChange={(e) => setCoordsEnd({ ...coordsEnd, lat: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 rounded-lg bg-black border border-[#21262d] text-white text-xs font-mono outline-none"
              />
              <input
                type="number"
                step="0.0001"
                value={coordsEnd.lon}
                onChange={(e) => setCoordsEnd({ ...coordsEnd, lon: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 rounded-lg bg-black border border-[#21262d] text-white text-xs font-mono outline-none"
              />
            </div>
          </div>

          <div className="p-3 bg-black/40 rounded-xl border border-white/5 flex flex-col justify-between">
            <span className="text-[0.7rem] font-bold text-emerald-400 font-mono block mb-2">
              <i className="fa-solid fa-robot mr-1" /> Robot Asignado
            </span>
            <select
              value={selectedRobotId}
              onChange={(e) => setSelectedRobotId(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-black border border-[#21262d] text-white text-xs font-mono outline-none"
            >
              {robots.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre} ({r.modo} - Bat: {r.bateria}%)
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5 mb-4">
          <button
            onClick={handleCalcularOptimo}
            disabled={calculating}
            className="py-2 px-4 bg-[#ff4500] hover:bg-[#ff4500]/90 text-white font-bold text-xs font-mono rounded-xl shadow-lg shadow-[#ff4500]/20 flex items-center gap-2 transition-all disabled:opacity-50"
          >
            {calculating && <i className="fa-solid fa-spinner animate-spin" />}
            <i className="fa-solid fa-magnifying-glass-location" />
            <span>Calcular Punto Óptimo con IA</span>
          </button>

          {optimizacionResult && (
            <button
              onClick={handleEjecutarInyeccion}
              disabled={injecting}
              className="py-2 px-4 bg-emerald-500 hover:bg-emerald-500/90 text-white font-bold text-xs font-mono rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {injecting && <i className="fa-solid fa-spinner animate-spin" />}
              <i className="fa-solid fa-syringe" />
              <span>Ejecutar Inyección con Myco</span>
            </button>
          )}
        </div>

        {/* Optimization Output Card */}
        {optimizacionResult && (
          <div className="p-4 bg-black/60 border border-[#ff4500]/40 rounded-xl flex flex-col gap-3 font-mono">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Punto Óptimo:</span>
                <strong className="text-white text-xs">
                  {optimizacionResult.punto_optimo.lat}, {optimizacionResult.punto_optimo.lon}
                </strong>
              </div>
              <CapsuleBadge grado={optimizacionResult.grado_capsula} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-white/5 p-2 rounded-lg">
                <span className="text-[0.65rem] text-gray-400">Humedad en Punto:</span>
                <div className="text-sm font-bold text-[#ff4500]">
                  {optimizacionResult.punto_optimo.humedad}%
                </div>
              </div>

              <div className="bg-white/5 p-2 rounded-lg">
                <span className="text-[0.65rem] text-gray-400">pH Suelo:</span>
                <div className="text-sm font-bold text-emerald-400">
                  {optimizacionResult.punto_optimo.ph}
                </div>
              </div>

              <div className="bg-white/5 p-2 rounded-lg">
                <span className="text-[0.65rem] text-gray-400">Expansión Estimada:</span>
                <div className="text-sm font-bold text-[#00e5ff]">
                  ~{optimizacionResult.expansion_estimada_cm} cm
                </div>
              </div>

              <div className="bg-white/5 p-2 rounded-lg">
                <span className="text-[0.65rem] text-gray-400">Ahorro de Recursos:</span>
                <div className="text-sm font-bold text-amber-400">
                  {optimizacionResult.ahorro_recursos_pct}%
                </div>
              </div>
            </div>

            <p className="text-xs text-emerald-300 bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/20 leading-relaxed">
              <i className="fa-solid fa-microchip mr-1.5" />
              <strong>Justificación del Algoritmo:</strong> {optimizacionResult.justificacion}
            </p>
          </div>
        )}

        {/* Feedback Alert */}
        {injectFeedback && (
          <div
            className={`mt-3 p-3 rounded-xl border flex items-center gap-2 text-xs font-mono ${
              injectFeedback.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}
          >
            <i className={`fa-solid ${injectFeedback.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}`} />
            <span>{injectFeedback.text}</span>
          </div>
        )}
      </div>

      {/* History Table */}
      <div className="bg-[#0d1116] border border-[#21262d] rounded-xl overflow-hidden shadow-xl">
        <div className="p-3.5 bg-black/30 border-b border-[#21262d] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-clock-rotate-left text-gray-400 text-xs" />
            <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              Historial de Inyecciones de Micorrizas ({inyecciones.length})
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="bg-black/50 text-gray-400 border-b border-[#21262d] text-[0.65rem] uppercase">
                <th className="py-2.5 px-3">Robot Inoculador</th>
                <th className="py-2.5 px-3">Coordenadas</th>
                <th className="py-2.5 px-3">Grado Cápsula</th>
                <th className="py-2.5 px-3">Humedad Suelo</th>
                <th className="py-2.5 px-3">Expansión Hifas</th>
                <th className="py-2.5 px-3">Justificación del Algoritmo</th>
                <th className="py-2.5 px-3 text-right">Fecha Inyección</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#21262d]/60">
              {inyecciones.map((iny) => (
                <tr key={iny.id} className="hover:bg-white/5 transition-colors">
                  <td className="py-2.5 px-3 font-semibold text-white">
                    {iny.robot?.nombre || `Robot #${iny.robot_id}`}
                  </td>
                  <td className="py-2.5 px-3 text-gray-400 text-[0.7rem]">
                    {Number(iny.latitud).toFixed(5)}, {Number(iny.longitud).toFixed(5)}
                  </td>
                  <td className="py-2.5 px-3">
                    <CapsuleBadge grado={iny.grado_capsula} />
                  </td>
                  <td className="py-2.5 px-3 font-bold text-white">
                    {iny.humedad_suelo_detectada ? `${iny.humedad_suelo_detectada}%` : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-[#00e5ff] font-bold">
                    +{iny.expansion_micelio_estimada_cm} cm
                  </td>
                  <td className="py-2.5 px-3 text-gray-300 text-[0.7rem] max-w-xs truncate" title={iny.justificacion_algoritmo}>
                    {iny.justificacion_algoritmo || 'Inoculación estándar'}
                  </td>
                  <td className="py-2.5 px-3 text-right text-gray-400 text-[0.65rem]">
                    {new Date(iny.fecha_inyeccion || iny.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
