import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { MetricCard } from '../components/common/MetricCard';

export default function TerrenosView() {
  const navigate = useNavigate();
  const [terrenos, setTerrenos] = useState([]);
  const [estaciones, setEstaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showMissionModal, setShowMissionModal] = useState(false);
  const [terrenoToDelete, setTerrenoToDelete] = useState(null);
  const [deletingTerreno, setDeletingTerreno] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setLoading(true);
    setError('');
    try {
      const [resTerrenos, resEstaciones] = await Promise.all([
        apiService.getTerrenos(),
        apiService.getEstacionesBase(),
      ]);
      setTerrenos(Array.isArray(resTerrenos) ? resTerrenos : []);
      setEstaciones(Array.isArray(resEstaciones) ? resEstaciones : []);
    } catch (err) {
      setError('Error al cargar terrenos y estaciones: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function confirmarEliminarTerreno() {
    if (!terrenoToDelete) return;
    setDeletingTerreno(true);
    try {
      await apiService.eliminarTerreno(terrenoToDelete.id);
      setTerrenos((prev) => prev.filter((t) => t.id !== terrenoToDelete.id));
      setTerrenoToDelete(null);
    } catch (err) {
      setError('Error al eliminar el terreno: ' + err.message);
    } finally {
      setDeletingTerreno(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-65px)] bg-[#131313] p-4 sm:p-6 max-w-7xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#262626]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold font-mono text-white tracking-wide">
              Terrenos & Parcelas de Operación
            </h1>
            <span className="px-2 py-0.5 rounded text-[0.65rem] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono">
              PRODUCCIÓN M.Y.C.O
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Sectores georreferenciados en la Tierra y en Marte. Selecciona una parcela para entrar a su centro de misión y mapa.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowMissionModal(true)}
            className="px-3.5 py-2 rounded-xl bg-[#ff4500] hover:bg-[#ff4500]/90 text-white font-bold text-xs font-mono flex items-center gap-2 shadow-lg shadow-[#ff4500]/20 transition-all cursor-pointer"
          >
            <i className="fa-solid fa-draw-polygon text-xs" />
            <span>Nuevo Terreno (Trazar Mapa)</span>
          </button>
          <button
            onClick={cargarDatos}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 text-xs transition-colors"
          >
            <i className={`fa-solid fa-arrows-rotate ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label="Total Parcelas"
          value={terrenos.length}
          sublabel="Sectores georreferenciados"
          icon="fa-solid fa-map"
          accentColor="#ffffff"
        />
        <MetricCard
          label="Estaciones Base"
          value={estaciones.length}
          sublabel="Muelles de recarga activos"
          icon="fa-solid fa-charging-station"
          accentColor="#f59e0b"
        />
        <MetricCard
          label="Parcelas Tierra"
          value={terrenos.filter((t) => t.entorno === 'tierra').length}
          sublabel="Suelo agrícola"
          icon="fa-solid fa-earth-americas"
          accentColor="#10b981"
        />
        <MetricCard
          label="Parcelas Marte"
          value={terrenos.filter((t) => t.entorno === 'marte').length}
          sublabel="Cráter Jezero & Regolito"
          icon="fa-solid fa-meteor"
          accentColor="#ff4500"
        />
      </div>

      {/* Alerta de Error */}
      {error && (
        <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2 font-mono">
          <i className="fa-solid fa-circle-exclamation text-sm shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Terrenos Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {terrenos.map((t) => {
          const isMarte = t.entorno === 'marte';
          const estacionesDelTerreno = estaciones.filter((e) => e.terreno_id === t.id);

          return (
            <div
              key={t.id}
              className={`bg-[#181818] border ${
                isMarte ? 'border-[#ff4500]/40' : 'border-emerald-500/40'
              } rounded-2xl p-5 flex flex-col justify-between gap-4 shadow-xl hover:border-opacity-80 transition-all`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase font-mono border ${
                      isMarte
                        ? 'bg-[#ff4500]/15 text-[#ff4500] border-[#ff4500]/30'
                        : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    }`}
                  >
                    <i className={`fa-solid ${isMarte ? 'fa-meteor' : 'fa-earth-americas'} mr-1`} />
                    {isMarte ? 'Planeta Marte' : 'Planeta Tierra'}
                  </span>
                  <span className="text-xs text-gray-400 font-mono">Sector #{t.id}</span>
                </div>

                <h3 className="font-bold text-white text-base font-mono mb-1">{t.nombre}</h3>
                <p className="text-xs text-gray-400 leading-relaxed mb-3">{t.descripcion}</p>

                {/* Details */}
                <div className="grid grid-cols-2 gap-2 text-xs font-mono p-3 bg-black/40 rounded-xl border border-white/5">
                  <div>
                    <span className="text-gray-400 block text-[0.65rem]">Dimensiones:</span>
                    <span className="text-white font-bold">{Number(t.dimensiones_m2).toLocaleString()} m²</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[0.65rem]">Red Wi-Fi:</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <i className="fa-solid fa-wifi text-[0.65rem]" />
                      <span className="truncate">{t.red_wifi_ssid || 'No configurada'}</span>
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[0.65rem]">Latitud Central:</span>
                    <span className="text-gray-200">{t.latitud_central}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[0.65rem]">Longitud Central:</span>
                    <span className="text-gray-200">{t.longitud_central}</span>
                  </div>
                </div>
              </div>

              {/* Estaciones Base */}
              <div className="pt-2 border-t border-white/5">
                <span className="text-xs font-bold font-mono text-gray-300 block mb-1.5">
                  <i className="fa-solid fa-charging-station mr-1.5 text-amber-400" />
                  Estaciones Base ({estacionesDelTerreno.length})
                </span>

                {estacionesDelTerreno.length === 0 ? (
                  <p className="text-[0.7rem] text-gray-500 font-mono">Sin estaciones en este sector</p>
                ) : (
                  <div className="flex flex-wrap gap-2 text-[0.65rem] font-mono">
                    {estacionesDelTerreno.map((e) => (
                      <span key={e.id} className="px-2 py-1 bg-black/40 border border-white/10 rounded-lg text-gray-300">
                        {e.nombre} (Stock: {e.stock_capsulas_minimo + e.stock_capsulas_medio + e.stock_capsulas_alto})
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Acciones: Abrir Misión & Eliminar Terreno */}
              <div className="pt-3 border-t border-white/10 flex items-center gap-2">
                <button
                  onClick={() => navigate(`/mision/${t.id}`)}
                  className="flex-1 py-2.5 rounded-xl bg-[#ff4500] hover:bg-[#ff4500]/90 text-white font-mono font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#ff4500]/20 transition-all cursor-pointer"
                >
                  <i className="fa-solid fa-satellite-dish text-xs" />
                  <span>Abrir Misión & Mapa</span>
                </button>
                <button
                  onClick={() => setTerrenoToDelete(t)}
                  title="Eliminar este terreno y todos sus datos"
                  className="p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/30 transition-all cursor-pointer flex items-center justify-center shrink-0"
                >
                  <i className="fa-solid fa-trash-can text-sm" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Selector de Entorno de Misión (Tierra vs Marte) */}
      {showMissionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#161616] border border-[#2b2b2b] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl shadow-black/80 font-mono">
            {/* Cabecera del Modal */}
            <div className="p-5 border-b border-[#262626] flex items-center justify-between bg-gradient-to-r from-black/80 via-[#1a1a1a] to-black/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#ff4500]">
                  <i className="fa-solid fa-compass-drafting text-lg" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white tracking-wide">
                    Seleccionar Entorno de Operación
                  </h2>
                  <p className="text-xs text-gray-400">
                    ¿Dónde se llevará a cabo la misión de delimitación y biorremediación?
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowMissionModal(false)}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <i className="fa-solid fa-xmark text-sm" />
              </button>
            </div>

            {/* Contenido / Opciones */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#111111]">
              {/* Opción 1: Planeta Tierra */}
              <div
                onClick={() => {
                  setShowMissionModal(false);
                  navigate('/terrenos/crear');
                }}
                className="group relative bg-[#181818] hover:bg-[#1f2621] border border-emerald-500/30 hover:border-emerald-500 rounded-2xl p-5 cursor-pointer transition-all duration-300 flex flex-col justify-between hover:shadow-xl hover:shadow-emerald-500/10 hover:-translate-y-1"
              >
                <div className="absolute top-3 right-3">
                  <span className="px-2 py-0.5 rounded text-[0.62rem] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase">
                    Terrestre
                  </span>
                </div>

                <div>
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-2xl mb-4 group-hover:scale-110 group-hover:bg-emerald-500/20 transition-all shadow-lg shadow-emerald-500/10">
                    <i className="fa-solid fa-earth-americas" />
                  </div>
                  <h3 className="text-lg font-bold text-white group-hover:text-emerald-300 transition-colors">
                    Planeta Tierra
                  </h3>
                  <p className="text-xs text-emerald-400 font-bold mt-0.5 mb-2">
                    Suelos Agrícolas & Industriales
                  </p>
                  <p className="text-[0.72rem] text-gray-400 leading-relaxed">
                    Cartografía HD satelital con Mapbox, cálculo de condiciones SoilGrids 250m, pH, fertilidad y delimitación poligonal con estaciones base.
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-white/5 flex items-center justify-between text-xs text-emerald-400 font-bold group-hover:translate-x-1 transition-transform">
                  <span>Trazar en la Tierra</span>
                  <i className="fa-solid fa-arrow-right" />
                </div>
              </div>

              {/* Opción 2: Planeta Marte */}
              <div
                onClick={() => {
                  setShowMissionModal(false);
                  navigate('/terrenos/crear-marte');
                }}
                className="group relative bg-[#181818] hover:bg-[#281c18] border border-[#ff4500]/30 hover:border-[#ff4500] rounded-2xl p-5 cursor-pointer transition-all duration-300 flex flex-col justify-between hover:shadow-xl hover:shadow-[#ff4500]/10 hover:-translate-y-1"
              >
                <div className="absolute top-3 right-3">
                  <span className="px-2 py-0.5 rounded text-[0.62rem] font-bold bg-[#ff4500]/15 text-[#ff4500] border border-[#ff4500]/30 uppercase">
                    NASA Mars Trek
                  </span>
                </div>

                <div>
                  <div className="w-14 h-14 rounded-2xl bg-[#ff4500]/10 border border-[#ff4500]/30 flex items-center justify-center text-[#ff4500] text-2xl mb-4 group-hover:scale-110 group-hover:bg-[#ff4500]/20 transition-all shadow-lg shadow-[#ff4500]/10">
                    <i className="fa-solid fa-meteor" />
                  </div>
                  <h3 className="text-lg font-bold text-white group-hover:text-orange-300 transition-colors">
                    Planeta Marte
                  </h3>
                  <p className="text-xs text-[#ff4500] font-bold mt-0.5 mb-2">
                    Cráteres & Regolito Marciano
                  </p>
                  <p className="text-[0.72rem] text-gray-400 leading-relaxed">
                    Visor orbital embebido de NASA Mars Trek, selección de parcelas marcianas, asignación de rovers M.Y.C.O y descarga de DEMs / teselas WMTS.
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-white/5 flex items-center justify-between text-xs text-[#ff4500] font-bold group-hover:translate-x-1 transition-transform">
                  <span>Trazar en Marte</span>
                  <i className="fa-solid fa-arrow-right" />
                </div>
              </div>
            </div>

            {/* Footer Modal */}
            <div className="p-3.5 bg-black/80 border-t border-[#262626] flex items-center justify-between text-xs text-gray-400">
              <span className="text-[0.68rem] flex items-center gap-1.5">
                <i className="fa-solid fa-circle-info text-sky-400" />
                Cada entorno adapta los algoritmos de biorremediación y las capas cartográficas.
              </span>
              <button
                type="button"
                onClick={() => setShowMissionModal(false)}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-xs transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación para Eliminar Terreno */}
      {terrenoToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#161616] border border-red-500/40 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl shadow-red-950/50 font-mono">
            {/* Header del Modal */}
            <div className="p-5 border-b border-[#262626] flex items-center justify-between bg-gradient-to-r from-red-950/40 via-[#1a1a1a] to-black/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
                  <i className="fa-solid fa-triangle-exclamation text-lg" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white tracking-wide">
                    Eliminar Terreno & Parcela
                  </h2>
                  <p className="text-[0.7rem] text-red-400">
                    Acción destructiva e irreversible
                  </p>
                </div>
              </div>
              <button
                disabled={deletingTerreno}
                onClick={() => setTerrenoToDelete(null)}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors disabled:opacity-50 cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-sm" />
              </button>
            </div>

            {/* Contenido / Advertencia */}
            <div className="p-6 space-y-4 bg-[#111111] text-xs">
              <p className="text-gray-300 leading-relaxed">
                ¿Estás completamente seguro de que deseas eliminar permanentemente el terreno{' '}
                <strong className="text-white font-bold bg-white/10 px-2 py-0.5 rounded border border-white/10">
                  {terrenoToDelete.nombre}
                </strong>{' '}
                (Sector #{terrenoToDelete.id})?
              </p>

              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 space-y-2 text-[0.72rem] text-gray-300">
                <div className="font-bold text-red-400 flex items-center gap-1.5">
                  <i className="fa-solid fa-fire text-xs" />
                  <span>Se eliminarán todos los datos vinculados:</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-gray-400">
                  <li>Polígono georreferenciado y mapa de elevación DEM.</li>
                  <li>Historial de mediciones de suelo (pH, humedad, reflectancia).</li>
                  <li>Registros de inyecciones de cápsulas de biopolímero.</li>
                  <li>Simulaciones y gemelos digitales ejecutados en este sector.</li>
                  <li>Los robots y estaciones base asignados quedarán liberados.</li>
                </ul>
              </div>
            </div>

            {/* Footer / Acciones */}
            <div className="p-4 bg-black/80 border-t border-[#262626] flex items-center justify-end gap-3 text-xs">
              <button
                type="button"
                disabled={deletingTerreno}
                onClick={() => setTerrenoToDelete(null)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-bold border border-white/10 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingTerreno}
                onClick={confirmarEliminarTerreno}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold flex items-center gap-2 shadow-lg shadow-red-600/30 transition-all disabled:opacity-50 cursor-pointer"
              >
                {deletingTerreno ? (
                  <>
                    <i className="fa-solid fa-spinner animate-spin text-xs" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-trash-can text-xs" />
                    <span>Sí, Eliminar Todo</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

