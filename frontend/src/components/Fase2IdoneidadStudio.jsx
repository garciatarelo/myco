import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

/* ─── FUNCIONES DE COLORMAP PARA GRADIENTES Y MAPAS DE CALOR ─── */
function colormapInferno(val) {
  const v = Math.max(0, Math.min(1, val));
  if (v < 0.33) {
    const t = v / 0.33;
    return [Math.round(15 + 75 * t), Math.round(5 + 15 * t), Math.round(40 + 100 * t)];
  } else if (v < 0.66) {
    const t = (v - 0.33) / 0.33;
    return [Math.round(90 + 145 * t), Math.round(20 + 80 * t), Math.round(140 - 100 * t)];
  } else {
    const t = (v - 0.66) / 0.34;
    return [Math.round(235 + 20 * t), Math.round(100 + 155 * t), Math.round(40 + 160 * t)];
  }
}

function colormapBlues(val) {
  const v = Math.max(0, Math.min(1, val));
  return [Math.round(15 + 40 * v), Math.round(40 + 130 * v), Math.round(70 + 185 * v)];
}

function colormapGreens(val) {
  const v = Math.max(0, Math.min(1, val));
  return [Math.round(20 + 40 * v), Math.round(30 + 210 * v), Math.round(30 + 60 * v)];
}

function colormapReds(val) {
  const v = Math.max(0, Math.min(1, val));
  return [Math.round(50 + 205 * v), Math.round(25 + 40 * v), Math.round(25 + 30 * v)];
}

function colormapRgbComposite(h, mo, c) {
  // R = Compactación mecánica (1 - c blando -> mayor dureza = más rojo)
  // G = Materia orgánica / nutrientes (más verde)
  // B = Humedad (más azul)
  const r = Math.round(Math.max(0, Math.min(1, 1.0 - c)) * 255);
  const g = Math.round(Math.max(0, Math.min(1, mo)) * 255);
  const b = Math.round(Math.max(0, Math.min(1, h)) * 255);
  return [r, g, b];
}

function colormapPurples(val) {
  const v = Math.max(0, Math.min(1, val));
  return [Math.round(45 + 175 * v), Math.round(15 + 40 * v), Math.round(70 + 170 * v)];
}

function colormapGold(val) {
  const v = Math.max(0, Math.min(1, val));
  return [Math.round(40 + 215 * v), Math.round(30 + 165 * v), Math.round(10 + 30 * v)];
}

function colormapRust(val) {
  const v = Math.max(0, Math.min(1, val));
  return [Math.round(50 + 170 * v), Math.round(20 + 40 * v), Math.round(15 + 25 * v)];
}

// Colores estándar de estados del autómata celular (main.py / main_mars.py)
const CA_PALETTE = {
  0: [15, 23, 42],     // Suelo virgen (#0f172a)
  1: [45, 55, 72],     // Suelo potencial medido / Oasis (#2d3748)
  2: [255, 69, 0],     // Punta de hifa activa diurna (#ff4500)
  3: [0, 255, 204],    // Red de micelio madura (#00ffcc bioluminiscente)
  4: [30, 41, 59],     // Obstáculo impenetrable (#1e293b)
  5: [147, 197, 253],  // Punta en dormancia crioprotegida nocturna (#93c5fd azul hielo)
};

