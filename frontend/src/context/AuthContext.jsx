import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiService, getStoredToken, clearStoredToken } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(getStoredToken());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadUser() {
      const storedToken = getStoredToken();
      if (!storedToken) {
        setLoading(false);
        return;
      }

      try {
        const userData = await apiService.getUser();
        setUser(userData);
      } catch (err) {
        console.warn('Sesión expirada o token inválido:', err.message);
        clearStoredToken();
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, []);

  async function login(email, password) {
    setError(null);
    try {
      const res = await apiService.login({ email, password });
      setToken(res.token);
      // Obtener datos del usuario autenticado
      const profile = await apiService.getUser();
      setUser(profile);
      return profile;
    } catch (err) {
      const msg = err.data?.error || err.message || 'Error al iniciar sesión';
      setError(msg);
      throw new Error(msg);
    }
  }

  async function register(userData) {
    setError(null);
    try {
      const res = await apiService.register(userData);
      setToken(res.token);
      setUser(res.user);
      return res.user;
    } catch (err) {
      const msg = err.data?.message || err.message || 'Error al registrar usuario';
      setError(msg);
      throw new Error(msg);
    }
  }

  async function logout() {
    try {
      await apiService.logout();
    } finally {
      setUser(null);
      setToken(null);
      setError(null);
    }
  }

  async function updateProfile(data) {
    const updated = await apiService.updateUser(data);
    setUser(updated);
    return updated;
  }

  const value = {
    user,
    token,
    loading,
    error,
    isAuthenticated: !!user,
    isAdmin: user?.rol === 'admin',
    isCliente: user?.rol === 'cliente',
    login,
    register,
    logout,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
}
