import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import MetricCard from '../components/MetricCard';
import SalesChart from '../components/SalesChart';
import MonthSelector from '../components/MonthSelector';
import ChartPanel from '../components/ChartPanel';
import {
  RefreshCw, DollarSign, Activity, CalendarDays,
  ShoppingCart, Store, UserCheck, MousePointerClick, Users, X,
} from 'lucide-react';
import { getSettings, fetchSheetRowCount } from '../services/dataService';
import { fetchTNMetrics, clearTNCache, getPersistedMetrics, paymentStatusLabel } from '../services/tiendanubeService';
import type { TNMetrics } from '../services/tiendanubeService';
import { fetchMetaSpendByDay } from '../services/metaAdsService';
import type { MetaDailySpend } from '../services/metaAdsService';
import { useMonth } from '../context/MonthContext';

const GID_CLICKS       = '1982854970';
const GID_CONVERTIDOS  = '11747759';
import './Dashboard.css';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function getCurrentMonthKeyAR(): string {
  const AR_OFFSET = -3 * 60 * 60 * 1000;
  const d = new Date(Date.now() + AR_OFFSET);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return `${MESES[month - 1]} ${year}`;
}

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
  const [clicksCount, setClicksCount]               = useState<number | null>(null);
  const [convertidosCount, setConvertidosCount]     = useState<number | null>(null);
  const [showRecurrentes, setShowRecurrentes]       = useState(false);
  const [metaByDay, setMetaByDay]                   = useState<MetaDailySpend[]>([]);
  const [activeChart, setActiveChart]               = useState<'mes' | 'hoy' | 'semana' | null>(null);

  const { selectedMonth, setSelectedMonth } = useMonth();
  const selectedMonthKey = `${selectedMonth.year}-${String(selectedMonth.month).padStart(2, '0')}`;

  const currentMonthKey = useMemo(getCurrentMonthKeyAR, []);
  const isCurrentMonth  = selectedMonthKey === currentMonthKey;

  // Meses disponibles en los datos cargados
  const availableMonths = useMemo(() => {
    if (!metrics) return [];
    const AR_OFFSET = -3 * 60 * 60 * 1000;
    const monthSet = new Set<string>();
    for (const o of metrics.orders) {
      const d = new Date(new Date(o.created_at).getTime() + AR_OFFSET);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      monthSet.add(key);
    }
    return [...monthSet].sort().reverse();
  }, [metrics]);

  // Si el mes seleccionado no tiene datos, seleccionar el mes más reciente disponible
  useEffect(() => {
    if (availableMonths.length > 0 && !availableMonths.includes(selectedMonthKey)) {
      const [y, m] = availableMonths[0].split('-').map(Number);
      setSelectedMonth({ month: m, year: y });
    }
  }, [availableMonths]);

  // Cerrar gráficos de hoy/semana si se cambia a un mes no actual
  useEffect(() => {
    if (!isCurrentMonth && (activeChart === 'hoy' || activeChart === 'semana')) {
      setActiveChart(null);
    }
  }, [isCurrentMonth]);

  // Órdenes pagadas del mes seleccionado
  const monthOrders = useMemo(() => {
    if (!metrics) return [];
    const AR_OFFSET = -3 * 60 * 60 * 1000;
    return metrics.orders.filter(o => {
      if (o.payment_status !== 'paid' && o.payment_status !== 'authorized') return false;
      const d = new Date(new Date(o.created_at).getTime() + AR_OFFSET);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      return key === selectedMonthKey;
    });
  }, [metrics, selectedMonthKey]);

  const monthTotal          = useMemo(() => monthOrders.reduce((s, o) => s + parseFloat(o.total), 0), [monthOrders]);
  const monthOrderCount     = monthOrders.length;
  const monthTicketPromedio = monthOrderCount > 0 ? monthTotal / monthOrderCount : 0;

  const semanaOrderCount = useMemo(() => {
    if (!metrics) return 0;
    const AR_OFFSET = -3 * 60 * 60 * 1000;
    const nowAR = Date.now() + AR_OFFSET;
    const msPerDay = 86_400_000;
    const todayStartMS = Math.floor(nowAR / msPerDay) * msPerDay - AR_OFFSET;
    const arDow = new Date(nowAR).getUTCDay();
    const weekStartMS = todayStartMS - (arDow === 0 ? 6 : arDow - 1) * msPerDay;
    return metrics.orders.filter(o =>
      (o.payment_status === 'paid' || o.payment_status === 'authorized') &&
      new Date(o.created_at).getTime() >= weekStartMS
    ).length;
  }, [metrics]);

  // Últimas órdenes del mes seleccionado
  const ultimasOrdenes = useMemo(() => {
    return [...monthOrders]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10);
  }, [monthOrders]);

  // Última venta del mes seleccionado
  const monthUltimaVenta = useMemo(() => {
    if (ultimasOrdenes.length === 0) return null;
    const o = ultimasOrdenes[0];
    return {
      monto:    parseFloat(o.total),
      producto: o.products[0]?.name ?? '',
      hora:     new Date(o.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' }),
      cliente:  o.customer?.name ?? '',
      fecha:    new Date(o.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' }),
    };
  }, [ultimasOrdenes]);

  // Ventas por día filtradas al mes seleccionado
  const monthVentasPorDia = useMemo(() => {
    if (!metrics) return [];
    const [selYear, selMonth] = selectedMonthKey.split('-').map(Number);
    return metrics.ventasPorDia.filter(d => {
      const parts = d.name.split('/');
      if (parts.length !== 3) return false;
      return parseInt(parts[1]) === selMonth && parseInt(parts[2]) === selYear;
    });
  }, [metrics, selectedMonthKey]);

  const recurrentesLista = useMemo(() => {
    if (!metrics) return [];
    const map: Record<string, { nombre: string; email: string; pedidos: number; total: number }> = {};
    for (const o of metrics.orders) {
      if (o.payment_status !== 'paid' && o.payment_status !== 'authorized') continue;
      const email  = o.customer?.email ?? '';
      const nombre = o.customer?.name  ?? '';
      const key    = email || nombre;
      if (!key) continue;
      if (!map[key]) map[key] = { nombre, email, pedidos: 0, total: 0 };
      map[key].pedidos++;
      map[key].total += parseFloat(o.total);
    }
    return Object.values(map).filter(c => c.pedidos > 1).sort((a, b) => b.pedidos - a.pedidos);
  }, [metrics]);

  useEffect(() => {
    const id = setInterval(() => setResets(getResetLabels()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      fetch('/api/sync-metrics').catch(() => {}).finally(() => fetchData(true));
    }, 15 * 60 * 1000);
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
      const token    = settings?.tiendanubeToken?.trim()    ?? '';;
      if (!storeId || !token) { setLoading(false); setSyncing(false); return; }
      if (force) clearTNCache();
      const data = await fetchTNMetrics(storeId, token, n => setLoaded(n), force);
      setMetrics(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setSyncing(false);
      setLastRefreshed(new Date());
    }
  };

  useEffect(() => {
    fetchData();
    fetch('/api/sync-metrics').catch(() => {}).finally(() => {
      clearTNCache();
      fetchData();
    });
  }, []);

  useEffect(() => {
    const settings = getSettings();
    const url = (settings as any)?.googleSheetsUrl?.trim() ?? '';
    if (!url) return;
    fetchSheetRowCount(url, GID_CLICKS).then(setClicksCount);
    fetchSheetRowCount(url, GID_CONVERTIDOS).then(setConvertidosCount);
  }, []);

  useEffect(() => {
    const settings = getSettings();
    const token     = settings?.metaAccessToken?.trim()  ?? '';
    const accountId = settings?.metaAdAccountId?.trim()  ?? '';
    if (!token || !accountId) return;
    fetchMetaSpendByDay(token, accountId).then(setMetaByDay).catch(() => {});
  }, []);

  const settings     = getSettings();
  const isConfigured = !!(settings?.tiendanubeStoreId && settings?.tiendanubeToken);
  const fmt    = (v: number) => v.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtInt = (v: number) => v.toLocaleString('es-AR', { maximumFractionDigits: 0 });

  const cardActiveStyle = (type: 'mes' | 'hoy' | 'semana') => ({
    cursor: 'pointer',
    borderRadius: 10,
    borderBottom: activeChart === type ? '2px solid var(--accent-primary)' : '2px solid transparent',
    background: activeChart === type ? 'rgba(6,182,212,0.05)' : 'transparent',
    transition: 'border-color 0.15s, background 0.15s',
  });

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

      {/* ── Filtro de meses ── */}
      {metrics && (
        <MonthSelector availableMonths={availableMonths} />
      )}

      {/* ── Bloques 1 + 2: métricas del mes ── */}
      {metrics && (
        <div className="metrics-both-grids">
          <div className="metrics-grid">
            <div
              onClick={() => setActiveChart(prev => prev === 'mes' ? null : 'mes')}
              style={cardActiveStyle('mes')}
            >
              <MetricCard
                title={`Ventas ${monthLabel(selectedMonthKey)}`}
                value={'$ ' + fmtInt(monthTotal)}
                icon={<DollarSign size={18} />}
                subtitle={`${monthOrderCount} orden${monthOrderCount !== 1 ? 'es' : ''}`}
              />
            </div>
            {isCurrentMonth ? (
              <>
                <div
                  onClick={() => setActiveChart(prev => prev === 'hoy' ? null : 'hoy')}
                  style={cardActiveStyle('hoy')}
                >
                  <MetricCard title="Ventas Hoy" value={'$ ' + fmt(metrics.ventasHoy)} icon={<Activity size={18} />} subtitle={`${metrics.ordenesHoy.length} orden${metrics.ordenesHoy.length !== 1 ? 'es' : ''} · ${resets.labelHoy}`} />
                </div>
                <div
                  onClick={() => setActiveChart(prev => prev === 'semana' ? null : 'semana')}
                  style={cardActiveStyle('semana')}
                >
                  <MetricCard title="Ventas Semana" value={'$ ' + fmt(metrics.ventasSemana)} icon={<CalendarDays size={18} />} subtitle={`${semanaOrderCount} orden${semanaOrderCount !== 1 ? 'es' : ''} · ${resets.labelSemana}`} />
                </div>
              </>
            ) : (
              <>
                <MetricCard title="Órdenes del mes"  value={fmtInt(monthOrderCount)}           icon={<Activity size={18} />} />
                <MetricCard title="Ticket promedio"  value={'$ ' + fmt(monthTicketPromedio)}    icon={<CalendarDays size={18} />} />
              </>
            )}
          </div>
          <div className="dashboard-section">
            <p className="dashboard-section-label">Actividad y Conversión</p>
            <div className="metrics-grid">
              <div className="metric-card-link" onClick={() => setShowRecurrentes(true)} style={{ cursor: 'pointer' }}>
                <MetricCard title="Clientes recurrentes" value={fmtInt(metrics.clientesRecurrentes)} icon={<UserCheck size={18} />} subtitle="Ver lista →" />
              </div>
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
          </div>
        </div>
      )}

      {/* ── Panel de gráfico expandible ── */}
      {activeChart && metrics && (
        <ChartPanel
          activeChart={activeChart}
          monthOrders={monthOrders}
          metrics={metrics}
          selectedMonthKey={selectedMonthKey}
          onClose={() => setActiveChart(null)}
        />
      )}

      {/* ── Últimas órdenes del mes ── */}
      {ultimasOrdenes.length > 0 && (
        <div className="insight-card glass-panel" style={{ overflowX: 'auto' }}>
          <div className="insight-header">
            <ShoppingCart size={15} className="insight-icon" />
            <h3>Últimas órdenes — {monthLabel(selectedMonthKey)}</h3>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr>
                {['Pedido', 'Cliente', 'Producto', 'Fecha', 'Monto', 'Estado'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '0 0.75rem 0.6rem', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ultimasOrdenes.map(o => (
                <tr key={o.id}>
                  <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.03)', whiteSpace: 'nowrap' }}>#{o.number}</td>
                  <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text-primary)', fontWeight: 500, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>{o.customer?.name || '—'}</td>
                  <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text-secondary)', borderBottom: '1px solid rgba(255,255,255,0.03)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={o.products.map(p => p.name).join(', ')}>
                    {o.products[0]?.name ?? '—'}{o.products.length > 1 ? ` +${o.products.length - 1}` : ''}
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.03)', whiteSpace: 'nowrap' }}>
                    {new Date(o.created_at).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit' })}
                    {' · '}
                    {new Date(o.created_at).toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text-secondary)', borderBottom: '1px solid rgba(255,255,255,0.03)', whiteSpace: 'nowrap' }}>$ {fmt(parseFloat(o.total))}</td>
                  <td style={{ padding: '0.65rem 0.75rem', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: '999px', background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.25)' }}>
                      {paymentStatusLabel(o.payment_status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Última venta del mes ── */}
      {monthUltimaVenta && (
        <div className="ultima-venta-strip glass-panel">
          <ShoppingCart size={15} className="strip-icon" />
          <span className="uv-label">Última venta</span>
          <span className="strip-divider" />
          <span className="uv-cliente">{monthUltimaVenta.cliente || '—'}</span>
          <span className="uv-dot" />
          <span className="uv-producto">{monthUltimaVenta.producto.split('(')[0].trim()}</span>
          <span className="uv-dot" />
          <span className="uv-fecha">{monthUltimaVenta.fecha}{monthUltimaVenta.hora ? ` · ${monthUltimaVenta.hora}` : ''}</span>
          <span className="uv-monto">$ {fmt(monthUltimaVenta.monto)}</span>
        </div>
      )}

      {/* ── Gráfico ventas por día del mes ── */}
      {monthVentasPorDia.length > 0 && (
        <SalesChart data={monthVentasPorDia.map(d => ({
          ...d,
          inversion: metaByDay.find(m => m.name === d.name)?.inversion,
        }))} />
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

      {/* ── Modal: Clientes Recurrentes (últimos 90 días) ── */}
      {showRecurrentes && (
        <div className="recurrentes-overlay" onClick={() => setShowRecurrentes(false)}>
          <div className="recurrentes-modal glass-panel" onClick={e => e.stopPropagation()}>
            <div className="recurrentes-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <UserCheck size={18} style={{ color: 'var(--accent-primary)' }} />
                <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Clientes recurrentes</h2>
                <span style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '999px', padding: '0.15rem 0.55rem', color: 'var(--text-muted)' }}>
                  {recurrentesLista.length}
                </span>
              </div>
              <button className="rec-close-btn" onClick={() => setShowRecurrentes(false)}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0.25rem 0 1rem' }}>
              Clientes con más de una compra (últimos 90 días), ordenados por pedidos.
            </p>
            {recurrentesLista.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem', fontSize: '0.82rem' }}>
                Sin clientes recurrentes en este período
              </div>
            ) : (
              <div style={{ overflowX: 'auto', maxHeight: '60vh', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr>
                      {['#', 'Cliente', 'Email', 'Pedidos', 'Total gastado'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '0 0.75rem 0.6rem', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recurrentesLista.map((c, i) => (
                      <tr key={c.email || c.nombre}>
                        <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>{i + 1}</td>
                        <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text-primary)', fontWeight: 500, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>{c.nombre || '—'}</td>
                        <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text-muted)', fontSize: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>{c.email || '—'}</td>
                        <td style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: 'var(--accent-primary)', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>{c.pedidos}</td>
                        <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text-secondary)', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>$ {fmt(c.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
