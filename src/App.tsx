import { useEffect, useRef, type ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { MonthProvider } from './context/MonthContext';
import Sidebar from './components/Sidebar';
import AiChat from './components/AiChat';
import Dashboard from './pages/Dashboard';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Workflows from './pages/Workflows';
import Alerts from './pages/Alerts';
import Ruleta from './pages/Ruleta';
import SeguimientosEnviados from './pages/SeguimientosEnviados';
import SheetViewer from './pages/SheetViewer';
import Ventas from './pages/Ventas';
import Mails from './pages/Mails';
import Tienda from './pages/Tienda';
import Meta from './pages/Meta';
import Instagram from './pages/Instagram';
import Rentabilidad from './pages/Rentabilidad';
import RentabilidadProductos from './pages/RentabilidadProductos';
import Login from './pages/Login';
import { getSettings, META_ACCOUNTS } from './services/dataService';
import { fetchMetaInsights, generateMetaAlerts } from './services/metaAdsService';
import './App.css';

// ── Background poller: chequea alertas críticas de Meta Ads cada 15 min ───────────
const POLL_MS = 15 * 60 * 1000;

function useMetaAlertPoller() {
  const prevKeys   = useRef(new Set<string>());
  const isBaseline = useRef(true);

  useEffect(() => {
    const poll = async () => {
      const settings = getSettings();
      const token    = settings.metaAccessToken.trim();
      if (!token) return;

      for (const acct of META_ACCOUNTS) {
        const accountId = (settings[acct.settingsKey] as string).trim();
        if (!accountId) continue;
        try {
          const insights  = await fetchMetaInsights(token, accountId, 'last_7d', 'campaign');
          const criticals = generateMetaAlerts(insights, 'campaign')
            .filter(a => a.severity === 'critical');
          const currKeys  = new Set(criticals.map(a => `${acct.key}:${a.id}:${a.type}`));

          if (!isBaseline.current
            && typeof Notification !== 'undefined'
            && Notification.permission === 'granted') {
            const fresh = criticals.filter(
              a => !prevKeys.current.has(`${acct.key}:${a.id}:${a.type}`),
            );
            if (fresh.length > 0) {
              const top = fresh[0];
              new Notification(`⚠️ Meta Ads · ${acct.label} — nueva alerta crítica`, {
                body: `${top.name}: ${top.message}`
                  + (fresh.length > 1 ? `\n+${fresh.length - 1} más` : ''),
              });
            }
          }

          // Reemplaza keys de esta cuenta con las actuales
          for (const k of prevKeys.current) {
            if (k.startsWith(`${acct.key}:`)) prevKeys.current.delete(k);
          }
          currKeys.forEach(k => prevKeys.current.add(k));
        } catch { /* fallo silencioso */ }
      }

      isBaseline.current = false;
    };

    poll();                                    // baseline inmediato (sin notificar)
    const timer = setInterval(poll, POLL_MS);  // luego cada 15 min
    return () => clearInterval(timer);
  }, []);
}

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
  useMetaAlertPoller();

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
          <Route path="/stock"     element={<Navigate to="/tienda" replace />} />
          <Route path="/ruleta"    element={<ProtectedRoute><Ruleta /></ProtectedRoute>} />
          <Route path="/seguimientos-enviados" element={<ProtectedRoute><SeguimientosEnviados /></ProtectedRoute>} />
          <Route path="/sheet-viewer" element={<ProtectedRoute><SheetViewer /></ProtectedRoute>} />
          <Route path="/mails"     element={<ProtectedRoute><Mails /></ProtectedRoute>} />
          <Route path="/ventas"    element={<ProtectedRoute><Ventas /></ProtectedRoute>} />
          <Route path="/cupones"   element={<Navigate to="/tienda" replace />} />
          <Route path="/clientes"  element={<Navigate to="/tienda" replace />} />
          <Route path="/tienda"    element={<ProtectedRoute><Tienda /></ProtectedRoute>} />
          <Route path="/instagram" element={<ProtectedRoute><Instagram /></ProtectedRoute>} />
          <Route path="/meta"          element={<ProtectedRoute><Meta /></ProtectedRoute>} />
          <Route path="/rentabilidad"          element={<ProtectedRoute><Rentabilidad /></ProtectedRoute>} />
          <Route path="/rentabilidad-productos" element={<ProtectedRoute><RentabilidadProductos /></ProtectedRoute>} />
          <Route path="/settings"     element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="*"          element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
      <AiChat />
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <MonthProvider>
          <ThemeApplier />
          <AppShell />
        </MonthProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
