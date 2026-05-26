import React, { useState } from 'react';

export function EnergyPanel() {
  const [solPico, setSolPico] = useState(5.8); // 5.8 HSP average in Chihuahua
  const [consumoDiario, setConsumoDiario] = useState(240); // Wh/dia of Rover

  const solarPanelWattage = Math.round((consumoDiario / solPico) * 1.35); // 1.35 is inefficiency factor
  const batteryLiCapacity = Math.round((consumoDiario * 2) / 12); // 2 days autonomy at 12V (Ah)

  return (
    <div className="energy-control-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Title block */}
      <div className="panel" style={{ padding: '20px', background: '#0d1116', borderColor: 'var(--line)' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#ff4500' }}>
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M6.34 17.66l2.83-2.83M14.83 9.17l2.83-2.83" />
            <circle cx="12" cy="12" r="4" />
          </svg>
          Estudio Energético y Balance de Carga Solar (M.Y.C.O. Power Grid)
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--muted)' }}>
          Cálculo dinámico de viabilidad fotovoltaica y conversión energética regional.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
        {/* Sizing Solar Panel Calculator */}
        <div className="sub-panel panel" style={{ padding: '20px', background: '#080a0e', borderColor: 'var(--line)', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem', textTransform: 'uppercase', color: 'var(--text)', letterSpacing: '0.5px' }}>
            Dimensionamiento Fotovoltaico (Chihuahua)
          </h3>

          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--muted)' }}>
            Ajusta los valores locales de radiación y consumo operativo del robot para calcular automáticamente la celda y batería de litio (LiFePO4) ideal.
          </p>

          {/* Slider HSP */}
          <div>
            <div style={{ display: 'flex', justifyBetween: 'space-between', fontSize: '0.8rem', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
              <span>Horas Solar Pico (HSP) Chihuahua:</span>
              <strong style={{ color: '#ffd24d' }}>{solPico} HSP (kWh/m²/día)</strong>
            </div>
            <input
              type="range"
              min="3.0"
              max="7.0"
              step="0.1"
              value={solPico}
              onChange={(e) => setSolPico(Number(e.target.value))}
              style={{ width: '100%', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>Promedio anual en Chihuahua: 5.8 HSP. Nivel de radiación solar óptimo.</span>
          </div>

          {/* Slider Wh Consumo */}
          <div>
            <div style={{ display: 'flex', justifyBetween: 'space-between', fontSize: '0.8rem', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
              <span>Consumo Diario de Telemetría & Motores:</span>
              <strong style={{ color: '#ffd24d' }}>{consumoDiario} Wh / día</strong>
            </div>
            <input
              type="range"
              min="100"
              max="800"
              step="10"
              value={consumoDiario}
              onChange={(e) => setConsumoDiario(Number(e.target.value))}
              style={{ width: '100%', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>Consumo total estimado para motores de 24V y sistema de inyección de micelio.</span>
          </div>

          {/* Calculated outputs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '10px' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', border: '1px solid rgba(255,90,0,0.1)', borderRadius: '8px', textAlign: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--muted)', display: 'block' }}>PANEL FOTOVOLTAICO REQUERIDO</span>
              <strong style={{ fontSize: '1.5rem', color: 'var(--accent)' }}>{solarPanelWattage} W</strong>
              <span style={{ fontSize: '0.6rem', color: 'var(--muted)', display: 'block', marginTop: '2px' }}>Silicio Monocristalino</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', border: '1px solid rgba(255,90,0,0.1)', borderRadius: '8px', textAlign: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--muted)', display: 'block' }}>CAPACIDAD BATERÍA (LiFePO4)</span>
              <strong style={{ fontSize: '1.5rem', color: '#5af7cf' }}>{batteryLiCapacity} Ah</strong>
              <span style={{ fontSize: '0.6rem', color: 'var(--muted)', display: 'block', marginTop: '2px' }}>Capacidad a 12V (2 Días)</span>
            </div>
          </div>
        </div>

        {/* Commercial Feasibility Comparison */}
        <div className="sub-panel panel" style={{ padding: '20px', background: '#080a0e', borderColor: 'var(--line)', display: 'flex', flexDirection: 'column', justifyBetween: 'space-between' }}>
          <h3 style={{ margin: '0 0 10px', fontSize: '0.95rem', textTransform: 'uppercase', color: 'var(--text)', letterSpacing: '0.5px' }}>
            Análisis de Viabilidad Financiera y Transición
          </h3>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', borderBottom: '1px solid var(--line)', paddingBottom: '6px', fontSize: '0.75rem', color: 'var(--muted)', fontWeight: '700' }}>
              <span>MÉTRICA</span>
              <span style={{ color: '#ff7070' }}>B. BETAVOLTÁICA</span>
              <span style={{ color: '#5af7cf' }}>H. SOLAR M.Y.C.O.</span>
            </div>

            {[
              { label: 'Costo Unitario ($USD)', b: '$45,000 USD', s: '$1,200 USD', highlights: 'Ahorro: 97.3%' },
              { label: 'Peso del Sistema (kg)', b: '15.0 kg', s: '11.0 kg (Híbrido)', highlights: '15% más ligero' },
              { label: 'Potencia Pico Generada', b: '5 Watts', s: '100 Watts', highlights: '20x más energía' },
              { label: 'Viabilidad de Refacciones', b: 'Nula (Nivel Militar)', s: 'Inmediata (Local)', highlights: 'Soporte Directo' },
              { label: 'Vida Útil Operativa', b: '20 Años', s: '10 Años (Ciclo Li)', highlights: 'Mantenimiento SaaS' },
            ].map((row, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', fontSize: '0.78rem', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                <span style={{ color: 'var(--muted)' }}>{row.label}</span>
                <span style={{ color: '#ff7070', fontWeight: '500' }}>{row.b}</span>
                <div>
                  <span style={{ color: '#5af7cf', fontWeight: '700', marginRight: '4px' }}>{row.s}</span>
                  {idx === 0 && <span style={{ fontSize: '0.6rem', padding: '1px 4px', borderRadius: '3px', background: 'rgba(74,235,183,0.1)', color: '#5af7cf' }}>{row.highlights}</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Entrepreneur verdict box */}
          <div style={{ marginTop: '15px', padding: '12px', background: 'rgba(74, 235, 183, 0.05)', border: '1px solid rgba(74, 235, 183, 0.2)', borderRadius: '8px' }}>
            <strong style={{ fontSize: '0.8rem', color: '#5af7cf', display: 'block' }}>VERDICTO FINANCIERO & RETORNO DE INVERSIÓN (ROI)</strong>
            <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--muted)', lineHeight: '1.4' }}>
              La batería betavoltáica anterior de $45,000 USD hacía que la remediación de suelos fuera comercialmente prohibitiva para cooperativas agrícolas pequeñas. La celda fotovoltaica híbrida y baterías LiFePO4 de M.Y.C.O. reducen la inversión inicial de energía en un 97.3%, permitiendo un modelo de suscripción SaaS sumamente accesible con un ROI estimado para agricultores de solo 4 meses.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
