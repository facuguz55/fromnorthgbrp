import { useState, useEffect, useMemo, useRef } from 'react';
import { Package, RefreshCw, Send, Search, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { getSettings, fetchStockData } from '../services/dataService';
import type { StockItem } from '../services/dataService';
import {
  fetchProductosOcultos,
  insertProductoOculto,
  insertProductosOcultosBulk,
  deleteProductoOculto,
  deleteAllProductosOcultos,
} from '../services/supabaseService';
import './Stock.css';

const WEBHOOK_WAIT_SECONDS = 18;
const FILTER_KEY = 'stock-filter-tab';

type SortKey = 'nombre' | 'sku' | 'stock' | 'precio';
type SortDir = 'asc' | 'desc';
type FilterTab = 'todos' | 'con-stock' | 'sin-stock' | 'ocultos';

interface Toast {
  id: number;
  message: string;
  type: 'ok' | 'err';
}

export default function Stock() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [syncDone, setSyncDone] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [webhookStatus, setWebhookStatus] = useState<'idle' | 'ok' | 'err'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('nombre');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [noConfig, setNoConfig] = useState(false);
  const [hiddenSkus, setHiddenSkus] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<FilterTab>(
    () => (localStorage.getItem(FILTER_KEY) as FilterTab) || 'todos'
  );
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [hidingAll, setHidingAll] = useState(false);
  const [showingAll, setShowingAll] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastIdRef = useRef(0);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const addToast = (message: string, type: 'ok' | 'err' = 'ok') => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  };

  const loadHiddenProducts = async () => {
    try {
      const data = await fetchProductosOcultos();
      setHiddenSkus(new Set(data.map(d => d.sku)));
    } catch {
      // silent fail
    }
  };

  const loadData = async () => {
    setError(null);
    try {
      const settings = getSettings();
      const url = settings?.stockSheetsUrl || '';
      if (!url) {
        setNoConfig(true);
        setLoading(false);
        return;
      }
      setNoConfig(false);
      const data = await fetchStockData(url);
      setItems(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError('No se pudo cargar el stock. Verificá que el Google Sheet sea público.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    loadHiddenProducts();
  }, []);

  const handleTabChange = (tab: FilterTab) => {
    setActiveTab(tab);
    localStorage.setItem(FILTER_KEY, tab);
  };

  const handleHideProduct = async (sku: string, nombre: string) => {
    setActionLoading(prev => ({ ...prev, [sku]: true }));
    try {
      await insertProductoOculto(sku, nombre);
      setHiddenSkus(prev => new Set([...prev, sku]));
      addToast(`"${nombre}" ocultado`);
    } catch {
      addToast('Error al ocultar el producto', 'err');
    } finally {
      setActionLoading(prev => ({ ...prev, [sku]: false }));
    }
  };

  const handleShowProduct = async (sku: string, nombre: string) => {
    setActionLoading(prev => ({ ...prev, [sku]: true }));
    try {
      await deleteProductoOculto(sku);
      setHiddenSkus(prev => { const s = new Set(prev); s.delete(sku); return s; });
      addToast(`"${nombre}" visible nuevamente`);
    } catch {
      addToast('Error al mostrar el producto', 'err');
    } finally {
      setActionLoading(prev => ({ ...prev, [sku]: false }));
    }
  };

  const handleHideAllNoStock = async () => {
    const toHide = items.filter(i => i.stock === 0 && !hiddenSkus.has(i.sku));
    if (toHide.length === 0) {
      addToast('No hay productos sin stock para ocultar');
      return;
    }
    setHidingAll(true);
    try {
      await insertProductosOcultosBulk(toHide.map(i => ({ sku: i.sku, nombre: i.nombre })));
      setHiddenSkus(prev => new Set([...prev, ...toHide.map(i => i.sku)]));
      addToast(`${toHide.length} producto${toHide.length !== 1 ? 's' : ''} ocultado${toHide.length !== 1 ? 's' : ''}`);
    } catch {
      addToast('Error al ocultar productos sin stock', 'err');
    } finally {
      setHidingAll(false);
    }
  };

  const handleShowAll = async () => {
    if (hiddenSkus.size === 0) {
      addToast('No hay productos ocultos');
      return;
    }
    setShowingAll(true);
    try {
      await deleteAllProductosOcultos();
      setHiddenSkus(new Set());
      addToast('Todos los productos son visibles nuevamente');
    } catch {
      addToast('Error al mostrar todos los productos', 'err');
    } finally {
      setShowingAll(false);
    }
  };

  const handleUpdate = async () => {
    setUpdating(true);
    setSyncDone(false);
    setWebhookStatus('idle');

    const settings = getSettings();
    const webhookUrl = settings?.customApiUrl || '';

    if (webhookUrl) {
      try {
        await fetch(webhookUrl, { method: 'GET', mode: 'no-cors' });
        setWebhookStatus('ok');
      } catch {
        setWebhookStatus('err');
      }

      let remaining = WEBHOOK_WAIT_SECONDS;
      setCountdown(remaining);
      await new Promise<void>(resolve => {
        timerRef.current = setInterval(() => {
          remaining -= 1;
          setCountdown(remaining);
          if (remaining <= 0) {
            clearInterval(timerRef.current!);
            timerRef.current = null;
            setCountdown(null);
            resolve();
          }
        }, 1000);
      });
    }

    await loadData();
    setUpdating(false);
    setSyncDone(true);
    setTimeout(() => { setSyncDone(false); setWebhookStatus('idle'); }, 4000);
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let base: StockItem[];

    if (activeTab === 'ocultos') {
      base = items.filter(i => hiddenSkus.has(i.sku));
    } else {
      base = items.filter(i => !hiddenSkus.has(i.sku));
      if (activeTab === 'con-stock') base = base.filter(i => i.stock > 0);
      if (activeTab === 'sin-stock') base = base.filter(i => i.stock === 0);
    }

    return base.filter(i =>
      i.nombre.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q)
    );
  }, [items, search, activeTab, hiddenSkus]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortDir === 'asc' ? va - vb : vb - va;
      }
      return sortDir === 'asc'
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });
  }, [filtered, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const sinStock  = items.filter(i => i.stock === 0 && !hiddenSkus.has(i.sku)).length;
  const stockBajo = items.filter(i => i.stock > 0 && i.stock < 5 && !hiddenSkus.has(i.sku)).length;
  const conStock  = items.filter(i => i.stock >= 5 && !hiddenSkus.has(i.sku)).length;
  const ocultos   = hiddenSkus.size;

  return (
    <div className="stock-page fade-in">

      {/* ── Toasts ──────────────────────────────────────── */}
      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map(t => (
            <div key={t.id} className={`toast toast-${t.type}`}>{t.message}</div>
          ))}
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────── */}
      <header className="stock-header">
        <div>
          <h1>Stock</h1>
          <span className="text-muted stock-subtitle">
            {lastUpdated
              ? `Última actualización: ${lastUpdated.toLocaleTimeString('es-AR')}`
              : 'Sin datos cargados'}
          </span>
        </div>
        <button
          className="btn-primary update-btn"
          onClick={handleUpdate}
          disabled={updating || loading}
        >
          {updating && countdown !== null ? (
            <><RefreshCw size={16} className="spinning" /> Actualizando... {countdown}s</>
          ) : updating ? (
            <><RefreshCw size={16} className="spinning" /> Cargando...</>
          ) : syncDone ? (
            <>✓ Stock actualizado</>
          ) : (
            <><Send size={16} /> Actualizar Stock</>
          )}
        </button>
      </header>

      {/* ── Banner de estado del webhook ─────────────────── */}
      {webhookStatus === 'ok' && countdown !== null && (
        <div className="telegram-status status-ok">
          ✓ n8n procesando · el sheet se actualizará en <strong>{countdown}s</strong>...
        </div>
      )}
      {webhookStatus === 'err' && (
        <div className="telegram-status status-err">
          ✗ No se pudo contactar el webhook. Verificá la URL en Configuración → API Personalizada.
        </div>
      )}

      {/* ── Cards de resumen ──────────────────────────── */}
      {items.length > 0 && (
        <div className="stock-summary">
          <div className="stock-stat-card glass-panel">
            <span className="stat-value">{items.length - ocultos}</span>
            <span className="stat-label">Total visibles</span>
          </div>
          <div className="stock-stat-card glass-panel">
            <span className="stat-value stat-ok">{conStock}</span>
            <span className="stat-label">Con stock</span>
          </div>
          <div className="stock-stat-card glass-panel">
            <span className="stat-value stat-warn">{stockBajo}</span>
            <span className="stat-label">Stock bajo (&lt;5)</span>
          </div>
          <div className="stock-stat-card glass-panel">
            <span className="stat-value stat-danger">{sinStock}</span>
            <span className="stat-label">Sin stock</span>
          </div>
        </div>
      )}

      {/* ── Controles ──────────────────────────────────── */}
      {!loading && !noConfig && !error && (
        <>
          <div className="stock-controls">
            <div className="search-box">
              <Search size={15} className="search-icon" />
              <input
                type="text"
                placeholder="Buscar por nombre o SKU..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="search-input"
              />
            </div>
            <span className="text-muted" style={{ fontSize: '0.8rem' }}>
              {sorted.length} resultado{sorted.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="stock-filter-bar">
            <div className="stock-tabs">
              {(['todos', 'con-stock', 'sin-stock', 'ocultos'] as FilterTab[]).map(tab => (
                <button
                  key={tab}
                  className={`stock-tab ${activeTab === tab ? 'active' : ''}`}
                  onClick={() => handleTabChange(tab)}
                >
                  {tab === 'todos' && 'Todos'}
                  {tab === 'con-stock' && 'Con stock'}
                  {tab === 'sin-stock' && 'Sin stock'}
                  {tab === 'ocultos' && (
                    <>Ocultos{ocultos > 0 && <span className="tab-badge">{ocultos}</span>}</>
                  )}
                </button>
              ))}
            </div>

            <div className="stock-bulk-actions">
              <button
                className="btn-action"
                onClick={handleHideAllNoStock}
                disabled={hidingAll || showingAll}
              >
                {hidingAll
                  ? <RefreshCw size={13} className="spinning" />
                  : <EyeOff size={13} />
                }
                {hidingAll ? 'Ocultando...' : 'Ocultar sin stock'}
              </button>
              <button
                className="btn-action btn-action-ghost"
                onClick={handleShowAll}
                disabled={showingAll || ocultos === 0}
              >
                {showingAll
                  ? <RefreshCw size={13} className="spinning" />
                  : <Eye size={13} />
                }
                {showingAll ? 'Mostrando...' : 'Mostrar todos'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Estados ───────────────────────────────────── */}
      {loading ? (
        <div className="stock-state glass-panel">
          <RefreshCw size={24} className="spinning" />
          <span>Cargando stock...</span>
        </div>
      ) : noConfig ? (
        <div className="stock-state glass-panel">
          <Package size={40} className="stock-state-icon" />
          <h3>Sin configuración</h3>
          <p>
            Ingresá la URL del Google Sheet de stock en{' '}
            <strong>Configuración → Sincronización</strong>.
          </p>
        </div>
      ) : error ? (
        <div className="stock-state glass-panel">
          <AlertTriangle size={40} className="stock-state-icon" />
          <h3>Error al cargar</h3>
          <p>{error}</p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="stock-state glass-panel">
          <Package size={40} className="stock-state-icon" />
          <h3>Sin resultados</h3>
          <p>
            {activeTab === 'ocultos'
              ? 'No hay productos ocultos.'
              : 'No hay productos que coincidan con la búsqueda.'}
          </p>
        </div>
      ) : (

        /* ── Tabla ──────────────────────────────────── */
        <div className="stock-table-wrapper glass-panel">
          <table className="stock-table">
            <thead>
              <tr>
                <th className="sortable" onClick={() => handleSort('nombre')}>
                  Nombre {sortKey === 'nombre' ? (sortDir === 'asc' ? '↑' : '↓') : <span className="sort-hint">↕</span>}
                </th>
                <th className="sortable" onClick={() => handleSort('sku')}>
                  SKU {sortKey === 'sku' ? (sortDir === 'asc' ? '↑' : '↓') : <span className="sort-hint">↕</span>}
                </th>
                <th className="sortable" onClick={() => handleSort('stock')}>
                  Stock {sortKey === 'stock' ? (sortDir === 'asc' ? '↑' : '↓') : <span className="sort-hint">↕</span>}
                </th>
                <th className="sortable" onClick={() => handleSort('precio')}>
                  Precio {sortKey === 'precio' ? (sortDir === 'asc' ? '↑' : '↓') : <span className="sort-hint">↕</span>}
                </th>
                <th>Actualizado</th>
                <th className="th-visibility"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((item, i) => {
                const isHidden = hiddenSkus.has(item.sku);
                const isLoading = !!actionLoading[item.sku];
                return (
                  <tr
                    key={i}
                    className={
                      isHidden
                        ? 'row-hidden'
                        : item.stock === 0 ? 'row-no-stock'
                        : item.stock < 5 ? 'row-low-stock'
                        : ''
                    }
                  >
                    <td className="cell-nombre">
                      {item.nombre}
                      {isHidden && <span className="badge-hidden">Oculto</span>}
                    </td>
                    <td className="cell-sku">{item.sku || '—'}</td>
                    <td className="cell-stock">
                      <span className={`stock-badge ${
                        item.stock === 0 ? 'badge-danger' : item.stock < 5 ? 'badge-warning' : 'badge-ok'
                      }`}>
                        {item.stock}
                      </span>
                    </td>
                    <td className="cell-precio">
                      ${item.precio.toLocaleString('es-AR')}
                    </td>
                    <td className="cell-fecha">{item.fechaActualizacion || '—'}</td>
                    <td className="cell-visibility">
                      <button
                        className={`btn-eye ${isHidden ? 'btn-eye-show' : 'btn-eye-hide'}`}
                        onClick={() =>
                          isHidden
                            ? handleShowProduct(item.sku, item.nombre)
                            : handleHideProduct(item.sku, item.nombre)
                        }
                        disabled={isLoading}
                        title={isHidden ? 'Mostrar producto' : 'Ocultar producto'}
                      >
                        {isLoading
                          ? <RefreshCw size={14} className="spinning" />
                          : isHidden ? <Eye size={14} /> : <EyeOff size={14} />
                        }
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
