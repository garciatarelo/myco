import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as turf from '@turf/turf';
import { apiService } from '../services/api';
import { MapaMisionTerreno } from '../components/MapaMisionTerreno';
import { Pulse } from '../components/common/Pulse';
import { Fase2IdoneidadStudio } from '../components/Fase2IdoneidadStudio';

/* ─── PRESETS DE ESPECTRO/SUELO PARA SENSOR TCS34725 (RGB + CLEAR + LUX) ─── */
const PRESETS_TCS34725 = {
  humus_optimo: {
    nombre: 'Humus Orgánico Oscuro (Óptimo)',
    color_hex: '#3e2723',
    r: 62, g: 39, b: 35, c: 140,
    lux: 125,
    descripcion: 'Alta materia orgánica y absorción lumínica; ideal para micelio.',
  },
  arcilla_franco: {
    nombre: 'Suelo Franco Arcilloso (Medio)',
    color_hex: '#795548',
    r: 121, g: 85, b: 72, c: 310,
    lux: 290,
    descripcion: 'Retención de humedad equilibrada con textura limo-arcillosa.',
  },
  salino_pobre: {
    nombre: 'Suelo Salino / Erosionado (Pobre)',
    color_hex: '#bcaaa4',
    r: 188, g: 170, b: 164, c: 540,
    lux: 510,
    descripcion: 'Bajo carbono orgánico, alta dispersión lumínica por sales.',
  },
  regolito_marte: {
    nombre: 'Regolito Marciano Oxidado (Percloratos)',
    color_hex: '#b7410e',
    r: 183, g: 65, b: 14, c: 490,
    lux: 460,
    descripcion: 'Óxidos de hierro $Fe_2O_3$ y sales de percloratos $ClO_4^-$.',
  },
};

/* ─── PRESETS OFICIALES DE PARCELAS POR PLANETA ─── */
const PRESETS_TIERRA = [
  {
    id: 'tierra-1',
    nombre: 'Chihuahua — Valle Piloto (Tierra)',
    entorno: 'tierra',
    latitud_central: 30.3485,
    longitud_central: -107.9025,
    dimensiones_m2: 25000,
    elevacion_base_m: 1470,
    descripcion: 'Sector agrícola semiárido con presencia de metales pesados y degradación.',
    red_wifi_ssid: 'Myco-Chihuahua-Mesh',
  },
  {
    id: 'tierra-2',
    nombre: 'Guanajuato — Valle de Santiago (Tierra)',
    entorno: 'tierra',
    latitud_central: 20.3922,
    longitud_central: -101.1917,
    dimensiones_m2: 45000,
    elevacion_base_m: 1720,
    descripcion: 'Suelos volcánicos agrícolas óptimos para biorremediación micótica.',
    red_wifi_ssid: 'Bajio-Agro-Mesh',
  },
  {
    id: 'tierra-3',
    nombre: 'Sonora — Valle del Yaqui (Tierra)',
    entorno: 'tierra',
    latitud_central: 27.4828,
    longitud_central: -109.9304,
    dimensiones_m2: 32000,
    elevacion_base_m: 45,
    descripcion: 'Zona de cultivo intensivo con bajo contenido de materia orgánica.',
    red_wifi_ssid: 'Yaqui-Agro-5G',
  },
];

const PRESETS_MARTE = [
  {
    id: 'marte-1',
    nombre: 'Cráter Jezero — Delta Neretva (Marte)',
    entorno: 'marte',
    latitud_central: 18.3800,
    longitud_central: 77.5800,
    dimensiones_m2: 50000,
    elevacion_base_m: -2500,
    descripcion: 'Delta lacustre con sedimentos arcillosos y esmectitas ricas en percloratos (Perseverance).',
    red_wifi_ssid: 'NASA-Jezero-Mesh-Perseverance',
  },
  {
    id: 'marte-2',
    nombre: 'Cráter Gale — Monte Sharp (Marte)',
    entorno: 'marte',
    latitud_central: -4.5895,
    longitud_central: 137.4417,
    dimensiones_m2: 65000,
    elevacion_base_m: -4450,
    descripcion: 'Transición sulfato-arcilla con fuerte gradiente topográfico en Aeolis Mons.',
    red_wifi_ssid: 'NASA-Gale-Mesh-Curiosity',
  },
  {
    id: 'marte-3',
    nombre: 'Valles Marineris — Noctis Labyrinthus (Marte)',
    entorno: 'marte',
    latitud_central: -6.5000,
    longitud_central: -101.2000,
    dimensiones_m2: 80000,
    elevacion_base_m: -1200,
    descripcion: 'Cañones profundos con mayor presión barométrica y protección a radiación UV.',
    red_wifi_ssid: 'Marineris-DeepRelay-Mesh',
  },
];

/* ─── FLOTA DE ROVERS ─── */
const ROVERS_DEFAULT = [
  {
    id: 101,
    nombre: 'Myco-01 (Alfa)',
    modelo: 'Myco-v2 Pro',
    modo: 'lectura',
    bateria: 95,
    color: '#00e5ff',
    sensores: ['pH', 'TDR Humedad', 'Penetrómetro', 'TCS34725'],
  },
  {
    id: 102,
    nombre: 'Myco-02 (Beta)',
    modelo: 'Myco-v2 Terrain',
    modo: 'lectura',
    bateria: 88,
    color: '#f59e0b',
    sensores: ['pH', 'TDR Humedad', 'TCS34725'],
  },
  {
    id: 103,
    nombre: 'Myco-03 (Gamma)',
    modelo: 'Myco-Bio Scout',
    modo: 'lectura',
    bateria: 92,
    color: '#10b981',
    sensores: ['Penetrómetro', 'TCS34725 Espectral'],
  },
];

