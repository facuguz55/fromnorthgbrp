import { useState, useEffect } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import {
  RefreshCw, Dices, Gift, Users, Percent, Trophy, Copy, Check, Send,
  ShoppingBag, TrendingUp, Tag,
} from 'lucide-react';
import MetricCard from '../components/MetricCard';
import {
  fetchRuletaMetrics,
  insertEmailParaRuleta,
  deleteEmailDeRuleta,
  PREMIO_COLOR_MAP,
} from '../services/supabaseService';
import type { RuletaMetrics } from '../services/supabaseService';
import { fetchFNCouponOrders } from '../services/tiendanubeService';
import type { FNCouponConversion } from '../services/tiendanubeService';
import { getSettings } from '../services/dataService';
import '../components/Chart.css';
import './Ruleta.css';

// ── Tooltips ──────────────────────────────────────────────────────────────────

const PremioTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    const total = payload[0].payload.__total as number;
    const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
    return (
      <div className="chart-tooltip">
        <p className="chart-tooltip-label">{d.name}</p>
        <p className="chart-tooltip-value" style={{ color: d.color }}>
          {d.value} giros
        </p>
        <p className="chart-tooltip-sub">{pct}% del total</p>
      </div>
    );
  }
  return null;
};

const DiaTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="chart-tooltip">
        <p className="chart-tooltip-label">{label}</p>
        <p className="chart-tooltip-value" style={{ color: '#f59e0b' }}>
          {payload[0].value}
        </p>
        <p className="chart-tooltip-sub">giros ese día</p>
      </div>
    );
  }
  return null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function premioClass(premio: string): string {
  const map: Record<string, string> = {
    'Envio gratis':       'badge-cyan',
    '10% de descuento':   'badge-indigo',
    '5% de descuento':    'badge-green',
    '1 Camisa gratis':    'badge-amber',
    '30% de descuento':   'badge-red',
    'Segui participando': 'badge-muted',
  };
  return map[premio] ?? 'badge-muted';
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Ruleta() {
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [metrics, setMetrics] = useState<RuletaMetrics | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [giroEmail, setGiroEmail]   = useState('');
  const [giroStatus, setGiroStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle');
  const [quitarEmail, setQuitarEmail]   = useState('');
  const [quitarStatus, setQuitarStatus] = useState<'idle' | 'loading' | 'ok' | 'err' | 'none'>('idle');
  const [quitarCount, setQuitarCount]   = useState(0);

  // Conversiones FN
  const [conversiones,        setConversiones]        = useState<FNCouponConversion[]>([]);
  const [loadingConversiones, setLoadingConversiones] = useState(true);
  const [errorConversiones,   setErrorConversiones]   = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(false);
    const data = await fetchRuletaMetrics();
    if (data) {
      setMetrics(data);
    } else {
      setError(true);
    }
    setLoading(false);
    setLastRefreshed(new Date());
  };

  const fetchConversiones = async () => {
    setLoadingConversiones(true);
    setErrorConversiones(false);
    try {
      const settings = getSettings();
      const storeId  = settings?.tiendanubeStoreId?.trim() ?? '';
      const token    = settings?.tiendanubeToken?.trim()    ?? '';
      if (!storeId || !token) {
        setErrorConversiones(true);
        return;
      }
      const data = await fetchFNCouponOrders(storeId, token);
      setConversiones(data);
    } catch {
      setErrorConversiones(true);
    } finally {
      setLoadingConversiones(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchConversiones();
  }, []);

  const handleGiroManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!giroEmail.trim()) return;
    setGiroStatus('loading');
    try {
      await insertEmailParaRuleta(giroEmail.trim().toLowerCase());
      setGiroStatus('ok');
      setGiroEmail('');
      setTimeout(() => setGiroStatus('idle'), 3000);
    } catch {
      setGiroStatus('err');
      setTimeout(() => setGiroStatus('idle'), 3000);
    }
  };

  const handleQuitarGiro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quitarEmail.trim()) return;
    setQuitarStatus('loading');
    try {
      const count = await deleteEmailDeRuleta(quitarEmail.trim().toLowerCase());
      setQuitarCount(count);
      setQuitarStatus(count === 0 ? 'none' : 'ok');
      if (count > 0) setQuitarEmail('');
      setTimeout(() => setQuitarStatus('idle'), 4000);
    } catch {
      setQuitarStatus('err');
      setTimeout(() => setQuitarStatus('idle'), 3000);
    }
  };

  const copyCode = (id: number, code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  // Enrich distribucionPremios con __total para el tooltip
  const distribucionConTotal = metrics?.distribucionPremios.map(d => ({
    ...d,
    __total: metrics.totalGiros,
  })) ?? [];

  const hasPie  = distribucionConTotal.length > 0;
  const hasDias = (metrics?.girosPorDia.length ?? 0) > 0;

  return (
    <div className="ruleta-page fade-in">

      {/* ── Header ── */}
      <header className="ruleta-header">
        <div>
          <h1>
            <Dices size={24} className="ruleta-title-icon" />
            Ruleta de Premios
          </h1>
          <span className="text-muted ruleta-meta">
            Actualizado: {lastRefreshed.toLocaleTimeString('es-AR')}
          </span>
        </div>
        <button className="btn-secondary refresh-btn" onClick={fetchData} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spinning' : ''} />
          {loading ? 'Cargando...' : 'Actualizar'}
        </button>
      </header>

      {error && (
        <div className="ruleta-error glass-panel">
          No se pudo conectar con Supabase. Verificá la conexión e intentá de nuevo.
        </div>
      )}

      {/* ── Giro manual ── */}
      <section className="giro-manual-section glass-panel">
        <div className="section-title-row" style={{ marginBottom: '0.75rem' }}>
          <Dices size={18} className="section-icon" />
          <h2 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Generar giro manual</h2>
        </div>
        <p className="section-desc" style={{ marginBottom: '0.875rem' }}>
          Ingresá el Gmail del cliente para habilitarle un giro de ruleta.
        </p>
        <form className="giro-manual-form" onSubmit={handleGiroManual}>
          <input
            type="email"
            className="giro-email-input"
            placeholder="cliente@gmail.com"
            value={giroEmail}
            onChange={e => { setGiroEmail(e.target.value); setGiroStatus('idle'); }}
            disabled={giroStatus === 'loading'}
            required
          />
          <button
            type="submit"
            className={`giro-submit-btn ${giroStatus === 'ok' ? 'giro-ok' : giroStatus === 'err' ? 'giro-err' : ''}`}
            disabled={giroStatus === 'loading' || !giroEmail.trim()}
          >
            {giroStatus === 'loading' ? <RefreshCw size={15} className="spinning" /> :
             giroStatus === 'ok'      ? <Check size={15} /> :
             giroStatus === 'err'     ? '✕' :
             <Send size={15} />}
            {giroStatus === 'loading' ? 'Guardando...' :
             giroStatus === 'ok'      ? '¡Giro generado!' :
             giroStatus === 'err'     ? 'Error, reintentar' :
             'Generar giro'}
          </button>
        </form>
      </section>

      {/* ── Quitar giro ── */}
      <section className="giro-manual-section glass-panel">
        <div className="section-title-row" style={{ marginBottom: '0.75rem' }}>
          <Gift size={18} style={{ color: '#ef4444', flexShrink: 0 }} />
          <h2 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Quitar giro</h2>
        </div>
        <p className="section-desc" style={{ marginBottom: '0.875rem' }}>
          Eliminá todas las entradas de un Gmail en la tabla de ventas.
        </p>
        <form className="giro-manual-form" onSubmit={handleQuitarGiro}>
          <input
            type="email"
            className="giro-email-input"
            placeholder="cliente@gmail.com"
            value={quitarEmail}
            onChange={e => { setQuitarEmail(e.target.value); setQuitarStatus('idle'); }}
            disabled={quitarStatus === 'loading'}
            required
          />
          <button
            type="submit"
            className={`giro-submit-btn ${quitarStatus === 'ok' ? 'giro-ok' : quitarStatus === 'err' || quitarStatus === 'none' ? 'giro-err' : ''}`}
            style={quitarStatus === 'idle' ? { background: '#ef4444' } : undefined}
            disabled={quitarStatus === 'loading' || !quitarEmail.trim()}
          >
            {quitarStatus === 'loading' ? <RefreshCw size={15} className="spinning" /> :
             quitarStatus === 'ok'      ? <Check size={15} /> : null}
            {quitarStatus === 'loading' ? 'Eliminando...' :
             quitarStatus === 'ok'      ? `${quitarCount} giro${quitarCount !== 1 ? 's' : ''} eliminado${quitarCount !== 1 ? 's' : ''}` :
             quitarStatus === 'none'    ? 'Sin giros para ese email' :
             quitarStatus === 'err'     ? 'Error, reintentar' :
             'Quitar giro'}
          </button>
        </form>
      </section>

      {/* ── KPI Cards ── */}
      {metrics && (
        <div className="ruleta-kpi-grid">
          <MetricCard
            title="Total de giros"
            value={metrics.totalGiros}
            icon={<Dices size={20} />}
            subtitle="registros en la base de datos"
          />
          <MetricCard
            title="Premios otorgados"
            value={metrics.premiosOtorgados}
            icon={<Gift size={20} />}
            subtitle="giros con premio ganado"
          />
          <MetricCard
            title="Participantes únicos"
            value={metrics.participantesUnicos}
            icon={<Users size={20} />}
            subtitle="emails distintos registrados"
          />
          <MetricCard
            title="Tasa de ganadores"
            value={`${metrics.tasaGanadores}%`}
            icon={<Percent size={20} />}
            subtitle="de los giros obtuvo un premio"
          />
        </div>
      )}

      {/* ── Charts Row ── */}
      {metrics && (
        <div className="ruleta-charts-row">

          {/* Distribución de premios */}
          <section className="analytics-section">
            <div className="section-title-row">
              <Trophy size={18} className="section-icon" />
              <h2>Distribución de premios</h2>
            </div>
            <p className="section-desc">Cantidad de veces que salió cada premio en la ruleta.</p>

            <div className="chart-container glass-panel ruleta-chart-pie">
              <div className="chart-header">
                <div className="chart-header-row">
                  <span className="chart-title">Premios sorteados</span>
                  <span className="chart-badge">Ruleta</span>
                </div>
                <span className="chart-subtitle">Distribución por tipo de premio</span>
              </div>
              {hasPie ? (
                <>
                  <div className="chart-wrapper">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={distribucionConTotal}
                          cx="50%"
                          cy="50%"
                          innerRadius={58}
                          outerRadius={90}
                          dataKey="value"
                          paddingAngle={3}
                        >
                          {distribucionConTotal.map((entry, i) => (
                            <Cell key={`cell-${i}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<PremioTooltip />} />
                        <Legend
                          formatter={(value) => (
                            <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>{value}</span>
                          )}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="premios-list">
                    {distribucionConTotal.map(d => (
                      <div key={d.name} className="premio-row">
                        <span className="premio-dot" style={{ background: d.color }} />
                        <span className="premio-name">{d.name}</span>
                        <span className="premio-count">{d.value} veces</span>
                        <span className="premio-pct">
                          {metrics.totalGiros > 0
                            ? Math.round((d.value / metrics.totalGiros) * 100)
                            : 0}%
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="chart-empty">Sin datos disponibles</div>
              )}
            </div>
          </section>

          {/* Giros por día */}
          <section className="analytics-section">
            <div className="section-title-row">
              <Dices size={18} className="section-icon" />
              <h2>Giros por día</h2>
            </div>
            <p className="section-desc">Cantidad de ruletas giradas agrupadas por fecha.</p>

            <div className="chart-container glass-panel ruleta-chart-bar">
              <div className="chart-header">
                <div className="chart-header-row">
                  <span className="chart-title">Actividad diaria</span>
                  <span className="chart-badge chart-badge-amber">Actividad</span>
                </div>
                <span className="chart-subtitle">Número de giros por día</span>
              </div>
              {hasDias ? (
                <div className="chart-wrapper">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={metrics.girosPorDia}
                      margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(255,255,255,0.04)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="name"
                        stroke="transparent"
                        tick={{ fill: '#475569', fontSize: 11, fontFamily: 'Inter, sans-serif' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        stroke="transparent"
                        tick={{ fill: '#475569', fontSize: 11, fontFamily: 'Inter, sans-serif' }}
                        tickLine={false}
                        axisLine={false}
                        width={28}
                      />
                      <Tooltip content={<DiaTooltip />} cursor={{ fill: 'rgba(245,158,11,0.06)' }} />
                      <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="chart-empty">Sin datos disponibles</div>
              )}
            </div>
          </section>

        </div>
      )}

      {/* ── Tabla de registros ── */}
      {metrics && metrics.registros.length > 0 && (
        <section className="analytics-section ruleta-table-section">
          <div className="section-title-row">
            <Gift size={18} className="section-icon" />
            <h2>Últimos giros registrados</h2>
          </div>
          <p className="section-desc">
            Historial completo de participaciones — {metrics.registros.length} registros.
          </p>

          <div className="ruleta-table-wrapper glass-panel">
            <table className="ruleta-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Email</th>
                  <th>Premio</th>
                  <th>Código</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {metrics.registros.map(r => (
                  <tr key={r.id}>
                    <td className="ruleta-td-id">{r.id}</td>
                    <td className="ruleta-td-email" title={r.email}>{r.email}</td>
                    <td>
                      <span
                        className={`ruleta-badge ${premioClass(r.premio)}`}
                        style={{ borderColor: PREMIO_COLOR_MAP[r.premio] + '44' }}
                      >
                        {r.premio}
                      </span>
                    </td>
                    <td className="ruleta-td-codigo">
                      {r.codigo ? (
                        <div className="ruleta-codigo-cell">
                          <code className="ruleta-code">{r.codigo}</code>
                          <button
                            className="ruleta-copy-btn"
                            onClick={() => copyCode(r.id, r.codigo!)}
                            title="Copiar código"
                          >
                            {copiedId === r.id
                              ? <Check size={12} className="copy-icon-ok" />
                              : <Copy size={12} />}
                          </button>
                        </div>
                      ) : (
                        <span className="ruleta-no-code">—</span>
                      )}
                    </td>
                    <td className="ruleta-td-fecha">{r.fecha}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {loading && !metrics && (
        <div className="ruleta-loading">
          <RefreshCw size={24} className="spinning" />
          <span>Cargando datos de Supabase...</span>
        </div>
      )}

      {/* ── Conversiones FN ── */}
      <section className="analytics-section ruleta-table-section">
        <div className="section-title-row">
          <TrendingUp size={18} className="section-icon" />
          <h2>Conversiones de cupones FN</h2>
          <button
            className="btn-secondary refresh-btn"
            style={{ marginLeft: 'auto', fontSize: '0.75rem', padding: '0.3rem 0.7rem' }}
            onClick={fetchConversiones}
            disabled={loadingConversiones}
          >
            <RefreshCw size={13} className={loadingConversiones ? 'spinning' : ''} />
            {loadingConversiones ? 'Cargando...' : 'Actualizar'}
          </button>
        </div>
        <p className="section-desc">
          Compras realizadas usando cupones generados por la ruleta (prefijo <code style={{ fontFamily: 'monospace', color: 'var(--accent-primary)' }}>FN</code>).
        </p>

        {/* KPIs de conversión */}
        {!loadingConversiones && !errorConversiones && (
          <div className="ruleta-kpi-grid">
            <MetricCard
              title="Conversiones totales"
              value={conversiones.length}
              icon={<ShoppingBag size={20} />}
              subtitle="compras con cupón FN"
            />
            <MetricCard
              title="Facturado real"
              value={`$${conversiones.reduce((s, c) => s + c.total, 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
              icon={<TrendingUp size={20} />}
              subtitle="lo que pagaron después del descuento"
            />
            <MetricCard
              title="Valor entregado"
              value={`$${conversiones.reduce((s, c) => s + c.discount, 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
              icon={<Gift size={20} />}
              subtitle="valor total de los premios canjeados"
            />
            <MetricCard
              title="Clientes únicos"
              value={new Set(conversiones.map(c => c.customerEmail)).size}
              icon={<Users size={20} />}
              subtitle="emails distintos que compraron"
            />
            <MetricCard
              title="Tasa de conversión"
              value={metrics && metrics.participantesUnicos > 0
                ? `${Math.round((new Set(conversiones.map(c => c.customerEmail)).size / metrics.participantesUnicos) * 100)}%`
                : '—'}
              icon={<Percent size={20} />}
              subtitle="participantes que compraron"
            />
          </div>
        )}

        {/* Tabla */}
        {loadingConversiones ? (
          <div className="ruleta-loading">
            <RefreshCw size={20} className="spinning" />
            <span>Buscando conversiones en TiendaNube...</span>
          </div>
        ) : errorConversiones ? (
          <div className="ruleta-error glass-panel">
            No se pudo cargar. Verificá el token de TiendaNube en Configuración.
          </div>
        ) : conversiones.length === 0 ? (
          <div className="ruleta-error glass-panel" style={{ background: 'transparent', border: '1px dashed var(--border-color)', color: 'var(--text-muted)' }}>
            <Tag size={20} style={{ opacity: 0.4 }} />
            <span>Ninguna compra con cupón FN todavía.</span>
          </div>
        ) : (
          <div className="ruleta-table-wrapper glass-panel">
            <table className="ruleta-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Email</th>
                  <th>Cupón</th>
                  <th>Productos</th>
                  <th>Orden</th>
                  <th>Total</th>
                  <th>Descuento</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {conversiones.map(c => (
                  <tr key={c.orderId}>
                    <td className="ruleta-td-email">{c.customerName}</td>
                    <td className="ruleta-td-email" title={c.customerEmail}>{c.customerEmail}</td>
                    <td className="ruleta-td-codigo">
                      <code className="ruleta-code">{c.couponCode}</code>
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', maxWidth: '200px' }}>
                      {c.products.join(', ') || '—'}
                    </td>
                    <td className="ruleta-td-id">#{c.orderNumber}</td>
                    <td style={{ fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                      ${c.total.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ fontWeight: 700, color: '#10b981', fontVariantNumeric: 'tabular-nums' }}>
                      -${c.discount.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="ruleta-td-fecha">
                      {new Date(c.createdAt).toLocaleDateString('es-AR', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        timeZone: 'America/Argentina/Buenos_Aires',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </div>
  );
}
