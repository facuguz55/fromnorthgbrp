import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Store, RefreshCw, Search, Pencil, X,
  CheckCircle2, AlertCircle,
  Users, Tag, Plus, Percent, DollarSign, Truck, Phone, Mail, Calendar, ShoppingBag,
  Package, AlertTriangle, Eye, EyeOff,
} from 'lucide-react';
import { getSettings } from '../services/dataService';
import {
  fetchTNProductsForManagement,
  fetchTNCategories,
  updateTNCategory,
  updateTNProductVariant,
  fetchTNCustomers,
  fetchTNCustomerOrders,
  fetchTNProducts,
} from '../services/tiendanubeService';
import type { StockItemWithIds, TNCategory, TNCustomer, TNOrder, StockItem } from '../services/tiendanubeService';
import {
  fetchProductosOcultos,
  insertProductoOculto,
  insertProductosOcultosBulk,
  deleteProductoOculto,
  deleteAllProductosOcultos,
} from '../services/supabaseService';
import './Tienda.css';
import './TiendanubeVentas.css';
import './Clientes.css';
import './Cupones.css';
import './Stock.css';

type Tab = 'stock' | 'productos' | 'categorias' | 'clientes' | 'cupones';

interface Toast {
  type: 'ok' | 'err';
  msg: string;
}

// ── Productos ──────────────────────────────────────────────────────────────────

interface EditingProduct {
  productId: number;
  variantId: number;
  precio: string;
  stock: string;
}

