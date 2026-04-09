import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, RefreshCw,
  DollarSign, Target, Percent, Save, ChevronDown, ChevronUp,
} from 'lucide-react';
import MetricCard from '../components/MetricCard';
import { getSettings, META_ACCOUNTS } from '../services/dataService';
import { fetchTNMetrics } from '../services/tiendanubeService';
import type { TNOrder } from '../services/tiendanubeService';
import { fetchMetaInsightsByDateRange } from '../services/metaAdsService';
import {
  fetchUSDTPrice,
  getRangeForPeriodo,
  todayARISO,
} from '../services/rentabilidadService';
import { getProductCosts, upsertProductCost } from '../services/productCostService';
import type { ProductCost } from '../services/productCostService';
import './Rentabilidad.css';
import './RentabilidadProductos.css';

type Periodo = 'diario' | 'semanal' | 'mensual';

const AR_OFFSET = -3 * 60 * 60 * 1000;

const fmtARS = (n: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n);

// ── Types ──────────────────────────────────────────────────────────────────────

interface ProductData {
  nombre: string;
  unidades: number;
  facturado: number;
  precioPromedio: number;
}

interface ProductRow {
  nombre: string;
  unidades: number;
  facturado: number;
  precioPromedio: number;
  costoMercaderiaTotal: number;
  costoEmpaqueTotal: number;
  costoEnvioTotal: number;
  costoAgenciaTotal: number;
  inversionMetaARS: number;
  costoTotal: number;
  gananciaNeta: number;
  margenPct: number;
  roas: number;
  cpa: number;
}

// ── Pure helpers ───────────────────────────────────────────────────────────────

function computeProductsInRange(
  orders: TNOrder[],
  since: string,
  until: string,
): ProductData[] {
  const [sy, sm, sd] = since.split('-').map(Number);
  const [uy, um, ud] = until.split('-').map(Number);
  const startUTC = Date.UTC(sy, sm - 1, sd) - AR_OFFSET;
  const endUTC   = Date.UTC(uy, um - 1, ud) - AR_OFFSET + 86_400_000;

  const map = new Map<string, { unidades: number; facturado: number }>();

  for (const order of orders) {
    if (order.payment_status !== 'paid' && order.payment_status !== 'authorized') continue;
    const ts = new Date(order.created_at).getTime();
    if (ts < startUTC || ts >= endUTC) continue;

    for (const p of order.products) {
      const cur = map.get(p.name) ?? { unidades: 0, facturado: 0 };
      cur.unidades += p.quantity;
      cur.facturado += parseFloat(p.price) * p.quantity;
      map.set(p.name, cur);
    }
  }

  return Array.from(map.entries())
    .map(([nombre, { unidades, facturado }]) => ({
      nombre,
      unidades,
      facturado,
      precioPromedio: unidades > 0 ? facturado / unidades : 0,
    }))
    .sort((a, b) => b.facturado - a.facturado);
}

