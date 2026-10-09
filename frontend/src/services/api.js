// API Service - Gestionar todas las llamadas al backend Laravel (con soporte JWT)
const isProd = import.meta.env.PROD;
const DEFAULT_PROD_URL = 'https://pamelatarelo18.alwaysdata.net/marsmatrix/api/api';
const DEFAULT_DEV_URL = 'http://127.0.0.1:8000/api';

const API_BASE_URL = import.meta.env.VITE_API_URL || (isProd ? DEFAULT_PROD_URL : DEFAULT_DEV_URL);

// Manejo de Token JWT
const TOKEN_KEY = 'myco_jwt_token';

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function fetchJson(url, options = {}) {
  const headers = {
    'Accept': 'application/json',
    ...(options.headers || {}),
  };

  const token = getStoredToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, { ...options, headers });
  const contentType = response.headers.get('content-type') || '';

  if (!response.ok) {
    let errorData = {};
    if (contentType.includes('application/json')) {
      errorData = await response.json().catch(() => ({}));
    } else {
      const raw = await response.text();
      errorData = { message: raw.slice(0, 120).replace(/\s+/g, ' ') };
    }
    const errorMsg = errorData.message || errorData.error || `HTTP ${response.status} en ${url}`;
    const err = new Error(errorMsg);
    err.status = response.status;
    err.data = errorData;
    throw err;
  }

  if (!contentType.includes('application/json')) {
    const raw = await response.text();
    return { raw };
  }

  return response.json();
}

