import { useState, useEffect, useMemo } from 'react';
import {
  RefreshCw, AlertTriangle, AlertCircle, TrendingUp,
  MousePointerClick, Eye, DollarSign, Users, Megaphone, CheckCircle2,
  Search, ArrowUpDown, ArrowUp, ArrowDown,
} from 'lucide-react';
import { getSettings } from '../services/dataService';
import {
  fetchMetaCampaigns,
  fetchMetaInsights,
  generateMetaAlerts,
  computeMetaSummary,
} from '../services/metaAdsService';
import type { MetaCampaign, MetaInsight, DatePreset } from '../services/metaAdsService';
import MetricCard from '../components/MetricCard';
import './Meta.css';

const DATE_OPTIONS: { value: DatePreset; label: string }[] = [
  { value: 'today',      label: 'Hoy' },
  { value: 'yesterday',  label: 'Ayer' },
  { value: 'last_7d',    label: 'Últimos 7 días' },
  { value: 'last_14d',   label: 'Últimos 14 días' },
  { value: 'last_30d',   label: 'Últimos 30 días' },
  { value: 'this_month', label: 'Este mes' },
  { value: 'last_month', label: 'Mes anterior' },
];

const fmtARS = (n: number) => `$${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtNum = (n: number) => n.toLocaleString('es-AR');
const fmtPct = (n: number) => `${n.toFixed(2)}%`;

type SortKey = 'name' | 'status' | 'spend' | 'impressions' | 'clicks' | 'ctr' | 'reach' | 'frequency';
type SortDir = 'asc' | 'desc';
type StatusFilter = 'ALL' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
type CtrFilter = 'ALL' | 'good' | 'ok' | 'low' | 'none';

function AlertBadge({ severity }: { severity: 'warning' | 'critical' }) {
  return (
    <span className={`meta-alert-badge ${severity}`}>
      {severity === 'critical' ? <AlertCircle size={11} /> : <AlertTriangle size={11} />}
      {severity === 'critical' ? 'Crítico' : 'Advertencia'}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const cls   = status === 'ACTIVE' ? 'status-active' : status === 'PAUSED' ? 'status-paused' : 'status-archived';
  const label = status === 'ACTIVE' ? 'Activa'        : status === 'PAUSED' ? 'Pausada'       : 'Archivada';
  return <span className={`meta-status-dot ${cls}`}>{label}</span>;
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ArrowUpDown size={12} className="sort-hint" />;
  return sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
}

type CampaignRow = MetaCampaign & { insight: MetaInsight | null };

export default function Meta() {
  const [campaigns,   setCampaigns]   = useState<MetaCampaign[]>([]);
  const [insights,    setInsights]    = useState<MetaInsight[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [datePreset,  setDatePreset]  = useState<DatePreset>('last_7d');

  // Filtros
  const [search,        setSearch]        = useState('');
  const [statusFilter,  setStatusFilter]  = useState<StatusFilter>('ALL');
  const [ctrFilter,     setCtrFilter]     = useState<CtrFilter>('ALL');
  const [minSpend,      setMinSpend]      = useState('');
  const [maxFreq,       setMaxFreq]       = useState('');
  const [onlyAlerts,    setOnlyAlerts]    = useState(false);

  // Ordenamiento
  const [sortKey, setSortKey] = useState<SortKey>('spend');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const loadData = async (preset: DatePreset = datePreset, force = false) => {
    if (!force && !loading) setLoading(true);
    setError(null);
    try {
      const settings  = getSettings();
      const token     = settings?.metaAccessToken?.trim() ?? '';
      const accountId = settings?.metaAdAccountId?.trim() ?? '';
      if (!token || !accountId) {
        setError('Configurá tu Access Token y Ad Account ID en Configuración → Meta Ads.');
        setLoading(false);
        return;
      }
      const [camps, ins] = await Promise.all([
        fetchMetaCampaigns(token, accountId),
        fetchMetaInsights(token, accountId, preset, 'campaign'),
      ]);
      setCampaigns(camps);
      setInsights(ins);
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.message ?? 'Error al conectar con Meta Ads API.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleDateChange = (preset: DatePreset) => {
    setDatePreset(preset);
    loadData(preset, true);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const summary  = useMemo(() => computeMetaSummary(insights), [insights]);
  const alerts   = useMemo(() => generateMetaAlerts(insights, 'campaign'), [insights]);
  const alertIds = useMemo(() => new Set(alerts.map(a => a.id)), [alerts]);

  const campaignsWithInsights: CampaignRow[] = useMemo(() => {
    const insightMap = new Map(insights.map(i => [i.campaign_id, i]));
    return campaigns.map(c => ({ ...c, insight: insightMap.get(c.id) ?? null }));
  }, [campaigns, insights]);

  const filtered = useMemo(() => {
    let rows = campaignsWithInsights;

    // Búsqueda por nombre
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r => r.name.toLowerCase().includes(q));
    }

    // Estado
    if (statusFilter !== 'ALL') {
      rows = rows.filter(r => r.status === statusFilter);
    }

    // CTR
    if (ctrFilter !== 'ALL') {
      rows = rows.filter(r => {
        const ctr = r.insight?.ctr ?? -1;
        if (ctrFilter === 'good') return ctr >= 1;
        if (ctrFilter === 'ok')   return ctr >= 0.5 && ctr < 1;
        if (ctrFilter === 'low')  return ctr >= 0 && ctr < 0.5;
        if (ctrFilter === 'none') return r.insight === null || r.insight.impressions === 0;
        return true;
      });
    }

    // Gasto mínimo
    if (minSpend !== '') {
      const min = parseFloat(minSpend);
      if (!isNaN(min)) rows = rows.filter(r => (r.insight?.spend ?? 0) >= min);
    }

    // Frecuencia máxima
    if (maxFreq !== '') {
      const max = parseFloat(maxFreq);
      if (!isNaN(max)) rows = rows.filter(r => r.insight === null || r.insight.frequency <= max);
    }

    // Solo con alertas
    if (onlyAlerts) {
      rows = rows.filter(r => alertIds.has(r.id));
    }

    // Ordenamiento
    return [...rows].sort((a, b) => {
      let va: number | string = 0;
      let vb: number | string = 0;

      if (sortKey === 'name')        { va = a.name;                       vb = b.name; }
      else if (sortKey === 'status') { va = a.status;                     vb = b.status; }
      else if (sortKey === 'spend')  { va = a.insight?.spend       ?? -1; vb = b.insight?.spend       ?? -1; }
      else if (sortKey === 'impressions') { va = a.insight?.impressions ?? -1; vb = b.insight?.impressions ?? -1; }
      else if (sortKey === 'clicks') { va = a.insight?.clicks       ?? -1; vb = b.insight?.clicks      ?? -1; }
      else if (sortKey === 'ctr')    { va = a.insight?.ctr          ?? -1; vb = b.insight?.ctr         ?? -1; }
      else if (sortKey === 'reach')  { va = a.insight?.reach        ?? -1; vb = b.insight?.reach       ?? -1; }
      else if (sortKey === 'frequency') { va = a.insight?.frequency ?? -1; vb = b.insight?.frequency   ?? -1; }

      if (typeof va === 'string' && typeof vb === 'string') {
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
  }, [campaignsWithInsights, search, statusFilter, ctrFilter, minSpend, maxFreq, onlyAlerts, sortKey, sortDir, alertIds]);

  const criticals    = alerts.filter(a => a.severity === 'critical').length;
  const warnings     = alerts.filter(a => a.severity === 'warning').length;
  const isFiltered   = filtered.length !== campaignsWithInsights.length;
  const hasFilters   = search || statusFilter !== 'ALL' || ctrFilter !== 'ALL' || minSpend || maxFreq || onlyAlerts;

  const clearFilters = () => {
    setSearch(''); setStatusFilter('ALL'); setCtrFilter('ALL');
    setMinSpend(''); setMaxFreq(''); setOnlyAlerts(false);
  };

  return (
    <div className="meta-page fade-in">

      {/* ── Header ── */}
      <header className="meta-header">
        <div>
          <h1 className="meta-title">
            <Megaphone size={22} className="meta-title-icon" />
            Meta Ads
          </h1>
          {lastUpdated && (
            <span className="text-muted meta-meta">
              Actualizado: {lastUpdated.toLocaleTimeString('es-AR')}
            </span>
          )}
        </div>
        <div className="meta-header-actions">
          <div className="meta-date-btns">
            {DATE_OPTIONS.map(o => (
              <button
                key={o.value}
                className={`meta-date-btn ${datePreset === o.value ? 'active' : ''}`}
                onClick={() => handleDateChange(o.value)}
                disabled={loading}
              >
                {o.label}
              </button>
            ))}
          </div>
          <button className="btn-secondary refresh-btn" onClick={() => loadData(datePreset, true)} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spinning' : ''} />
            {loading ? 'Cargando...' : 'Actualizar'}
          </button>
        </div>
      </header>

      {error && (
        <div className="meta-error glass-panel">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {loading && (
        <div className="meta-loading glass-panel">
          <RefreshCw size={24} className="spinning" />
          <span>Conectando con Meta Ads...</span>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* ── KPI Strip ── */}
          <div className="meta-kpi-grid">
            <MetricCard title="Gasto total"    value={fmtARS(summary.totalSpend)}        icon={<DollarSign size={20} />}        subtitle={DATE_OPTIONS.find(o => o.value === datePreset)?.label ?? ''} />
            <MetricCard title="Impresiones"    value={fmtNum(summary.totalImpressions)}  icon={<Eye size={20} />}               subtitle="veces que se mostró el ad" />
            <MetricCard title="Clics"          value={fmtNum(summary.totalClicks)}        icon={<MousePointerClick size={20} />} subtitle="clics totales en el período" />
            <MetricCard title="CTR promedio"   value={fmtPct(summary.avgCtr)}             icon={<TrendingUp size={20} />}        subtitle={summary.avgCtr >= 1 ? 'Buen rendimiento' : summary.avgCtr >= 0.5 ? 'Mejorable' : 'Bajo — revisá creativos'} />
            <MetricCard title="Alcance"        value={fmtNum(summary.totalReach)}         icon={<Users size={20} />}             subtitle="personas únicas alcanzadas" />
          </div>

          {/* ── Alertas ── */}
          <section className="meta-section">
            <div className="meta-section-header">
              <div className="meta-section-title">
                <AlertTriangle size={18} className="meta-section-icon" />
                <h2>Alertas de rendimiento</h2>
                {alerts.length > 0 && (
                  <div className="meta-alert-counts">
                    {criticals > 0 && <span className="meta-count-badge critical">{criticals} crítico{criticals !== 1 ? 's' : ''}</span>}
                    {warnings  > 0 && <span className="meta-count-badge warning">{warnings} advertencia{warnings !== 1 ? 's' : ''}</span>}
                  </div>
                )}
              </div>
            </div>
            {alerts.length === 0 ? (
              <div className="meta-no-alerts glass-panel">
                <CheckCircle2 size={28} className="meta-ok-icon" />
                <div>
                  <p className="meta-no-alerts-title">Todo en orden</p>
                  <p className="meta-no-alerts-sub">Ninguna campaña superó los umbrales de alerta en este período.</p>
                </div>
              </div>
            ) : (
              <div className="meta-alerts-list">
                {alerts.map((alert, i) => (
                  <div key={i} className={`meta-alert-row glass-panel ${alert.severity}`}>
                    <div className="meta-alert-left">
                      {alert.severity === 'critical'
                        ? <AlertCircle size={18} className="meta-alert-icon critical" />
                        : <AlertTriangle size={18} className="meta-alert-icon warning" />}
                      <div>
                        <p className="meta-alert-name">{alert.name}</p>
                        <p className="meta-alert-msg">{alert.message}</p>
                      </div>
                    </div>
                    <AlertBadge severity={alert.severity} />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Campañas ── */}
          <section className="meta-section">
            <div className="meta-section-header">
              <div className="meta-section-title">
                <Megaphone size={18} className="meta-section-icon" />
                <h2>Campañas</h2>
                <span className="meta-section-count">
                  {isFiltered ? `${filtered.length} de ${campaignsWithInsights.length}` : campaigns.length}
                </span>
              </div>
            </div>

            {/* ── Filtros ── */}
            {campaigns.length > 0 && (
              <div className="meta-filters glass-panel">

                {/* Búsqueda */}
                <div className="meta-filter-search">
                  <Search size={14} className="meta-filter-search-icon" />
                  <input
                    type="text"
                    placeholder="Buscar campaña..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="meta-filter-input"
                  />
                </div>

                {/* Estado */}
                <div className="meta-filter-group">
                  <span className="meta-filter-label">Estado</span>
                  <div className="meta-filter-btns">
                    {([
                      { value: 'ALL',      label: 'Todos' },
                      { value: 'ACTIVE',   label: 'Activa' },
                      { value: 'PAUSED',   label: 'Pausada' },
                      { value: 'ARCHIVED', label: 'Archivada' },
                    ] as { value: StatusFilter; label: string }[]).map(o => (
                      <button key={o.value} className={`meta-filter-btn ${statusFilter === o.value ? 'active' : ''}`} onClick={() => setStatusFilter(o.value)}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* CTR */}
                <div className="meta-filter-group">
                  <span className="meta-filter-label">CTR</span>
                  <div className="meta-filter-btns">
                    {([
                      { value: 'ALL',  label: 'Todos' },
                      { value: 'good', label: '≥ 1% ✓' },
                      { value: 'ok',   label: '0.5–1%' },
                      { value: 'low',  label: '< 0.5% ✗' },
                      { value: 'none', label: 'Sin datos' },
                    ] as { value: CtrFilter; label: string }[]).map(o => (
                      <button key={o.value} className={`meta-filter-btn ${ctrFilter === o.value ? 'active' : ''}`} onClick={() => setCtrFilter(o.value)}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Gasto mínimo y Frecuencia máxima */}
                <div className="meta-filter-group">
                  <span className="meta-filter-label">Gasto mín. ($)</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="ej. 100"
                    value={minSpend}
                    onChange={e => setMinSpend(e.target.value)}
                    className="meta-filter-number"
                  />
                </div>

                <div className="meta-filter-group">
                  <span className="meta-filter-label">Frec. máx.</span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="ej. 4"
                    value={maxFreq}
                    onChange={e => setMaxFreq(e.target.value)}
                    className="meta-filter-number"
                  />
                </div>

                {/* Solo con alertas */}
                <div className="meta-filter-group">
                  <span className="meta-filter-label">Alertas</span>
                  <button
                    className={`meta-filter-btn ${onlyAlerts ? 'active active-alert' : ''}`}
                    onClick={() => setOnlyAlerts(v => !v)}
                  >
                    {onlyAlerts ? '⚠ Solo con alertas' : 'Con alertas'}
                  </button>
                </div>

                {/* Limpiar */}
                {hasFilters && (
                  <button className="meta-filter-clear" onClick={clearFilters}>
                    Limpiar filtros
                  </button>
                )}
              </div>
            )}

            {campaigns.length === 0 ? (
              <div className="meta-empty glass-panel">
                <Megaphone size={32} style={{ opacity: 0.3 }} />
                <p>No se encontraron campañas en esta cuenta.</p>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Verificá que el Ad Account ID sea correcto en Configuración.</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="meta-empty glass-panel">
                <Search size={28} style={{ opacity: 0.3 }} />
                <p>Ninguna campaña coincide con los filtros aplicados.</p>
                <button className="meta-filter-clear" style={{ marginTop: '0.5rem' }} onClick={clearFilters}>Limpiar filtros</button>
              </div>
            ) : (
              <div className="tn-table-wrapper glass-panel">
                <table className="tn-table">
                  <thead>
                    <tr>
                      {([
                        { key: 'name',        label: 'Campaña' },
                        { key: 'status',      label: 'Estado' },
                        { key: 'spend',       label: 'Gasto' },
                        { key: 'impressions', label: 'Impresiones' },
                        { key: 'clicks',      label: 'Clics' },
                        { key: 'ctr',         label: 'CTR' },
                        { key: 'reach',       label: 'Alcance' },
                        { key: 'frequency',   label: 'Frec.' },
                      ] as { key: SortKey; label: string }[]).map(col => (
                        <th key={col.key} className="sortable" onClick={() => handleSort(col.key)} style={{ cursor: 'pointer', userSelect: 'none' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                            {col.label}
                            <SortIcon col={col.key} sortKey={sortKey} sortDir={sortDir} />
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(c => {
                      const ins      = c.insight;
                      const ctr      = ins?.ctr ?? 0;
                      const ctrClass = ctr >= 1 ? 'meta-ctr-ok' : ctr >= 0.5 ? 'meta-ctr-warn' : ins ? 'meta-ctr-bad' : '';
                      const hasAlert = alertIds.has(c.id);
                      return (
                        <tr key={c.id} className={hasAlert ? 'meta-row-alert' : ''}>
                          <td className="meta-td-name">
                            {hasAlert && <AlertTriangle size={12} className="meta-row-alert-icon" />}
                            {c.name}
                          </td>
                          <td><StatusDot status={c.status} /></td>
                          <td className="tn-td-total">{ins ? fmtARS(ins.spend) : '—'}</td>
                          <td className="tn-td-num">{ins ? fmtNum(ins.impressions) : '—'}</td>
                          <td className="tn-td-num">{ins ? fmtNum(ins.clicks) : '—'}</td>
                          <td className={`meta-td-ctr ${ctrClass}`}>{ins ? fmtPct(ins.ctr) : '—'}</td>
                          <td className="tn-td-num">{ins ? fmtNum(ins.reach) : '—'}</td>
                          <td className={`meta-td-freq ${ins && ins.frequency > 4 ? 'meta-freq-high' : ''}`}>
                            {ins ? ins.frequency.toFixed(1) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
