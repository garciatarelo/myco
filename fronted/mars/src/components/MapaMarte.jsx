import React, { useEffect, useState, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import * as turf from '@turf/turf';
import { apiService } from '../services/api';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

mapboxgl.accessToken = 'Tokencito jiji';

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
  isAnalyzing = false 
}) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const draw = useRef(null);
  const animacionRef = useRef(null);
  
  const [frozenPolygonFeature, setFrozenPolygonFeature] = useState(null);

  const clearFrozenLayers = () => {
    if (!map.current) return;
    if (map.current.getLayer('frozenPolygonFill')) map.current.removeLayer('frozenPolygonFill');
    if (map.current.getLayer('frozenPolygonOutline')) map.current.removeLayer('frozenPolygonOutline');
    if (map.current.getSource('frozenPolygon')) map.current.removeSource('frozenPolygon');
  };

  useEffect(() => {
    if (map.current) return; 

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-v9', 
      center: [-107.8850, 30.6250],
      zoom: 13.8
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

      map.current.addSource('robot-animado', { type: 'geojson', data: { type: 'FeatureCollection', features: [] }});
      map.current.addLayer({
        id: 'punto-robot', type: 'circle', source: 'robot-animado',
        paint: { 'circle-radius': 7, 'circle-color': '#ff4500', 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' }
      });
    });
  }, []);

  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    if (activeMap === 'mars') {
      map.current.setLayoutProperty('mars-layer', 'visibility', 'visible');
      map.current.flyTo({ center: [137.4, -4.6], zoom: 6, essential: true });
    } else {
      map.current.setLayoutProperty('mars-layer', 'visibility', 'none');
      map.current.flyTo({ center: [-107.8850, 30.6250], zoom: 13.8, essential: true });
    }

    if (draw.current) {
        draw.current.deleteAll();
        setTimeout(() => {
            draw.current.changeMode('draw_polygon');
        }, 1000);
    }
  }, [activeMap]);

  useEffect(() => {
    if (!draw.current || !map.current) return;
    
    if (isAnalyzing && frozenPolygonFeature) {
      draw.current.changeMode('simple_select');
      if (map.current.hasControl(draw.current)) map.current.removeControl(draw.current);

      if (!map.current.getSource('frozenPolygon')) {
        map.current.addSource('frozenPolygon', { type: 'geojson', data: frozenPolygonFeature });
        map.current.addLayer({ id: 'frozenPolygonFill', type: 'fill', source: 'frozenPolygon', paint: { 'fill-color': '#ff4500', 'fill-opacity': 0.1 }});
        map.current.addLayer({ id: 'frozenPolygonOutline', type: 'line', source: 'frozenPolygon', paint: { 'line-color': '#ff4500', 'line-width': 2, 'line-dasharray': [5, 5] }});
      }
    } else if (!isAnalyzing) {
      clearFrozenLayers();
      try { if (!map.current.hasControl(draw.current)) map.current.addControl(draw.current); } catch(e) {}
    }
  }, [isAnalyzing, frozenPolygonFeature]);

  useEffect(() => {
    if (routeStatus === 'planificada' && generatedRoute?.puntos_json) {
      const puntos = generatedRoute.puntos_json.map(p => [Number(p.lon), Number(p.lat)]);
      if (puntos.length < 2) return;
      if (map.current.getSource('ruta-inyeccion')) map.current.getSource('ruta-inyeccion').setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: puntos }});

      let index = 0;
      const animarRover = () => {
        if (index < puntos.length) {
          if (map.current.getSource('robot-animado')) map.current.getSource('robot-animado').setData({ type: 'Feature', geometry: { type: 'Point', coordinates: puntos[index] }});
          index++;
          animacionRef.current = setTimeout(animarRover, 150); 
        } else {
          if (onRouteCompleted) onRouteCompleted();
        }
      };
      animarRover();
      return () => { if (animacionRef.current) clearTimeout(animacionRef.current); };
    }
  }, [generatedRoute, routeStatus, onRouteCompleted]);

  return <div ref={mapContainer} style={{ width: '100%', height: '100%', borderRadius: '8px' }} />;
}