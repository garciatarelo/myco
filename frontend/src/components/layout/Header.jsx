import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Pulse } from '../common/Pulse';

const ROUTE_TITLES = {
  '/': 'MISIÓN // CONTROL DE TERRENO',
  '/mision': 'MISIÓN // CONTROL DE TERRENO & MAPA',
  '/terrenos': 'INFRAESTRUCTURA // PARCELAS Y BASES DE CARGA',
  '/terrenos/crear': 'INFRAESTRUCTURA // DELIMITACIÓN Y ALTA DE TERRENO',
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

  

  const currentTitle = ROUTE_TITLES[location.pathname] || 'M.Y.C.O L';

  return (
    <header className="sticky top-0 z-30 h-16 bg-[#131313]/95 backdrop-blur-md  px-4 flex items-center justify-between gap-4">
      {/* Left: Desktop sidebar toggle + Mobile menu toggle + Route Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Botón para expandir/colapsar en desktop */}
        <button
          onClick={onToggleCollapse}
          className="hidden lg:flex p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 text-xs items-center justify-center transition-all"
          title={isCollapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
        >
          <i
            className={`fa-solid ${
              isCollapsed ? 'fa-angles-right' : 'fa-angles-left'
            } text-sm`}
          />
        </button>

        {/* Botón para abrir menú en móvil */}
        <button
          onClick={onOpenMobile}
          className="lg:hidden p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 text-xs"
        >
          <i className="fa-solid fa-bars text-sm" />
        </button>

        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[0.65rem] font-mono font-bold text-[#ff4500] tracking-wider uppercase">
              M.Y.C.O
            </span>
            <span className="text-gray-600 text-xs">•</span>
            <span className="text-xs font-mono font-bold text-white tracking-wide truncate">
              {currentTitle}
            </span>
          </div>
         
        </div>
      </div>

      {/* Right: Live Telemetry & Mission Clock */}
      <div className="flex items-center gap-3 shrink-0">
       

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
