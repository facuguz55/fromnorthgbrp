import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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

function App() {
  return (
    <Router>
      <ThemeApplier />
      <div className="app-container">
        <Sidebar />
        <main className="app-content">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/workflows" element={<Workflows />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/stock" element={<Navigate to="/tienda" replace />} />
            <Route path="/ruleta" element={<Ruleta />} />
            <Route path="/seguimientos-enviados" element={<SeguimientosEnviados />} />
            <Route path="/sheet-viewer" element={<SheetViewer />} />
            <Route path="/mails" element={<Mails />} />
            <Route path="/ventas" element={<Ventas />} />
            <Route path="/cupones" element={<Navigate to="/tienda" replace />} />
            <Route path="/clientes" element={<Navigate to="/tienda" replace />} />
            <Route path="/tienda" element={<Tienda />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
