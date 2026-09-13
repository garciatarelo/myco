import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Pulse } from '../common/Pulse';

const ROUTE_TITLES = {
  '/': 'MISIÓN // CONTROL DE TERRENO',
  '/mision': 'MISIÓN // CONTROL DE TERRENO & MAPA',
  '/terrenos': 'INFRAESTRUCTURA // PARCELAS Y BASES DE CARGA',
  '/robots': 'ENJAMBRE // FLOTA GLOBAL MYCO',
  '/gemelo-digital': 'SIMULACIÓN // GEMELO DIGITAL & MODELOS TEMPORALES',
  '/capsulas': 'BIOLOGÍA // CATÁLOGO E INVENTARIO DE CÁPSULAS',
  '/landing': 'SERVICIOS // PLANES Y COTIZADOR SAAS',
  '/login': 'SEGURIDAD // ACCESO DE OPERADOR',
};

export function Header({ onOpenMobile, isCollapsed, onToggleCollapse }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();

  // Reloj de misión UTC
  const [utcTime, setUtcTime] = useState('');

  useEffect(() => {
    function updateClock() {
      const now = new Date();
      setUtcTime(
        now.toUTCString().slice(17, 25) + ' UTC'
      );
    }
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const currentTitle = ROUTE_TITLES[location.pathname] || 'M.Y.C.O // SISTEMA DE CONTROL';

  return (
    <header className="sticky top-0 z-30 h-16 bg-[#131313]/95 backdrop-blur-md  px-4 flex items-center justify-between gap-4">
      {/* Left: Mobile menu toggle + Route Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenMobile}
          className="lg:hidden p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 text-xs"
        >
          <i className="fa-solid fa-bars text-sm" />
        </button>

        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[0.65rem] font-mono font-bold text-[#ff4500] tracking-wider uppercase">
              M.Y.C.O OS
            </span>
            <span className="text-gray-600 text-xs">•</span>
            <span className="text-xs font-mono font-bold text-white tracking-wide truncate">
              {currentTitle}
            </span>
          </div>
          <span className="text-[0.6rem] text-gray-400 font-mono hidden sm:inline">
            Autonomous Mycoremediation Subsurface System
          </span>
        </div>
      </div>

      {/* Right: Live Telemetry & Mission Clock */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Environment Tag */}
        <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-black/60 border border-white/10 text-xs font-mono">
          <i className="fa-solid fa-earth-americas text-emerald-400 text-xs" />
          <span className="text-gray-300 text-[0.7rem]">Valle Alpha</span>
          <span className="text-gray-600">|</span>
          <i className="fa-solid fa-meteor text-[#ff4500] text-xs" />
          <span className="text-gray-300 text-[0.7rem]">Jezero Mars</span>
        </div>

        {/* Mission Clock */}
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#0e121a] border border-cyan-500/20 text-xs font-mono">
          <Pulse color="#00e5ff" size="w-1.5 h-1.5" />
          <span className="text-cyan-400 font-bold text-[0.7rem]">{utcTime}</span>
        </div>

        {/* System Health Status */}
        <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[0.7rem] font-mono text-emerald-400">
          <Pulse color="#22c55e" size="w-1.5 h-1.5" />
          <span>SISTEMA NOMINAL</span>
        </div>

        {/* Auth CTA or User Menu */}
        {isAuthenticated && user ? (
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-mono font-bold text-white truncate max-w-[120px]">
                {user.name}
              </span>
              <span className="text-[0.6rem] uppercase tracking-wider font-mono font-bold text-[#ff4500]">
                {user.rol || 'OPERADOR'}
              </span>
            </div>
            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="p-2 rounded-xl bg-white/5 hover:bg-red-500/15 hover:text-red-400 text-gray-400 border border-white/10 transition-colors text-xs"
              title="Cerrar sesión"
            >
              <i className="fa-solid fa-power-off" />
            </button>
          </div>
        ) : (
          <Link
            to="/login"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#ff4500] hover:bg-[#ff4500]/90 text-white font-mono font-bold text-xs shadow-md shadow-[#ff4500]/20 transition-all"
          >
            <i className="fa-solid fa-lock-open text-xs" />
            <span className="hidden sm:inline">Acceder</span>
          </Link>
        )}
      </div>
    </header>
  );
}
