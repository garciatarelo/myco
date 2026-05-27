import React, { useState, useEffect, useRef } from 'react';
import { MapaMarte } from './components/MapaMarte';
import { GenerateRutaModal } from './components/GenerateRutaModal';
import { CreateRobotModal } from './components/CreateRobotModal';
import { EstadisticasPanel } from './components/EstadisticasPanel';
import teamLogo from './assets/logo.ico';
import { PlanesSaaS } from './components/PlanesSaaS';

function Dashboard() {
  const [modalOpen, setModalOpen] = useState(false);
  const [robotModalOpen, setRobotModalOpen] = useState(false);
  const [generatedRoute, setGeneratedRoute] = useState(null);
  const [routeStatus, setRouteStatus] = useState('idle');
  const [robotsRefreshToken, setRobotsRefreshToken] = useState(0);
  const [activeMap, setActiveMap] = useState('mars');

  const [terrainAnalyzed, setTerrainAnalyzed] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisPhase, setAnalysisPhase] = useState('');

  const [batteryLevel, setBatteryLevel] = useState(85);
  const [arsenicLevel, setArsenicLevel] = useState(15);
  const [phLevel, setPhLevel] = useState(6.8);
  const [valveOpen, setValveOpen] = useState(true);
  const [failsafeStatus, setFailsafeStatus] = useState('NORMAL');
  const [isCharging, setIsCharging] = useState(false);
  const chargeRef = useRef(null);

  const [clima, setClima] = useState(null);
  const [area, setArea] = useState(0);
  const [polygonCoords, setPolygonCoords] = useState(null);
  const [saasModalOpen, setSaasModalOpen] = useState(false);

  const fetchClima = async () => {
    if (activeMap === 'earth') {
      try {
        const res = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=30.6250&lon=-107.8850&appid=364998e3b3a32f6b8df815a51c4a0342&units=metric`
        );
        if (!res.ok) throw new Error();
        const d = await res.json();
        setClima({
          temp: d.main.temp,
          hum: d.main.humidity,
          pres: d.main.pressure,
          viento: +(d.wind.speed * 3.6).toFixed(1),
          precip: d.rain ? (d.rain['1h'] ?? 0) : 0,
          status: d.weather[0].description,
        });
      } catch {
        setClima({ temp:29.4, hum:28, pres:1014, viento:12.8, precip:0, status:'Soleado' });
      }
    } else {
      setClima({ temp:-62.4, hum:4, pres:6, viento:22.4, precip:0, status:'Frío extremo' });
    }
  };

  useEffect(() => {
    setTerrainAnalyzed(false);
    setClima(null);
    setGeneratedRoute(null);
    setRouteStatus('idle');
  }, [activeMap]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalysisProgress(0);
    setTerrainAnalyzed(false);

    const phases = [
      'Leyendo coordenadas del terreno...',
      'Calculando área del polígono...',
      'Consultando datos del clima...',
      'Analizando composición del suelo...',
      'Estimando cápsulas de micelio...',
      'Trazando ruta óptima...',
    ];

    for (let i = 0; i < phases.length; i++) {
      setAnalysisPhase(phases[i]);
      const target = Math.round(((i + 1) / phases.length) * 90);
      await new Promise(res => {
        let p = Math.round((i / phases.length) * 90);
        const iv = setInterval(() => {
          p += 3;
          if (p >= target) { clearInterval(iv); setAnalysisProgress(target); res(); }
          else setAnalysisProgress(p);
        }, 60);
      });
    }

    try {
      await fetchClima();
      const { apiService } = await import('./services/api');
      const data = await apiService.remediarIA(activeMap);
      if (data.rutas?.length > 0) {
        setGeneratedRoute(data.rutas[0]);
        setRouteStatus('planificada');
      }
      setRobotsRefreshToken(v => v + 1);
    } catch {}

    setAnalysisPhase('Simulando inyección en el mapa...');
    addLog(['[SYS] Iniciando recorrido en el polígono...', '[SYS] Inyectando cápsulas de micelio...']);
    
    await new Promise(res => {
      let p = 90;
      const iv = setInterval(() => {
        p += 1;
        if (p >= 100) { clearInterval(iv); setAnalysisProgress(100); res(); }
        else setAnalysisProgress(p);
      }, 30); 
    });

    setAnalysisPhase('Análisis y simulación completados');
    await new Promise(res => setTimeout(res, 600));
    
    setAnalyzing(false);
    setTerrainAnalyzed(true);
    setRouteStatus('completada');
    addLog(['[SYS] Inyección completada con éxito.']);
  };

  const [logs, setLogs] = useState([
    '[SYS]   Sistema M.Y.C.O. iniciado.',
    '[SYS]   Válvula de micelio activa.',
    '[SYS]   Rover en campo...',
  ]);
  const consoleRef = useRef(null);

  const addLog = (lines) =>
    setLogs(prev => [...prev, ...lines.map(l => `[${new Date().toLocaleTimeString()}] ${l}`)]);

  useEffect(() => {
    if (consoleRef.current)
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
  }, [logs]);

  const startAutoCharge = () => {
    if (chargeRef.current) return;
    addLog([
      '[AVISO]  Batería crítica. Suspendiendo siembra...',
      '[AVISO]  Válvula cerrada. Rover regresando a base.',
      '[RUTA]   Ruta de regreso calculada. 480 m.',
      '[CARGA]  Rover en estación. Iniciando carga...',
    ]);
    chargeRef.current = setInterval(() => {
      setBatteryLevel(prev => {
        if (prev >= 95) {
          clearInterval(chargeRef.current);
          chargeRef.current = null;
          setFailsafeStatus('NORMAL');
          setValveOpen(true);
          setIsCharging(false);
          addLog([
            '[SYS]   Carga completa. Batería al 95%.',
            '[SYS]   Válvula reactivada. Rover al campo.',
          ]);
          return 95;
        }
        return prev + 2;
      });
    }, 300);
  };

  useEffect(() => {
    if (batteryLevel < 20 && failsafeStatus === 'NORMAL') {
      setFailsafeStatus('ACTIVE');
      setValveOpen(false);
      setIsCharging(true);
      startAutoCharge();
    }
  }, [batteryLevel]);

  useEffect(() => () => { if (chargeRef.current) clearInterval(chargeRef.current); }, []);

  const battColor = batteryLevel < 20 ? '#ff7070' : batteryLevel < 40 ? '#ffc107' : '#5af7cf';

  const card = {
    background: 'rgba(255,255,255,0.025)',
    border: '1px solid var(--line)',
    borderRadius: '8px',
    padding: '10px 12px',
  };
  const lbl = {
    fontSize: '0.58rem',
    color: 'var(--muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    display: 'block',
    marginBottom: '3px',
  };

  return (
    <div style={{ padding:'8px', height:'100vh', boxSizing:'border-box', background:'#000', overflow:'hidden' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '240px 1fr 360px',
        gap: '8px',
        height: '100%',
      }}>

        <aside className="panel" style={{ padding:'16px', display:'flex', flexDirection:'column', gap:'14px', overflow:'hidden' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <div style={{ width:40, height:40, borderRadius:'50%', border:'2px solid #ff4500', flexShrink:0, overflow:'hidden' }}>
              <img src={teamLogo} alt="M.Y.C.O" style={{ width:'100%', height:'100%', objectFit:'contain' }} />
            </div>
            <h1 style={{ margin:0, fontSize:'1.35rem', color:'#ff4500', fontWeight:'900', letterSpacing:'1px' }}>M.Y.C.O</h1>
          </div>

          <div style={{ borderTop:'1px solid var(--line)' }} />

          <div>
            <span style={lbl}>Vista del mapa</span>
            <div style={{ display:'flex', gap:'4px', marginTop:'4px' }}>
              {[{id:'mars',name:'Marte'},{id:'earth',name:'Chihuahua'}].map(m => (
                <button key={m.id} onClick={() => setActiveMap(m.id)} style={{
                  flex:1, border:'1px solid',
                  borderColor: activeMap===m.id ? '#ff4500' : 'var(--line)',
                  background:  activeMap===m.id ? 'rgba(255,69,0,0.12)' : 'transparent',
                  color:       activeMap===m.id ? '#ff8a2b' : 'var(--muted)',
                  borderRadius:'6px', padding:'6px 0', fontSize:'0.72rem',
                  fontWeight:  activeMap===m.id ? '700' : '400',
                  cursor:'pointer', transition:'all 0.2s',
                }}>{m.name}</button>
              ))}
            </div>
          </div>

          <div style={{ ...card, display:'flex', flexDirection:'column', gap:'7px' }}>
            <span style={lbl}>Rover-01</span>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.74rem' }}>
              <span style={{ color:'var(--muted)' }}>Estado</span>
              <strong style={{ color: isCharging ? '#ffc107' : failsafeStatus==='ACTIVE' ? '#ff7070' : '#5af7cf' }}>
                {isCharging ? 'Cargando...' : failsafeStatus==='ACTIVE' ? 'Volviendo a base' : 'En el campo'}
              </strong>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.74rem' }}>
              <span style={{ color:'var(--muted)' }}>Siembra</span>
              <strong style={{ color: valveOpen ? '#5af7cf' : '#ff7070' }}>
                {valveOpen ? 'Activa' : 'Pausada'}
              </strong>
            </div>
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.7rem', marginBottom:'4px' }}>
                <span style={{ color:'var(--muted)' }}>Batería</span>
                <strong style={{ color: battColor }}>{batteryLevel}%{isCharging ? ' ↑' : ''}</strong>
              </div>
              <div style={{ height:'5px', borderRadius:'999px', background:'rgba(255,255,255,0.06)' }}>
                <div style={{ width:`${batteryLevel}%`, height:'100%', borderRadius:'999px',
                  background:`linear-gradient(90deg,${battColor},${battColor}88)`, transition:'width 0.4s' }} />
              </div>
            </div>
          </div>

          {!terrainAnalyzed && !analyzing && (
            <div style={{ fontSize:'0.7rem', color:'var(--muted)', lineHeight:1.7,
              background:'rgba(255,255,255,0.02)', border:'1px solid var(--line)',
              borderRadius:'8px', padding:'10px 12px' }}>
              <div><span style={{ color:'#ff8a2b', fontWeight:'700', marginRight:'6px' }}>1.</span>Dibuja el terreno en el mapa</div>
              <div><span style={{ color:'#ff8a2b', fontWeight:'700', marginRight:'6px' }}>2.</span>Haz clic en <strong style={{color:'#fff'}}>Analizar terreno</strong></div>
            </div>
          )}

          <div style={{ display:'flex', flexDirection:'column', gap:'6px', marginTop:'auto' }}>
            <button
              onClick={handleAnalyze}
              disabled={analyzing || isCharging}
              style={{
                width:'100%', fontSize:'0.75rem', padding:'10px',
                background: analyzing ? 'rgba(255,69,0,0.05)' : 'rgba(255,69,0,0.9)',
                border:'1px solid #ff4500', color: analyzing ? '#ff8a2b' : '#fff',
                borderRadius:'8px', cursor: analyzing ? 'not-allowed' : 'pointer',
                fontWeight:'700', transition:'all 0.2s',
              }}>
              {analyzing ? 'Analizando...' : terrainAnalyzed ? 'Volver a analizar' : 'Analizar terreno'}
            </button>

            <button onClick={() => setRobotModalOpen(true)} style={{
              width:'100%', fontSize:'0.71rem', padding:'7px', background:'transparent',
              border:'1px solid var(--line)', color:'var(--muted)', borderRadius:'8px', cursor:'pointer',
            }}>
              + Registrar rover
            </button>
            <button onClick={() => setSaasModalOpen(true)} style={{
              width:'100%', fontSize:'0.71rem', padding:'7px', background:'transparent',
              border:'1px solid var(--line)', color:'#5af7cf', borderRadius:'8px', cursor:'pointer',
              marginTop: '4px'
            }}>
              Ver Planes SaaS
            </button>
          </div>

          <div style={{ borderTop:'1px solid var(--line)', paddingTop:'10px', fontSize:'0.63rem', color:'var(--muted)' }}>
            <div style={{ display:'flex', justifyContent:'space-between' }}>
              <span>Conexión</span><strong style={{ color:'#5af7cf' }}>Activa</strong>
            </div>
          </div>
        </aside>

        <div className="panel" style={{ padding:'10px', display:'flex', flexDirection:'column', gap:'8px', overflow:'hidden' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
            <div>
              <p style={{ margin:0, fontSize:'0.6rem', textTransform:'uppercase', letterSpacing:'1px', color:'var(--muted)' }}>Gemelo Digital</p>
              <p style={{ margin:0, fontSize:'0.8rem', color:'#fff', fontWeight:'600' }}>
                {activeMap === 'earth' ? 'Chihuahua — Terreno piloto' : 'Marte — Cráter Jezero'}
              </p>
            </div>
          </div>

          {analyzing && (
            <div style={{ flexShrink:0, background:'rgba(255,69,0,0.05)', border:'1px solid rgba(255,69,0,0.2)',
              borderRadius:'8px', padding:'10px 14px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.7rem', marginBottom:'6px' }}>
                <span style={{ color:'#ff8a2b' }}>{analysisPhase}</span>
                <strong style={{ color:'#ff4500' }}>{Math.round(analysisProgress)}%</strong>
              </div>
              <div style={{ height:'5px', borderRadius:'999px', background:'rgba(255,255,255,0.05)' }}>
                <div style={{
                  width:`${analysisProgress}%`, height:'100%', borderRadius:'999px',
                  background:'linear-gradient(90deg,#ff4500,#ff8a2b)',
                  transition:'width 0.15s ease',
                }} />
              </div>
            </div>
          )}

          <div style={{ flex:1, borderRadius:'8px', overflow:'hidden', border:'1px solid var(--line)', minHeight:0 }}>
            <MapaMarte
              activeMap={activeMap}
              setActiveMap={setActiveMap}
              generatedRoute={generatedRoute}
              routeStatus={routeStatus}
              onRouteCompleted={() => setRouteStatus('completada')}
              onRouteSelected={() => {}}
              refreshToken={robotsRefreshToken}
              batteryLevel={batteryLevel}
              failsafeStatus={failsafeStatus}
              setArea={setArea}
              setPolygonCoords={setPolygonCoords}
              isAnalyzing={analyzing || terrainAnalyzed}
            />
          </div>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:'8px', overflowY:'auto', paddingRight:'4px' }}>
          <div className="panel" style={{ padding:'14px', flexShrink:0, display:'flex', flexDirection:'column' }}>
            <span style={{ ...lbl, marginBottom:'10px' }}>Clima</span>
            {!terrainAnalyzed ? (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted)', fontSize:'0.72rem', padding:'20px 0' }}>
                Sin terreno analizado
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'7px' }}>
                {[
                  { l:'Temperatura', v:`${clima?.temp?.toFixed(1) ?? '—'} °C`,     c: (clima?.temp??0)>0?'#ff8a2b':'#47d6ff' },
                  { l:'Humedad',     v:`${clima?.hum ?? '—'}%`,                    c:'#5af7cf' },
                  { l:'Viento',      v:`${clima?.viento ?? '—'} km/h`,             c:'#b08cff' },
                  { l:'Lluvia',      v:`${clima?.precip?.toFixed(1) ?? '—'} mm/h`, c:'#47d6ff' },
                  { l:'Presión',     v:`${clima?.pres ?? '—'} hPa`,                c:'#ffd24d' },
                  { l:'Condición',   v: clima?.status ?? '—',                      c:'#ff8a2b' },
                ].map(({ l, v, c }) => (
                  <div key={l} style={{ ...card, display:'flex', flexDirection:'column', justifyContent:'center' }}>
                    <span style={lbl}>{l}</span>
                    <span style={{ fontSize:'0.95rem', fontWeight:'700', color:c, wordBreak:'break-word', lineHeight:1.3 }}>{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="panel" style={{ padding:'14px', flexShrink:0, display:'flex', flexDirection:'column' }}>
            <span style={{ ...lbl, marginBottom:'12px' }}>Suelo</span>
            {!terrainAnalyzed ? (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted)', fontSize:'0.72rem', textAlign:'center', padding:'20px 0' }}>
                Sin terreno analizado
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.74rem', marginBottom:'5px' }}>
                    <span style={{ color:'var(--muted)' }}>Acidez (pH)</span>
                    <strong style={{ color: phLevel<6||phLevel>8 ? '#ff7070' : '#5af7cf' }}>{phLevel.toFixed(1)}</strong>
                  </div>
                  <input type="range" min="0" max="14" step="0.1" value={phLevel}
                    onChange={e => setPhLevel(+e.target.value)}
                    disabled={failsafeStatus==='ACTIVE'} style={{ width:'100%' }} />
                  <span style={{ fontSize:'0.62rem', color: phLevel<6||phLevel>8 ? '#ff7070':'var(--muted)', display:'block', marginTop:'3px' }}>
                    {phLevel<6 ? 'Suelo ácido' : phLevel>8 ? 'Suelo alcalino' : 'Nivel ideal (6–8)'}
                  </span>
                </div>

                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.74rem', marginBottom:'5px' }}>
                    <span style={{ color:'var(--muted)' }}>Arsénico</span>
                    <strong style={{ color: arsenicLevel>22 ? '#ff7070':'#5af7cf' }}>{arsenicLevel} mg/kg</strong>
                  </div>
                  <input type="range" min="0" max="100" value={arsenicLevel}
                    onChange={e => setArsenicLevel(+e.target.value)}
                    disabled={failsafeStatus==='ACTIVE'} style={{ width:'100%' }} />
                  <span style={{ fontSize:'0.62rem', color: arsenicLevel>22 ? '#ff7070':'var(--muted)', display:'block', marginTop:'3px' }}>
                    {arsenicLevel>22 ? 'Supera NOM-147 (máx 22)' : 'Dentro del límite'}
                  </span>
                </div>

                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.74rem', marginBottom:'5px' }}>
                    <span style={{ color:'var(--muted)' }}>Humedad del suelo</span>
                    <strong style={{ color:'#47d6ff' }}>38%</strong>
                  </div>
                  <div style={{ height:'6px', borderRadius:'999px', background:'rgba(255,255,255,0.05)' }}>
                    <div style={{ width:'38%', height:'100%', borderRadius:'999px',
                      background:'linear-gradient(90deg,#47d6ff,#5af7cf)' }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {terrainAnalyzed && (
            <div className="panel" style={{ padding:'14px', flexShrink:0, display:'flex', flexDirection:'column' }}>
              <span style={{ ...lbl, marginBottom:'12px' }}>Datos de Remediación</span>
              <EstadisticasPanel activeMap={activeMap} arsenicLevel={arsenicLevel} area={area} />
            </div>
          )}

          <div className="panel" style={{ padding:'14px', flexShrink:0, display:'flex', flexDirection:'column', gap:'10px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={lbl}>Rover</span>
              <span style={{ fontSize:'0.63rem', fontWeight:'700', padding:'2px 8px', borderRadius:'4px',
                background: isCharging ? 'rgba(255,193,7,0.12)' : failsafeStatus==='ACTIVE' ? 'rgba(255,112,112,0.12)' : 'rgba(74,235,183,0.08)',
                color: isCharging ? '#ffc107' : failsafeStatus==='ACTIVE' ? '#ff7070' : '#5af7cf',
                border:`1px solid ${isCharging ? '#ffc107' : failsafeStatus==='ACTIVE' ? '#ff7070' : '#5af7cf'}`,
                animation: failsafeStatus==='ACTIVE' ? 'pulse 1s infinite' : 'none',
              }}>
                {isCharging ? 'Cargando' : failsafeStatus==='ACTIVE' ? 'Regresando' : 'Normal'}
              </span>
            </div>

            <div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.74rem', marginBottom:'5px' }}>
                <span style={{ color:'var(--muted)' }}>Batería</span>
                <strong style={{ color: battColor }}>{batteryLevel}%{isCharging ? ' ↑' : ''}</strong>
              </div>
              <input type="range" min="5" max="100" value={batteryLevel}
                onChange={e => { if (!isCharging) setBatteryLevel(+e.target.value); }}
                disabled={isCharging} style={{ width:'100%' }} />
              <span style={{ fontSize:'0.62rem', color: batteryLevel<20 ? '#ff7070':'var(--muted)', display:'block', marginTop:'3px' }}>
                {isCharging ? 'Cargando en la estación...'
                  : batteryLevel<20 ? 'Retorno automático activado'
                  : 'Al llegar al 20% el rover regresa solo'}
              </span>
            </div>

            <div ref={consoleRef} style={{
              background:'#020305', border:'1px solid #141b27', borderRadius:'7px',
              padding:'8px 10px', fontFamily:'monospace', fontSize:'0.62rem',
              overflowY:'auto', display:'flex', flexDirection:'column', gap:'3px', height:'120px',
            }}>
              <div style={{ color:'#2a3a4e', borderBottom:'1px solid #141b27', paddingBottom:'4px', marginBottom:'2px', fontSize:'0.58rem' }}>
                CONSOLA — ROVER-01
              </div>
              {logs.map((log, i) => {
                let c = '#85e89d';
                if (log.includes('[AVISO]')) c = '#ff7b72';
                if (log.includes('[SYS]'))   c = '#79c0ff';
                if (log.includes('[RUTA]'))  c = '#ffa657';
                if (log.includes('[CARGA]')) c = '#ffd580';
                return <div key={i} style={{ color:c, lineHeight:1.5 }}>{log}</div>;
              })}
            </div>
          </div>
        </div>
      </div>

      <GenerateRutaModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onGenerated={ruta => { setGeneratedRoute(ruta); setRouteStatus('planificada'); }}
      />
      <CreateRobotModal
        open={robotModalOpen}
        onClose={() => setRobotModalOpen(false)}
        onCreated={() => setRobotsRefreshToken(v => v + 1)}
      />
      <PlanesSaaS
        open={saasModalOpen}
        onClose={() => setSaasModalOpen(false)}
      />
    </div>
  );
}

export default Dashboard;