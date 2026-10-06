import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Pulse } from './Pulse';
import teamLogo from '../../assets/logo.ico';

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const navItems = [
    { to: '/', label: 'Misión', icon: 'fa-solid fa-satellite-dish', end: true },
    { to: '/robots', label: 'Robots Myco', icon: 'fa-solid fa-robot' },
    { to: '/mediciones', label: 'Mediciones Suelo', icon: 'fa-solid fa-vial' },
    { to: '/capsulas', label: 'Cápsulas', icon: 'fa-solid fa-capsules' },
    { to: '/inyecciones', label: 'Inyecciones & IA', icon: 'fa-solid fa-syringe' },
    { to: '/gemelo-digital', label: 'Gemelo Digital', icon: 'fa-solid fa-microchip' },
    { to: '/terrenos', label: 'Terrenos & Bases', icon: 'fa-solid fa-map-location-dot' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-[#080b0f]/90 backdrop-blur-md border-b border-[#21262d] px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3 shrink-0">
          <NavLink to="/" className="flex items-center gap-2.5 group">
            <div className="relative">
              <img
                src={teamLogo}
                alt="MYCO"
                className="w-8 h-8 rounded-lg border border-[#ff4500]/40 group-hover:border-[#ff4500] transition-colors"
              />
              <div className="absolute -top-1 -right-1">
                <Pulse color="#22c55e" size="w-2 h-2" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="font-mono font-bold text-sm tracking-widest text-white group-hover:text-[#ff4500] transition-colors">
                M.Y.C.O
              </span>
              <span className="text-[0.6rem] text-gray-400 uppercase tracking-wider font-mono">
                Mycoremediation Platform
              </span>
            </div>
          </NavLink>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden lg:flex items-center gap-1 overflow-x-auto py-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-[#ff4500]/15 text-[#ff4500] border border-[#ff4500]/40 shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`
              }
            >
              <i className={`${item.icon} text-xs`} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Right Section: User / Auth */}
        <div className="flex items-center gap-2.5 shrink-0">
          <NavLink
            to="/dashboard"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white px-2.5 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 transition-colors font-mono"
            title="Consola de Control"
          >
            <i className="fa-solid fa-gauge-high text-xs text-[#00e5ff]" />
            <span>Dashboard</span>
          </NavLink>

          {isAuthenticated && user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-[#0d1116] border border-[#21262d] px-3 py-1 rounded-lg">
                <div className="w-6 h-6 rounded-full bg-[#ff4500]/20 text-[#ff4500] flex items-center justify-center font-bold text-xs font-mono">
                  {user.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-medium text-white max-w-[110px] truncate">
                    {user.name}
                  </span>
                  <span className="text-[0.6rem] uppercase tracking-wider font-mono font-bold text-[#ff4500]">
                    {user.rol || 'USUARIO'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Cerrar sesión"
              >
                <i className="fa-solid fa-arrow-right-from-bracket text-sm" />
              </button>
            </div>
          ) : (
            <NavLink
              to="/login"
              className="inline-flex items-center gap-2 bg-[#ff4500] hover:bg-[#ff4500]/90 text-white font-semibold text-xs px-3.5 py-1.5 rounded-lg shadow-md shadow-[#ff4500]/20 transition-all font-mono"
            >
              <i className="fa-solid fa-user-astronaut text-xs" />
              <span>Acceder</span>
            </NavLink>
          )}
        </div>
      </div>

      {/* Mobile Nav */}
      <div className="flex lg:hidden overflow-x-auto gap-1 pt-2 pb-1 scrollbar-none border-t border-white/5 mt-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[0.7rem] whitespace-nowrap font-medium transition-all ${
                isActive
                  ? 'bg-[#ff4500]/15 text-[#ff4500] border border-[#ff4500]/30'
                  : 'text-gray-400 hover:text-white bg-white/5'
              }`
            }
          >
            <i className={`${item.icon} text-[0.65rem]`} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </header>
  );
}
