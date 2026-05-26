import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';

export function EstadisticasPanel({ selectedRouteId, arsenicLevel = 38.4, batteryLevel = 85, activeMap = 'mars' }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    cargarEstadisticas();
    const interval = setInterval(cargarEstadisticas, 30000);
    return () => clearInterval(interval);
  }, [selectedRouteId]);

  async function cargarEstadisticas() {
    try {
      setLoading(true);
      setError('');
      const data = await apiService.getEstadisticasBiopolimeros(selectedRouteId);
      setStats(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      console.error('Error cargando estadísticas:', err);
    } finally {
      setLoading(false);
    }
  }

  const isNOMViolated = activeMap === 'earth' && arsenicLevel > 22;

  if (loading) {
    return <div className="state-msg">Cargando estadísticas...</div>;
  }

  if (error) {
    return <div className="state-msg error">Error de estadísticas: {error}</div>;
  }

  if (!stats) {
    return <div className="state-msg">Sin datos todavía.</div>;
  }

  // Calculate dynamic toxic percentage based on arsenic slider for Chihuahua map
  const displayToxicidad = activeMap === 'earth' 
    ? Math.min(100, Math.round((arsenicLevel / 60) * 100)) 
    : Math.round(stats.toxicidad_promedio);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div className="stats-grid">
        <div className="stat-card">
          <h4>Total de Siembras</h4>
          <p>{stats.total_siembras}</p>
        </div>

        <div className="stat-card">
          <h4>Crecimiento Promedio</h4>
          <p>{stats.crecimiento_promedio}%</p>
        </div>

        <div className="stat-card">
          <h4>Siembras Maduras</h4>
          <p>{stats.siembras_maduras}</p>
        </div>

        <div className="stat-card">
          <h4>Toxicidad Promedio</h4>
          <p style={{ color: displayToxicidad > 40 ? '#ff7070' : 'var(--accent)' }}>
            {displayToxicidad}%
          </p>
        </div>
      </div>

      {/* --- NUEVO: AUDITORÍA DE NORMA OFICIAL PARA JUECES --- */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--line)', borderRadius: '10px', padding: '12px' }}>
        <h4 style={{ margin: '0 0 8px', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Auditoría Ambiental: Chihuahua</span>
          <span style={{ fontSize: '0.65rem', background: '#21262d', padding: '2px 6px', borderRadius: '4px', color: 'var(--text)' }}>
            NOM-147-SEMARNAT
          </span>
        </h4>

        {activeMap === 'earth' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text)' }}>Concentración de Arsénico (As):</span>
              <strong style={{ fontSize: '0.85rem', color: isNOMViolated ? '#ff7070' : '#5af7cf' }}>
                {arsenicLevel.toFixed(1)} mg/kg
              </strong>
            </div>

            {/* Compliance Badge */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 10px',
              borderRadius: '6px',
              background: isNOMViolated ? 'rgba(255, 112, 112, 0.1)' : 'rgba(74, 235, 183, 0.1)',
              border: `1px solid ${isNOMViolated ? 'rgba(255, 112, 112, 0.3)' : 'rgba(74, 235, 183, 0.3)'}`,
            }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '800', color: isNOMViolated ? '#ff7070' : '#5af7cf' }}>{isNOMViolated ? 'ALERTA' : 'OK'}</span>
              <div>
                <strong style={{ fontSize: '0.75rem', color: isNOMViolated ? '#ff7070' : '#5af7cf', display: 'block' }}>
                  {isNOMViolated ? 'INCUMPLE LÍMITE PERMITIDO' : 'SUELO BAJO EL LÍMITE'}
                </strong>
                <span style={{ fontSize: '0.6rem', color: 'var(--muted)', display: 'block' }}>
                  {isNOMViolated 
                    ? `Exceso de ${(arsenicLevel - 22).toFixed(1)} mg/kg. Densidad de micelio aumentada.` 
                    : 'Concentración segura de metales pesados en tierras agrícolas.'}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: '0.7rem', color: 'var(--muted)', textAlign: 'center', padding: '10px 0' }}>
            🛸 Modo Marte activo. La norma mexicana NOM-147 aplica únicamente para el entorno piloto de Chihuahua.
          </div>
        )}
      </div>
    </div>
  );
}
