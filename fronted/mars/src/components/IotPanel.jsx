import React, { useState, useEffect, useRef } from 'react';

export function IotPanel({
  activeMap,
  batteryLevel,
  setBatteryLevel,
  arsenicLevel,
  setArsenicLevel,
  phLevel,
  setPhLevel,
  valveOpen,
  setValveOpen,
  failsafeStatus,
  setFailsafeStatus,
}) {
  // ─── CLIMA ────────────────────────────────────────────────────────────────
  const [clima, setClima] = useState({
    temp: 28.5,
    hum: 34,
    pres: 1012,
    viento: 14.5,
    precip: 0,
    status: 'Despejado',
    loading: false,
    mode: 'Simulado',
  });

  useEffect(() => {
    fetchClima();
  }, [activeMap]);

  const fetchClima = async () => {
    setClima((prev) => ({ ...prev, loading: true }));

    if (activeMap === 'earth') {
      try {
        const res = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=28.6353&lon=-106.0889&appid=364998e3b3a32f6b8df815a51c4a0342&units=metric`
        );
        if (!res.ok) throw new Error('API error');
        const data = await res.json();
        setClima({
          temp: data.main.temp,
          hum: data.main.humidity,
          pres: data.main.pressure,
          viento: Number((data.wind.speed * 3.6).toFixed(1)),
          precip: data.rain ? data.rain['1h'] || 0 : 0,
          status: data.weather[0].description,
          loading: false,
          mode: 'OpenWeatherMap (En vivo)',
        });
      } catch {
        setTimeout(() => {
          setClima({
            temp: 29.4,
            hum: 28,
            pres: 1014,
            viento: 12.8,
            precip: 0,
            status: 'Soleado / Semi-arido',
            loading: false,
            mode: 'Historico Chihuahua',
          });
        }, 400);
      }
    } else {
      setClima({
        temp: -62.4,
        hum: 4,
        pres: 6,
        viento: 22.4,
        precip: 0,
        status: 'Atmosfera delgada / Frio extremo',
        loading: false,
        mode: 'NASA Curiosity Feed',
      });
    }
  };

  // ─── HOME-SEEKING TERMINAL ─────────────────────────────────────────────────
  const [terminalLogs, setTerminalLogs] = useState([
    '[SYS] M.Y.C.O. OS v2.4.0 iniciado correctamente.',
    '[SYS] Valvula solenoide de inyeccion: ABIERTA.',
    '[SYS] Rover en campo. Inyectando capsulas de micelio...',
  ]);

  const triggerFailsafe = () => {
    setBatteryLevel(18);
    setFailsafeStatus('ACTIVE');
    setValveOpen(false);
    const t = new Date().toLocaleTimeString();
    setTerminalLogs((prev) => [
      ...prev,
      `[${t}] [ALERTA] Bateria al 18% — por debajo del umbral de seguridad (20%).`,
      `[${t}] [SYS] Suspendiendo inyeccion de capsulas de micelio...`,
      `[${t}] [VALVULA] Valvula solenoide CERRADA. Inyeccion detenida.`,
      `[${t}] [HOME-SEEKING] Calculando ruta de regreso a estacion de carga...`,
      `[${t}] [A*] Ruta optima encontrada. Distancia: 480 metros.`,
      `[${t}] [SYS] Rover en retorno autonomo. Velocidad reducida al 35% (modo ECO).`,
    ]);
  };

  const resetFailsafe = () => {
    setBatteryLevel(95);
    setFailsafeStatus('NORMAL');
    setValveOpen(true);
    const t = new Date().toLocaleTimeString();
    setTerminalLogs((prev) => [
      ...prev,
      `[${t}] [SYS] Carga completa. Bateria al 95%.`,
      `[${t}] [VALVULA] Valvula solenoide ABIERTA. Retomando inyeccion.`,
      `[${t}] [SYS] Rover regresa al campo. Mision en curso.`,
    ]);
  };

  useEffect(() => {
    if (batteryLevel < 20 && failsafeStatus === 'NORMAL') {
      setFailsafeStatus('ACTIVE');
      setValveOpen(false);
      const t = new Date().toLocaleTimeString();
      setTerminalLogs((prev) => [
        ...prev,
        `[${t}] [ALERTA] Bateria detectada en ${batteryLevel}% — umbral cruzado.`,
        `[${t}] [SYS] HOME-SEEKING activado automaticamente.`,
        `[${t}] [VALVULA] Inyeccion suspendida. [CERRADA]`,
      ]);
    }
  }, [batteryLevel]);

  // ─── ESTILOS COMPARTIDOS ───────────────────────────────────────────────────
  const cardStyle = {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid var(--line)',
    borderRadius: '10px',
    padding: '14px 16px',
  };

  const labelStyle = {
    fontSize: '0.7rem',
    color: 'var(--muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    display: 'block',
    marginBottom: '4px',
  };

  const valueStyle = (color = '#fff') => ({
    fontSize: '1.4rem',
    fontWeight: '800',
    color,
    display: 'block',
    lineHeight: 1.1,
  });

  const subStyle = {
    fontSize: '0.65rem',
    color: 'var(--muted)',
    marginTop: '3px',
    display: 'block',
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '4px',
      }}
    >
      {/* ═══════════════════════════════════════════════════════════════
          SECCIÓN 1 — CONDICIONES DEL CLIMA
      ═══════════════════════════════════════════════════════════════ */}
      <section className="panel" style={{ padding: '18px' }}>
        {/* Header de sección */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '14px',
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: '0.8rem',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                color: 'var(--muted)',
              }}
            >
              Condiciones del Clima
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: '0.85rem', color: '#fff', fontWeight: '600' }}>
              {activeMap === 'earth' ? 'Chihuahua, Mexico' : 'Crater Jezero, Marte'}
            </p>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.7rem',
              color: clima.mode.includes('En vivo') ? '#5af7cf' : '#ffc107',
              background: clima.mode.includes('En vivo')
                ? 'rgba(74,235,183,0.08)'
                : 'rgba(255,193,7,0.08)',
              border: `1px solid ${clima.mode.includes('En vivo') ? 'rgba(74,235,183,0.25)' : 'rgba(255,193,7,0.25)'}`,
              borderRadius: '999px',
              padding: '4px 10px',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: clima.mode.includes('En vivo') ? '#5af7cf' : '#ffc107',
                display: 'inline-block',
                animation: 'pulse 1.5s infinite',
              }}
            />
            {clima.loading ? 'Cargando...' : clima.mode}
          </div>
        </div>

        {/* Cards de clima en grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '10px',
          }}
        >
          {/* Temperatura */}
          <div style={cardStyle}>
            <span style={labelStyle}>Temperatura</span>
            <span style={valueStyle(clima.temp > 0 ? '#ff8a2b' : '#47d6ff')}>
              {clima.temp.toFixed(1)} °C
            </span>
            <span style={subStyle}>
              {clima.temp > 35
                ? 'Calor extremo — riesgo de sobrecalentamiento'
                : clima.temp < 0
                ? 'Temperatura bajo cero'
                : 'Rango operativo normal'}
            </span>
          </div>

          {/* Humedad */}
          <div style={cardStyle}>
            <span style={labelStyle}>Humedad Relativa</span>
            <span style={valueStyle('#5af7cf')}>{clima.hum}%</span>
            <span style={subStyle}>
              {clima.hum < 20 ? 'Ambiente muy seco' : clima.hum > 70 ? 'Alta humedad' : 'Nivel normal'}
            </span>
          </div>

          {/* Viento */}
          <div style={cardStyle}>
            <span style={labelStyle}>Velocidad del Viento</span>
            <span style={valueStyle('#b08cff')}>{clima.viento} km/h</span>
            <span style={subStyle}>
              {clima.viento > 40 ? 'Viento fuerte — pausar operacion' : 'Condiciones operativas'}
            </span>
          </div>

          {/* Precipitacion */}
          <div style={cardStyle}>
            <span style={labelStyle}>Precipitacion</span>
            <span style={valueStyle('#47d6ff')}>{clima.precip.toFixed(1)} mm/h</span>
            <span style={subStyle}>
              {clima.precip > 5 ? 'Lluvia — suspender mision' : 'Sin precipitacion activa'}
            </span>
          </div>

          {/* Presion */}
          <div style={cardStyle}>
            <span style={labelStyle}>Presion Atmosferica</span>
            <span style={valueStyle('#ffd24d')}>
              {clima.pres} {activeMap === 'earth' ? 'hPa' : 'hPa equiv.'}
            </span>
            <span style={subStyle}>Sensor barometrico</span>
          </div>

          {/* Condicion general */}
          <div style={{ ...cardStyle, background: 'rgba(255,69,0,0.04)', borderColor: 'rgba(255,69,0,0.2)' }}>
            <span style={labelStyle}>Estado General</span>
            <span
              style={{
                fontSize: '0.95rem',
                fontWeight: '700',
                color: '#ff8a2b',
                display: 'block',
                textTransform: 'capitalize',
                lineHeight: 1.3,
                marginTop: '2px',
              }}
            >
              {clima.status}
            </span>
            <span style={subStyle}>
              {activeMap === 'earth' ? 'Condiciones locales detectadas' : 'Datos NASA Curiosity'}
            </span>
          </div>
        </div>

        {/* Boton refrescar */}
        <button
          onClick={fetchClima}
          disabled={clima.loading}
          style={{
            marginTop: '12px',
            background: 'transparent',
            border: '1px solid var(--line)',
            color: 'var(--muted)',
            borderRadius: '6px',
            padding: '5px 14px',
            fontSize: '0.75rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => (e.target.style.color = '#fff')}
          onMouseLeave={(e) => (e.target.style.color = 'var(--muted)')}
        >
          {clima.loading ? 'Actualizando...' : 'Actualizar datos de clima'}
        </button>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECCIÓN 2 — SENSORES DEL SUELO Y HOME-SEEKING
      ═══════════════════════════════════════════════════════════════ */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1.6fr',
          gap: '16px',
        }}
      >
        {/* ── Panel izquierdo: Sensores ── */}
        <div className="panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3
            style={{
              margin: 0,
              fontSize: '0.8rem',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              color: 'var(--muted)',
            }}
          >
            Sensores del Suelo
          </h3>

          {/* pH */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '6px' }}>
              <span style={{ color: 'var(--muted)' }}>pH del suelo</span>
              <strong style={{ color: phLevel < 6 || phLevel > 8 ? '#ff7070' : '#5af7cf' }}>
                {phLevel.toFixed(1)}
              </strong>
            </div>
            <input
              type="range"
              min="0"
              max="14"
              step="0.1"
              value={phLevel}
              onChange={(e) => setPhLevel(Number(e.target.value))}
              style={{ width: '100%', cursor: failsafeStatus === 'ACTIVE' ? 'not-allowed' : 'pointer' }}
              disabled={failsafeStatus === 'ACTIVE'}
            />
            <span style={{ fontSize: '0.65rem', color: phLevel < 6 || phLevel > 8 ? '#ff7070' : 'var(--muted)' }}>
              {phLevel < 6 ? 'Suelo acido — requiere tratamiento' : phLevel > 8 ? 'Suelo alcalino — requiere ajuste' : 'pH optimo para micelio (6 - 8)'}
            </span>
          </div>

          {/* Humedad suelo */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '6px' }}>
              <span style={{ color: 'var(--muted)' }}>Humedad del suelo</span>
              <strong style={{ color: '#47d6ff' }}>{batteryLevel > 20 ? '38%' : '0%'}</strong>
            </div>
            <div
              style={{
                height: '8px',
                borderRadius: '999px',
                background: 'rgba(255,255,255,0.05)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: batteryLevel > 20 ? '38%' : '0%',
                  height: '100%',
                  background: 'linear-gradient(90deg, #47d6ff, #5af7cf)',
                  borderRadius: '999px',
                  transition: 'width 0.8s ease',
                }}
              />
            </div>
            <span style={{ fontSize: '0.65rem', color: 'var(--muted)', marginTop: '4px', display: 'block' }}>
              Sensor higrómetro capacitivo del rover
            </span>
          </div>

          {/* Arsenico */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '6px' }}>
              <span style={{ color: 'var(--muted)' }}>Arsénico en suelo</span>
              <strong style={{ color: arsenicLevel > 22 ? '#ff7070' : '#5af7cf' }}>
                {arsenicLevel} mg/kg
              </strong>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={arsenicLevel}
              onChange={(e) => setArsenicLevel(Number(e.target.value))}
              style={{ width: '100%', cursor: failsafeStatus === 'ACTIVE' ? 'not-allowed' : 'pointer' }}
              disabled={failsafeStatus === 'ACTIVE'}
            />
            <div
              style={{
                fontSize: '0.65rem',
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '4px',
              }}
            >
              <span style={{ color: 'var(--muted)' }}>Limite NOM-147: 22 mg/kg</span>
              <strong style={{ color: arsenicLevel > 22 ? '#ff7070' : '#5af7cf' }}>
                {arsenicLevel > 22 ? 'EXCEDE LIMITE' : 'Dentro del limite'}
              </strong>
            </div>
          </div>

          {/* Bateria del rover */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '6px' }}>
              <span style={{ color: 'var(--muted)' }}>Batería del rover</span>
              <strong style={{ color: batteryLevel < 20 ? '#ff7070' : batteryLevel < 40 ? '#ffc107' : '#5af7cf' }}>
                {batteryLevel}%
              </strong>
            </div>
            <input
              type="range"
              min="5"
              max="100"
              value={batteryLevel}
              onChange={(e) => setBatteryLevel(Number(e.target.value))}
              style={{ width: '100%', cursor: failsafeStatus === 'ACTIVE' ? 'not-allowed' : 'pointer' }}
              disabled={failsafeStatus === 'ACTIVE'}
            />
            <span style={{ fontSize: '0.65rem', color: batteryLevel < 20 ? '#ff7070' : 'var(--muted)' }}>
              {batteryLevel < 20
                ? 'Home-Seeking activo — rover regresando a base'
                : `Umbral de regreso automatico: 20%`}
            </span>
          </div>

          {/* Estado valvula */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              ...cardStyle,
            }}
          >
            <div>
              <strong style={{ fontSize: '0.78rem', display: 'block' }}>Valvula de inyeccion</strong>
              <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>Siembra capsulas de micelio</span>
            </div>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: '800',
                padding: '4px 10px',
                borderRadius: '6px',
                background: valveOpen ? 'rgba(74,235,183,0.15)' : 'rgba(255,112,112,0.15)',
                color: valveOpen ? '#5af7cf' : '#ff7070',
                border: `1px solid ${valveOpen ? '#5af7cf' : '#ff7070'}`,
              }}
            >
              {valveOpen ? 'INYECTANDO' : 'SUSPENDIDA'}
            </span>
          </div>

          {/* Botones de control */}
          {failsafeStatus === 'NORMAL' ? (
            <button
              onClick={triggerFailsafe}
              style={{
                background: '#ff3a5d',
                color: '#fff',
                fontSize: '0.75rem',
                fontWeight: '700',
                padding: '10px',
                border: 0,
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => (e.target.style.opacity = 0.85)}
              onMouseLeave={(e) => (e.target.style.opacity = 1)}
            >
              Simular bateria baja (&lt;20%)
            </button>
          ) : (
            <button
              onClick={resetFailsafe}
              style={{
                background: '#ffd24d',
                color: '#000',
                fontSize: '0.75rem',
                fontWeight: '700',
                padding: '10px',
                border: 0,
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => (e.target.style.opacity = 0.85)}
              onMouseLeave={(e) => (e.target.style.opacity = 1)}
            >
              Cargar bateria — reanudar mision
            </button>
          )}
        </div>

        {/* ── Panel derecho: Consola Home-Seeking ── */}
        <div className="panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
            }}
          >
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: '0.8rem',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  color: 'var(--muted)',
                }}
              >
                Algoritmo Home-Seeking
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: '0.75rem', color: 'var(--muted)' }}>
                Cuando la bateria baja del 20%, el rover suspende la inyeccion y regresa solo a su estacion de carga.
              </p>
            </div>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: '700',
                padding: '3px 10px',
                borderRadius: '4px',
                background:
                  failsafeStatus === 'ACTIVE'
                    ? 'rgba(255,112,112,0.12)'
                    : 'rgba(74,235,183,0.08)',
                color: failsafeStatus === 'ACTIVE' ? '#ff7070' : '#5af7cf',
                border: `1px solid ${failsafeStatus === 'ACTIVE' ? '#ff7070' : '#5af7cf'}`,
                animation: failsafeStatus === 'ACTIVE' ? 'pulse 1s infinite' : 'none',
                whiteSpace: 'nowrap',
              }}
            >
              {failsafeStatus === 'ACTIVE' ? 'HOME-SEEKING ACTIVO' : 'Sistema OK'}
            </span>
          </div>

          {/* Terminal */}
          <div
            style={{
              flex: 1,
              background: '#020305',
              border: '1px solid #141b27',
              borderRadius: '8px',
              padding: '12px',
              fontFamily: 'monospace',
              fontSize: '0.72rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '5px',
              minHeight: '280px',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                color: '#3a4a5e',
                borderBottom: '1px solid #141b27',
                paddingBottom: '6px',
                marginBottom: '4px',
                fontSize: '0.65rem',
              }}
            >
              M.Y.C.O. DIAGNOSTIC CONSOLE — ROVER-01
            </div>
            {terminalLogs.map((log, i) => {
              let color = '#85e89d';
              if (log.includes('[ALERTA]') || log.includes('suspendida') || log.includes('CERRADA')) color = '#ff7b72';
              if (log.includes('[SYS]') || log.includes('[A*]')) color = '#79c0ff';
              if (log.includes('[VALVULA]')) color = '#ffd580';
              if (log.includes('[HOME-SEEKING]')) color = '#ffa657';
              return (
                <div key={i} style={{ color, lineHeight: 1.5 }}>
                  {log}
                </div>
              );
            })}
          </div>

          <div
            style={{
              marginTop: '8px',
              fontSize: '0.65rem',
              color: 'var(--muted)',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>Algoritmo de ruta: A* (Zig-Zag)</span>
            <span>Estacion de carga: 28.63533, -106.08891</span>
          </div>
        </div>
      </section>
    </div>
  );
}
