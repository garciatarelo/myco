import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Circle, CircleMarker, Marker, MapContainer, Polyline, TileLayer, Tooltip, useMap, Polygon } from 'react-leaflet';
import L from 'leaflet';
import { apiService } from '../services/api';
import * as turf from '@turf/turf';

const MAP_CONFIG = {
  mars: {
    id: 'mars',
    label: 'Marte',
    title: 'Mars - Jezero Crater',
    center: [-4.6, 137.4],
    zoom: 6,
    tileUrl: 'https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0/default/default028mm/{z}/{y}/{x}.jpg',
    attribution: 'NASA Trek - Mars Viking MDIM21',
    crs: L.CRS.EPSG4326,
    bounds: [[-90, -180], [90, 180]],
    noWrap: true,
    minZoom: 1,
    maxZoom: 7,
    maxNativeZoom: 7,
  },
  earth: {
    id: 'earth',
    label: 'Tierra (Chihuahua)',
    title: 'Tierra - Chihuahua, Mexico',
    center: [28.6353, -106.0889],
    zoom: 13,
    tileUrl: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Esri World Imagery',
    crs: L.CRS.EPSG3857,
    bounds: [[25.50, -109.10], [31.80, -103.20]],
    noWrap: true,
    minZoom: 6,
    maxZoom: 18,
    maxNativeZoom: 17,
  },
};

