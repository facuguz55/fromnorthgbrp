import { useState, useEffect } from 'react';
import MetricCard from '../components/MetricCard';
import EmailsChart from '../components/EmailsChart';
import ClicksChart from '../components/ClicksChart';
import SalesChart from '../components/SalesChart';
import {
  Mail, MousePointerClick, Users, RefreshCw,
  DollarSign, Activity, CalendarDays,
  ShoppingBag, Trophy, CreditCard, ShoppingCart,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getSettings, fetchGoogleSheetsMetrics } from '../services/dataService';
import type { TopProducto, MejorComprador } from '../services/dataService';
import './Dashboard.css';

const fmt    = (v: number) => v.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (v: number) => v.toLocaleString('es-AR', { maximumFractionDigits: 0 });

/** Returns current wall-clock components in Argentina timezone (UTC-3, no DST) */
function getAR() {
  const s = new Date().toLocaleString('en-US', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour12: false, year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
  // "MM/DD/YYYY, HH:MM"
  const [datePart, timePart] = s.split(', ');
  const [mo, dy, yr] = datePart.split('/').map(Number);
  const [h, m] = timePart.split(':').map(Number);
  const dow = new Date(yr, mo - 1, dy).getDay(); // 0=Sun … 6=Sat
  return { h, m, dow };
}

function getResetLabels() {
  const { h, m, dow } = getAR();

  // ── Ventas Hoy: tiempo hasta medianoche ───────────────
  const minToMidnight = (23 - h) * 60 + (59 - m) + 1;
  const hh = Math.floor(minToMidnight / 60);
  const mm = minToMidnight % 60;
  const labelHoy = hh > 0 ? `Se reinicia en ${hh}h ${mm}m` : `Se reinicia en ${mm}m`;

  // ── Ventas Semana: tiempo hasta el próximo lunes ──────
  const daysToMon = dow === 1 ? 7 : (8 - dow) % 7;
  const minToMon  = daysToMon * 24 * 60 - h * 60 - m;
  const sd = Math.floor(minToMon / (24 * 60));
  const sh = Math.floor((minToMon % (24 * 60)) / 60);
  const labelSemana = sd > 0 ? `Se reinicia en ${sd}d ${sh}h` : `Se reinicia en ${sh}h ${mm}m`;

  return { labelHoy, labelSemana };
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    correosEnviados: 0, clicks: 0, seguimientos: 0,
    gananciaTotal: 0,   ventasHoy: 0, ventasSemana: 0,
    correosPorDia:  [] as { name: string; value: number }[],
    clicksPorDia:   [] as { name: string; value: number }[],
    ventasPorDia:   [] as { name: string; value: number }[],
    topProductos:   [] as TopProducto[],
    topCompradores: [] as MejorComprador[],
    metodoPagoTop:  '',
    ultimaVenta:    null as { monto: number; producto: string; hora: string; cliente: string; fecha: string } | null,
  });
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [resets, setResets] = useState(getResetLabels);

  useEffect(() => {
    const id = setInterval(() => setResets(getResetLabels()), 60_000);
    return () => clearInterval(id);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const settings = getSettings();
      if (settings?.googleSheetsUrl && settings.autoSync !== false) {
        const fetched = await fetchGoogleSheetsMetrics(settings.googleSheetsUrl);
        if (fetched) setMetrics(fetched);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
      setLastRefreshed(new Date());
    }
  };

  useEffect(() => { fetchData(); }, []);

  const settings   = getSettings();
  const isPaused   = settings?.autoSync === false;
  const isConnected = !isPaused && (metrics.gananciaTotal > 0 || metrics.correosEnviados > 0);
  const hasInsights = metrics.topProductos.length > 0 || metrics.topCompradores.length > 0;

  return (
    <div className="dashboard-page fade-in">

      {/* ── Header ── */}
      <header className="dashboard-header">
        <div>
          <h1>FromNorth Analytics</h1>
          <div className="dashboard-meta">
            <span className="text-muted">Actualizado: {lastRefreshed.toLocaleTimeString('es-AR')}</span>
            {isPaused
              ? <span className="status-dot paused">Sincronización pausada</span>
              : isConnected
                ? <span className="status-dot">Google Sheets conectado</span>
                : null}
          </div>
        </div>
        <button className="btn-secondary refresh-btn" onClick={fetchData} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spinning' : ''} />
          {loading ? 'Actualizando...' : 'Actualizar'}
        </button>
      </header>

      {/* ── Métricas ── */}
      <div className="metrics-grid">
        <MetricCard title="Ganancia Total"   value={`$${fmt(metrics.gananciaTotal)}`} icon={<DollarSign size={18} />} />
        <MetricCard title="Ventas Hoy"       value={`$${fmt(metrics.ventasHoy)}`}      icon={<Activity size={18} />}     subtitle={resets.labelHoy} />
        <MetricCard title="Ventas Semana"    value={`$${fmt(metrics.ventasSemana)}`}   icon={<CalendarDays size={18} />} subtitle={resets.labelSemana} />
        <Link to="/seguimientos-enviados" className="metric-card-link">
          <MetricCard title="Seguimientos Enviados" value={fmtInt(metrics.correosEnviados)} icon={<Mail size={18} />} subtitle="Ver clientes →" />
        </Link>
        <Link to="/sheet-viewer" state={{ gid: '1982854970', title: 'Clicks de seguimiento', subtitle: 'Registros de clicks' }} className="metric-card-link">
          <MetricCard title="Clicks de seguimiento" value={fmtInt(metrics.clicks)} icon={<MousePointerClick size={18} />} subtitle="Ver registros →" />
        </Link>
        <Link to="/sheet-viewer" state={{ gid: '11747759', title: 'Seguimientos Convertidos', subtitle: 'Clientes que completaron el seguimiento' }} className="metric-card-link">
          <MetricCard title="Seguimientos Convertidos" value={fmtInt(metrics.seguimientos)} icon={<Users size={18} />} subtitle="Ver clientes →" />
        </Link>
      </div>

      {/* ── Top listas: Productos + Compradores ── */}
      {hasInsights && (
        <div className="insights-grid">

          {/* Top 5 Productos */}
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

          {/* Top 5 Compradores */}
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
                      <span className="ranking-name" title={c.nombre || c.email}>
                        {c.nombre || c.email}
                      </span>
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
      {metrics.ultimaVenta && (
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

      {/* ── Método de pago (strip antes de gráficos) ── */}
      {metrics.metodoPagoTop && (
        <div className="metodo-pago-strip glass-panel">
          <CreditCard size={16} className="strip-icon" />
          <span className="strip-label">Método de pago más usado</span>
          <span className="strip-divider" />
          <span className="strip-value">{metrics.metodoPagoTop}</span>
        </div>
      )}

      {/* ── Gráficos ── */}
      <div className="charts-grid">
        <div className="chart-full-width">
          <SalesChart data={metrics.ventasPorDia} />
        </div>
        <EmailsChart data={metrics.correosPorDia} />
        <ClicksChart data={metrics.clicksPorDia} />
      </div>


    </div>
  );
}