// Retorna totalARS (suma ya convertida a ARS según moneda de cada cuenta)
// y totalUSD (equivalente aproximado: totalARS / usdtPrice).
async function fetchMetaTotalInRange(
  since: string,
  until: string,
  usdtPrice: number,
): Promise<{ ars: number; usd: number; error: boolean }> {
  const settings = getSettings();
  const token    = settings.metaAccessToken.trim();
  if (!token) return { ars: 0, usd: 0, error: false };

  let totalARS = 0;
  let error    = false;

  await Promise.all(
    META_ACCOUNTS.map(async acct => {
      const accountId = (settings[acct.settingsKey] as string).trim();
      if (!accountId) return;
      try {
        console.log('[RentabilidadProductos] fetchMetaInsightsByDateRange', { acct: acct.key, since, until, currency: acct.currency });
        const insights = await fetchMetaInsightsByDateRange(token, accountId, since, until);
        console.log('[RentabilidadProductos] insights recibidos', {
          acct: acct.key,
          rows: insights.length,
          fechas: [...new Set(insights.map(i => i.date_start))].sort(),
          totalSpend: insights.reduce((s, i) => s + i.spend, 0),
          currency: acct.currency,
        });
        for (const ins of insights) {
          const arsValue = acct.currency === 'USD'
            ? ins.spend * usdtPrice
            : ins.spend;
          totalARS += arsValue;
        }
      } catch {
        error = true;
      }
    }),
  );

  const usd = usdtPrice > 0 ? totalARS / usdtPrice : 0;
  return { ars: totalARS, usd, error };
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function RentabilidadProductos() {
  const [periodo, setPeriodo]           = useState<Periodo>('diario');
  const [fecha, setFecha]               = useState(todayARISO());
  const [orders, setOrders]             = useState<TNOrder[]>([]);
  const [productCosts, setProductCosts] = useState<ProductCost[]>([]);
  const [editableRows, setEditableRows] = useState<Record<string, ProductCost>>({});
  const [savingProduct, setSavingProduct] = useState<string | null>(null);
  const [productsInRange, setProductsInRange] = useState<ProductData[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [metaError, setMetaError]       = useState(false);
  const [usdtPrice, setUsdtPrice]       = useState(0);
  const [usdtError, setUsdtError]       = useState(false);
  const [totalMetaARS, setTotalMetaARS] = useState(0);
  const [totalMetaUSD, setTotalMetaUSD] = useState(0);

  // ── Core range computation ────────────────────────────────────────────────────

  const computeAndSetRange = useCallback(async (
    currentOrders: TNOrder[],
    costs: ProductCost[],
    price: number,
    per: Periodo,
    f: string,
  ): Promise<ProductData[]> => {
    const { since, until } = getRangeForPeriodo(per, f);
    const products = computeProductsInRange(currentOrders, since, until);

    setProductsInRange(products);

    setEditableRows(prev => {
      const rows = { ...prev };
      for (const p of products) {
        if (!rows[p.nombre]) {
          const saved = costs.find(c => c.product_name === p.nombre);
          rows[p.nombre] = saved ?? {
            product_name: p.nombre,
            costo_compra: 0,
            costo_empaque: 0,
            costo_envio: 0,
            costo_agencia: 0,
          };
        }
      }
      return rows;
    });

    try {
      const { ars, usd, error: me } = await fetchMetaTotalInRange(since, until, price);
      setTotalMetaARS(ars);
      setTotalMetaUSD(usd);
      setMetaError(me);
    } catch {
      setMetaError(true);
    }

    return products;
  }, []);

  // ── Init ─────────────────────────────────────────────────────────────────────

  const init = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ price, error: uErr }, metrics, costs] = await Promise.all([
        fetchUSDTPrice(),
        fetchTNMetrics(getSettings().tiendanubeStoreId, getSettings().tiendanubeToken),
        getProductCosts(),
      ]);
      setUsdtPrice(price);
      setUsdtError(uErr);
      setOrders(metrics.orders);
      setProductCosts(costs);

      const products = await computeAndSetRange(metrics.orders, costs, price, periodo, fecha);

      const withCosts = products
        .filter(p => costs.some(c => c.product_name === p.nombre))
        .map(p => p.nombre);
      setSelectedProducts(
        withCosts.length > 0 ? withCosts : products.slice(0, 5).map(p => p.nombre),
      );
    } catch (e: any) {
      setError(e?.message ?? 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { init(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (orders.length === 0) return;
    computeAndSetRange(orders, productCosts, usdtPrice, periodo, fecha);
  }, [periodo, fecha]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Refresh ───────────────────────────────────────────────────────────────────

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ price, error: uErr }, metrics, costs] = await Promise.all([
        fetchUSDTPrice(),
        fetchTNMetrics(
          getSettings().tiendanubeStoreId,
          getSettings().tiendanubeToken,
          undefined,
          true,
        ),
        getProductCosts(),
      ]);
      setUsdtPrice(price);
      setUsdtError(uErr);
      setOrders(metrics.orders);
      setProductCosts(costs);

      const products = await computeAndSetRange(metrics.orders, costs, price, periodo, fecha);
      const withCosts = products
        .filter(p => costs.some(c => c.product_name === p.nombre))
        .map(p => p.nombre);
      setSelectedProducts(
        withCosts.length > 0 ? withCosts : products.slice(0, 5).map(p => p.nombre),
      );
    } catch (e: any) {
      setError(e?.message ?? 'Error al recargar');
    } finally {
      setLoading(false);
    }
  };

  // ── Editable rows ─────────────────────────────────────────────────────────────

  const handleCostChange = (
    productName: string,
    field: keyof Pick<ProductCost, 'costo_compra' | 'costo_empaque' | 'costo_envio' | 'costo_agencia'>,
    value: string,
  ) => {
    setEditableRows(prev => ({
      ...prev,
      [productName]: {
        ...prev[productName],
        [field]: parseFloat(value) || 0,
      },
    }));
  };

  const handleSave = async (productName: string) => {
    setSavingProduct(productName);
    try {
      const row = editableRows[productName];
      await upsertProductCost(row);
      setProductCosts(prev => {
        const idx = prev.findIndex(c => c.product_name === productName);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = row;
          return updated;
        }
        return [...prev, row];
      });
    } catch (e: any) {
      alert(`Error al guardar: ${e?.message}`);
    } finally {
      setSavingProduct(null);
    }
  };

  const toggleProduct = (name: string) => {
    setSelectedProducts(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name],
    );
  };

  // ── Rentability computation ───────────────────────────────────────────────────

  const selectedData = productsInRange.filter(p => selectedProducts.includes(p.nombre));
  const totalFacuradoSelected = selectedData.reduce((s, p) => s + p.facturado, 0);

  const rentabilityRows: ProductRow[] = selectedData.map(p => {
    const cost              = editableRows[p.nombre];
    const proportion        = totalFacuradoSelected > 0 ? p.facturado / totalFacuradoSelected : 0;
    const inversionMetaARS  = totalMetaARS * proportion;
    const costoMercaderiaTotal = (cost?.costo_compra  ?? 0) * p.unidades;
    const costoEmpaqueTotal    = (cost?.costo_empaque ?? 0) * p.unidades;
    const costoEnvioTotal      = (cost?.costo_envio   ?? 0) * p.unidades;
    const costoAgenciaTotal    = (cost?.costo_agencia ?? 0) * p.unidades;
    const costoTotal    = costoMercaderiaTotal + costoEmpaqueTotal + costoEnvioTotal + costoAgenciaTotal + inversionMetaARS;
    const gananciaNeta  = p.facturado - costoTotal;
    const margenPct     = p.facturado > 0 ? (gananciaNeta / p.facturado) * 100 : 0;
    const roas          = inversionMetaARS > 0 ? p.facturado / inversionMetaARS : 0;
    const cpa           = p.unidades > 0 ? inversionMetaARS / p.unidades : 0;

    return {
      nombre: p.nombre,
      unidades: p.unidades,
      facturado: p.facturado,
      precioPromedio: p.precioPromedio,
      costoMercaderiaTotal,
      costoEmpaqueTotal,
      costoEnvioTotal,
      costoAgenciaTotal,
      inversionMetaARS,
      costoTotal,
      gananciaNeta,
      margenPct,
      roas,
      cpa,
    };
  });

  const totalFact      = rentabilityRows.reduce((s, r) => s + r.facturado, 0);
  const totalGanancia  = rentabilityRows.reduce((s, r) => s + r.gananciaNeta, 0);
  const totalMeta      = rentabilityRows.reduce((s, r) => s + r.inversionMetaARS, 0);
  const totalCosto     = rentabilityRows.reduce((s, r) => s + r.costoTotal, 0);
  const totalUnidades  = rentabilityRows.reduce((s, r) => s + r.unidades, 0);
  const roasPromedio   = totalMeta > 0 ? totalFact / totalMeta : 0;
  const cpaPromedio    = totalUnidades > 0 ? totalMeta / totalUnidades : 0;
  const margenTotal    = totalFact > 0 ? (totalGanancia / totalFact) * 100 : 0;

  const metaActivo     = totalMetaARS > 0;

  // ── Color helpers ─────────────────────────────────────────────────────────────

  const gananciaColor = (v: number) =>
    v > 0 ? 'var(--accent-success)' : v < 0 ? 'var(--accent-danger)' : 'var(--accent-warning)';
  const roasColor = (v: number) =>
    v >= 2 ? 'var(--accent-success)' : v >= 1 ? 'var(--accent-warning)' : 'var(--accent-danger)';

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="rent-page">

      {/* Header */}
      <div className="rent-header">
        <div className="rent-header-left">
          <div className="rent-title-row">
            <TrendingUp size={22} className="rent-title-icon" />
            <h1>Rentabilidad por Producto</h1>
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

      {metaError && (
        <div className="rent-warning">
          ⚠️ Meta Ads no disponible — verificar token en Configuración. Mostrando inversión Meta en $0.
        </div>
      )}

      {error && (
        <div className="rent-error-card glass-panel">
          <p>{error}</p>
          <button className="rent-retry-btn" onClick={handleRefresh}>Reintentar</button>
        </div>
      )}

      {/* Cards de resumen */}
      {loading ? (
        <div className="rent-cards-grid">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="metric-card glass-panel rent-skeleton" />
          ))}
        </div>
      ) : (
        <div className="rent-cards-grid">
          <MetricCard
            title="Facturado"
            value={fmtARS(totalFact)}
            icon={<DollarSign size={18} />}
            subtitle={`${totalUnidades} unidades vendidas`}
          />
          <div
            className="metric-card glass-panel"
            style={{ borderLeftColor: gananciaColor(totalGanancia) }}
          >
            <div className="metric-header">
              <h3 className="metric-title">Ganancia Neta</h3>
              <div
                className="metric-icon"
                style={{
                  background: 'rgba(16,185,129,0.1)',
                  color: gananciaColor(totalGanancia),
                }}
              >
                {totalGanancia >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
              </div>
            </div>
            <div className="metric-body">
              <div className="metric-value" style={{ color: gananciaColor(totalGanancia) }}>
                {fmtARS(totalGanancia)}
              </div>
              <div className="metric-subtitle">Margen {margenTotal.toFixed(1)}%</div>
            </div>
          </div>
          <div
            className="metric-card glass-panel"
            style={{ borderLeftColor: roasColor(roasPromedio) }}
          >
            <div className="metric-header">
              <h3 className="metric-title">ROAS</h3>
              <div
                className="metric-icon"
                style={{ background: 'rgba(99,102,241,0.1)', color: roasColor(roasPromedio) }}
              >
                <Target size={18} />
              </div>
            </div>
            <div className="metric-body">
              <div className="metric-value" style={{ color: roasColor(roasPromedio) }}>
                {metaActivo ? `${roasPromedio.toFixed(2)}x` : 'N/A'}
              </div>
              <div className="metric-subtitle">retorno sobre inversión Meta</div>
            </div>
          </div>
          <MetricCard
            title="CPA"
            value={metaActivo ? fmtARS(cpaPromedio) : 'N/A'}
            icon={<Percent size={18} />}
            subtitle="por unidad vendida"
          />
          <MetricCard
            title="Inversión Meta"
            value={fmtARS(totalMeta)}
            icon={<DollarSign size={18} />}
            subtitle={`USD equiv. ${totalMetaUSD.toFixed(2)}`}
          />
        </div>
      )}

      {/* Selector de productos */}
      {!loading && productsInRange.length > 0 && (
        <div className="glass-panel rp-selector-panel">
          <button
            className="rp-selector-toggle"
            onClick={() => setSelectorOpen(v => !v)}
          >
            <span>
              Productos seleccionados: {selectedProducts.length} de {productsInRange.length}
            </span>
            {selectorOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {selectorOpen && (
            <div className="rp-selector-grid">
              {productsInRange.map(p => (
                <label key={p.nombre} className="rp-selector-item">
                  <input
                    type="checkbox"
                    checked={selectedProducts.includes(p.nombre)}
                    onChange={() => toggleProduct(p.nombre)}
                  />
                  <span className="rp-selector-name">{p.nombre}</span>
                  <span className="rp-selector-meta">
                    {p.unidades} u · {fmtARS(p.facturado)}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tabla de costos editable */}
      {!loading && selectedProducts.length > 0 && (
        <div className="glass-panel rent-table-panel">
          <div className="rp-table-section-label">Costos por producto</div>
          <div className="rent-table-scroll">
            <table className="rent-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Producto</th>
                  <th>Costo compra</th>
                  <th>Costo empaque</th>
                  <th>Costo envío</th>
                  <th>Costo agencia</th>
                  <th>Total/unidad</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {selectedProducts.map(name => {
                  const row     = editableRows[name] ?? {
                    product_name: name,
                    costo_compra: 0,
                    costo_empaque: 0,
                    costo_envio: 0,
                    costo_agencia: 0,
                  };
                  const total   = row.costo_compra + row.costo_empaque + row.costo_envio + row.costo_agencia;
                  const saving  = savingProduct === name;
                  return (
                    <tr key={name}>
                      <td className="rp-product-name">{name}</td>
                      <td>
                        <input
                          type="number"
                          className="rp-cost-input"
                          value={row.costo_compra}
                          min={0}
                          onChange={e => handleCostChange(name, 'costo_compra', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="rp-cost-input"
                          value={row.costo_empaque}
                          min={0}
                          onChange={e => handleCostChange(name, 'costo_empaque', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="rp-cost-input"
                          value={row.costo_envio}
                          min={0}
                          onChange={e => handleCostChange(name, 'costo_envio', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="rp-cost-input"
                          value={row.costo_agencia}
                          min={0}
                          onChange={e => handleCostChange(name, 'costo_agencia', e.target.value)}
                        />
                      </td>
                      <td style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                        {fmtARS(total)}
                      </td>
                      <td>
                        <button
                          className="rp-save-btn"
                          onClick={() => handleSave(name)}
                          disabled={saving}
                        >
                          <Save size={14} />
                          {saving ? 'Guardando...' : 'Guardar'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tabla de rentabilidad calculada */}
      {!loading && rentabilityRows.length > 0 && (
        <div className="glass-panel rent-table-panel">
          <div className="rp-table-section-label">Rentabilidad calculada</div>
          <div className="rent-table-scroll">
            <table className="rent-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Producto</th>
                  <th>Unidades</th>
                  <th>Precio prom.</th>
                  <th>Facturado</th>
                  <th>Mercadería</th>
                  <th>Empaque</th>
                  <th>Envío</th>
                  <th>Agencia</th>
                  <th>Meta ARS</th>
                  <th>Costo Total</th>
                  <th>Ganancia</th>
                  <th>Margen %</th>
                  <th>ROAS</th>
                  <th>CPA</th>
                </tr>
              </thead>
              <tbody>
                {rentabilityRows.map(r => (
                  <tr key={r.nombre}>
                    <td className="rp-product-name">{r.nombre}</td>
                    <td>{r.unidades}</td>
                    <td>{fmtARS(r.precioPromedio)}</td>
                    <td>{fmtARS(r.facturado)}</td>
                    <td>{fmtARS(r.costoMercaderiaTotal)}</td>
                    <td>{fmtARS(r.costoEmpaqueTotal)}</td>
                    <td>{fmtARS(r.costoEnvioTotal)}</td>
                    <td>{fmtARS(r.costoAgenciaTotal)}</td>
                    <td>{metaActivo ? fmtARS(r.inversionMetaARS) : 'N/A'}</td>
                    <td>{fmtARS(r.costoTotal)}</td>
                    <td style={{ color: gananciaColor(r.gananciaNeta) }}>
                      {fmtARS(r.gananciaNeta)}
                    </td>
                    <td style={{ color: gananciaColor(r.gananciaNeta) }}>
                      {r.margenPct.toFixed(1)}%
                    </td>
                    <td style={{ color: roasColor(r.roas) }}>
                      {metaActivo ? `${r.roas.toFixed(2)}x` : 'N/A'}
                    </td>
                    <td>{metaActivo ? fmtARS(r.cpa) : 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
              {rentabilityRows.length > 1 && (
                <tfoot>
                  <tr className="rent-tfoot-row">
                    <td>Total</td>
                    <td>{totalUnidades}</td>
                    <td>
                      {totalUnidades > 0 ? fmtARS(totalFact / totalUnidades) : '—'}
                    </td>
                    <td>{fmtARS(totalFact)}</td>
                    <td>
                      {fmtARS(rentabilityRows.reduce((s, r) => s + r.costoMercaderiaTotal, 0))}
                    </td>
                    <td>
                      {fmtARS(rentabilityRows.reduce((s, r) => s + r.costoEmpaqueTotal, 0))}
                    </td>
                    <td>
                      {fmtARS(rentabilityRows.reduce((s, r) => s + r.costoEnvioTotal, 0))}
                    </td>
                    <td>
                      {fmtARS(rentabilityRows.reduce((s, r) => s + r.costoAgenciaTotal, 0))}
                    </td>
                    <td>{metaActivo ? fmtARS(totalMeta) : 'N/A'}</td>
                    <td>{fmtARS(totalCosto)}</td>
                    <td style={{ color: gananciaColor(totalGanancia) }}>
                      {fmtARS(totalGanancia)}
                    </td>
                    <td style={{ color: gananciaColor(totalGanancia) }}>
                      {margenTotal.toFixed(1)}%
                    </td>
                    <td style={{ color: roasColor(roasPromedio) }}>
                      {metaActivo ? `${roasPromedio.toFixed(2)}x` : 'N/A'}
                    </td>
                    <td>{metaActivo ? fmtARS(cpaPromedio) : 'N/A'}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {!loading && productsInRange.length === 0 && !error && (
        <div className="glass-panel rp-empty">
          No hay ventas en el período seleccionado.
        </div>
      )}

    </div>
  );
}