export function MapaMarte({ 
  activeMap = 'mars', 
  setActiveMap, 
  generatedRoute = null, 
  routeStatus = 'idle', 
  onRouteCompleted = () => {}, 
  onRouteSelected,
  refreshToken = 0,
  batteryLevel = 85,
  failsafeStatus = 'NORMAL'
}) {
  const simulationTimeScale = 180;
  const [robots, setRobots] = useState([]);
  const [rutas, setRutas] = useState([]);
  const [biopolimeros, setBiopolimeros] = useState([]);
  const [zonasToxicas, setZonasToxicas] = useState([]);
  const [mapError, setMapError] = useState('');
  const [lastUpdate, setLastUpdate] = useState('');
  const [manualCenter, setManualCenter] = useState(null);
  const [animPos, setAnimPos] = useState(null);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [routeActionError, setRouteActionError] = useState('');
  const [micelioPoints, setMicelioPoints] = useState([]);
  
  const animRef = useRef({ intervalId: null, idx: 0, positions: [] });

  const polygonCoordsTurf = [
    [
      [-106.095, 28.632],
      [-106.082, 28.632],
      [-106.082, 28.642],
      [-106.095, 28.642],
      [-106.095, 28.632]
    ]
  ];

  const polygonCoordsLeaflet = polygonCoordsTurf[0].map(coord => [coord[1], coord[0]]);

  useEffect(() => {
    if (activeMap === 'earth') {
      const polygon = turf.polygon(polygonCoordsTurf);
      const bbox = turf.bbox(polygon);
      let validPoints = [];
      let attempts = 0;
      const totalCapsulas = 54;

      while (validPoints.length < totalCapsulas && attempts < 500) {
        const randomPt = turf.randomPoint(1, { bbox: bbox });
        if (turf.booleanPointInPolygon(randomPt.features[0], polygon)) {
          validPoints.push([
            randomPt.features[0].geometry.coordinates[1],
            randomPt.features[0].geometry.coordinates[0]
          ]);
        }
        attempts++;
      }
      setMicelioPoints(validPoints);
    } else {
      setMicelioPoints([]);
    }
  }, [activeMap]);

  useEffect(() => {
    if (onRouteSelected) {
      onRouteSelected(selectedRouteId);
    }
  }, [selectedRouteId, onRouteSelected]);

  const config = MAP_CONFIG[activeMap];
  const mapCenter = manualCenter || config.center;

  const generatedRoutePoints = useMemo(() => {
    if (!generatedRoute || !Array.isArray(generatedRoute.puntos_json)) {
      return [];
    }
    return generatedRoute.puntos_json
      .filter((p) => p && p.lat !== undefined && p.lon !== undefined)
      .map((p) => [Number(p.lat), Number(p.lon)])
      .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
  }, [generatedRoute]);

  const interactionPoints = useMemo(() => {
    if (generatedRoutePoints.length === 0 || biopolimeros.length === 0) {
      return [];
    }
    const threshold = 0.02;
    const matches = [];
    generatedRoutePoints.forEach((point, index) => {
      const matchingBio = biopolimeros.find((bio) => {
        if (typeof bio.latitud_marte !== 'number' || typeof bio.longitud_marte !== 'number') {
          return false;
        }
        const latDiff = Math.abs(point[0] - Number(bio.latitud_marte));
        const lonDiff = Math.abs(point[1] - Number(bio.longitud_marte));
        return latDiff <= threshold && lonDiff <= threshold;
      });
      if (matchingBio) {
        matches.push({ point, index, bio: matchingBio });
      }
    });
    return matches;
  }, [generatedRoutePoints, biopolimeros]);

  function RouteAutoFocus({ points }) {
    const map = useMap();
    useEffect(() => {
      if (!points || points.length === 0) return;
      if (points.length === 1) {
        map.setView(points[0], Math.max(map.getZoom(), 9), { animate: true });
        return;
      }
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: activeMap === 'mars' ? 10 : 15, animate: true });
    }, [map, points]);
    return null;
  }

  const capasRutas = useMemo(() => {
    return rutas
      .map((ruta) => {
        const puntos = Array.isArray(ruta.puntos_json)
          ? ruta.puntos_json
              .map((p) => [Number(p?.lat), Number(p?.lon)])
              .filter((p) => !isNaN(p[0]) && !isNaN(p[1]))
          : [];
        if (puntos.length < 2) {
          return null;
        }
        const firstPoint = puntos[0];
        const isEarth = firstPoint[0] >= 25 && firstPoint[0] <= 32 && firstPoint[1] >= -110 && firstPoint[1] <= -100;
        if (activeMap === 'earth' && !isEarth) return null;
        if (activeMap === 'mars' && isEarth) return null;
        return { id: ruta.id, estado: ruta.estado, puntos };
      })
      .filter(Boolean);
  }, [rutas, activeMap]);

  const selectedRoute = useMemo(() => {
    return capasRutas.find((ruta) => ruta.id === selectedRouteId) || null;
  }, [capasRutas, selectedRouteId]);

  const capasRobots = useMemo(() => {
    const filtered = robots.filter((robot) => {
      const lat = Number(robot.latitud_marte);
      const lon = Number(robot.longitud_marte);
      if (isNaN(lat) || isNaN(lon)) return false;
      const isEarth = lat >= 25 && lat <= 32 && lon >= -110 && lon <= -100;
      if (activeMap === 'earth' && !isEarth) return false;
      if (activeMap === 'mars' && isEarth) return false;
      return true;
    });
    return filtered.map((robot, idx) => {
      if (idx === 0) {
        return {
          ...robot,
          bateria: batteryLevel,
          estado: failsafeStatus === 'ACTIVE' ? 'Home-Seeking (Batería < 20%)' : robot.estado,
        };
      }
      return robot;
    });
  }, [robots, activeMap, batteryLevel, failsafeStatus]);

  const capasBiopolimeros = useMemo(() => {
    return biopolimeros.filter((bio) => {
      const lat = Number(bio.latitud_marte);
      const lon = Number(bio.longitud_marte);
      if (isNaN(lat) || isNaN(lon)) return false;
      const isEarth = lat >= 25 && lat <= 32 && lon >= -110 && lon <= -100;
      if (activeMap === 'earth' && !isEarth) return false;
      if (activeMap === 'mars' && isEarth) return false;
      return true;
    });
  }, [biopolimeros, activeMap]);

  const visibleGeneratedRoute = useMemo(() => {
    if (generatedRoutePoints.length === 0) return false;
    const firstPoint = generatedRoutePoints[0];
    const isEarth = firstPoint[0] >= 25 && firstPoint[0] <= 32 && firstPoint[1] >= -110 && firstPoint[1] <= -100;
    if (activeMap === 'earth' && !isEarth) return false;
    if (activeMap === 'mars' && isEarth) return false;
    return true;
  }, [generatedRoutePoints, activeMap]);

  useEffect(() => {
    cargarCapas();
    const interval = setInterval(cargarCapas, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!generatedRoute || !Array.isArray(generatedRoute.puntos_json)) return;
    const pts = generatedRoute.puntos_json.map((p) => [p.lat, p.lon]);
    if (pts.length === 0) return;
    animRef.current.positions = pts;
    animRef.current.idx = 0;
    setAnimPos(pts[0]);
    setSelectedRouteId(generatedRoute.id);
  }, [generatedRoute]);

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
      setLastUpdate(new Date().toLocaleTimeString());
      if (activeMap === 'mars') {
        const firstRobot = (Array.isArray(robotsData) ? robotsData : []).find(
          (r) => typeof r.latitud_marte === 'number' && typeof r.longitud_marte === 'number'
        );
        if (firstRobot) {
          setManualCenter([firstRobot.latitud_marte, firstRobot.longitud_marte]);
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error desconocido de mapa';
      setMapError(msg);
    }
  }

  function colorRuta(estado) {
    if (estado === 'completada') return '#ffc107';
    if (estado === 'en-progreso') return '#47d6ff';
    if (estado === 'cancelada') return '#ff7070';
    return '#ff8a2b';
  }

  function colorRutaGenerada() {
    if (routeStatus === 'completada') return '#ffc107';
    if (routeStatus === 'en-progreso') return '#47d6ff';
    return '#ffd24d';
  }

  function colorPorIndice(index, selected = false) {
    const palette = ['#ffc107', '#47d6ff', '#ffd24d', '#ff8a2b', '#b08cff', '#ff7070'];
    return selected ? '#ffffff' : palette[index % palette.length];
  }

  function focusRoute(route) {
    if (!route || !Array.isArray(route.puntos) || route.puntos.length === 0) return;
    setSelectedRouteId(route.id);
    setManualCenter(route.puntos[0]);
  }

  useEffect(() => {
    if (refreshToken > 0) cargarCapas();
  }, [refreshToken]);

  const activeZonas = useMemo(() => {
    return zonasToxicas.filter(z => {
      const isEarth = z.latitud >= 25 && z.latitud <= 32 && z.longitud >= -110 && z.longitud <= -100;
      return activeMap === 'earth' ? isEarth : !isEarth;
    });
  }, [zonasToxicas, activeMap]);

  const redBiologica = useMemo(() => {
    const lines = [];
    const maxDist = 0.5;
    for (let i = 0; i < capasBiopolimeros.length; i++) {
      for (let j = i + 1; j < capasBiopolimeros.length; j++) {
        const b1 = capasBiopolimeros[i];
        const b2 = capasBiopolimeros[j];
        const dLat = Number(b1.latitud_marte) - Number(b2.latitud_marte);
        const dLon = Number(b1.longitud_marte) - Number(b2.longitud_marte);
        const dist = Math.sqrt(dLat * dLat + dLon * dLon);
        if (dist < maxDist) {
          lines.push([[Number(b1.latitud_marte), Number(b1.longitud_marte)], [Number(b2.latitud_marte), Number(b2.longitud_marte)]]);
        }
      }
    }
    return lines;
  }, [capasBiopolimeros]);

  async function deleteRoute(routeId) {
    const confirmDelete = window.confirm(`Eliminar la ruta #${routeId}? Esta acción no se puede deshacer.`);
    if (!confirmDelete) return;
    try {
      setRouteActionError('');
      await apiService.eliminarRuta(routeId);
      setRutas((prev) => prev.filter((ruta) => ruta.id !== routeId));
      if (selectedRouteId === routeId) {
        setSelectedRouteId(null);
        setManualCenter(null);
      }
      if (generatedRoute && generatedRoute.id === routeId) {
        onRouteCompleted && onRouteCompleted(generatedRoute);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'No se pudo eliminar la ruta';
      setRouteActionError(msg);
    }
  }

  return (
    <div className="mars-map-wrap">
      <div className="panel-header">
        <div className="map-actions">
          {generatedRoute && (
            <div style={{ marginLeft: 12 }}>
              <button
                className="btn-primary"
                onClick={async () => {
                  try {
                    await apiService.iniciarRuta(generatedRoute.id);
                  } catch (e) {
                    console.warn('No se pudo iniciar ruta en backend', e);
                  }
                  if (!animRef.current.positions || animRef.current.positions.length === 0) return;
                  if (animRef.current.intervalId) clearInterval(animRef.current.intervalId);
                  animRef.current.idx = 0;
                  const pointsCount = animRef.current.positions.length;
                  const estimatedRouteSeconds = Number(generatedRoute.tiempo_estimado) || pointsCount * 8;
                  const secondsPerPoint = estimatedRouteSeconds / pointsCount;
                  const stepMs = Math.max(350, Math.min(1500, Math.round((secondsPerPoint * 1000) / simulationTimeScale)));
                  animRef.current.intervalId = setInterval(async () => {
                    const idx = ++animRef.current.idx;
                    if (idx >= animRef.current.positions.length) {
                      clearInterval(animRef.current.intervalId);
                      animRef.current.intervalId = null;
                      setAnimPos(null);
                      try {
                        await apiService.completarRuta(generatedRoute.id);
                      } catch (e) {
                        console.warn('No se pudo completar ruta en backend', e);
                      }
                      onRouteCompleted && onRouteCompleted(generatedRoute);
                      return;
                    }
                    setAnimPos(animRef.current.positions[idx]);
                  }, stepMs);
                }}
              >
                Iniciar simulación
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mars-map-frame">
        <MapContainer
          key={activeMap}
          center={mapCenter}
          zoom={config.zoom}
          minZoom={config.minZoom}
          maxZoom={config.maxZoom}
          maxBounds={config.bounds}
          maxBoundsViscosity={1.0}
          crs={config.crs}
          scrollWheelZoom={true}
          className="mars-map"
        >
          <TileLayer
            url={config.tileUrl}
            attribution={config.attribution}
            noWrap={config.noWrap}
            bounds={config.bounds}
            maxNativeZoom={config.maxNativeZoom}
          />

          {activeMap === 'earth' && (
            <>
              <Polygon 
                positions={polygonCoordsLeaflet} 
                pathOptions={{ color: '#5af7cf', fillColor: '#5af7cf', fillOpacity: 0.1, weight: 2, dashArray: '5 5' }} 
              />
              {micelioPoints.map((pt, i) => (
                <CircleMarker 
                  key={`micelio-sim-${i}`} 
                  center={pt} 
                  radius={4} 
                  pathOptions={{ color: '#020305', fillColor: '#5af7cf', fillOpacity: 1, weight: 1 }}
                >
                  <Tooltip>Cápsula de Micelio #{i + 1}</Tooltip>
                </CircleMarker>
              ))}
            </>
          )}

          {visibleGeneratedRoute && <RouteAutoFocus points={generatedRoutePoints} />}

          <>
            {activeZonas.map(zona => (
              <Circle
                key={`zona-${zona.id}`}
                center={[zona.latitud, zona.longitud]}
                radius={zona.radio * 111000}
                pathOptions={{ color: '#ff3a5d', fillColor: '#ff0033', fillOpacity: 0.35, weight: 2, dashArray: '10 10' }}
              >
                <Tooltip>Zona Tóxica! Peligro: {zona.nivel_toxicidad}%</Tooltip>
              </Circle>
            ))}

            {redBiologica.map((linePoints, idx) => (
              <Polyline 
                key={`red-${idx}`} 
                positions={linePoints} 
                pathOptions={{ color: '#e2d5c4', weight: 1.5, opacity: 0.4, dashArray: '4 4' }} 
              />
            ))}

            {capasRobots.map((robot, idx) => {
              const isFailsafe = idx === 0 && failsafeStatus === 'ACTIVE';
              const strokeColor = isFailsafe ? '#ff3a5d' : colorPorIndice(idx);
              const customClass = isFailsafe ? 'custom-robot-icon live-dot' : 'custom-robot-icon';
              const iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg" style="background:#111827;border-radius:50%;padding:2px;border:2px solid ${strokeColor}"><rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" /><path d="M12 7v4" /><line x1="8" y1="16" x2="8" y2="16" /><line x1="16" y1="16" x2="16" y2="16" /></svg>`;
              const robotIcon = L.divIcon({ html: iconSvg, className: customClass, iconSize: [28, 28], iconAnchor: [14, 14] });
              return (
                <Marker key={`robot-${robot.id}`} position={[robot.latitud_marte, robot.longitud_marte]} icon={robotIcon}>
                  <Tooltip direction="top" offset={[0, -14]} opacity={1}>
                    <div className="map-tooltip">
                      <strong>{robot.nombre}</strong>
                      <p style={{ color: isFailsafe ? '#ff3a5d' : 'inherit', fontWeight: isFailsafe ? 'bold' : 'normal' }}>
                        Estado: {robot.estado}
                      </p>
                      <p style={{ color: isFailsafe ? '#ff3a5d' : 'inherit', fontWeight: isFailsafe ? 'bold' : 'normal' }}>
                        Bateria: {robot.bateria}%
                      </p>
                    </div>
                  </Tooltip>
                </Marker>
              );
            })}

            {capasRutas.map((ruta, index) => (
              <Polyline
                key={`ruta-${ruta.id}`}
                positions={ruta.puntos}
                eventHandlers={{ click: () => focusRoute(ruta) }}
                pathOptions={{
                  color: colorPorIndice(index, selectedRouteId === ruta.id),
                  weight: selectedRouteId === ruta.id ? 6 : 4,
                  opacity: selectedRouteId && selectedRouteId !== ruta.id ? 0.35 : 0.92,
                  dashArray: ruta.estado === 'planificada' ? '8 8' : undefined,
                }}
              >
                <Tooltip sticky>Ruta #{ruta.id} - {ruta.estado}</Tooltip>
              </Polyline>
            ))}

            {capasBiopolimeros.map((bio) => {
              return (
                <CircleMarker
                  key={`bio-${bio.id}`}
                  center={[bio.latitud_marte, bio.longitud_marte]}
                  radius={5}
                  pathOptions={{ color: '#e2d5c4', fillColor: '#e2d5c4', fillOpacity: 0.65, weight: 1 }}
                >
                  <Tooltip>Biopolímero #{bio.id} - crecimiento {bio.nivel_crecimiento}%</Tooltip>
                </CircleMarker>
              );
            })}

            {visibleGeneratedRoute && (
              <>
                <Polyline
                  key={`generated-ruta-${generatedRoute.id}`}
                  positions={generatedRoutePoints}
                  pathOptions={{ color: colorRutaGenerada(), weight: 4, dashArray: routeStatus === 'completada' ? undefined : '6 6', opacity: 0.95 }}
                />
                {generatedRoutePoints.map((point, index) => {
                  const isStart = index === 0;
                  const isEnd = index === generatedRoutePoints.length - 1;
                  return (
                    <CircleMarker
                      key={`generated-point-${index}`}
                      center={point}
                      radius={isStart || isEnd ? 6 : 3}
                      pathOptions={{
                        color: isStart ? '#e2d5c4' : isEnd ? '#ff8a2b' : '#ffd24d',
                        fillColor: isStart ? '#e2d5c4' : isEnd ? '#ff8a2b' : '#ffd24d',
                        fillOpacity: 0.95,
                        weight: 1,
                      }}
                    >
                      <Tooltip>{isStart ? 'Inicio de ruta' : isEnd ? 'Fin de ruta' : `Punto de ruta ${index + 1}`}</Tooltip>
                    </CircleMarker>
                  );
                })}
                {interactionPoints.map(({ point, index, bio }) => (
                  <CircleMarker
                    key={`interaction-${bio.id}-${index}`}
                    center={point}
                    radius={8}
                    pathOptions={{ color: '#ffc107', fillColor: '#ffc107', fillOpacity: 0.9, weight: 2 }}
                  >
                    <Tooltip>Interacción robot-biopolímero #{bio.id} en punto {index + 1}</Tooltip>
                  </CircleMarker>
                ))}
                {animPos && (
                  <Marker
                    position={animPos}
                    icon={L.divIcon({
                      html: `<svg viewBox="0 0 24 24" fill="none" stroke="${colorRutaGenerada()}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg" style="background:#111827;border-radius:50%;padding:2px;border:2px solid ${colorRutaGenerada()}"><rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" /><path d="M12 7v4" /><line x1="8" y1="16" x2="8" y2="16" /><line x1="16" y1="16" x2="16" y2="16" /></svg>`,
                      className: 'custom-robot-icon-anim',
                      iconSize: [34, 34],
                      iconAnchor: [17, 17]
                    })}
                  />
                )}
              </>
            )}
          </>
        </MapContainer>

        <div className="map-overlay-info">
          <span>Modo: {config.label}</span>
          <span>Robots: {capasRobots.length}</span>
          <span>Rutas: {capasRutas.length}</span>
          <span>Biopolímeros: {capasBiopolimeros.length}</span>
          {generatedRoute && <span>Ruta: {routeStatus}</span>}
          {generatedRoute && <span>Sim: x{simulationTimeScale}</span>}
          <span>Última actualización: {lastUpdate || '---'}</span>
        </div>
      </div>

      {capasRutas.length > 0 && (
        <div className="route-selector-panel">
          <div className="route-selector-header">
            <strong>Rutas disponibles</strong>
            <button
              type="button"
              className="btn-soft small"
              onClick={() => {
                setSelectedRouteId(null);
                setManualCenter(null);
              }}
            >
              Ver todas
            </button>
          </div>
          <div className="route-selector-list">
            {capasRutas.map((ruta, index) => {
              const isSelected = selectedRouteId === ruta.id;
              return (
                <div key={ruta.id} className="route-chip-row">
                  <button
                    type="button"
                    className={`route-chip ${isSelected ? 'selected' : ''}`}
                    onClick={() => focusRoute(ruta)}
                  >
                    <span className="route-chip-dot" style={{ background: colorPorIndice(index, isSelected) }} />
                    <span>Ruta #{ruta.id}</span>
                    <span>{ruta.estado}</span>
                    <span>{ruta.puntos.length} pts</span>
                  </button>
                  <button
                    type="button"
                    className="btn-soft small ghost"
                    onClick={() => deleteRoute(ruta.id)}
                    aria-label={`Eliminar ruta ${ruta.id}`}
                  >
                    Eliminar
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {routeActionError && <p className="state-msg error">{routeActionError}</p>}
      {mapError && <p className="state-msg error">Error de mapa: {mapError}</p>}
      <p className="state-msg">
        {generatedRoute
          ? `Ruta activa #${generatedRoute.id} en estado ${routeStatus}.`
          : 'Genera una ruta para verla y simularla aquí.'}
      </p>
    </div>
  );
}