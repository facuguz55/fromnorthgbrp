import { useState, useEffect, useMemo } from 'react';
import { Users, RefreshCw, Search, X, ShoppingBag, Phone, Mail, Calendar } from 'lucide-react';
import { getSettings } from '../services/dataService';
import { fetchTNCustomers, fetchTNCustomerOrders } from '../services/tiendanubeService';
import type { TNCustomer, TNOrder } from '../services/tiendanubeService';
import './Clientes.css';
import './TiendanubeVentas.css';

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

export default function Clientes() {
  const [customers, setCustomers] = useState<TNCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [search, setSearch] = useState('');
  const [minOrders, setMinOrders] = useState<number>(0);
  const [sortKey, setSortKey] = useState<SortKey>('total_spent');

  // Detail panel
  const [selectedCustomer, setSelectedCustomer] = useState<TNCustomer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<TNOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

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
      setError('No se pudo cargar la lista de clientes. Verificá el token en Configuración.');
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
    if (q) {
      base = base.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
      );
    }
    return [...base].sort((a, b) => {
      if (sortKey === 'total_spent') return parseFloat(b.total_spent) - parseFloat(a.total_spent);
      if (sortKey === 'orders_count') return b.orders_count - a.orders_count;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [customers, search, minOrders, sortKey]);

  const totalGastado = customers.reduce((s, c) => s + parseFloat(c.total_spent), 0);
  const promedio     = customers.length > 0 ? totalGastado / customers.length : 0;
  const isFiltered   = filtered.length !== customers.length;

  return (
    <div className="clientes-page fade-in">

      {/* ── Header ── */}
      <header className="clientes-header">
        <div>
          <h1 className="clientes-title">
            <Users size={22} className="clientes-title-icon" />
            Clientes
          </h1>
          {lastUpdated && (
            <span className="text-muted clientes-meta">
              Actualizado: {lastUpdated.toLocaleTimeString('es-AR')}
            </span>
          )}
        </div>
        <button
          className="btn-secondary refresh-btn"
          onClick={() => loadData(true)}
          disabled={loading}
        >
          <RefreshCw size={15} className={loading ? 'spinning' : ''} />
          {loading ? 'Cargando...' : 'Actualizar'}
        </button>
      </header>

      {/* ── Stats strip ── */}
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

      {/* ── Filtros ── */}
      {!loading && !error && customers.length > 0 && (
        <div className="clientes-filters glass-panel">
          {/* Buscador */}
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

          {/* Mínimo de órdenes */}
          <div className="clientes-filter-group">
            <span className="clientes-filter-label">Órdenes:</span>
            <div className="clientes-filter-btns">
              {MIN_ORDERS_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  className={`clientes-filter-btn ${minOrders === value ? 'active' : ''}`}
                  onClick={() => setMinOrders(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Sort */}
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
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Conteo */}
          {isFiltered && (
            <span className="clientes-count-label">
              {filtered.length} de {customers.length} clientes
            </span>
          )}
        </div>
      )}

      {/* ── Estados ── */}
      {loading ? (
        <div className="clientes-state glass-panel">
          <RefreshCw size={24} className="spinning" />
          <span>Cargando clientes...</span>
        </div>
      ) : error ? (
        <div className="clientes-state clientes-state-error glass-panel">
          <Users size={36} className="clientes-state-icon" />
          <h3>Error al cargar</h3>
          <p>{error}</p>
        </div>
      ) : customers.length === 0 ? (
        <div className="clientes-state glass-panel">
          <Users size={36} className="clientes-state-icon" />
          <h3>Sin clientes</h3>
          <p>No se encontraron clientes en tu tienda.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="clientes-state glass-panel">
          <Users size={36} className="clientes-state-icon" />
          <h3>Sin resultados</h3>
          <p>Ningún cliente coincide con los filtros aplicados.</p>
        </div>
      ) : (

        /* ── Tabla ── */
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
                    <td className="tn-td-cliente">
                      <span className="tn-client-name">{c.name || '—'}</span>
                    </td>
                    <td className="tn-td-cliente">
                      <span className="tn-client-email">{c.email || '—'}</span>
                    </td>
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

      {/* ── Panel de detalle del cliente ── */}
      {selectedCustomer && (
        <div className="cliente-detail-overlay" onClick={() => setSelectedCustomer(null)}>
          <div className="cliente-detail-panel glass-panel" onClick={e => e.stopPropagation()}>
            <div className="cliente-detail-header">
              <div className="cliente-detail-title">
                <Users size={18} className="section-icon" />
                <h2>{selectedCustomer.name || 'Cliente sin nombre'}</h2>
              </div>
              <button className="rec-close-btn" onClick={() => setSelectedCustomer(null)}>
                <X size={18} />
              </button>
            </div>

            {/* Info del cliente */}
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

            {/* Stats */}
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

            {/* Órdenes */}
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
    </div>
  );
}
