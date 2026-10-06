import React, { useState } from 'react';
import { apiService } from '../services/api';

const INITIAL_FORM = {
  nombre: '',
  estado: 'activo',
  latitud_marte: '',
  longitud_marte: '',
  bateria: 100,
};

export function CreateRobotModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  async function submit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const payload = {
        nombre: form.nombre.trim(),
        estado: form.estado,
        latitud_marte: form.latitud_marte === '' ? null : Number(form.latitud_marte),
        longitud_marte: form.longitud_marte === '' ? null : Number(form.longitud_marte),
        bateria: Number(form.bateria),
      };

      const robot = await apiService.crearRobot(payload);
      onCreated && onCreated(robot);
      setForm(INITIAL_FORM);
      onClose && onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear robot');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal panel">
        <h3>Crear Robot</h3>
        <form onSubmit={submit} className="modal-form">
          <label>Nombre</label>
          <input
            value={form.nombre}
            onChange={(e) => setForm((prev) => ({ ...prev, nombre: e.target.value }))}
            placeholder="R-01"
            required
          />

          <label>Estado</label>
          <select
            value={form.estado}
            onChange={(e) => setForm((prev) => ({ ...prev, estado: e.target.value }))}
          >
            <option value="activo">activo</option>
            <option value="inactivo">inactivo</option>
            <option value="mantenimiento">mantenimiento</option>
          </select>

          <label>Latitud Marte</label>
          <input
            type="number"
            step="0.000001"
            value={form.latitud_marte}
            onChange={(e) => setForm((prev) => ({ ...prev, latitud_marte: e.target.value }))}
            placeholder="-4.600000"
          />

          <label>Longitud Marte</label>
          <input
            type="number"
            step="0.000001"
            value={form.longitud_marte}
            onChange={(e) => setForm((prev) => ({ ...prev, longitud_marte: e.target.value }))}
            placeholder="137.400000"
          />

          <label>Batería</label>
          <input
            type="number"
            min="0"
            max="100"
            value={form.bateria}
            onChange={(e) => setForm((prev) => ({ ...prev, bateria: e.target.value }))}
          />

          {error && <p className="state-msg error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
