import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Store, RefreshCw, Search, Pencil, X,
  CheckCircle2, AlertCircle,
} from 'lucide-react';
import { getSettings } from '../services/dataService';
import {
  fetchTNProductsForManagement,
  fetchTNCategories,
  updateTNCategory,
  updateTNProductVariant,
} from '../services/tiendanubeService';
import type { StockItemWithIds, TNCategory } from '../services/tiendanubeService';
import './Tienda.css';
import './TiendanubeVentas.css';

type Tab = 'productos' | 'categorias';

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

// ── Main Component ─────────────────────────────────────────────────────────────

export default function Tienda() {
  const [tab, setTab] = useState<Tab>('productos');

  return (
    <div className="tienda-page fade-in">

      {/* ── Header ── */}
      <header className="tienda-header">
        <div className="tienda-header-left">
          <Store size={22} className="tienda-title-icon" />
          <div>
            <h1 className="tienda-title">Gestión de tienda</h1>
            <p className="tienda-subtitle">Editá precios, stock y categorías de tu tienda</p>
          </div>
        </div>
      </header>

      {/* ── Tabs ── */}
      <div className="tienda-tabs">
        <button
          className={`tienda-tab ${tab === 'productos' ? 'active' : ''}`}
          onClick={() => setTab('productos')}
        >
          Productos
        </button>
        <button
          className={`tienda-tab ${tab === 'categorias' ? 'active' : ''}`}
          onClick={() => setTab('categorias')}
        >
          Categorías
        </button>
      </div>

      {/* ── Tab Content ── */}
      {tab === 'productos' ? <ProductosTab /> : <CategoriasTab />}
    </div>
  );
}
