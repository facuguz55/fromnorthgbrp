import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { RefreshCw, Clock, CreditCard, Users, UserCheck, UserPlus } from 'lucide-react';
import { getSettings } from '../services/dataService';
import { fetchTNMetrics } from '../services/tiendanubeService';

interface MetodoPago { name: string; value: number; porcentaje: number; }
import '../components/Chart.css';
import './Analytics.css';

const PIE_COLORS = ['#06b6d4', '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

// ── Tooltips ──────────────────────────────────────────────────────────────────

const HourTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="chart-tooltip">
        <p className="chart-tooltip-label">{label}</p>
        <p className="chart-tooltip-value" style={{ color: '#06b6d4' }}>
          {payload[0].value}
        </p>
        <p className="chart-tooltip-sub">ventas en este horario</p>
      </div>
    );
  }
  return null;
};

const PagoTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload as MetodoPago;
    return (
      <div className="chart-tooltip">
        <p className="chart-tooltip-label">{d.name}</p>
        <p className="chart-tooltip-value" style={{ color: payload[0].fill }}>
          {d.value} ventas
        </p>
        <p className="chart-tooltip-sub">{d.porcentaje}% del total</p>
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
        <p className="chart-tooltip-value" style={{ color: payload[0].fill }}>
          {payload[0].value}
        </p>
        <p className="chart-tooltip-sub">clientes</p>
      </div>
    );
  }
  return null;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [data, setData] = useState({
    ventasPorHora: [] as { name: string; value: number }[],
    ventasPorDia:  [] as { name: string; value: number }[],
    metodosPago:   [] as MetodoPago[],
    clientesNuevos: 0,
    clientesRecurrentes: 0,
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const settings = getSettings();
      const storeId  = settings?.tiendanubeStoreId?.trim() ?? '';
      const token    = settings?.tiendanubeToken?.trim()    ?? '';
      if (!storeId || !token) return;
      const fetched = await fetchTNMetrics(storeId, token);
      setData({
        ventasPorHora:       fetched.ventasPorHora,
        ventasPorDia:        fetched.ventasPorDia,
        metodosPago:         fetched.metodosPago,
        clientesNuevos:      fetched.clientesNuevos,
        clientesRecurrentes: fetched.clientesRecurrentes,
      });
    } catch (err) {
      console.error('Error fetching analytics data:', err);
    } finally {
      setLoading(false);
      setLastRefreshed(new Date());
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Top 3 horas con más ventas
  const top3Horas = [...data.ventasPorHora]
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);

  const totalClientes = data.clientesNuevos + data.clientesRecurrentes;
  const pctNuevos      = totalClientes > 0 ? Math.round((data.clientesNuevos / totalClientes) * 100) : 0;
  const pctRecurrentes = totalClientes > 0 ? Math.round((data.clientesRecurrentes / totalClientes) * 100) : 0;

  const clientesPieData = [
    { name: 'Nuevos',      value: data.clientesNuevos },
    { name: 'Recurrentes', value: data.clientesRecurrentes },
  ];

  const hasHoras    = data.ventasPorHora.some(h => h.value > 0);
  const hasMetodos  = data.metodosPago.length > 0;
  const hasClientes = totalClientes > 0;

  return (
    <div className="analytics-page fade-in">

      {/* ── Header ── */}
      <header className="analytics-header">
        <div>
          <h1>Análisis de Ventas</h1>
          <span className="text-muted analytics-meta">
            Actualizado: {lastRefreshed.toLocaleTimeString('es-AR')}
          </span>
        </div>
        <button className="btn-secondary refresh-btn" onClick={fetchData} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spinning' : ''} />
          {loading ? 'Actualizando...' : 'Actualizar'}
        </button>
      </header>

      {/* ══ SECCIÓN 1: Ventas por Hora ══════════════════════════════════════ */}
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
                <BarChart data={data.ventasPorHora} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
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
                    {data.ventasPorHora.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          top3Horas.some(t => t.name === entry.name)
                            ? '#06b6d4'
                            : 'rgba(6,182,212,0.3)'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="chart-empty">
              <span>Sin datos disponibles — verificá que la columna "fecha" incluya hora</span>
            </div>
          )}
        </div>

        {/* Top 3 horas */}
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

      {/* ══ SECCIÓN 2 + 3: dos columnas ════════════════════════════════════ */}
      <div className="analytics-two-col">

        {/* ── Métodos de Pago ── */}
        <section className="analytics-section">
          <div className="section-title-row">
            <CreditCard size={18} className="section-icon" />
            <h2>Métodos de pago</h2>
          </div>
          <p className="section-desc">Distribución porcentual de los métodos de pago utilizados.</p>

          <div className="chart-container glass-panel analytics-chart-pie">
            <div className="chart-header">
              <div className="chart-header-row">
                <span className="chart-title">Distribución de pagos</span>
                <span className="chart-badge">Pagos</span>
              </div>
              <span className="chart-subtitle">% de ventas por método</span>
            </div>
            {hasMetodos ? (
              <>
                <div className="chart-wrapper">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.metodosPago}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        dataKey="value"
                        paddingAngle={3}
                      >
                        {data.metodosPago.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<PagoTooltip />} />
                      <Legend
                        formatter={(value) => (
                          <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>{value}</span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="metodos-list">
                  {data.metodosPago.map((m, i) => (
                    <div key={m.name} className="metodo-row">
                      <span className="metodo-dot" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="metodo-name">{m.name}</span>
                      <span className="metodo-pct">{m.porcentaje}%</span>
                      <span className="metodo-count">{m.value} ventas</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="chart-empty">
                <span>Sin datos de método de pago</span>
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
                    <span className="cliente-stat-num">{data.clientesNuevos}</span>
                    <span className="cliente-stat-label">Nuevos</span>
                    <span className="cliente-stat-pct nuevos-pct">{pctNuevos}%</span>
                  </div>
                  <div className="cliente-stat-card">
                    <UserCheck size={20} className="cliente-stat-icon recurrentes" />
                    <span className="cliente-stat-num">{data.clientesRecurrentes}</span>
                    <span className="cliente-stat-label">Recurrentes</span>
                    <span className="cliente-stat-pct recurrentes-pct">{pctRecurrentes}%</span>
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
                <span>Sin datos de clientes disponibles</span>
              </div>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}
