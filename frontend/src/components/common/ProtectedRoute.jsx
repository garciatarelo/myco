import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function ProtectedRoute({ children, requiredRole }) {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#131313] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#ff4500] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-gray-400 font-mono tracking-wider">
            Verificando credenciales M.Y.C.O...
          </span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        state={{
          from: location.pathname,
          message: 'Acceso restringido: Debes iniciar sesión como operador para ingresar a esta sección.',
        }}
        replace
      />
    );
  }

  if (requiredRole && user?.rol !== requiredRole) {
    return (
      <div className="min-h-screen bg-[#131313] flex items-center justify-center p-4">
        <div className="bg-[#1c1c1c] border border-red-500/30 rounded-2xl p-8 max-w-md text-center shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center mx-auto mb-4 text-xl">
            <i className="fa-solid fa-shield-halved" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2 font-mono">Privilegios Insuficientes</h2>
          <p className="text-xs text-gray-400 mb-4 leading-relaxed font-mono">
            Esta sección requiere el rol <strong>{requiredRole.toUpperCase()}</strong>. Tu cuenta actual está registrada como <strong>{user?.rol?.toUpperCase()}</strong>.
          </p>
        </div>
      </div>
    );
  }

  return children || <Outlet />;
}
