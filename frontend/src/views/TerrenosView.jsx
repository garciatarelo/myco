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
            onClick={() => navigate('/terrenos/crear')}
            className="px-3.5 py-2 rounded-xl bg-[#ff4500] hover:bg-[#ff4500]/90 text-white font-bold text-xs font-mono flex items-center gap-2 shadow-lg shadow-[#ff4500]/20 transition-all"
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

              {/* Botón Primario: Abrir Misión & Mapa */}
              <div className="pt-3 border-t border-white/10">
                <button
                  onClick={() => navigate(`/mision/${t.id}`)}
                  className="w-full py-2.5 rounded-xl bg-[#ff4500] hover:bg-[#ff4500]/90 text-white font-mono font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#ff4500]/20 transition-all"
                >
                  <i className="fa-solid fa-satellite-dish text-xs" />
                  <span>Abrir Misión & Mapa de este Terreno</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

