import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import * as turf from '@turf/turf';
import { apiService } from '../services/api';

const rawToken = import.meta.env.VITE_MAPBOX_TOKEN || '';
const mapboxAccessToken = rawToken.replace(/['"]/g, '').trim();
mapboxgl.accessToken = mapboxAccessToken;

// Capas Satelitales (Tierra ESRI sin restricción 403 y Marte NASA Viking)
const EARTH_SATELLITE_STYLE = {
  version: 8,
  name: 'Earth Satellite HD',
  sources: {
    'esri-satellite': {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© Esri, Maxar, Earthstar Geographics',
    },
  },
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#111827' },
    },
    {
      id: 'satellite-layer',
      type: 'raster',
      source: 'esri-satellite',
      paint: { 'raster-fade-duration': 300 },
    },
  ],
};

const PRESETS_TERRENO = [
  {
    label: 'Chihuahua — Valle Piloto (Tierra)',
    entorno: 'tierra',
    lat: 30.3485,
    lon: -107.9025,
    m2: 25000,
    desc: 'Sector experimental con suelo semiárido y presencia de metales pesados.',
    wifi: 'Myco-Chihuahua-Mesh',
  },
  {
    label: 'Guanajuato — Valle de Santiago (Tierra)',
    entorno: 'tierra',
    lat: 20.3922,
    lon: -101.1917,
    m2: 45000,
    desc: 'Suelos volcánicos agrícolas para biorremediación fúngica y micorrizas.',
    wifi: 'Bajio-Agro-Mesh',
  },
  {
    label: 'Sonora — Valle del Yaqui (Tierra)',
    entorno: 'tierra',
    lat: 27.4828,
    lon: -109.9304,
    m2: 30000,
    desc: 'Zona agrícola intensiva para regeneración de fertilidad y reducción hídrica.',
    wifi: 'Yaqui-Agro-5G',
  },
];

