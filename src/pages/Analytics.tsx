import { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  RefreshCw, Clock, Users, UserCheck, UserPlus,
  TrendingUp, ShoppingCart, Package, Trophy, X,
} from 'lucide-react';
import { getSettings } from '../services/dataService';
import {
  fetchTNMetrics,
  getPersistedMetrics,
  paymentStatusLabel,
  paymentStatusClass,
} from '../services/tiendanubeService';
import type { TNMetrics, TNOrder } from '../services/tiendanubeService';
import '../components/Chart.css';
import './Analytics.css';
import './TiendanubeVentas.css';

interface MetodoPago { name: string; value: number; porcentaje: number; color: string; }

const PALETTE = [
  '#06b6d4', '#6366f1', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6',
];

const fmtARS = (n: number) =>
  n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

const fmtNum = (n: number) =>
  n.toLocaleString('es-AR', { maximumFractionDigits: 0 });

// ── Tooltips ──────────────────────────────────────────────────────────────────

const DiaTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-label">{label}</p>
      <p className="chart-tooltip-value" style={{ color: '#06b6d4' }}>{fmtARS(payload[0].value)}</p>
    </div>
  );
};

const MetodoTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as MetodoPago;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-label">{d.name}</p>
      <p className="chart-tooltip-value" style={{ color: d.color }}>{d.value} órdenes</p>
      <p className="chart-tooltip-sub">{d.porcentaje}% del total</p>
    </div>
  );
};

const HourTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="chart-tooltip">
        <p className="chart-tooltip-label">{label}</p>
        <p className="chart-tooltip-value" style={{ color: '#06b6d4' }}>{payload[0].value}</p>
        <p className="chart-tooltip-sub">ventas en este horario</p>
      </div>
    );
  }
  return null;
};

const ClientesTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="chart-tooltip">
        <p className="chart-tooltip-label">{payload[0].name}</p>
        <p className="chart-tooltip-value" style={{ color: payload[0].fill }}>{payload[0].value}</p>
        <p className="chart-tooltip-sub">clientes</p>
      </div>
    );
  }
  return null;
};

// ── Orden row ─────────────────────────────────────────────────────────────────

