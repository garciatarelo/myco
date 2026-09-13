import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { MetricCard } from '../components/common/MetricCard';
import { Pulse } from '../components/common/Pulse';

export default function GemeloDigitalView() {
  const [estado, setEstado] = useState(null);
  const [simulaciones, setSimulaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form de nueva simulación
  const [simForm, setSimForm] = useState({
    nombre: 'Simulación Planeta Marte - Cráter Jezero',
    entorno: 'marte',
    tipo_condicion: 'marte',
    duracion_dias: 30,
  });
  const [simulating, setSimulating] = useState(false);
  const [activeSimulationResult, setActiveSimulationResult] = useState(null);

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setLoading(true);
    setError('');
    try {
      const [resEstado, resSims] = await Promise.all([
        apiService.getGemeloDigitalEstado(),
        apiService.getSimulaciones(),
      ]);
      setEstado(resEstado || null);
      setSimulaciones(Array.isArray(resSims) ? resSims : []);

      if (resSims?.length > 0 && !activeSimulationResult) {
        // Cargar la primera simulación como ejemplo activo
        const first = resSims[0];
        setActiveSimulationResult({
          nombre: first.nombre,
          entorno: first.entorno,
          tipo_condicion: first.tipo_condicion,
          condiciones_ambientales: first.parametros || {},
          resultados: first.resultados || {},
        });
      }
    } catch (err) {
      setError('Error al sincronizar con el Gemelo Digital: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleEjecutarSimulacion(e) {
    e.preventDefault();
    setSimulating(true);
    try {
      const res = await apiService.ejecutarSimulacion(simForm);
      setActiveSimulationResult(res.resumen);
      await cargarDatos();
    } catch (err) {
      alert('Error al ejecutar simulación: ' + err.message);
    } finally {
      setSimulating(false);
    }
  }

  function presetSim(tipo) {
    if (tipo === 'marte') {
      setSimForm({
        nombre: 'Misión Marte - Remediación Regolito Cráter Jezero',
        entorno: 'marte',
        tipo_condicion: 'marte',
        duracion_dias: 45,
      });
    } else if (tipo === 'ideal') {
      setSimForm({
        nombre: 'Terreno Tierra - Condiciones Óptimas de Inoculación',
        entorno: 'tierra',
        tipo_condicion: 'ideal',
        duracion_dias: 30,
      });
    } else {
      setSimForm({
        nombre: 'Terreno Tierra - Estrés Hídrico y Sequía Extrema',
        entorno: 'tierra',
        tipo_condicion: 'extrema',
        duracion_dias: 30,
      });
    }
  }

  return (
    <div className="min-h-[calc(100vh-65px)] bg-[#131313] p-4 sm:p-6 max-w-7xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#21262d]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold font-mono text-white tracking-wide">
              Gemelo Digital & Simulador Temporal
            </h1>
            <span className="px-2 py-0.5 rounded text-[0.65rem] font-bold bg-[#ff4500]/20 text-[#ff4500] border border-[#ff4500]/30 font-mono flex items-center gap-1.5">
              <Pulse color="#22c55e" size="w-2 h-2" />
              <span>SINCRONIZACIÓN EN TIEMPO REAL</span>
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Réplica virtual del estado de la flota robótica y el suelo. Permite correr <strong>simulaciones temporales</strong> en condiciones ideales, extremas y del <strong>Planeta Marte</strong>.
          </p>
        </div>

        <button
          onClick={cargarDatos}
          className="self-start sm:self-center p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 text-xs transition-colors"
          title="Sincronizar telemetría"
        >
          <i className={`fa-solid fa-arrows-rotate ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Real-time State Overview */}
      {estado?.estado_terreno && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard
            icon="fa-solid fa-droplet"
            label="Humedad Terreno Real"
            value={`${estado.estado_terreno.humedad_promedio_pct}%`}
            sublabel="telemetría de sensores"
            accentColor="#00e5ff"
          />
          <MetricCard
            icon="fa-solid fa-flask"
            label="pH Terreno Real"
            value={estado.estado_terreno.ph_promedio}
            sublabel="nivel de acidez actual"
            accentColor="#10b981"
          />
          <MetricCard
            icon="fa-solid fa-network-wired"
            label="Red Micelial Expandida"
            value={`${estado.estado_terreno.expansion_micelial_m2} m²`}
            sublabel="área biológica colonizada"
            accentColor="#ff4500"
          />
          <MetricCard
            icon="fa-solid fa-robot"
            label="Flota Sincronizada"
            value={estado.flota_robots?.length || 0}
            sublabel="robots activos en red"
            accentColor="#a855f7"
          />
        </div>
      )}

      {/* Temporal Simulation Panel */}
      <div className="bg-[#0d1116] border border-[#21262d] rounded-2xl p-5 shadow-2xl flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#ff4500]/20 text-[#ff4500] flex items-center justify-center">
              <i className="fa-solid fa-atom text-base" />
            </div>
            <div>
              <h2 className="text-sm font-bold font-mono text-white">
                Simulador Temporal de Ecosistema Micelial
              </h2>
              <span className="text-[0.65rem] text-gray-400 font-mono">
                Modela la colonización fúngica y supervivencia bajo condiciones terrestres y marcianas
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[0.65rem] text-gray-400 font-mono mr-1">Escenario:</span>
            <button
              onClick={() => presetSim('ideal')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono border transition-all ${
                simForm.tipo_condicion === 'ideal'
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : 'bg-white/5 text-gray-400 border-white/10'
              }`}
            >
              Condiciones Ideales
            </button>
            <button
              onClick={() => presetSim('extrema')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono border transition-all ${
                simForm.tipo_condicion === 'extrema'
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                  : 'bg-white/5 text-gray-400 border-white/10'
              }`}
            >
              Sequía Extrema
            </button>
            <button
              onClick={() => presetSim('marte')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono border transition-all ${
                simForm.tipo_condicion === 'marte'
                  ? 'bg-[#ff4500]/20 text-[#ff4500] border-[#ff4500]/40 font-bold'
                  : 'bg-white/5 text-gray-400 border-white/10'
              }`}
            >
              <i className="fa-solid fa-meteor mr-1 text-xs" />
              Planeta Marte
            </button>
          </div>
        </div>

        {/* Simulation Configuration Form */}
        <form onSubmit={handleEjecutarSimulacion} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-300 font-mono mb-1">Nombre de Simulación</label>
            <input
              type="text"
              required
              value={simForm.nombre}
              onChange={(e) => setSimForm({ ...simForm, nombre: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-black/60 border border-[#21262d] text-white text-xs font-mono outline-none focus:border-[#ff4500]"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-300 font-mono mb-1">Duración (Días)</label>
            <input
              type="number"
              min="5"
              max="180"
              required
              value={simForm.duracion_dias}
              onChange={(e) => setSimForm({ ...simForm, duracion_dias: Number(e.target.value) })}
              className="w-full px-3 py-2 rounded-xl bg-black/60 border border-[#21262d] text-white text-xs font-mono outline-none focus:border-[#ff4500]"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={simulating}
              className="w-full py-2 px-4 bg-[#ff4500] hover:bg-[#ff4500]/90 text-white font-bold text-xs font-mono rounded-xl shadow-lg shadow-[#ff4500]/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {simulating ? (
                <i className="fa-solid fa-spinner animate-spin" />
              ) : (
                <i className="fa-solid fa-play" />
              )}
              <span>Ejecutar Simulación</span>
            </button>
          </div>
        </form>

        {/* Simulation Results Visualization */}
        {activeSimulationResult?.resultados && (
          <div className="p-4 bg-black/50 border border-white/10 rounded-xl flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/10">
              <div>
                <span className="text-[0.65rem] uppercase tracking-wider text-[#ff4500] font-mono font-bold">
                  {activeSimulationResult.entorno === 'marte' ? 'MISIÓN MARTE — SIMULACIÓN CIENTÍFICA' : 'SIMULACIÓN TERRESTRE'}
                </span>
                <h3 className="text-base font-bold text-white font-mono">{activeSimulationResult.nombre}</h3>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono">
                  {activeSimulationResult.resultados.viabilidad_biologica}
                </span>
              </div>
            </div>

            {/* Environmental Conditions */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              <div className="p-2.5 bg-white/5 rounded-lg border border-white/5">
                <span className="text-[0.65rem] text-gray-400 block">Temperatura Simulada</span>
                <span className="font-bold text-white text-sm">
                  {activeSimulationResult.condiciones_ambientales?.temperatura_c ?? -55}°C
                </span>
              </div>
              <div className="p-2.5 bg-white/5 rounded-lg border border-white/5">
                <span className="text-[0.65rem] text-gray-400 block">Humedad del Sustrato</span>
                <span className="font-bold text-[#00e5ff] text-sm">
                  {activeSimulationResult.condiciones_ambientales?.humedad_suelo_pct ?? 8}%
                </span>
              </div>
              <div className="p-2.5 bg-white/5 rounded-lg border border-white/5">
                <span className="text-[0.65rem] text-gray-400 block">Supervivencia Final</span>
                <span className="font-bold text-emerald-400 text-sm">
                  {activeSimulationResult.resultados.tasa_supervivencia_final_pct}%
                </span>
              </div>
              <div className="p-2.5 bg-white/5 rounded-lg border border-white/5">
                <span className="text-[0.65rem] text-gray-400 block">Cobertura Fúngica Final</span>
                <span className="font-bold text-[#ff4500] text-sm">
                  {activeSimulationResult.resultados.cobertura_final_m2} m²
                </span>
              </div>
            </div>

            {/* Timeline Day-by-Day */}
            {activeSimulationResult.resultados.timeline && (
              <div>
                <span className="text-xs font-bold font-mono text-gray-300 block mb-2">
                  Línea Temporal de Crecimiento ({activeSimulationResult.duracion_dias || 30} días)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                  {activeSimulationResult.resultados.timeline.map((step) => (
                    <div
                      key={step.dia}
                      className="p-2.5 bg-black/60 rounded-xl border border-white/10 text-xs font-mono text-left"
                    >
                      <span className="text-[0.65rem] text-[#ff4500] font-bold block">
                        DÍA {step.dia}
                      </span>
                      <div className="my-1">
                        <div className="text-white font-bold">{step.cobertura_m2} m²</div>
                        <div className="text-[0.65rem] text-emerald-400">
                          {step.supervivencia_pct}% vivas
                        </div>
                      </div>
                      <span className="text-[0.55rem] text-gray-400 uppercase truncate block">
                        {step.estado_hifas?.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Historical Simulations Table */}
      <div className="bg-[#0d1116] border border-[#21262d] rounded-xl overflow-hidden shadow-xl">
        <div className="p-3.5 bg-black/30 border-b border-[#21262d] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-clock-rotate-left text-gray-400 text-xs" />
            <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              Historial de Simulaciones Registradas ({simulaciones.length})
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="bg-black/50 text-gray-400 border-b border-[#21262d] text-[0.65rem] uppercase">
                <th className="py-2.5 px-3">Nombre de Simulación</th>
                <th className="py-2.5 px-3">Entorno</th>
                <th className="py-2.5 px-3">Escenario</th>
                <th className="py-2.5 px-3">Duración</th>
                <th className="py-2.5 px-3">Cobertura Alcanzada</th>
                <th className="py-2.5 px-3">Estado</th>
                <th className="py-2.5 px-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#21262d]/60">
              {simulaciones.map((sim) => (
                <tr key={sim.id} className="hover:bg-white/5 transition-colors">
                  <td className="py-2.5 px-3 font-semibold text-white">{sim.nombre}</td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded text-[0.65rem] font-bold ${
                      sim.entorno === 'marte' ? 'bg-[#ff4500]/15 text-[#ff4500]' : 'bg-emerald-500/15 text-emerald-400'
                    }`}>
                      {sim.entorno?.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-gray-300 capitalize">{sim.tipo_condicion}</td>
                  <td className="py-2.5 px-3 text-gray-400">{sim.duracion_dias} días</td>
                  <td className="py-2.5 px-3 font-bold text-[#00e5ff]">{sim.cobertura_micelio_porcentaje}%</td>
                  <td className="py-2.5 px-3">
                    <span className="text-emerald-400 font-bold">Completada</span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() =>
                        setActiveSimulationResult({
                          nombre: sim.nombre,
                          entorno: sim.entorno,
                          tipo_condicion: sim.tipo_condicion,
                          condiciones_ambientales: sim.parametros || {},
                          resultados: sim.resultados || {},
                          duracion_dias: sim.duracion_dias,
                        })
                      }
                      className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 text-[0.65rem]"
                    >
                      Ver Timeline
                    </button>
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
