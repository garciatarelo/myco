import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapaMarte } from '../components/MapaMarte.jsx';
import * as turf from '@turf/turf';
import teamLogo from '../assets/logo.ico';
import mycoLogo from '../assets/myco.png';
import { EstadisticasPanel } from '../components/EstadisticasPanel.jsx';

/* ─── Tiny Helpers ─── */
function Pulse({ color = '#ff4500' }: { color?: string }) {
  return (
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: color }}></span>
      <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: color }}></span>
    </span>
  );
}

function GaugeArc({
  value, max, color = '#ffffff', size = 62, label, unit = '',
}: {
  value: number; max: number; color?: string; size?: number; label?: string; unit?: string;
}) {
  const r = size / 2 - 6;
  const circ = Math.PI * r;
  const pct = Math.min(value / max, 1);
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size / 2 + 8} className="overflow-visible">
        <path
          d={`M6,${size / 2} A${r},${r} 0 0 1 ${size - 6},${size / 2}`}
          fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="5" strokeLinecap="round"
        />
        <path
          d={`M6,${size / 2} A${r},${r} 0 0 1 ${size - 6},${size / 2}`}
          fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={`${pct * circ} ${circ}`}
          className="transition-all duration-500 ease-out"
        />
        <text x={size / 2} y={size / 2 + 2} textAnchor="middle"
          className="text-[0.65rem] font-bold font-mono" fill={color}>
          {value}{unit}
        </text>
      </svg>
      {label && <span className="text-[0.55rem] text-gray-400 uppercase tracking-widest">{label}</span>}
    </div>
  );
}

