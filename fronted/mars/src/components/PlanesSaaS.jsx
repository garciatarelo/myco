import React from 'react';

export function PlanesSaaS({ open, onClose }) {
  if (!open) return null;

  const overlayStyle = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    zIndex: 9999, backdropFilter: 'blur(4px)'
  };

  const modalStyle = {
    backgroundColor: '#0a0d14', border: '1px solid #1f2937',
    borderRadius: '12px', padding: '30px', width: '90%', maxWidth: '1000px',
    color: '#fff', position: 'relative'
  };

  const cardStyle = {
    background: 'rgba(255,255,255,0.03)', border: '1px solid #1f2937',
    borderRadius: '8px', padding: '20px', display: 'flex',
    flexDirection: 'column', gap: '15px', flex: 1
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <button 
          onClick={onClose} 
          style={{ position: 'absolute', top: '15px', right: '20px', background: 'transparent', border: 'none', color: '#ff7070', fontSize: '1.2rem', cursor: 'pointer' }}
        >
          ✖
        </button>
        
        <h2 style={{ textAlign: 'center', color: '#ff4500', marginBottom: '5px' }}>Planes SaaS M.Y.C.O.</h2>
        <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '30px' }}>
          Soluciones modulares para cooperativas agrícolas y agencias espaciales internacionales.
        </p>

        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          
          <div style={cardStyle}>
            <h3 style={{ margin: 0, color: '#47d6ff' }}>Plan Básico</h3>
            <ul style={{ paddingLeft: '20px', color: '#d1d5db', fontSize: '0.85rem', lineHeight: '1.6', margin: 0 }}>
              <li>Acceso al Gemelo Digital.</li>
              <li>Trazado de parcelas.</li>
              <li>Alertas de toxicidad.</li>
              <li>Soporte técnico/mantenimiento remoto de software.</li>
            </ul>
            <button style={{ marginTop: 'auto', background: 'rgba(71, 214, 255, 0.1)', border: '1px solid #47d6ff', color: '#47d6ff', padding: '10px', borderRadius: '6px', cursor: 'pointer' }}>
              Seleccionar Básico
            </button>
          </div>

          <div style={{ ...cardStyle, border: '1px solid #ff8a2b', transform: 'scale(1.05)', background: 'rgba(255, 138, 43, 0.05)' }}>
            <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: '#ff8a2b', color: '#000', padding: '2px 10px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold' }}>
              MÁS POPULAR
            </div>
            <h3 style={{ margin: 0, color: '#ff8a2b' }}>Plan Pro</h3>
            <ul style={{ paddingLeft: '20px', color: '#d1d5db', fontSize: '0.85rem', lineHeight: '1.6', margin: 0 }}>
              <li>Beneficios del plan básico.</li>
              <li>Acceso a historial avanzado de métricas de suelo.</li>
              <li>Mantenimiento híbrido (remoto y refacciones físicas a precio de fábrica).</li>
              <li>Acceso a tarifas preferenciales de micelio.</li>
            </ul>
            <button style={{ marginTop: 'auto', background: '#ff8a2b', border: 'none', color: '#000', fontWeight: 'bold', padding: '10px', borderRadius: '6px', cursor: 'pointer' }}>
              Seleccionar Pro
            </button>
          </div>

          <div style={cardStyle}>
            <h3 style={{ margin: 0, color: '#5af7cf' }}>Plan Enterprise</h3>
            <ul style={{ paddingLeft: '20px', color: '#d1d5db', fontSize: '0.85rem', lineHeight: '1.6', margin: 0 }}>
              <li>Control de enjambres robóticos múltiples.</li>
              <li>Acceso a la API para sistemas propietarios.</li>
              <li>IA de navegación personalizada.</li>
              <li>Mantenimiento VIP in-situ 24/7 directamente en la estación de carga.</li>
            </ul>
            <button style={{ marginTop: 'auto', background: 'rgba(90, 247, 207, 0.1)', border: '1px solid #5af7cf', color: '#5af7cf', padding: '10px', borderRadius: '6px', cursor: 'pointer' }}>
              Contactar Ventas
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}