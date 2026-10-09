import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import * as turf from '@turf/turf';
import { apiService } from '../services/api';

/* ─── Interfaces TypeScript ─── */
interface MarsPreset {
  label: string;
  sublabel: string;
  lat: number;
  lon: number;
  m2: number;
  desc: string;
  wifi: string;
  molaAlt: number; // Elevación MOLA estimada en metros
  perchlorates: string; // Nivel estimado de percloratos
}

interface MarsFormData {
  nombre: string;
  descripcion: string;
  entorno: 'marte';
  latitud_central: number;
  longitud_central: number;
  dimensiones_m2: number;
  red_wifi_ssid: string;
  red_wifi_pass: string;
  red_wifi_status: 'activa' | 'inactiva' | 'en_mantenimiento';
}

interface RobotEntity {
  id: number;
  nombre: string;
  modelo: string;
  numero_serie?: string;
  estado?: string;
  modo: 'inyeccion' | 'lectura' | 'muestreo' | string;
  bateria?: number;
  terreno_id?: number | null;
  latitud_marte?: number | null;
  longitud_marte?: number | null;
}

interface AssignedRover {
  id: string;
  robot_id: number | null;
  robot_nombre: string;
  robot_modelo: string;
  robot_modo: 'inyeccion' | 'lectura' | 'muestreo';
  robot_bateria: number;
  lat: number;
  lng: number;
  sector_nombre: string;
  timestamp: string;
}

interface TileProviderInfo {
  id: string;
  name: string;
  shortName: string;
  category: 'NASA Mars Trek' | 'USGS Astrogeology';
  url: string;
  description: string;
  resolution: string;
  protocol: 'WMTS / XYZ' | 'WMS 1.3.0';
  attribution: string;
  sampleTileUrl: string;
}

interface CartographyLayerOption {
  id: string;
  nombre: string;
  tipo: 'DEM' | 'Ortofoto' | 'Espectral' | 'Térmico';
  resolucion: string;
  mision: string;
  descripcion: string;
  activo: boolean;
}

/* ─── Presets Oficiales de Exploración Marciana ─── */
const MARS_PRESETS: MarsPreset[] = [
  {
    label: 'Cráter Jezero — Delta Neretva',
    sublabel: 'Delta lacustre con arcillas y esmectitas ricas en percloratos (Perseverance site)',
    lat: 18.3800,
    lon: 77.5800,
    m2: 50000,
    desc: 'Sector con sedimentos lacustres arcillosos óptimos para biorremediación micótica xerotolerante.',
    wifi: 'NASA-Jezero-Mesh-Perseverance',
    molaAlt: -2500,
    perchlorates: 'Alto (0.8% peso)',
  },
  {
    label: 'Cráter Gale — Monte Sharp',
    sublabel: 'Estratos de sulfatos y filosilicatos en la base de Aeolis Mons (Curiosity site)',
    lat: -4.5895,
    lon: 137.4417,
    m2: 65000,
    desc: 'Zona de transición sulfato-arcilla con gradientes pronunciados y regolito erosionado.',
    wifi: 'NASA-Gale-Mesh-Curiosity',
    molaAlt: -4450,
    perchlorates: 'Medio (0.5% peso)',
  },
  {
    label: 'Valles Marineris — Noctis Labyrinthus',
    sublabel: 'Cañones tectónicos protegidos de la radiación con alta presión barométrica',
    lat: -6.5000,
    lon: -101.2000,
    m2: 85000,
    desc: 'Depresiones profundas con menor exposición a radiación UV y microclimas estacionales.',
    wifi: 'Marineris-DeepRelay-Mesh',
    molaAlt: -1200,
    perchlorates: 'Moderado (0.4% peso)',
  },
  {
    label: 'Meridiani Planum — Hematite Plains',
    sublabel: 'Planicie de esférulas de hematita ("blueberries") y sulfato de hierro (Opportunity site)',
    lat: -1.9462,
    lon: -5.5266,
    m2: 40000,
    desc: 'Terreno llano con alta presencia de óxidos de hierro y depósitos evaporíticos.',
    wifi: 'Meridiani-Orbiter-Mesh',
    molaAlt: -1400,
    perchlorates: 'Medio-Bajo (0.3% peso)',
  },
  {
    label: 'Arcadia Planitia — Ice Reservoir',
    sublabel: 'Vastas llanuras volcánicas con hielo de agua somero a menos de 1 metro',
    lat: 39.3000,
    lon: -171.0000,
    m2: 55000,
    desc: 'Reservorio de agua sólida subterránea prioritario para soporte vital y desarrollo de hifas.',
    wifi: 'Arcadia-IceRelay-5G',
    molaAlt: -3900,
    perchlorates: 'Bajo (0.2% peso)',
  },
  {
    label: 'Elysium Planitia — InSight Geosector',
    sublabel: 'Planicie basáltica lisa ecuatorial con actividad sísmica y térmica monitoreada',
    lat: 4.5024,
    lon: 135.6234,
    m2: 35000,
    desc: 'Llanura volcánica homogénea idónea para despliegue rápido de módulos y rovers de oruga.',
    wifi: 'Elysium-Base-Mesh-InSight',
    molaAlt: -2600,
    perchlorates: 'Medio (0.4% peso)',
  },
];

/* ─── Catálogo de Proveedores de Teselas Marcianas de NASA Mars Trek (WMTS / WMS) ─── */
const TILE_PROVIDERS: TileProviderInfo[] = [
  {
    id: 'nasa-viking-mdim',
    name: 'NASA Mars Trek — Viking MDIM 2.1 (Color 232m)',
    shortName: 'Viking Color (232m)',
    category: 'NASA Mars Trek',
    url: 'https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/{z}/{y}/{x}.jpg',
    description: 'Mosaico global a color calibrado por NASA Mars Trek y USGS Astrogeology.',
    resolution: '232 m/pixel global',
    protocol: 'WMTS / XYZ',
    attribution: '© NASA Mars Trek / Viking MDIM 2.1',
    sampleTileUrl: 'https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/2/1/1.jpg',
  },
  {
    id: 'nasa-mola-shade',
    name: 'NASA MOLA — Relieve Sombreado y Topografía (463m)',
    shortName: 'MOLA Altimetría (463m)',
    category: 'NASA Mars Trek',
    url: 'https://trek.nasa.gov/tiles/Mars/EQ/Mars_MOLA_ClrShade_global_463m/1.0.0/default/default028mm/{z}/{y}/{x}.jpg',
    description: 'Modelo Digital de Elevación MOLA coloreado con relieve sombreado.',
    resolution: '463 m/pixel altimetría',
    protocol: 'WMTS / XYZ',
    attribution: '© NASA Goddard / MGS MOLA Altimeter',
    sampleTileUrl: 'https://trek.nasa.gov/tiles/Mars/EQ/Mars_MOLA_ClrShade_global_463m/1.0.0/default/default028mm/2/1/1.jpg',
  },
  {
    id: 'nasa-themis-ir',
    name: 'NASA THEMIS — Inercia Térmica Infrarroja Día (100m)',
    shortName: 'THEMIS Térmico (100m)',
    category: 'NASA Mars Trek',
    url: 'https://trek.nasa.gov/tiles/Mars/EQ/Mars_MO_THEMIS-IR-Day_mosaic_global_100m_v2/1.0.0/default/default028mm/{z}/{y}/{x}.jpg',
    description: 'Imágenes infrarrojas diurnas THEMIS de Mars Odyssey para mapeo de regolito.',
    resolution: '100 m/pixel',
    protocol: 'WMTS / XYZ',
    attribution: '© NASA / ASU / 2001 Mars Odyssey',
    sampleTileUrl: 'https://trek.nasa.gov/tiles/Mars/EQ/Mars_MO_THEMIS-IR-Day_mosaic_global_100m_v2/1.0.0/default/default028mm/2/1/1.jpg',
  },
  {
    id: 'usgs-mola-elevation',
    name: 'USGS Astrogeology — Mars Topographic Global WMS',
    shortName: 'USGS Topo WMS',
    category: 'USGS Astrogeology',
    url: 'https://planetarymaps.usgs.gov/cgi-bin/mapserv?map=/maps/mars/mars_mola_pds.map',
    description: 'Servicio estándar OGC WMS de la USGS para software SIG y cálculo de pendientes marcianas.',
    resolution: '128 píxeles/grado',
    protocol: 'WMS 1.3.0',
    attribution: '© USGS Astrogeology Planetary Team',
    sampleTileUrl: 'https://trek.nasa.gov/tiles/Mars/EQ/Mars_MOLA_ClrShade_global_463m/1.0.0/default/default028mm/1/0/0.jpg',
  },
];

