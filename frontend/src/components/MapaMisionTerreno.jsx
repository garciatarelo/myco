import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import * as turf from '@turf/turf';
import 'mapbox-gl/dist/mapbox-gl.css';
import mycoLogo from '../assets/myco.png';

const rawToken = import.meta.env.VITE_MAPBOX_TOKEN || '';
const mapboxAccessToken = rawToken.replace(/['"]/g, '').trim();
mapboxgl.accessToken = mapboxAccessToken;

// ─── ESTILO SATELITAL PARA TIERRA (ESRI WORLD IMAGERY - SIN RESTRICCIÓN DE TOKEN 403) ───
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

// ─── ESTILO OFICIAL MARTE (NASA VIKING MDIM 2.1 - GLOBAL 232M MOSAIC) ───
const MARS_VIKING_STYLE = {
  version: 8,
  name: 'Mars Viking MDIM 2.1',
  sources: {
    'nasa-mars': {
      type: 'raster',
      tiles: [
        'https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/{z}/{y}/{x}.jpg',
      ],
      tileSize: 256,
      maxzoom: 12,
      attribution: '© NASA Mars Trek / Viking MDIM 2.1',
    },
  },
  layers: [
    {
      id: 'mars-bg',
      type: 'background',
      paint: { 'background-color': '#0d0907' },
    },
    {
      id: 'nasa-mars-layer',
      type: 'raster',
      source: 'nasa-mars',
      paint: {
        'raster-fade-duration': 300,
        'raster-contrast': 0.15,
        'raster-saturation': 0.1,
      },
    },
  ],
};

const MAPBOX_SATELLITE_STREETS = 'mapbox://styles/mapbox/satellite-streets-v12';

export function MapaMisionTerreno({
  terreno,
  robots = [],
  estaciones = [],
  mediciones = [],
  inyecciones = [],
  marcadorSeleccionado = null,
  onSelectMarker = () => {},
  simRoversPositions = [],
  isExpanded = false,
  onToggleExpand = null,
  rutasRovers = null,
  clustersMuestreo = null,
  onMapClick = null,
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const isLoadedRef = useRef(false);

  // Referencias a los marcadores DOM de MapBox
  const markersRef = useRef({
    mediciones: [],
    inyecciones: [],
    robots: {},
    estaciones: [],
  });
  const routePopupsRef = useRef([]);

  const [showRutas, setShowRutas] = useState(true);
  const [showClusters, setShowClusters] = useState(true);

  const [mapError, setMapError] = useState('');
  const [providerNotice, setProviderNotice] = useState('');
  const [activeProvider, setActiveProvider] = useState('auto'); // 'auto' | 'mapbox'
  const [cursorCoords, setCursorCoords] = useState(null);

  const isMarte = terreno?.entorno === 'marte';
  const activeRutas = rutasRovers || terreno?.rutas_rovers;
  const activeClusters = clustersMuestreo || terreno?.clusters_muestreo;

  // ─── OBTENER POLÍGONO DEL TERRENO ───
  const getPolygonFeature = useCallback(() => {
    if (!terreno) return null;

    let coords = terreno.poligono_coordenadas;
    const center = [
      Number(terreno.longitud_central) || (isMarte ? 77.58 : -107.9025),
      Number(terreno.latitud_central) || (isMarte ? 18.38 : 30.3485),
    ];

    if (!coords || !Array.isArray(coords) || coords.length < 3) {
      const areaM2 = Number(terreno.dimensiones_m2) || (isMarte ? 50000 : 25000);
      const sideKm = Math.sqrt(areaM2) / 1000;
      const radiusKm = (sideKm * Math.sqrt(2)) / 2;
      const square = turf.bboxPolygon(turf.bbox(turf.circle(center, radiusKm, { units: 'kilometers' })));
      coords = square.geometry.coordinates[0];
    } else {
      if (Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
        coords = coords[0];
      }
    }

    // Cerrar el polígono
    const first = coords[0];
    const last = coords[coords.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      coords = [...coords, first];
    }

    return {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [coords],
      },
      properties: {
        nombre: terreno.nombre,
        entorno: terreno.entorno,
      },
    };
  }, [terreno, isMarte]);

  // ─── AGREGAR CAPAS DE POLÍGONO DE PARCELA AL MAPA ───
  const addPolygonLayersToMap = useCallback((map) => {
    if (!map) return;
    const polyFeature = getPolygonFeature();
    if (!polyFeature) return;

    if (!map.getSource('parcela-poligono')) {
      map.addSource('parcela-poligono', {
        type: 'geojson',
        data: polyFeature,
      });

      map.addLayer({
        id: 'parcela-fill',
        type: 'fill',
        source: 'parcela-poligono',
        paint: {
          'fill-color': isMarte ? '#ff4500' : '#10b981',
          'fill-opacity': isMarte ? 0.2 : 0.14,
        },
      });

      map.addLayer({
        id: 'parcela-outline',
        type: 'line',
        source: 'parcela-poligono',
        paint: {
          'line-color': isMarte ? '#ff4500' : '#00e5ff',
          'line-width': 2.5,
          'line-dasharray': [3, 2],
        },
      });
    } else {
      map.getSource('parcela-poligono').setData(polyFeature);
    }

    try {
      const bbox = turf.bbox(polyFeature);
      map.fitBounds(bbox, {
        padding: 55,
        duration: 1200,
        maxZoom: isMarte ? 8.5 : 17,
      });
    } catch (e) {
      console.warn('fitBounds error:', e);
    }
  }, [getPolygonFeature, isMarte]);

  // ─── LIMPIAR CAPAS DE RUTAS Y CLUSTERS EN MAPBOX ───
  const limpiarCapasRutas = useCallback((map) => {
    routePopupsRef.current.forEach((p) => p.remove());
    routePopupsRef.current = [];

    if (!map) return;
    try {
      if (map.getLayer('rover-mission-clusters-core')) map.removeLayer('rover-mission-clusters-core');
      if (map.getLayer('rover-mission-clusters-ring')) map.removeLayer('rover-mission-clusters-ring');
      if (map.getSource('rover-mission-clusters')) map.removeSource('rover-mission-clusters');

      if (map.getLayer('rover-mission-routes-line')) map.removeLayer('rover-mission-routes-line');
      if (map.getLayer('rover-mission-routes-glow')) map.removeLayer('rover-mission-routes-glow');
      if (map.getSource('rover-mission-routes')) map.removeSource('rover-mission-routes');
    } catch (e) {
      // Ignorar si aún no existían
    }
  }, []);

  // ─── RENDERIZAR CAPAS DE RUTAS Y CLUSTERS EN MAPBOX ───
  const renderizarCapasRutas = useCallback((map) => {
    if (!map || !isLoadedRef.current) return;
    limpiarCapasRutas(map);

    const routesList = activeRutas;
    if (!routesList || !Array.isArray(routesList) || routesList.length === 0) return;

    if (showRutas) {
      const routesFeatures = routesList
        .filter((r) => r.coordenadas_ruta && r.coordenadas_ruta.length > 1)
        .map((r) => ({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: r.coordenadas_ruta,
          },
          properties: {
            rover_id: r.rover_id,
            rover_nombre: r.rover_nombre,
            color: r.color || '#00e5ff',
          },
        }));

      if (routesFeatures.length > 0) {
        map.addSource('rover-mission-routes', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: routesFeatures },
        });

        map.addLayer({
          id: 'rover-mission-routes-glow',
          type: 'line',
          source: 'rover-mission-routes',
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 6,
            'line-opacity': 0.35,
            'line-blur': 2,
          },
        });

        map.addLayer({
          id: 'rover-mission-routes-line',
          type: 'line',
          source: 'rover-mission-routes',
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 3.2,
            'line-opacity': 0.95,
          },
        });
      }
    }

    if (showClusters) {
      const clusterPointsFeatures = routesList.flatMap((r) =>
        (r.waypoints || [])
          .filter((wp) => wp.tipo === 'medicion' || wp.tipo === 'cluster')
          .map((wp) => ({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [Number(wp.lng), Number(wp.lat)],
            },
            properties: {
              rover_id: r.rover_id,
              rover_nombre: r.rover_nombre,
              color: r.color || '#00e5ff',
              indice: wp.indice,
              elevacion_m: wp.elevacion_m,
              zona: wp.zona,
              distancia_tramo_m: wp.distancia_tramo_m,
              energia_tramo_j: wp.energia_tramo_j,
            },
          }))
      );

      if (clusterPointsFeatures.length > 0) {
        map.addSource('rover-mission-clusters', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: clusterPointsFeatures },
        });

        map.addLayer({
          id: 'rover-mission-clusters-ring',
          type: 'circle',
          source: 'rover-mission-clusters',
          paint: {
            'circle-radius': 9,
            'circle-color': ['get', 'color'],
            'circle-opacity': 0.25,
          },
        });

        map.addLayer({
          id: 'rover-mission-clusters-core',
          type: 'circle',
          source: 'rover-mission-clusters',
          paint: {
            'circle-radius': 5.5,
            'circle-color': ['get', 'color'],
            'circle-stroke-width': 1.8,
            'circle-stroke-color': '#ffffff',
          },
        });

        map.on('click', 'rover-mission-clusters-core', (e) => {
          if (!e.features || !e.features[0]) return;
          const f = e.features[0];
          const p = f.properties;
          const coords = f.geometry.coordinates;

          const popupHtml = `
            <div style="font-family: monospace; font-size: 11px; color: #fff; background: #121212; padding: 8px 10px; border-radius: 8px; border: 1px solid ${p.color}; min-width: 170px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <strong style="color:${p.color}; font-size:11px;">🤖 ${p.rover_nombre}</strong>
                <span style="font-size:9px; background:${p.color}33; color:${p.color}; padding:1px 4px; border-radius:3px;">#${p.indice}</span>
              </div>
              <div style="font-size:10px; color:#bbb;">
                <b>Elevación:</b> ${p.elevacion_m}m (${p.zona?.toUpperCase()})<br/>
                <b>Tramo:</b> +${p.distancia_tramo_m || 0}m | ~${p.energia_tramo_j || 0}J
              </div>
            </div>
          `;

          const pop = new mapboxgl.Popup({ offset: 10 })
            .setLngLat(coords)
            .setHTML(popupHtml)
            .addTo(map);

          routePopupsRef.current.push(pop);
        });
      }
    }
  }, [activeRutas, showRutas, showClusters, limpiarCapasRutas]);

  // ─── INICIALIZACIÓN DEL MAPA ───
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
      isLoadedRef.current = false;
    }

    const center = [
      Number(terreno?.longitud_central) || (isMarte ? 77.58 : -107.9025),
      Number(terreno?.latitud_central) || (isMarte ? 18.38 : 30.3485),
    ];

    const initialZoom = isMarte ? 7.5 : 15.2;

    // Seleccionar estilo base garantizado:
    // Para Marte: Mosaico oficial NASA Viking
    // Para Tierra: Esri World Imagery (si activeProvider !== 'mapbox'), o Mapbox si el usuario lo solicitó explícitamente
    const targetStyle = isMarte
      ? MARS_VIKING_STYLE
      : activeProvider === 'mapbox' && mapboxAccessToken
      ? MAPBOX_SATELLITE_STREETS
      : EARTH_SATELLITE_STYLE;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: targetStyle,
      center,
      zoom: initialZoom,
      pitch: 20,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'top-right');

    // Manejar errores de permisos (403 Forbidden de Mapbox) de forma proactiva
    map.on('error', (e) => {
      if (e?.error?.status === 403 || e?.status === 403 || (e?.error?.message && e.error.message.includes('Forbidden'))) {
        console.warn('[MapBox] 403 Forbidden detectado en token. Conmutando a proveedor satelital global garantizado.');
        setProviderNotice('Token de MapBox con acceso restringido (403). Visualizando con Esri Satellite & NASA Mars Trek.');
        if (activeProvider === 'mapbox' && !isMarte) {
          setActiveProvider('auto');
          map.setStyle(EARTH_SATELLITE_STYLE);
        }
      }
    });

    map.on('load', () => {
      isLoadedRef.current = true;
      addPolygonLayersToMap(map);
      renderizarCapasRutas(map);
    });

    map.on('mousemove', (e) => {
      setCursorCoords({
        lng: e.lngLat.lng.toFixed(5),
        lat: e.lngLat.lat.toFixed(5),
      });
    });

    map.on('click', (e) => {
      if (onMapClick) {
        onMapClick(e);
      }
    });

    mapRef.current = map;

    return () => {
      clearAllMarkers();
      limpiarCapasRutas(map);
      map.remove();
      mapRef.current = null;
      isLoadedRef.current = false;
    };
  }, [terreno?.id, isMarte, activeProvider, addPolygonLayersToMap, renderizarCapasRutas, limpiarCapasRutas]);

  // Sincronizar capas de rutas cuando cambian rutas o visibilidad
  useEffect(() => {
    if (mapRef.current && isLoadedRef.current) {
      renderizarCapasRutas(mapRef.current);
    }
  }, [renderizarCapasRutas, activeRutas, showRutas, showClusters]);

  // Observador de redimensionamiento automático (ResizeObserver) para MapBox
  useEffect(() => {
    if (!mapContainerRef.current) return;
    const observer = new ResizeObserver(() => {
      mapRef.current?.resize();
    });
    observer.observe(mapContainerRef.current);
    return () => observer.disconnect();
  }, []);

  // Forzar recálculo del canvas al cambiar isExpanded
  useEffect(() => {
    const timer = setTimeout(() => {
      mapRef.current?.resize();
    }, 200);
    return () => clearTimeout(timer);
  }, [isExpanded]);

  // ─── LIMPIAR MARCADORES ───
  function clearAllMarkers() {
    markersRef.current.mediciones.forEach((m) => m.remove());
    markersRef.current.mediciones = [];

    markersRef.current.inyecciones.forEach((m) => m.remove());
    markersRef.current.inyecciones = [];

    markersRef.current.estaciones.forEach((m) => m.remove());
    markersRef.current.estaciones = [];

    Object.values(markersRef.current.robots).forEach((m) => m.remove());
    markersRef.current.robots = {};
  }

  // ─── RENDERIZAR MARCADORES DE MEDICIONES ───
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.mediciones.forEach((m) => m.remove());
    markersRef.current.mediciones = [];

    mediciones.forEach((m) => {
      const lon = Number(m.longitud);
      const lat = Number(m.latitud);
      if (isNaN(lon) || isNaN(lat)) return;

      const isSelected = marcadorSeleccionado?.tipo === 'medicion' && marcadorSeleccionado.data.id === m.id;
      const isOptimo = m.es_optimo_inyeccion;

      const el = document.createElement('div');
      el.className = 'myco-map-marker group cursor-pointer transition-transform duration-200 hover:scale-130';
      el.style.width = isSelected ? '22px' : '16px';
      el.style.height = isSelected ? '22px' : '16px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = isOptimo ? '#00e5ff' : '#64748b';
      el.style.border = isSelected ? '2px solid #ffffff' : '1.5px solid rgba(255,255,255,0.85)';
      el.style.boxShadow = isOptimo
        ? '0 0 14px rgba(0, 229, 255, 0.9), inset 0 0 4px rgba(255,255,255,0.8)'
        : '0 0 6px rgba(0,0,0,0.5)';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';

      const inner = document.createElement('div');
      inner.style.width = '6px';
      inner.style.height = '6px';
      inner.style.borderRadius = '50%';
      inner.style.backgroundColor = '#ffffff';
      el.appendChild(inner);

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([lon, lat])
        .addTo(map);

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelectMarker({ tipo: 'medicion', data: m });
        map.easeTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), isMarte ? 8 : 16), duration: 800 });
      });

      markersRef.current.mediciones.push(marker);
    });
  }, [mediciones, marcadorSeleccionado, isMarte, onSelectMarker]);

  // ─── RENDERIZAR MARCADORES DE INYECCIONES ───
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.inyecciones.forEach((m) => m.remove());
    markersRef.current.inyecciones = [];

    inyecciones.forEach((iny) => {
      const lon = Number(iny.longitud);
      const lat = Number(iny.latitud);
      if (isNaN(lon) || isNaN(lat)) return;

      const isSelected = marcadorSeleccionado?.tipo === 'inyeccion' && marcadorSeleccionado.data.id === iny.id;

      const el = document.createElement('div');
      el.className = 'myco-map-injection cursor-pointer transition-transform duration-200 hover:scale-130';
      el.style.width = isSelected ? '26px' : '20px';
      el.style.height = isSelected ? '26px' : '20px';
      el.style.backgroundColor = '#ff4500';
      el.style.transform = 'rotate(45deg)';
      el.style.border = isSelected ? '2.5px solid #ffffff' : '1.5px solid #ffaa80';
      el.style.borderRadius = '4px';
      el.style.boxShadow = '0 0 14px rgba(255, 69, 0, 0.9)';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';

      const inner = document.createElement('span');
      inner.innerText = (iny.grado_capsula || 'A').charAt(0).toUpperCase();
      inner.style.transform = 'rotate(-45deg)';
      inner.style.color = '#ffffff';
      inner.style.fontSize = '9px';
      inner.style.fontWeight = 'bold';
      inner.style.fontFamily = 'monospace';
      el.appendChild(inner);

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([lon, lat])
        .addTo(map);

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelectMarker({ tipo: 'inyeccion', data: iny });
        map.easeTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), isMarte ? 8 : 16), duration: 800 });
      });

      markersRef.current.inyecciones.push(marker);
    });
  }, [inyecciones, marcadorSeleccionado, isMarte, onSelectMarker]);

  // ─── RENDERIZAR ESTACIONES BASE ───
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.estaciones.forEach((m) => m.remove());
    markersRef.current.estaciones = [];

    estaciones.forEach((est) => {
      const lon = Number(est.longitud);
      const lat = Number(est.latitud);
      if (isNaN(lon) || isNaN(lat)) return;

      const el = document.createElement('div');
      el.className = 'myco-base-dock flex flex-col items-center cursor-pointer';
      el.innerHTML = `
        <div style="background: rgba(245, 158, 11, 0.9); border: 2px solid #ffffff; width: 22px; height: 22px; border-radius: 6px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px rgba(245, 158, 11, 0.8);">
          <span style="font-size: 10px; color: #111; font-weight: 900;">⬡</span>
        </div>
        <span style="font-size: 8px; font-weight: bold; color: #f59e0b; background: rgba(0,0,0,0.85); padding: 1px 4px; border-radius: 4px; margin-top: 2px; white-space: nowrap; border: 1px solid rgba(245, 158, 11, 0.4);">
          BASE-${est.id}
        </span>
      `;

      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([lon, lat])
        .addTo(map);

      markersRef.current.estaciones.push(marker);
    });
  }, [estaciones]);

  // ─── RENDERIZAR ROBOTS EN VIVO (O ANIMACIÓN DE SIMULACIÓN) ───
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const roversToRender = simRoversPositions.length > 0 ? simRoversPositions : robots;

    roversToRender.forEach((r) => {
      const lon = Number(r.lon || r.longitud || (isMarte ? r.longitud_marte : null) || terreno?.longitud_central);
      const lat = Number(r.lat || r.latitud || (isMarte ? r.latitud_marte : null) || terreno?.latitud_central);
      if (isNaN(lon) || isNaN(lat)) return;

      const isLectura = r.modo === 'lectura';
      const colorModo = isLectura ? '#00e5ff' : '#ff4500';

      let markerObj = markersRef.current.robots[r.id];

      if (!markerObj) {
        const el = document.createElement('div');
        el.className = 'myco-rover-marker flex flex-col items-center cursor-pointer transition-all';
        el.innerHTML = `
          <div class="relative flex items-center justify-center">
            <div style="position: absolute; width: 34px; height: 34px; border-radius: 50%; border: 1.5px dashed ${colorModo}; animation: spin 8s linear infinite; opacity: 0.7;"></div>
            <div style="width: 26px; height: 26px; border-radius: 50%; background: #181818; border: 2px solid ${colorModo}; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 12px ${colorModo};">
              <img src="${mycoLogo}" style="width: 16px; height: 16px; object-fit: contain;" />
            </div>
            <span style="position: absolute; top: -6px; right: -8px; background: ${r.bateria < 30 ? '#ef4444' : '#10b981'}; color: white; font-size: 7px; font-weight: bold; padding: 0.5px 3px; border-radius: 8px; border: 1px solid #111;">
              ${r.bateria || 85}%
            </span>
          </div>
          <span style="font-size: 8px; font-weight: bold; color: #ffffff; background: rgba(0,0,0,0.85); padding: 1px 5px; border-radius: 4px; margin-top: 3px; border: 1px solid rgba(255,255,255,0.15); white-space: nowrap;">
            ${r.nombre} · <strong style="color: ${colorModo}">${isLectura ? 'SCAN' : 'INJ'}</strong>
          </span>
        `;

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onSelectMarker({ tipo: 'robot', data: r });
          map.easeTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), isMarte ? 8 : 16), duration: 600 });
        });

        const newMarker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([lon, lat])
          .addTo(map);

        markersRef.current.robots[r.id] = newMarker;
      } else {
        markerObj.setLngLat([lon, lat]);
      }
    });

    Object.keys(markersRef.current.robots).forEach((id) => {
      if (!roversToRender.find((r) => String(r.id) === String(id))) {
        markersRef.current.robots[id].remove();
        delete markersRef.current.robots[id];
      }
    });
  }, [robots, simRoversPositions, terreno, isMarte, onSelectMarker]);

  // ─── ACCIÓN: ENFOCAR PARCELA ───
  function handleCenterParcel() {
    const map = mapRef.current;
    if (!map) return;
    const polyFeature = getPolygonFeature();
    if (!polyFeature) return;

    try {
      const bbox = turf.bbox(polyFeature);
      map.fitBounds(bbox, {
        padding: 60,
        duration: 1200,
        maxZoom: isMarte ? 9 : 17,
      });
    } catch (e) {
      console.warn('fitBounds error:', e);
    }
  }

  // ─── CONMUTAR ENTRE SATÉLITE GLOBAL Y MAPBOX ───
  function handleToggleProvider(provider) {
    setActiveProvider(provider);
    const map = mapRef.current;
    if (!map) return;

    if (provider === 'mapbox' && !isMarte) {
      map.setStyle(MAPBOX_SATELLITE_STREETS);
    } else {
      map.setStyle(isMarte ? MARS_VIKING_STYLE : EARTH_SATELLITE_STYLE);
    }

    map.once('style.load', () => {
      addPolygonLayersToMap(map);
      renderizarCapasRutas(map);
    });
  }

  return (
    <div className="relative w-full h-full min-h-[440px] rounded-xl overflow-hidden border border-[#262626] bg-[#0b0b0b]">
      {/* Contenedor DOM para Mapbox GL */}
      <div ref={mapContainerRef} className="w-full h-full min-h-[440px]" />

      {/* ─── HUD OVERLAY TÁCTICO: CABECERA Y METADATOS ─── */}
      <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-2 pointer-events-auto">
        <div className="px-2.5 py-1 rounded-lg bg-black/85 backdrop-blur-md border border-white/10 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: isMarte ? '#ff4500' : '#10b981' }} />
          <span className="text-[0.65rem] font-mono font-bold text-white uppercase tracking-wider">
            {isMarte ? 'NASA Viking MDIM 2.1 · Marte' : 'Satélite HD Global · Tierra'}
          </span>
        </div>

        <button
          onClick={handleCenterParcel}
          className="px-2.5 py-1 rounded-lg bg-black/85 hover:bg-black backdrop-blur-md border border-white/10 hover:border-[#ff4500] text-[0.65rem] font-mono text-gray-200 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
          title="Centrar y ajustar cámara al perímetro del terreno"
        >
          <i className="fa-solid fa-crosshairs text-[#ff4500]" />
          <span>Enfocar Parcela</span>
        </button>

        {!isMarte && (
          <div className="hidden sm:flex items-center gap-1 bg-black/85 backdrop-blur-md p-0.5 rounded-lg border border-white/10 text-[0.6rem] font-mono">
            <button
              onClick={() => handleToggleProvider('auto')}
              className={`px-2 py-0.5 rounded transition-colors ${
                activeProvider === 'auto' ? 'bg-[#ff4500] text-white font-bold' : 'text-gray-400 hover:text-white'
              }`}
              title="Capa satelital directa sin restricciones de token"
            >
              Satélite HD
            </button>
            <button
              onClick={() => handleToggleProvider('mapbox')}
              className={`px-2 py-0.5 rounded transition-colors ${
                activeProvider === 'mapbox' ? 'bg-[#ff4500] text-white font-bold' : 'text-gray-400 hover:text-white'
              }`}
              title="Estilo Mapbox Satellite Streets (requiere permisos de token)"
            >
              Mapbox Streets
            </button>
          </div>
        )}

        {/* Toggles de Capas de Rutas & Clusters */}
        {activeRutas && activeRutas.length > 0 && (
          <div className="flex items-center gap-1 bg-black/85 backdrop-blur-md p-0.5 rounded-lg border border-white/10 text-[0.6rem] font-mono">
            <button
              onClick={() => setShowRutas(!showRutas)}
              className={`px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${
                showRutas ? 'bg-cyan-500 text-black font-bold' : 'text-gray-400 hover:text-white'
              }`}
              title="Mostrar u ocultar trayectorias de Rovers"
            >
              <i className="fa-solid fa-route" />
              <span>Rutas IA</span>
            </button>
            <button
              onClick={() => setShowClusters(!showClusters)}
              className={`px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${
                showClusters ? 'bg-amber-500 text-black font-bold' : 'text-gray-400 hover:text-white'
              }`}
              title="Mostrar u ocultar waypoints de muestreo"
            >
              <i className="fa-solid fa-bullseye" />
              <span>Clusters</span>
            </button>
          </div>
        )}

        {onToggleExpand && (
          <button
            onClick={onToggleExpand}
            className={`px-2.5 py-1 rounded-lg backdrop-blur-md border text-[0.65rem] font-mono flex items-center gap-1.5 transition-all cursor-pointer ${
              isExpanded
                ? 'bg-[#ff4500] text-white border-[#ff4500] font-bold shadow-[0_0_12px_rgba(255,69,0,0.5)]'
                : 'bg-black/85 hover:bg-black border-white/10 hover:border-[#ff4500] text-gray-200 hover:text-white'
            }`}
            title={isExpanded ? 'Contraer mapa a vista estándar' : 'Expandir mapa al 100%'}
          >
            <i className={`fa-solid ${isExpanded ? 'fa-compress' : 'fa-expand'}`} />
            <span>{isExpanded ? 'Contraer' : 'Expandir 100%'}</span>
          </button>
        )}
      </div>

      {/* ─── NOTIFICACIÓN INFORMATIVA DE TOKEN SI APLICA ─── */}
      {providerNotice && (
        <div className="absolute top-12 left-3 z-10 hidden md:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-black/90 border border-amber-500/30 text-[0.6rem] font-mono text-amber-400 backdrop-blur-md animate-fadeIn">
          <i className="fa-solid fa-circle-info text-amber-400" />
          <span>{providerNotice}</span>
          <button onClick={() => setProviderNotice('')} className="text-gray-400 hover:text-white ml-1">
            <i className="fa-solid fa-xmark text-[0.55rem]" />
          </button>
        </div>
      )}

      {/* ─── HUD INFERIOR: COORDENADAS DEL CURSOR EN VIVO ─── */}
      {cursorCoords && (
        <div className="absolute top-3 right-14 z-10 hidden md:flex items-center gap-2 px-2 py-0.5 rounded bg-black/80 backdrop-blur-md border border-white/10 text-[0.6rem] font-mono text-gray-300">
          <span className="text-gray-500">CURSOR</span>
          <span className="text-cyan-400">{cursorCoords.lat}°N</span>
          <span className="text-gray-600">|</span>
          <span className="text-[#ff4500]">{cursorCoords.lng}°E</span>
        </div>
      )}

      {/* ─── LEYENDA TÁCTICA FLOTANTE EN ESQUINA INFERIOR IZQUIERDA ─── */}
      <div className="absolute bottom-3 left-3 z-10 bg-black/85 backdrop-blur-md px-3 py-2 rounded-xl border border-white/10 shadow-2xl flex flex-wrap items-center gap-3 text-[0.6rem] font-mono text-gray-300 pointer-events-auto">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#00e5ff] shadow-[0_0_8px_#00e5ff] inline-block" />
          <span>Muestra Suelo ({mediciones.length})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 bg-[#ff4500] rotate-45 border border-white/50 shadow-[0_0_8px_#ff4500] inline-block" />
          <span>Inoculación ({inyecciones.length})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <img src={mycoLogo} className="w-3.5 h-3.5 object-contain" alt="Myco" />
          <span>Myco Rover ({robots.length})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-amber-400 font-bold">⬡</span>
          <span>Base Dock ({estaciones.length})</span>
        </div>
        {activeRutas && activeRutas.length > 0 && (
          <>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-1 rounded-full bg-cyan-400 inline-block shadow-[0_0_6px_#00e5ff]" />
              <span>Rutas Rovers ({activeRutas.length})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full border border-white bg-amber-400 inline-block shadow-[0_0_6px_#f59e0b]" />
              <span>Clusters Muestreo</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