export const apiService = {
  // ─── AUTENTICACIÓN JWT ───
  async login(credentials) {
    const res = await fetchJson(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    if (res.token) {
      setStoredToken(res.token);
    }
    return res;
  },

  async register(userData) {
    const res = await fetchJson(`${API_BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
    if (res.token) {
      setStoredToken(res.token);
    }
    return res;
  },

  async getUser() {
    return fetchJson(`${API_BASE_URL}/user`);
  },

  async updateUser(userData) {
    return fetchJson(`${API_BASE_URL}/user`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
  },

  async logout() {
    try {
      await fetchJson(`${API_BASE_URL}/logout`, { method: 'POST' });
    } catch {
      // Ignorar error al cerrar sesión en servidor si ya expiró el token
    } finally {
      clearStoredToken();
    }
  },

  // ─── USUARIOS Y CLIENTES ───
  async getUsuarios(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return fetchJson(`${API_BASE_URL}/usuarios${qs ? `?${qs}` : ''}`);
  },

  async getUsuario(id) {
    return fetchJson(`${API_BASE_URL}/usuarios/${id}`);
  },

  // ─── ROBOTS MYCO ───
  async getRobots(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return fetchJson(`${API_BASE_URL}/robots${qs ? `?${qs}` : ''}`);
  },

  async getRobot(id) {
    return fetchJson(`${API_BASE_URL}/robots/${id}`);
  },

  async asignarRobotATerreno(robotId, terrenoId) {
    return fetchJson(`${API_BASE_URL}/robots/${robotId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ terreno_id: terrenoId }),
    });
  },

  async crearRobot(datos) {
    return fetchJson(`${API_BASE_URL}/robots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    });
  },

  async actualizarRobot(id, datos) {
    return fetchJson(`${API_BASE_URL}/robots/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    });
  },

  async eliminarRobot(id) {
    return fetchJson(`${API_BASE_URL}/robots/${id}`, {
      method: 'DELETE',
    });
  },

  async getRobotUbicacion(id) {
    return fetchJson(`${API_BASE_URL}/robots/${id}/ubicacion`);
  },

  async cambiarModoRobot(id, modo) {
    return fetchJson(`${API_BASE_URL}/robots/${id}/cambiar-modo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modo }),
    });
  },

  async irABaseRobot(id) {
    return fetchJson(`${API_BASE_URL}/robots/${id}/ir-a-base`, {
      method: 'POST',
    });
  },

  async recargarRobot(id) {
    return fetchJson(`${API_BASE_URL}/robots/${id}/recargar`, {
      method: 'POST',
    });
  },

  async configurarWifiRobot(id, wifiData) {
    return fetchJson(`${API_BASE_URL}/robots/${id}/wifi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(wifiData),
    });
  },

  async actualizarConfiguracionRobot(id, configData) {
    return fetchJson(`${API_BASE_URL}/robots/${id}/configuracion`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(configData),
    });
  },

  async optimizarCargaRobot(id, payload) {
    return fetchJson(`${API_BASE_URL}/robots/${id}/optimizar-carga`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  // ─── MEDICIONES DE SUELO (MODO LECTURA) ───
  async getMediciones(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return fetchJson(`${API_BASE_URL}/mediciones${qs ? `?${qs}` : ''}`);
  },

  async crearMedicion(datos) {
    return fetchJson(`${API_BASE_URL}/mediciones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    });
  },

  async getMedicionesRecientes(limite = 30) {
    return fetchJson(`${API_BASE_URL}/mediciones/recientes?limite=${limite}`);
  },

  async getMedicionesMapaCalor(terrenoId = null) {
    const url = terrenoId
      ? `${API_BASE_URL}/mediciones/mapa-calor?terreno_id=${terrenoId}`
      : `${API_BASE_URL}/mediciones/mapa-calor`;
    return fetchJson(url);
  },

  // ─── CÁPSULAS DE MICORRIZAS (MÍNIMO, MEDIO, ALTO) ───
  async getCapsulas() {
    return fetchJson(`${API_BASE_URL}/capsulas`);
  },

  async crearCapsula(datos) {
    return fetchJson(`${API_BASE_URL}/capsulas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    });
  },

  async actualizarCapsula(id, datos) {
    return fetchJson(`${API_BASE_URL}/capsulas/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    });
  },

  async getInventarioCapsulas() {
    return fetchJson(`${API_BASE_URL}/capsulas/inventario`);
  },

  // ─── INYECCIONES Y ALGORITMO DE OPTIMIZACIÓN ───
  async getInyecciones(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return fetchJson(`${API_BASE_URL}/inyecciones${qs ? `?${qs}` : ''}`);
  },

  async crearInyeccion(datos) {
    return fetchJson(`${API_BASE_URL}/inyecciones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    });
  },

  async ejecutarInyeccionOptimizada(datos) {
    return fetchJson(`${API_BASE_URL}/inyecciones/ejecutar-optimizada`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    });
  },

  async recomendarPuntoInyeccion(coords) {
    return fetchJson(`${API_BASE_URL}/inyecciones/recomendar-punto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(coords),
    });
  },

  async getEstadisticasInyecciones() {
    return fetchJson(`${API_BASE_URL}/inyecciones/estadisticas`);
  },

  // ─── GEMELO DIGITAL Y SIMULACIONES ───
  async getGemeloDigitalEstado(terrenoId = null) {
    const url = terrenoId
      ? `${API_BASE_URL}/gemelo-digital/estado?terreno_id=${terrenoId}`
      : `${API_BASE_URL}/gemelo-digital/estado`;
    return fetchJson(url);
  },

  async actualizarGemeloConfiguracion(datos) {
    return fetchJson(`${API_BASE_URL}/gemelo-digital/configuracion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    });
  },

  async ejecutarSimulacion(datos) {
    return fetchJson(`${API_BASE_URL}/simulaciones/ejecutar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    });
  },

  async getSimulaciones(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return fetchJson(`${API_BASE_URL}/simulaciones${qs ? `?${qs}` : ''}`);
  },

  async getSimulacionDetalle(id) {
    return fetchJson(`${API_BASE_URL}/simulaciones/${id}`);
  },

  // ─── TERRENOS Y ESTACIONES BASE ───
  async getTerrenos(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return fetchJson(`${API_BASE_URL}/terrenos${qs ? `?${qs}` : ''}`);
  },

  async getTerreno(id) {
    return fetchJson(`${API_BASE_URL}/terrenos/${id}`);
  },

  async crearTerreno(datos) {
    return fetchJson(`${API_BASE_URL}/terrenos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    });
  },

  async actualizarTerreno(id, datos) {
    return fetchJson(`${API_BASE_URL}/terrenos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    });
  },

  async eliminarTerreno(id) {
    return fetchJson(`${API_BASE_URL}/terrenos/${id}`, {
      method: 'DELETE',
    });
  },

  async getEstacionesBase() {
    return fetchJson(`${API_BASE_URL}/estaciones-base`);
  },

  async crearEstacionBase(datos) {
    return fetchJson(`${API_BASE_URL}/estaciones-base`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    });
  },

  // ─── RUTAS (COMPATIBILIDAD) ───
  async getRutas() {
    return fetchJson(`${API_BASE_URL}/rutas`);
  },

  async generateRuta(datos) {
    return fetchJson(`${API_BASE_URL}/rutas/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    });
  },

  async crearRuta(datos) {
    return fetchJson(`${API_BASE_URL}/rutas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    });
  },

  async getRutasRobot(robotId) {
    return fetchJson(`${API_BASE_URL}/rutas/robot/${robotId}`);
  },

  async iniciarRuta(rutaId) {
    return fetchJson(`${API_BASE_URL}/rutas/${rutaId}/iniciar`, {
      method: 'POST',
    });
  },

  async completarRuta(rutaId) {
    return fetchJson(`${API_BASE_URL}/rutas/${rutaId}/completar`, {
      method: 'POST',
    });
  },

  async eliminarRuta(rutaId) {
    return fetchJson(`${API_BASE_URL}/rutas/${rutaId}`, {
      method: 'DELETE',
    });
  },

  // ─── BIOPOLIMEROS (COMPATIBILIDAD) ───
  async getBiopolimeros() {
    return fetchJson(`${API_BASE_URL}/biopolimeros`);
  },

  async crearBiopolimero(datos) {
    return fetchJson(`${API_BASE_URL}/biopolimeros`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    });
  },

  async getBiopolimerosArea(latMin, latMax, lonMin, lonMax) {
    return fetchJson(
      `${API_BASE_URL}/biopolimeros/area?lat_min=${latMin}&lat_max=${latMax}&lon_min=${lonMin}&lon_max=${lonMax}`
    );
  },

  async getEstadisticasBiopolimeros(rutaId = null) {
    const url = rutaId
      ? `${API_BASE_URL}/biopolimeros/estadisticas?ruta_id=${rutaId}`
      : `${API_BASE_URL}/biopolimeros/estadisticas`;
    return fetchJson(url);
  },

  // ─── IA Y ZONAS TÓXICAS (COMPATIBILIDAD) ───
  async getZonasToxicas() {
    return fetchJson(`${API_BASE_URL}/zonas-toxicas`);
  },

  async remediarIA(entorno) {
    return fetchJson(`${API_BASE_URL}/ia/remediar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entorno }),
    });
  },

  // ─── SERVICIO FLASK MYCO IA (CONDICIONES DE TERRENO Y AUTÓMATA) ───
  async calcularCondicionesTerreno(datos) {
    const flaskUrl = import.meta.env.VITE_MYCO_IA_URL || 'http://127.0.0.1:5000';
    const response = await fetch(`${flaskUrl}/api/calcular-terreno`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(datos),
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Error ${response.status} al consultar Flask IA`);
    }
    return response.json();
  },

  async escalarDEM(datos) {
    const flaskUrl = import.meta.env.VITE_MYCO_IA_URL || 'http://127.0.0.1:5001';
    const response = await fetch(`${flaskUrl}/api/escalar-dem`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(datos),
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Error ${response.status} al escalar DEM en Flask IA`);
    }
    return response.json();
  },

  async calcularClimaMarte(datos) {
    const flaskUrl = import.meta.env.VITE_MYCO_IA_URL || 'http://127.0.0.1:5001';
    const response = await fetch(`${flaskUrl}/api/clima-marte`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(datos),
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Error ${response.status} al consultar clima marciano MCD`);
    }
    return response.json();
  },

  async calcularRutasMediciones(datos) {
    const flaskUrl = import.meta.env.VITE_MYCO_IA_URL || 'http://127.0.0.1:5001';
    const response = await fetch(`${flaskUrl}/api/calcular-rutas-mediciones`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(datos),
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Error ${response.status} al calcular rutas y clusters en Flask IA`);
    }
    return response.json();
  },

  async calcularDemMarte(datos) {
    const flaskUrl = import.meta.env.VITE_MYCO_IA_URL || 'http://127.0.0.1:5001';
    const response = await fetch(`${flaskUrl}/api/dem-marte`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(datos),
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Error ${response.status} al consultar DEM de Marte`);
    }
    return response.json();
  },

  async calcularFase2MatrizIdoneidad(datos) {
    const flaskUrl = import.meta.env.VITE_MYCO_IA_URL || 'http://127.0.0.1:5001';
    const response = await fetch(`${flaskUrl}/api/fase2-matriz-idoneidad`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(datos),
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Error ${response.status} al calcular matriz de idoneidad Fase 2`);
    }
    return response.json();
  },

  async simularLaboratorioMarte(datos) {
    const flaskUrl = import.meta.env.VITE_MYCO_IA_URL || 'http://127.0.0.1:5001';
    const response = await fetch(`${flaskUrl}/api/marte-simulacion-traje`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(datos),
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Error ${response.status} en simulación de laboratorio marciano`);
    }
    return response.json();
  },
};