export default function CrearTerrenoMarsView() {
  const navigate = useNavigate();

  // ─── Referencias del Mapa Leaflet ───
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const polygonLayerRef = useRef<L.Polygon | null>(null);
  const vertexMarkersRef = useRef<L.Marker[]>([]);
  const roverMarkersRef = useRef<L.Marker[]>([]);
  const routeLayersRef = useRef<L.Layer[]>([]);

  // ─── Estados del Formulario (Mismo formulario que CrearTerrenoView) ───
  const [formData, setFormData] = useState<MarsFormData>({
    nombre: '',
    descripcion: '',
    entorno: 'marte',
    latitud_central: 0.0000,
    longitud_central: 0.0000,
    dimensiones_m2: 25000,
    red_wifi_ssid: 'Starlink-Mars-Mesh',
    red_wifi_pass: '',
    red_wifi_status: 'activa',
  });

  // Vértices de la parcela marciana: array de [lng, lat]
  const [vertices, setVertices] = useState<[number, number][]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [cursorCoords, setCursorCoords] = useState<{ lat: string; lng: string } | null>(null);

  // Capa activa de teselas en el mapa
  const [activeTileProvider, setActiveTileProvider] = useState<TileProviderInfo>(TILE_PROVIDERS[0]);

  // Modo de clic en el mapa: 'polygon' (agregar vértices) o 'rover_place' (posicionar rover)
  const [mapClickMode, setMapClickMode] = useState<'polygon' | 'rover_place'>('polygon');
  const mapClickModeRef = useRef<'polygon' | 'rover_place'>('polygon');
  useEffect(() => {
    mapClickModeRef.current = mapClickMode;
    // Forzar actualización de dimensiones en Leaflet tras cambio de modo o aparición de alerts
    setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, 50);
  }, [mapClickMode]);

  // ─── Estados de Asignación de Rovers (Robots) ───
  const [availableRobots, setAvailableRobots] = useState<RobotEntity[]>([]);
  const [loadingRobots, setLoadingRobots] = useState(false);
  const [assignedRovers, setAssignedRovers] = useState<AssignedRover[]>([]);
  const [roverModalOpen, setRoverModalOpen] = useState(false);
  const [pendingRoverCoord, setPendingRoverCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedPresetIndex, setSelectedPresetIndex] = useState<number | null>(null);

  // ─── Estados de Elevación Topográfica DEM MOLA e Interpolación SciPy ───
  const [elevationData, setElevationData] = useState<any>(null);
  const [calculatingElevation, setCalculatingElevation] = useState(false);

  // ─── Estados de Planificación de Rutas Multi-Rover e IA ───
  const [routesMissionData, setRoutesMissionData] = useState<any>(null);
  const [calculatingRoutes, setCalculatingRoutes] = useState(false);
  const [selectedRoverRoute, setSelectedRoverRoute] = useState<any>(null);

  // ─── Estados de Cartografía y Exportación (DEMs & Ortofotos) ───
  const [cartographyLayers, setCartographyLayers] = useState<CartographyLayerOption[]>([
    {
      id: 'mola_dem',
      nombre: 'MOLA DEM (Digital Elevation Model)',
      tipo: 'DEM',
      resolucion: '30m - 128m/px',
      mision: 'NASA Mars Global Surveyor',
      descripcion: 'Matriz altimétrica raster con elevación absoluta en metros sobre el datum aerográfico.',
      activo: true,
    },
    {
      id: 'hirise_ortho',
      nombre: 'HiRISE Ultra-HD Orthomosaic',
      tipo: 'Ortofoto',
      resolucion: '0.25m - 0.5m/px',
      mision: 'NASA Mars Reconnaissance Orbiter',
      descripcion: 'Ortofotografía fotogramétrica calibrada para detección de rocas, pendientes y grietas.',
      activo: true,
    },
    {
      id: 'ctx_context',
      nombre: 'CTX Context Camera Mosaic',
      tipo: 'Ortofoto',
      resolucion: '6m/px',
      mision: 'NASA MRO CTX',
      descripcion: 'Cobertura regional de contexto para análisis geológico y morfológico.',
      activo: false,
    },
    {
      id: 'crism_mineral',
      nombre: 'CRISM Perchlorate & Mineral Map',
      tipo: 'Espectral',
      resolucion: '18m/px',
      mision: 'NASA MRO CRISM',
      descripcion: 'Bandas espectrales de sulfatos, carbonatos, óxidos de hierro y percloratos de magnesio.',
      activo: true,
    },
    {
      id: 'themis_thermal',
      nombre: 'THEMIS Thermal Inertia Night/Day',
      tipo: 'Térmico',
      resolucion: '100m/px',
      mision: 'NASA Mars Odyssey',
      descripcion: 'Inercia térmica para estimación del tamaño de grano del regolito marciano.',
      activo: false,
    },
  ]);

  const [exportFormat, setExportFormat] = useState<'geotiff' | 'png16' | 'mesh3d' | 'geojson_manifest'>('geotiff');
  const [exportMode, setExportMode] = useState<'manual' | 'batch'>('manual');
  const [batchGridSize, setBatchGridSize] = useState<number>(4);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // ─── Estados de Verificación de Conectividad de Teselas ───
  const [testingTileConnectivity, setTestingTileConnectivity] = useState(false);
  const [tileTestStatus, setTileTestStatus] = useState<{ ok: boolean; latency: number; msg: string } | null>(null);

  // ─── Estados de Cálculo de Condiciones con IA Flask & Base de Datos MCD (LMD) ───
  const [calculatingConditions, setCalculatingConditions] = useState(false);
  const [marsConditionsData, setMarsConditionsData] = useState<any>(null);
  const [calculatingMcdClimate, setCalculatingMcdClimate] = useState(false);
  const [mcdClimateData, setMcdClimateData] = useState<any>(null);
  // Paneles Flotantes sobre el Mapa (Clima MCD, Regolito, Biorremediación, Elevación DEM, Rutas IA)
  const [activeOverlayPanel, setActiveOverlayPanel] = useState<'clima' | 'regolito' | 'biorremediacion' | 'elevacion' | 'rutas' | 'cerrado'>('clima');

  // ─── Estado inicial sin preset seleccionado ───
  // Los vértices y datos de parcela se generan al hacer clic en un preset o al trazar en el mapa

  // ─── Cargar robots de la BD al montar el componente ───
  useEffect(() => {
    async function fetchRobots() {
      setLoadingRobots(true);
      try {
        const data = await apiService.getRobots();
        if (Array.isArray(data)) {
          setAvailableRobots(data);
        }
      } catch (err) {
        console.warn('No se pudieron precargar los robots para Marte:', err);
      } finally {
        setLoadingRobots(false);
      }
    }
    fetchRobots();
  }, []);

  // ─── Inicializar el Mapa de Marte con Leaflet y Teselas de NASA Mars Trek ───
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const container = mapContainerRef.current;

    // Si ya existe una instancia previa del mapa, removerla limpiamente primero
    if (mapRef.current) {
      try {
        mapRef.current.remove();
      } catch (e) {
        console.warn('Error limpiando instancia de Leaflet previa:', e);
      }
      mapRef.current = null;
    }

    // Asegurar que el contenedor DOM esté limpio sin IDs o nodos huérfanos
    if ('_leaflet_id' in container) {
      delete (container as any)._leaflet_id;
    }
    container.innerHTML = '';

    const initialCenter: [number, number] = [Number(formData.latitud_central) || 0, Number(formData.longitud_central) || 0];

    // Inicializar mapa Leaflet centrado en Marte con zoom global inicial
    const map = L.map(container, {
      center: initialCenter,
      zoom: selectedPresetIndex !== null ? 6 : 3,
      minZoom: 1,
      maxZoom: 10,
      zoomControl: true, // Leaflet inicializa y posiciona el control de zoom internamente
      attributionControl: false,
    });

    // Añadir capa de teselas oficial de NASA Mars Trek
    const tileLayer = L.tileLayer(activeTileProvider.url, {
      maxZoom: 9,
      noWrap: false,
      attribution: activeTileProvider.attribution,
    }).addTo(map);

    tileLayerRef.current = tileLayer;

    // Listener de coordenadas en mousemove
    map.on('mousemove', (e: L.LeafletMouseEvent) => {
      setCursorCoords({
        lat: e.latlng.lat.toFixed(5),
        lng: e.latlng.lng.toFixed(5),
      });
    });

    // Listener de clics en el mapa marciano
    map.on('click', (e: L.LeafletMouseEvent) => {
      const lat = Number(e.latlng.lat.toFixed(5));
      const lng = Number(e.latlng.lng.toFixed(5));

      if (mapClickModeRef.current === 'rover_place') {
        setPendingRoverCoord({ lat, lng });
        setRoverModalOpen(true);
      } else {
        // Modo 'polygon': Agregar vértice
        setVertices((prev) => [...prev, [lng, lat]]);
      }
    });

    mapRef.current = map;

    // Forzar ajuste de tamaño al renderizar en el DOM
    const timer = setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    }, 120);

    return () => {
      clearTimeout(timer);
      if (mapRef.current) {
        try {
          routeLayersRef.current.forEach((l) => l.remove());
          routeLayersRef.current = [];
          mapRef.current.remove();
        } catch (e) {
          // ignore
        }
        mapRef.current = null;
        tileLayerRef.current = null;
        polygonLayerRef.current = null;
        vertexMarkersRef.current = [];
        roverMarkersRef.current = [];
      }
    };
  }, []);

  // ─── Sincronizar capa de teselas cuando el usuario cambia de proveedor ───
  useEffect(() => {
    if (tileLayerRef.current && activeTileProvider) {
      tileLayerRef.current.setUrl(activeTileProvider.url);
    }
  }, [activeTileProvider]);

  // ─── Renderizar Polígono y Marcadores de Vértices en el Mapa Leaflet ───
  useEffect(() => {
    if (!mapRef.current) return;

    // Limpiar marcadores anteriores
    vertexMarkersRef.current.forEach((m) => m.remove());
    vertexMarkersRef.current = [];

    if (polygonLayerRef.current) {
      polygonLayerRef.current.remove();
      polygonLayerRef.current = null;
    }

    if (vertices.length >= 2) {
      const latLngs: [number, number][] = vertices.map(([lng, lat]) => [lat, lng]);

      // Polígono marciano coloreado en bermellón/naranja (#ff4500)
      const polygon = L.polygon(latLngs, {
        color: '#ff4500',
        weight: 2.5,
        fillColor: '#ff4500',
        fillOpacity: 0.25,
        dashArray: '5, 5',
      }).addTo(mapRef.current);

      polygonLayerRef.current = polygon;
    }

    // Calcular superficie (m2) y centroide automáticamente si hay al menos 3 vértices
    if (vertices.length >= 3) {
      try {
        const closed = [...vertices, vertices[0]];
        const polyFeature = turf.polygon([closed]);
        const areaM2 = Math.round(turf.area(polyFeature));
        const centerCoord = turf.center(polyFeature).geometry.coordinates;

        setFormData((prev) => {
          const newLng = Number(centerCoord[0].toFixed(5));
          const newLat = Number(centerCoord[1].toFixed(5));
          if (
            prev.dimensiones_m2 === areaM2 &&
            prev.longitud_central === newLng &&
            prev.latitud_central === newLat
          ) {
            return prev;
          }
          return {
            ...prev,
            dimensiones_m2: areaM2,
            longitud_central: newLng,
            latitud_central: newLat,
          };
        });
      } catch (err) {
        console.warn('Error calculando métricas Turf para polígono marciano:', err);
      }
    }

    // Dibujar marcadores circulares numerados en cada vértice
    vertices.forEach(([lng, lat], index) => {
      const vertexIcon = L.divIcon({
        className: 'mars-vertex-marker',
        html: `
          <div style="
            width: 22px;
            height: 22px;
            border-radius: 50%;
            background: rgba(18, 14, 12, 0.95);
            border: 2px solid #ff4500;
            color: #ffffff;
            font-size: 10px;
            font-weight: bold;
            font-family: monospace;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 0 10px rgba(255, 69, 0, 0.5);
            cursor: pointer;
          ">${index + 1}</div>
        `,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      const marker = L.marker([lat, lng], { icon: vertexIcon }).addTo(mapRef.current!);
      marker.bindTooltip(`Vértice #${index + 1}: [${lat}°, ${lng}°]`, { direction: 'top' });
      vertexMarkersRef.current.push(marker);
    });
  }, [vertices]);

  // ─── Renderizar Rovers asignados sobre el Mapa de Marte ───
  useEffect(() => {
    if (!mapRef.current) return;

    // Limpiar marcadores de rovers anteriores
    roverMarkersRef.current.forEach((m) => m.remove());
    roverMarkersRef.current = [];

    assignedRovers.forEach((rover, index) => {
      const isInject = rover.robot_modo === 'inyeccion';
      const roverIcon = L.divIcon({
        className: 'mars-rover-ping-marker',
        html: `
          <div style="position: relative; display: flex; align-items: center; justify-content: center; cursor: pointer;">
            <span style="position: absolute; width: 36px; height: 36px; border-radius: 50%; background: ${isInject ? 'rgba(255, 69, 0, 0.45)' : 'rgba(245, 158, 11, 0.45)'}; animation: marsRadarPulse 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
            <div style="position: relative; width: 28px; height: 28px; border-radius: 50%; background: ${isInject ? 'linear-gradient(135deg, #ea580c, #ff4500)' : 'linear-gradient(135deg, #d97706, #fbbf24)'}; border: 2px solid #ffffff; box-shadow: 0 0 12px ${isInject ? 'rgba(255, 69, 0, 0.8)' : 'rgba(245, 158, 11, 0.8)'}; display: flex; align-items: center; justify-content: center; font-size: 13px;">
              🤖
            </div>
            <div style="position: absolute; top: -23px; padding: 2px 7px; border-radius: 9999px; background: rgba(18, 14, 12, 0.95); border: 1.5px solid ${isInject ? '#ff4500' : '#f59e0b'}; color: ${isInject ? '#ff8533' : '#fbbf24'}; font-size: 9px; font-weight: bold; font-family: monospace; white-space: nowrap; box-shadow: 0 4px 10px rgba(0,0,0,0.7); display: flex; align-items: center; gap: 4px;">
              <span style="width: 5px; height: 5px; border-radius: 50%; background: #4ade80;"></span>
              <span>${rover.robot_nombre}</span>
              <span style="font-size: 7.5px; opacity: 0.8; text-transform: uppercase;">(${rover.robot_modo})</span>
            </div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const marker = L.marker([rover.lat, rover.lng], { icon: roverIcon }).addTo(mapRef.current!);

      const popupHtml = `
        <div style="font-family: monospace; font-size: 11px; color: #fff; background: #16100e; padding: 10px 12px; border-radius: 10px; border: 1px solid #f59e0b; min-width: 190px; box-shadow: 0 8px 25px rgba(0,0,0,0.7);">
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(245, 158, 11, 0.3); padding-bottom: 4px; margin-bottom: 6px;">
            <strong style="color: #fbbf24; font-size: 12px;">🤖 ${rover.robot_nombre}</strong>
            <span style="font-size: 8px; padding: 1px 5px; border-radius: 4px; background: ${isInject ? 'rgba(255, 69, 0, 0.3)' : 'rgba(56, 189, 248, 0.3)'}; color: ${isInject ? '#ff8533' : '#38bdf8'}; font-weight: bold; text-transform: uppercase;">
              ${rover.robot_modo}
            </span>
          </div>
          <div style="font-size: 9px; color: #aaa; margin-bottom: 4px;">Modelo: ${rover.robot_modelo}</div>
          <div style="font-size: 9.5px; color: #ccc; line-height: 1.4;">
            <b>Sector:</b> ${rover.sector_nombre}<br/>
            <b>Coord:</b> [${rover.lat.toFixed(5)}°, ${rover.lng.toFixed(5)}°]<br/>
            <b>Batería:</b> <span style="color: #4ade80; font-weight: bold;">${rover.robot_bateria}%</span>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);
      roverMarkersRef.current.push(marker);
    });
  }, [assignedRovers]);

  // ─── Función para generar polígono alrededor del centro ───
  function generarVerticesDesdeCentro(lon: number, lat: number, m2: number) {
    try {
      const center: [number, number] = [Number(lon), Number(lat)];
      const sideKm = Math.sqrt(m2) / 1000;
      const radiusKm = (sideKm * Math.sqrt(2)) / 2;
      const square = turf.bboxPolygon(turf.bbox(turf.circle(center, radiusKm, { units: 'kilometers' })));
      const coords = square.geometry.coordinates[0].slice(0, 4) as [number, number][];
      setVertices(coords);

      if (mapRef.current) {
        mapRef.current.flyTo([lat, lon], 7, { duration: 1.0 });
      }
    } catch (e) {
      console.error('Error calculando vértices Turf en Marte:', e);
    }
  }

  // ─── Aplicar un Preset Marciano ───
  function handleSelectPreset(p: MarsPreset, index: number) {
    setSelectedPresetIndex(index);
    setFormData((prev) => ({
      ...prev,
      nombre: `Sector ${p.label}`,
      descripcion: p.desc,
      latitud_central: p.lat,
      longitud_central: p.lon,
      dimensiones_m2: p.m2,
      red_wifi_ssid: p.wifi,
    }));
    // Generar polígono perimetral centrado en el preset
    generarVerticesDesdeCentro(p.lon, p.lat, p.m2);
  }

  // ─── Modificar coordenadas o dimensiones manualmente ───
  function handleDimensionesChange(nuevosM2: number) {
    setFormData((prev) => ({ ...prev, dimensiones_m2: nuevosM2 }));
    generarVerticesDesdeCentro(formData.longitud_central, formData.latitud_central, nuevosM2);
  }

  function handleCentroChange(newLat: number, newLon: number) {
    setFormData((prev) => ({
      ...prev,
      latitud_central: newLat,
      longitud_central: newLon,
    }));
    generarVerticesDesdeCentro(newLon, newLat, formData.dimensiones_m2);
  }

  // ─── Asignación de Rovers (Click-to-place o Centro) ───
  function handleAsignarRobot(robot: RobotEntity) {
    const yaAsignado = assignedRovers.some((r) => r.robot_id === robot.id);
    if (yaAsignado) {
      setError(`El rover ${robot.nombre} ya se encuentra asignado a esta parcela.`);
      return;
    }

    const idx = assignedRovers.length;
    // Si el usuario hizo clic en el mapa marciano, usar la coordenada exacta del clic
    const targetLat = pendingRoverCoord
      ? pendingRoverCoord.lat
      : Number((Number(formData.latitud_central) + (idx * 0.0006 - 0.0006)).toFixed(5));
    const targetLng = pendingRoverCoord
      ? pendingRoverCoord.lng
      : Number((Number(formData.longitud_central) + (idx * 0.0006 - 0.0006)).toFixed(5));

    const nuevoRover: AssignedRover = {
      id: `rover_mars_${robot.id}_${Date.now()}`,
      robot_id: robot.id,
      robot_nombre: robot.nombre,
      robot_modelo: robot.modelo || 'Myco Ares-1 Rover',
      robot_modo: (robot.modo as any) || 'inyeccion',
      robot_bateria: robot.bateria ?? 80,
      lat: targetLat,
      lng: targetLng,
      sector_nombre: `Sector Operativo Ares-${idx + 1}`,
      timestamp: new Date().toISOString(),
    };

    setAssignedRovers((prev) => [...prev, nuevoRover]);
    setPendingRoverCoord(null);
    setRoverModalOpen(false);
    setSuccessMsg(`Rover "${robot.nombre}" posicionado en coordenada [${targetLat.toFixed(4)}°, ${targetLng.toFixed(4)}°].`);
    setTimeout(() => setSuccessMsg(''), 4500);
  }

  function handleRemoverRover(id: string) {
    setAssignedRovers((prev) => prev.filter((r) => r.id !== id));
  }

  function handleCambiarModoRover(id: string, modo: 'inyeccion' | 'lectura' | 'muestreo') {
    setAssignedRovers((prev) =>
      prev.map((r) => (r.id === id ? { ...r, robot_modo: modo } : r))
    );
  }

  // ─── Limpiar capas de rutas y waypoints en Leaflet ───
  function limpiarCapasRutasEnMapa() {
    routeLayersRef.current.forEach((layer) => {
      try {
        layer.remove();
      } catch (e) {
        // ignore
      }
    });
    routeLayersRef.current = [];
  }

  // ─── Renderizar rutas y waypoints de Rovers sobre el mapa Leaflet de Marte ───
  function renderizarRutasRoversEnMapa(routesData: any) {
    if (!mapRef.current || !routesData || !routesData.rutas_rovers) return;

    limpiarCapasRutasEnMapa();

    const ROVER_PALETTE = ['#ff4500', '#f59e0b', '#00e5ff', '#10b981', '#ec4899', '#8b5cf6'];

    routesData.rutas_rovers.forEach((r: any, rIdx: number) => {
      const color = r.color || ROVER_PALETTE[rIdx % ROVER_PALETTE.length];
      const coords: [number, number][] = (r.coordenadas_ruta || []).map((pt: [number, number]) => [pt[1], pt[0]]);

      if (coords.length > 1) {
        // 1. Línea Resplandor (Glow)
        const glowLine = L.polyline(coords, {
          color,
          weight: 7,
          opacity: 0.35,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(mapRef.current!);
        routeLayersRef.current.push(glowLine);

        // 2. Línea Núcleo (Core)
        const coreLine = L.polyline(coords, {
          color,
          weight: 3.5,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(mapRef.current!);
        routeLayersRef.current.push(coreLine);
      }

      // 3. Waypoints de medición (clusters)
      (r.waypoints || []).forEach((wp: any) => {
        if (wp.tipo === 'medicion') {
          // Anillo exterior
          const ring = L.circleMarker([wp.lat, wp.lng], {
            radius: 9,
            color,
            fillColor: color,
            fillOpacity: 0.25,
            weight: 1,
          }).addTo(mapRef.current!);
          routeLayersRef.current.push(ring);

          // Núcleo central
          const coreMarker = L.circleMarker([wp.lat, wp.lng], {
            radius: 5,
            color: '#ffffff',
            fillColor: color,
            fillOpacity: 1,
            weight: 1.5,
          }).addTo(mapRef.current!);

          const popupHtml = `
            <div style="font-family: monospace; font-size: 11px; color: #fff; background: #120e0c; padding: 10px; border-radius: 8px; border: 1px solid ${color}; min-width: 190px; box-shadow: 0 10px 25px rgba(0,0,0,0.8);">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                <strong style="color:${color}; font-size:12px;">🤖 ${r.rover_nombre || 'Rover'}</strong>
                <span style="font-size:9px; background:${color}33; color:${color}; padding:1px 5px; border-radius:4px; font-weight:bold;">#${wp.indice}</span>
              </div>
              <div style="font-size:10px; color:#ccc; margin-bottom:4px; line-height: 1.4;">
                <b>Elevación MOLA:</b> ${wp.elevacion_m}m (${wp.zona?.toUpperCase()})<br/>
                <b>Coordenadas:</b> [${Number(wp.lat).toFixed(5)}°, ${Number(wp.lng).toFixed(5)}°]<br/>
                <b>Tramo:</b> +${wp.distancia_tramo_m}m | Δh: ${wp.delta_h_tramo_m}m<br/>
                <b>Gasto Energía:</b> ~${wp.energia_tramo_j} J
              </div>
              <div style="font-size:9.5px; color:#4ade80; border-top:1px solid rgba(255,255,255,0.1); padding-top:4px;">
                ✓ Parada de análisis de regolito & sensores (15s)
              </div>
            </div>
          `;

          coreMarker.bindPopup(popupHtml);
          routeLayersRef.current.push(coreMarker);
        }
      });
    });
  }

  // ─── Calcular Elevación DEM MOLA (Automático en Backend con soporte SciPy) ───
  async function handleCalcularElevacionMarte(scale = 1) {
    setError('');
    if (vertices.length < 3) {
      setError('Debes trazar al menos 3 vértices en el mapa marciano para delimitar la parcela antes de calcular el DEM.');
      return;
    }

    setCalculatingElevation(true);
    try {
      const closedCoords = [...vertices, vertices[0]].map(([lng, lat]) => [Number(lng), Number(lat)]);
      const presetAlt = selectedPresetIndex !== null ? MARS_PRESETS[selectedPresetIndex]?.molaAlt : undefined;

      // 1. Obtener Matriz Base DEM de Marte
      const resDem = await apiService.calcularDemMarte({
        poligono_coordenadas: closedCoords,
        grid_size: 16,
        preset_mola_alt: presetAlt,
      });

      if (!resDem || !resDem.success) {
        throw new Error(resDem?.error || 'No se pudo obtener el DEM marciano.');
      }

      let finalResult = {
        ...resDem,
        scale_factor: 1,
        interpolated_matrix_2d: resDem.matrix_2d,
        interpolated_dimensions: resDem.dimensions,
      };

      // 2. Si se solicitó interpolación SciPy (scale > 1)
      if (scale > 1) {
        try {
          const resEscalar = await apiService.escalarDEM({
            matriz_dem: resDem.matrix_2d,
            hectareas: resDem.hectareas,
            espaciado_robot_metros: 1.0,
            factor_escala: scale,
            metodo: 'cubic',
          });

          if (resEscalar && resEscalar.success) {
            finalResult = {
              ...finalResult,
              scale_factor: scale,
              interpolated_matrix_2d: resEscalar.matriz_interpolada_2d,
              interpolated_dimensions: {
                width: resEscalar.interpolacion.dimensiones_interpoladas.columnas,
                height: resEscalar.interpolacion.dimensiones_interpoladas.filas,
              },
              min: resEscalar.metricas.min_m,
              max: resEscalar.metricas.max_m,
              avg: resEscalar.metricas.avg_m,
              diff: resEscalar.metricas.desnivel_m,
              slope_pct: resEscalar.metricas.pendiente_media_pct,
            };
          }
        } catch (scaleErr) {
          console.warn('Interpolación cúbica SciPy falló, usando matriz DEM base:', scaleErr);
        }
      }

      setElevationData(finalResult);
      setActiveOverlayPanel('elevacion');
      setSuccessMsg(`Malla DEM MOLA (${finalResult.dimensions.width}×${finalResult.dimensions.height}) generada automáticamente para la parcela marciana.`);
      setTimeout(() => setSuccessMsg(''), 5000);
      return finalResult;
    } catch (err: any) {
      console.error(err);
      setError('Error al generar DEM marciano MOLA: ' + err.message);
      throw err;
    } finally {
      setCalculatingElevation(false);
    }
  }

  // ─── Planificar Rutas de Rovers con IA basadas en Topografía y Pendiente ───
  async function handlePlanificarRutasMarte() {
    setError('');
    if (vertices.length < 3) {
      setError('Debes trazar al menos 3 vértices en el mapa antes de planificar rutas de exploración.');
      return;
    }

    setCalculatingRoutes(true);
    try {
      const closedCoords = [...vertices, vertices[0]].map(([lng, lat]) => [Number(lng), Number(lat)]);

      // Obtener o asegurar la matriz DEM activa
      let currentDemData = elevationData;
      if (!currentDemData) {
        currentDemData = await handleCalcularElevacionMarte(1);
      }

      const activeDemMatrix = (currentDemData?.scale_factor > 1 && currentDemData?.interpolated_matrix_2d)
        ? currentDemData.interpolated_matrix_2d
        : currentDemData?.matrix_2d;

      // Armar payload de rovers para la IA
      const ROVER_PALETTE = ['#ff4500', '#f59e0b', '#00e5ff', '#10b981', '#ec4899', '#8b5cf6'];
      let roversPayload: any[] = [];

      if (assignedRovers && assignedRovers.length > 0) {
        roversPayload = assignedRovers.map((r, idx) => ({
          id: r.robot_id || idx + 1,
          nombre: r.robot_nombre || `Rover #${idx + 1}`,
          modelo: r.robot_modelo || 'Myco Ares-1 Rover',
          modo: r.robot_modo || 'lectura',
          bateria: r.robot_bateria || 85,
          punto_inicio: [r.lng, r.lat],
          color: ROVER_PALETTE[idx % ROVER_PALETTE.length],
        }));
      } else if (availableRobots && availableRobots.length > 0) {
        roversPayload = availableRobots.slice(0, 2).map((r, idx) => ({
          id: r.id,
          nombre: r.nombre,
          modelo: r.modelo,
          modo: r.modo || 'lectura',
          bateria: r.bateria || 85,
          punto_inicio: [closedCoords[idx % closedCoords.length][0], closedCoords[idx % closedCoords.length][1]],
          color: ROVER_PALETTE[idx % ROVER_PALETTE.length],
        }));
      } else {
        roversPayload = [{
          id: 1,
          nombre: 'Ares-Perseverance (Principal)',
          modelo: 'Ares-X Explorer',
          modo: 'lectura',
          bateria: 90,
          punto_inicio: closedCoords[0],
          color: '#ff4500',
        }];
      }

      const payload = {
        poligono_coordenadas: closedCoords,
        matriz_dem: activeDemMatrix,
        rovers: roversPayload,
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
        renderizarRutasRoversEnMapa(res);
        setSuccessMsg(`¡Rutas y clusters calculados con IA para ${res.resumen_mision?.total_rovers || 1} rovers en Marte!`);
        setTimeout(() => setSuccessMsg(''), 5000);
      } else {
        throw new Error(res?.error || 'No se pudieron calcular las rutas de los rovers.');
      }
    } catch (err: any) {
      console.error(err);
      setError('Error al planificar rutas de rovers en Marte: ' + err.message);
    } finally {
      setCalculatingRoutes(false);
    }
  }

  // ─── Exportación y Descarga de DEMs y Ortofotos ───
  async function handleIniciarExportacion() {
    setIsExporting(true);
    setExportProgress(10);
    setError('');

    try {
      await new Promise((r) => setTimeout(r, 400));
      setExportProgress(35);
      await new Promise((r) => setTimeout(r, 500));
      setExportProgress(70);
      await new Promise((r) => setTimeout(r, 400));
      setExportProgress(95);

      const activeLayers = cartographyLayers.filter((l) => l.activo);
      const manifestData = {
        sistema: 'M.Y.C.O Cartography Exporter - NASA Mars Trek',
        fecha_generacion: new Date().toISOString(),
        terreno: {
          nombre: formData.nombre,
          entorno: 'marte',
          coordenadas_centro: {
            latitud: formData.latitud_central,
            longitud: formData.longitud_central,
          },
          dimensiones_m2: formData.dimensiones_m2,
          poligono_vertices: vertices,
        },
        exportacion: {
          modo: exportMode,
          formato: exportFormat,
          sub_cuadrantes: exportMode === 'batch' ? `${batchGridSize}x${batchGridSize} (${batchGridSize * batchGridSize} tiles)` : '1 cuadrante único',
          capas_incluidas: activeLayers.map((l) => ({
            id: l.id,
            nombre: l.nombre,
            tipo: l.tipo,
            resolucion: l.resolucion,
            mision_origen: l.mision,
          })),
          proyeccion_cartografica: 'Equirectangular / Mars Sphere Radius 3396.19 km',
          metadatos_nasa_trek: {
            wmts_endpoint: activeTileProvider.url,
            nasa_viking_tile_matrix: 'default028mm',
            mola_datum: 'Mars Areoid (0 m elevation standard)',
          },
        },
        rovers_asignados: assignedRovers.map((r) => ({
          nombre: r.robot_nombre,
          modelo: r.robot_modelo,
          modo: r.robot_modo,
          posicion: [r.lng, r.lat],
        })),
      };

      const jsonString = JSON.stringify(manifestData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MYCO_CARTOGRAFIA_MARTE_${formData.nombre.replace(/\s+/g, '_')}_${exportFormat.toUpperCase()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportProgress(100);
      setSuccessMsg(`¡Cartografía exportada con éxito! Archivo de manifiesto y geometría generado.`);
      setTimeout(() => setSuccessMsg(''), 6000);
    } catch (err: any) {
      setError('Error al procesar la exportación cartográfica: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  }

  // ─── Consultar Clima Marciano desde la Base de Datos MCD (LMD Jussieu) ───
  async function handleConsultarClimaMarciano() {
    setError('');
    setCalculatingMcdClimate(true);
    try {
      const lat = Number(formData.latitud_central) || (vertices.length > 0 ? vertices[0][1] : 18.38);
      const lon = Number(formData.longitud_central) || (vertices.length > 0 ? vertices[0][0] : 77.58);

      const payload = {
        lat,
        lon,
        poligono_coordenadas: vertices.length >= 3 ? [...vertices, vertices[0]] : null,
        ls_deg: 120.5,
        local_hour: 14.0,
      };

      const res = await apiService.calcularClimaMarte(payload);
      const rawData = (res && res.data) ? res.data : res;

      if (rawData && (rawData.temperatura || rawData.temperatura_c !== undefined || rawData.presion_atmosferica)) {
        const tempObj = rawData.temperatura || {};
        const presObj = rawData.presion_atmosferica || {};
        const radObj = rawData.radiacion_y_atmosfera || {};
        const bioObj = rawData.biorremediacion_micelio || {};
        const coordObj = rawData.coordenadas || {};

        const normalizedData = {
          temperatura_c: tempObj.aire_sensor_c ?? rawData.temperatura_c ?? -32.1,
          temperatura_k: tempObj.aire_sensor_k ?? rawData.temperatura_k ?? 241.1,
          temperatura_suelo_c: tempObj.superficie_suelo_c ?? rawData.temperatura_suelo_c ?? -28.2,
          amplitud_termica_c: tempObj.amplitud_termica_diurna_k ?? rawData.amplitud_termica_c ?? 43.5,
          presion_pa: presObj.presion_pa ?? rawData.presion_pa ?? 573.0,
          presion_kpa: presObj.presion_kpa ?? rawData.presion_kpa ?? 0.573,
          densidad_aire_kg_m3: presObj.densidad_aire_kg_m3 ?? rawData.densidad_aire_kg_m3 ?? 0.0126,
          radiacion_uv_flux_w_m2: radObj.flujo_uv_w_m2 ?? rawData.radiacion_uv_flux_w_m2 ?? 29.6,
          uv_index: radObj.indice_uv_equivalente ?? rawData.uv_index ?? 11.9,
          velocidad_viento_m_s: radObj.velocidad_viento_m_s ?? 3.9,
          gas_predominante: radObj.gas_predominante ?? 'Dióxido de Carbono (CO2 ~95.3%)',
          ls_deg: coordObj.ls_marte_grados ?? rawData.ls_deg ?? 120.5,
          hora_local_solar: coordObj.hora_local_ltst ? `${coordObj.hora_local_ltst}:00 LTST` : (rawData.hora_local_solar || '14:00 LTST'),
          estacion_marciana: rawData.estacion_marciana || 'Verano Norte / Invierno Sur (Aphelion)',
          viabilidad_micelio: {
            cepa_recomendada: bioObj.cepa_compatible || 'Pleurotus ostreatus Ares-X (Crio-tolerante)',
            protocolo: `${bioObj.viabilidad_termica || 'Bio-aislamiento térmico requerido'} • ${bioObj.proteccion_uv_requerida || 'Pantalla UV'}`,
            indice_viabilidad_pct: 84.5,
            temperatura_viable: true,
          },
          detalles_atmosfericos: {
            viento_estimado_m_s: radObj.velocidad_viento_m_s ?? 3.9,
            composicion: radObj.gas_predominante ?? 'CO2 (95.3%)',
          },
          fuente: rawData.fuente || 'Mars Climate Database (MCD v6.2 / LMD-CNRS-Sorbonne)',
        };

        setMcdClimateData(normalizedData);
        setActiveOverlayPanel('clima');

        // Sincronizar también con marsConditionsData para compatibilidad total al guardar
        setMarsConditionsData((prev: any) => ({
          ...(prev || {}),
          success: true,
          entorno: 'marte',
          clima: {
            temperatura_media_c: normalizedData.temperatura_c,
            temperatura_k: normalizedData.temperatura_k,
            temperatura_suelo_c: normalizedData.temperatura_suelo_c,
            amplitud_termica_c: normalizedData.amplitud_termica_c,
            presion_pa: normalizedData.presion_pa,
            presion_kpa: normalizedData.presion_kpa,
            radiacion_uv_flux_w_m2: normalizedData.radiacion_uv_flux_w_m2,
            uv_index: normalizedData.uv_index,
            densidad_aire_kg_m3: normalizedData.densidad_aire_kg_m3,
            ls_deg: normalizedData.ls_deg,
            estacion_marciana: normalizedData.estacion_marciana,
            hora_local_solar: normalizedData.hora_local_solar,
            humedad_relativa_pct: 0.03,
          },
          soil_summary: prev?.soil_summary || {
            tipo_suelo: 'Regolito basáltico con percloratos y hematita',
            ph: 7.8,
            percloratos_pct: 0.65,
            arena_pct: 78,
            arcilla_esmectita_pct: 18,
            materia_organica_pct: 0.01,
          },
          metrics: {
            aptitud_micelio_pct: normalizedData.viabilidad_micelio.indice_viabilidad_pct,
            viabilidad_biorremediacion: 'ALTA (con bio-aislamiento térmico)',
            cepa_recomendada: normalizedData.viabilidad_micelio.cepa_recomendada,
          },
          fuente: normalizedData.fuente,
        }));

        setSuccessMsg(`Clima Marciano (MCD / LMD Jussieu) obtenido para [${lat.toFixed(2)}°, ${lon.toFixed(2)}°]: ${normalizedData.temperatura_c}°C, ${normalizedData.presion_pa} Pa.`);
        setTimeout(() => setSuccessMsg(''), 6000);
      } else {
        setError('Respuesta no válida del servicio MCD de Marte');
      }
    } catch (err: any) {
      console.warn('Error llamando a MCD:', err);
      setError('Error al consultar clima marciano (MCD / LMD): ' + (err.message || 'Error de conexión'));
    } finally {
      setCalculatingMcdClimate(false);
    }
  }

  // ─── Calcular Condiciones de Terreno Marciano con Flask IA ───
  async function handleCalcularCondicionesMarcianas() {
    setError('');
    if (vertices.length < 3) {
      setError('Se requieren al menos 3 vértices para delimitar la parcela marciana.');
      return;
    }

    setCalculatingConditions(true);
    try {
      const closedCoords = [...vertices, vertices[0]];
      const payload = {
        poligono_coordenadas: closedCoords,
        entorno: 'marte',
        grid_size: 120,
      };

      const res = await apiService.calcularCondicionesTerreno(payload);
      if (res && res.success) {
        setMarsConditionsData(res);
        if (res.clima && res.clima.temperatura_c !== undefined) {
          setMcdClimateData(res.clima);
        }
        setActiveOverlayPanel('clima');
        setSuccessMsg('Condiciones de regolito marciano calculadas exitosamente con IA.');
        setTimeout(() => setSuccessMsg(''), 5000);
      } else {
        const fallback = {
          success: true,
          entorno: 'marte',
          clima: {
            temperatura_media_c: -62.5,
            presion_kpa: 0.63,
            radiacion_uv_index: 12.8,
            humedad_relativa_pct: 0.05,
          },
          soil_summary: {
            tipo_suelo: 'Regolito basáltico con percloratos y hematita',
            ph: 7.8,
            percloratos_pct: 0.65,
            arena_pct: 78,
            arcilla_esmectita_pct: 18,
            materia_organica_pct: 0.01,
          },
          metrics: {
            aptitud_micelio_pct: 84.5,
            viabilidad_biorremediacion: 'ALTA (con cápsula bio-aislante)',
            cepa_recomendada: 'Pleurotus ostreatus var. ares-4 (Xerotolerante)',
          },
        };
        setMarsConditionsData(fallback);
        setSuccessMsg('Modelo aerográfico estándar de regolito cargado.');
        setTimeout(() => setSuccessMsg(''), 5000);
      }
    } catch (err: any) {
      console.warn('Fallback a modelo de regolito local:', err);
      const fallback = {
        success: true,
        entorno: 'marte',
        clima: {
          temperatura_media_c: -62.5,
          presion_kpa: 0.63,
          radiacion_uv_index: 12.8,
        },
        soil_summary: {
          tipo_suelo: 'Regolito basáltico con percloratos',
          ph: 7.8,
          percloratos_pct: 0.65,
        },
      };
      setMarsConditionsData(fallback);
    } finally {
      setCalculatingConditions(false);
    }
  }

  // ─── Guardar Parcela Marciana en la Base de Datos ───
  async function handleGuardarTerreno(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (vertices.length < 3) {
      setError('Debes tener al menos 3 vértices definidos para la parcela marciana.');
      return;
    }

    setSaving(true);
    try {
      const closedCoords = [...vertices, vertices[0]].map(([lng, lat]) => [Number(lng), Number(lat)]);

      const payload = {
        nombre: formData.nombre || 'Parcela Marciana sin nombre',
        descripcion: formData.descripcion || 'Sector de exploración y microrremediación en Marte.',
        entorno: 'marte',
        latitud_central: Number(formData.latitud_central) || 0,
        longitud_central: Number(formData.longitud_central) || 0,
        dimensiones_m2: Number(formData.dimensiones_m2) || 50000,
        red_wifi_ssid: formData.red_wifi_ssid || 'NASA-Mars-Relay',
        red_wifi_pass: formData.red_wifi_pass || null,
        red_wifi_status: formData.red_wifi_status || 'activa',
        poligono_coordenadas: closedCoords,
        puntos_inicio_escaneo: assignedRovers.length > 0 ? assignedRovers.map((r) => ({
          id: r.id,
          lat: Number(r.lat),
          lng: Number(r.lng),
          robot_id: r.robot_id,
          robot_nombre: r.robot_nombre,
          robot_modelo: r.robot_modelo,
          robot_modo: r.robot_modo,
          robot_bateria: r.robot_bateria,
          sector_nombre: r.sector_nombre,
          timestamp: r.timestamp,
        })) : null,
        condiciones_terreno: marsConditionsData ? {
          entorno: 'marte',
          clima: mcdClimateData || marsConditionsData.clima || null,
          soil_summary: marsConditionsData.soil_summary || null,
          metrics: marsConditionsData.metrics || null,
        } : {
          entorno: 'marte',
          clima: mcdClimateData || null,
          soil_summary: {
            tipo_suelo: 'Regolito marciano de cráter',
            percloratos: selectedPresetIndex !== null ? MARS_PRESETS[selectedPresetIndex]?.perchlorates : 'Medio (0.5% peso)',
          },
        },
        elevacion_data: {
          min: (selectedPresetIndex !== null ? MARS_PRESETS[selectedPresetIndex]?.molaAlt : -2500) || -2500,
          max: ((selectedPresetIndex !== null ? MARS_PRESETS[selectedPresetIndex]?.molaAlt : -2500) || -2500) + 120,
          avg: (selectedPresetIndex !== null ? MARS_PRESETS[selectedPresetIndex]?.molaAlt : -2500) || -2500,
          slope_pct: 4.8,
          area_m2: formData.dimensiones_m2,
          datum: 'Mars MOLA Areoid',
        },
        rutas_rovers: routesMissionData?.rutas_rovers || null,
        clusters_muestreo: routesMissionData?.clusters || null,
      };

      const creado = await apiService.crearTerreno(payload);

      if (creado && creado.id && assignedRovers.length > 0) {
        for (const rover of assignedRovers) {
          if (rover.robot_id) {
            try {
              await apiService.actualizarRobot(rover.robot_id, {
                terreno_id: creado.id,
                latitud_marte: rover.lat,
                longitud_marte: rover.lng,
                modo: rover.robot_modo,
              });
            } catch (rErr) {
              console.warn(`No se pudo sincronizar rover ${rover.robot_id}:`, rErr);
            }
          }
        }
      }

      if (creado && creado.id) {
        navigate(`/mision/${creado.id}`);
      } else {
        navigate('/terrenos');
      }
    } catch (err: any) {
      console.error(err);
      setError('Error al crear la parcela marciana: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  // Bounding box calculado de los vértices actuales
  const boundingBox = useMemo(() => {
    if (vertices.length === 0) return null;
    const lats = vertices.map((v) => v[1]);
    const lons = vertices.map((v) => v[0]);
    return {
      minLat: Math.min(...lats).toFixed(5),
      maxLat: Math.max(...lats).toFixed(5),
      minLon: Math.min(...lons).toFixed(5),
      maxLon: Math.max(...lons).toFixed(5),
    };
  }, [vertices]);

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col lg:flex-row bg-[#0c0908] text-gray-200 overflow-hidden font-mono select-none">
      {/* ═══════════════════════════════════════════════════════════════
          PANEL LATERAL IZQUIERDO: FORMULARIO, PRESETS & ROVERS
         ═══════════════════════════════════════════════════════════════ */}
      <div className="w-full lg:w-[460px] xl:w-[490px] bg-[#120e0c] border-r border-[#2d1b15] flex flex-col h-full z-20 shadow-2xl shrink-0">
        {/* Cabecera del Panel */}
        <div className="p-4 border-b border-[#2d1b15] bg-gradient-to-r from-[#170f0b] via-[#1a120e] to-[#170f0b] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/terrenos')}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              title="Volver al catálogo de terrenos"
            >
              <i className="fa-solid fa-arrow-left text-sm" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-white tracking-wide flex items-center gap-2">
                  <span>Delimitar Parcela Marciana</span>
                </h1>
                <span className="px-2 py-0.5 rounded text-[0.62rem] font-bold uppercase bg-[#ff4500]/20 text-[#ff4500] border border-[#ff4500]/40 flex items-center gap-1">
                  <i className="fa-solid fa-meteor text-[0.6rem]" />
                  NASA Trek
                </span>
              </div>
              <p className="text-[0.68rem] text-gray-400 mt-0.5">
                Cartografía orbital y asignación de rovers para biorremediación en Marte.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/terrenos/crear')}
            className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[0.62rem] transition-all flex items-center gap-1"
            title="Cambiar a misión en la Tierra"
          >
            <i className="fa-solid fa-earth-americas text-[0.65rem]" />
            <span>Tierra</span>
          </button>
        </div>

        {/* Formulario Scrolleable */}
        <form onSubmit={handleGuardarTerreno} className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
              <i className="fa-solid fa-circle-exclamation text-sm shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
              <i className="fa-solid fa-circle-check text-sm shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ─── Presets Rápidos de Marte ─── */}
          <div>
            <label className="block text-[0.65rem] text-[#ff6633] uppercase font-bold mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <i className="fa-solid fa-shuttle-space" />
                <span>Sectores Emblemáticos de Marte (NASA)</span>
              </span>
              <span className="text-gray-500 text-[0.6rem] font-normal">Clic para centrar</span>
            </label>
            <div className="grid grid-cols-1 gap-1.5 max-h-44 overflow-y-auto pr-1">
              {MARS_PRESETS.map((p, idx) => {
                const isSelected = selectedPresetIndex === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectPreset(p, idx)}
                    className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between group ${
                      isSelected
                        ? 'bg-[#26150f] border-[#ff4500] shadow-md shadow-[#ff4500]/10 ring-1 ring-[#ff4500]/40'
                        : 'bg-black/50 border-[#2d1b15] hover:border-[#ff4500]/50 hover:bg-white/5'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[0.72rem] font-bold truncate ${isSelected ? 'text-orange-300' : 'text-gray-200 group-hover:text-white'}`}>
                          {p.label}
                        </span>
                        {isSelected && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#ff4500] animate-ping" />
                        )}
                      </div>
                      <span className="text-[0.62rem] text-gray-400 truncate block mt-0.5">
                        {p.sublabel}
                      </span>
                      <div className="flex items-center gap-3 mt-1 text-[0.58rem] text-gray-500">
                        <span>Coord: [{p.lat}°, {p.lon}°]</span>
                        <span>MOLA: {p.molaAlt}m</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[0.65rem] text-[#ff4500] font-bold block">
                        {(p.m2 / 10000).toFixed(1)} ha
                      </span>
                      <span className="text-[0.58rem] text-gray-400">
                        {p.m2.toLocaleString()} m²
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ─── Campos Principales del Formulario ─── */}
          <div className="space-y-3 pt-1 border-t border-[#2d1b15]">
            <div>
              <label className="block text-xs text-gray-300 mb-1 flex items-center justify-between">
                <span>Nombre de la Parcela Marciana *</span>
                <span className="text-[0.62rem] text-gray-500">Obligatorio</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ej. Sector Jezero Delta-01"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-black/60 border border-[#2d1b15] text-white text-xs outline-none focus:border-[#ff4500] transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-300 mb-1">
                  Entorno Planetario
                </label>
                <div className="w-full px-3 py-2 rounded-xl bg-black/60 border border-[#ff4500]/30 text-[#ff4500] text-xs flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-bold">
                    <i className="fa-solid fa-meteor" />
                    Marte (NASA)
                  </span>
                  <span className="text-[0.6rem] px-1.5 py-0.5 rounded bg-[#ff4500]/20 text-[#ff4500] font-bold">
                    0.38G
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-300 mb-1">
                  Superficie (m²) *
                </label>
                <input
                  type="number"
                  required
                  min="1000"
                  step="1000"
                  value={formData.dimensiones_m2}
                  onChange={(e) => handleDimensionesChange(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-[#2d1b15] text-white text-xs outline-none focus:border-[#ff4500] transition-colors"
                />
              </div>
            </div>

            {/* Coordenadas Centrales */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[0.68rem] text-gray-400 mb-1">
                  Latitud Central (°N/S)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={formData.latitud_central}
                  onChange={(e) => handleCentroChange(Number(e.target.value), formData.longitud_central)}
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-[#2d1b15] text-white text-xs outline-none focus:border-[#ff4500]"
                />
              </div>
              <div>
                <label className="block text-[0.68rem] text-gray-400 mb-1">
                  Longitud Central (°E/W)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={formData.longitud_central}
                  onChange={(e) => handleCentroChange(formData.latitud_central, Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-[#2d1b15] text-white text-xs outline-none focus:border-[#ff4500]"
                />
              </div>
            </div>

            {/* Red y Telecomunicaciones Marcianas */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[0.68rem] text-gray-400 mb-1">
                  Red Orbital / Mesh SSID
                </label>
                <input
                  type="text"
                  placeholder="Starlink-Mars-Mesh"
                  value={formData.red_wifi_ssid}
                  onChange={(e) => setFormData({ ...formData, red_wifi_ssid: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-[#2d1b15] text-white text-xs outline-none focus:border-[#ff4500]"
                />
              </div>
              <div>
                <label className="block text-[0.68rem] text-gray-400 mb-1">
                  Estado de Telemetría
                </label>
                <select
                  value={formData.red_wifi_status}
                  onChange={(e) => setFormData({ ...formData, red_wifi_status: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-[#2d1b15] text-white text-xs outline-none focus:border-[#ff4500]"
                >
                  <option value="activa">Enlace Activo</option>
                  <option value="inactiva">Enlace Standby</option>
                  <option value="en_mantenimiento">Calibración Orbital</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-300 mb-1">
                Descripción de la Misión de Biorremediación
              </label>
              <textarea
                rows={2}
                placeholder="Objetivo científico, cepa de micelio a inocular y características del regolito..."
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-black/60 border border-[#2d1b15] text-white text-xs outline-none focus:border-[#ff4500] resize-none"
              />
            </div>
          </div>

          {/* ─── SECCIÓN: ASIGNACIÓN DE ROVERS A LA PARCELA ─── */}
          {/* ─── SECCIÓN: ASIGNACIÓN DE ROVERS A LA PARCELA ─── */}
          <div className="pt-2 border-t border-[#2d1b15]">
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className="text-xs font-bold text-white flex items-center gap-1.5">
                  <i className="fa-solid fa-robot text-amber-400" />
                  <span>Flota de Rovers Marcianos ({assignedRovers.length})</span>
                </label>
                <p className="text-[0.65rem] text-gray-400">
                  Unidades M.Y.C.O posicionadas en el terreno para inyección y monitoreo.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setMapClickMode('rover_place');
                  setSuccessMsg('Modo activo: Haz clic en el mapa de Marte sobre el punto donde deseas colocar el rover.');
                  setTimeout(() => setSuccessMsg(''), 4500);
                }}
                className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[0.68rem] font-bold transition-all flex items-center gap-1.5 shadow cursor-pointer"
              >
                <i className="fa-solid fa-crosshairs text-[0.65rem]" />
                <span>+ Posicionar en Mapa</span>
              </button>
            </div>

            {/* Selector de Modo de Clic (Trazar Perímetro vs + Posicionar Rover) - Igual a CrearTerrenoView */}
            <div className="grid grid-cols-2 gap-2 pt-1 mb-2.5">
              <button
                type="button"
                onClick={() => setMapClickMode('polygon')}
                className={`py-2 px-2 rounded-lg font-mono text-[0.68rem] font-bold flex items-center justify-center gap-1.5 transition-all border cursor-pointer ${
                  mapClickMode === 'polygon'
                    ? 'bg-[#ff4500]/20 text-[#ff4500] border-[#ff4500]/60 shadow-md ring-1 ring-[#ff4500]/30'
                    : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
                }`}
              >
                <i className="fa-solid fa-draw-polygon text-xs" />
                <span>Trazar Perímetro</span>
              </button>

              <button
                type="button"
                onClick={() => setMapClickMode('rover_place')}
                className={`py-2 px-2 rounded-lg font-mono text-[0.68rem] font-bold flex items-center justify-center gap-1.5 transition-all border cursor-pointer ${
                  mapClickMode === 'rover_place'
                    ? 'bg-amber-500/25 text-amber-300 border-amber-400 shadow-md ring-1 ring-amber-400/50 font-extrabold'
                    : 'bg-white/5 text-gray-400 border-white/10 hover:text-white'
                }`}
              >
                <i className="fa-solid fa-location-crosshairs text-xs text-amber-400" />
                <span>+ Posicionar Rover</span>
              </button>
            </div>

            {/* Banner de Ayuda cuando el Modo de Posicionamiento está activo */}
            {mapClickMode === 'rover_place' && (
              <div className="p-2.5 mb-2.5 rounded-xl bg-amber-500/15 border border-amber-400/40 text-amber-300 text-xs flex items-center justify-between gap-2 shadow">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
                  <span className="text-[0.68rem] font-bold leading-tight">
                    Haz clic en el mapa marciano para colocar un rover exactamente en esa coordenada.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMapClickMode('polygon')}
                  className="px-2 py-0.5 rounded bg-amber-500/30 hover:bg-amber-500 text-amber-200 hover:text-black text-[0.62rem] font-bold transition-all shrink-0 cursor-pointer"
                >
                  Salir
                </button>
              </div>
            )}

            {assignedRovers.length === 0 ? (
              <div className="p-3 rounded-xl bg-black/40 border border-dashed border-[#2d1b15] text-center text-[0.7rem] text-gray-500">
                <i className="fa-solid fa-robot block text-lg mb-1 text-gray-600" />
                No hay rovers posicionados en esta parcela marciana.
                <div className="text-[0.62rem] text-amber-400/80 mt-1">
                  Usa "+ Posicionar Rover" y haz clic en el mapa para ubicar un rover.
                </div>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {assignedRovers.map((rover, idx) => (
                  <div
                    key={rover.id}
                    className="p-2.5 rounded-xl bg-black/60 border border-amber-500/30 text-gray-200 flex items-center justify-between gap-2 shadow"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-xs shrink-0">
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-xs truncate">
                            {rover.robot_nombre}
                          </span>
                          <span className="text-[0.58rem] text-gray-400">
                            ({rover.robot_modelo})
                          </span>
                        </div>
                        <div className="text-[0.62rem] text-gray-400 flex items-center gap-2 mt-0.5">
                          <span className="text-amber-300">{rover.sector_nombre}</span>
                          <span>• Batería: {rover.robot_bateria}%</span>
                          <span>• [{rover.lat.toFixed(4)}°, {rover.lng.toFixed(4)}°]</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Selector de Modo */}
                      <select
                        value={rover.robot_modo}
                        onChange={(e) => handleCambiarModoRover(rover.id, e.target.value as any)}
                        className="text-[0.62rem] py-1 px-1.5 rounded-lg bg-black/80 border border-white/10 text-gray-300 outline-none"
                      >
                        <option value="inyeccion">Inyección</option>
                        <option value="lectura">Lectura</option>
                        <option value="muestreo">Muestreo</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => handleRemoverRover(rover.id)}
                        className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
                        title="Desasignar rover"
                      >
                        <i className="fa-solid fa-trash-can text-xs" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ─── Botones de Cálculo Climatológico Marciano (MCD / LMD) & Regolito IA ─── */}
          <div className="pt-2 border-t border-[#2d1b15] space-y-2">
            {/* Botón 1: Consultar Clima Marciano MCD (LMD Jussieu) */}
            <button
              type="button"
              onClick={handleConsultarClimaMarciano}
              disabled={calculatingMcdClimate}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-950/40 via-blue-900/30 to-purple-950/40 hover:from-cyan-900/50 hover:to-purple-900/50 border border-cyan-500/40 text-cyan-200 font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-40"
            >
              {calculatingMcdClimate ? (
                <>
                  <i className="fa-solid fa-spinner animate-spin text-cyan-400" />
                  <span>Consultando Base de Datos MCD (LMD Jussieu)...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-temperature-half text-cyan-400" />
                  <span>Consultar Clima Marciano (MCD / LMD)</span>
                </>
              )}
            </button>

            {/* Botón 2: Calcular Condiciones de Regolito (Flask IA) */}
            <button
              type="button"
              onClick={handleCalcularCondicionesMarcianas}
              disabled={calculatingConditions}
              className="w-full py-2 rounded-xl bg-gradient-to-r from-[#ff4500]/20 to-amber-500/20 hover:from-[#ff4500]/30 hover:to-amber-500/30 border border-[#ff4500]/40 text-orange-300 font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-40"
            >
              {calculatingConditions ? (
                <>
                  <i className="fa-solid fa-spinner animate-spin text-[#ff4500]" />
                  <span>Calculando viabilidad de regolito marciano...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-satellite-dish text-[#ff4500]" />
                  <span>Calcular Condiciones de Regolito (Flask IA)</span>
                </>
              )}
            </button>

            {/* Botón 3: Calcular Elevación MOLA (DEM Topográfico) */}
            <button
              type="button"
              onClick={() => handleCalcularElevacionMarte(1)}
              disabled={calculatingElevation || vertices.length < 3}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-950/40 via-teal-900/30 to-green-950/40 hover:from-emerald-900/50 hover:to-teal-900/50 border border-emerald-500/40 text-emerald-200 font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-40"
            >
              {calculatingElevation ? (
                <>
                  <i className="fa-solid fa-spinner animate-spin text-emerald-400" />
                  <span>Generando Matriz DEM MOLA (16×16)...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-mountain text-emerald-400" />
                  <span>Calcular Elevación MOLA (DEM)</span>
                </>
              )}
            </button>

            {/* Botón 4: Planificar Rutas Rovers con IA (A* Topográfico & Batería) */}
            <button
              type="button"
              onClick={handlePlanificarRutasMarte}
              disabled={calculatingRoutes || vertices.length < 3}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-950/40 via-orange-900/30 to-rose-950/40 hover:from-amber-900/50 hover:to-orange-900/50 border border-amber-500/40 text-amber-200 font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-40"
            >
              {calculatingRoutes ? (
                <>
                  <i className="fa-solid fa-spinner animate-spin text-amber-400" />
                  <span>Optimizando Rutas & Clusters de Rovers...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-route text-amber-400" />
                  <span>Planificar Rutas Rovers (IA)</span>
                </>
              )}
            </button>

            {/* Acceso Rápido al Panel Flotante si hay datos de Clima MCD */}
            {mcdClimateData && (
              <div
                onClick={() => setActiveOverlayPanel(activeOverlayPanel === 'clima' ? 'cerrado' : 'clima')}
                className="p-2.5 rounded-xl bg-gradient-to-r from-cyan-950/50 to-blue-950/40 hover:from-cyan-900/60 hover:to-blue-900/50 border border-cyan-500/40 text-cyan-300 text-xs flex items-center justify-between cursor-pointer transition-all shadow"
                title="Hacer clic para abrir o cerrar el panel flotante de clima en el mapa"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping shrink-0" />
                  <span className="truncate font-bold text-[0.68rem]">
                    Clima MCD: {mcdClimateData.temperatura_c}°C • {mcdClimateData.presion_pa} Pa
                  </span>
                </div>
                <span className="text-[0.6rem] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shrink-0 font-bold flex items-center gap-1">
                  <i className="fa-solid fa-window-restore text-[0.55rem]" />
                  <span>{activeOverlayPanel === 'clima' ? 'Minimizar' : 'Ver Panel'}</span>
                </span>
              </div>
            )}

            {/* Acceso Rápido si hay Matriz DEM generada */}
            {elevationData && (
              <div
                onClick={() => setActiveOverlayPanel(activeOverlayPanel === 'elevacion' ? 'cerrado' : 'elevacion')}
                className="p-2.5 rounded-xl bg-gradient-to-r from-emerald-950/50 to-teal-950/40 hover:from-emerald-900/60 hover:to-teal-900/50 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between cursor-pointer transition-all shadow"
                title="Hacer clic para ver la matriz DEM e interpolación"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <span className="truncate font-bold text-[0.68rem]">
                    DEM: {elevationData.min}m a {elevationData.max}m (Δ {elevationData.diff}m)
                  </span>
                </div>
                <span className="text-[0.6rem] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0 font-bold flex items-center gap-1">
                  <i className="fa-solid fa-chart-area text-[0.55rem]" />
                  <span>{activeOverlayPanel === 'elevacion' ? 'Minimizar' : 'Ver DEM'}</span>
                </span>
              </div>
            )}

            {/* Acceso Rápido si hay Rutas IA calculadas */}
            {routesMissionData && (
              <div
                onClick={() => setActiveOverlayPanel(activeOverlayPanel === 'rutas' ? 'cerrado' : 'rutas')}
                className="p-2.5 rounded-xl bg-gradient-to-r from-amber-950/50 to-orange-950/40 hover:from-amber-900/60 hover:to-orange-900/50 border border-amber-500/40 text-amber-300 text-xs flex items-center justify-between cursor-pointer transition-all shadow"
                title="Hacer clic para ver el desglose de rutas de los rovers"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
                  <span className="truncate font-bold text-[0.68rem]">
                    Rutas: {routesMissionData.resumen_mision?.total_rovers} Rovers • {routesMissionData.resumen_mision?.total_puntos_medicion} Puntos
                  </span>
                </div>
                <span className="text-[0.6rem] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0 font-bold flex items-center gap-1">
                  <i className="fa-solid fa-route text-[0.55rem]" />
                  <span>{activeOverlayPanel === 'rutas' ? 'Minimizar' : 'Ver Rutas'}</span>
                </span>
              </div>
            )}

            {/* Acceso Rápido al Panel Flotante si hay datos de Regolito sin Clima MCD */}
            {marsConditionsData && !mcdClimateData && (
              <div
                onClick={() => setActiveOverlayPanel(activeOverlayPanel === 'regolito' ? 'cerrado' : 'regolito')}
                className="p-2.5 rounded-xl bg-black/60 hover:bg-[#2d1b15]/60 border border-[#ff4500]/40 text-orange-300 text-xs flex items-center justify-between cursor-pointer transition-all shadow"
                title="Hacer clic para abrir o cerrar el panel flotante de regolito"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-[#ff4500] animate-pulse shrink-0" />
                  <span className="truncate font-bold text-[0.68rem]">
                    Regolito: pH {marsConditionsData.soil_summary?.ph ?? 7.8} • {marsConditionsData.clima?.temperatura_media_c ?? -62}°C
                  </span>
                </div>
                <span className="text-[0.6rem] px-2 py-0.5 rounded bg-[#ff4500]/20 text-[#ff4500] border border-[#ff4500]/30 shrink-0 font-bold">
                  {activeOverlayPanel === 'regolito' ? 'Minimizar' : 'Ver Panel'}
                </span>
              </div>
            )}

            {/* Botón Principal Guardar */}
            <button
              type="submit"
              disabled={saving || vertices.length < 3}
              className="w-full py-3 rounded-xl bg-[#ff4500] hover:bg-[#ff4500]/90 disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xl shadow-[#ff4500]/25 transition-all mt-2 cursor-pointer"
            >
              {saving ? (
                <>
                  <i className="fa-solid fa-spinner animate-spin" />
                  <span>Registrando Misión Marciana en Base de Datos...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-check-double" />
                  <span>Guardar Parcela Marciana & Entrar a Misión</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          PANEL PRINCIPAL DERECHO: MAPA MARCIANO INTERACTIVO (NASA TILES & DEM)
         ═══════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col h-full bg-[#0a0706] overflow-hidden">
        {/* Barra Superior de Herramientas de Misión */}
        <div className="p-3 bg-[#140e0b] border-b border-[#2d1b15] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#ff4500] text-white shadow-lg shadow-[#ff4500]/20 flex items-center gap-2">
              <i className="fa-solid fa-meteor" />
              <span>Visor Orbital Marte (NASA Trek & DEM MOLA)</span>
            </span>
            <span className="text-[0.62rem] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg font-mono">
              ✓ Automatizado en Backend IA (SciPy / MOLA)
            </span>
          </div>

          {/* Información Rápida de Parcela & Enlace al Portal Externo 3D de NASA */}
          <div className="flex items-center gap-2 text-xs text-gray-400">
            {cursorCoords && (
              <span className="hidden xl:inline-block px-2.5 py-1 rounded-lg bg-black/50 border border-white/5 text-[0.68rem] text-orange-300">
                Cursor: [{cursorCoords.lat}°, {cursorCoords.lng}°]
              </span>
            )}

            {boundingBox && (
              <span className="hidden sm:inline-block px-2.5 py-1 rounded-lg bg-black/50 border border-white/5 text-[0.68rem]">
                BBox: [{boundingBox.minLat}°, {boundingBox.minLon}°] a [{boundingBox.maxLat}°, {boundingBox.maxLon}°]
              </span>
            )}

            <a
              href="https://trek.nasa.gov/mars/"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-lg bg-[#ff4500]/15 hover:bg-[#ff4500]/25 text-orange-300 border border-[#ff4500]/40 text-xs transition-all flex items-center gap-1.5 shadow"
              title="Abrir el portal 3D oficial de NASA Mars Trek en pestaña externa"
            >
              <i className="fa-solid fa-arrow-up-right-from-square text-[0.65rem]" />
              <span>Portal Oficial 3D</span>
            </a>
          </div>
        </div>

        {/* ─── MAPA NATIVO INTERACTIVO DE MARTE (NASA MARS TREK TILES) ─── */}
        <div className="flex-1 relative flex flex-col bg-[#0b0807] overflow-hidden">
          {/* Barra Flotante de Controles sobre el Mapa */}
            <div className="absolute top-3 left-3 right-3 z-[1000] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
              {/* Selector de Capas NASA Mars Trek */}
              <div className="bg-[#140e0be6] backdrop-blur-md border border-[#2d1b15] p-1.5 rounded-xl shadow-2xl pointer-events-auto flex items-center gap-1">
                <span className="text-[0.62rem] text-gray-400 font-bold px-2 uppercase">Capa NASA:</span>
                {TILE_PROVIDERS.slice(0, 3).map((provider) => {
                  const isActive = activeTileProvider.id === provider.id;
                  return (
                    <button
                      key={provider.id}
                      type="button"
                      onClick={() => setActiveTileProvider(provider)}
                      className={`px-2.5 py-1 rounded-lg text-[0.68rem] font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[#ff4500] text-white shadow-md'
                          : 'bg-white/5 hover:bg-white/10 text-gray-300'
                      }`}
                    >
                      {provider.shortName}
                    </button>
                  );
                })}
              </div>

              {/* Selector de Modo de Clic en el Mapa */}
              <div className="bg-[#140e0be6] backdrop-blur-md border border-[#2d1b15] p-1.5 rounded-xl shadow-2xl pointer-events-auto flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setMapClickMode('polygon')}
                  className={`px-3 py-1 rounded-lg text-[0.68rem] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    mapClickMode === 'polygon'
                      ? 'bg-[#ff4500] text-white shadow-md'
                      : 'bg-white/5 hover:bg-white/10 text-gray-300'
                  }`}
                  title="Haz clic en el mapa marciano para añadir vértices al perímetro de la parcela"
                >
                  <i className="fa-solid fa-draw-polygon" />
                  <span>+ Vértice Parcela ({vertices.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMapClickMode('rover_place')}
                  className={`px-3 py-1 rounded-lg text-[0.68rem] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    mapClickMode === 'rover_place'
                      ? 'bg-amber-500 text-black shadow-md font-extrabold'
                      : 'bg-white/5 hover:bg-white/10 text-gray-300'
                  }`}
                  title="Haz clic en cualquier punto del mapa marciano para asignar un rover en esa coordenada"
                >
                  <i className="fa-solid fa-location-crosshairs text-amber-400" />
                  <span>+ Posicionar Rover</span>
                </button>

                <button
                  type="button"
                  onClick={() => setVertices([])}
                  disabled={vertices.length === 0}
                  className="px-2 py-1 rounded-lg bg-white/5 hover:bg-red-500/20 disabled:opacity-40 text-red-400 text-[0.65rem] border border-white/10 transition-colors"
                  title="Limpiar vértices de la parcela"
                >
                  Limpiar
                </button>
              </div>
            </div>

            {/* Contenedor del Mapa Leaflet */}
            <div className={`flex-1 w-full h-full relative ${mapClickMode === 'rover_place' ? 'mars-crosshair-mode' : ''}`}>
              <style>{`
                .mars-crosshair-mode,
                .mars-crosshair-mode .leaflet-container,
                .mars-crosshair-mode .leaflet-grab,
                .mars-crosshair-mode .leaflet-interactive {
                  cursor: crosshair !important;
                }
                @keyframes marsRadarPulse {
                  0% { transform: scale(0.6); opacity: 0.95; }
                  70% { transform: scale(1.6); opacity: 0.25; }
                  100% { transform: scale(2.0); opacity: 0; }
                }
              `}</style>
              <div
                ref={mapContainerRef}
                className="mars-map w-full h-full z-0"
              />

              {/* ─── PANELES FLOTANTES SOBRE EL MAPA MARCIANO (CLIMA MCD, REGOLITO, ELEVACIÓN DEM, RUTAS IA) ─── */}
              {(mcdClimateData || marsConditionsData || elevationData || routesMissionData) && (
                <>
                  {/* Barra Flotante de Conmutación de Paneles sobre el Mapa */}
                  <div className="absolute top-16 right-4 z-[500] flex items-center gap-1.5 bg-black/85 backdrop-blur-md p-1.5 rounded-xl border border-cyan-500/40 shadow-2xl">
                    {[
                      { id: 'clima', label: 'Clima MCD', icon: 'fa-temperature-half' },
                      { id: 'regolito', label: 'Regolito', icon: 'fa-layer-group' },
                      { id: 'biorremediacion', label: 'Viabilidad', icon: 'fa-dna' },
                      { id: 'elevacion', label: 'MOLA DEM', icon: 'fa-mountain' },
                      { id: 'rutas', label: 'Rutas IA', icon: 'fa-route' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveOverlayPanel(activeOverlayPanel === tab.id ? 'cerrado' : (tab.id as any))}
                        className={`px-2.5 py-1 rounded-lg text-[0.68rem] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                          activeOverlayPanel === tab.id
                            ? 'bg-[#ff4500] text-white shadow-md'
                            : 'text-gray-300 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        <i className={`fa-solid ${tab.icon} text-[0.65rem]`} />
                        <span className="hidden sm:inline">{tab.label}</span>
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() => setActiveOverlayPanel(activeOverlayPanel === 'cerrado' ? 'clima' : 'cerrado')}
                      title={activeOverlayPanel === 'cerrado' ? 'Abrir Panel Flotante' : 'Minimizar Panel Flotante'}
                      className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 flex items-center justify-center transition-colors ml-1 cursor-pointer"
                    >
                      <i className={`fa-solid ${activeOverlayPanel === 'cerrado' ? 'fa-chevron-down' : 'fa-chevron-up'} text-xs`} />
                    </button>
                  </div>

                  {/* Panel Flotante Contextual sobre el Mapa */}
                  {activeOverlayPanel !== 'cerrado' && (
                    <div className="absolute top-28 right-4 z-[500] w-80 sm:w-96 max-h-[calc(100vh-230px)] flex flex-col bg-[#140e0be6]/95 backdrop-blur-xl border border-cyan-500/40 rounded-2xl shadow-2xl overflow-hidden font-mono text-xs animate-fadeIn">
                      {/* Cabecera del Panel Flotante */}
                      <div className="p-3 border-b border-cyan-500/20 bg-gradient-to-r from-cyan-950/70 via-black/80 to-[#1b100b] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                          <span className="font-bold text-white text-[0.75rem] uppercase tracking-wider truncate">
                            {activeOverlayPanel === 'clima' && 'Clima Marciano (MCD v6.2 / LMD)'}
                            {activeOverlayPanel === 'regolito' && 'Regolito & Percloratos'}
                            {activeOverlayPanel === 'biorremediacion' && 'Biorremediación & Micelio'}
                            {activeOverlayPanel === 'elevacion' && 'Topografía MOLA & Malla DEM (SciPy)'}
                            {activeOverlayPanel === 'rutas' && 'Rutas & Clusters de Rovers (IA)'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <a
                            href="https://www-mars.lmd.jussieu.fr"
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-0.5 rounded bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[0.58rem] transition-colors flex items-center gap-1"
                            title="Abrir base de datos oficial LMD / MCD"
                          >
                            <span>BD LMD</span>
                            <i className="fa-solid fa-arrow-up-right-from-square text-[0.5rem]" />
                          </a>
                          <button
                            type="button"
                            onClick={() => setActiveOverlayPanel('cerrado')}
                            className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors ml-1 cursor-pointer"
                          >
                            <i className="fa-solid fa-xmark text-xs" />
                          </button>
                        </div>
                      </div>

                      {/* Contenido Dinámico del Panel Flotante */}
                      <div className="p-3.5 overflow-y-auto space-y-3 max-h-[60vh]">
                        {/* PESTAÑA: CLIMA */}
                        {activeOverlayPanel === 'clima' && (
                          <div className="space-y-3">
                            {/* Hero Box de Temperatura */}
                            <div className="p-3 bg-gradient-to-r from-blue-950/60 via-indigo-950/40 to-black/60 border border-cyan-500/30 rounded-xl space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 text-lg">
                                    <i className="fa-solid fa-temperature-half" />
                                  </div>
                                  <div>
                                    <span className="font-bold text-white text-[0.75rem] block">
                                      Temperatura en Atmósfera (2m)
                                    </span>
                                    <span className="text-[0.58rem] text-gray-400">
                                      Laboratoire de Météorologie Dynamique
                                    </span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="text-2xl font-black text-cyan-300 block leading-tight">
                                    {mcdClimateData?.temperatura_c ?? marsConditionsData?.clima?.temperatura_media_c ?? -62.5}°C
                                  </span>
                                  <span className="text-[0.58rem] text-gray-400">
                                    {mcdClimateData?.temperatura_k ? `${mcdClimateData.temperatura_k} K` : '210.6 K'}
                                  </span>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-[0.65rem]">
                                <div>
                                  <span className="text-gray-400 block text-[0.58rem]">Temp. Regolito / Suelo</span>
                                  <span className="font-bold text-amber-300">
                                    {mcdClimateData?.temperatura_suelo_c ?? -55}°C
                                  </span>
                                  <span className="text-[0.55rem] text-gray-500 block">
                                    Amp: ±{((mcdClimateData?.amplitud_termica_c || 60) / 2).toFixed(1)}°C
                                  </span>
                                </div>

                                <div>
                                  <span className="text-gray-400 block text-[0.58rem]">Presión Barométrica</span>
                                  <span className="font-bold text-purple-300">
                                    {mcdClimateData?.presion_pa ?? 573} Pa
                                  </span>
                                  <span className="text-[0.55rem] text-gray-500 block">
                                    {mcdClimateData?.presion_kpa ?? 0.573} kPa (~0.6% Tierra)
                                  </span>
                                </div>

                                <div>
                                  <span className="text-gray-400 block text-[0.58rem]">Flujo Radiación UV</span>
                                  <span className="font-bold text-rose-300">
                                    {mcdClimateData?.radiacion_uv_flux_w_m2 ?? 29.6} W/m²
                                  </span>
                                  <span className="text-[0.55rem] text-rose-400 font-semibold block">
                                    Índice UV: {mcdClimateData?.uv_index ?? 11.9} (Extremo)
                                  </span>
                                </div>

                                <div>
                                  <span className="text-gray-400 block text-[0.58rem]">Densidad Aire / Viento</span>
                                  <span className="font-bold text-teal-300">
                                    {mcdClimateData?.densidad_aire_kg_m3 ?? 0.0126} kg/m³
                                  </span>
                                  <span className="text-[0.55rem] text-gray-400 block">
                                    ~{mcdClimateData?.velocidad_viento_m_s ?? 3.9} m/s
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Parámetros Estacionales & Celestes */}
                            <div className="p-2.5 rounded-xl bg-black/50 border border-white/5 space-y-1.5 text-[0.62rem]">
                              <div className="flex items-center justify-between text-gray-300">
                                <span className="text-gray-400">Estación Marciana:</span>
                                <span className="text-cyan-300 font-bold">{mcdClimateData?.estacion_marciana || 'Verano Norte / Aphelion'}</span>
                              </div>
                              <div className="flex items-center justify-between text-gray-400">
                                <span>Longitud Solar (Ls):</span>
                                <span className="text-gray-200">Ls {mcdClimateData?.ls_deg ?? 120.5}°</span>
                              </div>
                              <div className="flex items-center justify-between text-gray-400">
                                <span>Hora Solar Local:</span>
                                <span className="text-gray-200">{mcdClimateData?.hora_local_solar || '14:00 LTST'}</span>
                              </div>
                              <div className="flex items-center justify-between text-gray-400">
                                <span>Gas Predominante:</span>
                                <span className="text-gray-200">{mcdClimateData?.gas_predominante || 'Dióxido de Carbono (CO2 ~95.3%)'}</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* PESTAÑA: REGOLITO */}
                        {activeOverlayPanel === 'regolito' && (
                          <div className="space-y-2.5">
                            <div className="p-3 bg-gradient-to-r from-amber-950/40 to-black/60 border border-amber-500/30 rounded-xl space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-amber-300 text-[0.72rem]">Composición Geoquímica</span>
                                <span className="text-[0.6rem] px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold">
                                  Regolito Basáltico
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-[0.65rem]">
                                <div className="p-2 rounded-lg bg-black/40 border border-white/5">
                                  <span className="text-gray-400 block text-[0.58rem]">pH Estimado</span>
                                  <span className="text-base font-bold text-white">
                                    {marsConditionsData?.soil_summary?.ph ?? 7.8}
                                  </span>
                                  <span className="text-[0.55rem] text-emerald-400">Moderadamente Alcalino</span>
                                </div>

                                <div className="p-2 rounded-lg bg-black/40 border border-white/5">
                                  <span className="text-gray-400 block text-[0.58rem]">Percloratos de Magnesio</span>
                                  <span className="text-base font-bold text-rose-300">
                                    {marsConditionsData?.soil_summary?.percloratos_pct ?? 0.65}%
                                  </span>
                                  <span className="text-[0.55rem] text-rose-400">Oxidante crítico</span>
                                </div>

                                <div className="p-2 rounded-lg bg-black/40 border border-white/5">
                                  <span className="text-gray-400 block text-[0.58rem]">Arena Basáltica</span>
                                  <span className="text-sm font-bold text-amber-200">
                                    {marsConditionsData?.soil_summary?.arena_pct ?? 78}%
                                  </span>
                                </div>

                                <div className="p-2 rounded-lg bg-black/40 border border-white/5">
                                  <span className="text-gray-400 block text-[0.58rem]">Arcillas Esmectitas</span>
                                  <span className="text-sm font-bold text-cyan-200">
                                    {marsConditionsData?.soil_summary?.arcilla_esmectita_pct ?? 18}%
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="p-2.5 rounded-xl bg-black/50 border border-white/5 text-[0.62rem] text-gray-400 space-y-1">
                              <div><b>Elevación MOLA:</b> {selectedPresetIndex !== null ? MARS_PRESETS[selectedPresetIndex]?.molaAlt : -2500} m sobre el areoide</div>
                              <div><b>Nivel Percloratos:</b> {selectedPresetIndex !== null ? MARS_PRESETS[selectedPresetIndex]?.perchlorates : 'Medio (0.5% peso)'}</div>
                            </div>
                          </div>
                        )}

                        {/* PESTAÑA: BIORREMEDIACIÓN */}
                        {activeOverlayPanel === 'biorremediacion' && (
                          <div className="space-y-2.5">
                            <div className="p-3 bg-gradient-to-r from-emerald-950/40 via-teal-950/30 to-black/60 border border-emerald-500/30 rounded-xl space-y-2.5">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-emerald-300 text-[0.72rem]">Viabilidad Micótica</span>
                                <span className="text-base font-black text-emerald-400">
                                  {mcdClimateData?.viabilidad_micelio?.indice_viabilidad_pct ?? marsConditionsData?.metrics?.aptitud_micelio_pct ?? 84.5}%
                                </span>
                              </div>

                              <div className="p-2 rounded-lg bg-black/50 border border-emerald-500/20 text-[0.62rem] space-y-1">
                                <div className="text-gray-300">
                                  <b>Cepa Recomendada:</b> <span className="text-emerald-300 font-bold">{mcdClimateData?.viabilidad_micelio?.cepa_recomendada ?? 'Pleurotus ostreatus Ares-X (Crio-tolerante)'}</span>
                                </div>
                                <div className="text-gray-300">
                                  <b>Protocolo Térmico:</b> <span className="text-amber-300">{mcdClimateData?.viabilidad_micelio?.protocolo || 'Bio-aislamiento térmico requerido • Pantalla UV'}</span>
                                </div>
                              </div>
                            </div>

                            <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 text-[0.62rem] text-gray-400 space-y-1">
                              <div className="font-bold text-white mb-0.5">Estrategia de Biorremediación en Marte:</div>
                              <p>Inoculación asistida por la flota de rovers en microcápsulas con hidrogel crioprotector, reduciendo percloratos a cloruros e incrementando nitrógeno asimilable en el regolito.</p>
                            </div>
                          </div>
                        )}

                        {/* PESTAÑA: ELEVACIÓN TOPOGRÁFICA MOLA & MALLA DEM (SCIPY) */}
                        {activeOverlayPanel === 'elevacion' && elevationData && (
                          <div className="space-y-3 font-mono">
                            {/* KPIs de Relieve MOLA */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-center">
                              <div className="p-2 rounded-lg bg-black/60 border border-emerald-500/20">
                                <span className="text-[0.55rem] text-gray-400 uppercase block">Cota Mínima</span>
                                <span className="text-sm font-bold text-emerald-300">{elevationData.min} m</span>
                              </div>
                              <div className="p-2 rounded-lg bg-black/60 border border-teal-500/20">
                                <span className="text-[0.55rem] text-gray-400 uppercase block">Cota Máxima</span>
                                <span className="text-sm font-bold text-teal-300">{elevationData.max} m</span>
                              </div>
                              <div className="p-2 rounded-lg bg-black/60 border border-amber-500/20">
                                <span className="text-[0.55rem] text-gray-400 uppercase block">Desnivel (Δ)</span>
                                <span className="text-sm font-bold text-amber-300">{elevationData.diff} m</span>
                              </div>
                              <div className="p-2 rounded-lg bg-black/60 border border-rose-500/20">
                                <span className="text-[0.55rem] text-gray-400 uppercase block">Pendiente Est.</span>
                                <span className="text-sm font-bold text-rose-300">{elevationData.slope_pct}%</span>
                              </div>
                            </div>

                            {/* Análisis Dimensional del Rover en Marte */}
                            <div className="p-2.5 bg-black/60 rounded-xl border border-white/10 space-y-2">
                              <div className="flex items-center justify-between text-[0.68rem]">
                                <span className="font-bold text-gray-200 flex items-center gap-1.5">
                                  <i className="fa-solid fa-ruler-combined text-emerald-400" />
                                  <span>Escala MOLA Areoid ({elevationData.datum ? 'Datum Oficial' : 'Relieve'})</span>
                                </span>
                                <span className="text-emerald-300 font-bold">
                                  {elevationData.hectareas} ha (≈{Number(elevationData.area_m2 || 0).toLocaleString()} m²)
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-[0.62rem] text-gray-400">
                                <div>Lado estimado: <b className="text-white">{Math.round(Math.sqrt(elevationData.area_m2 || 0))} m</b></div>
                                <div>Paso por nodo: <b className="text-white">{elevationData.espaciado_metros} m/celda</b></div>
                                <div>Malla base: <b className="text-white">{elevationData.dimensions.width}×{elevationData.dimensions.height}</b></div>
                                <div>Cota media: <b className="text-emerald-300">{elevationData.avg} m</b></div>
                              </div>

                              {/* Selector de Escalamiento / Interpolación Cúbica SciPy */}
                              <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-1.5">
                                <span className="text-[0.6rem] text-gray-400 font-bold">
                                  Interpolación SciPy:
                                </span>
                                <div className="flex items-center gap-1">
                                  {[1, 2, 4].map((scale) => (
                                    <button
                                      key={scale}
                                      type="button"
                                      disabled={calculatingElevation}
                                      onClick={() => handleCalcularElevacionMarte(scale)}
                                      className={`px-2 py-0.5 rounded text-[0.62rem] font-bold border transition-colors cursor-pointer ${
                                        (elevationData.scale_factor || 1) === scale
                                          ? 'bg-emerald-500 text-black border-emerald-400'
                                          : 'bg-white/5 hover:bg-white/10 text-gray-300 border-white/10'
                                      }`}
                                    >
                                      {scale === 1 ? '16×16 (Base)' : `${scale}x (${16 * scale}²)`}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Visualización Colormap de la Matriz DEM */}
                            <div className="p-2.5 bg-black/70 rounded-xl border border-white/10 space-y-2">
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="font-bold text-white text-[0.7rem] block">
                                    Malla DEM {elevationData.scale_factor > 1 ? `Interpolada Cúbica (${elevationData.interpolated_dimensions?.width}×${elevationData.interpolated_dimensions?.height})` : `Base (${elevationData.dimensions.width}×${elevationData.dimensions.height})`}
                                  </span>
                                  <span className="text-[0.58rem] text-gray-400">
                                    {elevationData.scale_factor > 1 ? 'Suavizado bicúbico SciPy (griddata)' : 'Muestreo MOLA Areoid Mars'}
                                  </span>
                                </div>
                                <span className="text-[0.6rem] text-emerald-400 font-bold">
                                  Promedio: {elevationData.avg} m
                                </span>
                              </div>

                              {/* Grid de píxeles DEM marciano con gradiente hipsométrico */}
                              <div className="flex flex-col items-center pt-1">
                                {(() => {
                                  const matrixToRender = (elevationData.scale_factor > 1 && elevationData.interpolated_matrix_2d)
                                    ? elevationData.interpolated_matrix_2d
                                    : elevationData.matrix_2d;
                                  const cols = matrixToRender[0]?.length || 16;
                                  const range = Math.max(0.1, elevationData.max - elevationData.min);

                                  return (
                                    <div
                                      className="grid gap-[1px] bg-black p-1 rounded border border-[#222]"
                                      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                                    >
                                      {matrixToRender.map((row: number[], rIdx: number) =>
                                        row.map((val: number, cIdx: number) => {
                                          const ratio = Math.max(0, Math.min(1, (val - elevationData.min) / range));
                                          let bg = '#064e3b';
                                          if (ratio < 0.25) bg = '#047857';
                                          else if (ratio < 0.5) bg = '#d97706';
                                          else if (ratio < 0.75) bg = '#ea580c';
                                          else bg = '#e11d48';

                                          return (
                                            <div
                                              key={`${rIdx}-${cIdx}`}
                                              title={`[X:${cIdx}, Y:${rIdx}] Cota MOLA: ${val}m`}
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
                                  <i className="fa-solid fa-code text-emerald-400" />
                                  <span>Matriz 2D de Elevación {elevationData.scale_factor > 1 ? `Interpolada (${elevationData.interpolated_dimensions?.width}²)` : '(Metros MOLA)'}</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const activeArr = elevationData.scale_factor > 1 && elevationData.interpolated_matrix_2d
                                      ? elevationData.interpolated_matrix_2d
                                      : elevationData.matrix_2d;
                                    navigator.clipboard.writeText(JSON.stringify(activeArr));
                                    alert('Matriz de elevación MOLA copiada al portapapeles.');
                                  }}
                                  className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-emerald-300 text-[0.58rem] border border-white/10 flex items-center gap-1 cursor-pointer"
                                >
                                  <i className="fa-solid fa-copy text-[0.55rem]" />
                                  <span>Copiar Array</span>
                                </button>
                              </div>
                              <div className="p-2 rounded-lg bg-black/90 border border-white/10 font-mono text-[0.6rem] text-emerald-200 max-h-36 overflow-y-auto leading-relaxed select-all">
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

                        {/* PESTAÑA: RUTAS Y CLUSTERS POR ROVER (IA TOPOGRÁFICA) */}
                        {activeOverlayPanel === 'rutas' && routesMissionData && (
                          <div className="space-y-3 font-mono">
                            {/* Resumen Global Misión Multi-Rover */}
                            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-950/40 via-black to-black border border-amber-500/30 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[0.68rem] font-bold text-amber-300 uppercase flex items-center gap-1.5">
                                  <i className="fa-solid fa-flag-checkered" />
                                  <span>Misión Marciana ({routesMissionData.resumen_mision.total_rovers} Rovers)</span>
                                </span>
                                <span className="text-[0.62rem] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                                  {routesMissionData.resumen_mision.total_puntos_medicion} Waypoints
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
                                  <span className="text-[0.55rem] text-gray-400 block uppercase">Energía Batería</span>
                                  <span className="font-bold text-emerald-400 text-[0.75rem]">
                                    {routesMissionData.resumen_mision.energia_total_flota_wh} Wh
                                  </span>
                                  <span className="text-[0.5rem] text-gray-500 block">
                                    {routesMissionData.resumen_mision.energia_total_flota_j} J
                                  </span>
                                </div>
                              </div>

                              {/* Zonas de Elevación MOLA (Alta, Media, Baja) */}
                              <div className="p-2 bg-black/60 rounded-lg border border-white/5 space-y-1">
                                <span className="text-[0.58rem] text-gray-400 uppercase font-bold block">
                                  Zonas de Muestreo por Cota DEM:
                                </span>
                                <div className="grid grid-cols-3 gap-1 text-[0.58rem]">
                                  <div className="p-1 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300">
                                    <span className="block font-bold">🔴 Alta</span>
                                    <span>{routesMissionData.resumen_mision.zonas_elevacion?.zona_alta_m[0]}m a {routesMissionData.resumen_mision.zonas_elevacion?.zona_alta_m[1]}m</span>
                                  </div>
                                  <div className="p-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300">
                                    <span className="block font-bold">🟠 Media</span>
                                    <span>{routesMissionData.resumen_mision.zonas_elevacion?.zona_media_m[0]}m a {routesMissionData.resumen_mision.zonas_elevacion?.zona_media_m[1]}m</span>
                                  </div>
                                  <div className="p-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                                    <span className="block font-bold">🟢 Baja</span>
                                    <span>{routesMissionData.resumen_mision.zonas_elevacion?.zona_baja_m[0]}m a {routesMissionData.resumen_mision.zonas_elevacion?.zona_baja_m[1]}m</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Selector de Rover Activo para Inspeccionar */}
                            <div className="space-y-1.5">
                              <span className="text-[0.62rem] text-gray-400 uppercase font-bold block">
                                Seleccionar Rover para Inspeccionar Ruta:
                              </span>
                              <div className="grid grid-cols-2 gap-1.5">
                                {routesMissionData.rutas_rovers.map((r: any) => {
                                  const isSelected = selectedRoverRoute?.rover_id === r.rover_id;
                                  return (
                                    <button
                                      key={r.rover_id}
                                      type="button"
                                      onClick={() => setSelectedRoverRoute(r)}
                                      className={`p-2 rounded-xl border text-left transition-all flex items-center justify-between gap-1.5 cursor-pointer ${
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
                                          {r.metricas?.distancia_total_m}m • {r.metricas?.puntos_medicion_count} waypoints
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

                            {/* Detalle del Rover Seleccionado */}
                            {selectedRoverRoute && (
                              <div className="p-2.5 bg-black/60 rounded-xl border border-white/10 space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="w-3 h-3 rounded-full"
                                      style={{ backgroundColor: selectedRoverRoute.color }}
                                    />
                                    <span className="font-bold text-white text-[0.72rem]">
                                      {selectedRoverRoute.rover_nombre}
                                    </span>
                                  </div>
                                  <span className="text-[0.6rem] text-gray-400">
                                    Batería estimada: <b>{selectedRoverRoute.rover_bateria ?? 85}%</b>
                                  </span>
                                </div>

                                <div className="grid grid-cols-3 gap-1.5 text-center text-[0.65rem]">
                                  <div className="p-1 bg-white/5 rounded">
                                    <span className="text-gray-400 block text-[0.55rem]">Distancia</span>
                                    <b className="text-white">{selectedRoverRoute.metricas?.distancia_total_m} m</b>
                                  </div>
                                  <div className="p-1 bg-white/5 rounded">
                                    <span className="text-gray-400 block text-[0.55rem]">Tiempo</span>
                                    <b className="text-amber-300">{selectedRoverRoute.metricas?.tiempo_total_min} min</b>
                                  </div>
                                  <div className="p-1 bg-white/5 rounded">
                                    <span className="text-gray-400 block text-[0.55rem]">Gasto</span>
                                    <b className="text-emerald-400">{selectedRoverRoute.metricas?.energia_total_wh} Wh</b>
                                  </div>
                                </div>

                                {/* Lista de Waypoints */}
                                <div className="space-y-1">
                                  <span className="text-[0.58rem] text-gray-400 font-bold block uppercase">
                                    Secuencia de Paradas (Waypoints):
                                  </span>
                                  <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                                    {(selectedRoverRoute.waypoints || []).map((wp: any, wIdx: number) => (
                                      <div
                                        key={wIdx}
                                        className="p-1.5 rounded bg-black/40 border border-white/5 flex items-center justify-between text-[0.6rem]"
                                      >
                                        <div className="flex items-center gap-1.5">
                                          <span
                                            className="w-4 h-4 rounded-full flex items-center justify-center text-[0.55rem] font-bold text-white shrink-0"
                                            style={{ backgroundColor: wp.tipo === 'inicio' ? '#3b82f6' : selectedRoverRoute.color }}
                                          >
                                            {wp.tipo === 'inicio' ? '🏁' : wp.indice}
                                          </span>
                                          <span className="text-gray-300">
                                            {wp.tipo === 'inicio' ? 'Punto Despliegue' : `Parada #${wp.indice} (${wp.zona?.toUpperCase()})`}
                                          </span>
                                        </div>
                                        <div className="text-right text-[0.55rem] text-gray-400">
                                          <span className="text-white font-bold">{wp.elevacion_m}m</span>
                                          {wp.distancia_tramo_m > 0 && <span> • +{wp.distancia_tramo_m}m</span>}
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
            </div>

            {/* Barra Inferior con Información Geodésica y Guía */}
            <div className="p-2.5 bg-[#140e0b] border-t border-[#2d1b15] flex flex-wrap items-center justify-between gap-3 text-xs text-gray-400 shrink-0">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-circle-info text-[#ff4500]" />
                <span className="text-[0.68rem]">
                  {mapClickMode === 'polygon'
                    ? 'Modo Perímetro: Haz clic en el terreno para trazar vértices de la parcela marciana.'
                    : 'Modo Rover: Haz clic sobre el terreno para colocar un rover en esa coordenada.'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[0.65rem] text-gray-400">
                <span>Capa Activa: <strong className="text-orange-400">{activeTileProvider.shortName}</strong></span>
                <span>• Radio: 3,396 km</span>
                <span>• Vértices: {vertices.length}</span>
                <span>• Rovers: {assignedRovers.length}</span>
                {elevationData && (
                  <span className="text-emerald-400 font-bold">• MOLA: {elevationData.min}m a {elevationData.max}m</span>
                )}
                {routesMissionData && (
                  <span className="text-amber-400 font-bold">• Rutas IA: {routesMissionData.resumen_mision?.total_rovers} Rovers</span>
                )}
              </div>
            </div>
          </div>
        </div>

      {/* ═══════════════════════════════════════════════════════════════
          MODAL: SELECCIÓN Y ASIGNACIÓN DE ROVER DE LA BD
         ═══════════════════════════════════════════════════════════════ */}
      {roverModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#16100e] border border-[#2d1b15] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl font-mono">
            <div className="p-4 border-b border-[#2d1b15] flex items-center justify-between bg-black/40">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 text-base">
                  <i className="fa-solid fa-robot" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Posicionar Rover Marciano</h3>
                  <p className="text-[0.65rem] text-gray-400">
                    {pendingRoverCoord
                      ? `Coordenada seleccionada en el terreno: [${pendingRoverCoord.lat}°, ${pendingRoverCoord.lng}°]`
                      : 'Selecciona una unidad de la flota para desplegar en la parcela.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPendingRoverCoord(null);
                  setRoverModalOpen(false);
                }}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <i className="fa-solid fa-xmark text-sm" />
              </button>
            </div>

            <div className="p-4 max-h-96 overflow-y-auto space-y-2">
              {loadingRobots ? (
                <div className="p-6 text-center text-xs text-gray-400">
                  <i className="fa-solid fa-spinner animate-spin mr-2 text-amber-400" />
                  Cargando robots de la base de datos...
                </div>
              ) : availableRobots.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-400">
                  <i className="fa-solid fa-robot block text-xl mb-2 text-gray-600" />
                  No se encontraron rovers registrados en la BD.
                </div>
              ) : (
                availableRobots.map((robot) => {
                  const yaAsignado = assignedRovers.some((r) => r.robot_id === robot.id);
                  return (
                    <div
                      key={robot.id}
                      onClick={() => !yaAsignado && handleAsignarRobot(robot)}
                      className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                        yaAsignado
                          ? 'bg-black/30 border-white/5 opacity-50 cursor-not-allowed'
                          : 'bg-black/60 border-[#2d1b15] hover:border-amber-400 hover:bg-white/5 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-black/80 border border-white/10 flex items-center justify-center text-amber-400">
                          <i className="fa-solid fa-robot text-base" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-xs">{robot.nombre}</span>
                            <span className="text-[0.6rem] px-2 py-0.5 rounded-full bg-white/10 text-gray-300 font-bold uppercase">
                              {robot.modo || 'inyeccion'}
                            </span>
                            {yaAsignado && (
                              <span className="text-[0.58rem] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                Asignado
                              </span>
                            )}
                          </div>
                          <div className="text-[0.65rem] text-gray-400 flex items-center gap-3 mt-0.5">
                            <span>{robot.modelo || 'Myco Ares-1 Rover'}</span>
                            <span>• Batería: {robot.bateria ?? 80}%</span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={yaAsignado}
                        className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-black border border-amber-400/40 text-xs font-bold transition-all disabled:opacity-40"
                      >
                        {yaAsignado ? 'Asignado' : 'Elegir'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-3 bg-black/60 border-t border-[#2d1b15] flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setPendingRoverCoord(null);
                  setRoverModalOpen(false);
                }}
                className="px-4 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
