import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  RefreshCw, AlertTriangle, AlertCircle, TrendingUp,
  MousePointerClick, Eye, DollarSign, Users, Megaphone, CheckCircle2,
  Search, ArrowUpDown, ArrowUp, ArrowDown, ArrowLeftRight, X,
} from 'lucide-react';
import {
  getSettings,
  META_ACCOUNTS, getActiveMetaAccount, setActiveMetaAccount,
} from '../services/dataService';
import type { MetaAccountKey } from '../services/dataService';
import {
  fetchMetaCampaigns,
  fetchMetaInsights,
  generateMetaAlerts,
  computeMetaSummary,
} from '../services/metaAdsService';
import type { MetaCampaign, MetaInsight, MetaAlert, DatePreset } from '../services/metaAdsService';
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

type SortKey = 'name' | 'status' | 'spend' | 'impressions' | 'clicks' | 'ctr' | 'reach' | 'frequency' | 'roas' | 'cpa';
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

// ── Toast system ──────────────────────────────────────────────────────────────

interface ToastItem {
  id: number;
  title: string;
  body: string;
  severity: 'critical' | 'warning';
  exiting: boolean;
}

function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="meta-toast-stack">
      {toasts.map(t => (
        <div key={t.id} className={`meta-toast ${t.severity} ${t.exiting ? 'exiting' : ''}`}>
          <div className="meta-toast-icon">
            {t.severity === 'critical'
              ? <AlertCircle size={18} />
              : <AlertTriangle size={18} />}
          </div>
          <div className="meta-toast-content">
            <p className="meta-toast-title">{t.title}</p>
            <p className="meta-toast-body">{t.body}</p>
          </div>
          <button className="meta-toast-close" onClick={() => onDismiss(t.id)}>
            <X size={14} />
          </button>
          <div className="meta-toast-bar" />
        </div>
      ))}
    </div>
  );
}

