import React, { useEffect, useState } from 'react';
import { apiService } from '../services/api';

export function GenerateRutaModal({ open, onClose, onGenerated }) {
  const [robots, setRobots] = useState([]);
  const [robotId, setRobotId] = useState('');
  const [startLat, setStartLat] = useState('');
  const [startLon, setStartLon] = useState('');
  const [endLat, setEndLat] = useState('');
  const [endLon, setEndLon] = useState('');
  const [samples, setSamples] = useState(30);
  const [error, setError] = useState('');

  function applyRobotPreset(robotValue) {
    setRobotId(robotValue);

    const robot = robots.find((item) => String(item.id) === String(robotValue));
    if (!robot) return;

    const startLatValue = Number(robot.latitud_marte);
    const startLonValue = Number(robot.longitud_marte);

    if (Number.isFinite(startLatValue) && Number.isFinite(startLonValue)) {
      setStartLat(startLatValue.toFixed(6));
      setStartLon(startLonValue.toFixed(6));
      setEndLat((startLatValue + 0.01).toFixed(6));
      setEndLon((startLonValue + 0.01).toFixed(6));
    }
  }

  useEffect(() => {
    if (!open) return;
    apiService.getRobots().then((data) => setRobots(Array.isArray(data) ? data : [])).catch(() => setRobots([]));
  }, [open]);

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      const payload = {
        robot_id: robotId,
        start: { lat: parseFloat(startLat), lon: parseFloat(startLon) },
        end: { lat: parseFloat(endLat), lon: parseFloat(endLon) },
        samples: Number(samples) || 20,
      };

      const ruta = await apiService.generateRuta(payload);
      onGenerated && onGenerated(ruta);
      onClose && onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar ruta');
    }
  }

  if (!open) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal panel">
        <h3>Generar Ruta</h3>
        <form onSubmit={submit}>
          <label>Robot</label>
          <select value={robotId} onChange={(e) => applyRobotPreset(e.target.value)} required>
            <option value="">-- seleccionar --</option>
            {robots.map((r) => (
              <option key={r.id} value={r.id}>{r.nombre}</option>
            ))}
          </select>

          <label>Inicio (lat, lon)</label>
          <div className="coords-row">
            <div className="coord-scale-group">
              <small>Latitud</small>
              <input type="range" min="-90" max="90" step="0.001" value={startLat} onChange={(e) => setStartLat(e.target.value)} />
              <input value={startLat} onChange={(e) => setStartLat(e.target.value)} placeholder="lat" required />
            </div>
            <div className="coord-scale-group">
              <small>Longitud</small>
              <input type="range" min="-180" max="180" step="0.001" value={startLon} onChange={(e) => setStartLon(e.target.value)} />
              <input value={startLon} onChange={(e) => setStartLon(e.target.value)} placeholder="lon" required />
            </div>
          </div>

          <label>Fin (lat, lon)</label>
          <div className="coords-row">
            <div className="coord-scale-group">
              <small>Latitud</small>
              <input type="range" min="-90" max="90" step="0.001" value={endLat} onChange={(e) => setEndLat(e.target.value)} />
              <input value={endLat} onChange={(e) => setEndLat(e.target.value)} placeholder="lat" required />
            </div>
            <div className="coord-scale-group">
              <small>Longitud</small>
              <input type="range" min="-180" max="180" step="0.001" value={endLon} onChange={(e) => setEndLon(e.target.value)} placeholder="lon" required />
              <input value={endLon} onChange={(e) => setEndLon(e.target.value)} placeholder="lon" required />
            </div>
          </div>

          <label>Muestras</label>
          <input type="number" value={samples} onChange={(e) => setSamples(e.target.value)} min="2" max="500" />

          {error && <p className="state-msg error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary">Generar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
