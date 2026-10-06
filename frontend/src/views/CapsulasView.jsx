import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { CapsuleBadge } from '../components/common/CapsuleBadge';
import { MetricCard } from '../components/common/MetricCard';

export default function CapsulasView() {
  const [capsulas, setCapsulas] = useState([]);
  const [inventario, setInventario] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modales
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedCapsula, setSelectedCapsula] = useState(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formCapsula, setFormCapsula] = useState({
    nombre: '',
    grado: 'alto',
    cantidad_micorrizas: 25000,
    tipo_hongo: 'Rhizophagus irregularis + Glomus',
    humedad_suelo_optima_min: 65,
    humedad_suelo_optima_max: 95,
    radio_expansion_estimado_m: 3.5,
    costo_recurso: 4.0,
    descripcion: '',
  });

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setLoading(true);
    setError('');
    try {
      const [resCapsulas, resInventario] = await Promise.all([
        apiService.getCapsulas(),
        apiService.getInventarioCapsulas(),
      ]);
      setCapsulas(resCapsulas || []);
      setInventario(resInventario || null);
    } catch (err) {
      setError('Error al cargar datos de cápsulas: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  function openEdit(capsula) {
    setSelectedCapsula(capsula);
    setFormCapsula({
      nombre: capsula.nombre,
      grado: capsula.grado,
      cantidad_micorrizas: capsula.cantidad_micorrizas,
      tipo_hongo: capsula.tipo_hongo || '',
      humedad_suelo_optima_min: capsula.humedad_suelo_optima_min || 20,
      humedad_suelo_optima_max: capsula.humedad_suelo_optima_max || 90,
      radio_expansion_estimado_m: capsula.radio_expansion_estimado_m || 2.0,
      costo_recurso: capsula.costo_recurso || 1.0,
      descripcion: capsula.descripcion || '',
    });
    setEditModalOpen(true);
  }

  async function handleGuardarEdicion(e) {
    e.preventDefault();
    if (!selectedCapsula) return;
    setSaving(true);
    try {
      await apiService.actualizarCapsula(selectedCapsula.id, formCapsula);
      setEditModalOpen(false);
      await cargarDatos();
    } catch (err) {
      alert('Error al actualizar cápsula: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCrearCapsula(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiService.crearCapsula(formCapsula);
      setCreateModalOpen(false);
      await cargarDatos();
    } catch (err) {
      alert('Error al crear cápsula: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-65px)] bg-[#131313] p-4 sm:p-6 max-w-7xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#21262d]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold font-mono text-white tracking-wide">
              Cápsulas de Micorrizas
            </h1>
            <span className="px-2 py-0.5 rounded text-[0.65rem] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30 font-mono">
              INOCULANTES BIOLÓGICOS
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Catálogo de cápsulas clasificadas en <strong>Grado Mínimo, Medio y Alto</strong> según la cantidad de micorrizas que contienen (UFC/g).
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setFormCapsula({
                nombre: '',
                grado: 'alto',
                cantidad_micorrizas: 25000,
                tipo_hongo: 'Rhizophagus irregularis',
                humedad_suelo_optima_min: 60,
                humedad_suelo_optima_max: 95,
                radio_expansion_estimado_m: 3.5,
                costo_recurso: 3.5,
                descripcion: '',
              });
              setCreateModalOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-[#ff4500] hover:bg-[#ff4500]/90 text-white font-bold text-xs font-mono flex items-center gap-2 shadow-lg shadow-[#ff4500]/20 transition-all"
          >
            <i className="fa-solid fa-plus text-xs" />
            <span>Nueva Cápsula</span>
          </button>
          <button
            onClick={cargarDatos}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 text-xs transition-colors"
          >
            <i className={`fa-solid fa-arrows-rotate ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Inventory KPIs */}
      {inventario && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard
            icon="fa-solid fa-boxes-stacked"
            label="Stock Total Sistema"
            value={inventario.total_sistema.total}
            sublabel="cápsulas disponibles"
            accentColor="#a855f7"
          />
          <MetricCard
            icon="fa-solid fa-robot"
            label="En Flota de Robots"
            value={inventario.en_robots.total}
            sublabel={`Min: ${inventario.en_robots.minimo} | Med: ${inventario.en_robots.medio} | Alt: ${inventario.en_robots.alto}`}
            accentColor="#ff4500"
          />
          <MetricCard
            icon="fa-solid fa-warehouse"
            label="En Estaciones Base"
            value={inventario.en_estaciones_base.total}
            sublabel="reserva en muelles"
            accentColor="#10b981"
          />
          <MetricCard
            icon="fa-solid fa-dna"
            label="Grado Alto Total"
            value={inventario.total_sistema.alto}
            sublabel="máxima concentración micelar"
            accentColor="#00e5ff"
          />
        </div>
      )}

      {/* Capsules Catalog Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {capsulas.map((c) => {
          const isHigh = c.grado === 'alto';
          const isMed = c.grado === 'medio';
          const accentBorder = isHigh
            ? 'border-[#ff4500]/40'
            : isMed
            ? 'border-emerald-500/40'
            : 'border-amber-500/40';

          return (
            <div
              key={c.id}
              className={`bg-[#0d1116] border ${accentBorder} rounded-2xl p-5 flex flex-col justify-between gap-4 shadow-xl transition-transform hover:-translate-y-1`}
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <CapsuleBadge grado={c.grado} micorrizas={c.cantidad_micorrizas} />
                  <span className="text-[0.65rem] font-mono text-gray-400">ID #{c.id}</span>
                </div>

                <h3 className="font-bold text-white text-base font-mono tracking-wide mt-1">
                  {c.nombre}
                </h3>
                <p className="text-xs text-gray-400 leading-relaxed min-h-[48px]">
                  {c.descripcion || 'Sin descripción'}
                </p>
              </div>

              {/* Specs */}
              <div className="p-3 bg-black/40 rounded-xl border border-white/5 flex flex-col gap-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-gray-400">Concentración:</span>
                  <span className="text-white font-bold">{Number(c.cantidad_micorrizas).toLocaleString()} UFC/g</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Cepa Fúngica:</span>
                  <span className="text-gray-200 truncate max-w-[150px]">{c.tipo_hongo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Humedad Óptima:</span>
                  <span className="text-emerald-400">{c.humedad_suelo_optima_min}% - {c.humedad_suelo_optima_max}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Radio Expansión:</span>
                  <span className="text-[#00e5ff]">~{c.radio_expansion_estimado_m} metros</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Costo / Recurso:</span>
                  <span className="text-amber-400">{c.costo_recurso}x factor</span>
                </div>
              </div>

              <button
                onClick={() => openEdit(c)}
                className="w-full py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl border border-white/10 text-xs font-mono font-medium flex items-center justify-center gap-1.5 transition-colors"
              >
                <i className="fa-solid fa-sliders text-xs" />
                <span>Configurar en Gemelo Digital</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Modal: Editar Cápsula */}
      {editModalOpen && selectedCapsula && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleGuardarEdicion}
            className="bg-[#0d1116] border border-[#21262d] rounded-2xl p-6 max-w-md w-full shadow-2xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h3 className="font-bold text-white font-mono text-sm">
                Configurar Cápsula — {selectedCapsula.nombre}
              </h3>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div className="flex flex-col gap-3 mb-5">
              <div>
                <label className="block text-xs text-gray-300 font-mono mb-1">Nombre</label>
                <input
                  type="text"
                  required
                  value={formCapsula.nombre}
                  onChange={(e) => setFormCapsula({ ...formCapsula, nombre: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-[#21262d] text-white text-xs font-mono outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-300 font-mono mb-1">Grado</label>
                  <select
                    value={formCapsula.grado}
                    onChange={(e) => setFormCapsula({ ...formCapsula, grado: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-[#21262d] text-white text-xs font-mono outline-none"
                  >
                    <option value="minimo">Mínimo</option>
                    <option value="medio">Medio</option>
                    <option value="alto">Alto</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-300 font-mono mb-1">Micorrizas (UFC/g)</label>
                  <input
                    type="number"
                    required
                    value={formCapsula.cantidad_micorrizas}
                    onChange={(e) => setFormCapsula({ ...formCapsula, cantidad_micorrizas: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-[#21262d] text-white text-xs font-mono outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-300 font-mono mb-1">Radio Expansión (m)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formCapsula.radio_expansion_estimado_m}
                    onChange={(e) => setFormCapsula({ ...formCapsula, radio_expansion_estimado_m: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-[#21262d] text-white text-xs font-mono outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-300 font-mono mb-1">Costo Recurso</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formCapsula.costo_recurso}
                    onChange={(e) => setFormCapsula({ ...formCapsula, costo_recurso: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-[#21262d] text-white text-xs font-mono outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-300 font-mono mb-1">Descripción</label>
                <textarea
                  rows="2"
                  value={formCapsula.descripcion}
                  onChange={(e) => setFormCapsula({ ...formCapsula, descripcion: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-[#21262d] text-white text-xs font-mono outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-mono"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-[#ff4500] hover:bg-[#ff4500]/90 text-white text-xs font-bold font-mono flex items-center gap-2"
              >
                {saving && <i className="fa-solid fa-spinner animate-spin" />}
                <span>Guardar Cambios</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Crear Cápsula */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCrearCapsula}
            className="bg-[#0d1116] border border-[#21262d] rounded-2xl p-6 max-w-md w-full shadow-2xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h3 className="font-bold text-white font-mono text-sm">
                Crear Nueva Variedad de Cápsula
              </h3>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div className="flex flex-col gap-3 mb-5">
              <div>
                <label className="block text-xs text-gray-300 font-mono mb-1">Nombre</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. HyperSpore Ares-v2"
                  value={formCapsula.nombre}
                  onChange={(e) => setFormCapsula({ ...formCapsula, nombre: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-[#21262d] text-white text-xs font-mono outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-300 font-mono mb-1">Grado</label>
                  <select
                    value={formCapsula.grado}
                    onChange={(e) => setFormCapsula({ ...formCapsula, grado: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-[#21262d] text-white text-xs font-mono outline-none"
                  >
                    <option value="minimo">Mínimo</option>
                    <option value="medio">Medio</option>
                    <option value="alto">Alto</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-300 font-mono mb-1">Micorrizas (UFC/g)</label>
                  <input
                    type="number"
                    required
                    value={formCapsula.cantidad_micorrizas}
                    onChange={(e) => setFormCapsula({ ...formCapsula, cantidad_micorrizas: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-[#21262d] text-white text-xs font-mono outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-300 font-mono mb-1">Cepa Fúngica</label>
                <input
                  type="text"
                  value={formCapsula.tipo_hongo}
                  onChange={(e) => setFormCapsula({ ...formCapsula, tipo_hongo: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-[#21262d] text-white text-xs font-mono outline-none"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-300 font-mono mb-1">Descripción</label>
                <textarea
                  rows="2"
                  value={formCapsula.descripcion}
                  onChange={(e) => setFormCapsula({ ...formCapsula, descripcion: e.target.value })}
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
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-[#ff4500] hover:bg-[#ff4500]/90 text-white text-xs font-bold font-mono flex items-center gap-2"
              >
                {saving && <i className="fa-solid fa-spinner animate-spin" />}
                <span>Crear Cápsula</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
