import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Mail, Search, Users } from 'lucide-react';
import { getSettings } from '../services/dataService';
import './SeguimientosEnviados.css';

interface SeguimientoCliente {
  nombre: string;
  email: string;
  fecha: string;
  extra: Record<string, string>;
}

async function fetchSeguimientosEnviados(_url: string): Promise<SeguimientoCliente[]> {
  return [];
}

export default function SeguimientosEnviados() {
  const navigate = useNavigate();
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);
  const [clientes, setClientes] = useState<SeguimientoCliente[]>([]);
  const [search, setSearch]     = useState('');
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchData = async () => {
    setLoading(true);
    setError(false);
    try {
      const settings = getSettings();
      if (!settings) { setError(true); return; }
      const data = await fetchSeguimientosEnviados('');
      setClientes(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setLastRefreshed(new Date());
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = clientes.filter(c => {
    const q = search.toLowerCase();
    return (
      c.nombre.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q)
    );
  });

  // Columnas extra detectadas de la hoja
  const extraKeys = clientes.length > 0
    ? Object.keys(clientes[0].extra).filter(k => k.trim())
    : [];

  return (
    <div className="seg-page fade-in">

      {/* ── Header ── */}
      <header className="seg-header">
        <div className="seg-header-left">
          <button className="seg-back-btn" onClick={() => navigate('/dashboard')} title="Volver">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1>
              <Mail size={22} className="seg-title-icon" />
              Seguimientos Enviados
            </h1>
            <span className="text-muted seg-meta">
              Actualizado: {lastRefreshed.toLocaleTimeString('es-AR')}
            </span>
          </div>
        </div>
        <button className="btn-secondary refresh-btn" onClick={fetchData} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spinning' : ''} />
          {loading ? 'Cargando...' : 'Actualizar'}
        </button>
      </header>

      {/* ── Error ── */}
      {error && (
        <div className="seg-error glass-panel">
          No se pudo cargar la hoja <strong>etapa2_enviada</strong>. Verificá que el nombre de la hoja sea correcto y que esté en el mismo archivo de Google Sheets configurado en Ajustes.
        </div>
      )}

      {/* ── Stats strip ── */}
      {!loading && !error && (
        <div className="seg-stats glass-panel">
          <div className="seg-stat">
            <Users size={16} className="seg-stat-icon" />
            <span className="seg-stat-num">{clientes.length}</span>
            <span className="seg-stat-label">clientes en seguimiento</span>
          </div>
          {search && (
            <>
              <span className="seg-stat-divider" />
              <div className="seg-stat">
                <span className="seg-stat-num">{filtered.length}</span>
                <span className="seg-stat-label">resultados para "{search}"</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Search ── */}
      {!loading && clientes.length > 0 && (
        <div className="seg-search-wrapper">
          <Search size={15} className="seg-search-icon" />
          <input
            className="seg-search"
            type="text"
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="seg-search-clear" onClick={() => setSearch('')}>×</button>
          )}
        </div>
      )}

      {/* ── Tabla ── */}
      {!loading && !error && clientes.length > 0 && (
        <div className="seg-table-wrapper glass-panel">
          <table className="seg-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Email</th>
                {clientes[0].fecha && <th>Fecha</th>}
                {extraKeys.map(k => (
                  <th key={k}>{k.charAt(0).toUpperCase() + k.slice(1)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={i}>
                  <td className="seg-td-num">{i + 1}</td>
                  <td className="seg-td-email">
                    <a href={`mailto:${c.email}`} className="seg-email-link">{c.email}</a>
                  </td>
                  {c.fecha !== undefined && (
                    <td className="seg-td-fecha">{c.fecha || '—'}</td>
                  )}
                  {extraKeys.map(k => (
                    <td key={k} className="seg-td-extra">{c.extra[k] || '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="seg-empty">No hay resultados para "{search}"</div>
          )}
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="seg-loading">
          <RefreshCw size={22} className="spinning" />
          <span>Cargando clientes...</span>
        </div>
      )}

      {/* ── Empty ── */}
      {!loading && !error && clientes.length === 0 && (
        <div className="seg-empty-page glass-panel">
          La hoja <strong>etapa2_enviada</strong> no contiene registros todavía.
        </div>
      )}

    </div>
  );
}