function StatusBar({ label, value, max, color = '#ffffff' }: { label: string; value: number; max: number; color?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-[0.6rem] uppercase tracking-wider text-gray-400">
        <span>{label}</span>
        <strong style={{ color }}>{value}<span className="font-normal text-gray-600">/{max}</span></strong>
      </div>
      <div className="h-1 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${(value / max) * 100}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function AlertItem({ severity = 'info', text, time }: { severity?: 'critical' | 'warning' | 'normal' | 'info'; text: string; time: string }) {
  let color = '#ffffff';
  let bgBorderClass = 'bg-white/5 border-white/10';
  
  if (severity === 'critical') {
    color = '#ff4500';
    bgBorderClass = 'bg-[#ff4500]/10 border-[#ff4500]/10';
  } else if (severity === 'warning') {
    color = '#eab308';
    bgBorderClass = 'bg-[#eab308]/10 border-[#eab308]/10';
  } else if (severity === 'normal') {
    color = '#22c55e';
    bgBorderClass = 'bg-[#22c55e]/10 border-[#22c55e]/10';
  }
  
  return (
    <div className={`flex items-start gap-2 p-2 rounded border transition-colors duration-300 ${bgBorderClass}`}>
      <span className="w-1.5 h-1.5 rounded-full mt-1 shrink-0" style={{ backgroundColor: color }} />
      <div className="flex-1 min-w-0">
        <div className="text-[0.65rem] text-gray-200 leading-snug">{text}</div>
        <div className="text-[0.55rem] text-gray-500 mt-0.5">{time}</div>
      </div>
    </div>
  );
}



export default function Home() {
  /* ─── State ─── */
  const navigate = useNavigate();
  const [activeMap, setActiveMap] = useState<'earth' | 'mars'>('earth');
  const [generatedRoute, setGeneratedRoute] = useState<any>(null);
  const [routeStatus, setRouteStatus] = useState<'idle' | 'planificada' | 'completada'>('idle');
  const [robotsToken, setRobotsToken] = useState(0);
  const [area, setArea] = useState(0);
  const [polygonCoords, setPolygonCoords] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('');
  const [batteryLevel, setBatteryLevel] = useState(85);
  const [isCharging, setIsCharging] = useState(false);
  const [failsafe, setFailsafe] = useState('NORMAL');
  const [phLevel, setPhLevel] = useState(6.8);
  const [arsenicLevel, setArsenicLevel] = useState(15);
  const [valveOpen, setValveOpen] = useState(true);
  const [robotFleet, setRobotFleet] = useState([
    { id: 1, nombre: 'Rover-01', estado: 'libre', tarea: 'Sin asignar', bateria: 85 },
    { id: 2, nombre: 'Rover-02', estado: 'libre', tarea: 'Sin asignar', bateria: 62 },
  ]);
  const [clima, setClima] = useState<any>(null);
  const [activeNav, setActiveNav] = useState<'SIMULADOR' | 'P01' | 'P02'>('SIMULADOR');
  const [time, setTime] = useState(new Date());
  const [heatmapGrid, setHeatmapGrid] = useState<any>(null);
  const [simulationState, setSimulationState] = useState<'idle' | 'playing' | 'finished'>('idle');
  const [simulationRovers, setSimulationRovers] = useState<any[]>([]);
  const [simulationRoutesFull, setSimulationRoutesFull] = useState<any[]>([]);
  const [simulationInjectedCapsules, setSimulationInjectedCapsules] = useState<any[]>([]);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [selectedRobot, setSelectedRobot] = useState<any>(null);
  const [logs, setLogs] = useState([
    '[SYS] Sistema M.Y.C.O. iniciado.',
    '[SYS] Válvula de micelio activa.',
    '[SYS] Rover en campo...',
  ]);
  const consoleRef = useRef<HTMLDivElement>(null);
  const chargeRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addLog = (lines: string[]) =>
    setLogs(p => [...p, ...lines.map(l => `[${new Date().toLocaleTimeString()}] ${l}`)]);

  /* ─── Effects ─── */
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (consoleRef.current) consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
  }, [logs]);

  useEffect(() => {
    if (batteryLevel < 20 && failsafe === 'NORMAL') {
      setFailsafe('ACTIVE'); setValveOpen(false); setIsCharging(true);
      addLog(['[AVISO] Batería crítica. Rover regresando a base.', '[CARGA] Iniciando carga...']);
      chargeRef.current = setInterval(() => {
        setBatteryLevel(p => {
          if (p >= 95) {
            clearInterval(chargeRef.current!); chargeRef.current = null;
            setFailsafe('NORMAL'); setValveOpen(true); setIsCharging(false);
            addLog(['[SYS] Carga completa (95%). Rover al campo.']);
            return 95;
          }
          return p + 2;
        });
      }, 300);
    }
  }, [batteryLevel, failsafe]);

  useEffect(() => () => { if (chargeRef.current) clearInterval(chargeRef.current); }, []);

  /* ─── Simulation Logic ─── */
  const handleSimulationToggle = async () => {
    if (simulationState === 'idle') {
      if (!heatmapGrid) {
        addLog(['[AVISO] No hay terreno analizado para simular.']);
        return;
      }
      setSimulationState('playing');
      addLog(['[SYS] Iniciando simulación de descontaminación...']);
      
      const { planSimulationRoutes } = await import('../utils/utils.js');
      const activeFleet = robotFleet.filter(r => r.estado === 'libre');
      const fleetToUse = activeFleet.length > 0 ? activeFleet : robotFleet;
      const routes = planSimulationRoutes(heatmapGrid, fleetToUse.length);
      setSimulationRoutesFull(routes);
      
      const durationMs = 10000;
      const fps = 30;
      const totalSteps = (durationMs / 1000) * fps;
      let step = 0;
      
      const interval = setInterval(() => {
        step++;
        const progress = step / totalSteps;
        
        const currentRovers = routes.map((route: any[], i: number) => {
          if (route.length === 0) return null;
          const routeIndex = Math.min(Math.floor(progress * route.length), route.length - 1);
          return {
            id: fleetToUse[i]?.id || i,
            lon: route[routeIndex].lon,
            lat: route[routeIndex].lat
          };
        }).filter(Boolean);
        
        const currentCapsules = routes.flatMap((route: any[]) => {
          if (route.length === 0) return [];
          const routeIndex = Math.min(Math.floor(progress * route.length), route.length - 1);
          return route.slice(0, routeIndex + 1);
        });
        
        setSimulationRovers(currentRovers);
        setSimulationInjectedCapsules(currentCapsules);
        
        setHeatmapGrid((prev: any) => {
          if (!prev) return prev;
          const newFeatures = prev.features.map((f: any) => {
            const currentTox = f.properties.toxicity;
            if (currentTox > 0.1) {
              const newTox = currentTox - ((currentTox - 0.1) * (1 / (totalSteps - step + 1)));
              return { ...f, properties: { ...f.properties, toxicity: newTox } };
            }
            return f;
          });
          return { ...prev, features: newFeatures };
        });

        // Recalculate global stats if needed
        setArsenicLevel(prev => {
          const next = prev - (prev * 0.005);
          return next < 10 ? 10 : Math.round(next);
        });
        setPhLevel(prev => {
          const target = 7.0;
          return +(prev + (target - prev) * 0.05).toFixed(1);
        });
        
        if (step >= totalSteps) {
          clearInterval(interval);
          setSimulationState('finished');
          setSimulationRovers([]);
          addLog(['[SYS] Simulación completada. Terreno estabilizado.']);
        }
      }, 1000 / fps);
    } else if (simulationState === 'finished') {
      setSimulationState('idle');
      if (activeNav === 'P01' || activeNav === 'P02') {
        loadPreset(activeNav);
      } else {
        resetToSimulator();
      }
      setSimulationRoutesFull([]);
      setSimulationInjectedCapsules([]);
    }
  };

  /* ─── Actions ─── */
  const fetchClima = async (mapOverride?: 'earth' | 'mars') => {
    const targetMap = mapOverride || activeMap;
    if (targetMap === 'earth') {
      try {
        const res = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=30.6250&lon=-107.8850&appid=364998e3b3a32f6b8df815a51c4a0342&units=metric`
        );
        const d = await res.json();
        setClima({
          temp: d.main.temp, hum: d.main.humidity, pres: d.main.pressure,
          viento: +(d.wind.speed * 3.6).toFixed(1),
          precip: d.rain ? (d.rain['1h'] ?? 0) : 0, status: d.weather[0].description,
        });
      } catch {
        setClima({ temp: 29.4, hum: 28, pres: 1014, viento: 12.8, precip: 0, status: 'Soleado' });
      }
    } else {
      setClima({ temp: -62.4, hum: 4, pres: 6, viento: 22.4, precip: 0, status: 'Frío extremo' });
    }
  };

  const handleAnalyze = async () => {
    if (!polygonCoords || area <= 0) { addLog(['[AVISO] Dibuja primero el terreno.']); return; }
    const freeR = robotFleet.find(r => r.estado === 'libre');
    if (!freeR) { addLog(['[AVISO] Ambos rovers ocupados.']); return; }

    setRobotFleet(f => f.map(r => r.id === freeR.id ? { ...r, estado: 'ocupado', tarea: activeMap === 'earth' ? 'Chihuahua' : 'Marte' } : r));
    setAnalyzing(true); setProgress(0); setAnalyzed(false);
    
    const phases = [
      'Leyendo coordenadas...', 'Calculando área...', 'Consultando clima...',
      'Analizando suelo...', 'Estimando cápsulas...', 'Trazando ruta...',
    ];
    for (let i = 0; i < phases.length; i++) {
      setPhase(phases[i]);
      const target = Math.round(((i + 1) / phases.length) * 90);
      await new Promise<void>(res => {
        let p = Math.round((i / phases.length) * 90);
        const iv = setInterval(() => {
          p += 3; if (p >= target) { clearInterval(iv); setProgress(target); res(); }
          else setProgress(p);
        }, 60);
      });
    }
    await fetchClima();
    if (polygonCoords?.length > 0) {
      try {
        const poly = turf.polygon(polygonCoords);
        const bb = turf.bbox(poly);
        const w = turf.distance([bb[0], bb[1]], [bb[2], bb[1]]);
        const grid = turf.pointGrid(bb, w / 5, { mask: poly, units: 'kilometers' });
        let pts = grid.features.map((f: any) => ({ lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] }));
        if (pts.length < 2) pts = polygonCoords[0].map((c: number[]) => ({ lon: c[0], lat: c[1] }));
        setGeneratedRoute({ id: 'sim', puntos_json: pts, tiempo_estimado: 10 });
        setRouteStatus('planificada');
      } catch {
        const pts = polygonCoords[0].map((c: number[]) => ({ lon: c[0], lat: c[1] }));
        setGeneratedRoute({ id: 'sim', puntos_json: pts, tiempo_estimado: 10 });
        setRouteStatus('planificada');
      }
    }
    setPhase('Inyectando micelio...');
    await new Promise<void>(res => {
      let p = 90;
      const iv = setInterval(() => { p += 1; if (p >= 100) { clearInterval(iv); setProgress(100); res(); } else setProgress(p); }, 30);
    });
    setPhase('Análisis completo ✓');
    await new Promise(r => setTimeout(r, 600));
    setAnalyzing(false); setAnalyzed(true);
    setRobotsToken(v => v + 1);
    addLog(['[SYS] Inyección completada.', `[SYS] Área procesada: ${(area / 10000).toFixed(2)} ha`]);
  };

  const loadPreset = (preset: 'P01' | 'P02') => {
    setActiveNav(preset);
    if (preset === 'P01') {
      setActiveMap('mars');
      setRobotFleet([
        { id: 1, nombre: 'Rover-01', estado: 'libre', tarea: 'P01', bateria: 85 },
        { id: 2, nombre: 'Rover-02', estado: 'libre', tarea: 'P01', bateria: 62 },
      ]);
      setArsenicLevel(Math.floor(Math.random() * 50) + 10);
      setPhLevel(+(Math.random() * 4 + 4).toFixed(1)); 
      
      const center = [77.45, 18.44];
      const square = turf.bboxPolygon(turf.bbox(turf.circle(center, 32, { units: 'kilometers' })));
      setPolygonCoords(square.geometry.coordinates);
      setArea(turf.area(square));
      setAnalyzed(false);
      setRouteStatus('idle');
      setGeneratedRoute(null);
      fetchClima('mars');
      addLog(['[SYS] Preset P01 cargado. Mapa: Marte.']);
    } else {
      setActiveMap('earth');
      setRobotFleet([
        { id: 1, nombre: 'Rover-01', estado: 'libre', tarea: 'P02', bateria: 92 },
        { id: 2, nombre: 'Rover-02', estado: 'libre', tarea: 'P02', bateria: 74 },
        { id: 3, nombre: 'Rover-03', estado: 'libre', tarea: 'P02', bateria: 45 },
      ]);
      setArsenicLevel(Math.floor(Math.random() * 50) + 10);
      setPhLevel(+(Math.random() * 4 + 4).toFixed(1)); 
      
      const center = [-107.90, 30.34];
      const square = turf.bboxPolygon(turf.bbox(turf.circle(center, 2, { units: 'kilometers' })));
      setPolygonCoords(square.geometry.coordinates);
      setArea(turf.area(square));
      setAnalyzed(false);
      setRouteStatus('idle');
      setGeneratedRoute(null);
      fetchClima('earth');
      addLog(['[SYS] Preset P02 cargado. Mapa: Tierra.']);
    }
  };

  const resetToSimulator = () => {
    setActiveNav('SIMULADOR');
    setPolygonCoords(null);
    setArea(0);
    setAnalyzed(false);
    setRouteStatus('idle');
    setGeneratedRoute(null);
    setArsenicLevel(15);
    setPhLevel(6.8);
    setClima(null);
    setRobotFleet([
      { id: 1, nombre: 'Rover-01', estado: 'libre', tarea: 'Sin asignar', bateria: 85 },
      { id: 2, nombre: 'Rover-02', estado: 'libre', tarea: 'Sin asignar', bateria: 62 },
    ]);
    addLog(['[SYS] Simulador restablecido.']);
  };

  /* ─── Derived Data ─── */
  const battColor = batteryLevel < 20 ? '#ff4500' : '#ffffff';
  const freeRovers = robotFleet.filter(r => r.estado === 'libre').length;
  const sol = Math.floor((Date.now() - new Date('2024-01-01').getTime()) / (24.62 * 60 * 60 * 1000));
  const weatherTiles = [
    { l: 'Temp', v: clima ? `${clima.temp?.toFixed(1)}°C` : '—' },
    { l: 'Humedad', v: clima ? `${clima.hum}%` : '—' },
    { l: 'Viento', v: clima ? `${clima.viento}km/h` : '—' },
    { l: 'Presión', v: clima ? `${clima.pres}hPa` : '—' },
  ];

  /* ─── Render ─── */
  return (
    <div className="fixed inset-0 bg-black text-white font-mono overflow-hidden flex flex-col">
      {/* ── Background Map ── */}
      <div className="absolute inset-0 z-0 opacity-80 pointer-events-auto">
        <MapaMarte
          activeMap={activeMap}
          setActiveMap={setActiveMap}
          generatedRoute={generatedRoute}
          routeStatus={routeStatus}
          onRouteCompleted={() => { setRouteStatus('completada'); addLog(['[SYS] Inyección completada.']); }}
          onRouteSelected={() => {}}
          refreshToken={robotsToken}
          batteryLevel={batteryLevel}
          failsafeStatus={failsafe}
          setArea={setArea}
          polygonCoords={polygonCoords}
          setPolygonCoords={setPolygonCoords}
          isAnalyzing={analyzing}
          robots={robotFleet}
          onHeatmapGenerated={setHeatmapGrid}
          simulationHeatmapGrid={heatmapGrid}
          simulationRovers={simulationRovers}
          simulationRoutesFull={simulationRoutesFull}
          simulationInjectedCapsules={simulationInjectedCapsules}
        />
        {/* Subtle vignette over the map */}
        <div className="absolute inset-0 bg-black/30 pointer-events-none shadow-[inset_0_0_100px_rgba(0,0,0,0.8)]" />
      </div>

      {/* ── HUD Layer ── */}
      <div className="relative z-10 flex flex-col h-full pointer-events-none">
        
        {/* Header */}
        <header className="flex items-center gap-4 px-4 py-3 bg-black/90 backdrop-blur-md border-b border-white/10 pointer-events-auto shrink-0">
           {/* Logo */}
           <div className="flex items-center gap-3 pr-4 border-r border-white/10">
             <div className="w-8 h-8 rounded-full border border-[#ff4500] overflow-hidden shrink-0 flex items-center justify-center bg-black">
                <img src={teamLogo} alt="MYCO" className="w-full h-full object-contain grayscale sepia hover:grayscale-0 transition-all" />
             </div>
             <span className="text-sm font-bold text-[#ff4500] tracking-[0.2em]">M.Y.C.O</span>
           </div>

           {/* Nav */}
           <div className="flex gap-2">
             <button 
               onClick={resetToSimulator}
               className={`px-4 py-1 text-[0.65rem] tracking-widest border rounded transition-colors ${activeNav === 'SIMULADOR' ? 'border-[#ff4500] text-[#ff4500] bg-[#ff4500]/10' : 'border-transparent text-gray-400 hover:text-white'}`}
             >
               SIMULADOR
             </button>
             <button 
               onClick={() => loadPreset('P01')}
               className={`px-4 py-1 text-[0.65rem] tracking-widest border rounded transition-colors ${activeNav === 'P01' ? 'border-[#ff4500] text-[#ff4500] bg-[#ff4500]/10' : 'border-transparent text-gray-400 hover:text-white'}`}
             >
               P01
             </button>
             <button 
               onClick={() => loadPreset('P02')}
               className={`px-4 py-1 text-[0.65rem] tracking-widest border rounded transition-colors ${activeNav === 'P02' ? 'border-[#ff4500] text-[#ff4500] bg-[#ff4500]/10' : 'border-transparent text-gray-400 hover:text-white'}`}
             >
               P02
             </button>
           </div>

           <div className="flex-1" />

           {/* Landing Page Link */}
           <button
             onClick={() => navigate('/landing')}
             className="px-4 py-1 text-[0.65rem] tracking-widest border border-transparent text-gray-400 hover:text-white hover:border-white/20 rounded transition-colors flex items-center gap-1.5"
           >
             <i className="fas fa-globe text-[#ff4500]"></i>
             LANDING
           </button>

           {/* Status indicators */}
           <div className="flex items-center gap-6 text-[0.65rem]">
             <div className="flex items-center gap-2">
               <Pulse color={failsafe === 'NORMAL' ? '#ffffff' : '#ff4500'} />
               <span className="text-gray-400 tracking-widest">SISTEMA</span>
               <strong className={failsafe === 'NORMAL' ? 'text-white' : 'text-[#ff4500]'}>
                 {failsafe === 'NORMAL' ? 'NOMINAL' : 'ALERTA'}
               </strong>
             </div>
             <div className="text-gray-400 tracking-widest">
               SOL <strong className="text-white ml-1">{sol}</strong>
             </div>
             <div className="text-white font-bold text-sm w-20 text-right">
               {time.toLocaleTimeString('es-MX', { hour12: false })}
             </div>
           </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 flex justify-between p-4 overflow-hidden gap-4">
           
           {/* ── Left Sidebar ── */}
           <aside className="w-[280px] flex flex-col gap-4 overflow-y-auto pointer-events-auto scrollbar-hide">
              
              {/* Mission Header */}
              <div className="bg-black/80 backdrop-blur-lg p-4 rounded-lg relative">
                <span className="text-[0.6rem] text-gray-400 uppercase tracking-widest block mb-1">Misión Activa</span>
                <div className="text-[0.8rem] font-bold text-white tracking-widest uppercase">
                   {activeMap === 'earth' ? 'CHIHUAHUA PILOTO' : 'CRÁTER JEZERO'}
                </div>
                <div className="text-[0.6rem] text-gray-500 mt-1 uppercase tracking-wider">
                   {activeMap === 'earth' ? '30.34°N 107.90°W' : '18.44°N 77.45°E'}
                </div>
                <div className="flex gap-2 mt-4">
                  {['earth', 'mars'].map(m => (
                    <button key={m} onClick={() => { setActiveMap(m as 'earth'|'mars'); setActiveNav('SIMULADOR'); }}
                      className={`flex-1 py-1.5 text-[0.6rem] font-bold tracking-widest border rounded transition-all ${activeMap === m ? 'border-[#ff4500] text-[#ff4500] bg-[#ff4500]/10' : 'border-white/10 text-gray-400 hover:border-white/30'}`}>
                      {m === 'earth' ? 'TIERRA' : 'MARTE'}
                    </button>
                  ))}
                </div>
              </div>

              {/* AI Insights */}
              <div className="bg-black/80 backdrop-blur-lg p-4 rounded-lg relative">
                <span className="text-[0.6rem] text-gray-400 uppercase tracking-widest block mb-4">AI Insights</span>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <GaugeArc value={phLevel} max={14} color="#ffffff" label="pH" />
                  <GaugeArc value={arsenicLevel} max={100} color={arsenicLevel > 22 ? '#ff4500' : '#ffffff'} label="As mg/kg" />
                </div>
                <div className="mt-5 flex flex-col gap-4">
                  <div>
                    <div className="flex justify-between text-[0.6rem] mb-1.5 uppercase tracking-wider">
                       <span className="text-gray-400">Nivel de pH</span>
                       <strong className="text-white">{phLevel.toFixed(1)}</strong>
                    </div>
                    <input type="range" min={0} max={14} step={0.1} value={phLevel} onChange={e => setPhLevel(+e.target.value)}
                      className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white" />
                  </div>
                  <div>
                    <div className="flex justify-between text-[0.6rem] mb-1.5 uppercase tracking-wider">
                       <span className="text-gray-400">Nivel Arsénico</span>
                       <strong className={arsenicLevel > 22 ? 'text-[#ff4500]' : 'text-white'}>{arsenicLevel}</strong>
                    </div>
                    <input type="range" min={0} max={100} value={arsenicLevel} onChange={e => setArsenicLevel(+e.target.value)}
                      className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#ff4500]" />
                  </div>
                </div>
              </div>

              {/* Fleet */}
              <div className="bg-black/80 backdrop-blur-lg p-4 rounded-lg relative flex-1 flex flex-col min-h-[220px]">
                <span className="text-[0.6rem] text-gray-400 uppercase tracking-widest block mb-3">Flota Desplegada</span>
                <div className="flex flex-col gap-3 overflow-y-auto pr-1">
                  {robotFleet.map(robot => (
                    <div key={robot.id} onClick={() => setSelectedRobot(robot)} className="p-3 bg-white/5 border border-white/10 hover:bg-white/10 rounded cursor-pointer transition-colors">
                      <div className="flex justify-between items-center mb-3">
                        <img src={mycoLogo} alt="Rover" className="w-16" />
                         <strong className="text-[0.7rem] text-white tracking-widest uppercase">{robot.nombre}</strong>
                         <span className={`text-[0.5rem] px-2 py-0.5 rounded border tracking-widest uppercase ${robot.estado === 'ocupado' ? 'border-[#ff4500] text-[#ff4500]' : 'border-white/50 text-white'}`}>
                           {robot.estado}
                         </span>
                      </div>
                      <StatusBar label="Energía" value={robot.bateria ?? 75} max={100} color={robot.bateria && robot.bateria < 20 ? '#ff4500' : '#ffffff'} />
                    </div>
                  ))}
                </div>
                <div className="mt-auto pt-4 flex flex-col gap-2">
                  <button onClick={handleAnalyze} disabled={analyzing || isCharging}
                    className={`w-full py-2.5 text-[0.65rem] font-bold tracking-widest border rounded transition-all uppercase ${analyzing ? 'border-[#ff4500]/50 text-[#ff4500] bg-black/40' : 'border-[#ff4500] text-black bg-[#ff4500] hover:bg-transparent hover:text-[#ff4500] shadow-[0_0_15px_rgba(255,69,0,0.4)] hover:shadow-[0_0_25px_rgba(255,69,0,0.6)]'}`}>
                    {analyzing ? `${Math.round(progress)}% — ${phase}` : analyzed ? 'REINICIAR ANÁLISIS' : 'INICIAR ANÁLISIS'}
                  </button>
                  {analyzing && (
                    <div className="h-1 bg-white/10 rounded-full overflow-hidden mt-1">
                       <div className="h-full bg-[#ff4500] transition-all" style={{ width: `${progress}%` }} />
                    </div>
                  )}
                </div>
              </div>
           </aside>

           {/* ── Center Bottom HUD ── */}
           <main className="flex-1 flex flex-col justify-end pointer-events-none pb-0 gap-4">
              {/* Analytics Toggle Button */}
              {polygonCoords && (
                <div className="flex justify-center pointer-events-auto relative z-50">
                   <button 
                     onClick={() => setIsAnalyticsOpen(!isAnalyticsOpen)}
                     className="bg-black/60 backdrop-blur-md px-6 py-2 rounded-full border border-white/10 text-[0.65rem] uppercase tracking-widest text-gray-300 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-2"
                   >
                     <i className={`fas fa-chevron-${isAnalyticsOpen ? 'down' : 'up'}`}></i>
                     {isAnalyticsOpen ? 'Ocultar Analítica' : 'Ver Analítica Detallada'}
                   </button>
                </div>
              )}

              <div className="grid grid-cols-4 gap-4 pointer-events-auto">
                 {[
                   { l: 'ROVERS ACTIVOS', v: freeRovers, s: `/${robotFleet.length}`, c: 'text-white' },
                   { l: 'ÁREA PROCESADA', v: analyzed ? (area/10000).toFixed(2) : '0.00', s: ' ha', c: 'text-[#ff4500]' },
                   { l: 'FERTILIDAD EST.', v: analyzed ? Math.round(Math.min(100, 60 + (7 - Math.abs(phLevel - 7))*8)) : '0', s: '%', c: 'text-white' },
                   { l: 'BATERÍA MEDIA', v: batteryLevel, s: '%', c: battColor === '#ff4500' ? 'text-[#ff4500]' : 'text-white' }
                 ].map(st => (
                   <div key={st.l} className="bg-black/80 backdrop-blur-lg p-4 rounded-lg relative text-center flex flex-col justify-center">
                     <div className="text-[0.55rem] text-gray-400 tracking-widest mb-1.5 uppercase">{st.l}</div>
                     <div className={`text-2xl font-bold font-mono tracking-wider ${st.c}`}>
                        {st.v}<span className="text-sm font-normal text-gray-500 ml-1">{st.s}</span>
                     </div>
                   </div>
                 ))}
              </div>

              {/* Bottom Analytics Drawer */}
              <div className={`w-full bg-black/90 backdrop-blur-2xl border border-white/10 rounded-t-xl transition-all duration-500 ease-in-out pointer-events-auto overflow-hidden ${isAnalyticsOpen ? 'h-[calc(100vh-290px)] opacity-100' : 'h-0 opacity-0 border-transparent'}`}>
                <div className="p-6 h-full overflow-y-auto scrollbar-hide">
                  <EstadisticasPanel 
                    arsenicLevel={arsenicLevel} 
                    area={area} 
                    soilProgressHistory={[]} 
                  />
                </div>
              </div>
           </main>

           {/* ── Right Sidebar ── */}
           <aside className="w-[280px] flex flex-col gap-4 overflow-y-auto pointer-events-auto scrollbar-hide">
              
              {/* Alerts */}
              <div className="bg-black/80 backdrop-blur-lg  p-4 relative shrink-0 rounded-lg">
                <div className="flex justify-between items-center mb-4">
                   <span className="text-[0.6rem] text-gray-400 uppercase tracking-widest">Estado</span>
                   <span className={`text-[0.55rem] px-2 py-0.5 rounded border tracking-widest ${
                      isCharging || failsafe === 'ACTIVE' || arsenicLevel > 22 || phLevel < 6 || phLevel > 8 
                        ? 'border-[#ff4500] text-[#ff4500]' 
                        : (arsenicLevel >= 15 || phLevel < 6.5 || phLevel > 7.5)
                        ? 'border-[#eab308] text-[#eab308]'
                        : 'border-[#22c55e] text-[#22c55e]'
                    }`}>
                      {isCharging || failsafe === 'ACTIVE' || arsenicLevel > 22 || phLevel < 6 || phLevel > 8 
                        ? 'ALERTA' 
                        : (arsenicLevel >= 15 || phLevel < 6.5 || phLevel > 7.5)
                        ? 'ADVERTENCIA'
                        : 'NOMINAL'}
                   </span>
                </div>
                <div className="flex flex-col gap-2">
                   {isCharging ? (
                     <AlertItem severity="critical" text="Carga de emergencia en curso." time="Sistema" />
                   ) : failsafe === 'ACTIVE' ? (
                     <AlertItem severity="critical" text="Retorno automático activado." time="Sistema" />
                   ) : (arsenicLevel > 22 || phLevel < 6 || phLevel > 8) ? (
                     <AlertItem severity="critical" text="Alerta: Suelo con anomalías." time="Actualizado" />
                   ) : (arsenicLevel >= 15 || phLevel < 6.5 || phLevel > 7.5) ? (
                     <AlertItem severity="warning" text="Precaución: Parámetros moderados." time="Actualizado" />
                   ) : (
                     <AlertItem severity="normal" text="Suelo estable y óptimo." time="Actualizado" />
                   )}
                   
                   {(() => {
                      let severity: 'critical' | 'warning' | 'normal' = 'normal';
                      let text = `Nivel de As óptimo: ${arsenicLevel} mg/kg`;
                      if (arsenicLevel > 22) {
                        severity = 'critical';
                        text = `Nivel de As crítico: ${arsenicLevel} mg/kg`;
                      } else if (arsenicLevel >= 15) {
                        severity = 'warning';
                        text = `Nivel de As moderado: ${arsenicLevel} mg/kg`;
                      }
                      return <AlertItem severity={severity} text={text} time="Sensor" />;
                    })()}
                    
                    {(() => {
                      let severity: 'critical' | 'warning' | 'normal' = 'normal';
                      let text = `pH óptimo: ${phLevel.toFixed(1)}`;
                      if (phLevel < 6.0 || phLevel > 8.0) {
                        severity = 'critical';
                        text = `pH crítico fuera de rango: ${phLevel.toFixed(1)}`;
                      } else if (phLevel < 6.5 || phLevel > 7.5) {
                        severity = 'warning';
                        text = `pH moderado en límite: ${phLevel.toFixed(1)}`;
                      }
                      return <AlertItem severity={severity} text={text} time="Sensor" />;
                    })()}
                </div>
              </div>

              {/* Climate Data */}
              <div className="bg-black/80 backdrop-blur-lg p-4 rounded-lg relative shrink-0">
                <span className="text-[0.6rem] text-gray-400 uppercase tracking-widest block mb-3">Climatología</span>
                {!clima ? (
                  <div className="text-center text-[0.6rem] text-gray-500 py-4 uppercase tracking-widest">Sin datos de zona</div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {weatherTiles.map(w => (
                      <div key={w.l} className=" p-2.5 rounded">
                        <div className="text-[0.55rem] text-gray-400 uppercase tracking-wider">{w.l}</div>
                        <div className="text-[0.8rem] font-bold text-white mt-1 font-mono tracking-widest">{w.v}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Injection Zone Status */}
              <div className="bg-black/80 backdrop-blur-lg p-4 rounded-lg relative shrink-0 flex items-center gap-4">
                <div className="relative w-14 h-14 flex-shrink-0 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full " />
                  <div className="absolute inset-1.5 rounded-full border border-white/5" />
                  {analyzed && (
                    <div className="absolute inset-0 rounded-full border border-[#ff4500] opacity-60 animate-spin" style={{ borderTopColor: 'transparent', animationDuration: '3s' }} />
                  )}
                  <div className={`w-3 h-3 rounded-full ${analyzed ? 'bg-[#ff4500] shadow-[0_0_10px_#ff4500]' : 'bg-white/20'}`} />
                </div>
                <div className="flex-1 flex flex-col gap-1.5 text-[0.6rem] uppercase tracking-wider">
                  <div className="flex justify-between"><span className="text-gray-400">Válvula</span><span className={valveOpen ? 'text-white' : 'text-[#ff4500]'}>{valveOpen ? 'ABIERTA' : 'CERRADA'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Ruta</span><span className={analyzed ? 'text-[#ff4500]' : 'text-white'}>{analyzed ? 'ACTIVA' : 'INACTIVA'}</span></div>
                </div>
              </div>

              {/* Rover Control & Console */}
              <div className="bg-black/80 backdrop-blur-lg p-4 rounded-lg relative flex-1 flex flex-col min-h-[160px]">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[0.6rem] text-gray-400 uppercase tracking-widest">Enlace Terminal</span>
                  <span className="text-[0.55rem] text-[#ff4500] animate-pulse">REC</span>
                </div>
                <div ref={consoleRef} className="flex-1 bg-black/50 rounded p-3 overflow-y-auto text-[0.55rem] font-mono flex flex-col gap-1.5 scrollbar-hide">
                  {logs.map((log, i) => (
                    <div key={i} className={log.includes('[AVISO]') || log.includes('[CARGA]') ? 'text-[#ff4500]' : 'text-gray-300'}>
                      {log}
                    </div>
                  ))}
                </div>
              </div>
           </aside>
        </div>
      </div>

      {/* Floating Simulation Play Button */}
      {polygonCoords && (
        <button 
          onClick={handleSimulationToggle}
          className="fixed bottom-8 right-8 w-16 h-16 bg-[#ff4500] rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(255,69,0,0.6)] z-50 text-white hover:bg-white hover:text-[#ff4500] transition-colors"
        >
          {simulationState === 'finished' ? (
            <i className="fas fa-undo text-2xl"></i>
          ) : simulationState === 'playing' ? (
            <i className="fas fa-spinner fa-spin text-2xl"></i>
          ) : (
            <i className="fas fa-play text-2xl pl-1"></i>
          )}
        </button>
      )}

      {/* Robot Details Modal */}
      {selectedRobot && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto" onClick={() => setSelectedRobot(null)}>
          <div className="bg-black/90 backdrop-blur-2xl border border-white/10 rounded-xl w-full max-w-md overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-bold tracking-widest uppercase">{selectedRobot.nombre}</h2>
                  <span className="text-[0.65rem] text-gray-400 uppercase tracking-widest mt-1 block">Unidad de Biorremediación MYCO</span>
                </div>
                <button onClick={() => setSelectedRobot(null)} className="text-gray-400 hover:text-white transition-colors">
                  <i className="fas fa-times text-lg"></i>
                </button>
              </div>
              
              <div className="flex gap-6 items-center mb-6">
                <div className="w-24 h-24 rounded bg-white/5 border border-white/10 flex items-center justify-center p-2 shrink-0">
                  <img src={mycoLogo} alt="Rover" className="w-full h-full object-contain" />
                </div>
                <div className="flex-1 flex flex-col gap-3">
                  <div className="bg-white/5 p-2.5 rounded border border-white/5">
                    <StatusBar label="Nivel de Energía" value={selectedRobot.bateria ?? 75} max={100} color={selectedRobot.bateria && selectedRobot.bateria < 20 ? '#ff4500' : '#22c55e'} />
                  </div>
                  <div className="flex justify-between items-center bg-white/5 p-2.5 rounded border border-white/5">
                    <span className="text-[0.6rem] text-gray-400 uppercase tracking-widest">Estado</span>
                    <span className={`text-[0.65rem] font-bold tracking-widest uppercase ${selectedRobot.estado === 'ocupado' ? 'text-[#ff4500]' : 'text-white'}`}>
                      {selectedRobot.estado}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-white/5 border border-white/10 p-3 rounded flex flex-col items-center justify-center">
                  <span className="text-[0.55rem] text-gray-400 uppercase tracking-widest mb-1">Cápsulas</span>
                  <strong className="text-xl text-[#ff4500] font-mono">{Math.floor(Math.random() * 300) + 150}</strong>
                </div>
                <div className="bg-white/5 border border-white/10 p-3 rounded flex flex-col items-center justify-center">
                  <span className="text-[0.55rem] text-gray-400 uppercase tracking-widest mb-1">Distancia</span>
                  <strong className="text-xl text-white font-mono">{(Math.random() * 5 + 1).toFixed(2)}<span className="text-sm text-gray-500 ml-1">km</span></strong>
                </div>
                <div className="bg-white/5 border border-white/10 p-3 rounded flex flex-col items-center justify-center">
                  <span className="text-[0.55rem] text-gray-400 uppercase tracking-widest mb-1">Área Cubierta</span>
                  <strong className="text-xl text-white font-mono">{(Math.random() * 10 + 2).toFixed(1)}<span className="text-sm text-gray-500 ml-1">ha</span></strong>
                </div>
                <div className="bg-white/5 border border-white/10 p-3 rounded flex flex-col items-center justify-center">
                  <span className="text-[0.55rem] text-gray-400 uppercase tracking-widest mb-1">Misión</span>
                  <strong className="text-sm text-[#ff4500] font-bold mt-1 tracking-widest uppercase">{selectedRobot.tarea || 'Patrulla'}</strong>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[0.6rem] text-gray-400 uppercase tracking-widest mb-1.5">
                  <span>Progreso de Ruta</span>
                  <span className="text-white font-bold">{Math.floor(Math.random() * 60) + 20}%</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-[#ff4500] rounded-full" style={{ width: `${Math.floor(Math.random() * 60) + 20}%` }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
