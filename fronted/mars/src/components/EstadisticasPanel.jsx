import React from 'react';
import { GraficaPredictiva } from './GraficaPredictiva';
import { GraficaProgresoSuelo } from './GraficaProgresoSuelo';

export function EstadisticasPanel({ arsenicLevel, area, soilProgressHistory = [] }) {
  const MAX_ARSENICO_NOM147 = 22;
  const baseCapsules = Math.max(1, Math.ceil(area / 10));
  const arsenicExcess = Math.max(0, arsenicLevel - MAX_ARSENICO_NOM147);
  const remediationFactor = 1 + (arsenicExcess / MAX_ARSENICO_NOM147) * 0.5;
  const totalCapsules = Math.max(1, Math.ceil(baseCapsules * remediationFactor));

  const card = {
    background: 'rgba(255,255,255,0.025)',
    border: '1px solid var(--line)',
    borderRadius: '8px',
    padding: '10px 12px',
  };
  const lbl = {
    fontSize: '0.58rem',
    color: 'var(--muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    display: 'block',
    marginBottom: '3px',
  };

  const esToxico = arsenicLevel > MAX_ARSENICO_NOM147;
  const toxColor = esToxico ? '#ff7070' : '#5af7cf';

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
      <div style={{ ...card, display:'flex', flexDirection:'column', gap:'8px' }}>
        <span style={lbl}>Auditoría Ambiental (NOM-147)</span>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', alignItems:'center' }}>
          <div>
            <span style={{ ...lbl, marginBottom:'1px' }}>Área del Terreno</span>
            <strong style={{ fontSize:'1.4rem', color:'#fff' }}>
              {area.toLocaleString()} <span style={{ fontSize:'0.7rem', color:'var(--muted)' }}>m²</span>
            </strong>
          </div>
          <div>
            <span style={{ ...lbl, marginBottom:'1px' }}>Cápsulas Requeridas</span>
            <strong style={{ fontSize:'1.4rem', color:'#5af7cf' }}>
              {totalCapsules.toLocaleString()} <span style={{ fontSize:'0.7rem', color:'var(--muted)' }}>uds</span>
            </strong>
          </div>
        </div>

        <div style={{ fontSize:'0.62rem', color:'var(--muted)', lineHeight:1.5 }}>
          Base por terreno: {baseCapsules} | Exceso As: {arsenicExcess.toFixed(1)} mg/kg sobre {MAX_ARSENICO_NOM147}
        </div>

        <div style={{ marginTop:'8px' }}>
          <span style={{ ...lbl, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span>Toxicidad Promedio (As)</span>
            <strong style={{ color: toxColor, textTransform:'none', letterSpacing:0 }}>
              {arsenicLevel} mg/kg {esToxico ? '(⚠️ ALTO)' : '(SEGURO)'}
            </strong>
          </span>
          <div style={{ height:'6px', borderRadius:'999px', background:'rgba(255,255,255,0.05)', position:'relative', overflow:'hidden', marginTop:'4px' }}>
            <div style={{ position:'absolute', left:'22%', top:0, bottom:0, width:'2px', background:'#fff', opacity:0.3, zIndex:2 }} />
            <div style={{ width:`${arsenicLevel}%`, height:'100%', background:toxColor, transition:'width 0.3s' }} />
          </div>
            <span style={{ fontSize:'0.5rem', color:'var(--muted)', marginTop:'2px', display:'block' }}>Límite NOM: {MAX_ARSENICO_NOM147} mg/kg (Línea blanca)</span>
        </div>

        <div style={{ marginTop:'5px' }}>
          <GraficaPredictiva arsenicLevel={arsenicLevel} />
        </div>

        <div style={{ marginTop:'5px' }}>
          <GraficaProgresoSuelo soilProgressHistory={soilProgressHistory} />
        </div>
      </div>
    </div>
  );
}