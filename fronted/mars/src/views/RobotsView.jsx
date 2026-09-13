import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { RobotCard } from '../components/common/RobotCard';
import { MetricCard } from '../components/common/MetricCard';

export default function RobotsView() {
  const [robots, setRobots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterMode, setFilterMode] = useState('todos'); // 'todos', 'lectura', 'inyeccion'
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Modales
  const [optimizarModalOpen, setOptimizarModalOpen] = useState(false);
  const [selectedRobot, setSelectedRobot] = useState(null);
  const [puntosRuta, setPuntosRuta] = useState(15);
  const [humedadPromedio, setHumedadPromedio] = useState(65);
  const [optimizacionResult, setOptimizacionResult] = useState(null);

  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [robotConfig, setRobotConfig] = useState({
    velocidad_m_s: 0.5,
    intervalo_lectura_seg: 10,
    umbral_humedad_alerta: 20,
    profundidad_inyeccion_cm: 10,
  });

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newRobot, setNewRobot] = useState({
    nombre: '',
    modelo: 'Myco-v1 Pro',
    numero_serie: '',
    modo: 'lectura',
    latitud: 29.0732,
    longitud: -110.9555,
    wifi_ssid: 'Myco-Field-WiFi-5G',
    capacidad_capsulas: 30,
  });

  useEffect(() => {
    cargarRobots();
  }, []);

  async function cargarRobots() {
    setLoading(true);
    setError('');
    try {
      const data = await apiService.getRobots();
      setRobots(data);
    } catch (err) {
      setError('Error al cargar la flota de robots: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCambiarModo(robot, nuevoModo) {
    setActionLoading(true);
    setFeedback(null);
    try {
      await apiService.cambiarModoRobot(robot.id, nuevoModo);
      setFeedback({ type: 'success', text: `${robot.nombre} ahora opera en modo ${nuevoModo}` });
      await cargarRobots();
    } catch (err) {
      setFeedback({ type: 'error', text: 'Error al cambiar modo: ' + err.message });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleIrABase(robot) {
    setActionLoading(true);
    setFeedback(null);
    try {
      await apiService.irABaseRobot(robot.id);
      setFeedback({ type: 'success', text: `Orden emitida: ${robot.nombre} retornando a la estación base para recarga.` });
      await cargarRobots();
    } catch (err) {
      setFeedback({ type: 'error', text: 'Error al ordenar retorno a base: ' + err.message });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRecargar(robot) {
    setActionLoading(true);
    setFeedback(null);
    try {
      await apiService.recargarRobot(robot.id);
      setFeedback({ type: 'success', text: `${robot.nombre} ha recargado batería al 100% y reabastecido cápsulas.` });
      await cargarRobots();
    } catch (err) {
      setFeedback({ type: 'error', text: 'Error al recargar robot: ' + err.message });
    } finally {
      setActionLoading(false);
    }
  }

  function openOptimizar(robot) {
    setSelectedRobot(robot);
    setOptimizacionResult(null);
    setPuntosRuta(20);
    setHumedadPromedio(60);
    setOptimizarModalOpen(true);
  }

  async function calcularOptimizacionCarga() {
    if (!selectedRobot) return;
    try {
      const res = await apiService.optimizarCargaRobot(selectedRobot.id, {
        puntos_ruta: puntosRuta,
        humedad_promedio: humedadPromedio,
      });
      setOptimizacionResult(res);
    } catch (err) {
      alert('Error en optimización: ' + err.message);
    }
  }

  function openConfig(robot) {
    setSelectedRobot(robot);
    setRobotConfig(robot.configuracion || {
      velocidad_m_s: 0.5,
      intervalo_lectura_seg: 10,
      umbral_humedad_alerta: 20,
      profundidad_inyeccion_cm: 10,
    });
    setConfigModalOpen(true);
  }

  async function guardarConfiguracion() {
    if (!selectedRobot) return;
    try {
      await apiService.actualizarConfiguracionRobot(selectedRobot.id, {
        configuracion: robotConfig,
      });
      setConfigModalOpen(false);
      setFeedback({ type: 'success', text: 'Configuración actualizada desde el Gemelo Digital' });
      await cargarRobots();
    } catch (err) {
      alert('Error al guardar configuración: ' + err.message);
    }
  }

  async function handleCrearRobot(e) {
    e.preventDefault();
    try {
      await apiService.crearRobot(newRobot);
      setCreateModalOpen(false);
      setFeedback({ type: 'success', text: 'Nuevo robot Myco agregado a la flota' });
      setNewRobot({
        nombre: '',
        modelo: 'Myco-v1 Pro',
        numero_serie: '',
        modo: 'lectura',
        latitud: 29.0732,
        longitud: -110.9555,
        wifi_ssid: 'Myco-Field-WiFi-5G',
        capacidad_capsulas: 30,
      });
      await cargarRobots();
    } catch (err) {
      alert('Error al crear robot: ' + err.message);
    }
  }

  const robotsFiltrados = robots.filter((r) => {
    if (filterMode === 'todos') return true;
    return r.modo === filterMode;
  });

  const totalLectura = robots.filter((r) => r.modo === 'lectura').length;
  const totalInyeccion = robots.filter((r) => r.modo === 'inyeccion').length;
  const totalEnBase = robots.filter((r) => r.en_estacion_base).length;

  return (
    <div className="min-h-[calc(100vh-65px)] bg-[#131313] p-4 sm:p-6 max-w-7xl mx-auto flex flex-col gap-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#21262d]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold font-mono text-white tracking-wide">
              Flota de Robots Myco
            </h1>
            <span className="px-2 py-0.5 rounded text-[0.65rem] font-bold bg-[#ff4500]/20 text-[#ff4500] border border-[#ff4500]/30 font-mono">
              TELEMETRÍA EN VIVO
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Gestión de modos operativos (Lectura / Inyección), retorno a estación base, conectividad Wi-Fi y optimización de carga de cápsulas.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-[#ff4500] hover:bg-[#ff4500]/90 text-white font-bold text-xs font-mono flex items-center gap-2 shadow-lg shadow-[#ff4500]/20 transition-all"
          >
            <i className="fa-solid fa-plus text-xs" />
            <span>Agregar Robot</span>
          </button>
          <button
            onClick={cargarRobots}
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
          icon="fa-solid fa-robot"
          label="Total Flota"
          value={robots.length}
          sublabel="unidades registradas"
          accentColor="#00e5ff"
        />
        <MetricCard
          icon="fa-solid fa-magnifying-glass-chart"
          label="Modo Lectura"
          value={totalLectura}
          sublabel="muestreando suelo"
          accentColor="#38bdf8"
        />
        <MetricCard
          icon="fa-solid fa-syringe"
          label="Modo Inyección"
          value={totalInyeccion}
          sublabel="inoculando micelio"
          accentColor="#ff4500"
        />
        <MetricCard
          icon="fa-solid fa-charging-station"
          label="En Estación Base"
          value={totalEnBase}
          sublabel="recarga y descanso"
          accentColor="#eab308"
        />
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}
        >
          <div className="flex items-center gap-2">
            <i className={`fa-solid ${feedback.type === 'success' ? 'fa-check' : 'fa-circle-exclamation'}`} />
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="opacity-70 hover:opacity-100">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-3 bg-[#0d1116] border border-[#21262d] p-1.5 rounded-xl">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setFilterMode('todos')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
              filterMode === 'todos' ? 'bg-[#ff4500] text-white shadow' : 'text-gray-400 hover:text-white'
            }`}
          >
            Todos ({robots.length})
          </button>
          <button
            onClick={() => setFilterMode('lectura')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
              filterMode === 'lectura' ? 'bg-sky-500 text-white shadow' : 'text-gray-400 hover:text-white'
            }`}
          >
            <i className="fa-solid fa-magnifying-glass-chart mr-1.5 text-xs" />
            Modo Lectura ({totalLectura})
          </button>
          <button
            onClick={() => setFilterMode('inyeccion')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
              filterMode === 'inyeccion' ? 'bg-[#ff4500] text-white shadow' : 'text-gray-400 hover:text-white'
            }`}
          >
            <i className="fa-solid fa-syringe mr-1.5 text-xs" />
            Modo Inyección ({totalInyeccion})
          </button>
        </div>
      </div>

      {/* Robots Grid */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-2 border-[#ff4500] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-gray-400 font-mono">Cargando telemetría de robots...</span>
        </div>
      ) : robotsFiltrados.length === 0 ? (
        <div className="py-16 text-center bg-[#0d1116] border border-[#21262d] rounded-xl p-8">
          <i className="fa-solid fa-robot text-gray-600 text-3xl mb-2" />
          <p className="text-sm text-gray-400 font-mono">No hay robots con el filtro seleccionado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {robotsFiltrados.map((robot) => (
            <RobotCard
              key={robot.id}
              robot={robot}
              onCambiarModo={handleCambiarModo}
              onIrABase={handleIrABase}
              onRecargar={handleRecargar}
              onOptimizarCarga={openOptimizar}
              onConfigurar={openConfig}
              loading={actionLoading}
            />
          ))}
        </div>
      )}

      {/* Modal: Optimizar Carga de Cápsulas */}
      {optimizarModalOpen && selectedRobot && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0d1116] border border-[#21262d] rounded-2xl p-6 max-w-lg w-full shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-calculator text-[#ff4500]" />
                <h3 className="font-bold text-white font-mono text-sm">
                  Optimizar Carga de Cápsulas — {selectedRobot.nombre}
                </h3>
              </div>
              <button
                onClick={() => setOptimizarModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <p className="text-xs text-gray-400 mb-4">
              Determina con precisión cuántas cápsulas de cada grado (Mínimo, Medio, Alto) debe cargar el Myco antes de partir, evitando sobrepeso y ahorrando recursos.
            </p>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs text-gray-300 font-mono mb-1">
                  Puntos de la Ruta Planificada
                </label>
                <input
                  type="number"
                  min="2"
                  max="200"
                  value={puntosRuta}
                  onChange={(e) => setPuntosRuta(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-[#21262d] text-white text-xs font-mono outline-none focus:border-[#ff4500]"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-300 font-mono mb-1">
                  Humedad Promedio del Suelo (%)
                </label>
                <input
                  type="number"
                  min="5"
                  max="100"
                  value={humedadPromedio}
                  onChange={(e) => setHumedadPromedio(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-[#21262d] text-white text-xs font-mono outline-none focus:border-[#ff4500]"
                />
              </div>
            </div>

            <button
              onClick={calcularOptimizacionCarga}
              className="w-full py-2 bg-[#ff4500] hover:bg-[#ff4500]/90 text-white font-bold rounded-xl text-xs font-mono transition-colors mb-4"
            >
              Calcular Carga Óptima
            </button>

            {optimizacionResult && (
              <div className="p-4 bg-black/40 border border-[#ff4500]/30 rounded-xl flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-gray-400">Total Cápsulas Recomendadas:</span>
                  <span className="font-bold text-white text-sm">
                    {optimizacionResult.capsulas_recomendadas_total} / {optimizacionResult.capacidad_maxima}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                  <div className="bg-amber-500/10 border border-amber-500/20 p-2 rounded-lg">
                    <div className="text-amber-400 text-[0.65rem]">Mínimo</div>
                    <div className="text-base font-bold text-white">{optimizacionResult.distribucion.minimo}</div>
                  </div>
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-lg">
                    <div className="text-emerald-400 text-[0.65rem]">Medio</div>
                    <div className="text-base font-bold text-white">{optimizacionResult.distribucion.medio}</div>
                  </div>
                  <div className="bg-[#ff4500]/10 border border-[#ff4500]/20 p-2 rounded-lg">
                    <div className="text-[#ff4500] text-[0.65rem]">Alto</div>
                    <div className="text-base font-bold text-white">{optimizacionResult.distribucion.alto}</div>
                  </div>
                </div>

                <p className="text-xs text-emerald-400 font-mono bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/20">
                  <i className="fa-solid fa-leaf mr-1.5" />
                  {optimizacionResult.recomendacion}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Configuración Gemelo Digital */}
      {configModalOpen && selectedRobot && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0d1116] border border-[#21262d] rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h3 className="font-bold text-white font-mono text-sm">
                Configuración del Gemelo Digital — {selectedRobot.nombre}
              </h3>
              <button onClick={() => setConfigModalOpen(false)} className="text-gray-400 hover:text-white">
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div className="flex flex-col gap-3 mb-5">
              <div>
                <label className="block text-xs text-gray-300 font-mono mb-1">
                  Velocidad de Avance (m/s)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={robotConfig.velocidad_m_s || 0.5}
                  onChange={(e) => setRobotConfig({ ...robotConfig, velocidad_m_s: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-[#21262d] text-white text-xs font-mono outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-300 font-mono mb-1">
                  Intervalo de Muestreo de Sensores (segundos)
                </label>
                <input
                  type="number"
                  value={robotConfig.intervalo_lectura_seg || 10}
                  onChange={(e) => setRobotConfig({ ...robotConfig, intervalo_lectura_seg: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-[#21262d] text-white text-xs font-mono outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-300 font-mono mb-1">
                  Umbral Mínimo de Humedad para Inoculación (%)
                </label>
                <input
                  type="number"
                  value={robotConfig.umbral_humedad_alerta || 20}
                  onChange={(e) => setRobotConfig({ ...robotConfig, umbral_humedad_alerta: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-[#21262d] text-white text-xs font-mono outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-300 font-mono mb-1">
                  Profundidad de Inyección en Suelo (cm)
                </label>
                <input
                  type="number"
                  value={robotConfig.profundidad_inyeccion_cm || 10}
                  onChange={(e) => setRobotConfig({ ...robotConfig, profundidad_inyeccion_cm: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-[#21262d] text-white text-xs font-mono outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfigModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-mono"
              >
                Cancelar
              </button>
              <button
                onClick={guardarConfiguracion}
                className="px-4 py-2 rounded-xl bg-[#ff4500] hover:bg-[#ff4500]/90 text-white text-xs font-bold font-mono"
              >
                Sincronizar con Gemelo Digital
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Crear Robot */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleCrearRobot} className="bg-[#0d1116] border border-[#21262d] rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h3 className="font-bold text-white font-mono text-sm">
                Registrar Nuevo Robot Myco
              </h3>
              <button type="button" onClick={() => setCreateModalOpen(false)} className="text-gray-400 hover:text-white">
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div className="flex flex-col gap-3 mb-5">
              <div>
                <label className="block text-xs text-gray-300 font-mono mb-1">Nombre</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Myco-04"
                  value={newRobot.nombre}
                  onChange={(e) => setNewRobot({ ...newRobot, nombre: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-[#21262d] text-white text-xs font-mono outline-none focus:border-[#ff4500]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-300 font-mono mb-1">Modelo</label>
                  <input
                    type="text"
                    value={newRobot.modelo}
                    onChange={(e) => setNewRobot({ ...newRobot, modelo: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-[#21262d] text-white text-xs font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-300 font-mono mb-1">Modo Inicial</label>
                  <select
                    value={newRobot.modo}
                    onChange={(e) => setNewRobot({ ...newRobot, modo: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-[#21262d] text-white text-xs font-mono outline-none"
                  >
                    <option value="lectura">Modo Lectura</option>
                    <option value="inyeccion">Modo Inyección</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-300 font-mono mb-1">Latitud</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={newRobot.latitud}
                    onChange={(e) => setNewRobot({ ...newRobot, latitud: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-[#21262d] text-white text-xs font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-300 font-mono mb-1">Longitud</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={newRobot.longitud}
                    onChange={(e) => setNewRobot({ ...newRobot, longitud: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-[#21262d] text-white text-xs font-mono outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-300 font-mono mb-1">SSID de Red Wi-Fi</label>
                <input
                  type="text"
                  value={newRobot.wifi_ssid}
                  onChange={(e) => setNewRobot({ ...newRobot, wifi_ssid: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-[#21262d] text-white text-xs font-mono outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-mono"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#ff4500] hover:bg-[#ff4500]/90 text-white text-xs font-bold font-mono"
              >
                Guardar Robot
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
