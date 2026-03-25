import { useState, useEffect, useMemo } from 'react';
import { Users, RefreshCw, Search } from 'lucide-react';
import { getSettings } from '../services/dataService';
import { fetchTNCustomers } from '../services/tiendanubeService';
import type { TNCustomer } from '../services/tiendanubeService';
import './Clientes.css';
import './TiendanubeVentas.css';

const fmtARS = (n: number) =>
  n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

type SortKey = 'total_spent' | 'orders_count' | 'created_at';

const MIN_ORDERS_OPTIONS = [1, 2, 5, 10] as const;

export default function Clientes() {
  const [customers, setCustomers] = useState<TNCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [search, setSearch] = useState('');
  const [minOrders, setMinOrders] = useState<number>(1);
  const [sortKey, setSortKey] = useState<SortKey>('total_spent');

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

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let base = customers.filter(c => c.orders_count >= minOrders);
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
            <span className="clientes-filter-label">Mínimo de órdenes:</span>
            <div className="clientes-filter-btns">
              {MIN_ORDERS_OPTIONS.map(n => (
                <button
                  key={n}
                  className={`clientes-filter-btn ${minOrders === n ? 'active' : ''}`}
                  onClick={() => setMinOrders(n)}
                >
                  {n}+
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
                  <tr key={c.id}>
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
    </div>
  );
}
