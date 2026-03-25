import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import MetricCard from '../components/MetricCard';
import SalesChart from '../components/SalesChart';
import {
  RefreshCw, DollarSign, Activity, CalendarDays,
  ShoppingBag, Trophy, ShoppingCart, Store, UserCheck, MousePointerClick, Users,
} from 'lucide-react';
import { getSettings, fetchSheetRowCount } from '../services/dataService';
import { fetchTNMetrics, clearTNCache, getPersistedMetrics } from '../services/tiendanubeService';
import type { TNMetrics } from '../services/tiendanubeService';

const GID_CLICKS       = '1982854970';
const GID_CONVERTIDOS  = '11747759';
import './Dashboard.css';

const fmt    = (v: number) => v.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (v: number) => v.toLocaleString('es-AR', { maximumFractionDigits: 0 });

function getAR() {
  const s = new Date().toLocaleString('en-US', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour12: false, year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
  const [datePart, timePart] = s.split(', ');
  const [mo, dy, yr] = datePart.split('/').map(Number);
  const [h, m] = timePart.split(':').map(Number);
  const dow = new Date(yr, mo - 1, dy).getDay();
  return { h, m, dow };
}

function getResetLabels() {
  const { h, m, dow } = getAR();
  const minToMidnight = (23 - h) * 60 + (59 - m) + 1;
  const hh = Math.floor(minToMidnight / 60);
  const mm = minToMidnight % 60;
  const labelHoy = hh > 0 ? `Se reinicia en ${hh}h ${mm}m` : `Se reinicia en ${mm}m`;
  const daysToMon = dow === 1 ? 7 : (8 - dow) % 7;
  const minToMon  = daysToMon * 24 * 60 - h * 60 - m;
  const sd = Math.floor(minToMon / (24 * 60));
  const sh = Math.floor((minToMon % (24 * 60)) / 60);
  const labelSemana = sd > 0 ? `Se reinicia en ${sd}d ${sh}h` : `Se reinicia en ${sh}h ${mm}m`;
  return { labelHoy, labelSemana };
}

export default function Dashboard() {
  const persisted = getPersistedMetrics();
  const [loading, setLoading]         = useState(!persisted);
  const [syncing, setSyncing]         = useState(false);
  const [loaded, setLoaded]           = useState(0);
  const [metrics, setMetrics]         = useState<TNMetrics | null>(persisted);
  const [error, setError]             = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [resets, setResets]           = useState(getResetLabels);
  const [clicksCount, setClicksCount]         = useState<number | null>(null);
  const [convertidosCount, setConvertidosCount] = useState<number | null>(null);

  useEffect(() => {
    const id = setInterval(() => setResets(getResetLabels()), 60_000);
    return () => clearInterval(id);
  }, []);

  const fetchData = async (force = false) => {
    const hasCached = !!getPersistedMetrics() && !force;
    if (hasCached) setSyncing(true); else setLoading(true);
    setError(false);
    setLoaded(0);
    try {
      const settings = getSettings();
      const storeId  = settings?.tiendanubeStoreId?.trim() ?? '';
      const token    = settings?.tiendanubeToken?.trim()    ?? '';
      if (!storeId || !token) { setLoading(false); setSyncing(false); return; }
      if (force) clearTNCache();
      const data = await fetchTNMetrics(storeId, token, n => setLoaded(n));
      setMetrics(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setSyncing(false);
      setLastRefreshed(new Date());
    }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    const settings = getSettings();
    const url = (settings as any)?.googleSheetsUrl?.trim() ?? '';
    if (!url) return;
    fetchSheetRowCount(url, GID_CLICKS).then(setClicksCount);
    fetchSheetRowCount(url, GID_CONVERTIDOS).then(setConvertidosCount);
  }, []);

  const settings     = getSettings();
  const isConfigured = !!(settings?.tiendanubeStoreId && settings?.tiendanubeToken);

  return (
    <div className="dashboard-page fade-in">

      {/* ── Header ── */}
      <header className="dashboard-header">
        <div>
          <h1>FromNorth Analytics</h1>
          <div className="dashboard-meta">
            <span className="text-muted">Actualizado: {lastRefreshed.toLocaleTimeString('es-AR')}</span>
            {metrics && !syncing && <span className="status-dot">TiendaNube conectado</span>}
            {syncing && <span className="status-dot syncing"><RefreshCw size={11} className="spinning" /> Actualizando...</span>}
            {!isConfigured && <span className="status-dot paused">Configurá TiendaNube en Ajustes</span>}
          </div>
        </div>
        <button className="btn-secondary refresh-btn" onClick={() => fetchData(true)} disabled={loading || syncing}>
          <RefreshCw size={15} className={(loading || syncing) ? 'spinning' : ''} />
          {loading ? (loaded > 0 ? `${fmtInt(loaded)} órdenes...` : 'Cargando...') : 'Actualizar'}
        </button>
      </header>

      {error && (
        <div className="dashboard-error glass-panel">
          No se pudo conectar con TiendaNube. Verificá el token en Configuración.
        </div>
      )}

      {/* ── Métricas ── */}
      {metrics && (
        <div className="metrics-grid">
          <MetricCard title="Ganancia Total (90d)"  value={`$${fmtInt(metrics.totalFacturado)}`} icon={<DollarSign size={18} />} />
          <MetricCard title="Ventas Hoy"            value={`$${fmt(metrics.ventasHoy)}`}         icon={<Activity size={18} />}     subtitle={resets.labelHoy} />
          <MetricCard title="Ventas Semana"         value={`$${fmt(metrics.ventasSemana)}`}      icon={<CalendarDays size={18} />} subtitle={resets.labelSemana} />
          <MetricCard title="Clientes recurrentes"  value={fmtInt(metrics.clientesRecurrentes)}  icon={<UserCheck size={18} />} subtitle={`${fmtInt(metrics.clientesNuevos)} nuevos`} />
          <Link
            to="/sheet-viewer"
            state={{ gid: GID_CLICKS, title: 'Clicks de seguimiento', subtitle: 'Registros de clicks' }}
            className="metric-card-link"
          >
            <MetricCard
              title="Clicks de seguimiento"
              value={clicksCount !== null ? fmtInt(clicksCount) : '—'}
              icon={<MousePointerClick size={18} />}
              subtitle="Ver registros →"
            />
          </Link>
          <Link
            to="/sheet-viewer"
            state={{ gid: GID_CONVERTIDOS, title: 'Seguimientos convertidos', subtitle: 'Clientes que completaron el seguimiento' }}
            className="metric-card-link"
          >
            <MetricCard
              title="Seguimientos convertidos"
              value={convertidosCount !== null ? fmtInt(convertidosCount) : '—'}
              icon={<Users size={18} />}
              subtitle="Ver clientes →"
            />
          </Link>
        </div>
      )}

      {/* ── Top listas ── */}
      {metrics && (metrics.topProductos.length > 0 || metrics.topCompradores.length > 0) && (
        <div className="insights-grid desktop-only">
          {metrics.topProductos.length > 0 && (
            <div className="insight-card glass-panel">
              <div className="insight-header">
                <ShoppingBag size={15} className="insight-icon" />
                <h3>Productos más vendidos</h3>
              </div>
              <ol className="ranking-list">
                {metrics.topProductos.map((p, i) => (
                  <li key={p.nombre} className="ranking-item">
                    <span className={`ranking-pos pos-${i + 1}`}>{i + 1}</span>
                    <span className="ranking-name" title={p.nombre}>{p.nombre}</span>
                    <div className="ranking-right">
                      <span className="ranking-sub">{fmtInt(p.cantidad)} uds.</span>
                      <span className="ranking-value">${fmt(p.total)}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {metrics.topCompradores.length > 0 && (
            <div className="insight-card glass-panel">
              <div className="insight-header">
                <Trophy size={15} className="insight-icon insight-gold" />
                <h3>Mejores compradores</h3>
              </div>
              <ol className="ranking-list">
                {metrics.topCompradores.map((c, i) => (
                  <li key={c.email || c.nombre} className="ranking-item">
                    <span className={`ranking-pos pos-${i + 1}`}>{i + 1}</span>
                    <div className="ranking-buyer">
                      <span className="ranking-name" title={c.nombre || c.email}>{c.nombre || c.email}</span>
                      {c.nombre && <span className="ranking-email">{c.email}</span>}
                    </div>
                    <div className="ranking-right">
                      <span className="ranking-sub">{c.pedidos} pedido{c.pedidos !== 1 ? 's' : ''}</span>
                      <span className="ranking-value">${fmt(c.total)}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {/* ── Última venta ── */}
      {metrics?.ultimaVenta && (
        <div className="ultima-venta-strip glass-panel">
          <ShoppingCart size={15} className="strip-icon" />
          <span className="uv-label">Última venta</span>
          <span className="strip-divider" />
          <span className="uv-cliente">{metrics.ultimaVenta.cliente || '—'}</span>
          <span className="uv-dot" />
          <span className="uv-producto">{metrics.ultimaVenta.producto.split('(')[0].trim()}</span>
          <span className="uv-dot" />
          <span className="uv-fecha">{metrics.ultimaVenta.fecha}{metrics.ultimaVenta.hora ? ` · ${metrics.ultimaVenta.hora}` : ''}</span>
          <span className="uv-monto">${fmt(metrics.ultimaVenta.monto)}</span>
        </div>
      )}

      {/* ── Gráfico ventas por día ── */}
      {metrics && metrics.ventasPorDia.length > 0 && (
        <SalesChart data={metrics.ventasPorDia} />
      )}

      {/* ── Loading ── */}
      {loading && !metrics && (
        <div className="dashboard-loading glass-panel">
          <RefreshCw size={22} className="spinning" />
          <span>{loaded > 0 ? `Cargando ${fmtInt(loaded)} órdenes...` : 'Conectando con TiendaNube...'}</span>
        </div>
      )}

      {/* ── Sin configuración ── */}
      {!loading && !isConfigured && !metrics && (
        <div className="dashboard-empty glass-panel">
          <Store size={36} style={{ color: 'var(--accent-primary)', opacity: 0.6 }} />
          <p>Configurá tu <strong>Store ID</strong> y <strong>Access Token</strong> de TiendaNube en <a href="/settings" style={{ color: 'var(--accent-primary)' }}>Configuración</a>.</p>
        </div>
      )}

    </div>
  );
}
