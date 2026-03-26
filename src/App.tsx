import { useEffect, type ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Workflows from './pages/Workflows';
import Alerts from './pages/Alerts';
import Calendar from './pages/Calendar';
import Ruleta from './pages/Ruleta';
import SeguimientosEnviados from './pages/SeguimientosEnviados';
import SheetViewer from './pages/SheetViewer';
import Ventas from './pages/Ventas';
import Mails from './pages/Mails';
import Tienda from './pages/Tienda';
import Meta from './pages/Meta';
import Login from './pages/Login';
import { getSettings } from './services/dataService';
import './App.css';

function ThemeApplier() {
  useEffect(() => {
    const s = getSettings();
    if (s?.accentColor) {
      document.documentElement.style.setProperty('--accent-primary', s.accentColor);
    }
    if (s?.compactMode) {
      document.documentElement.classList.add('compact');
    } else {
      document.documentElement.classList.remove('compact');
    }
  });
  return null;
}

// Redirige a /login si no hay sesión activa
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null; // spinner invisible mientras verifica sesión
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppShell() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-muted)', fontSize: '0.9rem', gap: '0.75rem' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="spinning">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        Cargando...
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*"      element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className="app-container">
      <Sidebar />
      <main className="app-content">
        <Routes>
          <Route path="/"          element={<Navigate to="/dashboard" replace />} />
          <Route path="/login"     element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
          <Route path="/workflows" element={<ProtectedRoute><Workflows /></ProtectedRoute>} />
          <Route path="/alerts"    element={<ProtectedRoute><Alerts /></ProtectedRoute>} />
          <Route path="/calendar"  element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
          <Route path="/stock"     element={<Navigate to="/tienda" replace />} />
          <Route path="/ruleta"    element={<ProtectedRoute><Ruleta /></ProtectedRoute>} />
          <Route path="/seguimientos-enviados" element={<ProtectedRoute><SeguimientosEnviados /></ProtectedRoute>} />
          <Route path="/sheet-viewer" element={<ProtectedRoute><SheetViewer /></ProtectedRoute>} />
          <Route path="/mails"     element={<ProtectedRoute><Mails /></ProtectedRoute>} />
          <Route path="/ventas"    element={<ProtectedRoute><Ventas /></ProtectedRoute>} />
          <Route path="/cupones"   element={<Navigate to="/tienda" replace />} />
          <Route path="/clientes"  element={<Navigate to="/tienda" replace />} />
          <Route path="/tienda"    element={<ProtectedRoute><Tienda /></ProtectedRoute>} />
          <Route path="/meta"      element={<ProtectedRoute><Meta /></ProtectedRoute>} />
          <Route path="/settings"  element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="*"          element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <ThemeApplier />
        <AppShell />
      </AuthProvider>
    </Router>
  );
}

export default App;
