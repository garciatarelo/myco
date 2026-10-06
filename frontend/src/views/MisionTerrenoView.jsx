import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { apiService } from '../services/api';
import * as turf from '@turf/turf';
import { planSimulationRoutes } from '../utils/utils';
import { Pulse } from '../components/common/Pulse';
import { GaugeArc } from '../components/common/GaugeArc';
import { CapsuleBadge } from '../components/common/CapsuleBadge';
import { MapaMisionTerreno } from '../components/MapaMisionTerreno';
import teamLogo from '../assets/logo.ico';

export default function MisionTerrenoView() {
  const { terrenoId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Estados principales de Terrenos
  const [terrenos, setTerrenos] = useState([]);
  const [terrenoActivo, setTerrenoActivo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Pestaña activa: 'mapa' | 'mediciones' | 'inyecciones' | 'simulador'
  const activeTab = searchParams.get('tab') || 'mapa';
  const setActiveTab = (tab) => {
    setSearchParams({ tab });
  };

  // Datos de la misión del terreno
  const [robotsTerreno, setRobotsTerreno] = useState([]);
  const [todosLosRobots, setTodosLosRobots] = useState([]);
  const [estacionesTerreno, setEstacionesTerreno] = useState([]);
  const [medicionesTerreno, setMedicionesTerreno] = useState([]);
  const [inyeccionesTerreno, setInyeccionesTerreno] = useState([]);

  // Marcador seleccionado para popup/inspección
  const [marcadorSeleccionado, setMarcadorSeleccionado] = useState(null);

  // Modo de mapa expandido al 100% por defecto y visibilidad de paneles flotantes (a la izquierda)
  const [mapaExpandido, setMapaExpandido] = useState(true);
  const [panelesFlotantesVisibles, setPanelesFlotantesVisibles] = useState(true);

  // Modales
  const [asignarModalOpen, setAsignarModalOpen] = useState(false);
  const [nuevaMuestraModalOpen, setNuevaMuestraModalOpen] = useState(false);
  const [inyeccionModalOpen, setInyeccionModalOpen] = useState(false);

  // Estados para vistas de DEM, Clima y Rutas
  const [selectedDemType, setSelectedDemType] = useState('interpolada'); // 'base' | 'interpolada'
  const [hoveredDemCell, setHoveredDemCell] = useState(null);
  const [selectedRoverRouteId, setSelectedRoverRouteId] = useState(null);

  // Parámetros de Simulación en Vivo para este terreno
  const [simuladorActivo, setSimuladorActivo] = useState(false);
  const [simulandoAnimacion, setSimulandoAnimacion] = useState(false);
  const [simParams, setSimParams] = useState({
    humedad: 68,
    ph: 6.8,
    arsenico: 15,
    temperatura: 24,
  });
  const [simRoversPositions, setSimRoversPositions] = useState([]);
  const [simInjectedPoints, setSimInjectedPoints] = useState([]);
  const [logsMision, setLogsMision] = useState([
    '[SYS] Centro de Misión inicializado.',
    '[SYS] Enlace de telemetría seguro establecido.',
  ]);
  const consoleRef = useRef(null);

  const addLog = (line) => {
    const time = new Date().toLocaleTimeString();
    setLogsMision((prev) => [...prev.slice(-40), `[${time}] ${line}`]);
  };

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logsMision]);

  // ─── CARGA INICIAL DE TERRENOS ───
  useEffect(() => {
    cargarTerrenos();
  }, []);

  async function cargarTerrenos() {
    setLoading(true);
    setError('');
    try {
      const data = await apiService.getTerrenos();
      const list = Array.isArray(data) ? data : [];
      setTerrenos(list);

      if (list.length > 0) {
        const idToFind = terrenoId ? Number(terrenoId) : list[0].id;
        const target = list.find((t) => t.id === idToFind) || list[0];
        setTerrenoActivo(target);
      }
    } catch (err) {
      setError('Error al cargar terrenos: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  // Sincronizar si cambia el parámetro terrenoId en la URL (/mision/1 <-> /mision/2)
  useEffect(() => {
    if (terrenos.length > 0 && terrenoId) {
      const target = terrenos.find((t) => t.id === Number(terrenoId));
      if (target && target.id !== terrenoActivo?.id) {
        setTerrenoActivo(target);
        setMarcadorSeleccionado(null);
      }
    }
  }, [terrenoId, terrenos, terrenoActivo?.id]);

  // ─── CARGA DE DATOS ESPECÍFICOS DEL TERRENO ACTIVO ───
  useEffect(() => {
    if (!terrenoActivo) return;
    cargarDatosTerreno(terrenoActivo.id);
  }, [terrenoActivo?.id]);

  async function cargarDatosTerreno(id) {
    try {
      const [terrenoDetalle, todosRobotsRes, estacionesRes, medicionesRes, inyeccionesRes] = await Promise.all([
        apiService.getTerreno(id).catch(() => null),
        apiService.getRobots(),
        apiService.getEstacionesBase(),
        apiService.getMediciones({ terreno_id: id, per_page: 100 }),
        apiService.getInyecciones({ terreno_id: id, per_page: 100 }),
      ]);

      if (terrenoDetalle && terrenoDetalle.id) {
        setTerrenoActivo(terrenoDetalle);
        if (terrenoDetalle.rutas_rovers && terrenoDetalle.rutas_rovers.length > 0) {
          setSelectedRoverRouteId(terrenoDetalle.rutas_rovers[0].rover_id);
        }
      }

      const todos = Array.isArray(todosRobotsRes) ? todosRobotsRes : [];
      setTodosLosRobots(todos);
      const delTerreno = todos.filter((r) => r.terreno_id === id);
      setRobotsTerreno(delTerreno);

      const estaciones = Array.isArray(estacionesRes) ? estacionesRes : [];
      setEstacionesTerreno(estaciones.filter((e) => e.terreno_id === id));

      const meds = medicionesRes?.data || (Array.isArray(medicionesRes) ? medicionesRes : []);
      setMedicionesTerreno(meds);

      const inys = inyeccionesRes?.data || (Array.isArray(inyeccionesRes) ? inyeccionesRes : []);
      setInyeccionesTerreno(inys);

      addLog(`Terreno [${(terrenoDetalle || terrenoActivo).nombre}] cargado con éxito. ${delTerreno.length} Mycos asignados.`);
    } catch (err) {
      console.error('Error al cargar datos del terreno:', err);
      addLog(`[ALERTA] Error al sincronizar telemetría del terreno: ${err.message}`);
    }
  }

  // Cambio de terreno desde el selector
  function handleSelectTerreno(t) {
    setTerrenoActivo(t);
    setMarcadorSeleccionado(null);
    navigate(`/mision/${t.id}?tab=${activeTab}`, { replace: true });
  }

  // ─── CALIBRACIÓN DE POLÍGONO DEL TERRENO ───
  const polygonInfo = useMemo(() => {
    if (!terrenoActivo) return null;

    let coords = terrenoActivo.poligono_coordenadas;
    const center = [
      Number(terrenoActivo.longitud_central) || -107.9025,
      Number(terrenoActivo.latitud_central) || 30.3485,
    ];

    if (!coords || !Array.isArray(coords) || coords.length < 3) {
      // Calcular polígono cuadrado con Turf en base a dimensiones_m2
      const areaM2 = Number(terrenoActivo.dimensiones_m2) || 25000;
      const sideKm = Math.sqrt(areaM2) / 1000;
      const radiusKm = (sideKm * Math.sqrt(2)) / 2;
      const square = turf.bboxPolygon(turf.bbox(turf.circle(center, radiusKm, { units: 'kilometers' })));
      coords = square.geometry.coordinates[0];
    } else {
      if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
        coords = coords[0];
      }
    }

    // Calcular bbox y centro para escalado SVG táctico
    let minLon = Infinity,
      maxLon = -Infinity,
      minLat = Infinity,
      maxLat = -Infinity;
    coords.forEach(([lon, lat]) => {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    });

    // Padding de 20% alrededor para los rovers y sensores
    const lonSpan = Math.max(maxLon - minLon, 0.001);
    const latSpan = Math.max(maxLat - minLat, 0.001);
    const padLon = lonSpan * 0.2;
    const padLat = latSpan * 0.2;

    return {
      coords,
      center,
      bounds: {
        minLon: minLon - padLon,
        maxLon: maxLon + padLon,
        minLat: minLat - padLat,
        maxLat: maxLat + padLat,
      },
    };
  }, [terrenoActivo]);

  // Transformar coordenadas geográficas a espacio SVG (500x350)
  function geoToSvg(lon, lat) {
    if (!polygonInfo) return { x: 250, y: 175 };
    const { bounds } = polygonInfo;
    const normX = (lon - bounds.minLon) / (bounds.maxLon - bounds.minLon);
    const normY = (lat - bounds.minLat) / (bounds.maxLat - bounds.minLat);
    const x = normX * 460 + 20;
    const y = (1 - normY) * 310 + 20; // Invertir Y para SVG
    return { x: Math.max(15, Math.min(485, x)), y: Math.max(15, Math.min(335, y)) };
  }

  // ─── ACCIONES DE ROBOTS EN LA MISIÓN ───
  async function handleCambiarModoRobot(robot) {
    const nuevoModo = robot.modo === 'lectura' ? 'inyeccion' : 'lectura';
    try {
      await apiService.cambiarModoRobot(robot.id, nuevoModo);
      addLog(`Robot [${robot.nombre}] cambiado a Modo ${nuevoModo.toUpperCase()}.`);
      await cargarDatosTerreno(terrenoActivo.id);
    } catch (err) {
      alert('Error al cambiar modo del robot: ' + err.message);
    }
  }

  async function handleIrABase(robot) {
    try {
      await apiService.irABaseRobot(robot.id);
      addLog(`Orden enviada a [${robot.nombre}]: Retornando a Estación Base.`);
      await cargarDatosTerreno(terrenoActivo.id);
    } catch (err) {
      alert('Error al ordenar retorno a base: ' + err.message);
    }
  }

  async function handleAsignarRobot(robotId) {
    try {
      await apiService.asignarRobotATerreno(robotId, terrenoActivo.id);
      addLog(`Robot #${robotId} asignado a la misión [${terrenoActivo.nombre}].`);
      setAsignarModalOpen(false);
      await cargarDatosTerreno(terrenoActivo.id);
    } catch (err) {
      alert('Error al asignar robot: ' + err.message);
    }
  }

  async function handleDesasignarRobot(robotId) {
    try {
      await apiService.asignarRobotATerreno(robotId, null);
      addLog(`Robot #${robotId} retirado de la misión.`);
      await cargarDatosTerreno(terrenoActivo.id);
    } catch (err) {
      alert('Error al desasignar robot: ' + err.message);
    }
  }

  // ─── TOMA DE MUESTRA IN-SITU ───
  async function handleTomarMuestraInSitu(e) {
    e.preventDefault();
    if (robotsTerreno.length === 0) {
      alert('Debes asignar al menos un robot Myco a esta misión para muestrear.');
      return;
    }

    const robotElegido = robotsTerreno.find((r) => r.modo === 'lectura') || robotsTerreno[0];
    const center = polygonInfo?.center || [0, 0];
    // Variación aleatoria controlada dentro del terreno
    const deltaLon = (Math.random() - 0.5) * 0.003;
    const deltaLat = (Math.random() - 0.5) * 0.003;

    try {
      const res = await apiService.crearMedicion({
        robot_id: robotElegido.id,
        terreno_id: terrenoActivo.id,
        latitud: +(center[1] + deltaLat).toFixed(6),
        longitud: +(center[0] + deltaLon).toFixed(6),
        humedad: Number(simParams.humedad),
        ph: Number(simParams.ph),
        temperatura: Number(simParams.temperatura),
        conductividad: +(Math.random() * 2 + 1).toFixed(2),
      });

      addLog(`Nueva muestra registrada por [${robotElegido.nombre}]. pH: ${simParams.ph}, Humedad: ${simParams.humedad}%.`);
      setNuevaMuestraModalOpen(false);
      await cargarDatosTerreno(terrenoActivo.id);
    } catch (err) {
      alert('Error al registrar muestra: ' + err.message);
    }
  }

  // ─── EJECUCIÓN DE INYECCIÓN INTELIGENTE ───
  async function handleEjecutarInyeccionIA() {
    if (robotsTerreno.length === 0) {
      alert('Se requiere al menos un robot en esta misión para inocular.');
      return;
    }
    const robot = robotsTerreno.find((r) => r.modo === 'inyeccion') || robotsTerreno[0];
    const center = polygonInfo?.center || [0, 0];
    const deltaLon = (Math.random() - 0.5) * 0.002;
    const deltaLat = (Math.random() - 0.5) * 0.002;

    try {
      const res = await apiService.ejecutarInyeccionOptimizada({
        robot_id: robot.id,
        terreno_id: terrenoActivo.id,
        latitud: +(center[1] + deltaLat).toFixed(6),
        longitud: +(center[0] + deltaLon).toFixed(6),
        humedad: Number(simParams.humedad),
        ph: Number(simParams.ph),
        temperatura: Number(simParams.temperatura),
      });

      if (res.motivo && !res.inyeccion) {
        addLog(`[ALGORITMO IA] Inyección evitada: ${res.motivo}. Ahorro: ${res.ahorro_recursos_pct}%.`);
        alert(`Inyección optimizada: ${res.motivo} (Ahorro de recursos: ${res.ahorro_recursos_pct}%)`);
      } else {
        addLog(`[INYECCIÓN ÉXITO] Inoculada cápsula Grado ${res.inyeccion?.grado_capsula?.toUpperCase()}.`);
      }

      await cargarDatosTerreno(terrenoActivo.id);
    } catch (err) {
      alert('Error en ejecución de inyección: ' + err.message);
    }
  }

  // ─── MODO SIMULADOR ANIMADO ───
  function handleCorrerSimulacion() {
    if (simulandoAnimacion) return;
    setSimulandoAnimacion(true);
    addLog(`Iniciando simulación de descontaminación en [${terrenoActivo.nombre}]...`);

    const center = polygonInfo?.center || [0, 0];
    const steps = 15;
    let currentStep = 0;

    const interval = setInterval(() => {
      currentStep++;
      const pct = currentStep / steps;

      // Animar posiciones de rovers recorriendo el polígono
      const roversMoving = robotsTerreno.map((r, idx) => {
        const offsetAngle = (idx * Math.PI) / 2 + pct * Math.PI * 2;
        const radius = 0.0015 * Math.sin(pct * Math.PI);
        return {
          id: r.id,
          nombre: r.nombre,
          lon: center[0] + Math.cos(offsetAngle) * radius,
          lat: center[1] + Math.sin(offsetAngle) * radius,
        };
      });
      setSimRoversPositions(roversMoving);

      // Descontaminación gradual
      setSimParams((prev) => ({
        ...prev,
        arsenico: Math.max(5, Math.round(prev.arsenico * (1 - 0.06))),
        ph: +(prev.ph + (7.0 - prev.ph) * 0.08).toFixed(1),
        humedad: Math.min(85, Math.round(prev.humedad + 1)),
      }));

      if (currentStep >= steps) {
        clearInterval(interval);
        setSimulandoAnimacion(false);
        setSimRoversPositions([]);
        addLog(`Simulación completada. Parámetros estabilizados: pH 7.0, Humedad óptima.`);
      }
    }, 400);
  }

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-[#131313] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#ff4500] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-gray-400 font-mono tracking-wider">
            Sincronizando Misión del Terreno...
          </span>
        </div>
      </div>
    );
  }

  if (!terrenoActivo) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-[#131313] p-8 text-center flex flex-col items-center justify-center">
        <h2 className="text-lg font-bold font-mono text-white mb-2">No hay terrenos registrados</h2>
        <p className="text-xs text-gray-400 mb-4">Debes dar de alta una parcela para iniciar la misión.</p>
        <button
          onClick={() => navigate('/terrenos')}
          className="px-4 py-2 bg-[#ff4500] text-white font-mono font-bold text-xs rounded-xl"
        >
          Ir a Gestión de Terrenos
        </button>
      </div>
    );
  }

  const isMarte = terrenoActivo.entorno === 'marte';
  const freeRobotsCount = robotsTerreno.filter((r) => r.estado === 'activo' || r.estado === 'libre').length;

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#131313] text-white font-mono flex flex-col">
      {/* ─── HUD BAR SUPERIOR: SELECTOR DE TERRENO Y METADATOS ─── */}
      <div className="px-4 py-3 bg-[#131313] border-b border-[#262626] flex flex-wrap items-center justify-between gap-3 shrink-0">
        {/* Selector de Terreno */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#ff4500]/15 border border-[#ff4500]/30 flex items-center justify-center text-[#ff4500]">
              <i className="fa-solid fa-map-location-dot text-sm" />
            </div>
            <div>
              <span className="text-[0.6rem] text-gray-400 uppercase tracking-widest block">
                Terreno en Operación
              </span>
              <div className="flex items-center gap-2">
                <select
                  value={terrenoActivo.id}
                  onChange={(e) => {
                    const found = terrenos.find((t) => t.id === Number(e.target.value));
                    if (found) handleSelectTerreno(found);
                  }}
                  className="bg-black/60 border border-[#262626] text-white text-xs font-bold rounded-lg px-2.5 py-1 outline-none focus:border-[#ff4500] cursor-pointer"
                >
                  {terrenos.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre} ({t.entorno === 'marte' ? 'Marte' : 'Tierra'})
                    </option>
                  ))}
                </select>

                <span
                  className={`text-[0.65rem] px-2 py-0.5 rounded-full font-bold border ${
                    isMarte
                      ? 'bg-[#ff4500]/15 text-[#ff4500] border-[#ff4500]/30'
                      : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  }`}
                >
                  {isMarte ? 'Marte' : 'Tierra'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Métricas rápidas del terreno */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {/* Chip Clima */}
          {terrenoActivo.condiciones_terreno?.clima && (
            <div
              onClick={() => setActiveTab('condiciones')}
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[0.68rem] cursor-pointer hover:bg-cyan-500/20 transition-colors"
              title="Ver reporte meteorológico completo"
            >
              <i className="fa-solid fa-cloud-sun text-cyan-400" />
              <span>
                {terrenoActivo.condiciones_terreno.clima.temp ?? terrenoActivo.condiciones_terreno.clima.temperatura ?? 22}&deg;C &bull;{' '}
                {terrenoActivo.condiciones_terreno.clima.humedad ?? terrenoActivo.condiciones_terreno.clima.humidity ?? 45}% Hum
              </span>
            </div>
          )}

          {/* Chip DEM Relieve */}
          {terrenoActivo.elevacion_data && (
            <div
              onClick={() => setActiveTab('relieve')}
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[0.68rem] cursor-pointer hover:bg-emerald-500/20 transition-colors"
              title="Ver análisis de elevación y matriz DEM"
            >
              <i className="fa-solid fa-mountain-sun text-emerald-400" />
              <span>
                DEM: {terrenoActivo.elevacion_data.min}m - {terrenoActivo.elevacion_data.max}m (Δ {terrenoActivo.elevacion_data.diff}m)
              </span>
            </div>
          )}

          {/* Chip WiFi */}
          {terrenoActivo.red_wifi_ssid && (
            <div
              className="hidden xl:flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/40 border border-white/10 text-gray-400 text-[0.65rem]"
              title={`Red Wi-Fi: ${terrenoActivo.red_wifi_ssid} (${terrenoActivo.red_wifi_status || 'activa'})`}
            >
              <i className="fa-solid fa-wifi text-gray-400" />
              <span className="truncate max-w-[110px]">{terrenoActivo.red_wifi_ssid}</span>
            </div>
          )}

          <div className="hidden sm:flex flex-col text-right">
            <span className="text-[0.6rem] text-gray-400 uppercase">Área Calibrada</span>
            <span className="text-white font-bold text-[0.7rem]">
              {Number(terrenoActivo.dimensiones_m2).toLocaleString()} m²
            </span>
          </div>

          <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-black/40 border border-[#262626] text-[0.7rem]">
            <Pulse color="#22c55e" size="w-1.5 h-1.5" />
            <span className="text-gray-300">Mycos:</span>
            <strong className="text-emerald-400">{robotsTerreno.length}</strong>
          </div>

          <button
            onClick={() => setAsignarModalOpen(true)}
            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 hover:border-white/20 text-xs transition-colors flex items-center gap-1.5"
            title="Asignar o desasignar robots a esta parcela"
          >
            <i className="fa-solid fa-robot text-[#ff4500]" />
            <span>Asignar</span>
          </button>
        </div>
      </div>

      {/* ─── PESTAÑAS DE NAVEGACIÓN DE LA MISIÓN ─── */}
      <div className="px-4 py-2 flex items-center justify-between gap-2 overflow-x-auto bg-[#131313]/90 border-b border-[#262626]">
        <div className="flex items-center gap-1">
          {[
            { id: 'mapa', label: 'Mapa & Rutas Tácticas', icon: 'fa-solid fa-satellite' },
            {
              id: 'condiciones',
              label: 'Clima & SoilGrids',
              icon: 'fa-solid fa-cloud-sun-rain',
              badge: terrenoActivo.condiciones_terreno ? 'IA' : null,
              badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
            },
            {
              id: 'relieve',
              label: 'Relieve & Matriz DEM',
              icon: 'fa-solid fa-mountain-sun',
              badge: terrenoActivo.elevacion_data ? 'DEM' : null,
              badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
            },
            {
              id: 'rutas',
              label: `Misión Rovers (${terrenoActivo?.rutas_rovers?.length || 0})`,
              icon: 'fa-solid fa-route',
              badge: terrenoActivo.rutas_rovers?.length ? `${terrenoActivo.rutas_rovers.length}` : null,
              badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
            },
            { id: 'mediciones', label: `Mediciones (${medicionesTerreno.length})`, icon: 'fa-solid fa-vial-virus' },
            { id: 'inyecciones', label: `Inyecciones (${inyeccionesTerreno.length})`, icon: 'fa-solid fa-syringe' },
            { id: 'simulador', label: 'Simulador', icon: 'fa-solid fa-sliders' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-white/10 text-[#ffffff] border border-[#ffffff]/30 font-bold shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <i className={tab.icon} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className={`text-[0.55rem] px-1.5 py-0.2 rounded-full border font-bold ${tab.badgeColor}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Acceso rápido a gestión de parcelas */}
        <button
          onClick={() => navigate('/terrenos')}
          className="text-xs text-gray-400 hover:text-white px-2.5 py-1 rounded hover:bg-white/5 flex items-center gap-1.5 transition-colors shrink-0"
        >
          <i className="fa-solid fa-cubes-stacked" />
          <span>Parcelas</span>
        </button>
      </div>

      {/* ─── CONTENIDO PRINCIPAL SEGÚN PESTAÑA ─── */}
      <div className="flex-1 p-4 overflow-y-auto">
        {/* ========================================================
            PESTAÑA 1: MAPA TÁCTICO & RADAR CON MARCADORES CLICKEABLES
           ======================================================== */}
        {activeTab === 'mapa' && (() => {
          const sidePanelsContent = (
            <>
              {/* INSPECTOR DE MARCADOR CLICKEADO */}
              {marcadorSeleccionado ? (
                <div className="bg-[#181818] border border-[#ff4500]/40 rounded-2xl p-4 shadow-xl relative animate-fadeIn">
                  <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/10">
                    <span className="text-xs font-bold text-[#ff4500] uppercase tracking-wider flex items-center gap-1.5">
                      <i className={marcadorSeleccionado.tipo === 'medicion' ? 'fa-solid fa-vial-virus' : 'fa-solid fa-syringe'} />
                      Telemetría de Punto Seleccionado
                    </span>
                    <button
                      onClick={() => setMarcadorSeleccionado(null)}
                      className="text-gray-400 hover:text-white text-xs cursor-pointer"
                    >
                      <i className="fa-solid fa-xmark" />
                    </button>
                  </div>

                  {marcadorSeleccionado.tipo === 'medicion' ? (
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Muestra ID:</span>
                        <strong className="text-white">#{marcadorSeleccionado.data.id}</strong>
                      </div>
                      <div className="grid grid-cols-2 gap-2 p-2 bg-black/40 rounded-lg">
                        <div>
                          <span className="text-[0.65rem] text-gray-400 block">pH Suelo</span>
                          <span className="text-white font-bold text-sm">{marcadorSeleccionado.data.ph}</span>
                        </div>
                        <div>
                          <span className="text-[0.65rem] text-gray-400 block">Humedad</span>
                          <span className="text-cyan-400 font-bold text-sm">{marcadorSeleccionado.data.humedad}%</span>
                        </div>
                        <div>
                          <span className="text-[0.65rem] text-gray-400 block">Temperatura</span>
                          <span className="text-white font-bold text-sm">{marcadorSeleccionado.data.temperatura}°C</span>
                        </div>
                        <div>
                          <span className="text-[0.65rem] text-gray-400 block">Conductividad</span>
                          <span className="text-white font-bold text-sm">{marcadorSeleccionado.data.conductividad || '1.4'} dS/m</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center pt-1">
                        <span className="text-gray-400 text-[0.65rem]">Dictamen IA:</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[0.65rem] font-bold ${
                            marcadorSeleccionado.data.es_optimo_inyeccion
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {marcadorSeleccionado.data.es_optimo_inyeccion ? 'Óptimo para Inoculación' : 'Sub-óptimo'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Inyección ID:</span>
                        <strong className="text-white">#{marcadorSeleccionado.data.id}</strong>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Grado Inoculado:</span>
                        <CapsuleBadge grado={marcadorSeleccionado.data.grado_capsula} />
                      </div>
                      <div className="grid grid-cols-2 gap-2 p-2 bg-black/40 rounded-lg">
                        <div>
                          <span className="text-[0.65rem] text-gray-400 block">Ahorro Recurso</span>
                          <span className="text-emerald-400 font-bold text-sm">{marcadorSeleccionado.data.ahorro_recurso_porcentaje || 40}%</span>
                        </div>
                        <div>
                          <span className="text-[0.65rem] text-gray-400 block">Expansión Hifas</span>
                          <span className="text-[#ff4500] font-bold text-sm">{marcadorSeleccionado.data.expansion_micelio_estimada_cm || 18} cm</span>
                        </div>
                      </div>
                      <p className="text-[0.65rem] text-gray-400 bg-black/30 p-2 rounded border border-white/5">
                        {marcadorSeleccionado.data.justificacion_algoritmo || 'Inoculación optimizada por máxima retención hídrica.'}
                      </p>
                    </div>
                  )}
                </div>
              ) : null}

              {/* RESUMEN RÁPIDO DE PARCELA & METODOLOGÍAS IA */}
              {(terrenoActivo.condiciones_terreno || terrenoActivo.elevacion_data || (terrenoActivo.rutas_rovers && terrenoActivo.rutas_rovers.length > 0)) && (
                <div className="bg-[#181818] border border-white/10 rounded-2xl p-3.5 shadow-xl space-y-2.5">
                  <div className="flex items-center justify-between pb-1.5 border-b border-white/10 text-[0.68rem]">
                    <span className="font-bold text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
                      <i className="fa-solid fa-microchip text-cyan-400" />
                      <span>Análisis & Datos de Parcela</span>
                    </span>
                    <span className="text-[0.6rem] text-emerald-400 font-bold">Activo</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {/* Clima Mini */}
                    {terrenoActivo.condiciones_terreno?.clima && (
                      <div
                        onClick={() => setActiveTab('condiciones')}
                        className="p-2 bg-black/40 rounded-xl border border-white/5 cursor-pointer hover:border-cyan-500/40 transition-colors"
                      >
                        <span className="text-[0.6rem] text-gray-400 uppercase block">Clima</span>
                        <span className="text-white font-bold text-xs block">
                          {terrenoActivo.condiciones_terreno.clima.temp ?? 22}&deg;C
                        </span>
                        <span className="text-[0.55rem] text-cyan-400">Ver reporte &rarr;</span>
                      </div>
                    )}

                    {/* DEM Mini */}
                    {terrenoActivo.elevacion_data && (
                      <div
                        onClick={() => setActiveTab('relieve')}
                        className="p-2 bg-black/40 rounded-xl border border-white/5 cursor-pointer hover:border-emerald-500/40 transition-colors"
                      >
                        <span className="text-[0.6rem] text-gray-400 uppercase block">Relieve DEM</span>
                        <span className="text-white font-bold text-xs block">
                          Δ {terrenoActivo.elevacion_data.diff} m
                        </span>
                        <span className="text-[0.55rem] text-emerald-400">Ver matriz &rarr;</span>
                      </div>
                    )}

                    {/* Rutas Mini */}
                    {terrenoActivo.rutas_rovers && terrenoActivo.rutas_rovers.length > 0 && (
                      <div
                        onClick={() => setActiveTab('rutas')}
                        className="p-2 bg-black/40 rounded-xl border border-white/5 cursor-pointer hover:border-amber-500/40 transition-colors col-span-2"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-[0.6rem] text-gray-400 uppercase block">Rutas Planificadas</span>
                            <span className="text-white font-bold text-xs">
                              {terrenoActivo.rutas_rovers.length} Rovers &bull;{' '}
                              {terrenoActivo.rutas_rovers.reduce((acc, r) => acc + (r.waypoints?.length || 0), 0)} Puntos
                            </span>
                          </div>
                          <span className="text-[0.55rem] text-amber-400 font-bold">Ver rutas &rarr;</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* FLOTA DE ROBOTS ASIGNADA A ESTE TERRENO */}
              <div className="bg-[#181818] border border-[#262626] rounded-2xl p-4 flex-1 flex flex-col justify-between shadow-xl">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <i className="fa-solid fa-robot text-[#ff4500]" />
                      Mycos en Operación ({robotsTerreno.length})
                    </span>
                    <button
                      onClick={() => setAsignarModalOpen(true)}
                      className="text-[0.65rem] text-[#ff4500] hover:underline cursor-pointer"
                    >
                      + Gestionar
                    </button>
                  </div>

                  {robotsTerreno.length === 0 ? (
                    <div className="p-4 bg-black/40 border border-dashed border-white/10 rounded-xl text-center">
                      <p className="text-xs text-gray-400 mb-2">No hay robots asignados a este terreno.</p>
                      <button
                        onClick={() => setAsignarModalOpen(true)}
                        className="px-3 py-1.5 bg-[#ff4500] text-white rounded-lg text-xs font-bold cursor-pointer"
                      >
                        Asignar un Myco
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                      {robotsTerreno.map((robot) => {
                        const battColor = robot.bateria < 20 ? '#ef4444' : robot.bateria < 50 ? '#f59e0b' : '#10b981';
                        const isLectura = robot.modo === 'lectura';

                        return (
                          <div
                            key={robot.id}
                            className="p-3 bg-black/50 border border-white/10 rounded-xl flex flex-col gap-2"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-xs">{robot.nombre}</span>
                                <span
                                  className={`text-[0.6rem] px-1.5 py-0.2 rounded font-bold uppercase ${
                                    isLectura
                                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                                      : 'bg-[#ff4500]/10 text-[#ff4500] border border-[#ff4500]/20'
                                  }`}
                                >
                                  {robot.modo}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 text-xs">
                                <i className="fa-solid fa-battery-three-quarters" style={{ color: battColor }} />
                                <span style={{ color: battColor }} className="font-bold">{robot.bateria}%</span>
                              </div>
                            </div>

                            {/* Acciones del robot directamente en el dashboard de misión */}
                            <div className="flex items-center gap-1.5 pt-1 border-t border-white/5">
                              <button
                                onClick={() => handleCambiarModoRobot(robot)}
                                className="flex-1 py-1 rounded bg-white/5 hover:bg-white/10 text-[0.65rem] text-gray-200 border border-white/10 transition-colors cursor-pointer"
                                title="Cambiar entre modo Lectura (sensores) e Inyección (cápsulas)"
                              >
                                Modo {isLectura ? 'Inyección' : 'Lectura'}
                              </button>
                              <button
                                onClick={() => handleIrABase(robot)}
                                className="py-1 px-2 rounded bg-amber-500/10 hover:bg-amber-500/20 text-[0.65rem] text-amber-400 border border-amber-500/20 transition-colors cursor-pointer"
                                title="Enviar robot a la estación base a recargar"
                              >
                                Base
                              </button>
                              <button
                                onClick={() => handleDesasignarRobot(robot.id)}
                                className="py-1 px-1.5 rounded text-gray-500 hover:text-red-400 text-xs cursor-pointer"
                                title="Quitar de este terreno"
                              >
                                <i className="fa-solid fa-xmark" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Consola de Eventos de Misión */}
                <div className="mt-3 pt-3 border-t border-white/10">
                  <span className="text-[0.6rem] text-gray-400 uppercase tracking-widest block mb-1">
                    Telemetría en Vivo
                  </span>
                  <div
                    ref={consoleRef}
                    className="h-24 bg-black/60 rounded-lg p-2 overflow-y-auto text-[0.6rem] font-mono text-gray-400 flex flex-col gap-1 border border-white/5"
                  >
                    {logsMision.map((log, idx) => (
                      <div key={idx} className="leading-snug">
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          );

          return (
            <div
              className={`relative w-full transition-all duration-300 ${
                mapaExpandido
                  ? 'h-[calc(100vh-140px)] min-h-[640px] rounded-2xl overflow-hidden'
                  : 'grid grid-cols-1 lg:grid-cols-12 gap-4 h-full'
              }`}
            >
              {/* Contenedor del Mapa MapBox GL / NASA Viking Marte */}
              <div
                className={`${
                  mapaExpandido ? 'w-full h-full p-3' : 'lg:col-span-8 p-4'
                }  rounded-2xl flex flex-col justify-between relative min-h-[500px]`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[0.65rem] font-bold text-[#ff4500] tracking-wider uppercase">
                      {isMarte ? 'Mosaico NASA Viking 232m' : 'MapBox Satellite Streets'}
                    </span>
                    <span className="text-gray-600">•</span>
                    <span className="text-xs text-gray-300">
                      {isMarte ? 'Cráter Jezero · Cuadrante Ares (Marte)' : 'Valle de Inoculación Alpha (Tierra)'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-[0.65rem] text-gray-400">
                    <button
                      onClick={() => setMapaExpandido(!mapaExpandido)}
                      className={`px-2.5 py-1 rounded-lg border text-[0.65rem] font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-lg ${
                        mapaExpandido
                          ? 'bg-[#ff4500] text-white border-[#ff4500] shadow-[0_0_10px_rgba(255,69,0,0.5)]'
                          : 'bg-black/70 hover:bg-black text-gray-200 hover:text-white border-white/10 hover:border-[#ff4500]'
                      }`}
                      title={mapaExpandido ? 'Contraer a vista dividida' : 'Expandir mapa al 100% y flotar paneles a la izquierda'}
                    >
                      <i className={`fa-solid ${mapaExpandido ? 'fa-compress' : 'fa-expand'} text-white`} />
                      <span>{mapaExpandido ? 'Contraer Mapa' : 'Expandir 100%'}</span>
                    </button>

                    <span className="hidden sm:inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" /> Muestras ({medicionesTerreno.length})
                    </span>
                    <span className="hidden sm:inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#ff4500] inline-block" /> Inyecciones ({inyeccionesTerreno.length})
                    </span>
                    <span className="hidden sm:inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Mycos ({robotsTerreno.length})
                    </span>
                  </div>
                </div>

                {/* Contenedor Visual del Mapa */}
                <div className="relative flex-1 w-full min-h-[440px] rounded-xl overflow-hidden border border-white/5 flex">
                  <MapaMisionTerreno
                    terreno={terrenoActivo}
                    robots={robotsTerreno}
                    estaciones={estacionesTerreno}
                    mediciones={medicionesTerreno}
                    inyecciones={inyeccionesTerreno}
                    marcadorSeleccionado={marcadorSeleccionado}
                    onSelectMarker={setMarcadorSeleccionado}
                    simRoversPositions={simRoversPositions}
                    isExpanded={mapaExpandido}
                    onToggleExpand={() => setMapaExpandido(!mapaExpandido)}
                    rutasRovers={terrenoActivo.rutas_rovers}
                    clustersMuestreo={terrenoActivo.clusters_muestreo}
                  />
                </div>

                {/* Barra inferior del mapa: Acciones rápidas de terreno */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setNuevaMuestraModalOpen(true)}
                      className="px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <i className="fa-solid fa-vial" />
                      <span>Simular Muestreo In-Situ</span>
                    </button>
                    <button
                      onClick={handleEjecutarInyeccionIA}
                      className="px-3 py-1.5 rounded-lg bg-[#ff4500]/10 hover:bg-[#ff4500]/20 text-[#ff4500] border border-[#ff4500]/30 font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <i className="fa-solid fa-syringe" />
                      <span>Inyección Inteligente IA</span>
                    </button>
                  </div>

                  <span className="text-[0.65rem] text-gray-400">
                    Haz clic en cualquier marcador del mapa para ver telemetría.
                  </span>
                </div>
              </div>

              {/* Paneles Flotantes a la Izquierda en Modo Expandido (o Columna Derecha Docked en Modo Normal) */}
              {mapaExpandido ? (
                <>
                  <div className="absolute top-28 left-6 z-30 flex items-center gap-2 pointer-events-auto">
                    <button
                      onClick={() => setPanelesFlotantesVisibles(!panelesFlotantesVisibles)}
                      className={`px-3 py-2 rounded-xl backdrop-blur-xl border text-xs font-bold flex items-center gap-2 shadow-2xl transition-all cursor-pointer ${
                        panelesFlotantesVisibles
                          ? 'bg-black/90 text-white border-white/20 hover:border-[#ff4500]'
                          : 'bg-[#ff4500] text-white border-[#ff4500] shadow-[0_0_15px_rgba(255,69,0,0.6)]'
                      }`}
                      title="Mostrar u ocultar paneles de control sobre el mapa"
                    >
                      <i className={`fa-solid ${panelesFlotantesVisibles ? 'fa-eye-slash text-gray-400' : 'fa-sliders text-white'}`} />
                      <span>{panelesFlotantesVisibles ? 'Ocultar Paneles Flotantes' : 'Ver Paneles Flotantes'}</span>
                    </button>
                  </div>

                  {panelesFlotantesVisibles && (
                    <div className="absolute top-40 left-6 z-20 w-80 sm:w-96 max-h-[calc(100%-11.5rem)] overflow-y-auto bg-black/90 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-2xl p-4 flex flex-col gap-3 scrollbar-thin scrollbar-thumb-white/20 animate-fadeIn pointer-events-auto">
                      <div className="flex items-center justify-between pb-2 border-b border-white/10 text-xs">
                        <span className="text-[0.65rem] uppercase font-bold text-gray-400 tracking-wider flex items-center gap-1.5">
                          <i className="fa-solid fa-layer-group text-[#ff4500]" />
                          Consola Flotante de Misión
                        </span>
                        <button
                          onClick={() => setPanelesFlotantesVisibles(false)}
                          className="text-gray-400 hover:text-white text-xs px-1 cursor-pointer"
                          title="Minimizar panel flotante"
                        >
                          <i className="fa-solid fa-chevron-left" />
                        </button>
                      </div>
                      {sidePanelsContent}
                    </div>
                  )}
                </>
              ) : (
                <div className="lg:col-span-4 flex flex-col gap-4">
                  {sidePanelsContent}
                </div>
              )}
            </div>
          );
        })()}

        {/* ========================================================
            PESTAÑA: CONDICIONES AMBIENTALES & SOILGRIDS (IA)
           ======================================================== */}
        {activeTab === 'condiciones' && (
          <div className="space-y-4">
            {/* Cabecera */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#181818] border border-[#262626] rounded-2xl">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <i className="fa-solid fa-cloud-sun-rain text-cyan-400" />
                  <span>Condiciones Agroclimáticas & Análisis Edáfico SoilGrids</span>
                </h3>
                <p className="text-xs text-gray-400">
                  Integración multisensorial satelital (OpenWeather + SoilGrids 250m/px) y diagnóstico del autómata celular para {terrenoActivo.nombre}.
                </p>
              </div>
              <button
                onClick={() => navigate('/terrenos')}
                className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 text-xs font-mono transition-colors self-start sm:self-auto"
              >
                Gestionar Parcela
              </button>
            </div>

            {!terrenoActivo.condiciones_terreno ? (
              <div className="p-8 bg-[#181818] border border-dashed border-white/10 rounded-2xl text-center space-y-3">
                <i className="fa-solid fa-circle-exclamation text-amber-400 text-3xl" />
                <h4 className="text-sm font-bold text-white">Sin Condiciones Guardadas</h4>
                <p className="text-xs text-gray-400 max-w-md mx-auto">
                  Este terreno no tiene datos agroclimáticos guardados. Puedes recalcularlos o dar de alta una nueva parcela con escaneo IA.
                </p>
                <button
                  onClick={() => navigate('/terrenos/crear')}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs rounded-xl"
                >
                  Crear Terreno con Escaneo IA
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* FILA 1: CLIMA OPENWEATHER + DIAGNÓSTICO AUTÓMATA */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Tarjeta de Clima Satelital */}
                  <div className="lg:col-span-1 p-4 rounded-2xl bg-[#181818] border border-white/10 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
                        <span className="text-[0.68rem] uppercase font-bold text-cyan-400 tracking-wider flex items-center gap-1.5">
                          <i className="fa-solid fa-satellite" />
                          Meteorología Satelital
                        </span>
                        <span className="text-[0.6rem] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-bold">
                          OpenWeather
                        </span>
                      </div>

                      {(() => {
                        const clima = terrenoActivo.condiciones_terreno?.clima || {};
                        const temp = clima.temp ?? clima.temperatura ?? 22.0;
                        const hum = clima.humedad ?? clima.humidity ?? 45;
                        const pres = clima.presion ?? clima.pressure ?? 1013;
                        const viento = clima.viento_velocidad ?? clima.wind_speed ?? 12.0;
                        const desc = clima.descripcion ?? clima.description ?? 'Cielo Despejado';

                        return (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between bg-black/40 p-3 rounded-xl border border-white/5">
                              <div>
                                <span className="text-2xl font-bold text-white block">{temp}&deg;C</span>
                                <span className="text-[0.68rem] text-gray-400 capitalize">{desc}</span>
                              </div>
                              <div className="text-3xl text-cyan-400">
                                <i className="fa-solid fa-cloud-sun" />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="p-2.5 rounded-lg bg-black/30 border border-white/5">
                                <span className="text-[0.62rem] text-gray-400 block">Humedad</span>
                                <span className="text-cyan-300 font-bold">{hum}%</span>
                              </div>
                              <div className="p-2.5 rounded-lg bg-black/30 border border-white/5">
                                <span className="text-[0.62rem] text-gray-400 block">Viento</span>
                                <span className="text-emerald-300 font-bold">{viento} km/h</span>
                              </div>
                              <div className="p-2.5 rounded-lg bg-black/30 border border-white/5">
                                <span className="text-[0.62rem] text-gray-400 block">Presión</span>
                                <span className="text-white font-bold">{pres} hPa</span>
                              </div>
                              <div className="p-2.5 rounded-lg bg-black/30 border border-white/5">
                                <span className="text-[0.62rem] text-gray-400 block">Sensación</span>
                                <span className="text-amber-300 font-bold">{clima.feels_like || temp}&deg;C</span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="mt-3 pt-2 border-t border-white/5 text-[0.65rem] text-emerald-400 flex items-center gap-1.5 font-bold">
                      <i className="fa-solid fa-circle-check" />
                      <span>Condiciones climáticas favorables para patrullaje de rovers</span>
                    </div>
                  </div>

                  {/* Diagnóstico Autómata Celular & Cápsulas Miceliales */}
                  <div className="lg:col-span-2 p-4 rounded-2xl bg-[#181818] border border-white/10 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
                        <span className="text-[0.68rem] uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1.5">
                          <i className="fa-solid fa-dna" />
                          Diagnóstico del Autómata Celular & Regeneración Micelial
                        </span>
                        <span className="text-[0.6rem] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-bold">
                          Myco IA Engine
                        </span>
                      </div>

                      {(() => {
                        const metrics = terrenoActivo.condiciones_terreno?.metrics || terrenoActivo.condiciones_terreno?.automata || {};
                        const soil = terrenoActivo.condiciones_terreno?.soil_summary || {};
                        const textura = metrics.textura_predominante || soil.textura_estimada || 'Franca';
                        const phMedio = metrics.ph_medio || soil.ph_h2o || 6.5;
                        const capsula = metrics.capsulas_recomendadas || 'Grado B (Equilibrada)';

                        return (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1">
                              <span className="text-[0.62rem] text-gray-400 uppercase block">Textura Predominante</span>
                              <span className="text-white font-bold text-sm block">{textura}</span>
                              <p className="text-[0.65rem] text-gray-400">
                                Porosidad apta para expansión de hifas y retención hídrica.
                              </p>
                            </div>

                            <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1">
                              <span className="text-[0.62rem] text-gray-400 uppercase block">pH Medio de Parcela</span>
                              <div className="flex items-baseline gap-1.5">
                                <span className="text-emerald-400 font-bold text-lg">{phMedio}</span>
                                <span className="text-[0.65rem] text-gray-400">
                                  {phMedio < 6 ? '(Ácido)' : phMedio > 7.5 ? '(Alcalino)' : '(Neutro Óptimo)'}
                                </span>
                              </div>
                              <p className="text-[0.65rem] text-gray-400">
                                Compatible con inoculación de biopolímeros miceliales.
                              </p>
                            </div>

                            <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1">
                              <span className="text-[0.62rem] text-gray-400 uppercase block">Cápsula Recomendada</span>
                              <span className="text-cyan-300 font-bold text-xs block">{capsula}</span>
                              <p className="text-[0.65rem] text-gray-400">
                                Dosis estimada: <b className="text-white">1 cápsula / 4 m&sup2;</b>
                              </p>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="mt-4 p-2.5 rounded-xl bg-black/30 border border-white/5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <i className="fa-solid fa-leaf text-emerald-400" />
                        <span className="text-gray-300 text-[0.7rem]">
                          Balance edáfico: <b>{terrenoActivo.condiciones_terreno?.metrics?.balance_nutrientes || 'Favorable para desarrollo micelial'}</b>
                        </span>
                      </div>
                      <button
                        onClick={() => setActiveTab('inyecciones')}
                        className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-[0.65rem] font-bold"
                      >
                        Planificar Inyecciones
                      </button>
                    </div>
                  </div>
                </div>

                {/* FILA 2: ANÁLISIS EDÁFICO SOILGRIDS (250m) + COMPOSICIÓN GRANULOMÉTRICA */}
                <div className="p-4 rounded-2xl bg-[#181818] border border-white/10 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-white/10">
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <i className="fa-solid fa-flask-vial text-amber-400" />
                      Propiedades Físico-Químicas del Suelo (SoilGrids v2 - 250m/px)
                    </span>
                    <span className="text-[0.62rem] text-gray-400 font-mono">
                      Resolución espacial satelital ISRIC SoilGrids
                    </span>
                  </div>

                  {(() => {
                    const soil = terrenoActivo.condiciones_terreno?.soil_summary || {};
                    const ph = soil.ph_h2o || 6.8;
                    const soc = soil.soc || 14.5; // g/kg
                    const nitrogen = soil.nitrogen || 135; // cg/kg
                    const clay = soil.clay || 24; // %
                    const sand = soil.sand || 42; // %
                    const silt = soil.silt || 34; // %

                    return (
                      <div className="space-y-4">
                        {/* Indicadores en Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-center">
                          <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                            <span className="text-[0.6rem] text-gray-400 uppercase block">pH Agua</span>
                            <span className="text-base font-bold text-emerald-400">{ph}</span>
                            <span className="text-[0.55rem] text-gray-500 block">Escala 1-14</span>
                          </div>
                          <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                            <span className="text-[0.6rem] text-gray-400 uppercase block">Carbono (SOC)</span>
                            <span className="text-base font-bold text-cyan-300">{soc} g/kg</span>
                            <span className="text-[0.55rem] text-gray-500 block">Mat. Orgánica ≈ {(soc * 0.172).toFixed(1)}%</span>
                          </div>
                          <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                            <span className="text-[0.6rem] text-gray-400 uppercase block">Nitrógeno (N)</span>
                            <span className="text-base font-bold text-blue-300">{nitrogen} cg/kg</span>
                            <span className="text-[0.55rem] text-gray-500 block">Fertilidad basal</span>
                          </div>
                          <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                            <span className="text-[0.6rem] text-gray-400 uppercase block">Arena (Sand)</span>
                            <span className="text-base font-bold text-amber-300">{sand}%</span>
                            <span className="text-[0.55rem] text-gray-500 block">Fracción gruesa</span>
                          </div>
                          <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                            <span className="text-[0.6rem] text-gray-400 uppercase block">Arcilla (Clay)</span>
                            <span className="text-base font-bold text-red-300">{clay}%</span>
                            <span className="text-[0.55rem] text-gray-500 block">Fracción fina</span>
                          </div>
                          <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                            <span className="text-[0.6rem] text-gray-400 uppercase block">Limo (Silt)</span>
                            <span className="text-base font-bold text-purple-300">{silt}%</span>
                            <span className="text-[0.55rem] text-gray-500 block">Fracción media</span>
                          </div>
                        </div>

                        {/* Barra Tricolor de Granulometría */}
                        <div className="p-3 rounded-xl bg-black/50 border border-white/5 space-y-1.5">
                          <div className="flex justify-between text-[0.65rem] text-gray-300">
                            <span>Composición Textural del Suelo:</span>
                            <span>Arena {sand}% | Limo {silt}% | Arcilla {clay}%</span>
                          </div>
                          <div className="w-full h-3 rounded-full overflow-hidden flex bg-black">
                            <div style={{ width: `${sand}%` }} className="bg-amber-400" title={`Arena: ${sand}%`} />
                            <div style={{ width: `${silt}%` }} className="bg-purple-400" title={`Limo: ${silt}%`} />
                            <div style={{ width: `${clay}%` }} className="bg-red-400" title={`Arcilla: ${clay}%`} />
                          </div>
                          <div className="flex items-center gap-4 text-[0.6rem] text-gray-400 pt-0.5">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-amber-400 inline-block" /> Arena</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-purple-400 inline-block" /> Limo</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-400 inline-block" /> Arcilla</span>
                          </div>
                        </div>

                        {/* Puntos Muestreados dentro del polígono */}
                        {terrenoActivo.condiciones_terreno?.sampling_points && terrenoActivo.condiciones_terreno.sampling_points.length > 0 && (
                          <div className="pt-2 border-t border-white/5 space-y-2">
                            <span className="text-[0.68rem] text-gray-300 font-bold block">
                              Malla de Muestreo Espacial Interpolada ({terrenoActivo.condiciones_terreno.sampling_points.length} Nodos):
                            </span>
                            <div className="max-h-[180px] overflow-y-auto rounded-lg border border-white/5">
                              <table className="w-full text-left text-xs">
                                <thead className="bg-black/60 text-gray-400 uppercase text-[0.6rem]">
                                  <tr>
                                    <th className="p-2">#</th>
                                    <th className="p-2">Latitud</th>
                                    <th className="p-2">Longitud</th>
                                    <th className="p-2">pH Est.</th>
                                    <th className="p-2">SOC (g/kg)</th>
                                    <th className="p-2">Nitrógeno</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-[0.68rem]">
                                  {terrenoActivo.condiciones_terreno.sampling_points.map((pt, idx) => (
                                    <tr key={idx} className="hover:bg-white/[0.02]">
                                      <td className="p-2 text-gray-400">{idx + 1}</td>
                                      <td className="p-2 text-white font-mono">{Number(pt.lat).toFixed(5)}</td>
                                      <td className="p-2 text-white font-mono">{Number(pt.lng || pt.lon).toFixed(5)}</td>
                                      <td className="p-2 text-emerald-400 font-bold">{pt.ph || pt.ph_h2o || ph}</td>
                                      <td className="p-2 text-cyan-300">{pt.soc || soc}</td>
                                      <td className="p-2 text-blue-300">{pt.nitrogen || nitrogen}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            PESTAÑA: RELIEVE TOPOGRÁFICO & MATRIZ DEM (2D)
           ======================================================== */}
        {activeTab === 'relieve' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#181818] border border-[#262626] rounded-2xl">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <i className="fa-solid fa-mountain-sun text-cyan-400" />
                  <span>Modelo Digital de Elevación (DEM) & Matriz 2D</span>
                </h3>
                <p className="text-xs text-gray-400">
                  Decodificación hipsométrica Mapbox Terrain-RGB e interpolación bicúbica por splines de Clough-Tocher (SciPy).
                </p>
              </div>
              <a
                href="/docs.html"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-mono flex items-center gap-1.5 transition-all self-start sm:self-auto"
                title="Abrir tratado científico de formulación matemática"
              >
                <i className="fa-solid fa-book-open text-cyan-400" />
                <span>Tratado Científico (docs.html)</span>
              </a>
            </div>

            {!terrenoActivo.elevacion_data ? (
              <div className="p-8 bg-[#181818] border border-dashed border-white/10 rounded-2xl text-center space-y-3">
                <i className="fa-solid fa-mountain text-cyan-400 text-3xl" />
                <h4 className="text-sm font-bold text-white">Sin Malla DEM Registrada</h4>
                <p className="text-xs text-gray-400 max-w-md mx-auto">
                  Este terreno no tiene una matriz de elevación decodificada guardada en la base de datos.
                </p>
                <button
                  onClick={() => navigate('/terrenos/crear')}
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs rounded-xl"
                >
                  Muestrear Elevación en Nuevo Terreno
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* KPIs Topográficos */}
                {(() => {
                  const dem = terrenoActivo.elevacion_data;
                  const activeMatrix = (selectedDemType === 'interpolada' && dem.interpolated_matrix_2d)
                    ? dem.interpolated_matrix_2d
                    : dem.matrix_2d || [];

                  return (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                        <div className="p-3 rounded-xl bg-[#181818] border border-cyan-500/20">
                          <span className="text-[0.62rem] text-gray-400 uppercase block">Cota Mínima</span>
                          <span className="text-xl font-bold text-cyan-300">{dem.min} m</span>
                        </div>
                        <div className="p-3 rounded-xl bg-[#181818] border border-blue-500/20">
                          <span className="text-[0.62rem] text-gray-400 uppercase block">Cota Máxima</span>
                          <span className="text-xl font-bold text-blue-300">{dem.max} m</span>
                        </div>
                        <div className="p-3 rounded-xl bg-[#181818] border border-emerald-500/20">
                          <span className="text-[0.62rem] text-gray-400 uppercase block">Desnivel (Δh)</span>
                          <span className="text-xl font-bold text-emerald-300">{dem.diff} m</span>
                        </div>
                        <div className="p-3 rounded-xl bg-[#181818] border border-amber-500/20">
                          <span className="text-[0.62rem] text-gray-400 uppercase block">Pendiente Media</span>
                          <span className="text-xl font-bold text-amber-300">{dem.slope_pct}%</span>
                        </div>
                      </div>

                      {/* Métricas de Discretización */}
                      <div className="p-3 bg-[#181818] rounded-xl border border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-4 text-gray-300 text-[0.7rem]">
                          <span>Malla Base: <b className="text-white">16&times;16</b></span>
                          {dem.interpolated_matrix_2d && (
                            <span>Matriz SciPy: <b className="text-cyan-300">{dem.interpolated_matrix_2d.length}&times;{dem.interpolated_matrix_2d[0]?.length || 32}</b></span>
                          )}
                          <span>Paso: <b className="text-white">{dem.espaciado_metros || 5.0} m/celda</b></span>
                          <span>Área: <b className="text-white">{dem.hectareas || 1.0} ha</b></span>
                        </div>

                        {dem.interpolated_matrix_2d && (
                          <div className="flex items-center gap-1 bg-black/60 p-1 rounded-lg border border-white/10">
                            <button
                              onClick={() => setSelectedDemType('base')}
                              className={`px-2.5 py-1 rounded text-[0.65rem] font-mono transition-colors ${
                                selectedDemType === 'base' ? 'bg-white/20 text-white font-bold' : 'text-gray-400 hover:text-white'
                              }`}
                            >
                              Base (16&times;16)
                            </button>
                            <button
                              onClick={() => setSelectedDemType('interpolada')}
                              className={`px-2.5 py-1 rounded text-[0.65rem] font-mono transition-colors ${
                                selectedDemType === 'interpolada' ? 'bg-cyan-500 text-black font-bold' : 'text-gray-400 hover:text-white'
                              }`}
                            >
                              SciPy C&sup1; ({dem.interpolated_matrix_2d.length}&times;{dem.interpolated_matrix_2d[0]?.length})
                            </button>
                          </div>
                        )}
                      </div>

                      {/* VISOR INTERACTIVO DE LA MATRIZ DEM 2D */}
                      <div className="p-4 rounded-2xl bg-[#181818] border border-white/10 space-y-3">
                        <div className="flex items-center justify-between text-xs pb-2 border-b border-white/10">
                          <span className="font-bold text-gray-200 uppercase tracking-wider text-[0.7rem] flex items-center gap-2">
                            <i className="fa-solid fa-table-cells text-cyan-400" />
                            <span>Visualizador Matricial de Relieve ({activeMatrix.length}&times;{activeMatrix[0]?.length || 0})</span>
                          </span>

                          {hoveredDemCell ? (
                            <span className="text-cyan-300 font-mono text-xs">
                              Nodo [{hoveredDemCell.r}, {hoveredDemCell.c}]: <b>{hoveredDemCell.val} m</b>
                            </span>
                          ) : (
                            <span className="text-gray-500 text-[0.65rem]">
                              Pasa el cursor sobre una celda para ver cota exacta
                            </span>
                          )}
                        </div>

                        {/* Contenedor de la matriz */}
                        <div className="overflow-x-auto p-2 bg-black/70 rounded-xl border border-white/5 max-h-[380px] overflow-y-auto">
                          <div
                            className="grid gap-[2px] mx-auto"
                            style={{
                              gridTemplateColumns: `repeat(${activeMatrix[0]?.length || 16}, minmax(${activeMatrix[0]?.length > 20 ? '12px' : '22px'}, 1fr))`,
                              width: 'max-content',
                              minWidth: '100%',
                            }}
                          >
                            {activeMatrix.map((row, r) =>
                              row.map((val, c) => {
                                const elevVal = Number(val);
                                const ratio = Math.max(0, Math.min(1, (elevVal - dem.min) / Math.max(dem.diff, 1)));
                                const hue = Math.round((1 - ratio) * 160 + 20); // 180 (cian) -> 20 (ámbar)
                                const bgColor = `hsl(${hue}, 80%, 40%)`;

                                return (
                                  <div
                                    key={`${r}-${c}`}
                                    onMouseEnter={() => setHoveredDemCell({ r, c, val: elevVal.toFixed(1) })}
                                    onMouseLeave={() => setHoveredDemCell(null)}
                                    style={{ backgroundColor: bgColor }}
                                    className="aspect-square rounded-[2px] flex items-center justify-center text-[0.5rem] font-mono text-black font-bold transition-transform hover:scale-125 hover:z-10 hover:shadow-lg cursor-pointer"
                                    title={`[Fila ${r}, Col ${c}]: ${elevVal.toFixed(2)} m`}
                                  >
                                    {activeMatrix.length <= 16 ? elevVal.toFixed(0) : ''}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>

                        {/* Barra de escala de color hipsométrica */}
                        <div className="flex items-center justify-between text-[0.65rem] text-gray-400 font-mono pt-1">
                          <span className="text-cyan-400 font-bold">{dem.min} m (Depresión)</span>
                          <div className="flex-1 mx-4 h-2 rounded-full bg-gradient-to-r from-cyan-400 via-emerald-400 via-amber-400 to-orange-500" />
                          <span className="text-orange-400 font-bold">{dem.max} m (Cresta)</span>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            PESTAÑA: PLAN DE MISIÓN & RUTAS ROVERS (IA)
           ======================================================== */}
        {activeTab === 'rutas' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#181818] border border-[#262626] rounded-2xl">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <i className="fa-solid fa-route text-amber-400" />
                  <span>Plan de Misión & Trayectorias de Rovers (TSP Hipsométrico)</span>
                </h3>
                <p className="text-xs text-gray-400">
                  Rutas optimizadas por energía de ascenso gravitatorio y clustering multiescala para la flota robótica de {terrenoActivo.nombre}.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('mapa')}
                className="px-3.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-mono flex items-center gap-1.5 transition-all self-start sm:self-auto"
              >
                <i className="fa-solid fa-satellite" />
                <span>Ver en Mapa Táctico</span>
              </button>
            </div>

            {!terrenoActivo.rutas_rovers || terrenoActivo.rutas_rovers.length === 0 ? (
              <div className="p-8 bg-[#181818] border border-dashed border-white/10 rounded-2xl text-center space-y-3">
                <i className="fa-solid fa-route text-amber-400 text-3xl" />
                <h4 className="text-sm font-bold text-white">Sin Rutas Planificadas</h4>
                <p className="text-xs text-gray-400 max-w-md mx-auto">
                  No se generaron o guardaron rutas de exploración para los rovers en esta parcela.
                </p>
                <button
                  onClick={() => navigate('/terrenos/crear')}
                  className="px-4 py-2 bg-[#ff4500] hover:bg-[#ff4500]/90 text-white font-bold text-xs rounded-xl"
                >
                  Planificar en Nuevo Terreno
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Resumen Global de Misión */}
                {(() => {
                  const rutas = terrenoActivo.rutas_rovers;
                  const totalRovers = rutas.length;
                  const totalWaypoints = rutas.reduce((acc, r) => acc + (r.waypoints?.length || 0), 0);
                  const distTotalM = Math.round(rutas.reduce((acc, r) => acc + (r.metricas?.distancia_total_m || 0), 0));
                  const durTotalMin = Math.round(rutas.reduce((acc, r) => acc + (r.metricas?.tiempo_total_min || 0), 0) * 10) / 10;
                  const energTotalJ = Math.round(rutas.reduce((acc, r) => acc + (r.metricas?.energia_total_j || 0), 0));
                  const energTotalWh = Math.round((energTotalJ / 3600) * 100) / 100;

                  const currentRoute = rutas.find((r) => String(r.rover_id) === String(selectedRoverRouteId)) || rutas[0];

                  return (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center">
                        <div className="p-3 rounded-xl bg-[#181818] border border-cyan-500/20">
                          <span className="text-[0.62rem] text-gray-400 uppercase block">Rovers Activos</span>
                          <span className="text-xl font-bold text-cyan-300">{totalRovers}</span>
                        </div>
                        <div className="p-3 rounded-xl bg-[#181818] border border-blue-500/20">
                          <span className="text-[0.62rem] text-gray-400 uppercase block">Total Puntos</span>
                          <span className="text-xl font-bold text-blue-300">{totalWaypoints}</span>
                        </div>
                        <div className="p-3 rounded-xl bg-[#181818] border border-emerald-500/20">
                          <span className="text-[0.62rem] text-gray-400 uppercase block">Distancia Flota</span>
                          <span className="text-xl font-bold text-emerald-300">{distTotalM.toLocaleString()} m</span>
                        </div>
                        <div className="p-3 rounded-xl bg-[#181818] border border-amber-500/20">
                          <span className="text-[0.62rem] text-gray-400 uppercase block">Duración Estimada</span>
                          <span className="text-xl font-bold text-amber-300">{durTotalMin} min</span>
                        </div>
                        <div className="p-3 rounded-xl bg-[#181818] border border-purple-500/20 col-span-2 sm:col-span-1">
                          <span className="text-[0.62rem] text-gray-400 uppercase block">Consumo Flota</span>
                          <span className="text-xl font-bold text-purple-300">{energTotalWh} Wh</span>
                        </div>
                      </div>

                      {/* Selector de Rover */}
                      <div className="flex items-center gap-2 overflow-x-auto p-1 bg-black/40 rounded-xl border border-white/5">
                        {rutas.map((r) => {
                          const isSel = String(r.rover_id) === String(currentRoute?.rover_id);
                          return (
                            <button
                              key={r.rover_id}
                              onClick={() => setSelectedRoverRouteId(r.rover_id)}
                              style={{ borderColor: isSel ? r.color : 'transparent' }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-2 border transition-all ${
                                isSel
                                  ? 'bg-white/10 text-white font-bold shadow-md'
                                  : 'text-gray-400 hover:text-white hover:bg-white/5'
                              }`}
                            >
                              <span
                                className="w-2.5 h-2.5 rounded-full inline-block"
                                style={{ backgroundColor: r.color || '#00e5ff' }}
                              />
                              <span>{r.rover_nombre}</span>
                              <span className="text-[0.65rem] text-gray-500">({r.waypoints?.length || 0} pts)</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Tarjeta de Detalle del Rover Seleccionado */}
                      {currentRoute && (
                        <div className="p-4 rounded-2xl bg-[#181818] border border-white/10 space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/10">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-3.5 h-3.5 rounded-full"
                                style={{ backgroundColor: currentRoute.color || '#00e5ff' }}
                              />
                              <h4 className="text-sm font-bold text-white">
                                {currentRoute.rover_nombre} &bull; Modelo {currentRoute.rover_modelo || 'Myco Rover'}
                              </h4>
                            </div>

                            <div className="flex items-center gap-3 text-xs font-mono">
                              <span className="text-gray-400">
                                Distancia: <b className="text-white">{currentRoute.metricas?.distancia_total_m || 0}m</b>
                              </span>
                              <span className="text-gray-400">
                                Energía: <b className="text-amber-400">{currentRoute.metricas?.energia_total_wh || 0} Wh</b>
                              </span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(JSON.stringify(currentRoute, null, 2));
                                  addLog(`[SISTEMA] Plan de ruta de ${currentRoute.rover_nombre} copiado al portapapeles.`);
                                }}
                                className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-300 text-[0.65rem] border border-white/10"
                                title="Copiar plan completo en JSON"
                              >
                                <i className="fa-solid fa-copy mr-1" /> Copiar JSON
                              </button>
                            </div>
                          </div>

                          {/* Tabla de Waypoints del Rover */}
                          <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/40">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-black/60 text-gray-400 uppercase text-[0.62rem] border-b border-white/10">
                                <tr>
                                  <th className="p-2.5">Paso</th>
                                  <th className="p-2.5">Tipo</th>
                                  <th className="p-2.5">Coordenadas</th>
                                  <th className="p-2.5">Cota (m)</th>
                                  <th className="p-2.5">Zona</th>
                                  <th className="p-2.5">Dist. Tramo</th>
                                  <th className="p-2.5">Desnivel (Δh)</th>
                                  <th className="p-2.5">Gasto (J)</th>
                                  <th className="p-2.5">Tiempo</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5 text-[0.68rem] font-mono">
                                {(currentRoute.waypoints || []).map((wp, idx) => (
                                  <tr key={idx} className="hover:bg-white/[0.02]">
                                    <td className="p-2.5 font-bold text-white">#{wp.indice || idx}</td>
                                    <td className="p-2.5">
                                      <span
                                        className={`px-1.5 py-0.5 rounded text-[0.6rem] font-bold ${
                                          wp.tipo === 'inicio'
                                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                            : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                        }`}
                                      >
                                        {wp.tipo === 'inicio' ? 'BEACON INICIO' : 'MUESTREO'}
                                      </span>
                                    </td>
                                    <td className="p-2.5 text-gray-300">
                                      [{Number(wp.lat).toFixed(5)}, {Number(wp.lng).toFixed(5)}]
                                    </td>
                                    <td className="p-2.5 font-bold text-emerald-400">{wp.elevacion_m} m</td>
                                    <td className="p-2.5 text-gray-400 uppercase text-[0.6rem]">{wp.zona}</td>
                                    <td className="p-2.5 text-white">+{wp.distancia_tramo_m || 0} m</td>
                                    <td className="p-2.5 text-amber-300">{wp.delta_h_tramo_m || 0} m</td>
                                    <td className="p-2.5 text-purple-300">{wp.energia_tramo_j || 0} J</td>
                                    <td className="p-2.5 text-gray-400">{wp.tiempo_tramo_s || 0} s</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            PESTAÑA 2: MEDICIONES DE SUELO DEL TERRENO
           ======================================================== */}
        {activeTab === 'mediciones' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#181818] border border-[#262626] rounded-2xl">
              <div>
                <h3 className="text-base font-bold text-white">Muestras de Suelo del Terreno</h3>
                <p className="text-xs text-gray-400">
                  Lecturas recolectadas por robots en modo lectura únicamente para {terrenoActivo.nombre}.
                </p>
              </div>
              <button
                onClick={() => setNuevaMuestraModalOpen(true)}
                className="px-3.5 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl text-xs flex items-center gap-2 self-start sm:self-auto transition-colors"
              >
                <i className="fa-solid fa-plus" />
                <span>Tomar Muestra In-Situ</span>
              </button>
            </div>

            {/* Listado de Mediciones */}
            <div className="bg-[#181818] border border-[#262626] rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-black/60 text-gray-400 uppercase border-b border-white/10 text-[0.65rem]">
                    <tr>
                      <th className="p-3">ID</th>
                      <th className="p-3">Robot</th>
                      <th className="p-3">pH</th>
                      <th className="p-3">Humedad</th>
                      <th className="p-3">Temperatura</th>
                      <th className="p-3">Coordenadas</th>
                      <th className="p-3">Dictamen IA</th>
                      <th className="p-3">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {medicionesTerreno.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="p-6 text-center text-gray-500">
                          Sin mediciones registradas para esta parcela. Usa el botón "Tomar Muestra In-Situ".
                        </td>
                      </tr>
                    ) : (
                      medicionesTerreno.map((m) => (
                        <tr key={m.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="p-3 font-bold text-white">#{m.id}</td>
                          <td className="p-3 text-gray-300">{m.robot?.nombre || `Robot #${m.robot_id}`}</td>
                          <td className="p-3 font-bold text-white">{m.ph}</td>
                          <td className="p-3 text-cyan-400 font-bold">{m.humedad}%</td>
                          <td className="p-3 text-gray-300">{m.temperatura}°C</td>
                          <td className="p-3 text-gray-400 font-mono text-[0.65rem]">{m.latitud}, {m.longitud}</td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[0.65rem] font-bold ${
                                m.es_optimo_inyeccion
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              }`}
                            >
                              {m.es_optimo_inyeccion ? 'Óptimo' : 'Sub-óptimo'}
                            </span>
                          </td>
                          <td className="p-3 text-gray-500 text-[0.65rem]">
                            {new Date(m.fecha_medicion || m.created_at).toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            PESTAÑA 3: INYECCIONES & OPTIMIZACIÓN IA DEL TERRENO
           ======================================================== */}
        {activeTab === 'inyecciones' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#181818] border border-[#262626] rounded-2xl">
              <div>
                <h3 className="text-base font-bold text-white">Inyecciones Calculadas por IA</h3>
                <p className="text-xs text-gray-400">
                  Historial de inoculaciones con cápsulas de micorrizas ejecutadas en {terrenoActivo.nombre}.
                </p>
              </div>
              <button
                onClick={handleEjecutarInyeccionIA}
                className="px-3.5 py-2 bg-[#ff4500] hover:bg-[#ff4500]/90 text-white font-bold rounded-xl text-xs flex items-center gap-2 self-start sm:self-auto transition-colors"
              >
                <i className="fa-solid fa-syringe" />
                <span>Ejecutar Inyección Optimizada</span>
              </button>
            </div>

            {/* Listado de Inyecciones */}
            <div className="bg-[#181818] border border-[#262626] rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-black/60 text-gray-400 uppercase border-b border-white/10 text-[0.65rem]">
                    <tr>
                      <th className="p-3">ID</th>
                      <th className="p-3">Robot</th>
                      <th className="p-3">Grado Cápsula</th>
                      <th className="p-3">Humedad Detectada</th>
                      <th className="p-3">Expansión Hifas</th>
                      <th className="p-3">Ahorro Recurso</th>
                      <th className="p-3">Justificación del Algoritmo</th>
                      <th className="p-3">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {inyeccionesTerreno.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="p-6 text-center text-gray-500">
                          Sin inyecciones registradas en este terreno. Presiona "Ejecutar Inyección Optimizada".
                        </td>
                      </tr>
                    ) : (
                      inyeccionesTerreno.map((iny) => (
                        <tr key={iny.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="p-3 font-bold text-white">#{iny.id}</td>
                          <td className="p-3 text-gray-300">{iny.robot?.nombre || `Robot #${iny.robot_id}`}</td>
                          <td className="p-3">
                            <CapsuleBadge grado={iny.grado_capsula} />
                          </td>
                          <td className="p-3 text-cyan-400 font-bold">{iny.humedad_suelo_detectada || 65}%</td>
                          <td className="p-3 text-[#ff4500] font-bold">{iny.expansion_micelio_estimada_cm || 18} cm</td>
                          <td className="p-3 text-emerald-400 font-bold">{iny.ahorro_recurso_porcentaje || 40}%</td>
                          <td className="p-3 text-gray-400 text-[0.65rem] max-w-xs truncate">
                            {iny.justificacion_algoritmo || 'Inoculación optimizada por alta humedad.'}
                          </td>
                          <td className="p-3 text-gray-500 text-[0.65rem]">
                            {new Date(iny.fecha_inyeccion || iny.created_at).toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            PESTAÑA 4: MODO SIMULADOR DE TERRENO CON PARÁMETROS
           ======================================================== */}
        {activeTab === 'simulador' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-4 bg-[#181818] border border-[#262626] rounded-2xl p-5 flex flex-col justify-between gap-4 shadow-xl">
              <div>
                <span className="text-[0.65rem] text-[#ff4500] uppercase font-bold tracking-wider block mb-1">
                  Control de Simulación
                </span>
                <h3 className="text-base font-bold text-white mb-2">Parámetros del Terreno</h3>
                <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                  Modifica las variables ambientales del suelo para proyectar la descontaminación y calcular las rutas de inoculación de los Mycos.
                </p>

                {/* Controles de Parámetros */}
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-300">Humedad Proyectada:</span>
                      <strong className="text-cyan-400">{simParams.humedad}%</strong>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="95"
                      value={simParams.humedad}
                      onChange={(e) => setSimParams((p) => ({ ...p, humedad: Number(e.target.value) }))}
                      className="w-full accent-cyan-400 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-300">pH del Suelo:</span>
                      <strong className="text-white">{simParams.ph}</strong>
                    </div>
                    <input
                      type="range"
                      min="4"
                      max="10"
                      step="0.1"
                      value={simParams.ph}
                      onChange={(e) => setSimParams((p) => ({ ...p, ph: Number(e.target.value) }))}
                      className="w-full accent-[#ff4500] cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-300">Contaminación por Arsénico / Toxicidad:</span>
                      <strong className="text-amber-400">{simParams.arsenico} mg/kg</strong>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="60"
                      value={simParams.arsenico}
                      onChange={(e) => setSimParams((p) => ({ ...p, arsenico: Number(e.target.value) }))}
                      className="w-full accent-amber-400 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-300">Temperatura Térmica:</span>
                      <strong className="text-gray-200">{simParams.temperatura}°C</strong>
                    </div>
                    <input
                      type="range"
                      min="-60"
                      max="50"
                      value={simParams.temperatura}
                      onChange={(e) => setSimParams((p) => ({ ...p, temperatura: Number(e.target.value) }))}
                      className="w-full accent-white cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Botón de Ejecutar Simulación */}
              <button
                onClick={handleCorrerSimulacion}
                disabled={simulandoAnimacion}
                className={`w-full py-3 rounded-xl font-mono font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2 ${
                  simulandoAnimacion
                    ? 'bg-white/10 text-gray-400 cursor-not-allowed'
                    : 'bg-[#ff4500] hover:bg-[#ff4500]/90 text-white shadow-[#ff4500]/20'
                }`}
              >
                <i className={`fa-solid ${simulandoAnimacion ? 'fa-spinner animate-spin' : 'fa-play'}`} />
                <span>{simulandoAnimacion ? 'Simulando en Progreso...' : 'Iniciar Simulación de Terreno'}</span>
              </button>
            </div>

            {/* Panel de Visualización del Simulador */}
            <div className="lg:col-span-8 bg-[#181818] border border-[#262626] rounded-2xl p-5 flex flex-col justify-between shadow-xl">
              <div>
                <span className="text-[0.65rem] text-cyan-400 uppercase font-bold tracking-wider block mb-1">
                  Proyección de Ecosistema
                </span>
                <h3 className="text-base font-bold text-white mb-3">Estabilización Fúngica del Terreno</h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                    <span className="text-[0.6rem] text-gray-400 uppercase block">Supervivencia Micelio</span>
                    <strong className="text-emerald-400 text-lg">94.2%</strong>
                  </div>
                  <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                    <span className="text-[0.6rem] text-gray-400 uppercase block">Reducción Toxicidad</span>
                    <strong className="text-[#ff4500] text-lg">-68%</strong>
                  </div>
                  <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                    <span className="text-[0.6rem] text-gray-400 uppercase block">Cobertura Proyectada</span>
                    <strong className="text-white text-lg">{Math.round(Number(terrenoActivo.dimensiones_m2) * 0.78).toLocaleString()} m²</strong>
                  </div>
                  <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                    <span className="text-[0.6rem] text-gray-400 uppercase block">Días de Estabilización</span>
                    <strong className="text-cyan-400 text-lg">18 Días</strong>
                  </div>
                </div>

                <div className="p-4 bg-black/50 rounded-xl border border-white/5 text-xs space-y-2">
                  <div className="flex justify-between items-center text-gray-300">
                    <span>Estado del Suelo:</span>
                    <strong className="text-emerald-400">Condición Favorable para Micorrizas</strong>
                  </div>
                  <div className="flex justify-between items-center text-gray-300">
                    <span>Cápsula Recomendada para Siembra:</span>
                    <CapsuleBadge grado={simParams.humedad > 60 ? 'alto' : simParams.humedad > 35 ? 'medio' : 'minimo'} />
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-black/30 rounded-xl border border-white/5 text-[0.65rem] text-gray-400">
                Los algoritmos de M.Y.C.O calculan la densidad de inoculación requerida en base al polígono perimetral calibrado para {terrenoActivo.nombre}.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── MODAL: ASIGNAR ROBOTS A ESTA MISIÓN ─── */}
      {asignarModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#181818] border border-[#262626] rounded-2xl w-full max-w-lg p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <h3 className="text-base font-bold text-white font-mono">
                  Asignar Mycos a la Misión
                </h3>
                <p className="text-xs text-gray-400 font-mono">
                  Parcela destino: <strong>{terrenoActivo.nombre}</strong>
                </p>
              </div>
              <button
                onClick={() => setAsignarModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <i className="fa-solid fa-xmark text-sm" />
              </button>
            </div>

            <div className="space-y-2 max-h-[320px] overflow-y-auto">
              {todosLosRobots.map((robot) => {
                const yaAsignado = robot.terreno_id === terrenoActivo.id;
                return (
                  <div
                    key={robot.id}
                    className="p-3 bg-black/50 border border-white/5 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-white flex items-center gap-2">
                        <span>{robot.nombre}</span>
                        <span className="text-[0.6rem] px-1.5 py-0.2 rounded bg-white/5 text-gray-400">
                          {robot.modo}
                        </span>
                      </div>
                      <div className="text-[0.65rem] text-gray-400">
                        Batería: {robot.bateria}% | {robot.terreno ? `Asignado a: ${robot.terreno.nombre}` : 'Sin asignar'}
                      </div>
                    </div>

                    {yaAsignado ? (
                      <span className="px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[0.65rem] font-bold">
                        Asignado a esta misión
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAsignarRobot(robot.id)}
                        className="px-3 py-1 rounded-lg bg-[#ff4500] hover:bg-[#ff4500]/90 text-white font-bold text-xs transition-colors"
                      >
                        Asignar
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2 border-t border-white/10">
              <button
                onClick={() => setAsignarModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-mono"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: TOMAR MUESTRA IN-SITU ─── */}
      {nuevaMuestraModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#181818] border border-[#262626] rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-bold text-white font-mono">
                Tomar Muestra de Suelo In-Situ
              </h3>
              <button onClick={() => setNuevaMuestraModalOpen(false)} className="text-gray-400 hover:text-white">
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <form onSubmit={handleTomarMuestraInSitu} className="space-y-3 text-xs">
              <p className="text-gray-400 text-[0.7rem]">
                Se enviará una orden de muestreo al Myco en modo lectura disponible en <strong>{terrenoActivo.nombre}</strong>.
              </p>

              <div>
                <label className="block text-gray-300 mb-1">pH Detectado por Sensor</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="14"
                  required
                  value={simParams.ph}
                  onChange={(e) => setSimParams((p) => ({ ...p, ph: Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-black/60 border border-[#262626] rounded-xl text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-1">Humedad de Suelo (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  required
                  value={simParams.humedad}
                  onChange={(e) => setSimParams((p) => ({ ...p, humedad: Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-black/60 border border-[#262626] rounded-xl text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-1">Temperatura Térmica (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={simParams.temperatura}
                  onChange={(e) => setSimParams((p) => ({ ...p, temperatura: Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-black/60 border border-[#262626] rounded-xl text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setNuevaMuestraModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-bold"
                >
                  Registrar Lectura
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
