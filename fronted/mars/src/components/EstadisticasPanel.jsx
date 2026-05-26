import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { GraficaPredictiva } from './GraficaPredictiva';

export function EstadisticasPanel({ selectedRouteId, arsenicLevel = 38.4, batteryLevel = 85, activeMap = 'mars', area = 500 }) {
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
      
      const mockData = {
          total_siembras: 120,
          crecimiento_promedio: 45,
          siembras_maduras: 12,
          toxicidad_promedio: 60
      };
      
      let data = mockData;
      try {
         data = await apiService.getEstadisticasBiopolimeros(selectedRouteId);
      } catch(apiErr) {
          console.warn(apiErr.message);
      }
      setStats(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const isNOMViolated = activeMap === 'earth' && arsenicLevel > 22;
  const excesoArsenico = arsenicLevel > 22 ? arsenicLevel - 22 : 0;
  const capsulasRequeridas = isNOMViolated ? Math.ceil((area / 10) + (excesoArsenico * 2)) : 0;

  if (loading) {
    return <div className="state-msg">Cargando estadísticas...</div>;
  }

  if (error) {
    return <div className="state-msg error">Error: {error}</div>;
  }

  if (!stats) {
    return <div className="state-msg">Sin datos todavía.</div>;
  }

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
          <h4>Crecimiento</h4>
          <p>{stats.crecimiento_promedio}%</p>
        </div>
        <div className="stat-card">
          <h4>Maduras</h4>
          <p>{stats.siembras_maduras}</p>
        </div>
        <div className="stat-card">
          <h4>Toxicidad</h4>
          <p style={{ color: displayToxicidad > 40 ? '#ff7070' : 'var(--accent)' }}>
            {displayToxicidad}%
          </p>
        </div>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--line)', borderRadius: '10px', padding: '12px' }}>
        <h4 style={{ margin: '0 0 8px', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Auditoría Ambiental</span>
          <span style={{ fontSize: '0.65rem', background: '#21262d', padding: '2px 6px', borderRadius: '4px', color: 'var(--text)' }}>
            NOM-147-SEMARNAT
          </span>
        </h4>

        {activeMap === 'earth' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text)' }}>Área Detectada:</span>
              <strong style={{ fontSize: '0.85rem', color: '#5af7cf' }}>{area} m²</strong>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text)' }}>Concentración As:</span>
              <strong style={{ fontSize: '0.85rem', color: isNOMViolated ? '#ff7070' : '#5af7cf' }}>
                {arsenicLevel.toFixed(1)} mg/kg
              </strong>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '6px', background: isNOMViolated ? 'rgba(255, 112, 112, 0.1)' : 'rgba(74, 235, 183, 0.1)', border: `1px solid ${isNOMViolated ? 'rgba(255, 112, 112, 0.3)' : 'rgba(74, 235, 183, 0.3)'}` }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '800', color: isNOMViolated ? '#ff7070' : '#5af7cf' }}>{isNOMViolated ? 'ALERTA' : 'OK'}</span>
              <div>
                <strong style={{ fontSize: '0.75rem', color: isNOMViolated ? '#ff7070' : '#5af7cf', display: 'block' }}>
                  {isNOMViolated ? 'INCUMPLE LÍMITE' : 'SUELO SEGURO'}
                </strong>
                <span style={{ fontSize: '0.6rem', color: 'var(--muted)', display: 'block' }}>
                  {isNOMViolated ? `Exceso de ${excesoArsenico.toFixed(1)} mg/kg.` : 'Niveles seguros.'}
                </span>
              </div>
            </div>

             {isNOMViolated && (
                <>
                  <div style={{ background: '#21262d', padding: '10px', borderRadius: '6px', marginTop: '4px' }}>
                      <span style={{ fontSize: '0.70rem', color: 'var(--text)', display: 'block', marginBottom: '4px' }}>
                          Resultado M.Y.C.O:
                      </span>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--accent)', display: 'block' }}>
                          {capsulasRequeridas} Cápsulas Requeridas
                      </strong>
                  </div>
                  <GraficaPredictiva arsenicLevel={arsenicLevel} />
                </>
            )}
          </div>
        ) : (
          <div style={{ fontSize: '0.7rem', color: 'var(--muted)', textAlign: 'center', padding: '10px 0' }}>
            Modo Marte activo. La norma aplica en Chihuahua.
          </div>
        )}
      </div>
    </div>
  );
}