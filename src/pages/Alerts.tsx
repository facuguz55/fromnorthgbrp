import { useState, useEffect } from 'react';
import { Bell, RefreshCw } from 'lucide-react';
import { getSettings } from '../services/dataService';
import { fetchTNMetrics } from '../services/tiendanubeService';
import { generateAlerts } from '../services/alertsService';
import type { AlertItem } from '../services/alertsService';
import { fetchMailsFromDB } from '../services/supabaseService';
import type { MailRow } from '../services/supabaseService';
import './Alerts.css';

const MS_48H = 48 * 60 * 60 * 1000;

export default function Alerts() {
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [reclamosViejos, setReclamosViejos] = useState<MailRow[]>([]);
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
      const [metrics, mails] = await Promise.all([
        fetchTNMetrics(storeId, token),
        fetchMailsFromDB(),
      ]);
      setAlerts(generateAlerts(metrics));
      const ahora = Date.now();
      setReclamosViejos(
        mails.filter(m =>
          m.categoria === 'reclamo' &&
          !m.respondido &&
          ahora - new Date(m.fecha).getTime() > MS_48H
        )
      );
    } catch (err) {
      console.error('Error fetching alerts:', err);
    } finally {
      setLoading(false);
      setLastRefreshed(new Date());
    }
  };

  useEffect(() => { fetchData(); }, []);

  const totalAlertas = alerts.length + (reclamosViejos.length > 0 ? 1 : 0);

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
      ) : totalAlertas === 0 ? (
        <div className="alerts-empty glass-panel">
          <Bell size={40} className="alerts-empty-icon" />
          <h3>Sin alertas activas</h3>
          <p>Todo está dentro de los parámetros normales. Las alertas aparecen cuando se detectan anomalías en las ventas.</p>
        </div>
      ) : (
        <>
          <p className="alerts-count text-muted">{totalAlertas} alerta{totalAlertas !== 1 ? 's' : ''} detectada{totalAlertas !== 1 ? 's' : ''}</p>
          <div className="alerts-feed">
            {reclamosViejos.length > 0 && (
              <ReclamosAlertCard mails={reclamosViejos} />
            )}
            {alerts.map(alert => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </>
      )}

    </div>
  );
}

function ReclamosAlertCard({ mails }: { mails: MailRow[] }) {
  return (
    <div className="alert-card glass-panel alert-sev-critical">
      <div className="alert-card-top">
        <span className="alert-emoji" role="img">🚨</span>
        <h3 className="alert-title">Reclamo sin respuesta +48hs</h3>
        <span className="alert-badge badge-neg">Mails</span>
      </div>
      <div className="alert-metrics">
        <div className="alert-metric-row">
          <span className="alert-metric-label">
            Hay {mails.length} mail{mails.length !== 1 ? 's' : ''} categorizado{mails.length !== 1 ? 's' : ''} como Reclamo que llevan más de 48 horas sin respuesta. Los reclamos sin respuesta pueden derivar en contracargo o reseña negativa.
          </span>
        </div>
        {mails.map(m => (
          <div key={m.id} className="alert-metric-row">
            <span className="alert-metric-label">{m.nombre || m.de}</span>
            <span className="alert-metric-value" style={{ maxWidth: '60%', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.asunto}</span>
          </div>
        ))}
      </div>
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
