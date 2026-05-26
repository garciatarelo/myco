import React, { useEffect, useMemo, useState, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import * as turf from '@turf/turf';
import { apiService } from '../services/api';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

mapboxgl.accessToken = '';

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
  setPolygonCoords
}) {
  const simulationTimeScale = 180;
  
  const [robots, setRobots] = useState([]);
  const [rutas, setRutas] = useState([]);
  const [biopolimeros, setBiopolimeros] = useState([]);
  const [zonasToxicas, setZonasToxicas] = useState([]);
  const [mapError, setMapError] = useState('');
  
  const mapContainer = useRef(null);
  const map = useRef(null);
  const draw = useRef(null);

  useEffect(() => {
    if (map.current) return; 

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11', 
      center: [-106.0889, 28.6353], 
      zoom: 14
    });

    draw.current = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: true
      },
      defaultMode: 'draw_polygon'
    });

    map.current.addControl(draw.current);

    const procesarPoligono = () => {
      const data = draw.current.getAll();
      if (data.features.length > 0) {
        const poligono = data.features[0];
        
        if (setPolygonCoords) {
          setPolygonCoords(poligono.geometry.coordinates);
        }

        if (setArea) {
          const areaCalculada = turf.area(poligono);
          setArea(Math.round(areaCalculada));
        }
      }
    };

    map.current.on('draw.create', procesarPoligono);
    map.current.on('draw.update', procesarPoligono);
    map.current.on('draw.delete', () => {
      if (setArea) setArea(0);
      if (setPolygonCoords) setPolygonCoords(null);
    });

  }, []);

  useEffect(() => {
    cargarCapas();
    const interval = setInterval(cargarCapas, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (refreshToken > 0) cargarCapas();
  }, [refreshToken]);

  async function cargarCapas() {
    try {
      setMapError('');
      const [robotsData, rutasData, biopolimerosData, zonasData] = await Promise.all([
        apiService.getRobots(),
        apiService.getRutas(),
        apiService.getBiopolimeros(),
        apiService.getZonasToxicas(),
      ]);
      setRobots(Array.isArray(robotsData) ? robotsData : []);
      setRutas(Array.isArray(rutasData) ? rutasData : []);
      setBiopolimeros(Array.isArray(biopolimerosData) ? biopolimerosData : []);
      setZonasToxicas(Array.isArray(zonasData) ? zonasData : []);
    } catch (error) {
      setMapError(error instanceof Error ? error.message : 'Error de red');
    }
  }

  return (
    <div className="mars-map-wrap" style={{ height: '100%', width: '100%', position: 'relative' }}>
      {mapError && (
        <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, background: 'red', color: 'white', padding: '5px' }}>
          {mapError}
        </div>
      )}
      
      <div 
        ref={mapContainer} 
        className="mars-map-frame" 
        style={{ width: '100%', height: '100%', borderRadius: '8px' }} 
      />
    </div>
  );
}