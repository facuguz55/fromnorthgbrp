import { useState, useEffect } from 'react';
import { Bell, RefreshCw } from 'lucide-react';
import { getSettings } from '../services/dataService';
import { fetchTNMetrics } from '../services/tiendanubeService';
import { generateAlerts } from '../services/alertsService';
import type { AlertItem } from '../services/alertsService';
import './Alerts.css';

export default function Alerts() {
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [noConfig, setNoConfig] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setNoConfig(false);
    try {
      const settings = getSettings();
      const storeId  = settings?.tiendanubeStoreId?.trim() ?? '';
      const token    = settings?.tiendanubeToken?.trim()    ?? '';
      if (!storeId || !token) { setNoConfig(true); return; }
      const metrics = await fetchTNMetrics(storeId, token);
      setAlerts(generateAlerts(metrics));
    } catch (err) {
      console.error('Error fetching alerts:', err);
    } finally {
      setLoading(false);
      setLastRefreshed(new Date());
    }
  };

  useEffect(() => { fetchData(); }, []);

  return (
    <div className="alerts-page fade-in">

      <header className="alerts-header">
        <div>
          <h1>Alertas e Insights</h1>
          <span className="text-muted alerts-subtitle">
            Detección automática de anomalías · {lastRefreshed.toLocaleTimeString('es-AR')}
          </span>
        </div>
        <button className="btn-secondary refresh-btn" onClick={fetchData} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spinning' : ''} />
          {loading ? 'Analizando...' : 'Actualizar'}
        </button>
      </header>

      {loading ? (
        <div className="alerts-loading glass-panel">
          <div className="loading-spinner" />
          <span>Analizando datos…</span>
        </div>
      ) : noConfig ? (
        <div className="alerts-empty glass-panel">
          <Bell size={40} className="alerts-empty-icon" />
          <h3>Sin TiendaNube configurado</h3>
          <p>Configurá tu <strong>Store ID</strong> y <strong>Access Token</strong> en <strong>Configuración → TiendaNube API</strong> para activar las alertas.</p>
        </div>
      ) : alerts.length === 0 ? (
        <div className="alerts-empty glass-panel">
          <Bell size={40} className="alerts-empty-icon" />
          <h3>Sin alertas activas</h3>
          <p>Todo está dentro de los parámetros normales. Las alertas aparecen cuando se detectan anomalías en las ventas.</p>
        </div>
      ) : (
        <>
          <p className="alerts-count text-muted">{alerts.length} alerta{alerts.length !== 1 ? 's' : ''} detectada{alerts.length !== 1 ? 's' : ''}</p>
          <div className="alerts-feed">
            {alerts.map(alert => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </>
      )}

    </div>
  );
}

function AlertCard({ alert }: { alert: AlertItem }) {
  return (
    <div className={`alert-card glass-panel alert-sev-${alert.severity}`}>
      <div className="alert-card-top">
        <span className="alert-emoji" role="img">{alert.emoji}</span>
        <h3 className="alert-title">{alert.title}</h3>
        <span className={`alert-badge ${alert.badgePositive ? 'badge-pos' : 'badge-neg'}`}>
          {alert.badge}
        </span>
      </div>
      <div className="alert-metrics">
        {alert.metrics.map((m) => (
          <div key={m.label} className="alert-metric-row">
            <span className="alert-metric-label">{m.label}</span>
            <span className="alert-metric-value">{m.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