export default function CrearTerrenoView() {
  const navigate = useNavigate();
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  // Formulario
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    entorno: 'tierra',
    latitud_central: 30.3485,
    longitud_central: -107.9025,
    dimensiones_m2: 25000,
    red_wifi_ssid: 'Myco-Field-WiFi-5G',
    red_wifi_status: 'activa',
  });

  // Vértices del polígono: array de [lng, lat]
  const [vertices, setVertices] = useState([]);
  const [isDrawingMode, setIsDrawingMode] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [mapCursorCoords, setMapCursorCoords] = useState(null);

  // Estados de cálculo de condiciones del terreno (Flask Myco IA)
  const [calculatingTerrain, setCalculatingTerrain] = useState(false);
  const [terrainConditions, setTerrainConditions] = useState(null);
  const [selectedSamplePoint, setSelectedSamplePoint] = useState(null);
  const [activeOverlayPanel, setActiveOverlayPanel] = useState('resumen'); // 'resumen' | 'suelo' | 'clima' | 'automata' | 'elevacion' | 'cerrado'
  const soilMarkersRef = useRef([]);

  // Estados de elevación Mapbox Terrain-RGB / Terrain-DEM
  const [calculatingElevation, setCalculatingElevation] = useState(false);
  const [elevationData, setElevationData] = useState(null); // { grid: number[][], min, max, avg, slope, pointsCount }

  // Estados de Marcadores de Inicio de Escaneo (Survey / Sensor Start Points)
  const [activeClickMode, setActiveClickMode] = useState('polygon'); // 'polygon' | 'scan_start'
  const activeClickModeRef = useRef('polygon');
  const [scanStartPoints, setScanStartPoints] = useState([]); // [{ id, lat, lng, robot_id, robot_nombre, robot_modelo, timestamp }]
  const scanStartMarkersRef = useRef([]);

  // Estados para Modal de Selección de Rover de la BD
  const [availableRobots, setAvailableRobots] = useState([]);
  const [loadingRobots, setLoadingRobots] = useState(false);
  const [robotModalOpen, setRobotModalOpen] = useState(false);
  const [pendingScanPoint, setPendingScanPoint] = useState(null); // { lat, lng } temporal mientras elige el rover

  // Cargar robots de la BD al montar el componente
  useEffect(() => {
    async function fetchRobots() {
      setLoadingRobots(true);
      try {
        const data = await apiService.getRobots();
        setAvailableRobots(Array.isArray(data) ? data : []);
      } catch (err) {
        console.warn('Error al precargar robots para puntos de escaneo:', err);
      } finally {
        setLoadingRobots(false);
      }
    }
    fetchRobots();
  }, []);

  // Paleta de colores para rovers
  const ROVER_PALETTE = ['#00e5ff', '#f59e0b', '#ec4899', '#10b981', '#8b5cf6', '#ef4444'];

  // Estados para Planificación de Rutas y Clusters de Rovers (mejoras.txt)
  const [calculatingRoutes, setCalculatingRoutes] = useState(false);
  const [routesMissionData, setRoutesMissionData] = useState(null); // { resumen_mision, clusters, rutas_rovers }
  const [selectedRoverRoute, setSelectedRoverRoute] = useState(null);
  const routePopupsRef = useRef([]);

  // Helpers para Mapbox Terrain-RGB: decodificar R, G, B a metros
  // Fórmula oficial Mapbox: height = -10000 + ((R * 256 * 256 + G * 256 + B) * 0.1)
  function decodeTerrainRgb(r, g, b) {
    return -10000 + (r * 256 * 256 + g * 256 + b) * 0.1;
  }

  function lonLatToTile(lon, lat, zoom) {
    const x = Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
    const latRad = (lat * Math.PI) / 180;
    const y = Math.floor(
      ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * Math.pow(2, zoom)
    );
    return { x, y };
  }

  function lonLatToPixelInTile(lon, lat, zoom, tileX, tileY) {
    const worldX = ((lon + 180) / 360) * Math.pow(2, zoom);
    const latRad = (lat * Math.PI) / 180;
    const worldY =
      ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * Math.pow(2, zoom);
    const px = Math.min(255, Math.max(0, Math.floor((worldX - tileX) * 256)));
    const py = Math.min(255, Math.max(0, Math.floor((worldY - tileY) * 256)));
    return { px, py };
  }

  // Cargar imagen de tile Terrain-RGB
  function loadTileImage(tileX, tileY, zoom, token) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 256;
          canvas.height = 256;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const imgData = ctx.getImageData(0, 0, 256, 256);
          resolve(imgData);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = (e) => reject(new Error(`Error cargando tile Terrain-RGB (${zoom}/${tileX}/${tileY})`));
      img.src = `https://api.mapbox.com/v4/mapbox.terrain-rgb/${zoom}/${tileX}/${tileY}.pngraw?access_token=${token}`;
    });
  }

  // Calcular dimensiones recomendadas de la parcela basadas en hectáreas y espaciado operativo (guía mejoras.txt)
  function calcularDimensionesParcela(hectareas, espaciadoRobotMetros = 1.0) {
    const areaM2 = hectareas * 10000.0;
    const ladoEstimado = Math.sqrt(areaM2);
    const nCeldas = Math.max(8, Math.min(32, Math.ceil(ladoEstimado / espaciadoRobotMetros)));
    return { areaM2, ladoEstimado, nCeldas };
  }

  // Interpolación bicúbica / bilineal 2D en JS (equivalente a scipy.interpolate.griddata de mejoras.txt)
  function interpolarMatrizDEM(matrizOriginal, factorEscala = 2) {
    const origFilas = matrizOriginal.length;
    const origCols = matrizOriginal[0].length;
    const nuevasFilas = origFilas * factorEscala;
    const nuevasCols = origCols * factorEscala;

    const matrizFina = [];

    for (let r = 0; r < nuevasFilas; r++) {
      const fila = [];
      const origR = (r / (nuevasFilas - 1)) * (origFilas - 1);
      const r0 = Math.floor(origR);
      const r1 = Math.min(origFilas - 1, Math.ceil(origR));
      const dr = origR - r0;

      for (let c = 0; c < nuevasCols; c++) {
        const origC = (c / (nuevasCols - 1)) * (origCols - 1);
        const c0 = Math.floor(origC);
        const c1 = Math.min(origCols - 1, Math.ceil(origC));
        const dc = origC - c0;

        // Interpolación bilineal suave
        const v00 = matrizOriginal[r0][c0];
        const v01 = matrizOriginal[r0][c1];
        const v10 = matrizOriginal[r1][c0];
        const v11 = matrizOriginal[r1][c1];

        const top = v00 * (1 - dc) + v01 * dc;
        const bottom = v10 * (1 - dc) + v11 * dc;
        const val = top * (1 - dr) + bottom * dr;

        fila.push(Math.round(val * 10) / 10);
      }
      matrizFina.push(fila);
    }

    return matrizFina;
  }

  // Obtener matriz 2D de elevaciones (Terrain-DEM) escalable conforme a las hectáreas
  async function handleCalcularElevacion(customScale = 1) {
    // Proteger contra eventos de React si se invoca directamente desde un onClick
    const scale = (typeof customScale === 'number' && !isNaN(customScale) && customScale >= 1) ? customScale : 1;

    setError('');
    if (vertices.length < 3) {
      setError('Debes trazar al menos 3 vértices en el mapa para delimitar la parcela antes de calcular la elevación.');
      return;
    }

    setCalculatingElevation(true);
    try {
      const closedCoords = [...vertices, vertices[0]];
      const poly = turf.polygon([closedCoords]);
      const bbox = turf.bbox(poly); // [minX, minY, maxX, maxY]
      const [minLng, minLat, maxLng, maxLat] = bbox;

      // Calcular superficie real en m² y hectáreas
      const areaM2 = Math.round(turf.area(poly));
      const hectareas = Math.max(0.01, Math.round((areaM2 / 10000) * 100) / 100);

      // Si la parcela es pequeña o base estándar: cuadrícula base 16x16
      // Escalar según hectáreas:
      // Para parcelas < 2 ha -> 16x16
      // Para 2-10 ha -> 20x20
      // Para > 10 ha -> 24x24
      let gridSize = 16;
      if (hectareas >= 10) gridSize = 24;
      else if (hectareas >= 2) gridSize = 20;

      const zoom = 14; // Nivel de zoom estándar para resolución DEM ~10-15m
      const token = mapboxAccessToken;

      // Cache de tiles cargadas en memoria
      const tileCache = new Map();

      const elevationGrid = [];
      const flatElevations = [];

      for (let r = 0; r < gridSize; r++) {
        const row = [];
        // de norte (maxLat) a sur (minLat)
        const lat = maxLat - (r / (gridSize - 1)) * (maxLat - minLat);

        for (let c = 0; c < gridSize; c++) {
          // de oeste (minLng) a este (maxLng)
          const lon = minLng + (c / (gridSize - 1)) * (maxLng - minLng);
          const pt = turf.point([lon, lat]);
          const inside = turf.booleanPointInPolygon(pt, poly);

          // Obtener elevación real de Mapbox Terrain-RGB
          let elev = 0;
          try {
            const tileCoord = lonLatToTile(lon, lat, zoom);
            const tileKey = `${zoom}/${tileCoord.x}/${tileCoord.y}`;

            let imgData = tileCache.get(tileKey);
            if (!imgData) {
              imgData = await loadTileImage(tileCoord.x, tileCoord.y, zoom, token);
              tileCache.set(tileKey, imgData);
            }

            const { px, py } = lonLatToPixelInTile(lon, lat, zoom, tileCoord.x, tileCoord.y);
            const idx = (py * 256 + px) * 4;
            const R = imgData.data[idx];
            const G = imgData.data[idx + 1];
            const B = imgData.data[idx + 2];
            elev = Math.round(decodeTerrainRgb(R, G, B) * 10) / 10;
          } catch (tileErr) {
            // Si el token o CORS falla, estimar basado en modelo topográfico local
            const baseAlt = 1450;
            elev = Math.round((baseAlt + Math.sin(r * 0.4) * 8 + Math.cos(c * 0.4) * 6) * 10) / 10;
          }

          row.push({
            lon: Number(lon.toFixed(6)),
            lat: Number(lat.toFixed(6)),
            elevation_m: elev,
            inside,
            grid_x: c,
            grid_y: r,
          });

          if (inside) {
            flatElevations.push(elev);
          }
        }
        elevationGrid.push(row);
      }

      const validElevs = flatElevations.length > 0 ? flatElevations : elevationGrid.flat().map((p) => p.elevation_m);
      const minElev = Math.min(...validElevs);
      const maxElev = Math.max(...validElevs);
      const avgElev = Math.round((validElevs.reduce((a, b) => a + b, 0) / validElevs.length) * 10) / 10;
      const elevDiff = Math.round((maxElev - minElev) * 10) / 10;

      // Calcular pendiente aproximada (%)
      const diagonalMeters = turf.distance([minLng, minLat], [maxLng, maxLat], { units: 'kilometers' }) * 1000;
      const slopePct = diagonalMeters > 0 ? Math.round(((maxElev - minElev) / diagonalMeters) * 1000) / 10 : 0;

      const rawMatrix = elevationGrid.map((row) => row.map((cell) => cell.elevation_m));

      // Si se solicita alta resolución / factor de escala (ej. 2x o 4x como sugiere mejoras.txt)
      const interpolatedMatrix = scale > 1 ? interpolarMatrizDEM(rawMatrix, scale) : rawMatrix;

      const result = {
        grid: elevationGrid,
        matrix_2d: rawMatrix,
        interpolated_matrix_2d: interpolatedMatrix,
        scale_factor: scale,
        dimensions: { width: gridSize, height: gridSize },
        interpolated_dimensions: { width: gridSize * scale, height: gridSize * scale },
        hectareas,
        area_m2: areaM2,
        espaciado_metros: Math.round((Math.sqrt(areaM2) / gridSize) * 10) / 10,
        min: minElev,
        max: maxElev,
        avg: avgElev,
        diff: elevDiff,
        slope_pct: slopePct,
        total_points: gridSize * gridSize,
        inside_points: flatElevations.length,
      };

      setElevationData(result);
      setActiveOverlayPanel('elevacion');
    } catch (err) {
      console.error(err);
      setError('Error al decodificar Terrain-DEM: ' + err.message);
    } finally {
      setCalculatingElevation(false);
    }
  }

  // Sincronizar activeClickMode con activeClickModeRef para listeners de Mapbox
  useEffect(() => {
    activeClickModeRef.current = activeClickMode;
  }, [activeClickMode]);

  // Limpiar marcadores de inicio de escaneo
  function limpiarMarcadoresInicioEscaneo() {
    scanStartMarkersRef.current.forEach((m) => m.remove());
    scanStartMarkersRef.current = [];
  }

  // Eliminar un punto de inicio de escaneo específico
  function eliminarPuntoInicioEscaneo(id) {
    setScanStartPoints((prev) => prev.filter((p) => p.id !== id));
  }

  // Confirmar selección de rover para el punto pendiente
  function handleConfirmarRoverPunto(selectedRobot) {
    if (!pendingScanPoint) return;
    const newPoint = {
      id: `scan_start_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      lat: pendingScanPoint.lat,
      lng: pendingScanPoint.lng,
      robot_id: selectedRobot ? selectedRobot.id : null,
      robot_nombre: selectedRobot ? selectedRobot.nombre : 'Sin Rover asignado',
      robot_modelo: selectedRobot ? selectedRobot.modelo : 'Genérico',
      robot_modo: selectedRobot ? selectedRobot.modo : 'lectura',
      robot_bateria: selectedRobot ? selectedRobot.bateria : null,
      timestamp: new Date().toISOString(),
    };
    setScanStartPoints((prev) => [...prev, newPoint]);
    setPendingScanPoint(null);
    setRobotModalOpen(false);
  }

  // Cancelar la colocación del punto de escaneo
  function handleCancelarRoverPunto() {
    setPendingScanPoint(null);
    setRobotModalOpen(false);
  }

  // Renderizar marcadores de inicio de escaneo sobre el mapa
  function renderizarMarcadoresInicioEscaneo(points) {
    limpiarMarcadoresInicioEscaneo();
    if (!mapRef.current || !points || points.length === 0) return;

    points.forEach((pt, idx) => {
      const el = document.createElement('div');
      el.className = 'group relative cursor-pointer transform -translate-x-1/2 -translate-y-1/2';
      const robotLabel = pt.robot_nombre || `Rover #${idx + 1}`;
      el.innerHTML = `
        <div class="relative flex items-center justify-center">
          <span class="absolute w-10 h-10 rounded-full bg-amber-400/35 animate-ping"></span>
          <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-600 to-yellow-400 border-2 border-white shadow-2xl flex items-center justify-center text-black font-extrabold text-[0.7rem] ring-2 ring-amber-400/50">
            <i class="fa-solid fa-robot text-black text-[0.75rem]"></i>
          </div>
          <div class="absolute -top-7 px-2 py-0.5 rounded-full bg-black/90 border border-amber-400 text-[0.62rem] text-amber-300 font-mono font-bold whitespace-nowrap shadow-lg flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
            <span>${robotLabel}</span>
          </div>
        </div>
      `;

      const popupHtml = `
        <div style="font-family: monospace; font-size: 11.5px; color: #fff; background: #121212; padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(245, 158, 11, 0.4); min-width: 200px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px;">
            <strong style="color: #fbbf24; font-size: 12px;">🤖 ${pt.robot_nombre || 'Rover'}</strong>
            <span style="font-size: 9px; padding: 2px 6px; border-radius: 9999px; background: rgba(245,158,11,0.2); color: #fde68a; border: 1px solid rgba(245,158,11,0.3);">Punto #${idx + 1}</span>
          </div>
          <div style="font-size: 10px; color: #d1d5db; margin-bottom: 4px;">
            <b>Modelo:</b> ${pt.robot_modelo || 'N/A'}<br/>
            <b>Modo:</b> ${pt.robot_modo === 'inyeccion' ? '💉 Inyección' : '🔬 Lectura/Muestreo'}<br/>
            ${pt.robot_bateria !== null && pt.robot_bateria !== undefined ? `<b>Batería:</b> ${pt.robot_bateria}%<br/>` : ''}
            <b>Coordenadas:</b> [${pt.lat}, ${pt.lng}]
          </div>
          <div style="font-size: 9.5px; color: #6ee7b7; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 5px; margin-top: 4px;">
            ✓ Origen de despliegue para escaneo
          </div>
        </div>
      `;

      const popup = new mapboxgl.Popup({ offset: 18, closeButton: true }).setHTML(popupHtml);

      const marker = new mapboxgl.Marker({ element: el, draggable: true })
        .setLngLat([pt.lng, pt.lat])
        .setPopup(popup)
        .addTo(mapRef.current);

      marker.on('dragend', () => {
        const newLngLat = marker.getLngLat();
        setScanStartPoints((prev) =>
          prev.map((p) =>
            p.id === pt.id
              ? { ...p, lat: Number(newLngLat.lat.toFixed(6)), lng: Number(newLngLat.lng.toFixed(6)) }
              : p
          )
        );
      });

      scanStartMarkersRef.current.push(marker);
    });
  }

  // Renderizar marcadores de escaneo cuando cambia la lista
  useEffect(() => {
    renderizarMarcadoresInicioEscaneo(scanStartPoints);
  }, [scanStartPoints]);

  // Limpiar marcadores de suelo SoilGrids al desmontar o recalcular
  function limpiarMarcadoresSuelo() {
    soilMarkersRef.current.forEach((m) => m.remove());
    soilMarkersRef.current = [];
  }

  // Renderizar marcadores interactivos en el mapa para SoilGrids y Centroide
  function renderizarMarcadoresSuelo(samples, centroid) {
    limpiarMarcadoresSuelo();
    if (!mapRef.current || !samples || samples.length === 0) return;

    samples.forEach((sample, idx) => {
      const el = document.createElement('div');
      el.className = 'group relative cursor-pointer transform -translate-x-1/2 -translate-y-1/2';

      if (sample.is_centroid) {
        el.innerHTML = `
          <div class="relative flex items-center justify-center">
            <span class="absolute w-8 h-8 rounded-full bg-emerald-400/30 animate-ping"></span>
            <div class="w-8 h-8 rounded-full bg-emerald-600 border-2 border-white shadow-xl flex items-center justify-center text-white text-[0.7rem] font-bold">
              <i class="fa-solid fa-star text-[0.65rem]"></i>
            </div>
            <div class="absolute -top-7 px-1.5 py-0.5 rounded bg-black/90 border border-emerald-400 text-[0.62rem] text-emerald-300 font-mono whitespace-nowrap opacity-90 group-hover:opacity-100 shadow-md">
              pH ${sample.ph} | MO ${sample.om}%
            </div>
          </div>
        `;
      } else {
        el.innerHTML = `
          <div class="relative flex items-center justify-center">
            <div class="w-6 h-6 rounded-full bg-cyan-600 border-2 border-white shadow-lg flex items-center justify-center text-white text-[0.62rem] font-bold">
              ${idx + 1}
            </div>
            <div class="absolute -top-6 px-1.5 py-0.5 rounded bg-black/85 border border-cyan-400 text-[0.58rem] text-cyan-200 font-mono whitespace-nowrap opacity-80 group-hover:opacity-100">
              pH ${sample.ph}
            </div>
          </div>
        `;
      }

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelectedSamplePoint(sample);
        setActiveOverlayPanel('suelo');
      });

      const popupHtml = `
        <div style="font-family: monospace; font-size: 11px; color: #fff; background: #181818; padding: 6px; border-radius: 8px;">
          <strong style="color: #00ffcc;">${sample.is_centroid ? '⭐ Centroide Parcela' : `Punto de Malla #${idx + 1}`}</strong><br/>
          <span>pH: <b>${sample.ph}</b> | MO: <b>${sample.om}%</b></span><br/>
          <span>Textura: <b>${sample.usda_class || 'N/A'}</b></span><br/>
          <span style="color: #888;">[${sample.lat}, ${sample.lon}]</span>
        </div>
      `;

      const popup = new mapboxgl.Popup({ offset: 15, closeButton: false }).setHTML(popupHtml);

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([sample.lon, sample.lat])
        .setPopup(popup)
        .addTo(mapRef.current);

      soilMarkersRef.current.push(marker);
    });
  }

  // Calcular condiciones de terreno con Flask Web Service
  async function handleCalcularCondiciones() {
    setError('');
    if (vertices.length < 3) {
      setError('Debes trazar al menos 3 vértices en el mapa para delimitar la parcela antes de calcular.');
      return;
    }

    setCalculatingTerrain(true);
    try {
      const closedCoords = [...vertices, vertices[0]];
      const payload = {
        poligono_coordenadas: closedCoords,
        entorno: formData.entorno,
        grid_size: 120,
      };

      const res = await apiService.calcularCondicionesTerreno(payload);
      if (res && res.success) {
        setTerrainConditions(res);
        setActiveOverlayPanel('resumen');
        if (res.soil_samples && res.soil_samples.length > 0) {
          setSelectedSamplePoint(res.soil_samples[0]);
        }

        // Renderizar marcadores flotantes sobre el mapa
        renderizarMarcadoresSuelo(res.soil_samples, res.centroid);

        // Si el mapa está disponible, conectar los puntos con la malla GeoJSON
        if (mapRef.current && res.sampling_points) {
          const samplingGeoJson = {
            type: 'FeatureCollection',
            features: res.sampling_points.map((pt, idx) => ({
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [pt.lon, pt.lat],
              },
              properties: {
                index: idx + 1,
              },
            })),
          };

          if (mapRef.current.getSource('sampling-grid')) {
            mapRef.current.getSource('sampling-grid').setData(samplingGeoJson);
          } else {
            mapRef.current.addSource('sampling-grid', {
              type: 'geojson',
              data: samplingGeoJson,
            });
            mapRef.current.addLayer({
              id: 'sampling-grid-points',
              type: 'circle',
              source: 'sampling-grid',
              paint: {
                'circle-radius': 4,
                'circle-color': '#00ffcc',
                'circle-opacity': 0.7,
                'circle-stroke-width': 1,
                'circle-stroke-color': '#ffffff',
              },
            });
          }
        }

        // Si hay rovers o puntos de escaneo listos, calcular automáticamente las rutas y clusters
        try {
          await handleCalcularRutasYClusters();
        } catch (routeErr) {
          console.warn('Cálculo de rutas de rovers puede realizarse independientemente:', routeErr);
        }
      } else {
        throw new Error(res.error || 'No se pudieron calcular las condiciones.');
      }
    } catch (err) {
      console.error(err);
      setError('Error al consultar el servicio Flask de IA: ' + err.message);
    } finally {
      setCalculatingTerrain(false);
    }
  }

  // Limpiar capas y marcadores de rutas y clusters en el mapa
  function limpiarCapasRutasEnMapa() {
    routePopupsRef.current.forEach((p) => p.remove());
    routePopupsRef.current = [];

    if (!mapRef.current) return;
    try {
      if (mapRef.current.getLayer('rover-cluster-points-label')) mapRef.current.removeLayer('rover-cluster-points-label');
      if (mapRef.current.getLayer('rover-cluster-points-core')) mapRef.current.removeLayer('rover-cluster-points-core');
      if (mapRef.current.getLayer('rover-cluster-points-ring')) mapRef.current.removeLayer('rover-cluster-points-ring');
      if (mapRef.current.getSource('rover-cluster-points')) mapRef.current.removeSource('rover-cluster-points');

      if (mapRef.current.getLayer('rover-routes-line')) mapRef.current.removeLayer('rover-routes-line');
      if (mapRef.current.getLayer('rover-routes-glow')) mapRef.current.removeLayer('rover-routes-glow');
      if (mapRef.current.getSource('rover-routes')) mapRef.current.removeSource('rover-routes');
    } catch (e) {
      // Ignorar si las capas aún no existían
    }
  }

  // Renderizar rutas por rover y clusters sobre Mapbox
  function renderizarCapasRutasEnMapa(routesData) {
    if (!mapRef.current || !routesData || !routesData.rutas_rovers) return;

    limpiarCapasRutasEnMapa();

    const routesFeatures = routesData.rutas_rovers.map((r) => ({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: r.coordenadas_ruta,
      },
      properties: {
        rover_id: r.rover_id,
        rover_nombre: r.rover_nombre,
        color: r.color || '#00e5ff',
        distancia_m: r.metricas?.distancia_total_m || 0,
        tiempo_min: r.metricas?.tiempo_total_min || 0,
        energia_j: r.metricas?.energia_total_j || 0,
      },
    }));

    const clusterPointsFeatures = routesData.rutas_rovers.flatMap((r) =>
      (r.waypoints || [])
        .filter((wp) => wp.tipo === 'medicion')
        .map((wp) => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [wp.lng, wp.lat],
          },
          properties: {
            rover_id: r.rover_id,
            rover_nombre: r.rover_nombre,
            color: r.color || '#00e5ff',
            indice: wp.indice,
            elevacion_m: wp.elevacion_m,
            zona: wp.zona,
            distancia_tramo_m: wp.distancia_tramo_m,
            delta_h_tramo_m: wp.delta_h_tramo_m,
            energia_tramo_j: wp.energia_tramo_j,
            tiempo_tramo_s: wp.tiempo_tramo_s,
            seguridad: wp.estado_seguridad,
          },
        }))
    );

    try {
      // Fuente y capas de trayectorias
      mapRef.current.addSource('rover-routes', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: routesFeatures,
        },
      });

      mapRef.current.addLayer({
        id: 'rover-routes-glow',
        type: 'line',
        source: 'rover-routes',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 7,
          'line-opacity': 0.35,
          'line-blur': 2.5,
        },
      });

      mapRef.current.addLayer({
        id: 'rover-routes-line',
        type: 'line',
        source: 'rover-routes',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 3.5,
          'line-opacity': 0.95,
        },
      });

      // Fuente y capas de puntos de medición (clusters)
      mapRef.current.addSource('rover-cluster-points', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: clusterPointsFeatures,
        },
      });

      mapRef.current.addLayer({
        id: 'rover-cluster-points-ring',
        type: 'circle',
        source: 'rover-cluster-points',
        paint: {
          'circle-radius': 10,
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.25,
        },
      });

      mapRef.current.addLayer({
        id: 'rover-cluster-points-core',
        type: 'circle',
        source: 'rover-cluster-points',
        paint: {
          'circle-radius': 6,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });

      mapRef.current.on('click', 'rover-cluster-points-core', (e) => {
        if (!e.features || !e.features[0]) return;
        const f = e.features[0];
        const p = f.properties;
        const coords = f.geometry.coordinates;

        const popupHtml = `
          <div style="font-family: monospace; font-size: 11px; color: #fff; background: #121212; padding: 10px; border-radius: 8px; border: 1px solid ${p.color}; min-width: 190px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
              <strong style="color:${p.color}; font-size:12px;">🤖 ${p.rover_nombre}</strong>
              <span style="font-size:9px; background:${p.color}33; color:${p.color}; padding:1px 5px; border-radius:4px; font-weight:bold;">#${p.indice}</span>
            </div>
            <div style="font-size:10px; color:#ccc; margin-bottom:4px;">
              <b>Elevación:</b> ${p.elevacion_m}m (${p.zona?.toUpperCase()})<br/>
              <b>Coordenadas:</b> [${Number(coords[1]).toFixed(5)}, ${Number(coords[0]).toFixed(5)}]<br/>
              <b>Tramo:</b> +${p.distancia_tramo_m}m | Δh: ${p.delta_h_tramo_m}m<br/>
              <b>Gasto Energía:</b> ~${p.energia_tramo_j} J
            </div>
            <div style="font-size:9.5px; color:#4ade80; border-top:1px solid #333; padding-top:4px;">
              ✓ Parada de muestreo de sensores (15s)
            </div>
          </div>
        `;

        const pop = new mapboxgl.Popup({ offset: 12 })
          .setLngLat(coords)
          .setHTML(popupHtml)
          .addTo(mapRef.current);
        routePopupsRef.current.push(pop);
      });

      mapRef.current.on('mouseenter', 'rover-cluster-points-core', () => {
        mapRef.current.getCanvas().style.cursor = 'pointer';
      });
      mapRef.current.on('mouseleave', 'rover-cluster-points-core', () => {
        mapRef.current.getCanvas().style.cursor = '';
      });
    } catch (err) {
      console.warn('Error registrando capas de rutas en Mapbox:', err);
    }
  }

  // Calcular rutas y clusters usando Flask Web Service y mejoras.txt
  async function handleCalcularRutasYClusters() {
    setError('');
    if (vertices.length < 3) {
      setError('Debes trazar al menos 3 vértices en el mapa antes de calcular las rutas de medición.');
      return;
    }

    setCalculatingRoutes(true);
    try {
      const closedCoords = [...vertices, vertices[0]];

      // Usar matriz DEM disponible si existe
      let activeDem = null;
      if (elevationData) {
        activeDem =
          elevationData.scale_factor > 1 && elevationData.interpolated_matrix_2d
            ? elevationData.interpolated_matrix_2d
            : elevationData.matrix_2d;
      }

      // Preparar rovers a partir de los puntos de escaneo marcados en el mapa
      let roversPayload = [];
      if (scanStartPoints && scanStartPoints.length > 0) {
        roversPayload = scanStartPoints.map((pt, idx) => ({
          id: pt.robot_id || idx + 1,
          nombre: pt.robot_nombre || `Rover #${idx + 1}`,
          modelo: pt.robot_modelo || 'Myco Rover',
          modo: pt.robot_modo || 'lectura',
          bateria: pt.robot_bateria || 85,
          punto_inicio: [pt.lng, pt.lat],
          color: ROVER_PALETTE[idx % ROVER_PALETTE.length],
        }));
      } else if (availableRobots && availableRobots.length > 0) {
        roversPayload = availableRobots.slice(0, 2).map((r, idx) => ({
          id: r.id,
          nombre: r.nombre,
          modelo: r.modelo,
          modo: r.modo,
          bateria: r.bateria || 80,
          punto_inicio: [closedCoords[idx % closedCoords.length][0], closedCoords[idx % closedCoords.length][1]],
          color: ROVER_PALETTE[idx % ROVER_PALETTE.length],
        }));
      }

      const payload = {
        poligono_coordenadas: closedCoords,
        matriz_dem: activeDem,
        rovers: roversPayload,
        puntos_inicio_escaneo: scanStartPoints,
        puntos_por_rover: 8,
        max_slope_deg: 25.0,
      };

      const res = await apiService.calcularRutasMediciones(payload);
      if (res && res.success) {
        setRoutesMissionData(res);
        setActiveOverlayPanel('rutas');
        if (res.rutas_rovers && res.rutas_rovers.length > 0) {
          setSelectedRoverRoute(res.rutas_rovers[0]);
        }
        renderizarCapasRutasEnMapa(res);
        return res;
      } else {
        throw new Error(res.error || 'No se pudieron calcular las rutas.');
      }
    } catch (err) {
      console.error(err);
      setError('Error al calcular rutas y clusters con Flask IA: ' + err.message);
      throw err;
    } finally {
      setCalculatingRoutes(false);
    }
  }

  // Inicializar mapa Mapbox
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const initialCenter = [formData.longitud_central, formData.latitud_central];
    const initialStyle = EARTH_SATELLITE_STYLE;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: initialStyle,
      center: initialCenter,
      zoom: 14,
      pitch: 0,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new mapboxgl.ScaleControl({ unit: 'metric' }), 'bottom-right');

    map.on('load', () => {
      // Fuente y capas para polígono dibujado
      map.addSource('custom-polygon', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      // Relleno del polígono
      map.addLayer({
        id: 'custom-polygon-fill',
        type: 'fill',
        source: 'custom-polygon',
        paint: {
          'fill-color': '#10b981',
          'fill-opacity': 0.35,
        },
      });

      // Líneas de contorno
      map.addLayer({
        id: 'custom-polygon-outline',
        type: 'line',
        source: 'custom-polygon',
        paint: {
          'line-color': '#10b981',
          'line-width': 2.5,
          'line-dasharray': [2, 1],
        },
      });
    });

    map.on('mousemove', (e) => {
      setMapCursorCoords({
        lat: e.lngLat.lat.toFixed(5),
        lng: e.lngLat.lng.toFixed(5),
      });
    });

    // Click en el mapa: según el modo activo (añadir vértice de polígono o punto de inicio de escaneo)
    map.on('click', (e) => {
      const lng = Number(e.lngLat.lng.toFixed(6));
      const lat = Number(e.lngLat.lat.toFixed(6));

      if (activeClickModeRef.current === 'scan_start') {
        // Guardar coordenadas temporales y desplegar el modal selector de Rover
        setPendingScanPoint({ lat, lng });
        setRobotModalOpen(true);
      } else {
        setVertices((prev) => [...prev, [lng, lat]]);
      }
    });

    mapRef.current = map;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      limpiarMarcadoresSuelo();
      limpiarMarcadoresInicioEscaneo();
      limpiarCapasRutasEnMapa();
      map.remove();
    };
  }, []);

  // Actualizar estilo al cambiar entorno
  useEffect(() => {
    if (!mapRef.current) return;
    const style = EARTH_SATELLITE_STYLE;
    mapRef.current.setStyle(style);

    // Cuando recarga el estilo, volver a registrar capas GeoJSON
    mapRef.current.once('style.load', () => {
      if (!mapRef.current.getSource('custom-polygon')) {
        mapRef.current.addSource('custom-polygon', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [],
          },
        });
        mapRef.current.addLayer({
          id: 'custom-polygon-fill',
          type: 'fill',
          source: 'custom-polygon',
          paint: {
            'fill-color': '#10b981',
            'fill-opacity': 0.35,
          },
        });
        mapRef.current.addLayer({
          id: 'custom-polygon-outline',
          type: 'line',
          source: 'custom-polygon',
          paint: {
            'line-color': '#10b981',
            'line-width': 2.5,
            'line-dasharray': [2, 1],
          },
        });
      }
      actualizarCapaPoligono(vertices);
      if (routesMissionData) {
        renderizarCapasRutasEnMapa(routesMissionData);
      }
    });
  }, [formData.entorno]);

  // Actualizar marcadores de vértices y capa GeoJSON cuando cambian los vértices
  useEffect(() => {
    if (!mapRef.current) return;
    actualizarMarcadores(vertices);
    actualizarCapaPoligono(vertices);
  }, [vertices]);

  function actualizarMarcadores(pts) {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (!mapRef.current) return;

    pts.forEach((pt, index) => {
      const el = document.createElement('div');
      el.className =
        'flex items-center justify-center w-6 h-6 rounded-full bg-black/90 border-2 font-mono font-bold text-[0.65rem] text-white shadow-lg cursor-pointer transform -translate-x-1/2 -translate-y-1/2';
      el.style.borderColor = '#10b981';
      el.innerText = `${index + 1}`;

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat(pt)
        .addTo(mapRef.current);

      markersRef.current.push(marker);
    });
  }

  function actualizarCapaPoligono(pts) {
    if (!mapRef.current || !mapRef.current.getSource('custom-polygon')) return;

    if (pts.length < 3) {
      // Si son 2 puntos mostrar línea
      if (pts.length === 2) {
        mapRef.current.getSource('custom-polygon').setData({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: pts,
              },
            },
          ],
        });
      } else {
        mapRef.current.getSource('custom-polygon').setData({
          type: 'FeatureCollection',
          features: [],
        });
      }
      return;
    }

    try {
      const closedCoords = [...pts, pts[0]];
      const polygonFeature = turf.polygon([closedCoords]);
      const areaM2 = Math.round(turf.area(polygonFeature));
      const center = turf.center(polygonFeature).geometry.coordinates;

      mapRef.current.getSource('custom-polygon').setData({
        type: 'FeatureCollection',
        features: [polygonFeature],
      });

      // Actualizar dimensiones y centro automáticamente calculados por Turf
      setFormData((prev) => ({
        ...prev,
        dimensiones_m2: areaM2,
        longitud_central: Number(center[0].toFixed(5)),
        latitud_central: Number(center[1].toFixed(5)),
      }));
    } catch (e) {
      console.error('Error calculando geometría Turf:', e);
    }
  }

  // Deshacer último vértice
  function handleDeshacerVertice() {
    setVertices((prev) => prev.slice(0, -1));
  }

  // Limpiar polígono
  function handleLimpiarPoligono() {
    setVertices([]);
  }

  // Autocalibrar un polígono cuadrado según dimensiones_m2 y centro
  function handleGenerarCuadrado() {
    try {
      const center = [Number(formData.longitud_central), Number(formData.latitud_central)];
      const areaM2 = Number(formData.dimensiones_m2) || 25000;
      const sideKm = Math.sqrt(areaM2) / 1000;
      const radiusKm = (sideKm * Math.sqrt(2)) / 2;
      const square = turf.bboxPolygon(turf.bbox(turf.circle(center, radiusKm, { units: 'kilometers' })));
      const coords = square.geometry.coordinates[0].slice(0, 4); // 4 esquinas sin cerrar

      setVertices(coords);
      if (mapRef.current) {
        mapRef.current.flyTo({ center, zoom: 15 });
      }
    } catch (e) {
      console.error('Error generando cuadrado:', e);
    }
  }

  // Aplicar Preset
  function handleApplyPreset(p) {
    setFormData((prev) => ({
      ...prev,
      entorno: p.entorno,
      latitud_central: p.lat,
      longitud_central: p.lon,
      dimensiones_m2: p.m2,
      descripcion: p.desc,
      red_wifi_ssid: p.wifi,
    }));

    if (mapRef.current) {
      mapRef.current.flyTo({ center: [p.lon, p.lat], zoom: 14.5 });
    }

    // Generar polígono inicial sugerido en el preset
    const center = [p.lon, p.lat];
    const sideKm = Math.sqrt(p.m2) / 1000;
    const radiusKm = (sideKm * Math.sqrt(2)) / 2;
    const square = turf.bboxPolygon(turf.bbox(turf.circle(center, radiusKm, { units: 'kilometers' })));
    setVertices(square.geometry.coordinates[0].slice(0, 4));
  }

  async function handleGuardar(e) {
    e.preventDefault();
    setError('');

    if (vertices.length < 3) {
      setError('Debes marcar al menos 3 vértices en el mapa para definir el perímetro del terreno.');
      return;
    }

    setSaving(true);
    try {
      const closedCoords = [...vertices, vertices[0]].map(([lng, lat]) => [Number(lng), Number(lat)]);
      const payload = {
        nombre: formData.nombre || '',
        descripcion: formData.descripcion || '',
        entorno: formData.entorno || 'tierra',
        latitud_central: Number(formData.latitud_central) || 0,
        longitud_central: Number(formData.longitud_central) || 0,
        dimensiones_m2: Number(formData.dimensiones_m2) || 0,
        red_wifi_ssid: formData.red_wifi_ssid || null,
        red_wifi_pass: formData.red_wifi_pass || null,
        red_wifi_status: formData.red_wifi_status || 'activa',
        poligono_coordenadas: closedCoords,
        puntos_inicio_escaneo: scanStartPoints && scanStartPoints.length > 0 ? scanStartPoints.map((pt) => ({
          id: String(pt.id),
          lat: Number(pt.lat),
          lng: Number(pt.lng),
          robot_id: pt.robot_id ? Number(pt.robot_id) : null,
          robot_nombre: String(pt.robot_nombre || ''),
          robot_modelo: String(pt.robot_modelo || ''),
          robot_modo: String(pt.robot_modo || 'lectura'),
          robot_bateria: pt.robot_bateria !== null && pt.robot_bateria !== undefined ? Number(pt.robot_bateria) : null,
          timestamp: pt.timestamp || new Date().toISOString(),
        })) : null,
        condiciones_terreno: terrainConditions ? {
          clima: terrainConditions.clima || null,
          soil_summary: terrainConditions.soil_summary || null,
          sampling_points: terrainConditions.sampling_points || null,
          metrics: terrainConditions.metrics || null,
          hectareas: terrainConditions.hectareas || null,
        } : null,
        elevacion_data: elevationData ? {
          min: Number(elevationData.min),
          max: Number(elevationData.max),
          avg: Number(elevationData.avg),
          diff: Number(elevationData.diff),
          slope_pct: Number(elevationData.slope_pct),
          matrix_2d: elevationData.matrix_2d || [],
          interpolated_matrix_2d: elevationData.interpolated_matrix_2d || null,
          scale_factor: typeof elevationData.scale_factor === 'number' && !isNaN(elevationData.scale_factor)
            ? elevationData.scale_factor
            : 1,
          dimensions: elevationData.dimensions || { width: 16, height: 16 },
          interpolated_dimensions: elevationData.interpolated_dimensions || null,
          espaciado_metros: Number(elevationData.espaciado_metros) || 5.0,
          hectareas: Number(elevationData.hectareas) || 1.0,
          area_m2: Number(elevationData.area_m2) || 10000,
        } : null,
        rutas_rovers: routesMissionData?.rutas_rovers || null,
        clusters_muestreo: routesMissionData?.clusters || null,
      };

      const creado = await apiService.crearTerreno(payload);
      // Redirigir directamente al nuevo terreno en Misión
      if (creado && creado.id) {
        navigate(`/mision/${creado.id}`);
      } else {
        navigate('/terrenos');
      }
    } catch (err) {
      setError('Error al crear el terreno: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col lg:flex-row bg-[#131313] overflow-hidden">
      {/* ─── PANEL LATERAL: FORMULARIO & CONFIGURACIÓN ─── */}
      <div className="w-full lg:w-[440px] xl:w-[480px] bg-[#131313] border-r border-[#262626] flex flex-col h-full z-10 shadow-2xl">
        {/* Cabecera del Panel */}
        <div className="p-4 border-b border-[#262626] flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/terrenos')}
                className="text-gray-400 hover:text-white transition-colors"
                title="Volver al catálogo"
              >
                <i className="fa-solid fa-arrow-left text-sm" />
              </button>
              <h1 className="text-base font-bold font-mono text-white tracking-wide">
                Delimitar Nuevo Terreno
              </h1>
            </div>
            <p className="text-[0.7rem] text-gray-400 mt-0.5 font-mono">
              Haz clic en el mapa para trazar el perímetro poligonal georreferenciado.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[0.65rem] font-bold font-mono uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <i className="fa-solid fa-earth-americas mr-1" />
              Planeta Tierra
            </span>
            <button
              type="button"
              onClick={() => navigate('/terrenos/crear-marte')}
              className="px-2 py-0.5 rounded text-[0.62rem] font-mono text-gray-400 hover:text-[#ff4500] hover:bg-[#ff4500]/10 border border-transparent hover:border-[#ff4500]/30 transition-all flex items-center gap-1"
              title="Ir a misión de Marte con NASA Mars Trek"
            >
              <i className="fa-solid fa-meteor text-[0.6rem]" />
              <span>Marte</span>
            </button>
          </div>
        </div>

        {/* Formulario Scrolleable */}
        <form onSubmit={handleGuardar} className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-mono flex items-center gap-2">
              <i className="fa-solid fa-circle-exclamation text-sm shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Presets Rápidos */}
          <div>
            <label className="block text-[0.65rem] text-gray-400 font-mono uppercase mb-1.5 flex items-center gap-1">
              <i className="fa-solid fa-wand-magic-sparkles text-[#ff4500]" />
              <span>Plantillas / Presets Rápidos</span>
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              {PRESETS_TERRENO.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyPreset(p)}
                  className="p-2 bg-black/40 hover:bg-white/5 border border-white/10 hover:border-white/20 rounded-xl text-left text-xs font-mono transition-all flex items-center justify-between group"
                >
                  <div className="min-w-0 pr-2">
                    <span className="font-bold text-gray-200 group-hover:text-white block text-[0.72rem] truncate">
                      {p.label}
                    </span>
                    <span className="text-[0.62rem] text-gray-400 truncate block">
                      {p.desc}
                    </span>
                  </div>
                  <span className="text-[0.65rem] text-[#ff4500] font-bold whitespace-nowrap">
                    {p.m2.toLocaleString()} m²
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Campos Principales */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-300 font-mono mb-1">
                Nombre de la Parcela *
              </label>
              <input
                type="text"
                required
                placeholder="Ej. Sector Beta-04 Agro"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-black/60 border border-[#262626] text-white text-xs font-mono outline-none focus:border-[#ff4500]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-300 font-mono mb-1">
                  Entorno Planetario
                </label>
                <div className="w-full px-3 py-2 rounded-xl bg-black/60 border border-emerald-500/30 text-emerald-400 text-xs font-mono flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-bold">
                    <i className="fa-solid fa-earth-americas text-emerald-400" />
                    Tierra (Agrícola)
                  </span>
                  <span className="text-[0.6rem] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
                    1G
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-300 font-mono mb-1">
                  Superficie ({vertices.length >= 3 ? 'Auto' : 'm²'})
                </label>
                <input
                  type="number"
                  required
                  min="10"
                  value={formData.dimensiones_m2}
                  onChange={(e) =>
                    setFormData({ ...formData, dimensiones_m2: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-[#262626] text-white text-xs font-mono outline-none focus:border-[#ff4500]"
                />
              </div>
            </div>

            {/* Coordenadas Centro */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-300 font-mono mb-1">
                  Latitud Centro
                </label>
                <input
                  type="number"
                  step="0.000001"
                  required
                  value={formData.latitud_central}
                  onChange={(e) =>
                    setFormData({ ...formData, latitud_central: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-[#262626] text-white text-xs font-mono outline-none focus:border-[#ff4500]"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-300 font-mono mb-1">
                  Longitud Centro
                </label>
                <input
                  type="number"
                  step="0.000001"
                  required
                  value={formData.longitud_central}
                  onChange={(e) =>
                    setFormData({ ...formData, longitud_central: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-[#262626] text-white text-xs font-mono outline-none focus:border-[#ff4500]"
                />
              </div>
            </div>

            {/* Red Wi-Fi */}
            <div>
              <label className="block text-xs text-gray-300 font-mono mb-1">
                SSID Red Wi-Fi de Misión
              </label>
              <input
                type="text"
                value={formData.red_wifi_ssid}
                onChange={(e) => setFormData({ ...formData, red_wifi_ssid: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-black/60 border border-[#262626] text-white text-xs font-mono outline-none focus:border-[#ff4500]"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-300 font-mono mb-1">
                Descripción / Objetivos de Restauración
              </label>
              <textarea
                rows="2"
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                placeholder="Notas de suelo, toxicidad, inoculantes fúngicos..."
                className="w-full px-3 py-2 rounded-xl bg-black/60 border border-[#262626] text-white text-xs font-mono outline-none focus:border-[#ff4500]"
              />
            </div>
          </div>

          {/* Estado de Vértices Dibujados */}
          <div className="p-3 bg-black/50 border border-white/10 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[0.68rem] text-[#ff4500] font-bold uppercase font-mono flex items-center gap-1.5">
                <i className="fa-solid fa-draw-polygon" />
                <span>Vértices del Polígono ({vertices.length})</span>
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleDeshacerVertice}
                  disabled={vertices.length === 0}
                  className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 disabled:opacity-40 text-gray-300 text-[0.62rem] font-mono border border-white/10"
                >
                  Deshacer
                </button>
                <button
                  type="button"
                  onClick={handleLimpiarPoligono}
                  disabled={vertices.length === 0}
                  className="px-2 py-0.5 rounded bg-white/5 hover:bg-red-500/20 disabled:opacity-40 text-red-400 text-[0.62rem] font-mono border border-white/10"
                >
                  Limpiar
                </button>
              </div>
            </div>

            {vertices.length === 0 ? (
              <p className="text-[0.68rem] text-gray-400 font-mono">
                Haz clic en cualquier punto del mapa satelital para comenzar a trazar las esquinas.
              </p>
            ) : (
              <div className="max-h-28 overflow-y-auto space-y-1 pr-1 font-mono text-[0.65rem]">
                {vertices.map(([lng, lat], idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-1 rounded bg-black/40 border border-white/5 text-gray-300"
                  >
                    <span>Vértice #{idx + 1}</span>
                    <span className="text-gray-400">
                      [{lat.toFixed(5)}, {lng.toFixed(5)}]
                    </span>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={handleGenerarCuadrado}
              className="w-full py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white text-[0.68rem] font-mono font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <i className="fa-solid fa-vector-square text-[#ff4500]" />
              <span>Autogenerar Polígono Cuadrado desde Centro</span>
            </button>
          </div>

          {/* Marcadores de Inicio de Escaneo de Terreno (Rover / Dron) */}
          <div className="p-3 bg-black/50 border border-amber-500/30 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[0.68rem] text-amber-400 font-bold uppercase font-mono flex items-center gap-1.5">
                <i className="fa-solid fa-radar" />
                <span>Puntos de Inicio de Escaneo ({scanStartPoints.length})</span>
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setScanStartPoints([])}
                  disabled={scanStartPoints.length === 0}
                  className="px-2 py-0.5 rounded bg-white/5 hover:bg-red-500/20 disabled:opacity-40 text-red-400 text-[0.62rem] font-mono border border-white/10"
                >
                  Limpiar
                </button>
              </div>
            </div>

            <p className="text-[0.68rem] text-gray-400 font-mono">
              Define los puntos desde donde los rovers o sensores comenzarán el escaneo o recorrido.
            </p>

            {/* Botón selector de Modo */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setActiveClickMode('polygon')}
                className={`py-2 px-2 rounded-lg font-mono text-[0.68rem] font-bold flex items-center justify-center gap-1.5 transition-all border ${
                  activeClickMode === 'polygon'
                    ? 'bg-[#ff4500]/20 text-[#ff4500] border-[#ff4500]/60 shadow-md'
                    : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
                }`}
              >
                <i className="fa-solid fa-draw-polygon text-xs" />
                <span>Trazar Perímetro</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveClickMode('scan_start')}
                className={`py-2 px-2 rounded-lg font-mono text-[0.68rem] font-bold flex items-center justify-center gap-1.5 transition-all border ${
                  activeClickMode === 'scan_start'
                    ? 'bg-amber-500/25 text-amber-300 border-amber-400 shadow-md ring-1 ring-amber-400/50'
                    : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
                }`}
              >
                <i className="fa-solid fa-location-crosshairs text-xs text-amber-400" />
                <span>+ Punto Escaneo</span>
              </button>
            </div>

            {scanStartPoints.length > 0 && (
              <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1 font-mono text-[0.65rem] pt-1">
                {scanStartPoints.map((pt, idx) => (
                  <div
                    key={pt.id}
                    className="p-1.5 rounded-lg bg-black/60 border border-amber-500/30 text-gray-200 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-5 h-5 rounded-full bg-amber-500 text-black font-extrabold flex items-center justify-center text-[0.62rem] shrink-0">
                        {idx + 1}
                      </span>
                      <div className="truncate">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-amber-300 truncate">
                            {pt.robot_nombre || `Rover #${idx + 1}`}
                          </span>
                          <span className="text-[0.58rem] px-1 py-0.2 bg-white/10 rounded text-gray-300">
                            {pt.robot_modo === 'inyeccion' ? 'Inyección' : 'Lectura'}
                          </span>
                        </div>
                        <div className="text-gray-400 text-[0.6rem]">
                          [{pt.lat.toFixed(5)}, {pt.lng.toFixed(5)}]
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => eliminarPuntoInicioEscaneo(pt.id)}
                      className="text-gray-400 hover:text-red-400 p-1 text-xs shrink-0 transition-colors"
                      title="Eliminar este punto"
                    >
                      <i className="fa-solid fa-trash-can text-[0.7rem]" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Botones de Acción */}
          <div className="pt-2 space-y-2">
            {/* Botón 1: Calcular Condiciones IA (SoilGrids + Clima) */}
            <button
              type="button"
              onClick={handleCalcularCondiciones}
              disabled={calculatingTerrain || vertices.length < 3}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-teal-500/20 to-emerald-500/20 hover:from-teal-500/30 hover:to-emerald-500/30 border border-teal-500/40 text-teal-300 font-mono font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
            >
              {calculatingTerrain ? (
                <>
                  <i className="fa-solid fa-spinner animate-spin text-teal-400" />
                  <span>Calculando condiciones (SoilGrids + Clima)...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-satellite-dish text-teal-400 group-hover:scale-110 transition-transform" />
                  <span>Calcular Condiciones de Terreno (IA / 250m)</span>
                </>
              )}
            </button>

            {/* Botón 2: Calcular Elevación Mapbox Terrain-DEM / Terrain-RGB */}
            <button
              type="button"
              onClick={() => handleCalcularElevacion(1)}
              disabled={calculatingElevation || vertices.length < 3}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 border border-cyan-500/40 text-cyan-300 font-mono font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
            >
              {calculatingElevation ? (
                <>
                  <i className="fa-solid fa-spinner animate-spin text-cyan-400" />
                  <span>Muestreando Mapbox Terrain-RGB...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-mountain-sun text-cyan-400 group-hover:scale-110 transition-transform" />
                  <span>Analizar Elevación (Terrain-RGB / DEM)</span>
                </>
              )}
            </button>

            {/* Botón 3: Calcular Rutas & Clusters de Rovers (mejoras.txt) */}
            <button
              type="button"
              onClick={handleCalcularRutasYClusters}
              disabled={calculatingRoutes || vertices.length < 3}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-500/40 text-amber-300 font-mono font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
            >
              {calculatingRoutes ? (
                <>
                  <i className="fa-solid fa-spinner animate-spin text-amber-400" />
                  <span>Calculando Rutas & Clusters TSP (IA)...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-route text-amber-400 group-hover:scale-110 transition-transform" />
                  <span>Calcular Rutas y Clusters de Rovers</span>
                </>
              )}
            </button>

            {/* Resumen de Estado rápido */}
            {(terrainConditions || elevationData || routesMissionData) && (
              <div className="p-2.5 rounded-xl bg-black/60 border border-teal-500/30 text-teal-200 text-xs font-mono space-y-1">
                {terrainConditions && (
                  <div className="flex items-center justify-between text-[0.68rem]">
                    <span className="flex items-center gap-1.5 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse shrink-0" />
                      <span className="truncate">Suelo & Clima: pH {terrainConditions.soil_summary?.ph} | {terrainConditions.clima?.temperature_c}°C</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveOverlayPanel(activeOverlayPanel === 'resumen' ? 'cerrado' : 'resumen')}
                      className="text-teal-400 hover:underline font-bold shrink-0 ml-1"
                    >
                      Ver
                    </button>
                  </div>
                )}
                {elevationData && (
                  <div className="flex items-center justify-between text-[0.68rem] pt-1 border-t border-white/5">
                    <span className="flex items-center gap-1.5 truncate text-cyan-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shrink-0" />
                      <span className="truncate">DEM: {elevationData.min}m - {elevationData.max}m (Δ {elevationData.diff}m)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveOverlayPanel(activeOverlayPanel === 'elevacion' ? 'cerrado' : 'elevacion')}
                      className="text-cyan-400 hover:underline font-bold shrink-0 ml-1"
                    >
                      Matriz
                    </button>
                  </div>
                )}
                {routesMissionData && (
                  <div className="flex items-center justify-between text-[0.68rem] pt-1 border-t border-white/5">
                    <span className="flex items-center gap-1.5 truncate text-amber-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                      <span className="truncate">
                        Rutas: {routesMissionData.resumen_mision.total_rovers} rovers ({routesMissionData.resumen_mision.total_puntos_medicion} pts | {routesMissionData.resumen_mision.distancia_total_flota_m}m)
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveOverlayPanel(activeOverlayPanel === 'rutas' ? 'cerrado' : 'rutas')}
                      className="text-amber-400 hover:underline font-bold shrink-0 ml-1"
                    >
                      Rutas
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => navigate('/terrenos')}
                className="w-1/3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-mono text-xs transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="w-2/3 py-2.5 rounded-xl bg-[#ff4500] hover:bg-[#ff4500]/90 text-white font-mono font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#ff4500]/20 transition-all disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <i className="fa-solid fa-spinner animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-floppy-disk" />
                    <span>Guardar y Abrir Terreno</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* ─── CONTENEDOR DEL MAPA FULL SCREEN CON PANELES FLOTANTES ─── */}
      <div className="flex-1 relative h-full">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Barra Flotante Superior: Modo Marcación y Coordenadas */}
        <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2 pointer-events-none">
          <div className="pointer-events-auto px-3 py-1.5 rounded-xl bg-black/85 backdrop-blur-md border border-white/15 text-xs font-mono text-white flex items-center gap-2 shadow-xl">
            <span
              className={`w-2.5 h-2.5 rounded-full animate-ping ${
                activeClickMode === 'scan_start' ? 'bg-amber-400' : 'bg-[#ff4500]'
              }`}
            />
            <span className="font-bold">
              {activeClickMode === 'scan_start' ? 'Modo Escaneo:' : 'Modo Perímetro:'}
            </span>
            <span className="text-gray-300 text-[0.7rem]">
              {activeClickMode === 'scan_start'
                ? `Haz clic en el mapa para marcar punto de inicio (${scanStartPoints.length} agregados)`
                : vertices.length === 0
                ? 'Haz clic para colocar el 1er vértice'
                : vertices.length < 3
                ? `Faltan ${3 - vertices.length} punto(s) para cerrar polígono`
                : `${vertices.length} vértices trazados (Polígono activo)`}
            </span>

            {/* Selector rápido en barra flotante */}
            <div className="ml-2 flex items-center gap-1 border-l border-white/20 pl-2">
              <button
                type="button"
                onClick={() => setActiveClickMode('polygon')}
                className={`px-2 py-0.5 rounded text-[0.65rem] font-bold transition-all ${
                  activeClickMode === 'polygon'
                    ? 'bg-[#ff4500] text-white shadow'
                    : 'text-gray-400 hover:text-white bg-white/5'
                }`}
                title="Trazar perímetro del terreno"
              >
                Perímetro
              </button>
              <button
                type="button"
                onClick={() => setActiveClickMode('scan_start')}
                className={`px-2 py-0.5 rounded text-[0.65rem] font-bold transition-all flex items-center gap-1 ${
                  activeClickMode === 'scan_start'
                    ? 'bg-amber-500 text-black shadow'
                    : 'text-gray-400 hover:text-white bg-white/5'
                }`}
                title="Marcar punto o puntos de inicio de escaneo"
              >
                <i className="fa-solid fa-radar text-[0.6rem]" />
                <span>+ Escaneo</span>
              </button>
            </div>
          </div>

          {mapCursorCoords && (
            <div className="pointer-events-auto px-2.5 py-1.5 rounded-xl bg-black/85 backdrop-blur-md border border-white/10 text-[0.7rem] font-mono text-gray-400 hidden sm:flex items-center gap-1.5">
              <i
                className={`fa-solid fa-crosshairs text-xs ${
                  activeClickMode === 'scan_start' ? 'text-amber-400' : 'text-[#ff4500]'
                }`}
              />
              <span>
                Lat: {mapCursorCoords.lat} | Lon: {mapCursorCoords.lng}
              </span>
            </div>
          )}
        </div>

        {/* ─── PANELES Y WIDGETS SOBRE EL MAPA (CONDICIONES DE TERRENO Y ELEVACIÓN) ─── */}
        {(terrainConditions || elevationData || routesMissionData) && (
          <>
            {/* Barra Flotante de Conmutación de Paneles sobre el Mapa */}
            <div className="absolute top-4 right-14 z-20 flex items-center gap-1.5 bg-black/80 backdrop-blur-md p-1.5 rounded-xl border border-white/15 shadow-2xl">
              {[
                ...(terrainConditions
                  ? [
                      { id: 'resumen', label: 'Resumen', icon: 'fa-chart-pie' },
                      { id: 'suelo', label: 'SoilGrids', icon: 'fa-layer-group' },
                      { id: 'clima', label: 'Clima', icon: 'fa-cloud-sun' },
                      { id: 'automata', label: 'Autómata', icon: 'fa-dna' },
                    ]
                  : []),
                ...(elevationData
                  ? [{ id: 'elevacion', label: 'Elevación DEM', icon: 'fa-mountain-sun' }]
                  : []),
                ...(routesMissionData
                  ? [{ id: 'rutas', label: 'Rutas & Clusters', icon: 'fa-route' }]
                  : []),
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveOverlayPanel(activeOverlayPanel === tab.id ? 'cerrado' : tab.id)}
                  className={`px-2.5 py-1 rounded-lg text-[0.68rem] font-mono font-bold flex items-center gap-1.5 transition-all ${
                    activeOverlayPanel === tab.id
                      ? tab.id === 'rutas'
                        ? 'bg-amber-500 text-black shadow-md'
                        : 'bg-teal-500 text-black shadow-md'
                      : 'text-gray-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <i className={`fa-solid ${tab.icon} text-[0.65rem]`} />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}

              <button
                onClick={() => setActiveOverlayPanel(activeOverlayPanel === 'cerrado' ? 'resumen' : 'cerrado')}
                title={activeOverlayPanel === 'cerrado' ? 'Abrir Panel' : 'Minimizar Panel'}
                className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 flex items-center justify-center transition-colors ml-1"
              >
                <i className={`fa-solid ${activeOverlayPanel === 'cerrado' ? 'fa-chevron-down' : 'fa-chevron-up'} text-xs`} />
              </button>
            </div>

            {/* Panel Flotante Contextual sobre el Mapa (Esquina Superior Derecha / Flotante) */}
            {activeOverlayPanel !== 'cerrado' && (
              <div className="absolute top-16 right-4 z-20 w-80 sm:w-96 max-h-[calc(100vh-140px)] flex flex-col bg-[#141414]/95 backdrop-blur-xl border border-teal-500/30 rounded-2xl shadow-2xl overflow-hidden font-mono text-xs animate-fade-in">
                {/* Cabecera del Panel Flotante */}
                <div className="p-3 border-b border-white/10 bg-gradient-to-r from-teal-950/60 to-black/60 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full animate-pulse ${
                        activeOverlayPanel === 'rutas' ? 'bg-amber-400' : 'bg-teal-400'
                      }`}
                    />
                    <span className="font-bold text-white text-[0.75rem] uppercase tracking-wider">
                      {activeOverlayPanel === 'resumen' && 'Condiciones de Parcela'}
                      {activeOverlayPanel === 'suelo' && 'Puntos SoilGrids (250m)'}
                      {activeOverlayPanel === 'clima' && 'Meteorología OpenWeather'}
                      {activeOverlayPanel === 'automata' && 'Matriz Autómata & Cápsulas'}
                      {activeOverlayPanel === 'elevacion' && 'Relieve & Elevación DEM (Array 2D)'}
                      {activeOverlayPanel === 'rutas' && 'Rutas & Clusters por Rover (IA)'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {activeOverlayPanel === 'elevacion' && (
                      <a
                        href="/docs.html"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-[0.62rem] font-mono flex items-center gap-1 transition-all"
                        title="Ver Documentación Científica y Fórmulas Matemáticas del DEM"
                      >
                        <i className="fa-solid fa-book-open text-cyan-400" />
                        <span>Doc DEM</span>
                      </a>
                    )}
                    <button
                      onClick={() => setActiveOverlayPanel('cerrado')}
                      className="text-gray-400 hover:text-white transition-colors ml-1"
                    >
                      <i className="fa-solid fa-xmark text-xs" />
                    </button>
                  </div>
                </div>

                {/* Contenido Dinámico del Panel Flotante */}
                <div className="p-3.5 overflow-y-auto space-y-3 max-h-[70vh]">
                  {/* PESTAÑA: RESUMEN */}
                  {activeOverlayPanel === 'resumen' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2.5 bg-black/60 border border-white/10 rounded-xl">
                          <span className="text-[0.6rem] text-gray-400 uppercase block">pH de Suelo</span>
                          <span className="text-lg font-bold text-teal-300">
                            {terrainConditions.soil_summary?.ph ?? '--'}
                          </span>
                          <span className="text-[0.58rem] text-gray-500 block">Capas 0-5 cm</span>
                        </div>
                        <div className="p-2.5 bg-black/60 border border-white/10 rounded-xl">
                          <span className="text-[0.6rem] text-gray-400 uppercase block">Materia Orgánica</span>
                          <span className="text-lg font-bold text-emerald-400">
                            {terrainConditions.soil_summary?.om ?? '--'}%
                          </span>
                          <span className="text-[0.58rem] text-gray-500 block">SOC: {terrainConditions.soil_summary?.soc_g_kg} g/kg</span>
                        </div>
                        <div className="p-2.5 bg-black/60 border border-white/10 rounded-xl">
                          <span className="text-[0.6rem] text-gray-400 uppercase block">Temperatura</span>
                          <span className="text-lg font-bold text-amber-400">
                            {terrainConditions.clima?.temperature_c ?? '--'} °C
                          </span>
                          <span className="text-[0.58rem] text-gray-500 block">Hum: {terrainConditions.clima?.humidity_percent}%</span>
                        </div>
                        <div className="p-2.5 bg-black/60 border border-white/10 rounded-xl">
                          <span className="text-[0.6rem] text-gray-400 uppercase block">Idoneidad Media</span>
                          <span className="text-lg font-bold text-[#00ffcc]">
                            {terrainConditions.metrics?.suitability_mean ?? '--'}
                          </span>
                          <span className="text-[0.58rem] text-gray-500 block">Autómata Fúngico</span>
                        </div>
                      </div>

                      <div className="p-2.5 bg-black/40 border border-white/5 rounded-xl space-y-1">
                        <div className="flex items-center gap-1.5 text-white font-bold text-[0.7rem]">
                          <i className="fa-solid fa-seedling text-teal-400 text-xs" />
                          <span>Clasificación del Terreno:</span>
                        </div>
                        <p className="text-gray-300 text-[0.68rem] leading-relaxed">
                          Suelo tipo <strong className="text-teal-300">{terrainConditions.soil_summary?.usda_class}</strong> con{' '}
                          <strong className="text-white">{terrainConditions.sampling_points_count} punto(s) en malla espacial (250m)</strong>. Haz clic en los marcadores sobre el mapa para inspeccionar cada coordenada.
                        </p>
                      </div>

                      {/* Cápsulas sugeridas */}
                      {terrainConditions.metrics?.recommended_capsules?.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[0.65rem] text-gray-400 uppercase font-bold block">
                            Cápsulas Recomendadas para Inoculación
                          </span>
                          <div className="space-y-1.5">
                            {terrainConditions.metrics.recommended_capsules.slice(0, 3).map((cap, i) => (
                              <div
                                key={i}
                                className="p-2 rounded-lg bg-black/60 border border-emerald-500/20 flex items-center justify-between text-[0.68rem]"
                              >
                                <div>
                                  <span className="font-bold text-gray-200">Inóculo #{i + 1}</span>
                                  <span className="text-gray-500 ml-1.5">Celda [{cap.grid_x}, {cap.grid_y}]</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[#00ffcc] font-bold">Id: {cap.suitability}</span>
                                  <span className="px-1.5 py-0.2 rounded text-[0.58rem] font-bold bg-emerald-500/20 text-emerald-300">
                                    {cap.dosis_sugerida}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* PESTAÑA: SOILGRIDS */}
                  {activeOverlayPanel === 'suelo' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-1.5 text-center">
                        <div className="p-2 rounded-lg bg-black/60 border border-amber-500/20">
                          <span className="text-[0.58rem] text-gray-400 uppercase block">Arena</span>
                          <span className="text-sm font-bold text-amber-300">{terrainConditions.soil_summary?.sand}%</span>
                        </div>
                        <div className="p-2 rounded-lg bg-black/60 border border-cyan-500/20">
                          <span className="text-[0.58rem] text-gray-400 uppercase block">Limo</span>
                          <span className="text-sm font-bold text-cyan-300">{terrainConditions.soil_summary?.silt}%</span>
                        </div>
                        <div className="p-2 rounded-lg bg-black/60 border border-rose-500/20">
                          <span className="text-[0.58rem] text-gray-400 uppercase block">Arcilla</span>
                          <span className="text-sm font-bold text-rose-300">{terrainConditions.soil_summary?.clay}%</span>
                        </div>
                      </div>

                      {/* Detalle del punto seleccionado */}
                      {selectedSamplePoint && (
                        <div className="p-2.5 rounded-xl bg-teal-950/40 border border-teal-500/30 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-teal-300 text-[0.7rem]">
                              {selectedSamplePoint.is_centroid ? '⭐ Centroide de Parcela' : 'Muestra Seleccionada'}
                            </span>
                            <span className="text-[0.6rem] text-gray-400">
                              [{selectedSamplePoint.lat}, {selectedSamplePoint.lon}]
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-1 text-[0.65rem] text-gray-300 pt-1">
                            <div>pH: <b className="text-white">{selectedSamplePoint.ph}</b></div>
                            <div>MO: <b className="text-white">{selectedSamplePoint.om}%</b></div>
                            <div>Textura: <b className="text-white">{selectedSamplePoint.usda_class}</b></div>
                            <div>Arena/Arcilla: <b className="text-white">{selectedSamplePoint.sand}% / {selectedSamplePoint.clay}%</b></div>
                          </div>
                        </div>
                      )}

                      <div className="space-y-1">
                        <span className="text-[0.62rem] text-gray-400 uppercase font-bold block">
                          Puntos Muestreados sobre el Mapa ({terrainConditions.soil_samples?.length})
                        </span>
                        <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                          {terrainConditions.soil_samples?.map((s, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setSelectedSamplePoint(s);
                                if (mapRef.current) {
                                  mapRef.current.flyTo({ center: [s.lon, s.lat], zoom: 15.5 });
                                }
                              }}
                              className={`w-full p-1.5 rounded-lg border text-left flex items-center justify-between text-[0.65rem] transition-colors ${
                                selectedSamplePoint?.lat === s.lat && selectedSamplePoint?.lon === s.lon
                                  ? 'bg-teal-500/20 border-teal-500/40 text-teal-200'
                                  : 'bg-black/40 border-white/5 text-gray-400 hover:text-white hover:bg-white/5'
                              }`}
                            >
                              <span>{s.is_centroid ? '⭐ Centroide' : `Punto #${idx + 1}`}</span>
                              <span>pH {s.ph} | MO {s.om}%</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* PESTAÑA: CLIMA */}
                  {activeOverlayPanel === 'clima' && (
                    <div className="space-y-2.5">
                      <div className="p-3 bg-gradient-to-r from-blue-950/40 to-indigo-950/30 border border-blue-500/20 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <i className="fa-solid fa-cloud-sun text-xl text-amber-400" />
                            <div>
                              <span className="font-bold text-white text-[0.75rem] capitalize block">
                                {terrainConditions.clima?.description}
                              </span>
                              <span className="text-[0.58rem] text-gray-400">OpenWeather OneCall 3.0</span>
                            </div>
                          </div>
                          <span className="text-xl font-bold text-amber-300">
                            {terrainConditions.clima?.temperature_c} °C
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-[0.65rem]">
                          <div>
                            <span className="text-gray-400 block text-[0.58rem]">Humedad Relativa</span>
                            <span className="font-bold text-cyan-300">{terrainConditions.clima?.humidity_percent}%</span>
                          </div>
                          <div>
                            <span className="text-gray-400 block text-[0.58rem]">Lluvia (Última hora)</span>
                            <span className="font-bold text-blue-300">{terrainConditions.clima?.rain_1h_mm} mm</span>
                          </div>
                          <div>
                            <span className="text-gray-400 block text-[0.58rem]">Estado Hídrico</span>
                            <span className={`font-bold ${terrainConditions.clima?.has_rained ? 'text-emerald-400' : 'text-gray-400'}`}>
                              {terrainConditions.clima?.has_rained ? 'Húmedo (Lluvia reciente)' : 'Seco / Estable'}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-400 block text-[0.58rem]">Impacto Micelial</span>
                            <span className="font-bold text-teal-300">
                              {terrainConditions.clima?.temperature_c >= 18 && terrainConditions.clima?.temperature_c <= 28 ? 'Óptimo (18-28°C)' : 'Moderado'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* PESTAÑA: AUTÓMATA CELULAR */}
                  {activeOverlayPanel === 'automata' && (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-[0.7rem]">
                          Malla de Idoneidad Compuesta
                        </span>
                        <span className="text-[0.62rem] text-[#00ffcc] font-bold">
                          Media: {terrainConditions.metrics?.suitability_mean}
                        </span>
                      </div>

                      {terrainConditions.preview_grid && (
                        <div className="p-2 bg-black/70 rounded-xl border border-white/10 flex flex-col items-center">
                          <div className="grid grid-cols-24 gap-[1px] bg-black p-1 rounded border border-[#222]">
                            {terrainConditions.preview_grid.map((row, rIdx) =>
                              row.map((val, cIdx) => {
                                let bg = '#111';
                                if (val <= 0.02) bg = '#333333';
                                else if (val < 0.3) bg = '#3b0764';
                                else if (val < 0.5) bg = '#9a3412';
                                else if (val < 0.7) bg = '#ea580c';
                                else bg = '#00ffcc';

                                return (
                                  <div
                                    key={`${rIdx}-${cIdx}`}
                                    title={`Celda (${cIdx},${rIdx}): ${val}`}
                                    className="w-2.5 h-2.5 rounded-[1px] hover:scale-150 transition-transform cursor-pointer"
                                    style={{ backgroundColor: bg }}
                                  />
                                );
                              })
                            )}
                          </div>

                          <div className="flex items-center gap-2.5 mt-2 text-[0.58rem] text-gray-400">
                            <span className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-[1px] bg-[#333333]" />
                              <span>Obstáculo</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-[1px] bg-[#9a3412]" />
                              <span>Bajo</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-[1px] bg-[#00ffcc]" />
                              <span>Óptimo</span>
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* PESTAÑA: ELEVACIÓN TERRAIN-DEM / TERRAIN-RGB */}
                  {activeOverlayPanel === 'elevacion' && elevationData && (
                    <div className="space-y-3">
                      {/* KPIs de Relieve */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-center">
                        <div className="p-2 rounded-lg bg-black/60 border border-cyan-500/20">
                          <span className="text-[0.55rem] text-gray-400 uppercase block">Alt. Mínima</span>
                          <span className="text-sm font-bold text-cyan-300">{elevationData.min} m</span>
                        </div>
                        <div className="p-2 rounded-lg bg-black/60 border border-blue-500/20">
                          <span className="text-[0.55rem] text-gray-400 uppercase block">Alt. Máxima</span>
                          <span className="text-sm font-bold text-blue-300">{elevationData.max} m</span>
                        </div>
                        <div className="p-2 rounded-lg bg-black/60 border border-emerald-500/20">
                          <span className="text-[0.55rem] text-gray-400 uppercase block">Desnivel (Δ)</span>
                          <span className="text-sm font-bold text-emerald-300">{elevationData.diff} m</span>
                        </div>
                        <div className="p-2 rounded-lg bg-black/60 border border-amber-500/20">
                          <span className="text-[0.55rem] text-gray-400 uppercase block">Pendiente Est.</span>
                          <span className="text-sm font-bold text-amber-300">{elevationData.slope_pct}%</span>
                        </div>
                      </div>

                      {/* Análisis Dimensional del Robot (mejoras.txt) */}
                      <div className="p-2.5 bg-black/60 rounded-xl border border-white/10 space-y-2">
                        <div className="flex items-center justify-between text-[0.68rem]">
                          <span className="font-bold text-gray-200 flex items-center gap-1.5">
                            <i className="fa-solid fa-ruler-combined text-cyan-400" />
                            <span>Escalamiento por Hectáreas & Robot (1m)</span>
                          </span>
                          <span className="text-cyan-300 font-bold">
                            {elevationData.hectareas} ha (≈{elevationData.area_m2.toLocaleString()} m²)
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[0.62rem] text-gray-400">
                          <div>Lado estimado: <b className="text-white">{Math.round(Math.sqrt(elevationData.area_m2))} m</b></div>
                          <div>Paso por nodo: <b className="text-white">{elevationData.espaciado_metros} m/celda</b></div>
                          <div>Malla base: <b className="text-white">{elevationData.dimensions.width}×{elevationData.dimensions.height}</b></div>
                          <div>Resolución óptima: <b className="text-cyan-300">{Math.ceil(Math.sqrt(elevationData.area_m2))}×{Math.ceil(Math.sqrt(elevationData.area_m2))}</b></div>
                        </div>

                        {/* Botones de Escala / Interpolación SciPy */}
                        <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-1.5">
                          <span className="text-[0.6rem] text-gray-400 font-bold">
                            Interpolación SciPy (mejoras.txt):
                          </span>
                          <div className="flex items-center gap-1">
                            {[1, 2, 4].map((scale) => (
                              <button
                                key={scale}
                                type="button"
                                disabled={calculatingElevation}
                                onClick={async () => {
                                  if (scale === 1) {
                                    handleCalcularElevacion(1);
                                  } else {
                                    // Invocar endpoint /api/escalar-dem de Flask
                                    setCalculatingElevation(true);
                                    try {
                                      const res = await apiService.escalarDEM({
                                        matriz_dem: elevationData.matrix_2d,
                                        hectareas: elevationData.hectareas,
                                        espaciado_robot_metros: 1.0,
                                        factor_escala: scale,
                                        metodo: 'cubic',
                                      });
                                      if (res && res.success) {
                                        setElevationData((prev) => ({
                                          ...prev,
                                          scale_factor: scale,
                                          interpolated_matrix_2d: res.matriz_interpolada_2d,
                                          interpolated_dimensions: {
                                            width: res.interpolacion.dimensiones_interpoladas.columnas,
                                            height: res.interpolacion.dimensiones_interpoladas.filas,
                                          },
                                          min: res.metricas.min_m,
                                          max: res.metricas.max_m,
                                          avg: res.metricas.avg_m,
                                          diff: res.metricas.desnivel_m,
                                          slope_pct: res.metricas.pendiente_media_pct,
                                        }));
                                      }
                                    } catch (err) {
                                      console.error(err);
                                      // Fallback local
                                      handleCalcularElevacion(scale);
                                    } finally {
                                      setCalculatingElevation(false);
                                    }
                                  }
                                }}
                                className={`px-2 py-0.5 rounded text-[0.62rem] font-bold border transition-colors ${
                                  (elevationData.scale_factor || 1) === scale
                                    ? 'bg-cyan-500 text-black border-cyan-400'
                                    : 'bg-white/5 hover:bg-white/10 text-gray-300 border-white/10'
                                }`}
                              >
                                {scale === 1 ? '16×16 (Base)' : `${scale}x (${elevationData.dimensions.width * scale}²) `}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Visualización de la Matriz / Array 2D */}
                      <div className="p-2.5 bg-black/70 rounded-xl border border-white/10 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-bold text-white text-[0.7rem] block">
                              Malla DEM {elevationData.scale_factor > 1 ? `Interpolada Cúbica (${elevationData.interpolated_dimensions?.width}×${elevationData.interpolated_dimensions?.height})` : `Base (${elevationData.dimensions.width}×${elevationData.dimensions.height})`}
                            </span>
                            <span className="text-[0.58rem] text-gray-400">
                              {elevationData.scale_factor > 1 ? 'Suavizado SciPy griddata (cúbico)' : 'Muestreo Mapbox Terrain-RGB (16x16)'}
                            </span>
                          </div>
                          <span className="text-[0.6rem] text-cyan-400 font-bold">
                            Promedio: {elevationData.avg} m
                          </span>
                        </div>

                        {/* Grid de píxeles DEM con Colormap topográfico */}
                        <div className="flex flex-col items-center pt-1">
                          {/* Renderizar matriz interpolada o base */}
                          {(() => {
                            const matrixToRender = elevationData.scale_factor > 1 && elevationData.interpolated_matrix_2d
                              ? elevationData.interpolated_matrix_2d
                              : elevationData.matrix_2d;
                            const cols = matrixToRender[0]?.length || 16;
                            const range = Math.max(0.1, elevationData.max - elevationData.min);

                            return (
                              <div
                                className="grid gap-[1px] bg-black p-1 rounded border border-[#222]"
                                style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                              >
                                {matrixToRender.map((row, rIdx) =>
                                  row.map((val, cIdx) => {
                                    const ratio = Math.max(0, Math.min(1, (val - elevationData.min) / range));
                                    let bg = '#064e3b';
                                    if (ratio < 0.25) bg = '#047857';
                                    else if (ratio < 0.5) bg = '#d97706';
                                    else if (ratio < 0.75) bg = '#ea580c';
                                    else bg = '#e11d48';

                                    return (
                                      <div
                                        key={`${rIdx}-${cIdx}`}
                                        title={`[X:${cIdx}, Y:${rIdx}] Elevación: ${val}m`}
                                        className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-[1px] hover:scale-150 transition-transform cursor-pointer border border-black/30"
                                        style={{ backgroundColor: bg }}
                                      />
                                    );
                                  })
                                )}
                              </div>
                            );
                          })()}

                          <div className="flex items-center gap-3 mt-2 text-[0.58rem] text-gray-400">
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-[1px] bg-[#047857]" />
                              <span>{elevationData.min}m (Bajo)</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-[1px] bg-[#d97706]" />
                              <span>Medio</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-[1px] bg-[#e11d48]" />
                              <span>{elevationData.max}m (Alto)</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Representación Cruda del Array Numérico 2D */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[0.62rem] text-gray-400 uppercase font-bold flex items-center gap-1">
                            <i className="fa-solid fa-code text-cyan-400" />
                            <span>Array 2D de Elevación {elevationData.scale_factor > 1 ? `Interpolado (${elevationData.interpolated_dimensions?.width}²) ` : '(Metros)'}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const activeArr = elevationData.scale_factor > 1 && elevationData.interpolated_matrix_2d
                                ? elevationData.interpolated_matrix_2d
                                : elevationData.matrix_2d;
                              navigator.clipboard.writeText(JSON.stringify(activeArr));
                              alert('Matriz de elevación copiada al portapapeles.');
                            }}
                            className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-cyan-300 text-[0.58rem] border border-white/10 flex items-center gap-1"
                          >
                            <i className="fa-solid fa-copy text-[0.55rem]" />
                            <span>Copiar Array</span>
                          </button>
                        </div>
                        <div className="p-2 rounded-lg bg-black/90 border border-white/10 font-mono text-[0.6rem] text-cyan-200 max-h-36 overflow-y-auto leading-relaxed select-all">
                          <pre className="whitespace-pre-wrap">
                            {JSON.stringify(
                              elevationData.scale_factor > 1 && elevationData.interpolated_matrix_2d
                                ? elevationData.interpolated_matrix_2d
                                : elevationData.matrix_2d,
                              null,
                              1
                            )}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* PESTAÑA: RUTAS Y CLUSTERS POR ROVER (MEJORAS.TXT) */}
                  {activeOverlayPanel === 'rutas' && routesMissionData && (
                    <div className="space-y-3 font-mono">
                      {/* Resumen Global Misión */}
                      <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-950/40 via-black to-black border border-amber-500/30 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[0.68rem] font-bold text-amber-300 uppercase flex items-center gap-1.5">
                            <i className="fa-solid fa-flag-checkered" />
                            <span>Misión Multi-Rover ({routesMissionData.resumen_mision.total_rovers} Rovers)</span>
                          </span>
                          <span className="text-[0.62rem] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                            {routesMissionData.resumen_mision.total_puntos_medicion} Puntos Totales
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
                          <div className="p-1.5 bg-black/60 rounded-lg border border-white/5">
                            <span className="text-[0.55rem] text-gray-400 block uppercase">Distancia Flota</span>
                            <span className="font-bold text-white text-[0.75rem]">
                              {routesMissionData.resumen_mision.distancia_total_flota_m} m
                            </span>
                          </div>
                          <div className="p-1.5 bg-black/60 rounded-lg border border-white/5">
                            <span className="text-[0.55rem] text-gray-400 block uppercase">Tiempo Estimado</span>
                            <span className="font-bold text-amber-300 text-[0.75rem]">
                              {routesMissionData.resumen_mision.tiempo_estimado_flota_min} min
                            </span>
                          </div>
                          <div className="p-1.5 bg-black/60 rounded-lg border border-white/5">
                            <span className="text-[0.55rem] text-gray-400 block uppercase">Energía Flota</span>
                            <span className="font-bold text-emerald-400 text-[0.75rem]">
                              {routesMissionData.resumen_mision.energia_total_flota_wh} Wh
                            </span>
                            <span className="text-[0.5rem] text-gray-500 block">
                              {routesMissionData.resumen_mision.energia_total_flota_j} J
                            </span>
                          </div>
                        </div>

                        {/* Zonas de Elevación (mejoras.txt líneas 3-6) */}
                        <div className="p-2 bg-black/60 rounded-lg border border-white/5 space-y-1">
                          <span className="text-[0.58rem] text-gray-400 uppercase font-bold block">
                            Zonas de Muestreo por Cota DEM:
                          </span>
                          <div className="grid grid-cols-3 gap-1 text-[0.58rem]">
                            <div className="p-1 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300">
                              <span className="block font-bold">🔴 Alta</span>
                              <span>{routesMissionData.resumen_mision.zonas_elevacion?.zona_alta_m[0]}m - {routesMissionData.resumen_mision.zonas_elevacion?.zona_alta_m[1]}m</span>
                            </div>
                            <div className="p-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300">
                              <span className="block font-bold">🟠 Media</span>
                              <span>{routesMissionData.resumen_mision.zonas_elevacion?.zona_media_m[0]}m - {routesMissionData.resumen_mision.zonas_elevacion?.zona_media_m[1]}m</span>
                            </div>
                            <div className="p-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                              <span className="block font-bold">🟢 Baja</span>
                              <span>{routesMissionData.resumen_mision.zonas_elevacion?.zona_baja_m[0]}m - {routesMissionData.resumen_mision.zonas_elevacion?.zona_baja_m[1]}m</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Selector de Rover Activo */}
                      <div className="space-y-1.5">
                        <span className="text-[0.62rem] text-gray-400 uppercase font-bold block">
                          Seleccionar Rover para Inspeccionar Ruta:
                        </span>
                        <div className="grid grid-cols-2 gap-1.5">
                          {routesMissionData.rutas_rovers.map((r) => {
                            const isSelected = selectedRoverRoute?.rover_id === r.rover_id;
                            return (
                              <button
                                key={r.rover_id}
                                type="button"
                                onClick={() => setSelectedRoverRoute(r)}
                                className={`p-2 rounded-xl border text-left transition-all flex items-center justify-between gap-1.5 ${
                                  isSelected
                                    ? 'bg-black/90 border-2 shadow-lg'
                                    : 'bg-black/40 border-white/10 hover:border-white/30'
                                }`}
                                style={{ borderColor: isSelected ? r.color : undefined }}
                              >
                                <div className="truncate">
                                  <div className="flex items-center gap-1.5 truncate">
                                    <span
                                      className="w-2.5 h-2.5 rounded-full shrink-0"
                                      style={{ backgroundColor: r.color }}
                                    />
                                    <span className="font-bold text-white text-[0.68rem] truncate">
                                      {r.rover_nombre}
                                    </span>
                                  </div>
                                  <span className="text-[0.55rem] text-gray-400 block mt-0.5">
                                    {r.metricas?.distancia_total_m}m • {r.metricas?.puntos_medicion_count} puntos
                                  </span>
                                </div>
                                <span
                                  className="text-[0.58rem] px-1.5 py-0.5 rounded font-bold shrink-0"
                                  style={{ backgroundColor: `${r.color}22`, color: r.color }}
                                >
                                  {r.metricas?.tiempo_total_min}m
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Detalles del Rover Seleccionado */}
                      {selectedRoverRoute && (
                        <div
                          className="p-3 bg-black/80 rounded-xl border space-y-2.5 shadow-xl"
                          style={{ borderColor: `${selectedRoverRoute.color}55` }}
                        >
                          <div className="flex items-center justify-between border-b border-white/10 pb-2">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-black text-xs"
                                style={{ backgroundColor: selectedRoverRoute.color }}
                              >
                                <i className="fa-solid fa-robot" />
                              </div>
                              <div>
                                <h4 className="font-bold text-white text-xs">
                                  {selectedRoverRoute.rover_nombre}
                                </h4>
                                <span className="text-[0.58rem] text-gray-400 block">
                                  {selectedRoverRoute.modelo} • Modo {selectedRoverRoute.modo}
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                if (mapRef.current && selectedRoverRoute.punto_inicio) {
                                  mapRef.current.flyTo({
                                    center: [selectedRoverRoute.punto_inicio.lng, selectedRoverRoute.punto_inicio.lat],
                                    zoom: 15.5,
                                  });
                                }
                              }}
                              className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white text-[0.62rem] font-bold border border-white/10 flex items-center gap-1"
                            >
                              <i className="fa-solid fa-location-arrow text-[0.6rem]" />
                              <span>Centrar</span>
                            </button>
                          </div>

                          {/* Métricas Físicas del Tramo Completo (mejoras.txt) */}
                          <div className="grid grid-cols-2 gap-1.5 text-center text-[0.62rem]">
                            <div className="p-1.5 bg-black/60 rounded-lg border border-white/5">
                              <span className="text-[0.55rem] text-gray-400 block uppercase">Gasto Batería</span>
                              <span className="font-bold text-amber-300">
                                ~{selectedRoverRoute.metricas?.bateria_estimada_gasto_pct}%
                              </span>
                              <span className="text-[0.5rem] text-gray-500 block">
                                {selectedRoverRoute.metricas?.energia_total_j} Joules
                              </span>
                            </div>

                            <div className="p-1.5 bg-black/60 rounded-lg border border-white/5">
                              <span className="text-[0.55rem] text-gray-400 block uppercase">Pendiente Máx</span>
                              <span
                                className={`font-bold ${
                                  selectedRoverRoute.metricas?.factible ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {selectedRoverRoute.metricas?.pendiente_max_deg}°
                              </span>
                              <span className="text-[0.5rem] text-gray-500 block">
                                {selectedRoverRoute.metricas?.factible ? '✓ Seguro (<25°)' : '⚠ Alerta Volcadura'}
                              </span>
                            </div>
                          </div>

                          {/* Tabla de Waypoints secuenciales con Coordenadas Lat/Lng */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[0.6rem] text-gray-400 uppercase font-bold">
                                Paradas de Medición ({selectedRoverRoute.waypoints?.length || 0}):
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(JSON.stringify(selectedRoverRoute.waypoints, null, 2));
                                  alert('Waypoints del rover copiados al portapapeles.');
                                }}
                                className="text-[0.58rem] text-amber-400 hover:underline flex items-center gap-1"
                              >
                                <i className="fa-solid fa-copy text-[0.55rem]" />
                                <span>Copiar JSON</span>
                              </button>
                            </div>

                            <div className="max-h-44 overflow-y-auto space-y-1 pr-1 font-mono text-[0.62rem]">
                              {selectedRoverRoute.waypoints?.map((wp) => (
                                <div
                                  key={wp.indice}
                                  onClick={() => {
                                    if (mapRef.current) {
                                      mapRef.current.flyTo({ center: [wp.lng, wp.lat], zoom: 16 });
                                    }
                                  }}
                                  className="p-1.5 rounded-lg bg-black/50 border border-white/5 hover:border-amber-400/50 hover:bg-white/5 cursor-pointer flex items-center justify-between gap-1.5 transition-all"
                                >
                                  <div className="flex items-center gap-1.5 truncate">
                                    <span
                                      className="w-4 h-4 rounded-full flex items-center justify-center font-bold text-[0.55rem] text-black shrink-0"
                                      style={{ backgroundColor: selectedRoverRoute.color }}
                                    >
                                      {wp.indice}
                                    </span>
                                    <div className="truncate">
                                      <div className="flex items-center gap-1">
                                        <span className="font-bold text-white">
                                          {wp.tipo === 'inicio' ? 'Base / Inicio' : `Punto #${wp.indice}`}
                                        </span>
                                        <span
                                          className={`text-[0.5rem] px-1 rounded font-bold uppercase ${
                                            wp.zona === 'alta'
                                              ? 'bg-rose-500/20 text-rose-300'
                                              : wp.zona === 'baja'
                                              ? 'bg-emerald-500/20 text-emerald-300'
                                              : 'bg-amber-500/20 text-amber-300'
                                          }`}
                                        >
                                          {wp.zona}
                                        </span>
                                      </div>
                                      <span className="text-[0.55rem] text-gray-400 block">
                                        [{wp.lat.toFixed(5)}, {wp.lng.toFixed(5)}] • {wp.elevacion_m}m
                                      </span>
                                    </div>
                                  </div>

                                  <div className="text-right shrink-0">
                                    <span className="text-gray-300 text-[0.58rem] block font-bold">
                                      {wp.distancia_tramo_m > 0 ? `+${wp.distancia_tramo_m}m` : '0m'}
                                    </span>
                                    <span className="text-gray-500 text-[0.52rem] block">
                                      {wp.energia_tramo_j > 0 ? `~${wp.energia_tramo_j}J` : '--'}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

      

        {/* ─── MODAL: SELECCIONAR ROVER DE LA BD PARA PUNTO DE INICIO ─── */}
        {robotModalOpen && pendingScanPoint && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in font-mono">
            <div className="bg-[#121212] border border-amber-500/40 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
              {/* Header Modal */}
              <div className="p-4 bg-gradient-to-r from-amber-950/60 via-black to-black border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
                    <i className="fa-solid fa-robot text-base" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white tracking-wide">
                      Asignar Rover a Punto de Inicio
                    </h2>
                    <p className="text-[0.68rem] text-amber-300/80">
                      Coordenadas: [{pendingScanPoint.lat.toFixed(5)}, {pendingScanPoint.lng.toFixed(5)}]
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCancelarRoverPunto}
                  className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors"
                >
                  <i className="fa-solid fa-xmark text-xs" />
                </button>
              </div>

              {/* Lista de Rovers disponibles en la BD */}
              <div className="p-4 overflow-y-auto space-y-2.5 flex-1">
                <p className="text-xs text-gray-300">
                  Selecciona cuál unidad de tu flota de la Base de Datos comenzará su recorrido de exploración desde estas coordenadas:
                </p>

                {loadingRobots ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-2 text-gray-400">
                    <i className="fa-solid fa-spinner animate-spin text-amber-400 text-xl" />
                    <span className="text-xs">Cargando flota desde la base de datos...</span>
                  </div>
                ) : availableRobots.length === 0 ? (
                  <div className="p-4 rounded-xl bg-black/50 border border-white/10 text-center space-y-3">
                    <i className="fa-solid fa-triangle-exclamation text-amber-400 text-2xl" />
                    <p className="text-xs text-gray-400">
                      No hay robots registrados actualmente en la base de datos.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleConfirmarRoverPunto(null)}
                      className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-300 text-xs font-bold"
                    >
                      Continuar sin Rover asignado
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {availableRobots.map((robot) => {
                      const isYaAsignado = scanStartPoints.some((p) => p.robot_id === robot.id);
                      return (
                        <div
                          key={robot.id}
                          onClick={() => handleConfirmarRoverPunto(robot)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 group ${
                            isYaAsignado
                              ? 'bg-amber-500/5 border-amber-500/40 hover:border-amber-400'
                              : 'bg-black/50 border-white/10 hover:border-amber-400/70 hover:bg-white/5'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-black/80 border border-white/15 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
                              <i className="fa-solid fa-robot text-base" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-xs">
                                  {robot.nombre}
                                </span>
                                <span
                                  className={`text-[0.6rem] px-2 py-0.5 rounded-full font-bold uppercase ${
                                    robot.modo === 'inyeccion'
                                      ? 'bg-[#ff4500]/20 text-[#ff4500] border border-[#ff4500]/30'
                                      : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                                  }`}
                                >
                                  {robot.modo === 'inyeccion' ? 'Inyección' : 'Lectura'}
                                </span>
                                {isYaAsignado && (
                                  <span className="text-[0.58rem] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    En otro punto
                                  </span>
                                )}
                              </div>
                              <div className="text-[0.68rem] text-gray-400 flex items-center gap-3 mt-0.5">
                                <span>{robot.modelo || 'Myco Rover'}</span>
                                <span>• SN: {robot.numero_serie || `SN-${robot.id}`}</span>
                                {robot.bateria !== undefined && robot.bateria !== null && (
                                  <span className="text-emerald-400 flex items-center gap-1">
                                    <i className="fa-solid fa-battery-three-quarters text-[0.6rem]" />
                                    {robot.bateria}%
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            className="px-3 py-1.5 rounded-lg bg-amber-500/15 group-hover:bg-amber-500 text-amber-300 group-hover:text-black border border-amber-400/40 text-[0.7rem] font-bold transition-all shrink-0 flex items-center gap-1.5 shadow"
                          >
                            <span>Elegir</span>
                            <i className="fa-solid fa-check text-[0.65rem]" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer Modal */}
              <div className="p-3 bg-black/60 border-t border-white/10 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={handleCancelarRoverPunto}
                  className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmarRoverPunto(null)}
                  className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-amber-300 border border-amber-500/30 transition-colors"
                >
                  Punto Genérico (Sin Rover)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
