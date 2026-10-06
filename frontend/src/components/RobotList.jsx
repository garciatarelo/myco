import React, { useEffect, useMemo, useState } from 'react';
import { apiService } from '../services/api';

const EMPTY_EDIT_FORM = {
  id: null,
  nombre: '',
  estado: 'activo',
  latitud_marte: '',
  longitud_marte: '',
  bateria: 100,
  sensores_ir: '',
};

export function RobotList({ onCreateRobot = () => {}, onShowRoutes = () => {}, onShowRouteMap = () => {}, refreshToken = 0, batteryLevel = 85, failsafeStatus = 'NORMAL' }) {

  const [robots, setRobots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedRobotId, setExpandedRobotId] = useState(null);
  const [routesByRobot, setRoutesByRobot] = useState({});
  const [routesLoadingId, setRoutesLoadingId] = useState(null);
  const [routesError, setRoutesError] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);

  useEffect(() => {
    cargarRobots();
  }, [refreshToken]);

  useEffect(() => {
    if (editOpen) {
      setEditError('');
    }
  }, [editOpen]);

  async function cargarRobots() {
    try {
      setLoading(true);
      const data = await apiService.getRobots();
      setRobots(data);
    } catch (err) {
      setError('Error al cargar robots: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function toggleRoutes(robot) {
    if (expandedRobotId === robot.id) {
      setExpandedRobotId(null);
      return;
    }

    setRoutesError('');
    setRoutesLoadingId(robot.id);

    try {
      if (!routesByRobot[robot.id]) {
        const rutas = await apiService.getRutasRobot(robot.id);
        setRoutesByRobot((prev) => ({
          ...prev,
          [robot.id]: Array.isArray(rutas) ? rutas : [],
        }));
      }

      setExpandedRobotId(robot.id);
      onShowRoutes(robot);
    } catch (err) {
      setRoutesError(err instanceof Error ? err.message : 'No se pudieron cargar las rutas');
    } finally {
      setRoutesLoadingId(null);
    }
  }

  function openEdit(robot) {
    setEditForm({
      id: robot.id,
      nombre: robot.nombre || '',
      estado: robot.estado || 'activo',
      latitud_marte: robot.latitud_marte ?? '',
      longitud_marte: robot.longitud_marte ?? '',
      bateria: robot.bateria ?? 100,
      sensores_ir: robot.sensores_ir ? JSON.stringify(robot.sensores_ir, null, 2) : '',
    });
    setEditError('');
    setEditOpen(true);
  }

  async function submitEdit(e) {
    e.preventDefault();
    if (!editForm.id) return;

    setEditSaving(true);
    setEditError('');

    try {
      const payload = {
        nombre: editForm.nombre.trim(),
        estado: editForm.estado,
        latitud_marte: editForm.latitud_marte === '' ? null : Number(editForm.latitud_marte),
        longitud_marte: editForm.longitud_marte === '' ? null : Number(editForm.longitud_marte),
        bateria: Number(editForm.bateria),
      };

      if (editForm.sensores_ir.trim()) {
        payload.sensores_ir = JSON.parse(editForm.sensores_ir);
      }

      await apiService.actualizarRobot(editForm.id, payload);
      await cargarRobots();
      setEditOpen(false);
      setExpandedRobotId(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Error al actualizar robot');
    } finally {
      setEditSaving(false);
    }
  }

  const robotsConRutas = useMemo(() => {
    return robots.map((robot, idx) => {
      if (idx === 0) {
        return {
          ...robot,
          bateria: batteryLevel,
          estado: failsafeStatus === 'ACTIVE' ? 'mantenimiento' : 'activo',
        };
      }
      return robot;
    });
  }, [robots, batteryLevel, failsafeStatus]);

  function formatCoordinate(value) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue.toFixed(2) : '---';
  }

  function formatBattery(value) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : 0;
  }


  if (loading) return <div className="state-msg">Cargando robots...</div>;
  if (error) return <div className="state-msg error">{error}</div>;

  return (
    <div className="robot-list">
      <div className="section-title-row">
        <h2>Robots Sembradores</h2>
      </div>
      
      {robots.length === 0 ? (
        <p className="state-msg">No hay robots. Crea uno nuevo.</p>
      ) : (
        <div className="table-wrap">
          <table className="robot-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Estado</th>
                <th>Posición</th>
                <th>Batería</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {robotsConRutas.map((robot) => (
                <React.Fragment key={robot.id}>
                <tr>
                  <td>{robot.id}</td>
                  <td>{robot.nombre}</td>
                  <td>
                    <span
                      className={`status-pill ${
                        robot.estado === 'activo'
                          ? 'ok'
                          : robot.estado === 'inactivo'
                          ? 'off'
                          : 'warn'
                      }`}
                    >
                      {robot.estado}
                    </span>
                  </td>
                  <td>
                    {robot.latitud_marte != null && robot.longitud_marte != null
                      ? `${formatCoordinate(robot.latitud_marte)}, ${formatCoordinate(robot.longitud_marte)}`
                      : 'Sin ubicar'}
                  </td>
                  <td>
                    <div className="battery-track">
                      <div
                        className="battery-fill"
                        style={{ width: `${formatBattery(robot.bateria)}%` }}
                      />
                    </div>
                    <small>{formatBattery(robot.bateria)}%</small>
                  </td>
                  <td>
                    <button className="btn-soft small" type="button" onClick={() => onShowRoutes(robot)}>
                      Ver Rutas
                    </button>
                    <button className="btn-soft small ghost" type="button" onClick={() => openEdit(robot)}>
                      Editar
                    </button>
                  </td>
                </tr>
                {expandedRobotId === robot.id && (
                  <tr>
                    <td colSpan="6">
                      <div className="robot-routes-panel">
                        {routesLoadingId === robot.id ? (
                          <p className="state-msg">Cargando rutas...</p>
                        ) : routesError ? (
                          <p className="state-msg error">{routesError}</p>
                        ) : (
                          <>
                            <div className="robot-routes-header">
                              <strong>Rutas de {robot.nombre}</strong>
                              <button className="btn-soft small ghost" type="button" onClick={() => setExpandedRobotId(null)}>
                                Cerrar
                              </button>
                            </div>
                            {Array.isArray(routesByRobot[robot.id]) && routesByRobot[robot.id].length > 0 ? (
                              <div className="robot-routes-list">
                                {routesByRobot[robot.id].map((ruta) => (
                                  <div key={ruta.id} className="robot-route-card">
                                    <div className="robot-route-meta">
                                      <span>Ruta #{ruta.id}</span>
                                      <span className={`status-pill ${ruta.estado === 'completada' ? 'ok' : ruta.estado === 'en-progreso' ? 'warn' : 'off'}`}>
                                        {ruta.estado}
                                      </span>
                                    </div>
                                    <p>
                                      Puntos: {Array.isArray(ruta.puntos_json) ? ruta.puntos_json.length : 0} | Distancia: {formatCoordinate(ruta.distancia_total)} km | Tiempo: {formatCoordinate((Number(ruta.tiempo_estimado) || 0) / 3600)} h
                                    </p>
                                    <div className="robot-route-actions">
                                      <button className="btn-soft small" type="button" onClick={() => onShowRouteMap(robot)}>
                                        Ver en mapa
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="state-msg">Este robot todavía no tiene rutas guardadas.</p>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal panel">
            <h3>Editar Robot</h3>
            <form onSubmit={submitEdit} className="modal-form">
              <label>Nombre</label>
              <input
                value={editForm.nombre}
                onChange={(e) => setEditForm((prev) => ({ ...prev, nombre: e.target.value }))}
                required
              />

              <label>Estado</label>
              <select
                value={editForm.estado}
                onChange={(e) => setEditForm((prev) => ({ ...prev, estado: e.target.value }))}
              >
                <option value="activo">activo</option>
                <option value="inactivo">inactivo</option>
                <option value="mantenimiento">mantenimiento</option>
              </select>

              <div className="coords-row">
                <div>
                  <label>Latitud Marte</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={editForm.latitud_marte}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, latitud_marte: e.target.value }))}
                  />
                </div>
                <div>
                  <label>Longitud Marte</label>
                  <input
                    type="number"
                    step="0.000001"
                    value={editForm.longitud_marte}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, longitud_marte: e.target.value }))}
                  />
                </div>
              </div>

              <label>Batería</label>
              <input
                type="number"
                min="0"
                max="100"
                value={editForm.bateria}
                onChange={(e) => setEditForm((prev) => ({ ...prev, bateria: e.target.value }))}
              />

              <label>Sensores IR / JSON</label>
              <textarea
                rows="4"
                value={editForm.sensores_ir}
                onChange={(e) => setEditForm((prev) => ({ ...prev, sensores_ir: e.target.value }))}
                placeholder='{"humedad": 45, "toxicidad": 12}'
              />

              {editError && <p className="state-msg error">{editError}</p>}

              <div className="modal-actions">
                <button type="button" className="btn-ghost" onClick={() => setEditOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={editSaving}>
                  {editSaving ? 'Actualizando...' : 'Actualizar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