export default function GemeloDigitalView() {
  // ─── 1. ENTORNO Y PLANETA ───
  const [planeta, setPlaneta] = useState('tierra'); // 'tierra' | 'marte'
  const [terrenosBD, setTerrenosBD] = useState([]);
  const [terrenoActivo, setTerrenoActivo] = useState(PRESETS_TIERRA[0]);
  const [robotsDisponibles, setRobotsDisponibles] = useState(ROVERS_DEFAULT);
  const [selectedRoverIds, setSelectedRoverIds] = useState([101, 102]);

  // ─── 2. MODOS DE TRAZADO Y HERRAMIENTAS ───
  // 'view' | 'add_point' | 'position_rover'
  const [modoInteractivo, setModoInteractivo] = useState('view');
  const [roverParaPosicionar, setRoverParaPosicionar] = useState(null);
  const [modalPosicionarRover, setModalPosicionarRover] = useState(false);
  const [roverPuntosInicio, setRoverPuntosInicio] = useState({}); // { [roverId]: [lng, lat] }

  // ─── 3. TOPOGRAFÍA DEM, PUNTOS Y RUTAS ───
  const [calculandoDEM, setCalculandoDEM] = useState(false);
  const [demData, setDemData] = useState(null);
  const [rutasData, setRutasData] = useState(null);
  const [puntosMuestreo, setPuntosMuestreo] = useState([]);
  const [puntoSeleccionadoId, setPuntoSeleccionadoId] = useState(null);

  // ─── 4. PESTAÑAS DEL PANEL LATERAL DERECHO ───
  // 'presets' | 'punto_editor' | 'telemetria'
  const [activeTabPanel, setActiveTabPanel] = useState('presets');

  // Parámetros globales de referencia
  const [tempGlobal, setTempGlobal] = useState(24);
  const [phGlobal, setPhGlobal] = useState(6.8);
  const [humedadGlobal, setHumedadGlobal] = useState(55);
  const [tcsPresetGlobal, setTcsPresetGlobal] = useState('humus_optimo');

  // ─── 5. SIMULACIÓN TEMPORAL (PLAY / PAUSA / PROGRESS) ───
  const [simulando, setSimulando] = useState(false);
  const [simStep, setSimStep] = useState(0);
  const [velocidadSim, setVelocidadSim] = useState(1);
  const [simRoversPositions, setSimRoversPositions] = useState([]);
  const [medicionesRealizadas, setMedicionesRealizadas] = useState([]);
  const [logs, setLogs] = useState([
    '[SYS] Gemelo Digital inicializado. Modo de observador activo.',
    '[TELEMETRÍA] Sincronización satelital garantizada.',
  ]);

  // ─── 6. ESTADO FASE 2: MATRIZ DE IDONEIDAD & AUTÓMATA ───
  const [faseActiva, setFaseActiva] = useState('fase1'); // 'fase1' | 'fase2'
  const [fase2Data, setFase2Data] = useState(null);
  const [fase2Loading, setFase2Loading] = useState(false);
  const [cfuConcentration, setCfuConcentration] = useState(0.85);
  const [numInyecciones, setNumInyecciones] = useState(3);
  const [modalFase2Abierto, setModalFase2Abierto] = useState(false);

  // ─── 7. HIPERPARÁMETROS MARTE: TRAJE ESPACIAL, FICK, CICLO SOL Y DORMANCIA ───
  const [solHora, setSolHora] = useState(14); // 0 a 24 horas Sol en Marte (14 = mediodía térmico)
  const [modoTiempoMarte, setModoTiempoMarte] = useState('ciclo_sol'); // 'ciclo_sol' | 'fijo_manual'
  const [tempManualMarte, setTempManualMarte] = useState(-25); // °C para sobreescritura manual
  const [alginatoCapacidad, setAlginatoCapacidad] = useState(120); // Horas de amortiguamiento de hidrogel (40 - 240h)
  const [chitosanShield, setChitosanShield] = useState(0.85); // 0.1 a 1.0 (Escudo antioxidante/UV)
  const [percloratosFactor, setPercloratosFactor] = useState(1.0); // 0.2 a 3.0 (Estrés oxidativo ClO4-)
  const [oxidosHierroFactor, setOxidosHierroFactor] = useState(1.0); // 0.2 a 2.5 (Fe2O3 para sideróforos)
  const [simulandoCicloSol, setSimulandoCicloSol] = useState(false); // Bucle automático de horas marcianas

  // Modelo térmico senoidal diurno en Marte: T(t) = -25 + 40 * sin(2*pi*t/24 - pi/2)
  const tempSenoidalEstimada = useMemo(() => {
    return Math.round(-25 + 40 * Math.sin((2 * Math.PI * solHora / 24) - (Math.PI / 2)));
  }, [solHora]);

  const tempMarteActual = useMemo(() => {
    return modoTiempoMarte === 'ciclo_sol' ? tempSenoidalEstimada : tempManualMarte;
  }, [modoTiempoMarte, tempSenoidalEstimada, tempManualMarte]);

  const esNocheMarte = useMemo(() => {
    return solHora < 6 || solHora >= 18;
  }, [solHora]);

  const enCrioDormancia = useMemo(() => {
    // Umbral de congelación deprimido con glicerol = -8°C
    return tempMarteActual < -8;
  }, [tempMarteActual]);

  // Sincronizar temperatura global con Marte cuando esté activo
  useEffect(() => {
    if (planeta === 'marte') {
      setTempGlobal(tempMarteActual);
    }
  }, [planeta, tempMarteActual]);

  // Bucle de avance temporal del Sol marciano
  useEffect(() => {
    if (!simulandoCicloSol || planeta !== 'marte') return;
    const interval = setInterval(() => {
      setSolHora((prev) => (prev + 1) % 24);
    }, 1200);
    return () => clearInterval(interval);
  }, [simulandoCicloSol, planeta]);

  const timerRef = useRef(null);
  const consoleRef = useRef(null);

  const addLog = useCallback((line) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev.slice(-40), `[${time}] ${line}`]);
  }, []);

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs]);

  // ─── CARGA INICIAL DESDE BD ───
  useEffect(() => {
    async function cargarBD() {
      try {
        const [terrenosRes, robotsRes] = await Promise.all([
          apiService.getTerrenos().catch(() => []),
          apiService.getRobots().catch(() => []),
        ]);

        if (Array.isArray(terrenosRes) && terrenosRes.length > 0) {
          setTerrenosBD(terrenosRes);
        }

        if (Array.isArray(robotsRes) && robotsRes.length > 0) {
          const formatted = robotsRes.map((r, i) => ({
            id: r.id,
            nombre: r.nombre || `Myco-${r.id}`,
            modelo: r.modelo || 'Rover Biológico',
            modo: r.modo || 'lectura',
            bateria: r.bateria ?? 90,
            color: ['#00e5ff', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6'][i % 5],
            sensores: ['pH', 'TDR Humedad', 'Penetrómetro', 'TCS34725'],
          }));
          setRobotsDisponibles(formatted);
          setSelectedRoverIds(formatted.slice(0, 2).map((r) => r.id));
        }
      } catch (err) {
        console.warn('Fallback a configuración local:', err);
      }
    }
    cargarBD();
  }, []);

  // Lista de parcelas disponibles para el planeta activo
  const parcelasDisponibles = useMemo(() => {
    const presets = planeta === 'marte' ? PRESETS_MARTE : PRESETS_TIERRA;
    const deBD = terrenosBD.filter((t) => t.entorno === planeta);
    return [...presets, ...deBD];
  }, [planeta, terrenosBD]);

  // ─── POLÍGONO DE LA PARCELA ACTIVA ───
  const polygonGeoJSON = useMemo(() => {
    if (!terrenoActivo) return null;
    let coords = terrenoActivo.poligono_coordenadas;
    const center = [
      Number(terrenoActivo.longitud_central) || (planeta === 'marte' ? 77.58 : -107.9025),
      Number(terrenoActivo.latitud_central) || (planeta === 'marte' ? 18.38 : 30.3485),
    ];

    if (!coords || !Array.isArray(coords) || coords.length < 3) {
      const areaM2 = Number(terrenoActivo.dimensiones_m2) || (planeta === 'marte' ? 50000 : 25000);
      const sideKm = Math.sqrt(areaM2) / 1000;
      const radiusKm = (sideKm * Math.sqrt(2)) / 2;
      const square = turf.bboxPolygon(turf.bbox(turf.circle(center, radiusKm, { units: 'kilometers' })));
      coords = square.geometry.coordinates[0];
    } else {
      if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
        coords = coords[0];
      }
    }

    const first = coords[0];
    const last = coords[coords.length - 1];
    const closed = (first[0] === last[0] && first[1] === last[1]) ? coords : [...coords, first];

    return {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [closed] },
      coordinates: closed,
      center,
    };
  }, [terrenoActivo, planeta]);

  // ─── CAMBIAR PLANETA ───
  function handleCambiarPlaneta(nuevoPlaneta) {
    if (nuevoPlaneta === planeta) return;
    detenerSimulacion();
    setSimulandoCicloSol(false);
    setPlaneta(nuevoPlaneta);
    setModoInteractivo('view');

    if (nuevoPlaneta === 'marte') {
      setTempGlobal(tempMarteActual);
      setPhGlobal(8.4);
      setHumedadGlobal(8);
      setTcsPresetGlobal('regolito_marte');
      setTerrenoActivo(PRESETS_MARTE[0]);
      setActiveTabPanel('marte_suit');
      addLog(`[PLANETA] Conmutado a Marte (MOLA Datum, NASA Viking MDIM 2.1).`);
      addLog(`[ASTROBIOLOGÍA] Panel de Traje Espacial Marciano activado (Alginato + Glicerol + Quitosano).`);
    } else {
      setTempGlobal(24);
      setPhGlobal(6.8);
      setHumedadGlobal(58);
      setTcsPresetGlobal('humus_optimo');
      setTerrenoActivo(PRESETS_TIERRA[0]);
      if (activeTabPanel === 'marte_suit') setActiveTabPanel('presets');
      addLog(`[PLANETA] Conmutado a Tierra (Esri Satellite HD, 1 atm).`);
    }

    setDemData(null);
    setRutasData(null);
    setPuntosMuestreo([]);
    setMedicionesRealizadas([]);
    setRoverPuntosInicio({});
  }

  // ─── CREAR PARÁMETROS COMPLETOS PARA UN PUNTO (CON TCS34725) ───
  function crearParametrosPunto(id, lng, lat, elevacion, zona, presetKey = null) {
    let tKey = presetKey || tcsPresetGlobal;
    if (planeta === 'marte' && !presetKey) tKey = 'regolito_marte';
    const tcsPreset = PRESETS_TCS34725[tKey] || PRESETS_TCS34725.humus_optimo;

    // Ruido estocástico inicial
    const hum = Math.max(2, Math.min(95, Math.round(humedadGlobal + (Math.random() * 6 - 3))));
    const temp = +(tempGlobal + (Math.random() * 3 - 1.5)).toFixed(1);
    const ph = +(phGlobal + (Math.random() * 0.4 - 0.2)).toFixed(2);

    return {
      id,
      lng: +lng.toFixed(6),
      lat: +lat.toFixed(6),
      elevacion_m: +elevacion.toFixed(1),
      zona: zona || 'media',
      humedad: hum,
      temperatura: temp,
      ph: ph,
      sensor_tcs34725: {
        tipo_preset: tKey,
        nombre: tcsPreset.nombre,
        color_hex: tcsPreset.color_hex,
        r: tcsPreset.r,
        g: tcsPreset.g,
        b: tcsPreset.b,
        c: tcsPreset.c,
        lux: tcsPreset.lux,
      },
      estado: 'pendiente',
    };
  }

  // ─── GENERAR PUNTOS AUTOMÁTICOS DENTRO DEL POLÍGONO ───
  const generarPuntosAutomaticos = useCallback((cantidadPorRover = 7) => {
    if (!polygonGeoJSON) return [];
    const bbox = turf.bbox(polygonGeoJSON);
    const activeRovers = robotsDisponibles.filter((r) => selectedRoverIds.includes(r.id));
    const totalPuntos = Math.max(6, activeRovers.length * cantidadPorRover);
    const baseAlt = Number(terrenoActivo.elevacion_base_m) || (planeta === 'marte' ? -2500 : 1470);

    const generated = [];
    let attempts = 0;
    while (generated.length < totalPuntos && attempts < 500) {
      attempts++;
      const rndLng = bbox[0] + Math.random() * (bbox[2] - bbox[0]);
      const rndLat = bbox[1] + Math.random() * (bbox[3] - bbox[1]);
      const pt = turf.point([rndLng, rndLat]);
      if (turf.booleanPointInPolygon(pt, polygonGeoJSON)) {
        const id = generated.length + 1;
        const elev = baseAlt + (Math.random() * 18 - 9);
        const zona = elev > baseAlt + 3 ? 'alta' : (elev < baseAlt - 3 ? 'baja' : 'media');
        generated.push(crearParametrosPunto(id, rndLng, rndLat, elev, zona));
      }
    }
    return generated;
  }, [polygonGeoJSON, terrenoActivo, planeta, robotsDisponibles, selectedRoverIds, humedadGlobal, tempGlobal, phGlobal, tcsPresetGlobal]);

  // ─── GENERAR DEM Y RUTAS TSP ───
  const handleCalcularDEMyRutas = useCallback(async (puntosBase = null) => {
    if (!polygonGeoJSON) return;
    detenerSimulacion();
    setCalculandoDEM(true);
    addLog(`[CÁLCULO] Procesando topografía DEM e interpolación de rutas TSP...`);

    const coords = polygonGeoJSON.coordinates;
    const baseAlt = Number(terrenoActivo.elevacion_base_m) || (planeta === 'marte' ? -2500 : 1470);
    const activeRovers = robotsDisponibles.filter((r) => selectedRoverIds.includes(r.id));

    if (activeRovers.length === 0) {
      alert('Debes asignar al menos 1 Rover a la misión.');
      setCalculandoDEM(false);
      return;
    }

    // 1. Matriz DEM
    const gridSize = 16;
    const demMatriz = [];
    let minH = Infinity, maxH = -Infinity, sumH = 0;
    for (let r = 0; r < gridSize; r++) {
      const row = [];
      for (let c = 0; c < gridSize; c++) {
        const u = r / (gridSize - 1);
        const v = c / (gridSize - 1);
        const h = +(baseAlt + (u * 14 - v * 7) + Math.sin(u * Math.PI * 2) * 4.5).toFixed(2);
        row.push(h);
        if (h < minH) minH = h;
        if (h > maxH) maxH = h;
        sumH += h;
      }
      demMatriz.push(row);
    }
    setDemData({
      matriz: demMatriz,
      min: minH,
      max: maxH,
      avg: +(sumH / 256).toFixed(1),
      slope: +(Math.abs(maxH - minH) / 64).toFixed(1),
    });

    // 2. Puntos a utilizar
    let pts = puntosBase || (puntosMuestreo.length > 0 ? puntosMuestreo : generarPuntosAutomaticos());
    if (pts.length === 0) {
      pts = generarPuntosAutomaticos();
    }
    setPuntosMuestreo(pts);

    // 3. Resolver TSP por Rover
    const ptsPorRover = Math.ceil(pts.length / activeRovers.length);
    const rutasGeneradas = activeRovers.map((rover, rIdx) => {
      const startCoord = roverPuntosInicio[rover.id] || coords[rIdx % (coords.length - 1)];
      const myPoints = pts.slice(rIdx * ptsPorRover, (rIdx + 1) * ptsPorRover);

      const waypoints = [
        { indice: 0, lat: startCoord[1], lng: startCoord[0], tipo: 'base', elevacion_m: baseAlt },
        ...myPoints.map((p, i) => ({
          indice: i + 1,
          id: p.id,
          lat: p.lat,
          lng: p.lng,
          tipo: 'medicion',
          elevacion_m: p.elevacion_m,
          zona: p.zona,
        })),
        { indice: myPoints.length + 1, lat: startCoord[1], lng: startCoord[0], tipo: 'base', elevacion_m: baseAlt },
      ];

      const coordenadas_ruta = waypoints.map((w) => [w.lng, w.lat]);
      let distKm = 0;
      for (let i = 0; i < coordenadas_ruta.length - 1; i++) {
        distKm += turf.distance(coordenadas_ruta[i], coordenadas_ruta[i + 1], { units: 'kilometers' });
      }

      return {
        rover_id: rover.id,
        rover_nombre: rover.nombre,
        color: rover.color,
        distancia_km: +distKm.toFixed(3),
        consumo_bateria_est_pct: +(distKm * 4.5).toFixed(1),
        waypoints,
        coordenadas_ruta,
      };
    });

    setRutasData({
      rutas_rovers: rutasGeneradas,
      puntos_muestreo: pts,
    });

    // Inicializar posiciones de los rovers
    const initialPos = rutasGeneradas.map((r) => ({
      id: r.rover_id,
      nombre: r.rover_nombre,
      lat: r.waypoints[0].lat,
      lng: r.waypoints[0].lng,
      color: r.color,
      modo: 'lectura',
      bateria: 95,
    }));
    setSimRoversPositions(initialPos);

    addLog(`[RUTAS GENERADAS] ${rutasGeneradas.length} rovers con ${pts.length} puntos de medición listos.`);
    setCalculandoDEM(false);
  }, [polygonGeoJSON, terrenoActivo, planeta, robotsDisponibles, selectedRoverIds, roverPuntosInicio, puntosMuestreo, generarPuntosAutomaticos, addLog]);

  // Cargar redada inicial en mount
  useEffect(() => {
    if (terrenoActivo && polygonGeoJSON) {
      handleCalcularDEMyRutas();
    }
  }, [terrenoActivo?.id, planeta]);

  // ─── RESET TOTAL DE TRAZADO (COMO EN CrearTerrenoView.jsx) ───
  function handleResetTrazado() {
    detenerSimulacion();
    setRutasData(null);
    setPuntosMuestreo([]);
    setMedicionesRealizadas([]);
    setRoverPuntosInicio({});
    setDemData(null);
    setPuntoSeleccionadoId(null);
    setModoInteractivo('add_point');
    addLog(`[RESET TRAZADO] Terreno despejado. Haz clic en el mapa para añadir puntos o posicionar Rovers.`);
  }

  // ─── CLICK EN EL MAPA PARA TRAZAR PUNTOS O POSICIONAR ROVERS ───
  function handleMapClick(e) {
    if (!e || !e.lngLat) return;
    const { lng, lat } = e.lngLat;

    // Modo 1: Añadir Punto de Medición
    if (modoInteractivo === 'add_point') {
      const nuevoId = puntosMuestreo.length + 1;
      const baseAlt = Number(terrenoActivo.elevacion_base_m) || (planeta === 'marte' ? -2500 : 1470);
      const elev = baseAlt + (Math.random() * 12 - 6);
      const nuevoPunto = crearParametrosPunto(nuevoId, lng, lat, elev, 'media');

      const nuevaLista = [...puntosMuestreo, nuevoPunto];
      setPuntosMuestreo(nuevaLista);
      setPuntoSeleccionadoId(nuevoId);
      setActiveTabPanel('punto_editor');
      addLog(`[NUEVO PUNTO] Creado Punto #${nuevoId} en [${lat.toFixed(5)}, ${lng.toFixed(5)}].`);
    }

    // Modo 2: Posicionar Rover
    else if (modoInteractivo === 'position_rover') {
      if (roverParaPosicionar) {
        setRoverPuntosInicio((prev) => ({
          ...prev,
          [roverParaPosicionar.id]: [lng, lat],
        }));
        addLog(`[ROVER POSICIONADO] ${roverParaPosicionar.nombre} asignado en [${lat.toFixed(5)}, ${lng.toFixed(5)}].`);
        setModalPosicionarRover(false);
        setRoverParaPosicionar(null);
        setModoInteractivo('view');
      } else {
        setModalPosicionarRover(true);
      }
    }
  }

  // ─── GENERADOR RÁPIDO DE PRESETS DE CONDICIONES (ÓPTIMO, MEDIO, POBRE, ALEATORIO) ───
  function aplicarPresetRapido(tipo) {
    let targetTemp, targetPh, targetHum, targetTcsKey;

    if (tipo === 'optimo') {
      targetTemp = planeta === 'marte' ? 12 : 24;
      targetPh = 6.8;
      targetHum = 65;
      targetTcsKey = 'humus_optimo';
    } else if (tipo === 'medio') {
      targetTemp = planeta === 'marte' ? -35 : 19;
      targetPh = 6.0;
      targetHum = 42;
      targetTcsKey = 'arcilla_franco';
    } else if (tipo === 'pobre') {
      targetTemp = planeta === 'marte' ? -78 : 41;
      targetPh = planeta === 'marte' ? 9.2 : 4.4;
      targetHum = 10;
      targetTcsKey = planeta === 'marte' ? 'regolito_marte' : 'salino_pobre';
    } else if (tipo === 'aleatorio') {
      // Generar distribución heterogénea aleatoria punto por punto
      setPuntosMuestreo((prev) =>
        prev.map((pt) => {
          const keys = ['humus_optimo', 'arcilla_franco', 'salino_pobre', 'regolito_marte'];
          const rndKey = keys[Math.floor(Math.random() * keys.length)];
          const tcsPreset = PRESETS_TCS34725[rndKey];
          return {
            ...pt,
            humedad: Math.floor(Math.random() * 85) + 10,
            temperatura: +(planeta === 'marte' ? -80 + Math.random() * 95 : 10 + Math.random() * 32).toFixed(1),
            ph: +(4.2 + Math.random() * 5.2).toFixed(2),
            sensor_tcs34725: {
              tipo_preset: rndKey,
              nombre: tcsPreset.nombre,
              color_hex: tcsPreset.color_hex,
              r: tcsPreset.r,
              g: tcsPreset.g,
              b: tcsPreset.b,
              c: tcsPreset.c,
              lux: tcsPreset.lux,
            },
          };
        })
      );
      addLog(`[PRESET ALEATORIO] Generada distribución heterogénea para todos los puntos.`);
      return;
    }

    setTempGlobal(targetTemp);
    setPhGlobal(targetPh);
    setHumedadGlobal(targetHum);
    setTcsPresetGlobal(targetTcsKey);

    const tcsPreset = PRESETS_TCS34725[targetTcsKey];

    // Aplicar a todos los puntos actuales
    setPuntosMuestreo((prev) =>
      prev.map((pt) => ({
        ...pt,
        humedad: targetHum,
        temperatura: targetTemp,
        ph: targetPh,
        sensor_tcs34725: {
          tipo_preset: targetTcsKey,
          nombre: tcsPreset.nombre,
          color_hex: tcsPreset.color_hex,
          r: tcsPreset.r,
          g: tcsPreset.g,
          b: tcsPreset.b,
          c: tcsPreset.c,
          lux: tcsPreset.lux,
        },
      }))
    );

    addLog(`[PRESET APLICADO] Todos los puntos calibrados a condiciones "${tipo.toUpperCase()}".`);
  }

  // ─── EDICIÓN DE UN PUNTO INDIVIDUAL ───
  const puntoActivoEnEdicion = useMemo(() => {
    return puntosMuestreo.find((p) => p.id === puntoSeleccionadoId) || puntosMuestreo[0] || null;
  }, [puntosMuestreo, puntoSeleccionadoId]);

  function actualizarPuntoIndividual(id, camposActualizados) {
    setPuntosMuestreo((prev) =>
      prev.map((pt) => (pt.id === id ? { ...pt, ...camposActualizados } : pt))
    );
  }

  // ─── CONTROL DE ANIMACIÓN TEMPORAL (PLAY / PAUSE / RESET) ───
  function detenerSimulacion() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setSimulando(false);
  }

  function handleTogglePlay() {
    if (!rutasData || !rutasData.rutas_rovers || rutasData.rutas_rovers.length === 0) {
      alert('Primero debes trazar o calcular la redada de rutas.');
      return;
    }

    if (simulando) {
      detenerSimulacion();
      addLog(`[PAUSA] Recorrido temporal detenido.`);
    } else {
      setSimulando(true);
      addLog(`[INICIANDO REDADA] Flota de rovers iniciando recorrido a ${velocidadSim}x.`);
    }
  }

  function handleResetSimulacion() {
    detenerSimulacion();
    setSimStep(0);
    setMedicionesRealizadas([]);
    if (rutasData && rutasData.rutas_rovers) {
      const initialPos = rutasData.rutas_rovers.map((r) => ({
        id: r.rover_id,
        nombre: r.rover_nombre,
        lat: r.waypoints[0].lat,
        lng: r.waypoints[0].lng,
        color: r.color,
        modo: 'lectura',
        bateria: 95,
      }));
      setSimRoversPositions(initialPos);
      setPuntosMuestreo((prev) => prev.map((p) => ({ ...p, estado: 'pendiente' })));
    }
    addLog(`[REINICIO] Posiciones y mediciones reiniciadas a bases.`);
  }

  // Bucle de recorrido
  useEffect(() => {
    if (!simulando || !rutasData || !rutasData.rutas_rovers) return;

    const intervalMs = Math.max(30, 160 / velocidadSim);

    timerRef.current = setInterval(() => {
      setSimStep((cur) => {
        const next = cur + 1;
        const totalSteps = 120;

        if (next > totalSteps) {
          detenerSimulacion();
          addLog(`[MISIÓN COMPLETADA] 100% de los puntos de medición capturados con sensor TCS34725 y telemetría.`);
          return cur;
        }

        const globalPct = next / totalSteps;

        // Mover rovers a lo largo de las rutas
        const newPositions = rutasData.rutas_rovers.map((ruta) => {
          const coords = ruta.coordenadas_ruta;
          if (!coords || coords.length < 2) return null;
          const totalSegs = coords.length - 1;
          const progress = globalPct * totalSegs;
          const segIdx = Math.min(Math.floor(progress), totalSegs - 1);
          const t = progress - segIdx;

          const pA = coords[segIdx];
          const pB = coords[segIdx + 1];

          return {
            id: ruta.rover_id,
            nombre: ruta.rover_nombre,
            lat: pA[1] + (pB[1] - pA[1]) * t,
            lng: pA[0] + (pB[0] - pA[0]) * t,
            color: ruta.color,
            modo: 'lectura',
            bateria: Math.max(30, +(95 - globalPct * ruta.consumo_bateria_est_pct).toFixed(1)),
          };
        }).filter(Boolean);

        setSimRoversPositions(newPositions);

        // Detectar si el rover toca algún punto de medición
        setPuntosMuestreo((prevPoints) => {
          let huboCambio = false;
          const nextPoints = prevPoints.map((pt) => {
            if (pt.estado === 'completado') return pt;

            for (const rPos of newPositions) {
              const d = turf.distance([rPos.lng, rPos.lat], [pt.lng, pt.lat], { units: 'kilometers' });
              if (d <= 0.05) { // 50 metros
                huboCambio = true;
                const rec = {
                  id: pt.id,
                  rover: rPos.nombre,
                  lat: pt.lat,
                  lng: pt.lng,
                  temperatura: pt.temperatura,
                  ph: pt.ph,
                  humedad: pt.humedad,
                  tcs: pt.sensor_tcs34725,
                  timestamp: new Date().toLocaleTimeString(),
                };

                setMedicionesRealizadas((prevMeds) => {
                  if (prevMeds.some((m) => m.id === pt.id)) return prevMeds;
                  return [rec, ...prevMeds];
                });

                addLog(`[MUESTRA #${pt.id}] ${rPos.nombre}: Temp=${pt.temperatura}°C, pH=${pt.ph}, Hum=${pt.humedad}%, Color=${pt.sensor_tcs34725?.color_hex} (${pt.sensor_tcs34725?.nombre}).`);

                return { ...pt, estado: 'completado' };
              }
            }
            return pt;
          });

          return huboCambio ? nextPoints : prevPoints;
        });

        return next;
      });
    }, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [simulando, rutasData, velocidadSim, addLog]);

  const totalPuntos = puntosMuestreo.length;
  const puntosCompletados = puntosMuestreo.filter((p) => p.estado === 'completado').length;
  const pctCompletado = totalPuntos > 0 ? Math.round((puntosCompletados / totalPuntos) * 100) : 0;

  const terrenoParaMapa = useMemo(() => {
    if (!terrenoActivo) return null;
    return {
      ...terrenoActivo,
      entorno: planeta,
      poligono_coordenadas: polygonGeoJSON?.coordinates,
      rutas_rovers: rutasData?.rutas_rovers,
      clusters_muestreo: rutasData?.clusters_muestreo,
    };
  }, [terrenoActivo, planeta, polygonGeoJSON, rutasData]);

  // ─── 7. EJECUTAR FASE 2: MATRIZ DE IDONEIDAD EDAFOLÓGICA ───
  const handleEjecutarFase2 = useCallback(async (customCfu, customNumInj) => {
    setFase2Loading(true);
    addLog('[FASE 2] Calculando Matriz de Idoneidad con IA y normalizaciones...');

    // Asegurar puntos de medición
    let pts = puntosMuestreo;
    if (!pts || pts.length === 0) {
      pts = generarPuntosAutomaticos();
      setPuntosMuestreo(pts);
      addLog(`[FASE 2] Generando ${pts.length} puntos sensoriales base...`);
    }

    const cfuVal = customCfu !== undefined ? customCfu : cfuConcentration;
    const numInjVal = customNumInj !== undefined ? customNumInj : numInyecciones;

    try {
      const payload = {
        puntos_medicion: pts,
        poligono_coordenadas: polygonGeoJSON?.coordinates || [],
        matriz_dem: demData?.matriz || null,
        grid_size: 40,
        entorno: planeta,
        cfu_concentration: cfuVal,
        num_inyecciones: numInjVal,
      };

      if (planeta === 'marte') {
        payload.humectant_capacity = alginatoCapacidad;
        payload.chitosan_shield = chitosanShield;
        payload.modo_tiempo = modoTiempoMarte;
        payload.sol_hour = solHora;
        payload.temperatura_manual = modoTiempoMarte === 'fijo_manual' ? tempManualMarte : null;
        payload.perchlorates_factor = percloratosFactor;
        payload.iron_oxides_factor = oxidosHierroFactor;
        payload.total_steps = 24;
      }

      const res = await apiService.calcularFase2MatrizIdoneidad(payload);
      if (res && res.success) {
        setFase2Data(res);
        setFaseActiva('fase2');
        addLog(`[FASE 2] Matriz generada (40x40). Idoneidad media: ${(res.estadisticas.idoneidad_promedio * 100).toFixed(1)}%.`);
        addLog(`[FASE 2] ${res.semillas_inyeccion.length} focos óptimos de inyección calculados con distanciamiento radial.`);
      } else {
        throw new Error(res?.error || 'Respuesta inválida del servidor');
      }
    } catch (err) {
      console.error('Error calculando Fase 2:', err);
      addLog(`[ERROR FASE 2] Falló el cálculo: ${err.message}`);
      alert(`Error al calcular la matriz de idoneidad: ${err.message}`);
    } finally {
      setFase2Loading(false);
    }
  }, [puntosMuestreo, generarPuntosAutomaticos, cfuConcentration, numInyecciones, polygonGeoJSON, demData, planeta, alginatoCapacidad, chitosanShield, modoTiempoMarte, solHora, tempManualMarte, percloratosFactor, oxidosHierroFactor, addLog]);

  // ─── 8. SIMULAR LABORATORIO DE ASTROBIOLOGÍA MARCIANA (TRAJE ESPACIAL) ───
  const handleSimularTrajeMarte = useCallback(async () => {
    setFase2Loading(true);
    addLog(`[LAB MARTE] Simulando biocápsula espacial: Sol ${solHora}:00 (${tempMarteActual}°C), Alginato ${alginatoCapacidad}h, Quitosano ${(chitosanShield * 100).toFixed(0)}%...`);
    try {
      const payload = {
        poligono_coordenadas: polygonGeoJSON?.coordinates || [],
        matriz_dem: demData?.matriz || null,
        grid_size: 40,
        cfu_concentration: cfuConcentration,
        humectant_capacity: alginatoCapacidad,
        chitosan_shield: chitosanShield,
        modo_tiempo: modoTiempoMarte,
        sol_hour: solHora,
        temperatura_manual: modoTiempoMarte === 'fijo_manual' ? tempManualMarte : null,
        temp_mean: -25.0,
        temp_amp: 40.0,
        perchlorates_factor: percloratosFactor,
        iron_oxides_factor: oxidosHierroFactor,
        total_steps: 24,
        num_inyecciones: numInyecciones,
      };

      const res = await apiService.simularLaboratorioMarte(payload);
      if (res && res.success) {
        setFase2Data(res);
        setFaseActiva('fase2');
        addLog(`[LAB MARTE] Simulación exitosa. T=${res.telemetria_sol?.temp_celsius}°C, Estado: ${res.telemetria_sol?.estado_termico}.`);
        addLog(`[LAB MARTE] Quitosano redujo estrés ROS; Gel restante: ${res.telemetria_sol?.porcentaje_gel_restante}%.`);
      } else {
        throw new Error(res?.error || 'Respuesta inválida de la simulación marciana');
      }
    } catch (err) {
      console.error('Error simulando laboratorio marciano:', err);
      addLog(`[ERROR LAB MARTE] ${err.message}`);
      alert(`Error al simular traje espacial marciano: ${err.message}`);
    } finally {
      setFase2Loading(false);
    }
  }, [polygonGeoJSON, demData, cfuConcentration, alginatoCapacidad, chitosanShield, modoTiempoMarte, solHora, tempManualMarte, tempMarteActual, percloratosFactor, oxidosHierroFactor, numInyecciones, addLog]);

  return (
    <div className="min-h-[calc(100vh-65px)] text-slate-100 p-3 sm:p-5 flex flex-col gap-3 font-sans select-none">

      {/* ────────────────────────────────────────────────────────── */}
      {/* 1. BARRA SUPERIOR: CONFIGURACIÓN DE MISIÓN Y PLANETA      */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="p-3 sm:p-4 rounded-2xl flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 shadow-lg">
        
        {/* Selector de Planeta (Tierra vs Marte) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleCambiarPlaneta('tierra')}
            className={`px-3 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition-all border ${
              planeta === 'tierra'
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-sm shadow-cyan-500/20'
                : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            <i className="fa-solid fa-earth-americas text-emerald-400" />
            <span>Planeta Tierra</span>
          </button>

          <button
            type="button"
            onClick={() => handleCambiarPlaneta('marte')}
            className={`px-3 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition-all border ${
              planeta === 'marte'
                ? 'bg-[#ff4500]/20 text-[#ff4500] border-[#ff4500] shadow-sm shadow-red-500/20'
                : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            <i className="fa-solid fa-meteor text-orange-500" />
            <span>Planeta Marte</span>
          </button>
        </div>

        {/* Telemetría Rápida del Sol Marciano */}
        {planeta === 'marte' && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-orange-950/40 border border-orange-500/40 text-[0.68rem] font-mono shrink-0 shadow-sm">
            <span className={`w-2 h-2 rounded-full ${esNocheMarte ? 'bg-blue-400' : 'bg-amber-400'} animate-pulse`} />
            <span className="text-orange-300 font-bold">SOL {String(solHora).padStart(2, '0')}:00</span>
            <span className="text-slate-500">|</span>
            <span className={`font-bold ${tempMarteActual >= 0 ? 'text-amber-400' : tempMarteActual > -8 ? 'text-orange-400' : 'text-blue-300'}`}>
              {tempMarteActual > 0 ? `+${tempMarteActual}` : tempMarteActual}°C
            </span>
            <span className={`px-1.5 py-0.5 rounded text-[0.6rem] font-bold ${
              enCrioDormancia ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            }`}>
              {enCrioDormancia ? '❄️ Crio-Dormancia' : '☀️ Ventana Activa'}
            </span>
          </div>
        )}

        {/* Selector de Fase Activa (Fase 1 Mapeo vs Fase 2 Idoneidad) */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => setFaseActiva('fase1')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
              faseActiva === 'fase1'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <i className="fa-solid fa-map-location-dot" />
            <span>Fase 1: Mapeo</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!fase2Data) {
                handleEjecutarFase2();
              } else {
                setFaseActiva('fase2');
              }
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
              faseActiva === 'fase2'
                ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-amber-300'
            }`}
          >
            <i className="fa-solid fa-flask-vial text-amber-400" />
            <span>Fase 2: Idoneidad</span>
            {fase2Data && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
          </button>
        </div>

        {/* Selector de Parcela */}
        <div className="flex-1 max-w-md">
          <select
            value={terrenoActivo?.id || ''}
            onChange={(e) => {
              const target = parcelasDisponibles.find((p) => String(p.id) === e.target.value);
              if (target) {
                setTerrenoActivo(target);
                addLog(`[PARCELA SELECCIONADA] ${target.nombre}.`);
              }
            }}
            className="w-full h-9 px-3 bg-slate-950 border border-slate-700/80 rounded-xl text-xs font-mono text-white outline-none focus:border-cyan-400"
          >
            {parcelasDisponibles.map((p) => (
              <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                {p.nombre} ({p.dimensiones_m2 ? `${(p.dimensiones_m2/10000).toFixed(1)} ha` : 'Terreno'})
              </option>
            ))}
          </select>
        </div>

        {/* Botonera de Herramientas de Trazado (Como en CrearTerrenoView) */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Botón Reset Trazado */}
          <button
            type="button"
            onClick={handleResetTrazado}
            className="px-2.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-sm"
            title="Borrar puntos actuales y comenzar nuevo trazado interactivo"
          >
            <i className="fa-solid fa-rotate-left" />
            <span>Resetear Trazo</span>
          </button>

          {/* Modo + Punto de Medición */}
          <button
            type="button"
            onClick={() => setModoInteractivo(modoInteractivo === 'add_point' ? 'view' : 'add_point')}
            className={`px-2.5 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all border ${
              modoInteractivo === 'add_point'
                ? 'bg-emerald-500/25 text-emerald-300 border-emerald-400 shadow-sm ring-1 ring-emerald-400/50'
                : 'bg-slate-950/70 text-slate-300 border-slate-800 hover:text-white'
            }`}
            title="Haz clic en el mapa para añadir puntos de medición personalizados"
          >
            <i className="fa-solid fa-location-crosshairs text-emerald-400" />
            <span>+ Punto</span>
          </button>

          {/* Modo + Posicionar Rover */}
          <button
            type="button"
            onClick={() => {
              setModalPosicionarRover(true);
            }}
            className="px-2.5 py-2 rounded-xl bg-slate-950/70 text-amber-300 border border-amber-500/40 hover:bg-amber-500/10 text-xs font-mono font-bold flex items-center gap-1.5 transition-all"
            title="Asignar posición inicial de los Rovers en el terreno"
          >
            <i className="fa-solid fa-robot text-amber-400" />
            <span>+ Posicionar Rover</span>
          </button>

          {/* Generar Automático */}
          <button
            type="button"
            onClick={() => {
              const nuevos = generarPuntosAutomaticos();
              setPuntosMuestreo(nuevos);
              addLog(`[AUTO-MALLA] Malla de ${nuevos.length} puntos generada automáticamente.`);
            }}
            className="px-2.5 py-2 rounded-xl bg-slate-950/70 text-slate-300 border border-slate-800 hover:text-white text-xs font-mono flex items-center gap-1.5 transition-all"
            title="Generar distribución estratificada de puntos dentro del polígono"
          >
            <i className="fa-solid fa-table-cells text-cyan-400" />
            <span>Malla Auto</span>
          </button>

          {/* Calcular DEM & Rutas */}
          <button
            type="button"
            onClick={() => handleCalcularDEMyRutas()}
            disabled={calculandoDEM}
            className="px-3 py-2 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-mono font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all disabled:opacity-50"
          >
            {calculandoDEM ? <i className="fa-solid fa-spinner animate-spin" /> : <i className="fa-solid fa-network-wired" />}
            <span>Calcular Rutas</span>
          </button>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 2. CUERPO PRINCIPAL: MAPA (IZQUIERDA) + PANEL (DERECHA) O FASE 2 STUDIO */}
      {/* ────────────────────────────────────────────────────────── */}
      {faseActiva === 'fase2' ? (
        <Fase2IdoneidadStudio
          fase2Data={fase2Data}
          loading={fase2Loading}
          onRecalcular={(customCfu, customNum) => handleEjecutarFase2(customCfu, customNum)}
          terrenoActivo={terrenoActivo}
          planeta={planeta}
          cfuConcentration={cfuConcentration}
          setCfuConcentration={setCfuConcentration}
          numInyecciones={numInyecciones}
          setNumInyecciones={setNumInyecciones}
          onVolverFase1={() => setFaseActiva('fase1')}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 items-stretch">

        {/* ── COLUMNA IZQUIERDA: MAPA Y REPRODUCTOR (8 cols) ── */}
        <div className="lg:col-span-8 flex flex-col gap-2">
          
          {/* Barra superior de información DEM y estado de trazo */}
          <div className="px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-2 text-xs font-mono">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-cyan-400 font-bold flex items-center gap-1.5">
                <i className="fa-solid fa-mountain" />
                DEM {demData ? `[${demData.min}m a ${demData.max}m · Media ${demData.avg}m · ∇h ${demData.slope}°]` : 'Sin calcular'}
              </span>
              {modoInteractivo === 'add_point' && (
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[0.65rem] animate-pulse">
                  Modo Activo: Haz clic en el mapa para colocar puntos
                </span>
              )}
            </div>

            <span className="text-[0.65rem] text-slate-400">
              Puntos: <strong className="text-white">{puntosMuestreo.length}</strong> | Rovers: <strong className="text-amber-400">{selectedRoverIds.length}</strong>
            </span>
          </div>

          {/* Contenedor del Mapa Mapbox (Sin superposiciones molestas) */}
          <div className="w-full h-[520px] rounded-2xl overflow-hidden border border-slate-800 bg-black relative shadow-xl">
            <MapaMisionTerreno
              terreno={terrenoParaMapa}
              robots={robotsDisponibles.filter((r) => selectedRoverIds.includes(r.id))}
              simRoversPositions={simRoversPositions}
              rutasRovers={rutasData?.rutas_rovers}
              clustersMuestreo={rutasData?.clusters_muestreo}
              onMapClick={handleMapClick}
              onSelectMarker={(m) => {
                if (m && m.tipo === 'medicion' && m.data?.id) {
                  setPuntoSeleccionadoId(m.data.id);
                  setActiveTabPanel('punto_editor');
                }
              }}
            />
          </div>

          {/* Barra Inferior del Mapa: Playback & Timeline */}
          <div className="p-3 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md font-mono text-xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTogglePlay}
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm transition-all shadow-md ${
                  simulando
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/30'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/30'
                }`}
                title={simulando ? 'Pausar simulación' : 'Iniciar simulación temporal'}
              >
                <i className={`fa-solid ${simulando ? 'fa-pause' : 'fa-play'}`} />
              </button>

              <button
                type="button"
                onClick={handleResetSimulacion}
                className="w-8 h-8 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 flex items-center justify-center text-xs transition-colors"
                title="Reiniciar recorrido temporal"
              >
                <i className="fa-solid fa-rotate-left" />
              </button>

              <div className="flex items-center rounded-xl bg-slate-950 p-1 border border-slate-800 text-[0.65rem]">
                {[1, 2, 4].map((spd) => (
                  <button
                    key={spd}
                    onClick={() => setVelocidadSim(spd)}
                    className={`px-2 py-0.5 rounded-lg transition-all ${
                      velocidadSim === spd ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 max-w-sm flex flex-col gap-1">
              <div className="flex items-center justify-between text-[0.65rem] text-slate-400">
                <span>Progreso de Redada: <strong className="text-cyan-300">{pctCompletado}%</strong></span>
                <span>Capturados: <strong className="text-white">{puntosCompletados} / {totalPuntos}</strong></span>
              </div>
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-300 rounded-full"
                  style={{ width: `${pctCompletado}%` }}
                />
              </div>
            </div>
          </div>

        </div>

        {/* ── COLUMNA DERECHA: PANEL LATERAL DE CONDICIONES Y PUNTOS (4 cols) ── */}
        <div className="lg:col-span-4 flex flex-col gap-2 rounded-2xl p-3 shadow-xl h-[630px] overflow-hidden">
          
          {/* Pestañas Superiores del Panel */}
          <div className={`grid ${planeta === 'marte' ? 'grid-cols-4' : 'grid-cols-3'} gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[0.68rem] font-mono font-bold`}>
            <button
              type="button"
              onClick={() => setActiveTabPanel('presets')}
              className={`py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 ${
                activeTabPanel === 'presets' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-white'
              }`}
            >
              <i className="fa-solid fa-bolt" />
              <span>Presets</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTabPanel('punto_editor')}
              className={`py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 ${
                activeTabPanel === 'punto_editor' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'text-slate-400 hover:text-white'
              }`}
            >
              <i className="fa-solid fa-sliders" />
              <span>Por Punto</span>
            </button>

            {planeta === 'marte' && (
              <button
                type="button"
                onClick={() => setActiveTabPanel('marte_suit')}
                className={`py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 ${
                  activeTabPanel === 'marte_suit'
                    ? 'bg-orange-500/25 text-orange-400 border border-orange-500/40 shadow-sm shadow-orange-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Laboratorio Astrobiológico: Hiperparámetros de Traje Espacial Marciano"
              >
                <i className="fa-solid fa-user-astronaut text-orange-400" />
                <span className="truncate">Traje Marte</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveTabPanel('telemetria')}
              className={`py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 ${
                activeTabPanel === 'telemetria' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-slate-400 hover:text-white'
              }`}
            >
              <i className="fa-solid fa-satellite-dish" />
              <span>Telemetría</span>
            </button>
          </div>

          {/* ────────────────────────────────────────────────────────── */}
          {/* CONTENIDO PESTAÑA 1: PRESETS RÁPIDOS Y ALEATORIOS         */}
          {/* ────────────────────────────────────────────────────────── */}
          {activeTabPanel === 'presets' && (
            <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 text-xs font-mono custom-scrollbar pt-1">
              
              <div className="space-y-1">
                <span className="text-[0.68rem] uppercase font-bold text-slate-400 flex items-center gap-1.5">
                  <i className="fa-solid fa-wand-magic-sparkles text-cyan-400" />
                  Calibración Rápida Global
                </span>
                <p className="text-[0.62rem] text-slate-400 leading-relaxed">
                  Aplica condiciones predefinidas o genera aleatoriedad para toda la redada en 1 solo clic:
                </p>
              </div>

              {/* Botones de Presets Rápidos */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => aplicarPresetRapido('optimo')}
                  className="p-2.5 rounded-xl bg-emerald-950/30 hover:bg-emerald-950/50 border border-emerald-500/40 text-left transition-all group"
                >
                  <div className="flex items-center justify-between text-emerald-400 font-bold mb-1">
                    <span className="flex items-center gap-1.5">
                      <i className="fa-solid fa-circle-check text-xs" /> Óptimas
                    </span>
                    <span className="text-[0.6rem] px-1.5 rounded bg-emerald-500/20">65% H</span>
                  </div>
                  <span className="text-[0.58rem] text-slate-400 block">pH 6.8 &bull; Humus Fértil (TCS)</span>
                </button>

                <button
                  type="button"
                  onClick={() => aplicarPresetRapido('medio')}
                  className="p-2.5 rounded-xl bg-amber-950/30 hover:bg-amber-950/50 border border-amber-500/40 text-left transition-all group"
                >
                  <div className="flex items-center justify-between text-amber-400 font-bold mb-1">
                    <span className="flex items-center gap-1.5">
                      <i className="fa-solid fa-circle-half-stroke text-xs" /> Medias
                    </span>
                    <span className="text-[0.6rem] px-1.5 rounded bg-amber-500/20">42% H</span>
                  </div>
                  <span className="text-[0.58rem] text-slate-400 block">pH 6.0 &bull; Franco Arcilla</span>
                </button>

                <button
                  type="button"
                  onClick={() => aplicarPresetRapido('pobre')}
                  className="p-2.5 rounded-xl bg-red-950/30 hover:bg-red-950/50 border border-red-500/40 text-left transition-all group"
                >
                  <div className="flex items-center justify-between text-red-400 font-bold mb-1">
                    <span className="flex items-center gap-1.5">
                      <i className="fa-solid fa-triangle-exclamation text-xs" /> Pobres / Ext.
                    </span>
                    <span className="text-[0.6rem] px-1.5 rounded bg-red-500/20">10% H</span>
                  </div>
                  <span className="text-[0.58rem] text-slate-400 block">pH Crítico &bull; Regolito/Salino</span>
                </button>

                <button
                  type="button"
                  onClick={() => aplicarPresetRapido('aleatorio')}
                  className="p-2.5 rounded-xl bg-purple-950/30 hover:bg-purple-950/50 border border-purple-500/40 text-left transition-all group"
                >
                  <div className="flex items-center justify-between text-purple-300 font-bold mb-1">
                    <span className="flex items-center gap-1.5">
                      <i className="fa-solid fa-dice text-xs" /> Aleatorio
                    </span>
                    <span className="text-[0.6rem] px-1.5 rounded bg-purple-500/20">Mixto</span>
                  </div>
                  <span className="text-[0.58rem] text-slate-400 block">Heterogéneo estocástico</span>
                </button>
              </div>

              {/* Sliders Globales de Referencia */}
              <div className="space-y-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-[0.65rem] text-slate-400 font-bold block border-b border-slate-800 pb-1">
                  Valores Base Generales:
                </span>

                {/* Humedad Global */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[0.65rem]">
                    <span className="text-cyan-400"><i className="fa-solid fa-droplet mr-1" /> Humedad Global:</span>
                    <strong className="text-white">{humedadGlobal}%</strong>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="95"
                    value={humedadGlobal}
                    onChange={(e) => setHumedadGlobal(Number(e.target.value))}
                    className="w-full h-1 bg-slate-800 rounded accent-cyan-400 cursor-pointer"
                  />
                </div>

                {/* Temp Global */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[0.65rem]">
                    <span className="text-orange-400"><i className="fa-solid fa-temperature-half mr-1" /> Temperatura Global:</span>
                    <strong className="text-white">{tempGlobal > 0 ? `+${tempGlobal}` : tempGlobal}°C</strong>
                  </div>
                  <input
                    type="range"
                    min={planeta === 'marte' ? -90 : 5}
                    max={planeta === 'marte' ? 20 : 48}
                    value={tempGlobal}
                    onChange={(e) => setTempGlobal(Number(e.target.value))}
                    className="w-full h-1 bg-slate-800 rounded accent-orange-400 cursor-pointer"
                  />
                </div>

                {/* pH Global */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[0.65rem]">
                    <span className="text-emerald-400"><i className="fa-solid fa-flask mr-1" /> pH Global:</span>
                    <strong className="text-white">{phGlobal}</strong>
                  </div>
                  <input
                    type="range"
                    min="3.5"
                    max="10.0"
                    step="0.1"
                    value={phGlobal}
                    onChange={(e) => setPhGlobal(Number(e.target.value))}
                    className="w-full h-1 bg-slate-800 rounded accent-emerald-400 cursor-pointer"
                  />
                </div>
              </div>

            </div>
          )}

          {/* ────────────────────────────────────────────────────────── */}
          {/* CONTENIDO PESTAÑA 2: EDITOR INDIVIDUAL POR PUNTO + TCS34725 */}
          {/* ────────────────────────────────────────────────────────── */}
          {activeTabPanel === 'punto_editor' && (
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs font-mono custom-scrollbar pt-1">
              
              {/* Selector de Punto a Editar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[0.68rem] font-bold text-slate-400">
                  <span>Seleccionar Punto de Medición:</span>
                  <span className="text-cyan-400">{puntosMuestreo.length} disponibles</span>
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                  {puntosMuestreo.map((pt) => (
                    <button
                      key={pt.id}
                      type="button"
                      onClick={() => setPuntoSeleccionadoId(pt.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all shrink-0 ${
                        puntoActivoEnEdicion?.id === pt.id
                          ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-extrabold shadow-sm'
                          : pt.estado === 'completado'
                          ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/40'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      #{pt.id}
                    </button>
                  ))}
                </div>
              </div>

              {puntoActivoEnEdicion ? (
                <div className="p-3 bg-slate-950 rounded-2xl border border-cyan-500/30 space-y-3">
                  
                  {/* Encabezado del Punto */}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div>
                      <strong className="text-sm font-bold text-white flex items-center gap-1.5">
                        <i className="fa-solid fa-location-dot text-cyan-400" />
                        Punto #{puntoActivoEnEdicion.id}
                      </strong>
                      <span className="text-[0.6rem] text-slate-400 block">
                        Cota: {puntoActivoEnEdicion.elevacion_m}m &bull; Zona: {puntoActivoEnEdicion.zona}
                      </span>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[0.62rem] font-bold uppercase ${
                      puntoActivoEnEdicion.estado === 'completado'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      {puntoActivoEnEdicion.estado}
                    </span>
                  </div>

                  {/* 1. Slider Humedad Individual */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[0.65rem]">
                      <span className="text-cyan-400 flex items-center gap-1">
                        <i className="fa-solid fa-droplet text-xs" /> Humedad:
                      </span>
                      <strong className="text-white">{puntoActivoEnEdicion.humedad}%</strong>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="95"
                      value={puntoActivoEnEdicion.humedad}
                      onChange={(e) =>
                        actualizarPuntoIndividual(puntoActivoEnEdicion.id, { humedad: Number(e.target.value) })
                      }
                      className="w-full h-1 bg-slate-800 rounded accent-cyan-400 cursor-pointer"
                    />
                  </div>

                  {/* 2. Slider Temperatura Individual */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[0.65rem]">
                      <span className="text-orange-400 flex items-center gap-1">
                        <i className="fa-solid fa-temperature-half text-xs" /> Temperatura:
                      </span>
                      <strong className="text-white">
                        {puntoActivoEnEdicion.temperatura > 0 ? `+${puntoActivoEnEdicion.temperatura}` : puntoActivoEnEdicion.temperatura}°C
                      </strong>
                    </div>
                    <input
                      type="range"
                      min={planeta === 'marte' ? -90 : 5}
                      max={planeta === 'marte' ? 20 : 48}
                      value={puntoActivoEnEdicion.temperatura}
                      onChange={(e) =>
                        actualizarPuntoIndividual(puntoActivoEnEdicion.id, { temperatura: Number(e.target.value) })
                      }
                      className="w-full h-1 bg-slate-800 rounded accent-orange-400 cursor-pointer"
                    />
                  </div>

                  {/* 3. Slider pH Individual */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[0.65rem]">
                      <span className="text-emerald-400 flex items-center gap-1">
                        <i className="fa-solid fa-flask text-xs" /> Nivel de pH:
                      </span>
                      <strong className="text-white">{puntoActivoEnEdicion.ph}</strong>
                    </div>
                    <input
                      type="range"
                      min="3.5"
                      max="10.0"
                      step="0.1"
                      value={puntoActivoEnEdicion.ph}
                      onChange={(e) =>
                        actualizarPuntoIndividual(puntoActivoEnEdicion.id, { ph: Number(e.target.value) })
                      }
                      className="w-full h-1 bg-slate-800 rounded accent-emerald-400 cursor-pointer"
                    />
                  </div>

                  {/* 4. SENSOR TCS34725 (COLOR RGB + CLEAR + LUX) */}
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-[0.65rem]">
                      <span className="text-purple-300 font-bold flex items-center gap-1.5">
                        <i className="fa-solid fa-eye-dropper" /> Sensor TCS34725 (Color/Lux)
                      </span>
                      <span
                        className="w-4 h-4 rounded-full border border-white/50 shadow-sm inline-block"
                        style={{ backgroundColor: puntoActivoEnEdicion.sensor_tcs34725?.color_hex || '#3e2723' }}
                      />
                    </div>

                    {/* Selector de Tipo de Suelo / Espectro */}
                    <select
                      value={puntoActivoEnEdicion.sensor_tcs34725?.tipo_preset || 'humus_optimo'}
                      onChange={(e) => {
                        const selKey = e.target.value;
                        const tPreset = PRESETS_TCS34725[selKey] || PRESETS_TCS34725.humus_optimo;
                        actualizarPuntoIndividual(puntoActivoEnEdicion.id, {
                          sensor_tcs34725: {
                            tipo_preset: selKey,
                            nombre: tPreset.nombre,
                            color_hex: tPreset.color_hex,
                            r: tPreset.r,
                            g: tPreset.g,
                            b: tPreset.b,
                            c: tPreset.c,
                            lux: tcsPreset.lux,
                          },
                        });
                      }}
                      className="w-full h-7 px-2 bg-slate-950 border border-slate-700 rounded text-[0.65rem] text-slate-200 outline-none"
                    >
                      {Object.entries(PRESETS_TCS34725).map(([k, val]) => (
                        <option key={k} value={k}>
                          {val.nombre}
                        </option>
                      ))}
                    </select>

                    {/* Valores de canales TCS34725 */}
                    <div className="grid grid-cols-4 gap-1 text-[0.58rem] text-slate-300 text-center">
                      <div className="p-1 rounded bg-slate-950 border border-slate-800">
                        <span className="text-red-400 block font-bold">R</span>
                        {puntoActivoEnEdicion.sensor_tcs34725?.r}
                      </div>
                      <div className="p-1 rounded bg-slate-950 border border-slate-800">
                        <span className="text-green-400 block font-bold">G</span>
                        {puntoActivoEnEdicion.sensor_tcs34725?.g}
                      </div>
                      <div className="p-1 rounded bg-slate-950 border border-slate-800">
                        <span className="text-blue-400 block font-bold">B</span>
                        {puntoActivoEnEdicion.sensor_tcs34725?.b}
                      </div>
                      <div className="p-1 rounded bg-slate-950 border border-slate-800">
                        <span className="text-yellow-400 block font-bold">Lux</span>
                        {puntoActivoEnEdicion.sensor_tcs34725?.lux}
                      </div>
                    </div>
                  </div>

                </div>
              ) : (
                <div className="p-6 text-center text-slate-500 text-xs">
                  No hay puntos de medición creados. Haz clic en el mapa o genera una malla automática.
                </div>
              )}

            </div>
          )}

          {/* ────────────────────────────────────────────────────────── */}
          {/* CONTENIDO PESTAÑA 3: TELEMETRÍA Y MUESTRAS EN VIVO         */}
          {/* ────────────────────────────────────────────────────────── */}
          {activeTabPanel === 'telemetria' && (
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs font-mono custom-scrollbar pt-1">
              
              <div className="space-y-1">
                <span className="text-[0.65rem] uppercase font-bold text-slate-400 flex items-center gap-1.5">
                  <i className="fa-solid fa-terminal text-cyan-400" />
                  Consola LoRa / Mesh en Vivo
                </span>
                <div
                  ref={consoleRef}
                  className="h-40 p-2 rounded-xl bg-black border border-slate-800 text-[0.6rem] text-slate-300 font-mono space-y-1 overflow-y-auto custom-scrollbar"
                >
                  {logs.map((lg, i) => (
                    <div
                      key={i}
                      className={
                        lg.includes('MUESTRA') ? 'text-cyan-300' : lg.includes('COMPLETADA') ? 'text-emerald-400 font-bold' : ''
                      }
                    >
                      {lg}
                    </div>
                  ))}
                </div>
              </div>

              {/* Registro de Muestras Tomadas */}
              <div className="space-y-1.5">
                <span className="text-[0.65rem] uppercase font-bold text-slate-400 block">
                  Muestras Capturadas ({medicionesRealizadas.length}):
                </span>
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                  {medicionesRealizadas.map((m) => (
                    <div key={m.id} className="p-2 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-[0.62rem]">
                      <div>
                        <strong className="text-white">Punto #{m.id}</strong>
                        <span className="text-slate-400 block text-[0.55rem]">{m.rover} &bull; {m.timestamp}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-orange-400 font-bold">{m.temperatura}°C</span>
                        <span className="text-emerald-400 font-bold">pH {m.ph}</span>
                        <span className="text-cyan-400 font-bold">{m.humedad}% H</span>
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-white/40"
                          style={{ backgroundColor: m.tcs?.color_hex || '#3e2723' }}
                          title={`TCS34725: ${m.tcs?.nombre} (Lux: ${m.tcs?.lux})`}
                        />
                      </div>
                    </div>
                  ))}
                  {medicionesRealizadas.length === 0 && (
                    <p className="text-[0.6rem] text-slate-500 text-center py-4">
                      Presiona Play para iniciar la captura de muestras.
                    </p>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* ────────────────────────────────────────────────────────── */}
          {/* CONTENIDO PESTAÑA 4: TRAJE ESPACIAL MARCIANO (ASTROBIOLOGÍA)*/}
          {/* ────────────────────────────────────────────────────────── */}
          {activeTabPanel === 'marte_suit' && (
            <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 text-xs font-mono custom-scrollbar pt-1">
              
              {/* Tarjeta de Título / Contexto Biofísico */}
              <div className="p-3 rounded-xl bg-gradient-to-r from-orange-950/40 via-red-950/20 to-slate-950 border border-orange-500/40 space-y-1 shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-[0.68rem] uppercase font-bold text-orange-400 flex items-center gap-1.5">
                    <i className="fa-solid fa-user-astronaut text-orange-400" />
                    Laboratorio Bioespacial
                  </span>
                  <span className="text-[0.58rem] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30 font-bold">
                    NASA Jezero / 6.1 hPa
                  </span>
                </div>
                <p className="text-[0.62rem] text-slate-300 leading-relaxed text-justify">
                  Control de biocápsula de hidrogel (<strong>Alginato de Sodio + Glicerol + Quitosano</strong>). Simula el ciclo Sol día/noche, la crio-dormancia a subcero y la quelación de regolito.
                </p>
              </div>

              {/* 1. SECCIÓN: CICLO DÍA / NOCHE & FOTOPERIODO MARCIANO */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                  <span className="text-[0.65rem] font-bold text-orange-300 flex items-center gap-1.5">
                    <i className="fa-solid fa-sun text-amber-400" /> Ciclo Térmico &amp; Sol Marciano
                  </span>
                  <div className="flex items-center gap-1 text-[0.6rem]">
                    <span className={`px-2 py-0.5 rounded font-bold ${
                      esNocheMarte ? 'bg-blue-950/80 text-blue-300 border border-blue-500/40' : 'bg-amber-950/80 text-amber-300 border border-amber-500/40'
                    }`}>
                      {esNocheMarte ? '🌙 Noche' : '☀️ Día'}
                    </span>
                    <span className="text-white font-bold">{tempMarteActual > 0 ? `+${tempMarteActual}` : tempMarteActual}°C</span>
                  </div>
                </div>

                {/* Modo de Tiempo: Senoidal 24h vs Manual */}
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-900 rounded-lg border border-slate-800 text-[0.62rem]">
                  <button
                    type="button"
                    onClick={() => setModoTiempoMarte('ciclo_sol')}
                    className={`py-1 rounded font-bold transition-all flex items-center justify-center gap-1 ${
                      modoTiempoMarte === 'ciclo_sol'
                        ? 'bg-orange-500/30 text-orange-300 border border-orange-500/50 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <i className="fa-solid fa-rotate text-xs" />
                    <span>Ciclo 24h Sol</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setModoTiempoMarte('fijo_manual')}
                    className={`py-1 rounded font-bold transition-all flex items-center justify-center gap-1 ${
                      modoTiempoMarte === 'fijo_manual'
                        ? 'bg-orange-500/30 text-orange-300 border border-orange-500/50 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <i className="fa-solid fa-sliders text-xs" />
                    <span>Manual Fijo</span>
                  </button>
                </div>

                {/* Slider de Hora Sol */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[0.65rem]">
                    <span className="text-slate-400 flex items-center gap-1">
                      <i className="fa-regular fa-clock" /> Hora del Sol (24h):
                    </span>
                    <strong className="text-orange-400 font-bold">
                      SOL {String(solHora).padStart(2, '0')}:00
                    </strong>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="23"
                    step="1"
                    value={solHora}
                    onChange={(e) => setSolHora(Number(e.target.value))}
                    className="w-full h-1 bg-slate-800 rounded accent-orange-500 cursor-pointer"
                  />
                </div>

                {/* Botones de Fotoperiodo Rápido */}
                <div className="grid grid-cols-4 gap-1 text-[0.58rem]">
                  <button
                    type="button"
                    onClick={() => { setSolHora(0); setModoTiempoMarte('ciclo_sol'); }}
                    className={`p-1 rounded text-center border transition-all ${
                      solHora === 0 ? 'bg-blue-900/40 text-blue-300 border-blue-400 font-bold' : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                    title="00:00 Noche profunda (-65°C)"
                  >
                    🌙 00h (-65°)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSolHora(6); setModoTiempoMarte('ciclo_sol'); }}
                    className={`p-1 rounded text-center border transition-all ${
                      solHora === 6 ? 'bg-amber-900/40 text-amber-300 border-amber-400 font-bold' : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                    title="06:00 Amanecer (-25°C)"
                  >
                    🌅 06h (-25°)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSolHora(12); setModoTiempoMarte('ciclo_sol'); }}
                    className={`p-1 rounded text-center border transition-all ${
                      solHora === 12 ? 'bg-amber-500/30 text-amber-300 border-amber-400 font-bold' : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                    title="12:00 Mediodía solar (+15°C)"
                  >
                    ☀️ 12h (+15°)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSolHora(18); setModoTiempoMarte('ciclo_sol'); }}
                    className={`p-1 rounded text-center border transition-all ${
                      solHora === 18 ? 'bg-orange-900/40 text-orange-300 border-orange-400 font-bold' : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                    title="18:00 Atardecer (-25°C)"
                  >
                    🌇 18h (-25°)
                  </button>
                </div>

                {/* Botón Simular Avance del Sol en Tiempo Real */}
                <button
                  type="button"
                  onClick={() => setSimulandoCicloSol(!simulandoCicloSol)}
                  className={`w-full py-1.5 rounded-lg text-[0.62rem] font-bold flex items-center justify-center gap-1.5 transition-all border ${
                    simulandoCicloSol
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm animate-pulse'
                      : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  <i className={`fa-solid ${simulandoCicloSol ? 'fa-pause' : 'fa-play text-orange-400'}`} />
                  <span>{simulandoCicloSol ? 'Pausar Avance de Sol' : 'Simular Avance de Sol (1s / h)'}</span>
                </button>

                {/* En modo manual: Slider de Temperatura Manual */}
                {modoTiempoMarte === 'fijo_manual' && (
                  <div className="space-y-1 pt-1 border-t border-slate-800/80">
                    <div className="flex justify-between text-[0.65rem]">
                      <span className="text-slate-400 flex items-center gap-1">
                        <i className="fa-solid fa-temperature-half text-orange-400" /> Temperatura Manual:
                      </span>
                      <strong className="text-white font-bold">{tempManualMarte > 0 ? `+${tempManualMarte}` : tempManualMarte}°C</strong>
                    </div>
                    <input
                      type="range"
                      min="-90"
                      max="25"
                      step="1"
                      value={tempManualMarte}
                      onChange={(e) => setTempManualMarte(Number(e.target.value))}
                      className="w-full h-1 bg-slate-800 rounded accent-orange-400 cursor-pointer"
                    />
                  </div>
                )}

                {/* Alerta de Crio-Dormancia vs Ventana Activa */}
                <div className={`p-2 rounded-xl text-[0.6rem] border leading-relaxed flex items-start gap-2 ${
                  enCrioDormancia
                    ? 'bg-blue-950/30 border-blue-500/40 text-blue-200'
                    : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                }`}>
                  <span className="text-sm shrink-0">{enCrioDormancia ? '❄️' : '🌱'}</span>
                  <div>
                    <strong className="block font-bold">
                      {enCrioDormancia ? 'Crio-Dormancia por Glicerol Activa (T < -8°C)' : 'Ventana Metabólica Activa (T ≥ -8°C)'}
                    </strong>
                    <span className="text-[0.56rem] text-slate-300 block">
                      {enCrioDormancia
                        ? 'Puntas hifales entran en Estado 5 (Azul Hielo). Glicerol previene cristales de hielo intracelulares y el consumo de hidrogel se pausa.'
                        : 'El micelio diurno (Estado 2) elonga activamente absorbiendo humedad del hidrogel y secretando sideróforos.'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. SECCIÓN: BIOCÁPSULA & HIDROGEL (TRAJE ESPACIAL) */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                <span className="text-[0.65rem] font-bold text-cyan-400 flex items-center gap-1.5 border-b border-slate-800/80 pb-1.5">
                  <i className="fa-solid fa-shield-halved text-cyan-400" /> Traje Espacial: Biocápsula &amp; Hidrogel
                </span>

                {/* Vigor / Inóculo UFC/g */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[0.65rem]">
                    <span className="text-emerald-400 flex items-center gap-1">
                      <i className="fa-solid fa-microscope text-xs" /> Concentración Inóculo:
                    </span>
                    <strong className="text-white">
                      {Math.round(cfuConcentration * 1000000).toLocaleString()} UFC/g ({(cfuConcentration * 100).toFixed(0)}%)
                    </strong>
                  </div>
                  <input
                    type="range"
                    min="0.10"
                    max="1.00"
                    step="0.05"
                    value={cfuConcentration}
                    onChange={(e) => setCfuConcentration(Number(e.target.value))}
                    className="w-full h-1 bg-slate-800 rounded accent-emerald-400 cursor-pointer"
                  />
                  <span className="text-[0.55rem] text-slate-400 block">
                    Determina la densidad apical y el radio del microfoco de inyección.
                  </span>
                </div>

                {/* Amortiguamiento Hidrogel Alginato */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[0.65rem]">
                    <span className="text-cyan-400 flex items-center gap-1">
                      <i className="fa-solid fa-droplet text-xs" /> Alginato de Sodio (Buffer Hídrico):
                    </span>
                    <strong className="text-white">{alginatoCapacidad} h</strong>
                  </div>
                  <input
                    type="range"
                    min="40"
                    max="240"
                    step="10"
                    value={alginatoCapacidad}
                    onChange={(e) => setAlginatoCapacidad(Number(e.target.value))}
                    className="w-full h-1 bg-slate-800 rounded accent-cyan-400 cursor-pointer"
                  />
                  <span className="text-[0.55rem] text-slate-400 block">
                    Reserva frente a la difusión de Fick y evaporación subatmosférica a 6.1 hPa.
                  </span>
                </div>

                {/* Escudo Quitosano & UV */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[0.65rem]">
                    <span className="text-purple-400 flex items-center gap-1">
                      <i className="fa-solid fa-atom text-xs" /> Escudo Quitosano (Antioxidante/UV):
                    </span>
                    <strong className="text-white">{(chitosanShield * 100).toFixed(0)}%</strong>
                  </div>
                  <input
                    type="range"
                    min="0.10"
                    max="1.00"
                    step="0.05"
                    value={chitosanShield}
                    onChange={(e) => setChitosanShield(Number(e.target.value))}
                    className="w-full h-1 bg-slate-800 rounded accent-purple-400 cursor-pointer"
                  />
                  <span className="text-[0.55rem] text-slate-400 block">
                    Protege las membranas contra radicales libres de percloratos y fotólisis UV.
                  </span>
                </div>
              </div>

              {/* 3. SECCIÓN: GEOQUÍMICA DEL REGOLITO */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                <span className="text-[0.65rem] font-bold text-amber-400 flex items-center gap-1.5 border-b border-slate-800/80 pb-1.5">
                  <i className="fa-solid fa-volcano text-amber-400" /> Geoquímica del Regolito
                </span>

                {/* Factor de Percloratos */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[0.65rem]">
                    <span className="text-red-400 flex items-center gap-1">
                      <i className="fa-solid fa-triangle-exclamation text-xs" /> Percloratos (ClO4-):
                    </span>
                    <strong className="text-white">{percloratosFactor.toFixed(1)}x</strong>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="3.0"
                    step="0.1"
                    value={percloratosFactor}
                    onChange={(e) => setPercloratosFactor(Number(e.target.value))}
                    className="w-full h-1 bg-slate-800 rounded accent-red-400 cursor-pointer"
                  />
                </div>

                {/* Factor de Óxidos de Hierro */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[0.65rem]">
                    <span className="text-amber-500 flex items-center gap-1">
                      <i className="fa-solid fa-gem text-xs" /> Óxidos de Hierro (Fe2O3):
                    </span>
                    <strong className="text-white">{oxidosHierroFactor.toFixed(1)}x</strong>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="2.5"
                    step="0.1"
                    value={oxidosHierroFactor}
                    onChange={(e) => setOxidosHierroFactor(Number(e.target.value))}
                    className="w-full h-1 bg-slate-800 rounded accent-amber-500 cursor-pointer"
                  />
                  <span className="text-[0.55rem] text-slate-400 block">
                    Mineral diana que los hongos reducen a Fe2+ biodisponible mediante sideróforos.
                  </span>
                </div>

                {/* Número de Semillas / Inyecciones */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[0.65rem]">
                    <span className="text-slate-400">Microfocos de Inyección:</span>
                    <strong className="text-cyan-400">{numInyecciones} cápsulas</strong>
                  </div>
                  <div className="grid grid-cols-4 gap-1 text-[0.6rem]">
                    {[1, 2, 3, 4].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setNumInyecciones(n)}
                        className={`py-1 rounded font-bold border transition-all ${
                          numInyecciones === n
                            ? 'bg-cyan-500/30 text-cyan-300 border-cyan-400'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Botón de Ejecución del Laboratorio de Marte */}
              <button
                type="button"
                onClick={handleSimularTrajeMarte}
                disabled={fase2Loading}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-500/20 active:scale-95 disabled:opacity-50"
              >
                {fase2Loading ? (
                  <i className="fa-solid fa-spinner animate-spin" />
                ) : (
                  <i className="fa-solid fa-flask-vial" />
                )}
                <span>Simular Traje Espacial en Marte</span>
              </button>

            </div>
          )}

        </div>

      </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* 3. SECCIÓN INFERIOR: FASE 2 INYECCIÓN BIOLÓGICA            */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-amber-950/20 border border-amber-500/40 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-lg">
        <div className="space-y-0.5 max-w-4xl">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded text-[0.65rem] font-bold font-mono bg-amber-500/20 text-amber-400 border border-amber-500/40">
              <i className="fa-solid fa-flask-vial mr-1" /> FASE 2: MATRIZ DE IDONEIDAD &amp; INOCULACIÓN
            </span>
            <h3 className="text-xs sm:text-sm font-bold font-mono text-white">
              Inyección de Biocápsulas &amp; Inoculación Micelial (Autómata Celular Fúngico)
            </h3>
          </div>
          <p className="text-[0.68rem] text-slate-400 leading-relaxed text-justify">
            {planeta === 'marte' ? (
              <>
                Entorno marciano activo (<span className="text-orange-400 font-bold">6.1 hPa &bull; MOLA Jezero/Gale</span>): La inoculación implementa el <strong className="text-orange-300">Traje Espacial Micelial</strong> con biocápsula de hidrogel (Alginato + Glicerol crioprotector + Quitosano). Modela la difusión de Fick, crio-dormancia nocturna por debajo de -8°C, neutralización de percloratos y quelación por sideróforos.
              </>
            ) : (
              <>
                A partir de las lecturas sensoriales (Humedad trapezoidal 30-70%, Materia Orgánica TCS34725 y Compactación inversa), el motor calcula <code className="text-emerald-400 font-mono">I_suelo = 0.35 MO + 0.40 H + 0.25 C &times; F_T &times; F_pH</code> y selecciona los microfocos óptimos para inyectar biocápsulas calibradas en <strong>UFC/g</strong>.
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right hidden sm:block font-mono text-xs">
            <span className="text-[0.6rem] text-slate-400 block">Progreso de Redada</span>
            <strong className="text-cyan-400">{pctCompletado}% / 100%</strong>
          </div>

          <button
            type="button"
            onClick={() => handleEjecutarFase2()}
            disabled={fase2Loading}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 font-mono font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/20 hover:scale-105 active:scale-95 disabled:opacity-50"
          >
            {fase2Loading ? (
              <i className="fa-solid fa-spinner animate-spin" />
            ) : (
              <i className="fa-solid fa-bolt" />
            )}
            <span>{faseActiva === 'fase2' ? 'Recalcular Matriz de Idoneidad' : (fase2Data ? 'Ver Matriz de Fase 2' : 'Iniciar Fase 2 (Matriz)')}</span>
          </button>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* MODAL: POSICIONAR ROVER ESPECÍFICO EN COORDENADAS DEL MAPA */}
      {/* ────────────────────────────────────────────────────────── */}
      {modalPosicionarRover && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#0b1322] border border-amber-500/40 rounded-2xl p-5 shadow-2xl space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <strong className="text-white flex items-center gap-1.5">
                <i className="fa-solid fa-robot text-amber-400" />
                Selecciona Rover para Posicionar
              </strong>
              <button
                type="button"
                onClick={() => setModalPosicionarRover(false)}
                className="w-6 h-6 rounded bg-slate-800 text-slate-400 hover:text-white"
              >
                &times;
              </button>
            </div>

            <p className="text-[0.68rem] text-slate-400">
              Elige el Rover y luego haz clic en el mapa para fijar su punto de despliegue inicial:
            </p>

            <div className="space-y-1.5">
              {robotsDisponibles.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setRoverParaPosicionar(r);
                    setModoInteractivo('position_rover');
                    setModalPosicionarRover(false);
                    addLog(`[MODO ROVER] Haz clic en el mapa para ubicar a ${r.nombre}.`);
                  }}
                  className="w-full p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-400 text-left flex items-center justify-between transition-all"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: r.color }} />
                    <span className="font-bold text-white">{r.nombre}</span>
                  </div>
                  <span className="text-[0.6rem] text-slate-400">{r.modelo}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* MODAL FASE 2 INYECCIÓN PENDIENTE                          */}
      {/* ────────────────────────────────────────────────────────── */}
      {modalFase2Abierto && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0b1322] border border-amber-500/40 rounded-3xl p-5 shadow-2xl space-y-3.5 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <i className="fa-solid fa-lock text-sm" />
                </div>
                <h4 className="text-sm font-bold text-white">Fase 2 de Inyección Biológica</h4>
              </div>
              <button
                type="button"
                onClick={() => setModalFase2Abierto(false)}
                className="w-6 h-6 rounded bg-slate-800 text-slate-400 hover:text-white"
              >
                &times;
              </button>
            </div>

            <p className="text-slate-300 leading-relaxed text-justify text-[0.7rem]">
              Esta fase permanece bloqueada hasta que la flota complete el 100% de la redada de muestreo. Los datos que calibraste (pH, temperatura, humedad y reflectancia TCS34725) se transferirán al autómata celular:
            </p>

            <div className="space-y-1.5 p-2.5 bg-slate-900 rounded-xl border border-slate-800 text-[0.68rem]">
              <div className="flex justify-between">
                <span className="text-slate-400">Concentración de Inóculo:</span>
                <strong className="text-emerald-400">50,000 UFC/g (Vigor 50%)</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Radio de Inoculación Inicial:</span>
                <strong className="text-white">R=1 (~5 celdas circulares)</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Puntos de Inyección Previstos:</span>
                <strong className="text-cyan-400">1 a 3 microfocos óptimos</strong>
              </div>
            </div>

            <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[0.65rem] text-amber-300">
              <i className="fa-solid fa-circle-info mr-1" />
              Completa la simulación presionando el botón <strong className="text-white">Play</strong> para finalizar la toma de muestras.
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setModalFase2Abierto(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
