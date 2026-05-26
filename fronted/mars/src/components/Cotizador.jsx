import React, { useState } from 'react';

export function Cotizador({ area, onClose }) {
  const [plan, setPlan] = useState('Basico');
  const totalCapsulas = Math.max(1, Math.ceil(area / 10));
  const precioUnitario = 45.00; 
  

  let descuentoPorcentaje = 0;
  if (plan === 'Pro') descuentoPorcentaje = 0.15; 
  if (plan === 'Enterprise') descuentoPorcentaje = 0.30; 

  const subtotal = totalCapsulas * precioUnitario;
  const descuentoTotal = subtotal * descuentoPorcentaje;
  const totalFinal = subtotal - descuentoTotal;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.85)', display: 'flex',
      justifyContent: 'center', alignItems: 'center', zIndex: 9999,
      backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        backgroundColor: '#0a0d14', border: '1px solid #ff8a2b',
        borderRadius: '12px', padding: '30px', width: '90%', maxWidth: '500px',
        color: '#fff', position: 'relative'
      }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '15px', right: '20px', background: 'transparent', border: 'none', color: '#ff7070', fontSize: '1.2rem', cursor: 'pointer' }}>✖</button>
        
        <h2 style={{ textAlign: 'center', color: '#ff8a2b', margin: '0 0 5px 0' }}>Cotizador M.Y.C.O.</h2>
        <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '25px' }}>
          Análisis completado para {area} m² de terreno.
        </p>

        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #1f2937' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span>Cápsulas de micelio requeridas:</span>
            <strong style={{ color: '#5af7cf' }}>{totalCapsulas} envases</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span>Precio unitario:</span>
            <span>${precioUnitario.toFixed(2)} USD</span>
          </div>
          
          <hr style={{ borderColor: '#1f2937', margin: '15px 0' }} />

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '5px' }}>Selecciona tu Plan SaaS actual:</label>
            <select 
              value={plan} 
              onChange={(e) => setPlan(e.target.value)}
              style={{ width: '100%', padding: '8px', background: '#020305', color: '#fff', border: '1px solid #1f2937', borderRadius: '6px' }}
            >
              <option value="Basico">Plan Básico (Sin descuento)</option>
              <option value="Pro">Plan Pro (15% de descuento)</option>
              <option value="Enterprise">Plan Enterprise (30% de descuento)</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: 'var(--muted)' }}>
            <span>Subtotal:</span>
            <span>${subtotal.toFixed(2)} USD</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: '#5af7cf' }}>
            <span>Descuento aplicado:</span>
            <span>-${descuentoTotal.toFixed(2)} USD</span>
          </div>

          <hr style={{ borderColor: '#1f2937', margin: '15px 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 'bold' }}>
            <span>Total a pagar:</span>
            <span style={{ color: '#ff8a2b' }}>${totalFinal.toFixed(2)} USD</span>
          </div>
        </div>

        <button style={{ width: '100%', background: '#ff8a2b', border: 'none', color: '#000', fontWeight: 'bold', padding: '12px', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem' }}>
          Procesar Orden de Remediación
        </button>
      </div>
    </div>
  );
}