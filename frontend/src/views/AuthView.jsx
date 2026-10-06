import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import teamLogo from '../assets/logo.ico';

export default function AuthView() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [rol, setRol] = useState('cliente');
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const { login, register, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const redirectMessage = location.state?.message;
  const redirectTarget = location.state?.from || '/';

  useEffect(() => {
    if (isAuthenticated) {
      navigate(redirectTarget, { replace: true });
    }
  }, [isAuthenticated, navigate, redirectTarget]);

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    setLoading(true);

    try {
      if (isRegister) {
        if (password !== passwordConfirmation) {
          throw new Error('Las contraseñas no coinciden');
        }
        await register({
          name,
          email,
          password,
          password_confirmation: passwordConfirmation,
          rol,
        });
      } else {
        await login(email, password);
      }
      navigate(redirectTarget, { replace: true });
    } catch (err) {
      setFormError(err.message || 'Error en la autenticación');
    } finally {
      setLoading(false);
    }
  }

  function setDemoAccount(demoEmail, demoPass) {
    setEmail(demoEmail);
    setPassword(demoPass);
    setIsRegister(false);
    setFormError('');
  }

  return (
    <div className="min-h-[calc(100vh-65px)] bg-[#131313] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#ff4500]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#00e5ff]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-[#1c1c1c]/95 border border-[#2a2a2a] rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative z-10">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <img
            src={teamLogo}
            alt="M.Y.C.O"
            className="w-14 h-14 rounded-2xl border-2 border-[#ff4500]/40 p-1 mb-3 shadow-lg shadow-[#ff4500]/20"
          />
          <h1 className="text-xl font-bold font-mono text-white tracking-wider">
            {isRegister ? 'Registro de Operador' : 'Control de Acceso M.Y.C.O'}
          </h1>
          <p className="text-xs text-gray-400 mt-1 max-w-xs">
            {isRegister
              ? 'Crea tu cuenta para monitorear parcelas y enjambres robóticos'
              : 'Ingresa con tus credenciales seguras para acceder al sistema'}
          </p>
        </div>

        {/* Protected Route Redirect Notice */}
        {redirectMessage && (
          <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 text-xs flex items-center gap-2.5 font-mono">
            <i className="fa-solid fa-lock text-sm shrink-0" />
            <span>{redirectMessage}</span>
          </div>
        )}

        {/* Error Alert */}
        {formError && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
            <i className="fa-solid fa-circle-exclamation text-sm shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          {isRegister && (
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1 font-mono">
                Nombre Completo / Empresa
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Ing. Valentina Ramos"
                className="w-full px-3.5 py-2 rounded-xl bg-black/50 border border-[#21262d] focus:border-[#ff4500] text-white text-sm outline-none transition-colors font-mono"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1 font-mono">
              Correo Electrónico
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operador@myco.tech"
              className="w-full px-3.5 py-2 rounded-xl bg-black/50 border border-[#21262d] focus:border-[#ff4500] text-white text-sm outline-none transition-colors font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1 font-mono">
              Contraseña
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2 rounded-xl bg-black/50 border border-[#21262d] focus:border-[#ff4500] text-white text-sm outline-none transition-colors font-mono"
            />
          </div>

          {isRegister && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1 font-mono">
                  Confirmar Contraseña
                </label>
                <input
                  type="password"
                  required
                  value={passwordConfirmation}
                  onChange={(e) => setPasswordConfirmation(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2 rounded-xl bg-black/50 border border-[#21262d] focus:border-[#ff4500] text-white text-sm outline-none transition-colors font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1 font-mono">
                  Rol del Usuario
                </label>
                <select
                  value={rol}
                  onChange={(e) => setRol(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-black/50 border border-[#21262d] focus:border-[#ff4500] text-white text-sm outline-none transition-colors font-mono"
                >
                  <option value="cliente">Cliente / Operador Agrícola</option>
                  <option value="admin">Administrador de Sistema</option>
                </select>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full py-2.5 px-4 bg-[#ff4500] hover:bg-[#ff4500]/90 text-white font-bold rounded-xl shadow-lg shadow-[#ff4500]/25 transition-all text-sm font-mono flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading && <i className="fa-solid fa-spinner animate-spin" />}
            <span>{isRegister ? 'Registrar Cuenta' : 'Acceder al Sistema'}</span>
          </button>
        </form>

        {/* Demo Accounts Quick-fill */}
        {!isRegister && (
          <div className="mt-6 pt-5 border-t border-white/10">
            <span className="text-[0.65rem] uppercase tracking-widest text-gray-500 font-mono block mb-2 text-center">
              Cuentas de Demostración Rápidas
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDemoAccount('admin@myco.tech', 'admin123')}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-colors"
              >
                <div className="text-[0.7rem] font-bold text-[#ff4500] font-mono">ADMINISTRADOR</div>
                <div className="text-[0.65rem] text-gray-400 truncate">admin@myco.tech</div>
              </button>

              <button
                type="button"
                onClick={() => setDemoAccount('cliente@agromar.com', 'cliente123')}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-colors"
              >
                <div className="text-[0.7rem] font-bold text-[#00e5ff] font-mono">CLIENTE AGRO</div>
                <div className="text-[0.65rem] text-gray-400 truncate">cliente@agromar.com</div>
              </button>
            </div>
          </div>
        )}

        {/* Toggle Mode */}
        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setFormError('');
            }}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            {isRegister
              ? '¿Ya tienes una cuenta registrada? Inicia sesión aquí'
              : '¿Aún no tienes cuenta? Regístrate como nuevo cliente'}
          </button>
        </div>
      </div>
    </div>
  );
}
