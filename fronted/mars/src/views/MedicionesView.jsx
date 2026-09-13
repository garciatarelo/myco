import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { MetricCard } from '../components/common/MetricCard';
import { CapsuleBadge } from '../components/common/CapsuleBadge';

export default function MedicionesView() {
  const [mediciones, setMediciones] = useState([]);
  const [robots, setRobots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterOptimas, setFilterOptimas] = useState(false);

  // Form nueva medición
  const [modalOpen, setModalOpen] = useState(false);
  const [newMedicion, setNewMedicion] = useState({
    robot_id: '',
    latitud: 29.0735,
    longitud: -110.9551,
    ph: 6.8,
    temperatura: 22.0,
    humedad: 75.0,
  });
  const [saving, setSaving] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState(null);

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setLoading(true);
    setError('');
    try {
      const [resMed, resRobots] = await Promise.all([
        apiService.getMediciones({ per_page: 40 }),
        apiService.getRobots(),
      ]);

      const lista = resMed.data || resMed;
      setMediciones(Array.isArray(lista) ? lista : []);
      setRobots(resRobots || []);

      if (resRobots?.length > 0 && !newMedicion.robot_id) {
        setNewMedicion((prev) => ({ ...prev, robot_id: resRobots[0].id }));
      }
    } catch (err) {
      setError('Error al cargar mediciones: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCrearMedicion(e) {
    e.preventDefault();
    setSaving(true);
    setLastAnalysis(null);
    try {
      const res = await apiService.crearMedicion(newMedicion);
      setLastAnalysis(res.analisis_optimizacion);
      await cargarDatos();
    } catch (err) {
      alert('Error al registrar medición: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  // Cálculos de promedios
  const avgPh = mediciones.length > 0
    ? (mediciones.reduce((acc, m) => acc + Number(m.ph), 0) / mediciones.length).toFixed(2)
    : '6.80';

  const avgTemp = mediciones.length > 0
    ? (mediciones.reduce((acc, m) => acc + Number(m.temperatura), 0) / mediciones.length).toFixed(1)
    : '21.5';

  const avgHum = mediciones.length > 0
    ? (mediciones.reduce((acc, m) => acc + Number(m.humedad), 0) / mediciones.length).toFixed(1)
    : '55.0';

  const optimasCount = mediciones.filter((m) => m.es_optimo_inyeccion).length;

  const medicionesFiltradas = filterOptimas
    ? mediciones.filter((m) => m.es_optimo_inyeccion)
    : mediciones;

  return (
    <div className="min-h-[calc(100vh-65px)] bg-[#131313] p-4 sm:p-6 max-w-7xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#21262d]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold font-mono text-white tracking-wide">
              Mediciones del Suelo — Modo Lectura
            </h1>
            <span className="px-2 py-0.5 rounded text-[0.65rem] font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30 font-mono">
              SENSORES IN-SITU
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Los robots Myco en <strong>Modo Lectura</strong> muestrean pH, temperatura y humedad del suelo para alimentar el algoritmo de optimización de micorrizas.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-500/90 text-white font-bold text-xs font-mono flex items-center gap-2 shadow-lg shadow-sky-500/20 transition-all"
          >
            <i className="fa-solid fa-plus text-xs" />
            <span>Simular Muestreo</span>
          </button>
          <button
            onClick={cargarDatos}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 text-xs transition-colors"
            title="Recargar datos"
          >
            <i className={`fa-solid fa-arrows-rotate ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          icon="fa-solid fa-droplet"
          label="Humedad Promedio"
          value={`${avgHum}%`}
          sublabel="del terreno muestreado"
          accentColor="#00e5ff"
        />
        <MetricCard
          icon="fa-solid fa-flask-vial"
          label="pH Promedio"
          value={avgPh}
          sublabel="rango óptimo (5.5 - 7.5)"
          accentColor="#10b981"
        />
        <MetricCard
          icon="fa-solid fa-temperature-half"
          label="Temperatura Suelo"
          value={`${avgTemp}°C`}
          sublabel="temperatura media térmica"
          accentColor="#f59e0b"
        />
        <MetricCard
          icon="fa-solid fa-circle-check"
          label="Puntos Óptimos"
          value={optimasCount}
          sublabel={`de ${mediciones.length} muestras analizadas`}
          accentColor="#ff4500"
        />
      </div>

      {/* Sensor Grid Map / Visualizer */}
      <div className="bg-[#0d1116] border border-[#21262d] rounded-xl p-4 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-chart-area text-sky-400" />
            <h3 className="text-sm font-bold font-mono text-white">
              Mapa Térmico de Humedad y Puntos de Muestreo
            </h3>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff4500]" />
              <span>Alta Humedad (Óptimo Alto)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span>Media (40-65%)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span>Baja / Árido</span>
            </span>
          </div>
        </div>

        {/* Visual Matrix */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 p-3 bg-black/40 rounded-xl border border-white/5 min-h-[140px]">
          {mediciones.slice(0, 24).map((m, idx) => {
            const humColor =
              m.humedad >= 65
                ? 'border-[#ff4500] bg-[#ff4500]/15 text-[#ff4500]'
                : m.humedad >= 40
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                : 'border-amber-500/40 bg-amber-500/10 text-amber-400';

            return (
              <div
                key={m.id || idx}
                className={`p-2 rounded-lg border text-left flex flex-col justify-between transition-transform hover:scale-105 ${humColor}`}
                title={`Coordenadas: ${m.latitud}, ${m.longitud} | Hum: ${m.humedad}% | pH: ${m.ph}`}
              >
                <div className="flex items-center justify-between text-[0.6rem] font-mono">
                  <span className="opacity-80">#{m.id || idx + 1}</span>
                  {m.es_optimo_inyeccion && (
                    <i className="fa-solid fa-sparkles text-[0.6rem]" title="Punto óptimo para inyección" />
                  )}
                </div>
                <div className="my-1">
                  <span className="text-sm font-bold font-mono block">{m.humedad}%</span>
                  <span className="text-[0.6rem] font-mono opacity-75">pH {m.ph}</span>
                </div>
                <div className="text-[0.55rem] font-mono uppercase truncate opacity-90">
                  {m.grado_sugerido !== 'ninguno' ? `Grado ${m.grado_sugerido}` : 'Omitir'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter and Table */}
      <div className="bg-[#0d1116] border border-[#21262d] rounded-xl overflow-hidden shadow-xl">
        <div className="p-3.5 bg-black/30 border-b border-[#21262d] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-list-check text-gray-400 text-xs" />
            <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              Historial de Lecturas ({medicionesFiltradas.length})
            </span>
          </div>

          <label className="flex items-center gap-2 text-xs font-mono text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={filterOptimas}
              onChange={(e) => setFilterOptimas(e.target.checked)}
              className="rounded bg-black border-[#21262d] text-[#ff4500] focus:ring-0"
            />
            <span>Mostrar solo puntos óptimos para inyección</span>
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="bg-black/50 text-gray-400 border-b border-[#21262d] text-[0.65rem] uppercase">
                <th className="py-2.5 px-3">Robot Muestreador</th>
                <th className="py-2.5 px-3">Coordenadas</th>
                <th className="py-2.5 px-3">Humedad Suelo</th>
                <th className="py-2.5 px-3">pH</th>
                <th className="py-2.5 px-3">Temperatura</th>
                <th className="py-2.5 px-3">Evaluación Algoritmo</th>
                <th className="py-2.5 px-3">Cápsula Sugerida</th>
                <th className="py-2.5 px-3 text-right">Fecha Muestreo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#21262d]/60">
              {medicionesFiltradas.map((m) => (
                <tr key={m.id} className="hover:bg-white/5 transition-colors">
                  <td className="py-2.5 px-3 font-semibold text-white">
                    {m.robot?.nombre || `Robot #${m.robot_id}`}
                  </td>
                  <td className="py-2.5 px-3 text-gray-400 text-[0.7rem]">
                    {Number(m.latitud).toFixed(5)}, {Number(m.longitud).toFixed(5)}
                  </td>
                  <td className="py-2.5 px-3 font-bold text-white">
                    <span
                      className={`px-1.5 py-0.5 rounded ${
                        m.humedad >= 65 ? 'text-[#ff4500] bg-[#ff4500]/10' : 'text-emerald-400 bg-emerald-500/10'
                      }`}
                    >
                      {m.humedad}%
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-gray-200">{m.ph}</td>
                  <td className="py-2.5 px-3 text-gray-200">{m.temperatura}°C</td>
                  <td className="py-2.5 px-3">
                    {m.es_optimo_inyeccion ? (
                      <span className="inline-flex items-center gap-1 text-[0.65rem] text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                        <i className="fa-solid fa-check text-[0.55rem]" /> Óptimo para Inyección
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[0.65rem] text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
                        <i className="fa-solid fa-ban text-[0.55rem]" /> Suelo Árido (Ahorro)
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    {m.grado_sugerido && m.grado_sugerido !== 'ninguno' ? (
                      <CapsuleBadge grado={m.grado_sugerido} />
                    ) : (
                      <span className="text-gray-500 text-[0.7rem]">—</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right text-gray-400 text-[0.65rem]">
                    {new Date(m.fecha_medicion || m.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Simular Muestreo con Robot */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCrearMedicion}
            className="bg-[#0d1116] border border-[#21262d] rounded-2xl p-6 max-w-md w-full shadow-2xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-vial text-sky-400" />
                <h3 className="font-bold text-white font-mono text-sm">
                  Simular Muestreo en Modo Lectura
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  setLastAnalysis(null);
                }}
                className="text-gray-400 hover:text-white"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div className="flex flex-col gap-3 mb-4">
              <div>
                <label className="block text-xs text-gray-300 font-mono mb-1">
                  Robot en Modo Lectura
                </label>
                <select
                  value={newMedicion.robot_id}
                  onChange={(e) => setNewMedicion({ ...newMedicion, robot_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-[#21262d] text-white text-xs font-mono outline-none"
                  required
                >
                  {robots.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nombre} ({r.modo})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-300 font-mono mb-1">Humedad Suelo (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    required
                    value={newMedicion.humedad}
                    onChange={(e) => setNewMedicion({ ...newMedicion, humedad: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-[#21262d] text-white text-xs font-mono outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-300 font-mono mb-1">pH Suelo</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="14"
                    required
                    value={newMedicion.ph}
                    onChange={(e) => setNewMedicion({ ...newMedicion, ph: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-[#21262d] text-white text-xs font-mono outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-300 font-mono mb-1">Temperatura (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={newMedicion.temperatura}
                    onChange={(e) => setNewMedicion({ ...newMedicion, temperatura: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-[#21262d] text-white text-xs font-mono outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-300 font-mono mb-1">Latitud</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={newMedicion.latitud}
                    onChange={(e) => setNewMedicion({ ...newMedicion, latitud: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-[#21262d] text-white text-xs font-mono outline-none"
                  />
                </div>
              </div>
            </div>

            {lastAnalysis && (
              <div className="mb-4 p-3 bg-sky-500/10 border border-sky-500/30 rounded-xl text-xs font-mono flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Recomendación:</span>
                  <CapsuleBadge grado={lastAnalysis.grado_recomendado} />
                </div>
                <p className="text-sky-300 text-[0.7rem]">{lastAnalysis.justificacion}</p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  setLastAnalysis(null);
                }}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-mono"
              >
                Cerrar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-500/90 text-white text-xs font-bold font-mono flex items-center gap-2"
              >
                {saving && <i className="fa-solid fa-spinner animate-spin" />}
                <span>Enviar Medición</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
