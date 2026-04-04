import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Tag, Plus, RefreshCw, AlertCircle,
  CheckCircle2, Percent, DollarSign, Truck, X, Pencil,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { getSettings } from '../services/dataService';
import './Cupones.css';

// ── Config ────────────────────────────────────────────────────────────────────

const WEBHOOK_GET   = 'https://devwebhookn8n.santafeia.shop/webhook/cupones-web-f';
const POLL_INTERVAL = 60_000; // 60 segundos
const PAGE_SIZE     = 30;

// ── Types ─────────────────────────────────────────────────────────────────────

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

interface FormState {
  code: string;
  type: TipoDescuento;
  value: string;
  min_price: string;
  max_uses: string;
  valid_until: string;
}

const FORM_EMPTY: FormState = {
  code: '',
  type: 'percentage',
  value: '',
  min_price: '',
  max_uses: '',
  valid_until: '',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Fetch todos los cupones paginando via proxy ───────────────────────────────
// TiendaNube usa since_id para paginar: cada request trae hasta 30 ítems
// con ID > since_id. Se repite hasta recibir una página vacía.

async function fetchAllCupones(storeId: string, token: string): Promise<Cupon[]> {
  const all: Cupon[] = [];
  let sinceId = 0;

  for (let guard = 0; guard < 50; guard++) {
    const params: Record<string, string> = {
      storeId, token, path: 'coupons', per_page: '30',
    };
    if (sinceId > 0) params.since_id = String(sinceId);

    const res = await fetch(`/api/tiendanube?${new URLSearchParams(params)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json() as Cupon[];
    if (!data.length) break;                          // sin más resultados

    all.push(...data);
    sinceId = Number(data[data.length - 1].id);       // avanzar cursor
  }

  return all;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TipoIcon({ type }: { type: TipoDescuento }) {
  if (type === 'percentage') return <Percent size={13} />;
  if (type === 'absolute')   return <DollarSign size={13} />;
  return <Truck size={13} />;
}

function EstadoBadge({ valid }: { valid: boolean }) {
  return (
    <span className={`cupon-estado ${valid ? 'activo' : 'inactivo'}`}>
      {valid ? 'Activo' : 'Inactivo'}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Cupones() {
  const [cupones,       setCupones]       = useState<Cupon[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [showForm,      setShowForm]      = useState(false);
  const [form,          setForm]          = useState<FormState>(FORM_EMPTY);
  const [creating,      setCreating]      = useState(false);
  const [toast,         setToast]         = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [editingCupon,  setEditingCupon]  = useState<Cupon | null>(null);
  const [editForm,      setEditForm]      = useState<FormState>(FORM_EMPTY);
  const [updating,      setUpdating]      = useState(false);
  const [page,          setPage]          = useState(1);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (type: 'ok' | 'err', msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, msg });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };

  const fetchCupones = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const settings = getSettings();
      const storeId  = settings.tiendanubeStoreId.trim();
      const token    = settings.tiendanubeToken.trim();

      let all: Cupon[];
      if (storeId && token) {
        all = await fetchAllCupones(storeId, token);
      } else {
        const res = await fetch(WEBHOOK_GET, { method: 'POST', headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        all = normalizeCupones(await res.json());
      }

      setCupones(all.filter(c => !c.is_deleted));
      setPage(1);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCupones();
    const interval = setInterval(fetchCupones, POLL_INTERVAL);
    const onVisible = () => { if (!document.hidden) fetchCupones(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchCupones]);

  const handleField = (k: keyof FormState, v: string) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const handleEditField = (k: keyof FormState, v: string) =>
    setEditForm(prev => ({ ...prev, [k]: v }));

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
    const storeId  = settings.tiendanubeStoreId.trim();
    const token    = settings.tiendanubeToken.trim();
    if (!storeId || !token) { showToast('err', 'Configurá el Store ID y Token en Ajustes.'); return; }
    setUpdating(true);
    const body: Record<string, unknown> = {
      type:  editForm.type,
      value: editForm.type !== 'shipping' ? parseFloat(editForm.value) || 0 : 0,
    };
    if (editForm.min_price)   body.min_price   = parseFloat(editForm.min_price);
    if (editForm.max_uses)    body.max_uses    = parseInt(editForm.max_uses);
    if (editForm.valid_until) body.valid_until = editForm.valid_until;

    try {
      const qs = new URLSearchParams({ storeId, token, path: `coupons/${editingCupon.id}` });
      const res = await fetch(`/api/tiendanube?${qs}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
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
    if (!form.code.trim() || (form.type !== 'shipping' && !form.value.trim())) {
      showToast('err', 'El código y el valor son obligatorios.');
      return;
    }
    const settings = getSettings();
    const storeId  = settings.tiendanubeStoreId.trim();
    const token    = settings.tiendanubeToken.trim();
    if (!storeId || !token) { showToast('err', 'Configurá el Store ID y Token en Ajustes.'); return; }
    setCreating(true);
    try {
      const body: Record<string, unknown> = {
        code:  form.code.trim().toUpperCase(),
        type:  form.type,
        value: form.type !== 'shipping' ? parseFloat(form.value) : 0,
      };
      if (form.min_price)   body.min_price   = parseFloat(form.min_price);
      if (form.max_uses)    body.max_uses    = parseInt(form.max_uses);
      if (form.valid_until) body.valid_until = form.valid_until;

      const qs = new URLSearchParams({ storeId, token, path: 'coupons' });
      const res = await fetch(`/api/tiendanube?${qs}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const nuevoCupon = await res.json() as Cupon;
      setCupones(prev => [...prev, nuevoCupon]);
      showToast('ok', `Cupón "${body.code}" creado correctamente.`);
      setForm(FORM_EMPTY);
      setShowForm(false);
      fetchCupones();
    } catch (e) {
      showToast('err', `No se pudo crear el cupón. ${e}`);
    } finally {
      setCreating(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="cupones-page fade-in">

      <div className="cupones-header glass-panel">
        <div className="cupones-header-left">
          <Tag size={20} className="cupones-header-icon" />
          <div>
            <h1 className="cupones-title">Cupones de descuento</h1>
            <p className="cupones-subtitle">Creá y gestioná los cupones de tu tienda</p>
          </div>
        </div>
        <div className="cupones-header-actions">
          <button className="btn-secondary" onClick={fetchCupones} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spinning' : ''} />
            {loading ? 'Cargando...' : 'Actualizar'}
          </button>
          <button className="btn-primary cupones-btn-nuevo" onClick={() => setShowForm(v => !v)}>
            {showForm ? <X size={15} /> : <Plus size={15} />}
            {showForm ? 'Cancelar' : 'Nuevo cupón'}
          </button>
        </div>
      </div>

      {editingCupon && (
        <div className="cupones-form glass-panel fade-in">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.1rem' }}>
            <h2 className="cupones-form-title" style={{ margin: 0 }}>
              Editar cupón — <span style={{ color: 'var(--accent-primary)', fontFamily: 'monospace' }}>{editingCupon.code}</span>
            </h2>
            <button className="btn-secondary" onClick={() => setEditingCupon(null)} style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem' }}>
              <X size={13} /> Cancelar
            </button>
          </div>
          <div className="cupones-form-grid">
            <div className="form-field">
              <label className="form-label">Tipo *</label>
              <div className="form-tipo-group">
                {([
                  { key: 'percentage', label: '% Descuento', icon: <Percent size={13} /> },
                  { key: 'absolute',   label: '$ Fijo',      icon: <DollarSign size={13} /> },
                  { key: 'shipping',   label: 'Envío gratis', icon: <Truck size={13} /> },
                ] as { key: TipoDescuento; label: string; icon: React.ReactNode }[]).map(t => (
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
              <input className="form-input" type="number" min="0" placeholder="Ej: 5000"
                value={editForm.min_price} onChange={e => handleEditField('min_price', e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label">Límite de usos <span className="form-label-opt">opcional</span></label>
              <input className="form-input" type="number" min="1" placeholder="Vacío = ilimitado"
                value={editForm.max_uses} onChange={e => handleEditField('max_uses', e.target.value)} />
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
                {([
                  { key: 'percentage', label: '% Descuento', icon: <Percent size={13} /> },
                  { key: 'absolute',   label: '$ Fijo',      icon: <DollarSign size={13} /> },
                  { key: 'shipping',   label: 'Envío gratis', icon: <Truck size={13} /> },
                ] as { key: TipoDescuento; label: string; icon: React.ReactNode }[]).map(t => (
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
              <input className="form-input" type="number" min="0" placeholder="Ej: 5000"
                value={form.min_price} onChange={e => handleField('min_price', e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label">Límite de usos <span className="form-label-opt">opcional</span></label>
              <input className="form-input" type="number" min="1" placeholder="Ej: 100 (vacío = ilimitado)"
                value={form.max_uses} onChange={e => handleField('max_uses', e.target.value)} />
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

      <div className="cupones-lista glass-panel">
        <div className="cupones-lista-header">
          <span className="cupones-lista-title">Cupones existentes</span>
          {!loading && <span className="cupones-lista-count">{cupones.length} total</span>}
        </div>

        {loading && (
          <div className="cupones-loading">
            <RefreshCw size={18} className="spinning" />
            <span>Cargando cupones...</span>
          </div>
        )}
        {!loading && error && (
          <div className="cupones-error">
            <AlertCircle size={16} />
            <span>No se pudieron cargar los cupones — {error}</span>
            <button className="btn-secondary" onClick={fetchCupones} style={{ fontSize: '0.75rem', padding: '0.3rem 0.7rem' }}>
              Reintentar
            </button>
          </div>
        )}
        {!loading && !error && cupones.length === 0 && (
          <div className="cupones-empty">
            <Tag size={32} className="cupones-empty-icon" />
            <p>No hay cupones todavía</p>
            <p className="cupones-empty-sub">Creá el primero con el botón "Nuevo cupón"</p>
          </div>
        )}
        {!loading && !error && cupones.length > 0 && (() => {
          const totalPages = Math.ceil(cupones.length / PAGE_SIZE);
          const paginated  = cupones.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
          return (
            <>
              <div className="cupones-table-wrap">
                <table className="cupones-table">
                  <thead>
                    <tr>
                      <th>Código</th><th>Tipo</th><th>Compra mín.</th>
                      <th>Usos</th><th>Vence</th><th>Estado</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map(c => (
                      <tr key={c.id}>
                        <td><span className="cupon-code">{c.code}</span></td>
                        <td>
                          <span className="cupon-tipo">
                            <TipoIcon type={c.type} />
                            {formatTipo(c.type, c.value)}
                          </span>
                        </td>
                        <td className="cupon-secondary">
                          {c.min_price ? `$${parseFloat(String(c.min_price)).toLocaleString('es-AR')}` : '—'}
                        </td>
                        <td className="cupon-secondary">
                          {c.max_uses != null ? `${c.used} / ${c.max_uses}` : `${c.used} usos`}
                        </td>
                        <td className="cupon-secondary">{formatFecha(c.end_date)}</td>
                        <td><EstadoBadge valid={c.valid} /></td>
                        <td>
                          <button className="cupon-edit-btn" onClick={() => handleStartEdit(c)} title="Editar cupón">
                            <Pencil size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="cupones-pagination">
                  <button
                    className="cupones-pag-btn"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <span className="cupones-pag-info">
                    Página {page} de {totalPages}
                    <span className="cupones-pag-sub"> · {cupones.length} cupones</span>
                  </span>
                  <button
                    className="cupones-pag-btn"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              )}
            </>
          );
        })()}
      </div>

      {toast && (
        <div className={`cupon-toast ${toast.type}`}>
          {toast.type === 'ok' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          {toast.msg}
        </div>
      )}

    </div>
  );
}
