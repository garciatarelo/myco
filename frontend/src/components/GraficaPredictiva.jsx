import React from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export function GraficaPredictiva({ arsenicLevel }) {
  const data = {
    labels: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6'],
    datasets: [
      {
        label: 'Micelio (%)',
        data: [10, 35, 60, 80, 95, 100],
        borderColor: '#5af7cf',
        backgroundColor: '#5af7cf',
        tension: 0.4,
        yAxisID: 'y',
      },
      {
        label: 'As (mg/kg)',
        data: [arsenicLevel, +(arsenicLevel * 0.8).toFixed(1), +(arsenicLevel * 0.5).toFixed(1), +(arsenicLevel * 0.2).toFixed(1), 15, 5],
        borderColor: '#ff7070',
        backgroundColor: '#ff7070',
        tension: 0.4,
        yAxisID: 'y1',
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { labels: { color: '#a0aec0', font: { size: 10 } } } },
    scales: {
      y: { type: 'linear', display: true, position: 'left', grid: { color: '#2a3a4e' }, ticks: { color: '#a0aec0', font: { size: 10 } } },
      y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false }, ticks: { color: '#a0aec0', font: { size: 10 } } },
      x: { grid: { color: '#2a3a4e' }, ticks: { color: '#a0aec0', font: { size: 10 } } }
    },
  };

  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--line)', borderRadius: '10px', padding: '12px', marginTop: '12px' }}>
      <h4 style={{ margin: '0 0 12px', fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase' }}>
        Proyección de Remediación (6 Meses)
      </h4>
      <div style={{ height: '200px', width: '100%' }}>
        <Line data={data} options={options} />
      </div>
    </div>
  );
}