function OrdenRow({ o, i }: { o: TNOrder; i: number }) {
  const fecha = new Date(o.created_at).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
  return (
    <tr>
      <td className="tn-td-num">{i + 1}</td>
      <td className="tn-td-orden">#{o.number}</td>
      <td className="tn-td-cliente">
        <span className="tn-client-name">{o.customer?.name ?? '—'}</span>
        {o.customer?.email && <span className="tn-client-email">{o.customer.email}</span>}
      </td>
      <td className="tn-td-productos">{o.products.map(p => p.name).join(', ') || '—'}</td>
      <td className="tn-td-total">{fmtARS(parseFloat(o.total))}</td>
      <td>
        <span className={`tn-badge ${paymentStatusClass(o.payment_status)}`}>
          {paymentStatusLabel(o.payment_status)}
        </span>
      </td>
      <td className="tn-td-fecha">{fecha}</td>
    </tr>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Analytics() {
  const persisted = getPersistedMetrics();
  const [loading, setLoading]           = useState(!persisted);
  const [syncing, setSyncing]           = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [metrics, setMetrics]           = useState<TNMetrics | null>(persisted);

  const fetchData = async () => {
    const hasCached = !!getPersistedMetrics();
    if (hasCached) setSyncing(true); else setLoading(true);
    try {
      const settings = getSettings();
      const storeId  = settings?.tiendanubeStoreId?.trim() ?? '';
      const token    = settings?.tiendanubeToken?.trim()    ?? '';
      if (!storeId || !token) { setLoading(false); setSyncing(false); return; }
      const data = await fetchTNMetrics(storeId, token);
      setMetrics(data);
    } catch (err) {
      console.error('Error fetching analytics data:', err);
    } finally {
      setLoading(false);
      setSyncing(false);
      setLastRefreshed(new Date());
    }
  };

  useEffect(() => { fetchData(); }, []);

  const metodosConColor: MetodoPago[] = (metrics?.metodosPago ?? []).map((m, i) => ({
    ...m,
    color: PALETTE[i % PALETTE.length],
  }));

  const diasRecientes = metrics?.ventasPorDia.slice(-30) ?? [];

  const top3Horas = [...(metrics?.ventasPorHora ?? [])]
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);

  const totalClientes      = (metrics?.clientesNuevos ?? 0) + (metrics?.clientesRecurrentes ?? 0);
  const pctNuevos          = totalClientes > 0 ? Math.round(((metrics?.clientesNuevos ?? 0) / totalClientes) * 100) : 0;
  const pctRecurrentes     = totalClientes > 0 ? Math.round(((metrics?.clientesRecurrentes ?? 0) / totalClientes) * 100) : 0;
  const clientesPieData    = [
    { name: 'Nuevos',      value: metrics?.clientesNuevos      ?? 0 },
    { name: 'Recurrentes', value: metrics?.clientesRecurrentes ?? 0 },
  ];

  const hasHoras    = (metrics?.ventasPorHora ?? []).some(h => h.value > 0);
  const hasMetodos  = metodosConColor.length > 0;
  const hasClientes = totalClientes > 0;

  const [showRecurrentes, setShowRecurrentes] = useState(false);

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

  return (
    <div className="analytics-page fade-in">

      {/* ── Header ── */}
      <header className="analytics-header">
        <div>
          <h1>Análisis de Ventas</h1>
          <span className="text-muted analytics-meta">
            Últimos 90 días · Actualizado: {lastRefreshed.toLocaleTimeString('es-AR')}
          </span>
        </div>
        <button className="btn-secondary refresh-btn" onClick={fetchData} disabled={loading || syncing}>
          <RefreshCw size={15} className={(loading || syncing) ? 'spinning' : ''} />
          {loading || syncing ? 'Actualizando...' : 'Actualizar'}
        </button>
      </header>

      {/* ══ Facturación diaria ══════════════════════════════════════════════ */}
      <section className="analytics-section">
        <div className="section-title-row">
          <TrendingUp size={18} className="section-icon" />
          <h2>Facturación diaria</h2>
        </div>
        <p className="section-desc">Ingresos diarios de órdenes pagadas (últimos 30 días).</p>
        <div className="chart-container glass-panel analytics-chart-tall">
          <div className="chart-header">
            <div className="chart-header-row">
              <span className="chart-title">Ventas por día</span>
              <span className="chart-badge">ARS</span>
            </div>
          </div>
          {diasRecientes.length > 0 ? (
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={diasRecientes} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="transparent"
                    tick={{ fill: '#475569', fontSize: 10, fontFamily: 'Nunito, Inter, sans-serif' }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="transparent"
                    tick={{ fill: '#475569', fontSize: 10, fontFamily: 'Nunito, Inter, sans-serif' }}
                    tickLine={false}
                    axisLine={false}
                    width={60}
                    tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<DiaTooltip />} cursor={{ fill: 'rgba(6,182,212,0.06)' }} />
                  <Bar dataKey="value" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="chart-empty">
              <span>{loading ? 'Cargando...' : 'Sin datos en este período'}</span>
            </div>
          )}
        </div>
      </section>

      {/* ══ Métodos de pago + Clientes ══════════════════════════════════════ */}
      <div className="analytics-two-col">

        {/* ── Métodos de Pago ── */}
        <section className="analytics-section">
          <div className="section-title-row">
            <ShoppingCart size={18} className="section-icon" />
            <h2>Métodos de pago</h2>
          </div>
          <p className="section-desc">Distribución de medios de pago en órdenes pagadas.</p>
          <div className="chart-container glass-panel analytics-chart-pie">
            <div className="chart-header">
              <div className="chart-header-row">
                <span className="chart-title">Medios de pago</span>
                <span className="chart-badge">Órdenes</span>
              </div>
              <span className="chart-subtitle">% de ventas por método</span>
            </div>
            {hasMetodos ? (
              <>
                <div className="chart-wrapper">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={metodosConColor}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        dataKey="value"
                        paddingAngle={3}
                      >
                        {metodosConColor.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<MetodoTooltip />} />
                      <Legend
                        formatter={(value) => (
                          <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>{value}</span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="metodos-list">
                  {metodosConColor.map((m, i) => (
                    <div key={m.name} className="metodo-row">
                      <span className="metodo-dot" style={{ background: PALETTE[i % PALETTE.length] }} />
                      <span className="metodo-name">{m.name}</span>
                      <span className="metodo-pct">{m.porcentaje}%</span>
                      <span className="metodo-count">{m.value} ventas</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="chart-empty">
                <span>{loading ? 'Cargando...' : 'Sin datos de método de pago'}</span>
              </div>
            )}
          </div>
        </section>

        {/* ── Clientes Nuevos vs Recurrentes ── */}
        <section className="analytics-section">
          <div className="section-title-row">
            <Users size={18} className="section-icon" />
            <h2>Clientes nuevos vs recurrentes</h2>
          </div>
          <p className="section-desc">Clientes que compraron una sola vez (nuevos) vs. más de una vez (recurrentes).</p>
          <div className="chart-container glass-panel analytics-chart-pie">
            <div className="chart-header">
              <div className="chart-header-row">
                <span className="chart-title">Fidelización de clientes</span>
                <span className="chart-badge">Clientes</span>
              </div>
              <span className="chart-subtitle">Basado en frecuencia de compra por email</span>
            </div>
            {hasClientes ? (
              <>
                <div className="clientes-stats-row">
                  <div className="cliente-stat-card">
                    <UserPlus size={20} className="cliente-stat-icon nuevos" />
                    <span className="cliente-stat-num">{metrics?.clientesNuevos ?? 0}</span>
                    <span className="cliente-stat-label">Nuevos</span>
                    <span className="cliente-stat-pct nuevos-pct">{pctNuevos}%</span>
                  </div>
                  <div
                    className="cliente-stat-card cliente-stat-card--clickable"
                    onClick={() => setShowRecurrentes(true)}
                    title="Ver lista de clientes recurrentes"
                    style={{ cursor: 'pointer' }}
                  >
                    <UserCheck size={20} className="cliente-stat-icon recurrentes" />
                    <span className="cliente-stat-num">{metrics?.clientesRecurrentes ?? 0}</span>
                    <span className="cliente-stat-label">Recurrentes</span>
                    <span className="cliente-stat-pct recurrentes-pct">{pctRecurrentes}%</span>
                    <span style={{ fontSize: '0.62rem', color: 'var(--accent-primary)', marginTop: '0.1rem' }}>Ver lista →</span>
                  </div>
                </div>
                <div className="chart-wrapper clientes-pie-wrapper">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={clientesPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={72}
                        dataKey="value"
                        paddingAngle={4}
                      >
                        <Cell fill="#10b981" />
                        <Cell fill="#06b6d4" />
                      </Pie>
                      <Tooltip content={<ClientesTooltip />} />
                      <Legend
                        formatter={(value) => (
                          <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>{value}</span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : (
              <div className="chart-empty">
                <span>{loading ? 'Cargando...' : 'Sin datos de clientes disponibles'}</span>
              </div>
            )}
          </div>
        </section>

      </div>

      {/* ══ Ventas por hora ═════════════════════════════════════════════════ */}
      <section className="analytics-section">
        <div className="section-title-row">
          <Clock size={18} className="section-icon" />
          <h2>Ventas por hora del día</h2>
        </div>
        <p className="section-desc">Distribución de compras según la hora en que ocurrieron (0–23 hs).</p>
        <div className="chart-container glass-panel analytics-chart-tall">
          <div className="chart-header">
            <div className="chart-header-row">
              <span className="chart-title">Compras por franja horaria</span>
              <span className="chart-badge">Horario</span>
            </div>
            <span className="chart-subtitle">Cantidad de ventas registradas por hora del día</span>
          </div>
          {hasHoras ? (
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics?.ventasPorHora} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="transparent"
                    tick={{ fill: '#475569', fontSize: 10, fontFamily: 'Nunito, Inter, sans-serif' }}
                    tickLine={false}
                    axisLine={false}
                    interval={1}
                  />
                  <YAxis
                    allowDecimals={false}
                    stroke="transparent"
                    tick={{ fill: '#475569', fontSize: 11, fontFamily: 'Nunito, Inter, sans-serif' }}
                    tickLine={false}
                    axisLine={false}
                    width={32}
                  />
                  <Tooltip content={<HourTooltip />} cursor={{ fill: 'rgba(6,182,212,0.06)' }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {(metrics?.ventasPorHora ?? []).map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={top3Horas.some(t => t.name === entry.name) ? '#06b6d4' : 'rgba(6,182,212,0.3)'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="chart-empty">
              <span>{loading ? 'Cargando...' : 'Sin datos disponibles'}</span>
            </div>
          )}
        </div>
        {top3Horas.length > 0 && top3Horas[0].value > 0 && (
          <div className="top-horas-grid">
            {top3Horas.map((h, i) => (
              <div key={h.name} className={`top-hora-card glass-panel top-hora-pos-${i + 1}`}>
                <span className="top-hora-badge">#{i + 1}</span>
                <span className="top-hora-time">{h.name}</span>
                <span className="top-hora-count">{h.value} <span className="top-hora-label">ventas</span></span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ══ Top productos ═══════════════════════════════════════════════════ */}
      {metrics && metrics.topProductos.length > 0 && (
        <section className="analytics-section">
          <div className="section-title-row">
            <Trophy size={18} className="section-icon" />
            <h2>Top productos vendidos</h2>
          </div>
          <p className="section-desc">Por cantidad de unidades en órdenes pagadas (últimos 90 días).</p>
          <div className="tn-productos-grid glass-panel">
            {metrics.topProductos.map((p, i) => (
              <div key={p.nombre} className="tn-producto-row">
                <span className="tn-producto-rank">#{i + 1}</span>
                <span className="tn-producto-nombre">{p.nombre}</span>
                <span className="tn-producto-cant">{fmtNum(p.cantidad)} u.</span>
                <span className="tn-producto-total">{fmtARS(p.total)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ══ Últimas órdenes ═════════════════════════════════════════════════ */}
      {metrics && metrics.orders.length > 0 && (
        <section className="analytics-section">
          <div className="section-title-row">
            <Package size={18} className="section-icon" />
            <h2>Últimas órdenes</h2>
          </div>
          <p className="section-desc">
            Órdenes más recientes · {fmtNum(metrics.orders.length)} registros cargados.
          </p>
          <div className="tn-table-wrapper glass-panel">
            <table className="tn-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Orden</th>
                  <th>Cliente</th>
                  <th>Productos</th>
                  <th>Total</th>
                  <th>Pago</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {metrics.orders.map((o, i) => (
                  <OrdenRow key={o.id} o={o} i={i} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ══ Modal: Clientes Recurrentes ══════════════════════════════════════ */}
      {showRecurrentes && (
        <div className="recurrentes-overlay" onClick={() => setShowRecurrentes(false)}>
          <div className="recurrentes-modal glass-panel" onClick={e => e.stopPropagation()}>
            <div className="recurrentes-modal-header">
              <div className="section-title-row" style={{ margin: 0 }}>
                <UserCheck size={18} className="section-icon" />
                <h2 style={{ margin: 0 }}>Clientes recurrentes</h2>
                <span className="chart-badge" style={{ marginLeft: '0.5rem' }}>{recurrentesLista.length}</span>
              </div>
              <button className="rec-close-btn" onClick={() => setShowRecurrentes(false)}>
                <X size={18} />
              </button>
            </div>
            <p className="section-desc" style={{ margin: '0.25rem 0 1rem' }}>
              Clientes con más de una compra en los últimos 90 días, ordenados por cantidad de pedidos.
            </p>
            {recurrentesLista.length === 0 ? (
              <div className="chart-empty"><span>Sin clientes recurrentes en este período</span></div>
            ) : (
              <div className="tn-table-wrapper" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                <table className="tn-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Cliente</th>
                      <th>Email</th>
                      <th>Pedidos</th>
                      <th>Total gastado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recurrentesLista.map((c, i) => (
                      <tr key={c.email || c.nombre}>
                        <td className="tn-td-num">{i + 1}</td>
                        <td className="tn-td-cliente">
                          <span className="tn-client-name">{c.nombre || '—'}</span>
                        </td>
                        <td className="tn-td-cliente">
                          <span className="tn-client-email">{c.email || '—'}</span>
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{c.pedidos}</td>
                        <td className="tn-td-total">{fmtARS(c.total)}</td>
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
