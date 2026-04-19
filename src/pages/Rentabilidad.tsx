import { useState, useEffect, useCallback } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, RefreshCw, DollarSign, TrendingDown, Package, BarChart2, Target, Percent } from 'lucide-react';
import MetricCard from '../components/MetricCard';
import { getSettings } from '../services/dataService';
import { fetchTNMetrics } from '../services/tiendanubeService';
import type { TNOrder } from '../services/tiendanubeService';
import {
  fetchRentabilidadRange,
  fetchUSDTPrice,
  getRangeForPeriodo,
  todayARISO,
} from '../services/rentabilidadService';
import type { DiaRentabilidad, ResumenRentabilidad } from '../services/rentabilidadService';
import '../components/Chart.css';
import './Rentabilidad.css';

type Periodo = 'diario' | 'semanal' | 'mensual';

const fmtARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

const fmtARSShort = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000)     return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
};

// ── Tooltip ───────────────────────────────────────────────────────────────────

const RentTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as DiaRentabilidad;
  if (!d) return null;
  return (
    <div className="chart-tooltip rent-tooltip">
      <p className="chart-tooltip-label">{label}</p>
      <div className="rent-tooltip-grid">
        <span style={{ color: '#06b6d4' }}>Facturado</span>
        <span>{fmtARS(d.facturado)}</span>
        <span style={{ color: d.gananciaNeta >= 0 ? '#10b981' : '#ef4444' }}>Ganancia</span>
        <span style={{ color: d.gananciaNeta >= 0 ? '#10b981' : '#ef4444' }}>{fmtARS(d.gananciaNeta)}</span>
        <span style={{ color: '#f59e0b' }}>Meta (ARS)</span>
        <span>{fmtARS(d.inversionMetaARS)}</span>
        <span style={{ color: '#8b5cf6' }}>Mercadería</span>
        <span>{fmtARS(d.costoMercaderia)}</span>
        <span style={{ color: '#64748b' }}>Envío+Agencia</span>
        <span>{fmtARS(d.costoEnvio + d.costoAgencia)}</span>
        <span style={{ color: '#f97316' }}>Comisión</span>
        <span>{fmtARS(d.costoComision)}</span>
        <span>Promos</span>
        <span>{d.totalPromos} ({d.promoA}A + {d.promoB}B)</span>
        <span>Margen</span>
        <span>{d.margenPct.toFixed(1)}%</span>
      </div>
    </div>
  );
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function Rentabilidad() {
  const [periodo, setPeriodo]               = useState<Periodo>('diario');
  const [fecha, setFecha]                   = useState(todayARISO());
  const [dias, setDias]                     = useState<DiaRentabilidad[]>([]);
  const [resumen, setResumen]               = useState<ResumenRentabilidad | null>(null);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState<string | null>(null);
  const [metaError, setMetaError]           = useState(false);
  const [usdtPrice, setUsdtPrice]           = useState(0);
  const [usdtError, setUsdtError]           = useState(false);
  const [orders, setOrders]                 = useState<TNOrder[]>([]);

  const loadData = useCallback(async (currentOrders: TNOrder[], price: number, per: Periodo, f: string) => {
    setLoading(true);
    setError(null);
    try {
      const { since, until } = getRangeForPeriodo(per, f);
      const { dias: d, resumen: r, metaError: me } = await fetchRentabilidadRange(currentOrders, since, until, price);
      setDias(d);
      setResumen(r);
      setMetaError(me);
    } catch (e: any) {
      setError(e?.message ?? 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, []);

  const init = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ price }, metrics] = await Promise.all([
        fetchUSDTPrice(),
        fetchTNMetrics(getSettings().tiendanubeStoreId, getSettings().tiendanubeToken),
      ]);
      setUsdtPrice(price);
      setUsdtError(price === 0);
      setOrders(metrics.orders);
      const { since, until } = getRangeForPeriodo(periodo, fecha);
      const { dias: d, resumen: r, metaError: me } = await fetchRentabilidadRange(metrics.orders, since, until, price);
      setDias(d);
      setResumen(r);
      setMetaError(me);
    } catch (e: any) {
      setError(e?.message ?? 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (orders.length === 0) return;
    loadData(orders, usdtPrice, periodo, fecha);
  }, [periodo, fecha]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ price }, metrics] = await Promise.all([
        fetchUSDTPrice(),
        fetchTNMetrics(getSettings().tiendanubeStoreId, getSettings().tiendanubeToken, undefined, true),
      ]);
      setUsdtPrice(price);
      setUsdtError(price === 0);
      setOrders(metrics.orders);
      const { since, until } = getRangeForPeriodo(periodo, fecha);
      const { dias: d, resumen: r, metaError: me } = await fetchRentabilidadRange(metrics.orders, since, until, price);
      setDias(d);
      setResumen(r);
      setMetaError(me);
    } catch (e: any) {
      setError(e?.message ?? 'Error al recargar');
    } finally {
      setLoading(false);
    }
  };

  // ── Render helpers ──────────────────────────────────────────────────────────

  const roasColor = (v: number) => v >= 2 ? 'var(--accent-success)' : v >= 1 ? 'var(--accent-warning)' : 'var(--accent-danger)';
  const gananciaColor = (v: number) => v > 0 ? 'var(--accent-success)' : v < 0 ? 'var(--accent-danger)' : 'var(--accent-warning)';

  const chartData = dias.map(d => ({
    ...d,
    name: d.fecha.slice(0, 5),
    costosMerch:   d.costoMercaderia,
    costosEnvio:   d.costoEnvio + d.costoAgencia,
    costosMeta:    d.inversionMetaARS,
    gananciaNeta:  d.gananciaNeta,
    facturado:     d.facturado,
  }));

  return (
    <div className="rent-page">

      {/* ── Header ── */}
      <div className="rent-header">
        <div className="rent-header-left">
          <div className="rent-title-row">
            <TrendingUp size={22} className="rent-title-icon" />
            <h1>Rentabilidad</h1>
          </div>
          <div className="rent-period-tabs">
            {(['diario', 'semanal', 'mensual'] as Periodo[]).map(p => (
              <button
                key={p}
                className={`rent-tab ${periodo === p ? 'active' : ''}`}
                onClick={() => setPeriodo(p)}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="rent-header-right">
          {usdtError ? (
            <span className="rent-badge rent-badge-error">Sin cotización</span>
          ) : usdtPrice > 0 ? (
            <span className="rent-badge">USDT {fmtARS(usdtPrice)}</span>
          ) : null}
          <input
            type="date"
            className="rent-date-input"
            value={fecha}
            max={todayARISO()}
            onChange={e => setFecha(e.target.value)}
          />
          <button className="rent-refresh-btn" onClick={handleRefresh} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
          </button>
        </div>
      </div>

      {/* ── Meta error warning ── */}
      {metaError && (
        <div className="rent-warning">
          ⚠️ Meta Ads no disponible — verificar token en Configuración. Mostrando inversión Meta en $0.
        </div>
      )}

      {/* ── Error principal ── */}
      {error && (
        <div className="rent-error-card glass-panel">
          <p>{error}</p>
          <button className="rent-retry-btn" onClick={handleRefresh}>Reintentar</button>
        </div>
      )}

      {/* ── Cards de resumen ── */}
      {loading ? (
        <div className="rent-cards-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="metric-card glass-panel rent-skeleton" />
          ))}
        </div>
      ) : resumen && (
        <div className="rent-cards-grid">
          <MetricCard
            title="Facturado"
            value={fmtARS(resumen.facturadoTotal)}
            icon={<DollarSign size={18} />}
            subtitle={`${resumen.totalPromos} promos (${resumen.promoATotal}×A + ${resumen.promoBTotal}×B)`}
          />
          <div className="metric-card glass-panel" style={{ borderLeftColor: gananciaColor(resumen.gananciaNeta) }}>
            <div className="metric-header">
              <h3 className="metric-title">Ganancia Neta</h3>
              <div className="metric-icon" style={{ background: 'rgba(16,185,129,0.1)', color: gananciaColor(resumen.gananciaNeta) }}>
                {resumen.gananciaNeta >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
              </div>
            </div>
            <div className="metric-body">
              <div className="metric-value" style={{ color: gananciaColor(resumen.gananciaNeta) }}>
                {fmtARS(resumen.gananciaNeta)}
              </div>
              <div className="metric-subtitle">Margen {resumen.margenPct.toFixed(1)}%</div>
            </div>
          </div>
          <MetricCard
            title="Inversión Meta"
            value={fmtARS(resumen.inversionMetaARSTotal)}
            icon={<BarChart2 size={18} />}
            subtitle={`USD ${resumen.inversionMetaUSDTotal.toFixed(2)}`}
          />
          <MetricCard
            title="Costo Total"
            value={fmtARS(resumen.totalCostosTotal)}
            icon={<Package size={18} />}
            subtitle={`Merc. ${fmtARSShort(resumen.costoMercaderiaTotal)} | Envío ${fmtARSShort(resumen.costoEnvioTotal)} | Ag. ${fmtARSShort(resumen.costoAgenciaTotal)} | Com. ${fmtARSShort(resumen.costoComisionTotal)}`}
          />
          <div className="metric-card glass-panel" style={{ borderLeftColor: roasColor(resumen.roasPromedio) }}>
            <div className="metric-header">
              <h3 className="metric-title">ROAS</h3>
              <div className="metric-icon" style={{ background: 'rgba(99,102,241,0.1)', color: roasColor(resumen.roasPromedio) }}>
                <Target size={18} />
              </div>
            </div>
            <div className="metric-body">
              <div className="metric-value" style={{ color: roasColor(resumen.roasPromedio) }}>
                {resumen.roasPromedio.toFixed(2)}x
              </div>
              <div className="metric-subtitle">retorno sobre inversión Meta</div>
            </div>
          </div>
          <MetricCard
            title="CPA"
            value={fmtARS(resumen.cpaPromedio)}
            icon={<Percent size={18} />}
            subtitle="por promo vendida"
          />
        </div>
      )}

      {/* ── Gráfico ── */}
      {!loading && dias.length > 0 && (
        <div className="glass-panel rent-chart-panel">
          <div className="chart-header">
            <div className="chart-header-row">
              <span className="chart-title">Facturado vs Costos por día</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <YAxis tickFormatter={fmtARSShort} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} width={72} />
              <Tooltip content={<RentTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)' }} />
              <Bar dataKey="costosMerch"   name="Mercadería"    stackId="costos" fill="#8b5cf6" />
              <Bar dataKey="costosEnvio"   name="Envío+Agencia" stackId="costos" fill="#64748b" />
              <Bar dataKey="costosMeta"    name="Meta Ads"      stackId="costos" fill="#f59e0b" />
              <Bar dataKey="gananciaNeta"  name="Ganancia Neta" fill="#10b981" opacity={0.85} />
              <Line dataKey="facturado"    name="Facturado"     type="monotone" stroke="#06b6d4" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Tabla ── */}
      {!loading && dias.length > 0 && (
        <div className="glass-panel rent-table-panel">
          <div className="rent-table-scroll">
            <table className="rent-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Promo A</th>
                  <th>Promo B</th>
                  <th>Total</th>
                  <th>Facturado</th>
                  <th>Costo Merc.</th>
                  <th>Envío</th>
                  <th>Agencia</th>
                  <th>Comisión</th>
                  <th>Meta (ARS)</th>
                  <th>Total Costos</th>
                  <th>Ganancia</th>
                  <th>Margen %</th>
                </tr>
              </thead>
              <tbody>
                {dias.map(d => (
                  <tr key={d.fechaISO}>
                    <td className="rent-td-fecha">{d.fecha.slice(0, 5)}</td>
                    <td>{d.promoA}</td>
                    <td>{d.promoB}</td>
                    <td>{d.totalPromos}</td>
                    <td>{fmtARS(d.facturado)}</td>
                    <td>{fmtARS(d.costoMercaderia)}</td>
                    <td>{fmtARS(d.costoEnvio)}</td>
                    <td>{fmtARS(d.costoAgencia)}</td>
                    <td>{fmtARS(d.costoComision)}</td>
                    <td>{fmtARS(d.inversionMetaARS)}</td>
                    <td>{fmtARS(d.totalCostos)}</td>
                    <td style={{ color: gananciaColor(d.gananciaNeta) }}>{fmtARS(d.gananciaNeta)}</td>
                    <td style={{ color: gananciaColor(d.gananciaNeta) }}>{d.margenPct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
              {dias.length > 1 && resumen && (
                <tfoot>
                  <tr className="rent-tfoot-row">
                    <td>Total</td>
                    <td>{resumen.promoATotal}</td>
                    <td>{resumen.promoBTotal}</td>
                    <td>{resumen.totalPromos}</td>
                    <td>{fmtARS(resumen.facturadoTotal)}</td>
                    <td>{fmtARS(resumen.costoMercaderiaTotal)}</td>
                    <td>{fmtARS(resumen.costoEnvioTotal)}</td>
                    <td>{fmtARS(resumen.costoAgenciaTotal)}</td>
                    <td>{fmtARS(resumen.costoComisionTotal)}</td>
                    <td>{fmtARS(resumen.inversionMetaARSTotal)}</td>
                    <td>{fmtARS(resumen.totalCostosTotal)}</td>
                    <td style={{ color: gananciaColor(resumen.gananciaNeta) }}>{fmtARS(resumen.gananciaNeta)}</td>
                    <td style={{ color: gananciaColor(resumen.gananciaNeta) }}>{resumen.margenPct.toFixed(1)}%</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