function ProductosTab() {
  const [items, setItems]             = useState<StockItemWithIds[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [search, setSearch]           = useState('');
  const [editing, setEditing]         = useState<EditingProduct | null>(null);
  const [saving, setSaving]           = useState(false);
  const [toast, setToast]             = useState<Toast | null>(null);
  const toastTimer                    = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (type: 'ok' | 'err', msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, msg });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };

  const loadData = async () => {
    setError(null);
    setLoading(true);
    try {
      const settings = getSettings();
      const storeId  = settings?.tiendanubeStoreId?.trim() ?? '';
      const token    = settings?.tiendanubeToken?.trim()    ?? '';
      if (!storeId || !token) {
        setError('Configurá tu Store ID y Access Token en Configuración → TiendaNube API.');
        setLoading(false);
        return;
      }
      const data = await fetchTNProductsForManagement(storeId, token);
      setItems(data);
    } catch (err) {
      setError('No se pudo cargar los productos.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return items;
    return items.filter(i =>
      i.nombre.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q)
    );
  }, [items, search]);

  const handleStartEdit = (item: StockItemWithIds) => {
    setEditing({
      productId: item.productId,
      variantId: item.variantId,
      precio: String(item.precio),
      stock: String(item.stock),
    });
  };

  const handleSave = async (item: StockItemWithIds) => {
    if (!editing) return;
    setSaving(true);
    try {
      const settings = getSettings();
      const storeId  = settings?.tiendanubeStoreId?.trim() ?? '';
      const token    = settings?.tiendanubeToken?.trim()    ?? '';
      if (!storeId || !token) throw new Error('Sin credenciales');

      const price  = parseFloat(editing.precio);
      const stock  = parseInt(editing.stock);
      const body: { price?: string; stock?: number } = {};
      if (!isNaN(price)) body.price = price.toFixed(2);
      if (!isNaN(stock)) body.stock = stock;

      await updateTNProductVariant(storeId, token, editing.productId, editing.variantId, body);

      setItems(prev => prev.map(i =>
        i.productId === editing.productId && i.variantId === editing.variantId
          ? { ...i, precio: price || i.precio, stock: isNaN(stock) ? i.stock : stock }
          : i
      ));
      showToast('ok', `"${item.nombre}" actualizado.`);
      setEditing(null);
    } catch (e) {
      showToast('err', `No se pudo guardar. ${e}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="tienda-state glass-panel">
        <RefreshCw size={24} className="spinning" />
        <span>Cargando productos...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tienda-state tienda-state-error glass-panel">
        <AlertCircle size={32} className="tienda-state-icon" />
        <p>{error}</p>
      </div>
    );
  }

  return (
    <>
      {/* Buscador */}
      <div className="tienda-controls">
        <div className="tienda-search-box">
          <Search size={14} className="tienda-search-icon" />
          <input
            type="text"
            placeholder="Buscar por nombre o SKU..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="tienda-search-input"
          />
        </div>
        <span className="tienda-count text-muted">
          {filtered.length} producto{filtered.length !== 1 ? 's' : ''}
        </span>
        <button className="btn-secondary tienda-refresh-btn" onClick={loadData}>
          <RefreshCw size={14} />
          Actualizar
        </button>
      </div>

      {/* Tabla */}
      {filtered.length === 0 ? (
        <div className="tienda-state glass-panel">
          <Search size={30} className="tienda-state-icon" />
          <p>Sin resultados para tu búsqueda.</p>
        </div>
      ) : (
        <div className="tn-table-wrapper glass-panel">
          <table className="tn-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>SKU</th>
                <th>Stock</th>
                <th>Precio</th>
                <th>Última act.</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => {
                const isEditing = editing?.productId === item.productId && editing?.variantId === item.variantId;
                return (
                  <tr key={`${item.productId}-${item.variantId}`} className={isEditing ? 'tienda-row-editing' : ''}>
                    <td className="tienda-td-nombre">{item.nombre}</td>
                    <td className="tienda-td-sku">{item.sku || '—'}</td>
                    <td>
                      {isEditing ? (
                        <input
                          type="number"
                          min="0"
                          className="tienda-inline-input"
                          value={editing.stock}
                          onChange={e => setEditing(prev => prev ? { ...prev, stock: e.target.value } : prev)}
                        />
                      ) : (
                        <span className={`tienda-stock-badge ${
                          item.stock === 0 ? 'badge-danger' : item.stock < 5 ? 'badge-warning' : 'badge-ok'
                        }`}>
                          {item.stock}
                        </span>
                      )}
                    </td>
                    <td className="tn-td-total">
                      {isEditing ? (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="tienda-inline-input tienda-inline-input-wide"
                          value={editing.precio}
                          onChange={e => setEditing(prev => prev ? { ...prev, precio: e.target.value } : prev)}
                        />
                      ) : (
                        `$${item.precio.toLocaleString('es-AR')}`
                      )}
                    </td>
                    <td className="tn-td-fecha">{item.fechaActualizacion || '—'}</td>
                    <td className="tienda-td-actions">
                      {isEditing ? (
                        <div className="tienda-edit-actions">
                          <button
                            className="tienda-save-btn"
                            onClick={() => handleSave(item)}
                            disabled={saving}
                            title="Guardar"
                          >
                            {saving ? <RefreshCw size={13} className="spinning" /> : <CheckCircle2 size={13} />}
                          </button>
                          <button
                            className="tienda-cancel-btn"
                            onClick={() => setEditing(null)}
                            disabled={saving}
                            title="Cancelar"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <button
                          className="cupon-edit-btn"
                          onClick={() => handleStartEdit(item)}
                          title="Editar precio y stock"
                        >
                          <Pencil size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`cupon-toast ${toast.type}`}>
          {toast.type === 'ok' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          {toast.msg}
        </div>
      )}
    </>
  );
}

// ── Categorías ─────────────────────────────────────────────────────────────────

interface EditingCategory {
  id: number;
  name: string;
}

function CategoriasTab() {
  const [categories, setCategories]   = useState<TNCategory[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [editing, setEditing]         = useState<EditingCategory | null>(null);
  const [saving, setSaving]           = useState(false);
  const [toast, setToast]             = useState<Toast | null>(null);
  const toastTimer                    = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (type: 'ok' | 'err', msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, msg });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };

  const loadData = async () => {
    setError(null);
    setLoading(true);
    try {
      const settings = getSettings();
      const storeId  = settings?.tiendanubeStoreId?.trim() ?? '';
      const token    = settings?.tiendanubeToken?.trim()    ?? '';
      if (!storeId || !token) {
        setError('Configurá tu Store ID y Access Token en Configuración → TiendaNube API.');
        setLoading(false);
        return;
      }
      const data = await fetchTNCategories(storeId, token);
      setCategories(data);
    } catch (err) {
      setError('No se pudo cargar las categorías.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleSave = async (cat: TNCategory) => {
    if (!editing) return;
    setSaving(true);
    try {
      const settings = getSettings();
      const storeId  = settings?.tiendanubeStoreId?.trim() ?? '';
      const token    = settings?.tiendanubeToken?.trim()    ?? '';
      if (!storeId || !token) throw new Error('Sin credenciales');

      await updateTNCategory(storeId, token, cat.id, { name: { es: editing.name } });
      setCategories(prev => prev.map(c =>
        c.id === cat.id ? { ...c, name: { ...c.name, es: editing.name } } : c
      ));
      showToast('ok', `Categoría actualizada a "${editing.name}".`);
      setEditing(null);
    } catch (e) {
      showToast('err', `No se pudo actualizar. ${e}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="tienda-state glass-panel">
        <RefreshCw size={24} className="spinning" />
        <span>Cargando categorías...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tienda-state tienda-state-error glass-panel">
        <AlertCircle size={32} className="tienda-state-icon" />
        <p>{error}</p>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="tienda-state glass-panel">
        <Store size={32} className="tienda-state-icon" />
        <p>No hay categorías en la tienda.</p>
      </div>
    );
  }

  return (
    <>
      <div className="tienda-controls">
        <span className="text-muted tienda-count">
          {categories.length} categoría{categories.length !== 1 ? 's' : ''}
        </span>
        <button className="btn-secondary tienda-refresh-btn" onClick={loadData}>
          <RefreshCw size={14} />
          Actualizar
        </button>
      </div>

      <div className="tn-table-wrapper glass-panel">
        <table className="tn-table">
          <thead>
            <tr>
              <th>Nombre (es)</th>
              <th>Subcategorías</th>
              <th>ID</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {categories.map(cat => {
              const nombre    = cat.name.es ?? cat.name.en ?? Object.values(cat.name).find(v => v) ?? `#${cat.id}`;
              const isEditing = editing?.id === cat.id;
              return (
                <tr key={cat.id} className={isEditing ? 'tienda-row-editing' : ''}>
                  <td className="tienda-td-nombre">
                    {isEditing ? (
                      <input
                        type="text"
                        className="tienda-inline-input tienda-inline-input-wide"
                        value={editing.name}
                        onChange={e => setEditing(prev => prev ? { ...prev, name: e.target.value } : prev)}
                        autoFocus
                      />
                    ) : (
                      nombre
                    )}
                  </td>
                  <td className="tienda-td-subcat">
                    {cat.subcategories.length > 0
                      ? <span className="tienda-subcat-badge">{cat.subcategories.length}</span>
                      : <span className="text-muted">—</span>}
                  </td>
                  <td className="tn-td-num" style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                    {cat.id}
                  </td>
                  <td className="tienda-td-actions">
                    {isEditing ? (
                      <div className="tienda-edit-actions">
                        <button
                          className="tienda-save-btn"
                          onClick={() => handleSave(cat)}
                          disabled={saving}
                          title="Guardar"
                        >
                          {saving ? <RefreshCw size={13} className="spinning" /> : <CheckCircle2 size={13} />}
                        </button>
                        <button
                          className="tienda-cancel-btn"
                          onClick={() => setEditing(null)}
                          disabled={saving}
                          title="Cancelar"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <button
                        className="cupon-edit-btn"
                        onClick={() => setEditing({ id: cat.id, name: nombre })}
                        title="Editar nombre"
                      >
                        <Pencil size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`cupon-toast ${toast.type}`}>
          {toast.type === 'ok' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          {toast.msg}
        </div>
      )}
    </>
  );
}

// ── Stock ──────────────────────────────────────────────────────────────────────

const FILTER_KEY = 'stock-filter-tab';
type StockSortKey = 'nombre' | 'sku' | 'stock' | 'precio';
type StockSortDir = 'asc' | 'desc';
type FilterTab = 'todos' | 'con-stock' | 'sin-stock' | 'ocultos';

interface StockToast { id: number; message: string; type: 'ok' | 'err'; }

function StockTab() {
  const [items, setItems]           = useState<StockItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [updating, setUpdating]     = useState(false);
  const [syncDone, setSyncDone]     = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [search, setSearch]         = useState('');
  const [sortKey, setSortKey]       = useState<StockSortKey>('nombre');
  const [sortDir, setSortDir]       = useState<StockSortDir>('asc');
  const [noConfig, setNoConfig]     = useState(false);
  const [hiddenSkus, setHiddenSkus] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab]   = useState<FilterTab>(
    () => (localStorage.getItem(FILTER_KEY) as FilterTab) || 'todos'
  );
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [hidingAll, setHidingAll]   = useState(false);
  const [showingAll, setShowingAll] = useState(false);
  const [toasts, setToasts]         = useState<StockToast[]>([]);
  const addToast = (message: string, type: 'ok' | 'err' = 'ok') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  };

  const loadHidden = async () => {
    try {
      const data = await fetchProductosOcultos();
      setHiddenSkus(new Set(data.map((d: { sku: string }) => d.sku)));
    } catch { /* silent */ }
  };

  const loadData = async () => {
    setError(null);
    try {
      const settings = getSettings();
      const storeId  = settings?.tiendanubeStoreId?.trim() ?? '';
      const token    = settings?.tiendanubeToken?.trim()    ?? '';
      if (!storeId || !token) { setNoConfig(true); setLoading(false); return; }
      setNoConfig(false);
      const data = await fetchTNProducts(storeId, token);
      setItems(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError('No se pudo cargar el stock desde TiendaNube.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); loadHidden(); }, []);

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
    } catch { addToast('Error al ocultar el producto', 'err'); }
    finally { setActionLoading(prev => ({ ...prev, [sku]: false })); }
  };

  const handleShowProduct = async (sku: string, nombre: string) => {
    setActionLoading(prev => ({ ...prev, [sku]: true }));
    try {
      await deleteProductoOculto(sku);
      setHiddenSkus(prev => { const s = new Set(prev); s.delete(sku); return s; });
      addToast(`"${nombre}" visible nuevamente`);
    } catch { addToast('Error al mostrar el producto', 'err'); }
    finally { setActionLoading(prev => ({ ...prev, [sku]: false })); }
  };

  const handleHideAllNoStock = async () => {
    const toHide = items.filter(i => i.stock === 0 && !hiddenSkus.has(i.sku));
    if (toHide.length === 0) { addToast('No hay productos sin stock para ocultar'); return; }
    setHidingAll(true);
    try {
      await insertProductosOcultosBulk(toHide.map(i => ({ sku: i.sku, nombre: i.nombre })));
      setHiddenSkus(prev => new Set([...prev, ...toHide.map(i => i.sku)]));
      addToast(`${toHide.length} producto${toHide.length !== 1 ? 's' : ''} ocultado${toHide.length !== 1 ? 's' : ''}`);
    } catch { addToast('Error al ocultar productos sin stock', 'err'); }
    finally { setHidingAll(false); }
  };

  const handleShowAll = async () => {
    if (hiddenSkus.size === 0) { addToast('No hay productos ocultos'); return; }
    setShowingAll(true);
    try {
      await deleteAllProductosOcultos();
      setHiddenSkus(new Set());
      addToast('Todos los productos son visibles nuevamente');
    } catch { addToast('Error al mostrar todos los productos', 'err'); }
    finally { setShowingAll(false); }
  };

  const handleUpdate = async () => {
    setUpdating(true); setSyncDone(false);
    await loadData();
    setUpdating(false); setSyncDone(true);
    setTimeout(() => setSyncDone(false), 3000);
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
    return base.filter(i => i.nombre.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q));
  }, [items, search, activeTab, hiddenSkus]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const va = a[sortKey], vb = b[sortKey];
      if (typeof va === 'number' && typeof vb === 'number')
        return sortDir === 'asc' ? va - vb : vb - va;
      return sortDir === 'asc'
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });
  }, [filtered, sortKey, sortDir]);

  const handleSort = (key: StockSortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const sinStock  = items.filter(i => i.stock === 0 && !hiddenSkus.has(i.sku)).length;
  const stockBajo = items.filter(i => i.stock > 0 && i.stock < 5 && !hiddenSkus.has(i.sku)).length;
  const conStock  = items.filter(i => i.stock >= 5 && !hiddenSkus.has(i.sku)).length;
  const ocultos   = hiddenSkus.size;

  return (
    <>
      {/* Toasts */}
      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map(t => (
            <div key={t.id} className={`toast toast-${t.type}`}>{t.message}</div>
          ))}
        </div>
      )}

      {/* Bloque 1: Resumen de stock */}
      {items.length > 0 && (
        <div className="stock-block">
          <p className="stock-block-label">Resumen de stock</p>
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
        </div>
      )}

      {/* Bloque 2: Controles */}
      {!loading && !noConfig && !error && (
        <div className="stock-block">
          <p className="stock-block-label">Controles</p>
          <div className="stock-controls-block glass-panel">
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
              <button className="btn-primary update-btn" onClick={handleUpdate} disabled={updating || loading}>
                {updating ? (
                  <><RefreshCw size={15} className="spinning" /> Cargando...</>
                ) : syncDone ? (
                  <>✓ Actualizado</>
                ) : (
                  <><RefreshCw size={15} /> Actualizar</>
                )}
              </button>
              {lastUpdated && (
                <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                  {lastUpdated.toLocaleTimeString('es-AR')}
                </span>
              )}
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
                <button className="btn-action" onClick={handleHideAllNoStock} disabled={hidingAll || showingAll}>
                  {hidingAll ? <RefreshCw size={13} className="spinning" /> : <EyeOff size={13} />}
                  {hidingAll ? 'Ocultando...' : 'Ocultar sin stock'}
                </button>
                <button className="btn-action btn-action-ghost" onClick={handleShowAll} disabled={showingAll || ocultos === 0}>
                  {showingAll ? <RefreshCw size={13} className="spinning" /> : <Eye size={13} />}
                  {showingAll ? 'Mostrando...' : 'Mostrar todos'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Estados */}
      {loading ? (
        <div className="stock-state glass-panel">
          <RefreshCw size={24} className="spinning" />
          <span>Cargando stock...</span>
        </div>
      ) : noConfig ? (
        <div className="stock-state glass-panel">
          <Package size={40} className="stock-state-icon" />
          <h3>Sin configuración</h3>
          <p>Configurá tu Store ID y Access Token en Configuración → TiendaNube API.</p>
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
          <p>{activeTab === 'ocultos' ? 'No hay productos ocultos.' : 'No hay productos que coincidan.'}</p>
        </div>
      ) : (
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
                const isHidden  = hiddenSkus.has(item.sku);
                const isLoading = !!actionLoading[item.sku];
                return (
                  <tr key={i} className={
                    isHidden ? 'row-hidden'
                    : item.stock === 0 ? 'row-no-stock'
                    : item.stock < 5  ? 'row-low-stock'
                    : ''
                  }>
                    <td className="cell-nombre">
                      {item.nombre}
                      {isHidden && <span className="badge-hidden">Oculto</span>}
                    </td>
                    <td className="cell-sku">{item.sku || '—'}</td>
                    <td className="cell-stock">
                      <span className={`stock-badge ${
                        item.stock === 0 ? 'badge-danger' : item.stock < 5 ? 'badge-warning' : 'badge-ok'
                      }`}>{item.stock}</span>
                    </td>
                    <td className="cell-precio">${item.precio.toLocaleString('es-AR')}</td>
                    <td className="cell-fecha">{item.fechaActualizacion || '—'}</td>
                    <td className="cell-visibility">
                      <button
                        className={`btn-eye ${isHidden ? 'btn-eye-show' : 'btn-eye-hide'}`}
                        onClick={() => isHidden
                          ? handleShowProduct(item.sku, item.nombre)
                          : handleHideProduct(item.sku, item.nombre)
                        }
                        disabled={isLoading}
                        title={isHidden ? 'Mostrar producto' : 'Ocultar producto'}
                      >
                        {isLoading ? <RefreshCw size={14} className="spinning" /> : isHidden ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ── Clientes ───────────────────────────────────────────────────────────────────

const fmtARS = (n: number) =>
  n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 });

type SortKey = 'total_spent' | 'orders_count' | 'created_at';

const MIN_ORDERS_OPTIONS = [
  { value: 0, label: 'Todos' },
  { value: 1, label: '1+' },
  { value: 2, label: '2+' },
  { value: 5, label: '5+' },
  { value: 10, label: '10+' },
] as const;

function ClientesTab() {
  const [customers, setCustomers] = useState<TNCustomer[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [search, setSearch]       = useState('');
  const [minOrders, setMinOrders] = useState<number>(0);
  const [sortKey, setSortKey]     = useState<SortKey>('total_spent');
  const [selectedCustomer, setSelectedCustomer] = useState<TNCustomer | null>(null);
  const [customerOrders, setCustomerOrders]     = useState<TNOrder[]>([]);
  const [loadingOrders, setLoadingOrders]       = useState(false);

  const loadData = async (force = false) => {
    setError(null);
    if (!force) setLoading(true);
    try {
      const settings = getSettings();
      const storeId  = settings?.tiendanubeStoreId?.trim() ?? '';
      const token    = settings?.tiendanubeToken?.trim()    ?? '';
      if (!storeId || !token) {
        setError('Configurá tu Store ID y Access Token en Configuración → TiendaNube API.');
        setLoading(false);
        return;
      }
      const data = await fetchTNCustomers(storeId, token);
      setCustomers(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError('No se pudo cargar la lista de clientes.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openCustomer = async (c: TNCustomer) => {
    setSelectedCustomer(c);
    setCustomerOrders([]);
    setLoadingOrders(true);
    try {
      const settings = getSettings();
      const storeId  = settings?.tiendanubeStoreId?.trim() ?? '';
      const token    = settings?.tiendanubeToken?.trim()    ?? '';
      const orders = await fetchTNCustomerOrders(storeId, token, c.id);
      setCustomerOrders(orders);
    } catch (err) {
      console.error('Error cargando órdenes del cliente:', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let base = minOrders === 0 ? customers : customers.filter(c => c.orders_count >= minOrders);
    if (q) base = base.filter(c => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
    return [...base].sort((a, b) => {
      if (sortKey === 'total_spent')  return parseFloat(b.total_spent) - parseFloat(a.total_spent);
      if (sortKey === 'orders_count') return b.orders_count - a.orders_count;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [customers, search, minOrders, sortKey]);

  const totalGastado = customers.reduce((s, c) => s + parseFloat(c.total_spent), 0);
  const promedio     = customers.length > 0 ? totalGastado / customers.length : 0;
  const isFiltered   = filtered.length !== customers.length;

  return (
    <>
      {/* Stats strip */}
      {!loading && customers.length > 0 && (
        <div className="clientes-stats">
          <div className="clientes-stat glass-panel">
            <span className="clientes-stat-value">{customers.length.toLocaleString('es-AR')}</span>
            <span className="clientes-stat-label">Total clientes</span>
          </div>
          <div className="clientes-stat glass-panel">
            <span className="clientes-stat-value">{fmtARS(totalGastado)}</span>
            <span className="clientes-stat-label">Total gastado</span>
          </div>
          <div className="clientes-stat glass-panel">
            <span className="clientes-stat-value">{fmtARS(promedio)}</span>
            <span className="clientes-stat-label">Promedio por cliente</span>
          </div>
        </div>
      )}

      {/* Controles */}
      {!loading && !error && customers.length > 0 && (
        <div className="clientes-filters glass-panel">
          <div className="clientes-search-box">
            <Search size={14} className="clientes-search-icon" />
            <input
              type="text"
              placeholder="Buscar por nombre o email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="clientes-search-input"
            />
          </div>
          <div className="clientes-filter-group">
            <span className="clientes-filter-label">Órdenes:</span>
            <div className="clientes-filter-btns">
              {MIN_ORDERS_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  className={`clientes-filter-btn ${minOrders === value ? 'active' : ''}`}
                  onClick={() => setMinOrders(value)}
                >{label}</button>
              ))}
            </div>
          </div>
          <div className="clientes-filter-group">
            <span className="clientes-filter-label">Ordenar por:</span>
            <div className="clientes-filter-btns">
              {([
                { key: 'total_spent',  label: 'Mayor gasto' },
                { key: 'orders_count', label: 'Más órdenes' },
                { key: 'created_at',   label: 'Más reciente' },
              ] as { key: SortKey; label: string }[]).map(({ key, label }) => (
                <button
                  key={key}
                  className={`clientes-filter-btn ${sortKey === key ? 'active' : ''}`}
                  onClick={() => setSortKey(key)}
                >{label}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: 'auto' }}>
            {isFiltered && (
              <span className="clientes-count-label">{filtered.length} de {customers.length}</span>
            )}
            {lastUpdated && (
              <span className="clientes-count-label">· {lastUpdated.toLocaleTimeString('es-AR')}</span>
            )}
            <button className="btn-secondary tienda-refresh-btn" onClick={() => loadData(true)} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'spinning' : ''} />
              Actualizar
            </button>
          </div>
        </div>
      )}

      {/* Estados */}
      {loading ? (
        <div className="tienda-state glass-panel">
          <RefreshCw size={24} className="spinning" />
          <span>Cargando clientes...</span>
        </div>
      ) : error ? (
        <div className="tienda-state tienda-state-error glass-panel">
          <AlertCircle size={32} className="tienda-state-icon" />
          <p>{error}</p>
        </div>
      ) : customers.length === 0 ? (
        <div className="tienda-state glass-panel">
          <Users size={32} className="tienda-state-icon" />
          <p>No se encontraron clientes en tu tienda.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="tienda-state glass-panel">
          <Users size={32} className="tienda-state-icon" />
          <p>Ningún cliente coincide con los filtros.</p>
        </div>
      ) : (
        <div className="tn-table-wrapper glass-panel">
          <table className="tn-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Nombre</th>
                <th>Email</th>
                <th>Órdenes</th>
                <th>Total gastado</th>
                <th>Registrado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => {
                const fecha = new Date(c.created_at).toLocaleDateString('es-AR', {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                  timeZone: 'America/Argentina/Buenos_Aires',
                });
                return (
                  <tr key={c.id} className="clientes-row-clickable" onClick={() => openCustomer(c)}>
                    <td className="tn-td-num">{i + 1}</td>
                    <td className="tn-td-cliente"><span className="tn-client-name">{c.name || '—'}</span></td>
                    <td className="tn-td-cliente"><span className="tn-client-email">{c.email || '—'}</span></td>
                    <td className="clientes-td-orders">{c.orders_count}</td>
                    <td className="tn-td-total">{fmtARS(parseFloat(c.total_spent))}</td>
                    <td className="tn-td-fecha">{fecha}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Panel de detalle */}
      {selectedCustomer && (
        <div className="cliente-detail-overlay" onClick={() => setSelectedCustomer(null)}>
          <div className="cliente-detail-panel glass-panel" onClick={e => e.stopPropagation()}>
            <div className="cliente-detail-header">
              <div className="cliente-detail-title">
                <Users size={18} className="section-icon" />
                <h2>{selectedCustomer.name || 'Cliente sin nombre'}</h2>
              </div>
              <button className="rec-close-btn" onClick={() => setSelectedCustomer(null)}><X size={18} /></button>
            </div>
            <div className="cliente-detail-info">
              {selectedCustomer.email && (
                <div className="cliente-detail-info-row">
                  <Mail size={13} className="cliente-detail-info-icon" />
                  <span>{selectedCustomer.email}</span>
                </div>
              )}
              {selectedCustomer.phone && (
                <div className="cliente-detail-info-row">
                  <Phone size={13} className="cliente-detail-info-icon" />
                  <span>{selectedCustomer.phone}</span>
                </div>
              )}
              <div className="cliente-detail-info-row">
                <Calendar size={13} className="cliente-detail-info-icon" />
                <span>Registrado el {new Date(selectedCustomer.created_at).toLocaleDateString('es-AR', {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                  timeZone: 'America/Argentina/Buenos_Aires',
                })}</span>
              </div>
            </div>
            <div className="cliente-detail-stats">
              <div className="cliente-detail-stat">
                <span className="cliente-detail-stat-value">{selectedCustomer.orders_count}</span>
                <span className="cliente-detail-stat-label">Órdenes</span>
              </div>
              <div className="cliente-detail-stat">
                <span className="cliente-detail-stat-value">{fmtARS(parseFloat(selectedCustomer.total_spent))}</span>
                <span className="cliente-detail-stat-label">Total gastado</span>
              </div>
            </div>
            <div className="cliente-detail-orders-title">
              <ShoppingBag size={14} className="section-icon" />
              <span>Compras</span>
            </div>
            {loadingOrders ? (
              <div className="cliente-detail-loading">
                <RefreshCw size={18} className="spinning" />
                <span>Cargando compras...</span>
              </div>
            ) : customerOrders.length === 0 ? (
              <p className="cliente-detail-empty">No se encontraron compras registradas.</p>
            ) : (
              <div className="cliente-orders-list">
                {customerOrders.map(o => (
                  <div key={o.id} className="cliente-order-row">
                    <div className="cliente-order-meta">
                      <span className="cliente-order-num">#{o.number}</span>
                      <span className={`tn-status-badge status-${o.payment_status}`}>
                        {o.payment_status === 'paid' ? 'Pagado' :
                         o.payment_status === 'pending' ? 'Pendiente' :
                         o.payment_status === 'refunded' ? 'Reembolsado' :
                         o.payment_status === 'voided' ? 'Anulado' :
                         o.payment_status}
                      </span>
                      <span className="cliente-order-date">
                        {new Date(o.created_at).toLocaleDateString('es-AR', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          timeZone: 'America/Argentina/Buenos_Aires',
                        })}
                      </span>
                    </div>
                    <span className="cliente-order-total">{fmtARS(parseFloat(o.total))}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ── Cupones ────────────────────────────────────────────────────────────────────

const TN_COUPONS_BASE = 'https://api.tiendanube.com/v1';

type TipoDescuento = 'percentage' | 'absolute' | 'shipping';

interface Cupon {
  id: number | string;
  code: string;
  type: TipoDescuento;
  value: string | number;
  valid: boolean;
  used: number;
  max_uses: number | null;
  min_price: string | number | null;
  end_date: string | null;
  is_deleted: boolean;
}

interface CuponFormState {
  code: string;
  type: TipoDescuento;
  value: string;
  min_price: string;
  max_uses: string;
  valid_until: string;
}

const CUPON_FORM_EMPTY: CuponFormState = {
  code: '', type: 'percentage', value: '', min_price: '', max_uses: '', valid_until: '',
};

function formatTipo(type: TipoDescuento, value: string | number): string {
  const v = parseFloat(String(value));
  if (type === 'percentage') return `${v}% de descuento`;
  if (type === 'absolute')   return `$${v.toLocaleString('es-AR')} de descuento`;
  return 'Envío gratis';
}

function formatFecha(date: string | null): string {
  if (!date) return '—';
  return new Date(date + 'T00:00:00').toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function normalizeCupones(raw: unknown): Cupon[] {
  if (Array.isArray(raw)) {
    if (raw.length > 0 && raw[0] !== null && typeof raw[0] === 'object' && 'json' in (raw[0] as object)) {
      return normalizeCupones((raw as { json: unknown }[])[0].json);
    }
    return raw as Cupon[];
  }
  if (raw !== null && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    for (const key of ['cupones', 'coupons', 'data', 'result', 'items']) {
      if (Array.isArray(obj[key])) return obj[key] as Cupon[];
    }
  }
  return [];
}

function TipoIcon({ type }: { type: TipoDescuento }) {
  if (type === 'percentage') return <Percent size={13} />;
  if (type === 'absolute')   return <DollarSign size={13} />;
  return <Truck size={13} />;
}

function EstadoBadge({ valid, is_deleted }: { valid: boolean; is_deleted: boolean }) {
  const on = valid && !is_deleted;
  return (
    <span className={`cupon-estado ${on ? 'activo' : 'inactivo'}`}>
      {is_deleted ? 'Eliminado' : on ? 'Activo' : 'Inactivo'}
    </span>
  );
}

function CuponesTab() {
  const [cupones,      setCupones]      = useState<Cupon[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [showForm,     setShowForm]     = useState(false);
  const [form,         setForm]         = useState<CuponFormState>(CUPON_FORM_EMPTY);
  const [creating,     setCreating]     = useState(false);
  const [toastC,       setToastC]       = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [editingCupon, setEditingCupon] = useState<Cupon | null>(null);
  const [editForm,     setEditForm]     = useState<CuponFormState>(CUPON_FORM_EMPTY);
  const [updating,     setUpdating]     = useState(false);

  const showToast = (type: 'ok' | 'err', msg: string) => {
    setToastC({ type, msg });
    setTimeout(() => setToastC(null), 4000);
  };

  const fetchCupones = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const settings = getSettings();
      const storeId  = settings?.tiendanubeStoreId?.trim() ?? '';
      const token    = settings?.tiendanubeToken?.trim()    ?? '';
      if (!storeId || !token) throw new Error('Configurá el Store ID y Token en Ajustes.');
      const all: Cupon[] = [];
      for (let page = 1; page <= 100; page++) {
        const res = await fetch(`/api/tiendanube?${new URLSearchParams({ storeId, token, path: 'coupons', per_page: '30', page: String(page) })}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as Cupon[];
        if (!Array.isArray(data) || data.length === 0) break;
        all.push(...data);
        const link = res.headers.get('Link') ?? '';
        if (data.length < 30 || !link.includes('rel="next"')) break;
      }
      setCupones(all.filter(c => !c.is_deleted));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCupones(); }, [fetchCupones]);

  const handleField     = (k: keyof CuponFormState, v: string) => setForm(p => ({ ...p, [k]: v }));
  const handleEditField = (k: keyof CuponFormState, v: string) => setEditForm(p => ({ ...p, [k]: v }));

  const handleStartEdit = (c: Cupon) => {
    setEditingCupon(c);
    setEditForm({
      code:        c.code,
      type:        c.type,
      value:       c.type !== 'shipping' ? String(parseFloat(String(c.value)) || '') : '0',
      min_price:   c.min_price   != null ? String(parseFloat(String(c.min_price))) : '',
      max_uses:    c.max_uses    != null ? String(c.max_uses) : '',
      valid_until: c.end_date    ?? '',
    });
    setShowForm(false);
  };

  const handleSaveEdit = async () => {
    if (!editingCupon) return;
    const settings = getSettings();
    const storeId  = settings?.tiendanubeStoreId?.trim() ?? '';
    const token    = settings?.tiendanubeToken?.trim()    ?? '';
    if (!storeId || !token) { showToast('err', 'Configurá el Store ID y Token en Ajustes.'); return; }
    setUpdating(true);
    const body: Record<string, unknown> = {
      type:  editForm.type,
      value: editForm.type !== 'shipping' ? parseFloat(editForm.value) || 0 : 0,
    };
    if (editForm.min_price)   body.min_price   = parseFloat(editForm.min_price);
    if (editForm.max_uses)    body.max_uses    = parseInt(editForm.max_uses);
    if (editForm.valid_until) body.valid_until = editForm.valid_until;
    const tnH: Record<string, string> = {
      Authentication: `bearer ${token}`,
      'User-Agent':   'NovaDashboard (contact@fromnorthgb.com)',
      'Content-Type': 'application/json',
    };
    try {
      let res: Response;
      try {
        res = await fetch(`${TN_COUPONS_BASE}/${storeId}/coupons/${editingCupon.id}`, {
          method: 'PUT', headers: tnH, body: JSON.stringify(body),
        });
      } catch {
        const qs = new URLSearchParams({ storeId, token, path: `coupons/${editingCupon.id}` });
        res = await fetch(`/api/tiendanube?${qs}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast('ok', `Cupón "${editingCupon.code}" actualizado.`);
      setEditingCupon(null);
      fetchCupones();
    } catch (e) {
      showToast('err', `No se pudo actualizar. ${e}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleCreate = async () => {
    if (!form.code.trim() || !form.value.trim()) { showToast('err', 'El código y el valor son obligatorios.'); return; }
    setCreating(true);
    try {
      const body: Record<string, unknown> = {
        code:  form.code.trim().toUpperCase(),
        type:  form.type,
        value: parseFloat(form.value),
      };
      if (form.min_price)   body.min_price   = parseFloat(form.min_price);
      if (form.max_uses)    body.max_uses    = parseInt(form.max_uses);
      if (form.valid_until) body.valid_until = form.valid_until;
      const settings = getSettings();
      const storeId  = settings?.tiendanubeStoreId?.trim() ?? '';
      const token    = settings?.tiendanubeToken?.trim()    ?? '';
      if (!storeId || !token) { showToast('err', 'Configurá el Store ID y Token en Ajustes.'); setCreating(false); return; }
      const res = await fetch(`/api/tiendanube?${new URLSearchParams({ storeId, token, path: 'coupons' })}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast('ok', `Cupón "${body.code}" creado correctamente.`);
      setForm(CUPON_FORM_EMPTY);
      setShowForm(false);
      fetchCupones();
    } catch (e) {
      showToast('err', `No se pudo crear el cupón. ${e}`);
    } finally {
      setCreating(false);
    }
  };

  const tipoOptions = [
    { key: 'percentage' as TipoDescuento, label: '% Descuento', icon: <Percent size={13} /> },
    { key: 'absolute'   as TipoDescuento, label: '$ Fijo',       icon: <DollarSign size={13} /> },
    { key: 'shipping'   as TipoDescuento, label: 'Envío gratis', icon: <Truck size={13} /> },
  ];

  return (
    <>
      {/* Acciones */}
      <div className="tienda-controls">
        <button className="btn-secondary tienda-refresh-btn" onClick={fetchCupones} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spinning' : ''} />
          {loading ? 'Cargando...' : 'Actualizar'}
        </button>
        <button className="btn-primary cupones-btn-nuevo" onClick={() => { setShowForm(v => !v); setEditingCupon(null); }}>
          {showForm ? <X size={15} /> : <Plus size={15} />}
          {showForm ? 'Cancelar' : 'Nuevo cupón'}
        </button>
      </div>

      {/* Form edición */}
      {editingCupon && (
        <div className="cupones-form glass-panel fade-in">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.1rem' }}>
            <h2 className="cupones-form-title" style={{ margin: 0 }}>
              Editar — <span style={{ color: 'var(--accent-primary)', fontFamily: 'monospace' }}>{editingCupon.code}</span>
            </h2>
            <button className="btn-secondary" onClick={() => setEditingCupon(null)} style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem' }}>
              <X size={13} /> Cancelar
            </button>
          </div>
          <div className="cupones-form-grid">
            <div className="form-field">
              <label className="form-label">Tipo *</label>
              <div className="form-tipo-group">
                {tipoOptions.map(t => (
                  <button key={t.key} className={`tipo-btn ${editForm.type === t.key ? 'active' : ''}`}
                    onClick={() => handleEditField('type', t.key)} type="button">
                    {t.icon}{t.label}
                  </button>
                ))}
              </div>
            </div>
            {editForm.type !== 'shipping' && (
              <div className="form-field">
                <label className="form-label">{editForm.type === 'percentage' ? 'Porcentaje (%)' : 'Monto ($)'} *</label>
                <input className="form-input" type="number" min="0" value={editForm.value}
                  onChange={e => handleEditField('value', e.target.value)} />
              </div>
            )}
            <div className="form-field">
              <label className="form-label">Compra mínima ($) <span className="form-label-opt">opcional</span></label>
              <input className="form-input" type="number" min="0" placeholder="Ej: 5000" value={editForm.min_price}
                onChange={e => handleEditField('min_price', e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label">Límite de usos <span className="form-label-opt">opcional</span></label>
              <input className="form-input" type="number" min="1" placeholder="Vacío = ilimitado" value={editForm.max_uses}
                onChange={e => handleEditField('max_uses', e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label">Vence el <span className="form-label-opt">opcional</span></label>
              <input className="form-input" type="date" value={editForm.valid_until}
                onChange={e => handleEditField('valid_until', e.target.value)} />
            </div>
          </div>
          <div className="cupones-form-footer">
            <button className="btn-primary" onClick={handleSaveEdit} disabled={updating}>
              {updating ? <><RefreshCw size={14} className="spinning" /> Guardando...</> : <><Pencil size={14} /> Guardar cambios</>}
            </button>
          </div>
        </div>
      )}

      {/* Form creación */}
      {showForm && (
        <div className="cupones-form glass-panel fade-in">
          <h2 className="cupones-form-title">Nuevo cupón</h2>
          <div className="cupones-form-grid">
            <div className="form-field">
              <label className="form-label">Código *</label>
              <input className="form-input" placeholder="Ej: VERANO20" value={form.code}
                onChange={e => handleField('code', e.target.value.toUpperCase())} maxLength={30} />
            </div>
            <div className="form-field">
              <label className="form-label">Tipo *</label>
              <div className="form-tipo-group">
                {tipoOptions.map(t => (
                  <button key={t.key} className={`tipo-btn ${form.type === t.key ? 'active' : ''}`}
                    onClick={() => handleField('type', t.key)} type="button">
                    {t.icon}{t.label}
                  </button>
                ))}
              </div>
            </div>
            {form.type !== 'shipping' && (
              <div className="form-field">
                <label className="form-label">{form.type === 'percentage' ? 'Porcentaje (%)' : 'Monto ($)'} *</label>
                <input className="form-input" type="number" min="0"
                  placeholder={form.type === 'percentage' ? 'Ej: 20' : 'Ej: 500'}
                  value={form.value} onChange={e => handleField('value', e.target.value)} />
              </div>
            )}
            <div className="form-field">
              <label className="form-label">Compra mínima ($) <span className="form-label-opt">opcional</span></label>
              <input className="form-input" type="number" min="0" placeholder="Ej: 5000" value={form.min_price}
                onChange={e => handleField('min_price', e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label">Límite de usos <span className="form-label-opt">opcional</span></label>
              <input className="form-input" type="number" min="1" placeholder="Ej: 100 (vacío = ilimitado)" value={form.max_uses}
                onChange={e => handleField('max_uses', e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label">Vence el <span className="form-label-opt">opcional</span></label>
              <input className="form-input" type="date" value={form.valid_until}
                onChange={e => handleField('valid_until', e.target.value)} />
            </div>
          </div>
          <div className="cupones-form-footer">
            <button className="btn-primary" onClick={handleCreate} disabled={creating}>
              {creating ? <><RefreshCw size={14} className="spinning" /> Creando...</> : <><Plus size={14} /> Crear cupón</>}
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="cupones-lista glass-panel">
        <div className="cupones-lista-header">
          <span className="cupones-lista-title">Cupones existentes</span>
          {!loading && <span className="cupones-lista-count">{cupones.length} total</span>}
        </div>
        {loading && <div className="cupones-loading"><RefreshCw size={18} className="spinning" /><span>Cargando cupones...</span></div>}
        {!loading && error && (
          <div className="cupones-error">
            <AlertCircle size={16} />
            <span>No se pudieron cargar los cupones — {error}</span>
            <button className="btn-secondary" onClick={fetchCupones} style={{ fontSize: '0.75rem', padding: '0.3rem 0.7rem' }}>Reintentar</button>
          </div>
        )}
        {!loading && !error && cupones.length === 0 && (
          <div className="cupones-empty">
            <Tag size={32} className="cupones-empty-icon" />
            <p>No hay cupones todavía</p>
            <p className="cupones-empty-sub">Creá el primero con el botón "Nuevo cupón"</p>
          </div>
        )}
        {!loading && !error && cupones.length > 0 && (
          <div className="cupones-table-wrap">
            <table className="cupones-table">
              <thead>
                <tr>
                  <th>Código</th><th>Tipo</th><th>Compra mín.</th><th>Usos</th><th>Vence</th><th>Estado</th><th></th>
                </tr>
              </thead>
              <tbody>
                {cupones.map(c => (
                  <tr key={c.id}>
                    <td><span className="cupon-code">{c.code}</span></td>
                    <td><span className="cupon-tipo"><TipoIcon type={c.type} />{formatTipo(c.type, c.value)}</span></td>
                    <td className="cupon-secondary">{c.min_price ? `$${parseFloat(String(c.min_price)).toLocaleString('es-AR')}` : '—'}</td>
                    <td className="cupon-secondary">{c.max_uses != null ? `${c.used} / ${c.max_uses}` : `${c.used} usos`}</td>
                    <td className="cupon-secondary">{formatFecha(c.end_date)}</td>
                    <td><EstadoBadge valid={c.valid} is_deleted={c.is_deleted} /></td>
                    <td>
                      <button className="cupon-edit-btn" onClick={() => handleStartEdit(c)} title="Editar cupón" disabled={c.is_deleted}>
                        <Pencil size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {toastC && (
        <div className={`cupon-toast ${toastC.type}`}>
          {toastC.type === 'ok' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          {toastC.msg}
        </div>
      )}
    </>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function Tienda() {
  const [tab, setTab] = useState<Tab>('stock');

  const tabLabels: { key: Tab; label: string }[] = [
    { key: 'stock',      label: 'Stock' },
    { key: 'productos',  label: 'Productos' },
    { key: 'categorias', label: 'Categorías' },
    { key: 'clientes',   label: 'Clientes' },
    { key: 'cupones',    label: 'Cupones' },
  ];

  return (
    <div className="tienda-page fade-in">

      {/* ── Header ── */}
      <header className="tienda-header">
        <div className="tienda-header-left">
          <Store size={22} className="tienda-title-icon" />
          <div>
            <h1 className="tienda-title">Gestión de tienda</h1>
            <p className="tienda-subtitle">Productos, categorías, clientes y cupones</p>
          </div>
        </div>
      </header>

      {/* ── Tabs ── */}
      <div className="tienda-tabs">
        {tabLabels.map(({ key, label }) => (
          <button
            key={key}
            className={`tienda-tab ${tab === key ? 'active' : ''}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      {tab === 'stock'      && <StockTab />}
      {tab === 'productos'  && <ProductosTab />}
      {tab === 'categorias' && <CategoriasTab />}
      {tab === 'clientes'   && <ClientesTab />}
      {tab === 'cupones'    && <CuponesTab />}
    </div>
  );
}