function TestNotifButton({ onFire }: { onFire: () => void }) {
  const [countdown, setCountdown] = useState<number | null>(null);

  const handleClick = () => {
    if (countdown !== null) return;
    setCountdown(3);
    let t = 3;
    const iv = setInterval(() => {
      t--;
      if (t > 0) { setCountdown(t); return; }
      clearInterval(iv);
      setCountdown(null);
      onFire();
    }, 1000);
  };

  return (
    <button
      className={`meta-notif-test-btn ${countdown !== null ? 'counting' : ''}`}
      onClick={handleClick}
      disabled={countdown !== null}
    >
      🔔 {countdown !== null ? `Enviando en ${countdown}s…` : 'Test notif'}
    </button>
  );
}

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

  const [activeAccountKey, setActiveAccountKey] = useState<MetaAccountKey>(getActiveMetaAccount);
  const datePresetRef = useRef(datePreset);
  useEffect(() => { datePresetRef.current = datePreset; }, [datePreset]);

  const loadData = async (preset: DatePreset = datePreset, acctKey: MetaAccountKey = activeAccountKey, force = false) => {
    if (!force && !loading) setLoading(true);
    setError(null);
    try {
      const settings  = getSettings();
      const token     = settings?.metaAccessToken?.trim() ?? '';
      const acct      = META_ACCOUNTS.find(a => a.key === acctKey)!;
      const accountId = (settings[acct.settingsKey] as string)?.trim() ?? '';
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

  useEffect(() => { loadData(datePreset, getActiveMetaAccount()); }, []);

  // Escucha cambios de cuenta disparados desde el Sidebar
  useEffect(() => {
    const handler = (e: Event) => {
      const key = (e as CustomEvent<MetaAccountKey>).detail;
      setActiveAccountKey(key);
      loadData(datePresetRef.current, key, true);
    };
    window.addEventListener('meta-account-changed', handler);
    return () => window.removeEventListener('meta-account-changed', handler);
  }, []);

  const handleDateChange = (preset: DatePreset) => {
    setDatePreset(preset);
    loadData(preset, activeAccountKey, true);
  };

  const handleAccountSwitch = () => {
    const next = META_ACCOUNTS.find(a => a.key !== activeAccountKey)!;
    setActiveMetaAccount(next.key);
    setActiveAccountKey(next.key);
    loadData(datePreset, next.key, true);
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
      else if (sortKey === 'roas') {
        va = a.insight && a.insight.spend > 0 ? a.insight.purchaseValue / a.insight.spend : -1;
        vb = b.insight && b.insight.spend > 0 ? b.insight.purchaseValue / b.insight.spend : -1;
      }
      else if (sortKey === 'cpa') {
        va = a.insight && a.insight.purchases > 0 ? a.insight.spend / a.insight.purchases : -1;
        vb = b.insight && b.insight.purchases > 0 ? b.insight.spend / b.insight.purchases : -1;
      }

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

  // ── Notificaciones ────────────────────────────────────────────────────────────

  // Pedir permiso al montar
  useEffect(() => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'default') return;
    Notification.requestPermission();
  }, []);

  // ── Toast in-app ──────────────────────────────────────────────────────────────
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastCounter = useRef(0);

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 400);
  }, []);

  const showToast = useCallback((title: string, body: string, severity: 'critical' | 'warning') => {
    const id = ++toastCounter.current;
    setToasts(prev => [...prev, { id, title, body, severity, exiting: false }]);
    setTimeout(() => dismissToast(id), 6000);
  }, [dismissToast]);

  // ── Notificaciones nativas + toast ────────────────────────────────────────────
  const buildNotifPayload = (alertList: MetaAlert[], acctKey: MetaAccountKey = activeAccountKey) => {
    if (alertList.length === 0) return null;
    const accountLabel = META_ACCOUNTS.find(a => a.key === acctKey)?.label ?? 'Meta Ads';
    const crits = alertList.filter(a => a.severity === 'critical');
    const warns = alertList.filter(a => a.severity === 'warning');
    const top   = crits[0] ?? warns[0];
    const severity: 'critical' | 'warning' = crits.length > 0 ? 'critical' : 'warning';
    const title = crits.length > 0
      ? `⚠️ Meta Ads · ${accountLabel} — ${crits.length} crítica${crits.length !== 1 ? 's' : ''}`
      : `Meta Ads · ${accountLabel} — ${warns.length} advertencia${warns.length !== 1 ? 's' : ''}`;
    const body = `${top.name}: ${top.message}`
      + (alertList.length > 1 ? `\n+${alertList.length - 1} alerta${alertList.length - 1 !== 1 ? 's' : ''} más` : '');
    return { title, body, severity };
  };

  const sendNotifications = (alertList: MetaAlert[], acctKey: MetaAccountKey = activeAccountKey) => {
    const payload = buildNotifPayload(alertList, acctKey);
    if (!payload) return;
    // Toast in-app (siempre)
    showToast(payload.title, payload.body, payload.severity);
    // Notificación nativa (si hay permiso)
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try { new Notification(payload.title, { body: payload.body }); } catch (_) {}
    }
  };

  // Auto-notificar en cada recarga (no en la primera carga inicial)
  const isFirstLoad = useRef(true);
  useEffect(() => {
    if (isFirstLoad.current) { isFirstLoad.current = false; return; }
    sendNotifications(alerts, activeAccountKey);
  }, [alerts]);

  return (
    <div className="meta-page fade-in">

      {/* ── Header ── */}
      <header className="meta-header">
        <div>
          <div className="meta-title-row">
            <h1 className="meta-title">
              <Megaphone size={22} className="meta-title-icon" />
              Meta Ads
            </h1>
            <button
              className="meta-account-switcher"
              onClick={handleAccountSwitch}
              title={`Cambiar a ${META_ACCOUNTS.find(a => a.key !== activeAccountKey)?.label}`}
              disabled={loading}
            >
              {META_ACCOUNTS.find(a => a.key === activeAccountKey)?.label}
              <ArrowLeftRight size={12} />
            </button>
          </div>
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
          {/* ── BOTÓN TEMPORAL DE PRUEBA ── */}
          <TestNotifButton onFire={() => sendNotifications(
            alerts.length > 0 ? alerts : [{
              level: 'campaign' as const, id: 'test', name: 'Campaña Verano 2025',
              type: 'low_roas' as const, severity: 'critical' as const,
              message: 'ROAS crítico: 0.8x — gastás más de lo que generás',
              value: 0.8,
            }],
          )} />
          <button className="btn-secondary refresh-btn" onClick={() => loadData(datePreset, activeAccountKey, true)} disabled={loading}>
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
            <MetricCard title="Frecuencia"     value={summary.avgFrequency > 0 ? `${summary.avgFrequency.toFixed(2)}x` : '—'} icon={<Eye size={20} />}               subtitle={summary.avgFrequency === 0 ? 'Sin datos' : summary.avgFrequency <= 3 ? 'Saludable' : summary.avgFrequency <= 6 ? 'Alta — revisar' : 'Crítica — fatiga de anuncio'} />
            <MetricCard title="ROAS"           value={summary.overallRoas > 0 ? `${summary.overallRoas.toFixed(2)}x` : '—'}   icon={<TrendingUp size={20} />}        subtitle={summary.overallRoas >= 3 ? 'Excelente' : summary.overallRoas >= 2 ? 'Bueno' : summary.overallRoas > 0 ? 'Bajo — revisá campañas' : 'Sin datos de conversión'} />
            <MetricCard title="CPA"            value={summary.avgCpa > 0 ? fmtARS(summary.avgCpa) : '—'}                      icon={<DollarSign size={20} />}        subtitle={summary.totalPurchases > 0 ? `${summary.totalPurchases} compras totales` : 'Sin conversiones registradas'} />
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
                        <p className="meta-alert-name">
                          {alert.name}
                          {(() => {
                            const status = campaigns.find(c => c.id === alert.id)?.status;
                            return status ? <StatusDot status={status} /> : null;
                          })()}
                        </p>
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
                        { key: 'roas',        label: 'ROAS' },
                        { key: 'cpa',         label: 'CPA' },
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
                          <td className={`meta-td-roas ${ins && ins.spend > 0 ? (ins.purchaseValue / ins.spend >= 3 ? 'meta-roas-ok' : ins.purchaseValue / ins.spend >= 2 ? 'meta-roas-warn' : ins.purchases > 0 ? 'meta-roas-bad' : '') : ''}`}>
                            {ins && ins.purchases > 0 ? `${(ins.purchaseValue / ins.spend).toFixed(2)}x` : '—'}
                          </td>
                          <td className="tn-td-total">
                            {ins && ins.purchases > 0 ? fmtARS(ins.spend / ins.purchases) : '—'}
                          </td>
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
