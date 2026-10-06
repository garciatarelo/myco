import React from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export function GraficaProgresoSuelo({ soilProgressHistory = [] }) {
  const latest = soilProgressHistory[soilProgressHistory.length - 1];
  const previous = soilProgressHistory[soilProgressHistory.length - 2];
  const delta = latest && previous ? latest.fertilityScore - previous.fertilityScore : 0;
  const isReady = latest ? latest.fertilityScore >= 70 : false;
  const statusLabel = latest
    ? (latest.fertilityScore >= 70 ? 'Apto para sembrar' : latest.fertilityScore >= 50 ? 'En recuperación' : 'Aún no apto')
    : 'Sin lecturas';

  const data = {
    labels: soilProgressHistory.map((_, index) => `A${index + 1}`),
    datasets: [
      {
        label: 'Índice de fertilidad',
        data: soilProgressHistory.map((entry) => entry.fertilityScore),
        borderColor: '#5af7cf',
        backgroundColor: 'rgba(90, 247, 207, 0.18)',
        tension: 0.35,
        fill: true,
        pointRadius: 4,
        pointHoverRadius: 5,
      },
      {
        label: 'Umbral para sembrar',
        data: soilProgressHistory.map(() => 70),
        borderColor: '#ff8a2b',
        borderDash: [6, 6],
        borderWidth: 1.5,
        pointRadius: 0,
        fill: false,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        labels: {
          color: '#a0aec0',
          font: { size: 10 },
          usePointStyle: true,
        },
      },
      tooltip: {
        callbacks: {
          afterLabel(context) {
            if (context.dataset.label !== 'Índice de fertilidad') return '';
            return latest ? `Estado actual: ${statusLabel}` : '';
          },
        },
      },
    },
    scales: {
      y: {
        min: 0,
        max: 100,
        grid: { color: '#2a3a4e' },
        ticks: { color: '#a0aec0', font: { size: 10 } },
      },
      x: {
        grid: { color: '#2a3a4e' },
        ticks: { color: '#a0aec0', font: { size: 10 } },
      },
    },
  };

  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--line)', borderRadius: '10px', padding: '12px', marginTop: '12px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'10px', marginBottom:'10px' }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase' }}>
            Evolución del suelo
          </h4>
          <div style={{ fontSize: '0.62rem', color: 'var(--muted)', marginTop: '3px' }}>
            Seguimiento por análisis para ver si el terreno mejora y ya puede sembrarse.
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1rem', fontWeight: 800, color: isReady ? '#5af7cf' : '#ff8a2b' }}>
            {latest ? `${latest.fertilityScore}%` : '—'}
          </div>
          <div style={{ fontSize: '0.62rem', color: latest ? (isReady ? '#5af7cf' : '#ff8a2b') : 'var(--muted)' }}>
            {statusLabel}{latest && delta !== 0 ? ` (${delta > 0 ? '+' : ''}${delta} pts)` : ''}
          </div>
        </div>
      </div>

      <div style={{ fontSize: '0.62rem', color: 'var(--muted)', lineHeight: 1.5, marginBottom: '10px' }}>
        {latest
          ? `Última lectura: pH ${latest.phLevel.toFixed(1)} | Arsénico ${latest.arsenicLevel} mg/kg | Área ${latest.area.toLocaleString()} m²`
          : 'Aún no hay lecturas de análisis para este terreno.'}
      </div>

      <div style={{ height: '210px', width: '100%' }}>
        {soilProgressHistory.length > 0 ? (
          <Line data={data} options={options} />
        ) : (
          <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--muted)', fontSize: '0.72rem', textAlign: 'center', padding: '18px' }}>
            Ejecuta un análisis para ver la evolución de este terreno.
          </div>
        )}
      </div>
    </div>
  );
}