export function Fase2IdoneidadStudio({
  fase2Data,
  loading,
  onRecalcular,
  terrenoActivo,
  planeta = 'tierra',
  cfuConcentration = 0.85,
  setCfuConcentration,
  numInyecciones = 3,
  setNumInyecciones,
  onVolverFase1,
}) {
  // Modo de visualización:
  // 'COMPOSITE' | 'MOISTURE' | 'ORGANIC' | 'COMPACTION' | 'AUTOMATON' | 'RGB_COMPOSITE' | 'TRIPLE_SPLIT'
  const [activeLayerMode, setActiveLayerMode] = useState('COMPOSITE');

  // Toggles de capas superpuestas
  const [showObstacles, setShowObstacles] = useState(true);
  const [showSeeds, setShowSeeds] = useState(true);
  const [showHalos, setShowHalos] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [overlayAutomaton, setOverlayAutomaton] = useState(false);

  // Control del autómata celular
  const [selectedStepKey, setSelectedStepKey] = useState('step_0');
  const [animatingCA, setAnimatingCA] = useState(false);
  const animIntervalRef = useRef(null);

  // Inspector de celda al pasar el ratón (Hover HUD)
  const [hoverCell, setHoverCell] = useState(null);

  const canvasRef = useRef(null);
  const canvasMoistRef = useRef(null);
  const canvasOrgRef = useRef(null);
  const canvasCompRef = useRef(null);

  const gridSize = fase2Data?.grid_size || 40;
  const snapshots = fase2Data?.simulacion_automata || fase2Data?.snapshots_temporales || {};
  const availableSteps = useMemo(() => {
    return Object.keys(snapshots).sort((a, b) => {
      const numA = parseInt(a.replace('step_', ''), 10) || 0;
      const numB = parseInt(b.replace('step_', ''), 10) || 0;
      return numA - numB;
    });
  }, [snapshots]);

  // Si cambia el conjunto de snapshots, fijar el primero
  useEffect(() => {
    if (availableSteps.length > 0 && !availableSteps.includes(selectedStepKey)) {
      setSelectedStepKey(availableSteps[0]);
    }
  }, [availableSteps, selectedStepKey]);

  // Manejo de la animación secuencial de snapshots
  useEffect(() => {
    if (animatingCA && availableSteps.length > 1) {
      animIntervalRef.current = setInterval(() => {
        setSelectedStepKey((prev) => {
          const idx = availableSteps.indexOf(prev);
          const nextIdx = (idx + 1) % availableSteps.length;
          return availableSteps[nextIdx];
        });
      }, 900);
    } else {
      if (animIntervalRef.current) {
        clearInterval(animIntervalRef.current);
        animIntervalRef.current = null;
      }
    }
    return () => {
      if (animIntervalRef.current) clearInterval(animIntervalRef.current);
    };
  }, [animatingCA, availableSteps]);

  /* ─── DIBUJO DEL CANVAS PRINCIPAL ─── */
  const renderMainCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !fase2Data || (!fase2Data.matriz_idoneidad && !fase2Data.matriz_grid && !fase2Data.capa_hidratacion)) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const cellW = width / gridSize;
    const cellH = height / gridSize;

    const matIdoneidad = fase2Data.matriz_idoneidad || fase2Data.capa_hidratacion || fase2Data.matriz_grid;
    const matH = fase2Data.capa_humedad || fase2Data.capa_hidratacion;
    const matMO = fase2Data.capa_nutrientes || fase2Data.capa_hierro_quelado;
    const matC = fase2Data.capa_compactacion || fase2Data.capa_percloratos;
    const matObs = fase2Data.capa_obstaculos;
    const currentSnap = snapshots[selectedStepKey];
    const matCA = (currentSnap && currentSnap.grid) ? currentSnap.grid : currentSnap;

    // 1. Render de celdas base
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const x = c * cellW;
        const y = r * cellH;

        const isObstacle = matObs && matObs[r] && matObs[r][c] === 1;
        let rgb = [20, 25, 35];

        if (activeLayerMode === 'COMPOSITE') {
          const v = matIdoneidad[r]?.[c] ?? 0;
          rgb = colormapInferno(v);
        } else if (activeLayerMode === 'MOISTURE') {
          const v = matH?.[r]?.[c] ?? 0;
          rgb = colormapBlues(v);
        } else if (activeLayerMode === 'ORGANIC') {
          const v = matMO?.[r]?.[c] ?? 0;
          rgb = colormapGreens(v);
        } else if (activeLayerMode === 'COMPACTION') {
          const v = matC?.[r]?.[c] ?? 0;
          rgb = colormapReds(v);
        } else if (activeLayerMode === 'RGB_COMPOSITE') {
          const vH = matH?.[r]?.[c] ?? 0;
          const vMO = matMO?.[r]?.[c] ?? 0;
          const vC = matC?.[r]?.[c] ?? 0;
          rgb = colormapRgbComposite(vH, vMO, vC);
        } else if (activeLayerMode === 'AUTOMATON') {
          const caState = matCA ? (matCA[r]?.[c] ?? 0) : 0;
          rgb = CA_PALETTE[caState] || CA_PALETTE[0];
        } else if (activeLayerMode === 'MARS_HYDRATION') {
          const v = fase2Data.simulacion_marte?.capa_hidratacion?.[r]?.[c] ?? fase2Data.capa_hidratacion?.[r]?.[c] ?? (matH?.[r]?.[c] ?? 0);
          rgb = colormapBlues(v);
        } else if (activeLayerMode === 'MARS_PERCHLORATES') {
          const v = fase2Data.simulacion_marte?.capa_percloratos?.[r]?.[c] ?? fase2Data.capa_percloratos?.[r]?.[c] ?? 0;
          rgb = colormapPurples(v);
        } else if (activeLayerMode === 'MARS_SIDEROPHORES') {
          const v = fase2Data.simulacion_marte?.capa_hierro_quelado?.[r]?.[c] ?? fase2Data.capa_hierro_quelado?.[r]?.[c] ?? 0;
          rgb = colormapGold(v);
        } else if (activeLayerMode === 'MARS_OXIDES') {
          const v = fase2Data.simulacion_marte?.capa_oxidos_basales?.[r]?.[c] ?? fase2Data.capa_oxidos_basales?.[r]?.[c] ?? 0;
          rgb = colormapRust(v);
        }

        // Si es obstáculo y estamos en modo de mostrar obstáculos
        if (isObstacle && showObstacles && activeLayerMode !== 'AUTOMATON') {
          rgb = [35, 40, 50]; // Sombra de roca
        }

        ctx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
        ctx.fillRect(x, y, cellW, cellH);

        // Patrón diagonal para obstáculos
        if (isObstacle && showObstacles && activeLayerMode !== 'AUTOMATON') {
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + cellW, y + cellH);
          ctx.stroke();
        }

        // Si se pide superponer el autómata sobre el heatmap
        if (overlayAutomaton && activeLayerMode !== 'AUTOMATON' && matCA) {
          const caState = matCA[r]?.[c] ?? 0;
          if (caState === 2) {
            // Punta de hifa activa
            ctx.fillStyle = 'rgba(255, 69, 0, 0.9)';
            ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);
          } else if (caState === 3) {
            // Red de micelio anastomizada
            ctx.fillStyle = 'rgba(0, 255, 204, 0.85)';
            ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);
          } else if (caState === 5) {
            // Crio-dormancia nocturna
            ctx.fillStyle = 'rgba(147, 197, 253, 0.9)';
            ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);
          }
        }
      }
    }

    // 2. Cuadrícula sutil opcional
    if (showGrid) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= gridSize; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cellW, 0);
        ctx.lineTo(i * cellW, height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * cellH);
        ctx.lineTo(width, i * cellH);
        ctx.stroke();
      }
    }

    // 3. Semillas de inyección óptimas calculadas
    const semillas = fase2Data.semillas_inyeccion || [];
    if (showSeeds && semillas.length > 0) {
      semillas.forEach((seed, idx) => {
        const cx = seed.grid_x * cellW + cellW / 2;
        const cy = seed.grid_y * cellH + cellH / 2;

        // Halo biológico derivado de UFC/g
        if (showHalos && seed.radio_inicial > 0) {
          const haloPx = (seed.radio_inicial + 0.5) * cellW;
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, haloPx, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(16, 185, 129, 0.8)';
          ctx.setLineDash([3, 3]);
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.restore();
        }

        // Retícula / diana del foco de inyección
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, cellW * 0.9, 0, Math.PI * 2);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, cellW * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = '#10b981';
        ctx.fill();

        // Cruz de objetivo
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - cellW * 1.3, cy);
        ctx.lineTo(cx + cellW * 1.3, cy);
        ctx.moveTo(cx, cy - cellH * 1.3);
        ctx.lineTo(cx, cy + cellH * 1.3);
        ctx.stroke();

        // Etiqueta de la cápsula
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px monospace';
        ctx.fillText(`S${idx + 1}`, cx + cellW, cy - cellH * 0.5);
        ctx.restore();
      });
    }

    // 4. Cursor del hover activo
    if (hoverCell) {
      const hx = hoverCell.x * cellW;
      const hy = hoverCell.y * cellH;
      ctx.save();
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 2;
      ctx.strokeRect(hx, hy, cellW, cellH);

      // Líneas guía tenues
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.25)';
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(hx + cellW / 2, 0);
      ctx.lineTo(hx + cellW / 2, height);
      ctx.moveTo(0, hy + cellH / 2);
      ctx.lineTo(width, hy + cellH / 2);
      ctx.stroke();
      ctx.restore();
    }
  }, [
    fase2Data,
    gridSize,
    activeLayerMode,
    showObstacles,
    showSeeds,
    showHalos,
    showGrid,
    overlayAutomaton,
    selectedStepKey,
    snapshots,
    hoverCell,
  ]);

  /* ─── DIBUJO DE LOS 3 CANVASES EN TRIPLE SPLIT ─── */
  const renderTripleSplit = useCallback(() => {
    if (activeLayerMode !== 'TRIPLE_SPLIT' || !fase2Data) return;

    const layersConfig = [
      { ref: canvasMoistRef, mat: fase2Data.capa_humedad, cmap: colormapBlues, title: 'Humedad (n_H)' },
      { ref: canvasOrgRef, mat: fase2Data.capa_nutrientes, cmap: colormapGreens, title: 'Materia Orgánica (n_MO)' },
      { ref: canvasCompRef, mat: fase2Data.capa_compactacion, cmap: colormapReds, title: 'Compactación (n_C)' },
    ];

    layersConfig.forEach(({ ref, mat, cmap }) => {
      const canvas = ref.current;
      if (!canvas || !mat) return;
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const cellW = w / gridSize;
      const cellH = h / gridSize;

      for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
          const val = mat[r]?.[c] ?? 0;
          const rgb = cmap(val);
          ctx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
          ctx.fillRect(c * cellW, r * cellH, cellW, cellH);
        }
      }

      // Cursor sincronizado
      if (hoverCell) {
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(hoverCell.x * cellW, hoverCell.y * cellH, cellW, cellH);
      }
    });
  }, [activeLayerMode, fase2Data, gridSize, hoverCell]);

  useEffect(() => {
    renderMainCanvas();
    renderTripleSplit();
  }, [renderMainCanvas, renderTripleSplit]);

  /* ─── MANEJADOR DE MOUSE HOVER SOBRE EL CANVAS ─── */
  const handleCanvasMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || !fase2Data) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const cellX = Math.floor((clientX / rect.width) * gridSize);
    const cellY = Math.floor((clientY / rect.height) * gridSize);

    if (cellX >= 0 && cellX < gridSize && cellY >= 0 && cellY < gridSize) {
      const matIdoneidad = fase2Data.matriz_idoneidad;
      const matH = fase2Data.capa_humedad;
      const matMO = fase2Data.capa_nutrientes;
      const matC = fase2Data.capa_compactacion;
      const matObs = fase2Data.capa_obstaculos;
      const matFT = fase2Data.capa_temperatura_factor;
      const matFpH = fase2Data.capa_ph_factor;
      const matCA = snapshots[selectedStepKey];

      setHoverCell({
        x: cellX,
        y: cellY,
        idoneidad: matIdoneidad ? matIdoneidad[cellY]?.[cellX] : 0,
        humedad: matH ? matH[cellY]?.[cellX] : 0,
        materia_organica: matMO ? matMO[cellY]?.[cellX] : 0,
        compactacion: matC ? matC[cellY]?.[cellX] : 0,
        factor_temp: matFT ? matFT[cellY]?.[cellX] : 1,
        factor_ph: matFpH ? matFpH[cellY]?.[cellX] : 1,
        esObstaculo: matObs ? matObs[cellY]?.[cellX] === 1 : false,
        estadoCA: matCA ? matCA[cellY]?.[cellX] : 0,
      });
    }
  };

  const handleCanvasMouseLeave = () => {
    setHoverCell(null);
  };

  const stats = fase2Data?.estadisticas || {
    idoneidad_promedio: 0,
    idoneidad_maxima: 0,
    area_viable_pct: 0,
    area_obstaculos_pct: 0,
  };

  return (
    <div className="w-full flex flex-col gap-3 font-mono text-xs">
      
      {/* ────────────────────────────────────────────────────────── */}
      {/* 1. BARRA SUPERIOR DE FASE 2: TÍTULO, STATS Y ACCIONES     */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="p-3.5 rounded-2xl flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center text-lg shadow-sm">
            <i className="fa-solid fa-flask-vial animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[0.62rem] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                FASE 2 ACTIVA
              </span>
              <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">
                Estudio de Idoneidad Edafológica &amp; Puntos de Inyección
              </h2>
            </div>
            <p className="text-[0.68rem] text-slate-400">
              {terrenoActivo?.nombre || 'Terreno Seleccionado'} &bull; Entorno: <strong className={planeta === 'marte' ? 'text-orange-400' : 'text-emerald-400'}>{planeta.toUpperCase()}</strong> &bull; Rejilla: {gridSize}&times;{gridSize} ({gridSize * gridSize} celdas)
            </p>
          </div>
        </div>

        {/* Estadísticas Globales Rápidas */}
        <div className="flex items-center gap-2 flex-wrap text-[0.65rem]">
          <div className="px-2.5 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-slate-400 block">Idoneidad Media</span>
            <strong className="text-emerald-400 text-xs">{(stats.idoneidad_promedio * 100).toFixed(1)}%</strong>
          </div>
          <div className="px-2.5 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-slate-400 block">Pico Máximo</span>
            <strong className="text-cyan-400 text-xs">{(stats.idoneidad_maxima * 100).toFixed(1)}%</strong>
          </div>
          <div className="px-2.5 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-slate-400 block">Área Viable (&ge;40%)</span>
            <strong className="text-amber-400 text-xs">{stats.area_viable_pct}%</strong>
          </div>
          <div className="px-2.5 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-slate-400 block">Obstáculos DEM</span>
            <strong className="text-red-400 text-xs">{stats.area_obstaculos_pct}%</strong>
          </div>

          <button
            type="button"
            onClick={onVolverFase1}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold transition-all flex items-center gap-1.5"
            title="Volver a la vista del Mapa y Rutas"
          >
            <i className="fa-solid fa-map" />
            <span>Ver Mapa</span>
          </button>
        </div>

      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 2. BARRA DE CONTROL DE CAPAS (COMO EN PYGAME micelio_sim)   */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="p-3 rounded-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 shadow-md">
        
        {/* Selector de Modo de Capa / Heatmap */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[0.65rem] text-slate-400 font-bold uppercase mr-1">
            <i className="fa-solid fa-layer-group text-amber-400 mr-1" />
            Capas:
          </span>

          <button
            type="button"
            onClick={() => setActiveLayerMode('COMPOSITE')}
            className={`px-2.5 py-1.5 rounded-xl text-[0.68rem] font-bold transition-all border ${
              activeLayerMode === 'COMPOSITE'
                ? 'bg-amber-500/25 text-amber-300 border-amber-400 shadow-sm shadow-amber-500/20'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            <i className="fa-solid fa-fire mr-1 text-orange-400" />
            Idoneidad (I_suelo)
          </button>

          <button
            type="button"
            onClick={() => setActiveLayerMode('MOISTURE')}
            className={`px-2.5 py-1.5 rounded-xl text-[0.68rem] font-bold transition-all border ${
              activeLayerMode === 'MOISTURE'
                ? 'bg-blue-500/25 text-blue-300 border-blue-400 shadow-sm shadow-blue-500/20'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            <i className="fa-solid fa-droplet mr-1 text-blue-400" />
            Humedad (n_H)
          </button>

          <button
            type="button"
            onClick={() => setActiveLayerMode('ORGANIC')}
            className={`px-2.5 py-1.5 rounded-xl text-[0.68rem] font-bold transition-all border ${
              activeLayerMode === 'ORGANIC'
                ? 'bg-emerald-500/25 text-emerald-300 border-emerald-400 shadow-sm shadow-emerald-500/20'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            <i className="fa-solid fa-seedling mr-1 text-emerald-400" />
            Materia Orgánica (TCS34725)
          </button>

          <button
            type="button"
            onClick={() => setActiveLayerMode('COMPACTION')}
            className={`px-2.5 py-1.5 rounded-xl text-[0.68rem] font-bold transition-all border ${
              activeLayerMode === 'COMPACTION'
                ? 'bg-rose-500/25 text-rose-300 border-rose-400 shadow-sm shadow-rose-500/20'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            <i className="fa-solid fa-cubes-stacked mr-1 text-rose-400" />
            Compactación (n_C)
          </button>

          <button
            type="button"
            onClick={() => setActiveLayerMode('TRIPLE_SPLIT')}
            className={`px-2.5 py-1.5 rounded-xl text-[0.68rem] font-bold transition-all border ${
              activeLayerMode === 'TRIPLE_SPLIT'
                ? 'bg-purple-500/25 text-purple-300 border-purple-400 shadow-sm shadow-purple-500/20'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
            }`}
            title="Ver los gradientes de los 3 parámetros de idoneidad en lienzos paralelos sincronizados"
          >
            <i className="fa-solid fa-table-columns mr-1 text-purple-400" />
            Ver 3 Capas a la Vez
          </button>

          <button
            type="button"
            onClick={() => setActiveLayerMode('RGB_COMPOSITE')}
            className={`px-2.5 py-1.5 rounded-xl text-[0.68rem] font-bold transition-all border ${
              activeLayerMode === 'RGB_COMPOSITE'
                ? 'bg-cyan-500/25 text-cyan-300 border-cyan-400 shadow-sm shadow-cyan-500/20'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
            }`}
            title="Fusión espectral RGB: R=Compactación, G=Materia Orgánica, B=Humedad"
          >
            <i className="fa-solid fa-palette mr-1 text-cyan-400" />
            Fusión RGB
          </button>

          <button
            type="button"
            onClick={() => setActiveLayerMode('AUTOMATON')}
            className={`px-2.5 py-1.5 rounded-xl text-[0.68rem] font-bold transition-all border ${
              activeLayerMode === 'AUTOMATON'
                ? 'bg-teal-500/25 text-teal-300 border-teal-400 shadow-sm shadow-teal-500/20'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            <i className="fa-solid fa-bacteria mr-1 text-teal-400" />
            Autómata Celular
          </button>

          {(planeta === 'marte' || fase2Data?.simulacion_marte) && (
            <>
              <button
                type="button"
                onClick={() => setActiveLayerMode('MARS_HYDRATION')}
                className={`px-2.5 py-1.5 rounded-xl text-[0.68rem] font-bold transition-all border ${
                  activeLayerMode === 'MARS_HYDRATION'
                    ? 'bg-sky-500/25 text-sky-300 border-sky-400 shadow-sm shadow-sky-500/20'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
                title="Difusión del Oasis Fickiano desde la cápsula de Alginato"
              >
                <i className="fa-solid fa-droplet mr-1 text-sky-400" />
                Oasis Hidrogel (Fick)
              </button>

              <button
                type="button"
                onClick={() => setActiveLayerMode('MARS_PERCHLORATES')}
                className={`px-2.5 py-1.5 rounded-xl text-[0.68rem] font-bold transition-all border ${
                  activeLayerMode === 'MARS_PERCHLORATES'
                    ? 'bg-purple-500/25 text-purple-300 border-purple-400 shadow-sm shadow-purple-500/20'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
                title="Toxicidad por Percloratos (ClO4-) y ROS"
              >
                <i className="fa-solid fa-biohazard mr-1 text-purple-400" />
                Percloratos (ClO4-)
              </button>

              <button
                type="button"
                onClick={() => setActiveLayerMode('MARS_SIDEROPHORES')}
                className={`px-2.5 py-1.5 rounded-xl text-[0.68rem] font-bold transition-all border ${
                  activeLayerMode === 'MARS_SIDEROPHORES'
                    ? 'bg-amber-500/25 text-amber-300 border-amber-400 shadow-sm shadow-amber-500/20'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
                title="Quelación de Fe3+ a Fe2+ biodisponible por sideróforos"
              >
                <i className="fa-solid fa-magnet mr-1 text-amber-400" />
                Sideróforos & Fe2+
              </button>

              <button
                type="button"
                onClick={() => setActiveLayerMode('MARS_OXIDES')}
                className={`px-2.5 py-1.5 rounded-xl text-[0.68rem] font-bold transition-all border ${
                  activeLayerMode === 'MARS_OXIDES'
                    ? 'bg-red-500/25 text-red-300 border-red-400 shadow-sm shadow-red-500/20'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
                title="Óxidos basales de hierro del regolito"
              >
                <i className="fa-solid fa-gem mr-1 text-red-400" />
                Óxidos Fe3+
              </button>
            </>
          )}
        </div>

        {/* Checkboxes de Capas Superpuestas (Toggles tipo Pygame) */}
        <div className="flex items-center gap-2.5 flex-wrap text-[0.65rem]">
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
            <input
              type="checkbox"
              checked={showObstacles}
              onChange={(e) => setShowObstacles(e.target.checked)}
              className="rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-0"
            />
            <span>Obstáculos DEM</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
            <input
              type="checkbox"
              checked={showSeeds}
              onChange={(e) => setShowSeeds(e.target.checked)}
              className="rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-0"
            />
            <span>Biocápsulas</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
            <input
              type="checkbox"
              checked={showHalos}
              onChange={(e) => setShowHalos(e.target.checked)}
              className="rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-0"
            />
            <span>Halos UFC/g</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
            <input
              type="checkbox"
              checked={overlayAutomaton}
              onChange={(e) => setOverlayAutomaton(e.target.checked)}
              className="rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-0"
            />
            <span>Micelio Superpuesto</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
            <input
              type="checkbox"
              checked={showGrid}
              onChange={(e) => setShowGrid(e.target.checked)}
              className="rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-0"
            />
            <span>Malla</span>
          </label>
        </div>

      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 2.5 BANNER DE ASTROBIOLOGÍA MARCÍANA Y TELEMETRÍA DEL SOL  */}
      {/* ────────────────────────────────────────────────────────── */}
      {fase2Data?.simulacion_marte?.telemetria_sol && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-red-950/40 via-slate-900 to-amber-950/30 border border-red-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400 font-bold text-base shadow-sm">
              <i className="fa-solid fa-shuttle-space" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-mono font-bold text-red-400">
                  Astrobiología Marciana &bull; Traje Espacial Fúngico
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[0.62rem] font-bold font-mono border ${
                  fase2Data.simulacion_marte.telemetria_sol.es_noche
                    ? 'bg-blue-500/20 text-blue-300 border-blue-400/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                }`}>
                  {fase2Data.simulacion_marte.telemetria_sol.es_noche ? '❄️ NOCHE: DORMANCIA CRIOPROTEGIDA (-8°C)' : '☀️ DÍA: METABOLISMO + SIDERÓFOROS'}
                </span>
              </div>
              <p className="text-[0.65rem] text-slate-300 font-mono mt-0.5">
                Sol {fase2Data.simulacion_marte.telemetria_sol.sol_actual} &bull; {fase2Data.simulacion_marte.telemetria_sol.sol_hour}:00 MST &bull; Temperatura:{' '}
                <strong className={fase2Data.simulacion_marte.telemetria_sol.temp_celsius < -8 ? 'text-blue-300' : 'text-emerald-400'}>
                  {fase2Data.simulacion_marte.telemetria_sol.temp_celsius > 0 ? `+${fase2Data.simulacion_marte.telemetria_sol.temp_celsius}` : fase2Data.simulacion_marte.telemetria_sol.temp_celsius}°C
                </strong>
                {' '}&bull; Vitalidad: <strong>{(fase2Data.simulacion_marte.telemetria_sol.vitality * 100).toFixed(0)}%</strong>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[0.62rem] font-mono shrink-0 w-full md:w-auto">
            <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800">
              <span className="text-slate-400 block text-[0.58rem]">Reserva Hidrogel</span>
              <strong className="text-sky-300">{fase2Data.simulacion_marte.telemetria_sol.reserva_humectante} U ({fase2Data.simulacion_marte.telemetria_sol.porcentaje_gel_restante}%)</strong>
            </div>
            <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800">
              <span className="text-slate-400 block text-[0.58rem]">Fe²⁺ Quelado</span>
              <strong className="text-amber-300">+{fase2Data.simulacion_marte.telemetria_sol.hierro_fe2_quelado_total} U</strong>
            </div>
            <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800">
              <span className="text-slate-400 block text-[0.58rem]">Percloratos Limpios</span>
              <strong className="text-purple-300">{fase2Data.simulacion_marte.telemetria_sol.percloratos_neutralizados_pct}%</strong>
            </div>
            <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800">
              <span className="text-slate-400 block text-[0.58rem]">Hifas / Puntas</span>
              <strong className="text-emerald-400">{fase2Data.simulacion_marte.telemetria_sol.hifas_maduras_total} / {fase2Data.simulacion_marte.telemetria_sol.puntas_activas} {fase2Data.simulacion_marte.telemetria_sol.puntas_dormantes > 0 ? `(${fase2Data.simulacion_marte.telemetria_sol.puntas_dormantes} ❄️)` : ''}</strong>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* 3. ESPACIO CENTRAL: CANVAS (IZQUIERDA) + PANEL (DERECHA)   */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
        
        {/* ── COLUMNA IZQUIERDA: VISOR DE MATRIZ (7 o 8 cols) ── */}
        <div className="lg:col-span-8 flex flex-col gap-2">
          
          {/* Si estamos en modo de 3 capas paralelas */}
          {activeLayerMode === 'TRIPLE_SPLIT' ? (
            <div className="p-3 rounded-2xl space-y-3 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <i className="fa-solid fa-table-columns text-purple-400" />
                  Visualización Simultánea de los 3 Parámetros Edafológicos
                </span>
                <span className="text-[0.62rem] text-slate-400">
                  Pasa el mouse para inspeccionar los valores en paralelo
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Humedad */}
                <div className="flex flex-col items-center gap-1.5 p-2 bg-slate-950 rounded-xl border border-blue-500/30">
                  <span className="text-[0.68rem] font-bold text-blue-300 flex items-center gap-1">
                    <i className="fa-solid fa-droplet text-blue-400" />
                    Humedad (n_H: 30-70%)
                  </span>
                  <canvas
                    ref={canvasMoistRef}
                    width={220}
                    height={220}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseLeave={handleCanvasMouseLeave}
                    className="w-full aspect-square rounded-lg border border-slate-800 cursor-crosshair shadow-inner"
                  />
                  <span className="text-[0.6rem] text-slate-400">Normalización Trapezoidal</span>
                </div>

                {/* Materia Orgánica */}
                <div className="flex flex-col items-center gap-1.5 p-2 bg-slate-950 rounded-xl border border-emerald-500/30">
                  <span className="text-[0.68rem] font-bold text-emerald-300 flex items-center gap-1">
                    <i className="fa-solid fa-seedling text-emerald-400" />
                    Materia Orgánica (n_MO: 0-5%)
                  </span>
                  <canvas
                    ref={canvasOrgRef}
                    width={220}
                    height={220}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseLeave={handleCanvasMouseLeave}
                    className="w-full aspect-square rounded-lg border border-slate-800 cursor-crosshair shadow-inner"
                  />
                  <span className="text-[0.6rem] text-slate-400">Sensor TCS34725 / Reflectancia</span>
                </div>

                {/* Compactación */}
                <div className="flex flex-col items-center gap-1.5 p-2 bg-slate-950 rounded-xl border border-rose-500/30">
                  <span className="text-[0.68rem] font-bold text-rose-300 flex items-center gap-1">
                    <i className="fa-solid fa-cubes-stacked text-rose-400" />
                    Compactación (n_C: Inversa)
                  </span>
                  <canvas
                    ref={canvasCompRef}
                    width={220}
                    height={220}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseLeave={handleCanvasMouseLeave}
                    className="w-full aspect-square rounded-lg border border-slate-800 cursor-crosshair shadow-inner"
                  />
                  <span className="text-[0.6rem] text-slate-400">Penetrómetro 0.5 a 3.5 MPa</span>
                </div>
              </div>
            </div>
          ) : (
            /* Lienzo Principal Único de Alta Resolución */
            <div className="p-3 rounded-2xl flex flex-col items-center gap-2 shadow-xl relative">
              
              {/* Barra de Leyenda Superior del Canvas */}
              <div className="w-full flex items-center justify-between text-[0.65rem] font-mono text-slate-400 px-1">
                <span className="flex items-center gap-1.5 text-white font-bold">
                  {activeLayerMode === 'COMPOSITE' && <><i className="fa-solid fa-fire text-orange-400" /> Índice de Idoneidad Edafológica (0.0 a 1.0)</>}
                  {activeLayerMode === 'MOISTURE' && <><i className="fa-solid fa-droplet text-blue-400" /> Capa Normalizada de Humedad</>}
                  {activeLayerMode === 'ORGANIC' && <><i className="fa-solid fa-seedling text-emerald-400" /> Capa de Materia Orgánica / Nutrientes</>}
                  {activeLayerMode === 'COMPACTION' && <><i className="fa-solid fa-cubes-stacked text-rose-400" /> Resistencia a la Penetración (Inversa)</>}
                  {activeLayerMode === 'RGB_COMPOSITE' && <><i className="fa-solid fa-palette text-cyan-400" /> Fusión Falso Color (R: Dureza, G: Nutrientes, B: Agua)</>}
                  {activeLayerMode === 'AUTOMATON' && <><i className="fa-solid fa-bacteria text-teal-400" /> Simulación de Crecimiento del Autómata Fúngico</>}
                </span>
                <span>Resolución: {gridSize}&times;{gridSize} píxeles de suelo</span>
              </div>

              {/* Contenedor del Canvas Principal */}
              <div className="relative w-full max-w-[520px] aspect-square rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl flex items-center justify-center">
                {loading && (
                  <div className="absolute inset-0 z-20 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2 text-cyan-400 font-mono">
                    <i className="fa-solid fa-spinner animate-spin text-3xl" />
                    <span>Calculando Matriz de Idoneidad con IA...</span>
                  </div>
                )}

                <canvas
                  ref={canvasRef}
                  width={480}
                  height={480}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseLeave={handleCanvasMouseLeave}
                  className="w-full h-full cursor-crosshair image-rendering-pixelated"
                />

                {/* Retícula de Coordenadas en las Esquinas */}
                <div className="absolute top-1.5 left-2 text-[0.55rem] text-slate-400 pointer-events-none bg-black/60 px-1 rounded">
                  (0, 0)
                </div>
                <div className="absolute bottom-1.5 right-2 text-[0.55rem] text-slate-400 pointer-events-none bg-black/60 px-1 rounded">
                  ({gridSize - 1}, {gridSize - 1})
                </div>
              </div>

              {/* Barra de Colormap / Gradiente Visual Inferior */}
              <div className="w-full max-w-[520px] flex items-center gap-2 pt-1">
                <span className="text-[0.6rem] text-slate-400">0.0 (Bajo)</span>
                <div className="flex-1 h-2 rounded-full overflow-hidden border border-slate-800 relative">
                  {activeLayerMode === 'COMPOSITE' && (
                    <div className="w-full h-full bg-gradient-to-r from-[#0f0528] via-[#8c1e7a] via-[#e55039] to-[#f6d365]" />
                  )}
                  {activeLayerMode === 'MOISTURE' && (
                    <div className="w-full h-full bg-gradient-to-r from-[#0b1322] via-[#1d4ed8] to-[#38bdf8]" />
                  )}
                  {activeLayerMode === 'ORGANIC' && (
                    <div className="w-full h-full bg-gradient-to-r from-[#0b1322] via-[#059669] to-[#34d399]" />
                  )}
                  {activeLayerMode === 'COMPACTION' && (
                    <div className="w-full h-full bg-gradient-to-r from-[#1c1917] via-[#dc2626] to-[#fb7185]" />
                  )}
                  {activeLayerMode === 'RGB_COMPOSITE' && (
                    <div className="w-full h-full bg-gradient-to-r from-red-600 via-green-500 to-blue-500" />
                  )}
                  {activeLayerMode === 'AUTOMATON' && (
                    <div className="w-full h-full bg-gradient-to-r from-slate-900 via-[#ff4500] to-[#00ffcc]" />
                  )}
                  {activeLayerMode === 'MARS_HYDRATION' && (
                    <div className="w-full h-full bg-gradient-to-r from-[#0b1322] via-[#0284c7] to-[#38bdf8]" />
                  )}
                  {activeLayerMode === 'MARS_PERCHLORATES' && (
                    <div className="w-full h-full bg-gradient-to-r from-[#0f0a1c] via-[#7c3aed] to-[#c084fc]" />
                  )}
                  {activeLayerMode === 'MARS_SIDEROPHORES' && (
                    <div className="w-full h-full bg-gradient-to-r from-[#17120a] via-[#d97706] to-[#fde047]" />
                  )}
                  {activeLayerMode === 'MARS_OXIDES' && (
                    <div className="w-full h-full bg-gradient-to-r from-[#1f0d08] via-[#ea580c] to-[#fca5a5]" />
                  )}
                </div>
                <span className="text-[0.6rem] text-slate-400">1.0 (Óptimo)</span>
              </div>

            </div>
          )}

          {/* Reproductor de Pasos del Autómata Celular Fúngico */}
          <div className="p-3 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAnimatingCA(!animatingCA)}
                className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold transition-all shadow-md ${
                  animatingCA
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                    : 'bg-teal-500 hover:bg-teal-400 text-slate-950 shadow-teal-500/20'
                }`}
                title={animatingCA ? 'Pausar avance' : 'Reproducir avance del micelio'}
              >
                <i className={`fa-solid ${animatingCA ? 'fa-pause' : 'fa-play'}`} />
              </button>

              <span className="text-[0.68rem] text-slate-300 font-bold">
                Evolución Temporal del Autómata:
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {availableSteps.map((stepKey) => {
                const stepNum = parseInt(stepKey.replace('step_', ''), 10);
                const isSelected = selectedStepKey === stepKey;
                return (
                  <button
                    key={stepKey}
                    type="button"
                    onClick={() => {
                      setSelectedStepKey(stepKey);
                      if (activeLayerMode !== 'AUTOMATON' && !overlayAutomaton) {
                        setOverlayAutomaton(true);
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[0.65rem] font-mono transition-all border ${
                      isSelected
                        ? 'bg-teal-500 text-slate-950 font-bold border-teal-400 shadow-sm'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {fase2Data?.simulacion_marte?.snapshots_temporales?.[stepKey] ? (
                      <span>
                        t={stepNum} ({fase2Data.simulacion_marte.snapshots_temporales[stepKey].sol_hour}h, {fase2Data.simulacion_marte.snapshots_temporales[stepKey].temp_celsius}°C)
                        {fase2Data.simulacion_marte.snapshots_temporales[stepKey].vitality <= 0 ? ' ❄️' : ' ☀️'}
                      </span>
                    ) : (
                      <span>t={stepNum} {stepNum === 0 ? '(Inoculación)' : stepNum === 40 ? '(Madurez)' : ''}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* ── COLUMNA DERECHA: INSPECTOR HUD & CONTROLES DE INOCULACIÓN (4 o 5 cols) ── */}
        <div className="lg:col-span-4 flex flex-col gap-3">
          
          {/* Tarjeta 1: Inspector de Celda en Tiempo Real (Hover HUD) */}
          <div className="p-3.5 rounded-2xl space-y-2.5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-white font-bold flex items-center gap-1.5">
                <i className="fa-solid fa-crosshairs text-cyan-400" />
                Inspector Edafológico HUD
              </span>
              {hoverCell ? (
                <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[0.6rem]">
                  Celda [{hoverCell.x}, {hoverCell.y}]
                </span>
              ) : (
                <span className="text-[0.6rem] text-slate-500">Mueve el cursor</span>
              )}
            </div>

            {hoverCell ? (
              <div className="space-y-1.5 text-[0.68rem]">
                <div className="flex justify-between items-center p-1.5 rounded bg-slate-950">
                  <span className="text-slate-400">Idoneidad (I_suelo):</span>
                  <strong className="text-emerald-400 font-bold">
                    {(hoverCell.idoneidad * 100).toFixed(1)}% ({hoverCell.idoneidad.toFixed(3)})
                  </strong>
                </div>

                <div className="flex justify-between items-center p-1.5 rounded bg-slate-950">
                  <span className="text-slate-400">Humedad (n_H):</span>
                  <span className="text-blue-300 font-mono">
                    {(hoverCell.humedad * 100).toFixed(1)}% (Óptimo 30-70%)
                  </span>
                </div>

                <div className="flex justify-between items-center p-1.5 rounded bg-slate-950">
                  <span className="text-slate-400">Materia Orgánica (n_MO):</span>
                  <span className="text-emerald-300 font-mono">
                    {(hoverCell.materia_organica * 5.0).toFixed(2)}% MO (TCS34725)
                  </span>
                </div>

                <div className="flex justify-between items-center p-1.5 rounded bg-slate-950">
                  <span className="text-slate-400">Compactación (n_C):</span>
                  <span className="text-rose-300 font-mono">
                    {(3.5 - hoverCell.compactacion * 3.0).toFixed(2)} MPa
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <div className="p-1 rounded bg-slate-950 text-center">
                    <span className="text-[0.58rem] text-slate-500 block">Factor Temp</span>
                    <strong className="text-amber-300">{hoverCell.factor_temp.toFixed(2)}&times;</strong>
                  </div>
                  <div className="p-1 rounded bg-slate-950 text-center">
                    <span className="text-[0.58rem] text-slate-500 block">Factor pH</span>
                    <strong className="text-purple-300">{hoverCell.factor_ph.toFixed(2)}&times;</strong>
                  </div>
                </div>

                <div className="p-1.5 rounded bg-slate-950 flex justify-between items-center">
                  <span className="text-slate-400">Clasificación:</span>
                  {hoverCell.esObstaculo ? (
                    <span className="text-red-400 font-bold flex items-center gap-1">
                      <i className="fa-solid fa-triangle-exclamation" /> Obstáculo Impenetrable
                    </span>
                  ) : hoverCell.idoneidad >= 0.70 ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <i className="fa-solid fa-circle-check" /> Foco de Inoculación Alta
                    </span>
                  ) : hoverCell.idoneidad >= 0.40 ? (
                    <span className="text-cyan-400">Terreno Viable</span>
                  ) : (
                    <span className="text-amber-400">Bajo Rendimiento</span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-[0.65rem] text-slate-400 text-center py-5">
                Desplaza el puntero sobre cualquier celda de la matriz para examinar su idoneidad y composición sensorial.
              </p>
            )}
          </div>

          {/* Tarjeta 2: Parámetros de Biocápsulas & Inóculo (UFC/g) */}
          <div className="p-3.5 rounded-2xl space-y-3 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-white font-bold flex items-center gap-1.5">
                <i className="fa-solid fa-syringe text-emerald-400" />
                Calibración de Inoculación
              </span>
              <span className="text-[0.62rem] text-slate-400 font-mono">UFC/g</span>
            </div>

            {/* Slider Concentración UFC/g */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[0.65rem]">
                <span className="text-slate-300">Concentración Inóculo:</span>
                <strong className="text-emerald-400 font-bold">
                  {Math.round(cfuConcentration * 100000).toLocaleString()} UFC/g (Vigor {(cfuConcentration * 100).toFixed(0)}%)
                </strong>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={cfuConcentration}
                onChange={(e) => setCfuConcentration?.(parseFloat(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <div className="flex justify-between text-[0.55rem] text-slate-500">
                <span>10,000 (R=0)</span>
                <span>50,000 (R=1, 5 celdas)</span>
                <span>100,000 (R=2, 13 celdas)</span>
              </div>
            </div>

            {/* Número de Inyecciones */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[0.65rem]">
                <span className="text-slate-300">Microfocos de Inyección:</span>
                <strong className="text-cyan-400 font-bold">{numInyecciones} Cápsulas</strong>
              </div>
              <div className="grid grid-cols-5 gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setNumInyecciones?.(n)}
                    className={`py-1 rounded text-center font-mono font-bold transition-all border ${
                      numInyecciones === n
                        ? 'bg-cyan-500/25 text-cyan-300 border-cyan-400'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Botón Recalcular */}
            <button
              type="button"
              onClick={() => onRecalcular?.()}
              disabled={loading}
              className="w-full py-2 bg-gradient-to-r from-amber-600 to-emerald-600 hover:from-amber-500 hover:to-emerald-500 text-white font-mono font-bold rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
            >
              {loading ? (
                <i className="fa-solid fa-spinner animate-spin" />
              ) : (
                <i className="fa-solid fa-wand-magic-sparkles" />
              )}
              <span>Recalcular Matriz de Idoneidad</span>
            </button>
          </div>

          {/* Tarjeta 3: Lista de Microfocos Óptimos (Semillas Seleccionadas) */}
          <div className="p-3.5 rounded-2xl space-y-2.5 shadow-xl max-h-[300px] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-white font-bold flex items-center gap-1.5">
                <i className="fa-solid fa-bullseye text-amber-400" />
                Puntos de Inyección Calculados
              </span>
              <span className="text-[0.62rem] text-amber-400 font-bold">
                {fase2Data?.semillas_inyeccion?.length || 0} Focos
              </span>
            </div>

            <div className="space-y-1.5">
              {(fase2Data?.semillas_inyeccion || []).map((seed, idx) => (
                <div
                  key={seed.id || idx}
                  className="p-2 rounded-xl bg-slate-950 border border-amber-500/30 hover:border-amber-400 transition-all space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-amber-300 font-bold flex items-center gap-1">
                      <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[0.6rem] border border-amber-500/40">
                        {idx + 1}
                      </span>
                      Foco #{seed.id} [x={seed.grid_x}, y={seed.grid_y}]
                    </span>
                    <strong className="text-emerald-400">
                      {(seed.idoneidad * 100).toFixed(1)}% Viabilidad
                    </strong>
                  </div>

                  <div className="text-[0.62rem] text-slate-400 flex justify-between">
                    <span>GPS: {seed.lat?.toFixed(5)}, {seed.lng?.toFixed(5)}</span>
                    <span className="text-cyan-300">Radio: R={seed.radio_inicial} ({seed.celdas_iniciales} celdas)</span>
                  </div>

                  <p className="text-[0.6rem] text-slate-400 leading-tight">
                    {seed.motivo}
                  </p>
                </div>
              ))}

              {(!fase2Data?.semillas_inyeccion || fase2Data.semillas_inyeccion.length === 0) && (
                <p className="text-[0.65rem] text-slate-500 text-center py-3">
                  No se han generado focos de inyección todavía.
                </p>
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
