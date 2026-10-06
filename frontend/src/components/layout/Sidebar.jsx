import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Pulse } from '../common/Pulse';
import teamLogo from '../../assets/logo.ico';

export function Sidebar({ isCollapsed, onToggleCollapse, isMobileOpen, onCloseMobile }) {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const navSections = [
    {
      title: 'CENTRO DE CONTROL',
      items: [
        {
          to: '/mision',
          label: 'Misión de Terreno',
          icon: 'fa-solid fa-satellite-dish',
          badge: 'VIVO',
          badgeColor: 'text-[#ff4500] bg-[#ff4500]/10 border-[#ff4500]/20',
        },
        {
          to: '/terrenos',
          label: 'Terrenos & Parcelas',
          icon: 'fa-solid fa-map-location-dot',
          badge: 'MAPA',
          badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        },
      ],
    },
    {
      title: 'BIOTECNOLOGÍA & IA',
      items: [
        {
          to: '/gemelo-digital',
          label: 'Gemelo Digital & Simulación',
          icon: 'fa-solid fa-microchip',
          badge: 'SIM',
          badgeColor: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
        },
        {
          to: '/capsulas',
          label: 'Cápsulas de Micorrizas',
          icon: 'fa-solid fa-capsules',
        },
      ],
    },
    {
      title: 'ADMINISTRACIÓN & FLOTA',
      items: [
        {
          to: '/robots',
          label: 'Flota Global Myco',
          icon: 'fa-solid fa-robot',
          badge: 'FLEET',
        },
        {
          to: '/landing',
          label: 'Planes & Servicios SaaS',
          icon: 'fa-solid fa-layer-group',
        },
      ],
    },
  ];

  return (
    <>
      {/* Backdrop for mobile */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen flex flex-col justify-between bg-[#131313]  transition-all duration-300 ease-in-out select-none ${
          isCollapsed ? 'w-[72px]' : 'w-[260px]'
        } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Top Header: Brand & Collapse Toggle */}
          <div className={`h-16 flex items-center px-3.5 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
            <NavLink
              to="/"
              onClick={onCloseMobile}
              className={`flex items-center gap-3 overflow-hidden group ${isCollapsed ? 'justify-center' : ''}`}
              title="M.Y.C.O - Autonomous Bioremediation Platform"
            >
              <div className="relative shrink-0">
                <img
                  src={teamLogo}
                  alt="MYCO"
                  className="w-9 h-9 rounded-xl border border-[#ff4500]/40 p-0.5 group-hover:border-[#ff4500] transition-colors shadow-md shadow-[#ff4500]/10"
                />
                <div className="absolute -top-1 -right-1">
                  <Pulse color="#22c55e" size="w-2 h-2" />
                </div>
              </div>

              {!isCollapsed && (
                <div className="flex flex-col transition-opacity duration-200">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-sm tracking-widest text-white group-hover:text-[#ff4500] transition-colors">
                      M.Y.C.O
                    </span>
                    <span className="text-[0.6rem] font-mono px-1 py-0.2 rounded bg-white/5 border border-white/10 text-gray-400">
                      v2.4
                    </span>
                  </div>
                  <span className="text-[0.6rem] text-gray-400 font-mono tracking-wider truncate uppercase">
                    Control de Misión
                  </span>
                </div>
              )}
            </NavLink>

            {/* Mobile Close Button */}
            <button
              onClick={onCloseMobile}
              className="lg:hidden w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-white"
            >
              <i className="fa-solid fa-xmark text-sm" />
            </button>
          </div>

        {/* Middle Navigation Section */}
        <div className="flex-1 overflow-y-auto py-4 px-2.5 space-y-5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {navSections.map((section, sIdx) => (
            <div key={sIdx} className="space-y-1">
              {!isCollapsed ? (
                <div className="px-2 pb-1 text-[0.6rem] font-mono font-bold text-gray-500 tracking-wider uppercase">
                  {section.title}
                </div>
              ) : (
                <div className="w-6 h-px bg-white/10 mx-auto my-2" />
              )}

              {section.items.map((item) => {
                const isLocked = item.requiresAuth && !isAuthenticated;

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={onCloseMobile}
                    title={isCollapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      `relative group flex items-center gap-3 px-3 py-2.5 rounded-xl font-mono text-xs transition-all ${
                        isActive
                          ? 'bg-[#ff4500]/15 text-[#ff4500] border border-[#ff4500]/35 font-bold shadow-sm shadow-[#ff4500]/10'
                          : 'text-gray-400 hover:text-white hover:bg-white/[0.04] border border-transparent'
                      } ${isCollapsed ? 'justify-center px-0' : ''}`
                    }
                  >
                    {/* Icon */}
                    <div className="relative shrink-0 flex items-center justify-center w-5 h-5">
                      <i className={`${item.icon} text-sm transition-transform group-hover:scale-110`} />
                      {isLocked && (
                        <div className="absolute -bottom-1 -right-1.5 w-3.5 h-3.5 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-[0.55rem] text-amber-400">
                          <i className="fa-solid fa-lock" />
                        </div>
                      )}
                    </div>

                    {/* Label */}
                    {!isCollapsed && (
                      <div className="flex-1 flex items-center justify-between min-w-0">
                        <span className="truncate tracking-wide">{item.label}</span>
                        {item.badge && (
                          <span
                            className={`text-[0.6rem] px-1.5 py-0.5 rounded border font-mono font-semibold ${
                              item.badgeColor || 'text-gray-400 bg-white/5 border-white/10'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                        {isLocked && (
                          <span className="text-[0.6rem] text-amber-400 font-mono px-1 py-0.5 bg-amber-500/10 rounded border border-amber-500/20">
                            Bloqueado
                          </span>
                        )}
                      </div>
                    )}

                    {/* Tooltip on Collapsed Mode */}
                    {isCollapsed && (
                      <div className="absolute left-full ml-3 px-2.5 py-1 bg-[#12161f] border border-[#21262d] rounded-lg text-xs font-mono text-white whitespace-nowrap shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                        {item.label}
                        {isLocked && ' (Requiere Login)'}
                      </div>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer: User Profile & Session */}
        <div className="p-3 border-t border-[#262626] bg-[#131313]">
          {isAuthenticated && user ? (
            <div
              className={`flex items-center gap-2.5 ${
                isCollapsed ? 'justify-center' : 'justify-between'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#ff4500]/30 to-[#ff4500]/10 border border-[#ff4500]/40 flex items-center justify-center text-xs font-mono font-bold text-[#ff4500] shrink-0">
                  {user.name?.charAt(0).toUpperCase() || 'U'}
                </div>

                {!isCollapsed && (
                  <div className="flex flex-col min-w-0 text-left">
                    <span className="text-xs font-mono font-bold text-white truncate">
                      {user.name}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[0.6rem] uppercase tracking-wider font-mono font-bold text-[#ff4500]">
                        {user.rol || 'OPERADOR'}
                      </span>
                      <span className="text-[0.6rem] text-gray-500">•</span>
                      <span className="text-[0.6rem] text-gray-400 truncate">
                        {user.organizacion || 'M.Y.C.O'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {!isCollapsed && (
                <button
                  onClick={() => {
                    logout();
                    navigate('/login');
                  }}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all text-xs shrink-0"
                  title="Cerrar sesión de operador"
                >
                  <i className="fa-solid fa-arrow-right-from-bracket" />
                </button>
              )}
            </div>
          ) : (
            <div className={isCollapsed ? 'flex justify-center' : ''}>
              <button
                onClick={() => {
                  onCloseMobile?.();
                  navigate('/login');
                }}
                className={`flex items-center justify-center gap-2 rounded-xl bg-[#ff4500] hover:bg-[#ff4500]/90 text-white font-mono font-bold text-xs shadow-md shadow-[#ff4500]/20 transition-all ${
                  isCollapsed ? 'w-10 h-10 p-0' : 'w-full py-2 px-3'
                }`}
                title="Iniciar sesión de operador"
              >
                <i className="fa-solid fa-user-astronaut text-xs" />
                {!isCollapsed && <span>Acceso Operador</span>}
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
