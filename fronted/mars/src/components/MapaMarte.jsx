import React, { useEffect, useState, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import * as turf from '@turf/turf';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

const mapboxAccessToken = import.meta.env.VITE_MAPBOX_TOKEN;
const mapStyleUrl = 'mapbox://styles/mapbox/satellite-streets-v12';
const chihuahuaRuralCenter = [-107.9025, 30.3485];
const chihuahuaRuralZoom = 15.1;
const demoRobots = [
  { id: 1, nombre: 'Rover-01', estado: 'activo', bateria: 85, coordinates: [-107.9042, 30.3489] },
  { id: 2, nombre: 'Rover-02', estado: 'mantenimiento', bateria: 62, coordinates: [-107.8998, 30.3474] },
];

mapboxgl.accessToken = mapboxAccessToken ?? '';

export function MapaMarte({ 
  activeMap = 'earth', 
  setActiveMap, 
  generatedRoute = null, 
  routeStatus = 'idle', 
  onRouteCompleted = () => {}, 
  onRouteSelected,
  refreshToken = 0,
  batteryLevel = 85,
  failsafeStatus = 'NORMAL',
  setArea,
  setPolygonCoords,
  isAnalyzing = false,
  robots = [] 
}) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const draw = useRef(null);
  const animacionRef = useRef(null);
  const inyeccionRef = useRef(null);
  const [mapError, setMapError] = useState('');
  
  const [frozenPolygonFeature, setFrozenPolygonFeature] = useState(null);
  const [, setFrozenPolygonHistory] = useState([]);
  const [, setRouteHistoryFeatures] = useState([]);
  const [, setInjectionHistoryFeatures] = useState([]);

  const syncFrozenPolygonLayer = (features) => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    const collection = {
      type: 'FeatureCollection',
      features: features.filter(Boolean),
    };

    const frozenSource = map.current.getSource('frozenPolygon');
    if (frozenSource) {
      frozenSource.setData(collection);
      return;
    }

    map.current.addSource('frozenPolygon', { type: 'geojson', data: collection });
    map.current.addLayer({
      id: 'frozenPolygonFill',
      type: 'fill',
      source: 'frozenPolygon',
      paint: { 'fill-color': '#ff4500', 'fill-opacity': 0.1 },
    });
    map.current.addLayer({
      id: 'frozenPolygonOutline',
      type: 'line',
      source: 'frozenPolygon',
      paint: { 'line-color': '#ff4500', 'line-width': 2, 'line-dasharray': [5, 5] },
    });
  };

  const fleetForMap = robots.length > 0 ? robots : demoRobots;

  const getDemoRobotCollection = () => ({
    type: 'FeatureCollection',
    features: fleetForMap.map((robot) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: robot.coordinates,
      },
      properties: {
        id: robot.id,
        nombre: robot.nombre,
        estado: robot.estado,
        estadoLabel: robot.estado === 'ocupado' ? 'Ocupado' : 'Libre',
        bateria: robot.bateria,
        color: robot.estado === 'ocupado' ? '#ff7070' : '#5af7cf',
      },
    })),
  });

  useEffect(() => {
    if (!mapboxAccessToken) {
      setMapError('Falta configurar VITE_MAPBOX_TOKEN para usar Mapbox GL JS.');
      return;
    }

    if (map.current) return; 

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: mapStyleUrl,
      center: chihuahuaRuralCenter,
      zoom: chihuahuaRuralZoom
    });

    draw.current = new MapboxDraw({
      displayControlsDefault: false,
      controls: { polygon: true, trash: true },
      defaultMode: 'draw_polygon'
    });

    map.current.addControl(draw.current);

    const procesarPoligono = () => {
      const data = draw.current.getAll();
      if (data.features.length > 0) {
        const poligono = data.features[0];
        setFrozenPolygonFeature(poligono);
        if (setPolygonCoords) setPolygonCoords(poligono.geometry.coordinates);
        if (setArea) setArea(Math.round(turf.area(poligono)));
      }
    };

    map.current.on('draw.create', procesarPoligono);
    map.current.on('draw.update', procesarPoligono);
    map.current.on('draw.delete', () => {
      if (setArea) setArea(0);
      if (setPolygonCoords) setPolygonCoords(null);
      setFrozenPolygonFeature(null);
      if (map.current.getSource('ruta-inyeccion')) map.current.getSource('ruta-inyeccion').setData({ type: 'FeatureCollection', features: [] });
      if (map.current.getSource('robot-animado')) map.current.getSource('robot-animado').setData({ type: 'FeatureCollection', features: [] });
      if (map.current.getSource('inyeccion-puntos')) map.current.getSource('inyeccion-puntos').setData({ type: 'FeatureCollection', features: [] });
      inyeccionRef.current = null;
    });

    map.current.on('load', () => {
      map.current.addSource('mars-tiles', {
        type: 'raster',
        tiles: ['https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/{z}/{y}/{x}.jpg'],
        tileSize: 256
      });
      map.current.addLayer({
        id: 'mars-layer',
        type: 'raster',
        source: 'mars-tiles',
        layout: { visibility: activeMap === 'mars' ? 'visible' : 'none' }
      });

      map.current.getCanvasContainer().style.cursor = 'crosshair';

      map.current.addSource('ruta-inyeccion', { type: 'geojson', data: { type: 'FeatureCollection', features: [] }});
      map.current.addLayer({
        id: 'linea-ruta', type: 'line', source: 'ruta-inyeccion',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#5af7cf', 'line-width': 4, 'line-dasharray': [2, 2] }
      });

      map.current.addSource('ruta-historial', { type: 'geojson', data: { type: 'FeatureCollection', features: [] }});
      map.current.addLayer({
        id: 'linea-ruta-historial',
        type: 'line',
        source: 'ruta-historial',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#5af7cf', 'line-width': 4, 'line-dasharray': [2, 2], 'line-opacity': 0.65 }
      });

      map.current.addSource('robot-animado', { type: 'geojson', data: { type: 'FeatureCollection', features: [] }});
      map.current.addLayer({
        id: 'punto-robot', type: 'circle', source: 'robot-animado',
        paint: { 'circle-radius': 5, 'circle-color': '#ff4500', 'circle-stroke-width': 1, 'circle-stroke-color': '#ffffff' }
      });

      map.current.addSource('inyeccion-puntos', { type: 'geojson', data: { type: 'FeatureCollection', features: [] }});
      map.current.addLayer({
        id: 'inyeccion-puntos-layer',
        type: 'circle',
        source: 'inyeccion-puntos',
        paint: {
          'circle-radius': 2.5,
          'circle-color': '#5af7cf',
          'circle-opacity': 0.95,
          'circle-stroke-width': 0,
        }
      });

      map.current.addSource('inyeccion-historial', { type: 'geojson', data: { type: 'FeatureCollection', features: [] }});
      map.current.addLayer({
        id: 'inyeccion-historial-layer',
        type: 'circle',
        source: 'inyeccion-historial',
        paint: {
          'circle-radius': 2.5,
          'circle-color': '#5af7cf',
          'circle-opacity': 0.55,
          'circle-stroke-width': 0,
        }
      });

      map.current.addSource('robots-demo', { type: 'geojson', data: getDemoRobotCollection() });
      map.current.addLayer({
        id: 'robots-demo-points',
        type: 'circle',
        source: 'robots-demo',
        paint: {
          'circle-radius': 8,
          'circle-color': ['coalesce', ['get', 'color'], '#5af7cf'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#111827',
        },
      });
      map.current.addLayer({
        id: 'robots-demo-labels',
        type: 'symbol',
        source: 'robots-demo',
        layout: {
          'text-field': ['concat', ['get', 'nombre'], ' · ', ['get', 'estadoLabel']],
          'text-size': 12,
          'text-offset': [0, 1.25],
          'text-anchor': 'top',
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#111111',
          'text-halo-width': 1.2,
        },
      });
    });
  }, []);

  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    const robotsSource = map.current.getSource('robots-demo');
    if (robotsSource) {
      robotsSource.setData(getDemoRobotCollection());
    }

    const visibility = activeMap === 'earth' ? 'visible' : 'none';
    if (map.current.getLayer('robots-demo-points')) map.current.setLayoutProperty('robots-demo-points', 'visibility', visibility);
    if (map.current.getLayer('robots-demo-labels')) map.current.setLayoutProperty('robots-demo-labels', 'visibility', visibility);
  }, [activeMap, refreshToken, robots]);

  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    if (activeMap === 'mars') {
      map.current.setLayoutProperty('mars-layer', 'visibility', 'visible');
      map.current.flyTo({ center: [137.4, -4.6], zoom: 6, essential: true });
    } else {
      map.current.setLayoutProperty('mars-layer', 'visibility', 'none');
      map.current.flyTo({ center: chihuahuaRuralCenter, zoom: chihuahuaRuralZoom, essential: true });
    }

    if (draw.current) {
        setTimeout(() => {
            try {
              draw.current.changeMode('draw_polygon');
            } catch (error) {}
        }, 1000);
    }
  }, [activeMap]);

  useEffect(() => {
    if (!draw.current || !map.current) return;
    
    if (isAnalyzing && frozenPolygonFeature) {
      draw.current.changeMode('simple_select');
      if (map.current.hasControl(draw.current)) map.current.removeControl(draw.current);
      const injectedPolygon = {
        ...frozenPolygonFeature,
        properties: {
          ...(frozenPolygonFeature.properties ?? {}),
          injectedAt: Date.now(),
        },
      };

      setFrozenPolygonHistory((previousHistory) => {
        const nextHistory = [...previousHistory, injectedPolygon];
        syncFrozenPolygonLayer(nextHistory);
        return nextHistory;
      });
    }

    if (!isAnalyzing) {
      try { if (!map.current.hasControl(draw.current)) map.current.addControl(draw.current); } catch(e) {}
      try { draw.current.changeMode('draw_polygon'); } catch(e) {}
    }
  }, [isAnalyzing, frozenPolygonFeature]);

  useEffect(() => {
    if (routeStatus === 'planificada' && generatedRoute?.puntos_json) {
      const puntos = generatedRoute.puntos_json.map(p => [Number(p.lon), Number(p.lat)]);
      if (puntos.length < 2) return;
      const rutaFeature = { type: 'Feature', geometry: { type: 'LineString', coordinates: puntos } };
      if (map.current.getSource('ruta-inyeccion')) map.current.getSource('ruta-inyeccion').setData(rutaFeature);
      if (map.current.getSource('inyeccion-puntos')) map.current.getSource('inyeccion-puntos').setData({ type: 'FeatureCollection', features: [] });
      if (map.current.getSource('robot-animado')) map.current.getSource('robot-animado').setData({ type: 'FeatureCollection', features: [] });
      inyeccionRef.current = { type: 'FeatureCollection', features: [] };

      let index = 0;
      const animarRover = () => {
        if (index < puntos.length) {
          if (map.current.getSource('robot-animado')) map.current.getSource('robot-animado').setData({ type: 'Feature', geometry: { type: 'Point', coordinates: puntos[index] }});
          const puntoFeature = { type: 'Feature', geometry: { type: 'Point', coordinates: puntos[index] } };
          if (inyeccionRef.current) {
            const nextFeatures = [...inyeccionRef.current.features, puntoFeature];
            inyeccionRef.current = { type: 'FeatureCollection', features: nextFeatures };
            if (map.current.getSource('inyeccion-puntos')) map.current.getSource('inyeccion-puntos').setData(inyeccionRef.current);
          }
          index++;
          animacionRef.current = setTimeout(animarRover, 420); 
        } else {
          setRouteHistoryFeatures((previousRoutes) => {
            const nextRoutes = [...previousRoutes, rutaFeature];
            if (map.current.getSource('ruta-historial')) {
              map.current.getSource('ruta-historial').setData({ type: 'FeatureCollection', features: nextRoutes });
            }
            return nextRoutes;
          });
          setInjectionHistoryFeatures((previousPoints) => {
            const nextPoints = [
              ...previousPoints,
              ...(inyeccionRef.current?.features ?? []),
            ];
            if (map.current.getSource('inyeccion-historial')) {
              map.current.getSource('inyeccion-historial').setData({ type: 'FeatureCollection', features: nextPoints });
            }
            return nextPoints;
          });
          if (map.current.getSource('ruta-inyeccion')) map.current.getSource('ruta-inyeccion').setData({ type: 'FeatureCollection', features: [] });
          if (map.current.getSource('inyeccion-puntos')) map.current.getSource('inyeccion-puntos').setData({ type: 'FeatureCollection', features: [] });
          if (map.current.getSource('robot-animado')) map.current.getSource('robot-animado').setData({ type: 'FeatureCollection', features: [] });
          inyeccionRef.current = { type: 'FeatureCollection', features: [] };
          if (onRouteCompleted) onRouteCompleted();
        }
      };
      animarRover();
      return () => { if (animacionRef.current) clearTimeout(animacionRef.current); };
    }
  }, [generatedRoute, routeStatus, onRouteCompleted]);

  if (mapError) {
    return <div style={{ width: '100%', height: '100%', borderRadius: '8px', display: 'grid', placeItems: 'center', textAlign: 'center', padding: '1rem' }}>{mapError}</div>;
  }

  return <div ref={mapContainer} style={{ width: '100%', height: '100%', borderRadius: '8px' }} />;
}