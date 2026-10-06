import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import teamLogo from '../assets/logo.ico';
import mycoLogo from '../assets/myco.png';

/* ─── Planes Data ─── */
const plans = [
  {
    name: 'Básico',
    color: '#47d6ff',
    popular: false,
    description: 'Para cooperativas que inician en el monitoreo de suelo',
    price: 'Consultar',
    features: [
      'Acceso al Gemelo Digital',
      'Trazado de parcelas',
      'Alertas de toxicidad',
      'Soporte técnico remoto',
      'Dashboard de métricas básicas',
    ],
    cta: 'Seleccionar Básico',
    ctaStyle: 'border border-[#47d6ff] text-[#47d6ff] bg-[#47d6ff]/5 hover:bg-[#47d6ff]/15',
  },
  {
    name: 'Pro',
    color: '#ff8a2b',
    popular: true,
    description: 'El plan preferido por agencias agrícolas medianas',
    price: 'Consultar',
    features: [
      'Todo el plan Básico',
      'Historial avanzado de métricas de suelo',
      'Mantenimiento híbrido (remoto + físico)',
      'Tarifas preferenciales de micelio',
      'Reportes NOM-147 automatizados',
    ],
    cta: 'Seleccionar Pro',
    ctaStyle: 'bg-[#ff8a2b] text-black font-bold hover:bg-[#ff8a2b]/80',
  },
  {
    name: 'Enterprise',
    color: '#5af7cf',
    popular: false,
    description: 'Para agencias espaciales y operaciones industriales',
    price: 'Cotización',
    features: [
      'Control de enjambres robóticos múltiples',
      'API para sistemas propietarios',
      'IA de navegación personalizada',
      'Mantenimiento VIP in-situ 24/7',
      'Soporte de integración orbital',
    ],
    cta: 'Contactar Ventas',
    ctaStyle: 'border border-[#5af7cf] text-[#5af7cf] bg-[#5af7cf]/5 hover:bg-[#5af7cf]/15',
  },
];

const stats = [
  { value: '98%', label: 'Recuperación del suelo', icon: 'fa-leaf' },
  { value: '3.4x', label: 'Reducción de arsénico', icon: 'fa-flask' },
  { value: '24/7', label: 'Monitoreo continuo', icon: 'fa-satellite' },
  { value: '+50ha', label: 'Hectáreas tratadas', icon: 'fa-map' },
];

const features = [
  {
    icon: 'fa-map-marked-alt',
    color: '#ff4500',
    title: 'Gemelo Digital',
    desc: 'Visualiza tu terreno en tiempo real con un mapa 3D interactivo y sensorización satelital.',
  },
  {
    icon: 'fa-robot',
    color: '#47d6ff',
    title: 'Flota Robótica',
    desc: 'Rovers autónomos M.Y.C.O. que inyectan cápsulas de micelio con precisión centimétrica.',
  },
  {
    icon: 'fa-dna',
    color: '#5af7cf',
    title: 'Biorremediación',
    desc: 'Tecnología de hongos micorrícicos que neutraliza arsénico y metales pesados de forma orgánica.',
  },
  {
    icon: 'fa-chart-line',
    color: '#ff8a2b',
    title: 'Analítica Avanzada',
    desc: 'Métricas de suelo en tiempo real: pH, toxicidad, fertilidad estimada y reportes NOM-147.',
  },
  {
    icon: 'fa-shield-alt',
    color: '#a78bfa',
    title: 'Cumplimiento NOM-147',
    desc: 'Todos nuestros procesos cumplen con la normativa mexicana de remediación de suelos contaminados.',
  },
  {
    icon: 'fa-satellite-dish',
    color: '#ff4500',
    title: 'Telemetría Orbital',
    desc: 'Enlace de datos de alta disponibilidad para operaciones terrestres y proyectos espaciales.',
  },
];

