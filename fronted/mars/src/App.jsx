import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/common/ProtectedRoute';

// Vistas existentes
import Home from './views/Home';
import Dashboard from './Dashboard';
import LandingPage from './views/LandingPage';

// Nuevas vistas de módulos (about.txt & backend)
import AuthView from './views/AuthView';
import MisionTerrenoView from './views/MisionTerrenoView';
import RobotsView from './views/RobotsView';
import MedicionesView from './views/MedicionesView';
import CapsulasView from './views/CapsulasView';
import InyeccionesView from './views/InyeccionesView';
import GemeloDigitalView from './views/GemeloDigitalView';
import TerrenosView from './views/TerrenosView';

function App() {
  return (
    <AuthProvider>
      <Router basename="marsmatrix">
        <Routes>
          {/* Única Ruta Pública: Acceso y Autenticación */}
          <Route path="/login" element={<AuthView />} />

          {/* Todas las rutas de la aplicación están estrictamente protegidas:
              Si no se ha iniciado sesión, ProtectedRoute redirige de inmediato a /login */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            {/* Centro de Misión por Terreno */}
            <Route path="/" element={<Navigate to="/mision" replace />} />
            <Route path="/mision" element={<MisionTerrenoView />} />
            <Route path="/mision/:terrenoId" element={<MisionTerrenoView />} />
            <Route path="/dashboard" element={<Navigate to="/mision" replace />} />

            {/* Gestión de Terrenos & Infraestructura */}
            <Route path="/terrenos" element={<TerrenosView />} />

            {/* Redirecciones de conveniencia hacia la Misión de Terreno */}
            <Route path="/mediciones" element={<Navigate to="/mision?tab=mediciones" replace />} />
            <Route path="/inyecciones" element={<Navigate to="/mision?tab=inyecciones" replace />} />

            {/* Módulos Complementarios */}
            <Route path="/robots" element={<RobotsView />} />
            <Route path="/gemelo-digital" element={<GemeloDigitalView />} />
            <Route path="/capsulas" element={<CapsulasView />} />
            <Route path="/landing" element={<LandingPage />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/mision" replace />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;