function Pulse({ color = '#ff4500' }) {
  return (
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: color }}></span>
      <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: color }}></span>
    </span>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => { clearInterval(t); window.removeEventListener('scroll', handleScroll); };
  }, []);

  return (
    <div className="min-h-screen bg-black text-white font-mono overflow-x-hidden">

      {/* ── Global background grid ── */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(rgba(255,69,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,69,0,0.03) 1px, transparent 1px)',
          backgroundSize: '80px 80px'
        }} />
        <div className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-black" />
      </div>

      {/* ── Header ── */}
      <header className={`fixed top-0 inset-x-0 z-50 flex items-center gap-4 px-6 py-3 transition-all duration-300 ${scrolled ? 'bg-black/90 backdrop-blur-md border-b border-white/10' : 'bg-transparent'}`}>
        <div className="flex items-center gap-3 pr-4 border-r border-white/10">
          <div className="w-8 h-8 rounded-full border border-[#ff4500] overflow-hidden shrink-0 flex items-center justify-center bg-black">
            <img src={teamLogo} alt="MYCO" className="w-full h-full object-contain grayscale sepia hover:grayscale-0 transition-all" />
          </div>
          <span className="text-sm font-bold text-[#ff4500] tracking-[0.2em]">M.Y.C.O</span>
        </div>

        <nav className="flex gap-1 ml-4">
          {['Inicio', 'Características', 'Planes', 'Contacto'].map(link => (
            <a key={link} href={`#${link.toLowerCase()}`}
              className="px-4 py-1 text-[0.65rem] tracking-widest text-gray-400 hover:text-white border border-transparent hover:border-white/10 rounded transition-all">
              {link.toUpperCase()}
            </a>
          ))}
        </nav>

        <div className="flex-1" />

        <div className="flex items-center gap-4 text-[0.65rem]">
          <div className="flex items-center gap-2">
            <Pulse />
            <span className="text-gray-400 tracking-widest">SISTEMA</span>
            <strong className="text-white">NOMINAL</strong>
          </div>
          <div className="text-white font-bold text-sm w-20 text-right">
            {time.toLocaleTimeString('es-MX', { hour12: false })}
          </div>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-1 text-[0.65rem] tracking-widest border border-[#ff4500] text-[#ff4500] bg-[#ff4500]/10 hover:bg-[#ff4500]/20 rounded transition-colors flex items-center gap-1.5"
          >
            <i className="fas fa-satellite text-xs"></i>
            CONSOLA
          </button>
        </div>
      </header>

      {/* ── HERO ── */}
      <section id="inicio" className="relative min-h-screen flex flex-col items-center justify-center pt-20 pb-16 px-6 text-center">
        {/* Radial glow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[600px] h-[600px] rounded-full" style={{ background: 'radial-gradient(ellipse, rgba(255,69,0,0.12) 0%, transparent 70%)' }} />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 text-[0.6rem] tracking-[0.3em] text-[#ff4500] uppercase bg-[#ff4500]/10 border border-[#ff4500]/20 rounded-full px-4 py-1.5 mb-8">
            <Pulse />
            Sistema de Biorremediación Activa — MYCO v2.0
          </div>

          <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-none mb-6">
            <span className="text-white">EL FUTURO DEL</span>
            <br />
            <span style={{ background: 'linear-gradient(135deg, #ff4500, #ff8a2b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              SUELO VIVO
            </span>
          </h1>

          <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            Tecnología de rovers autónomos con micelio para limpiar, restaurar y monitorear suelos contaminados con arsénico — en la Tierra y en Marte.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/')}
              className="px-8 py-4 bg-[#ff4500] text-white font-bold tracking-widest uppercase text-sm rounded hover:bg-[#ff4500]/80 transition-all shadow-[0_0_30px_rgba(255,69,0,0.4)] hover:shadow-[0_0_50px_rgba(255,69,0,0.6)]"
            >
              <i className="fas fa-satellite mr-2"></i>
              Abrir Consola
            </button>
            <a
              href="#planes"
              className="px-8 py-4 border border-white/20 text-white font-bold tracking-widest uppercase text-sm rounded hover:bg-white/5 transition-all"
            >
              Ver Planes
            </a>
          </div>

          {/* Image placeholder with rover */}
          <div className="mt-16 relative max-w-lg mx-auto">
            <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[0.55rem] text-gray-500 uppercase tracking-widest">Rover en Campo — Activo</span>
                <Pulse />
              </div>
              <img src={mycoLogo} alt="Rover MYCO" className="w-40 mx-auto opacity-90" style={{ filter: 'drop-shadow(0 0 20px #ff4500)' }} />
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[{ l: 'Batería', v: '92%' }, { l: 'Cápsulas', v: '248' }, { l: 'Área', v: '3.4ha' }].map(d => (
                  <div key={d.l} className="bg-white/5 rounded p-2">
                    <div className="text-xs font-bold text-[#ff4500]">{d.v}</div>
                    <div className="text-[0.5rem] text-gray-500 uppercase tracking-wider">{d.l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BAND ── */}
      <section className="relative z-10 border-y border-white/5 bg-white/[0.02] py-12 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map(s => (
            <div key={s.label} className="text-center">
              <i className={`fas ${s.icon} text-[#ff4500] text-2xl mb-3 block`}></i>
              <div className="text-3xl font-black text-white mb-1">{s.value}</div>
              <div className="text-[0.6rem] text-gray-500 uppercase tracking-widest">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="características" className="relative z-10 py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-[0.6rem] tracking-[0.3em] text-[#ff4500] uppercase">Plataforma</span>
            <h2 className="text-3xl md:text-4xl font-black text-white mt-2">CAPACIDADES DEL SISTEMA</h2>
            <p className="text-gray-400 mt-4 max-w-xl mx-auto text-sm">
              Un ecosistema integrado de hardware, software y biología aplicada para la remediación de suelos.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map(f => (
              <div key={f.title} className="bg-black/40 backdrop-blur-md border border-white/5 hover:border-white/10 rounded-xl p-6 transition-all group hover:bg-white/[0.03]">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ background: `${f.color}15`, border: `1px solid ${f.color}30` }}>
                  <i className={`fas ${f.icon} text-sm`} style={{ color: f.color }}></i>
                </div>
                <h3 className="text-white font-bold tracking-widest uppercase text-sm mb-2">{f.title}</h3>
                <p className="text-gray-400 text-xs leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PLANES ── */}
      <section id="planes" className="relative z-10 py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-[0.6rem] tracking-[0.3em] text-[#ff4500] uppercase">SaaS</span>
            <h2 className="text-3xl md:text-4xl font-black text-white mt-2">PLANES M.Y.C.O.</h2>
            <p className="text-gray-400 mt-4 max-w-xl mx-auto text-sm">
              Soluciones modulares para cooperativas agrícolas y agencias espaciales internacionales.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {plans.map(plan => (
              <div key={plan.name} className={`relative bg-black/50 backdrop-blur-md rounded-xl p-6 flex flex-col gap-5 transition-all hover:-translate-y-1 ${plan.popular ? 'border-2 scale-105' : 'border border-white/10 hover:border-white/20'}`}
                style={plan.popular ? { borderColor: plan.color, boxShadow: `0 0 40px ${plan.color}20` } : {}}>
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="text-[0.6rem] font-black tracking-widest uppercase px-4 py-1 rounded-full" style={{ background: plan.color, color: '#000' }}>
                      MÁS POPULAR
                    </span>
                  </div>
                )}

                <div>
                  <div className="text-[0.55rem] text-gray-500 uppercase tracking-widest mb-1">Plan</div>
                  <h3 className="text-2xl font-black tracking-widest uppercase" style={{ color: plan.color }}>{plan.name}</h3>
                  <p className="text-gray-500 text-xs mt-1">{plan.description}</p>
                </div>

                <div>
                  <span className="text-[0.55rem] text-gray-500 uppercase tracking-widest block mb-0.5">Inversión</span>
                  <span className="text-lg font-bold text-white">{plan.price}</span>
                </div>

                <ul className="flex flex-col gap-2.5 flex-1">
                  {plan.features.map(feat => (
                    <li key={feat} className="flex items-start gap-2 text-xs text-gray-300">
                      <i className="fas fa-check-circle text-[0.6rem] mt-0.5 shrink-0" style={{ color: plan.color }}></i>
                      {feat}
                    </li>
                  ))}
                </ul>

                <button className={`w-full py-3 rounded text-xs font-bold tracking-widest uppercase transition-all ${plan.ctaStyle}`}>
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BAND ── */}
      <section id="contacto" className="relative z-10 py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="bg-black/60 backdrop-blur-md border border-[#ff4500]/20 rounded-2xl p-12 shadow-[0_0_80px_rgba(255,69,0,0.1)]">
            <div className="w-16 h-16 rounded-full border-2 border-[#ff4500] overflow-hidden mx-auto mb-6 flex items-center justify-center bg-black">
              <img src={teamLogo} alt="MYCO" className="w-full h-full object-contain" />
            </div>
            <h2 className="text-3xl font-black text-white mb-4">¿LISTO PARA RESTAURAR TU SUELO?</h2>
            <p className="text-gray-400 text-sm mb-8 max-w-md mx-auto">
              Accede a la consola de misión y comienza a simular la remediación de tu terreno en tiempo real.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => navigate('/')}
                className="px-8 py-4 bg-[#ff4500] text-white font-bold tracking-widest uppercase text-sm rounded hover:bg-[#ff4500]/80 transition-all shadow-[0_0_30px_rgba(255,69,0,0.4)]"
              >
                <i className="fas fa-satellite mr-2"></i>
                Ir a la Consola
              </button>
              <a href="mailto:contacto@myco.io"
                className="px-8 py-4 border border-white/20 text-white font-bold tracking-widest uppercase text-sm rounded hover:bg-white/5 transition-all"
              >
                <i className="fas fa-envelope mr-2"></i>
                Contactar
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-white/5 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full border border-[#ff4500] overflow-hidden flex items-center justify-center bg-black">
              <img src={teamLogo} alt="MYCO" className="w-full h-full object-contain" />
            </div>
            <span className="text-xs font-bold text-[#ff4500] tracking-[0.2em]">M.Y.C.O</span>
          </div>
          <p className="text-[0.6rem] text-gray-600 tracking-widest uppercase">
            © 2026 MYCO — Mycorrhizal Yield & Carbon Operations. Todos los derechos reservados.
          </p>
          <div className="flex items-center gap-2">
            <Pulse />
            <span className="text-[0.6rem] text-gray-500 uppercase tracking-widest">Sistema Activo</span>
          </div>
        </div>
      </footer>
    </div>
  );
}