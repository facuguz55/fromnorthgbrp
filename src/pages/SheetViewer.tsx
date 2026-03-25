import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Search } from 'lucide-react';
import { getSettings, fetchSheetByGid } from '../services/dataService';
import './SheetViewer.css';

interface SheetViewerState {
  gid: string;
  title: string;
  subtitle?: string;
}

export default function SheetViewer() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const state     = (location.state ?? {}) as Partial<SheetViewerState>;
  const params    = new URLSearchParams(location.search);
  const gid       = state.gid      ?? params.get('gid')      ?? '';
  const title     = state.title    ?? params.get('title')    ?? 'Registros';
  const subtitle  = state.subtitle ?? params.get('subtitle') ?? undefined;

  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);
  const [headers, setHeaders]   = useState<string[]>([]);
  const [rows, setRows]         = useState<Record<string, string>[]>([]);
  const [search, setSearch]     = useState('');
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchData = async () => {
    if (!gid) { setError(true); setLoading(false); return; }
    setLoading(true);
    setError(false);
    try {
      const settings = getSettings();
      if (!settings?.googleSheetsUrl) { setError(true); return; }
      const data = await fetchSheetByGid(settings.googleSheetsUrl, gid);
      if (data.headers.length === 0) { setError(true); return; }
      setHeaders(data.headers);
      setRows(data.rows);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setLastRefreshed(new Date());
    }
  };

  useEffect(() => { fetchData(); }, [gid]);

  const filtered = rows.filter(row =>
    Object.values(row).some(v => v.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="sv-page fade-in">

      {/* ── Header ── */}
      <header className="sv-header">
        <div className="sv-header-left">
          <button className="sv-back-btn" onClick={() => navigate(-1)} title="Volver">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1>{title ?? 'Datos de hoja'}</h1>
            <span className="text-muted sv-meta">
              {subtitle && <>{subtitle} · </>}
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
        <div className="sv-error glass-panel">
          No se pudo cargar la hoja. Verificá la configuración de Google Sheets en Ajustes.
        </div>
      )}

      {/* ── Stats + Search ── */}
      {!loading && !error && rows.length > 0 && (
        <div className="sv-toolbar">
          <span className="sv-count glass-panel">
            {search ? `${filtered.length} de ${rows.length}` : rows.length} registros
          </span>
          <div className="sv-search-wrapper">
            <Search size={14} className="sv-search-icon" />
            <input
              className="sv-search"
              type="text"
              placeholder="Buscar en todos los campos..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button className="sv-search-clear" onClick={() => setSearch('')}>×</button>
            )}
          </div>
        </div>
      )}

      {/* ── Tabla ── */}
      {!loading && !error && rows.length > 0 && (
        <div className="sv-table-wrapper glass-panel">
          <table className="sv-table">
            <thead>
              <tr>
                <th>#</th>
                {headers.map(h => <th key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <tr key={i}>
                  <td className="sv-td-num">{i + 1}</td>
                  {headers.map(h => (
                    <td key={h} className={h.toLowerCase().includes('email') ? 'sv-td-email' : 'sv-td-cell'}>
                      {h.toLowerCase().includes('email') && row[h]
                        ? <a href={`mailto:${row[h]}`} className="sv-email-link">{row[h]}</a>
                        : row[h] || <span className="sv-empty">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="sv-empty-msg">No hay resultados para "{search}"</div>
          )}
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="sv-loading">
          <RefreshCw size={22} className="spinning" />
          <span>Cargando datos...</span>
        </div>
      )}

      {/* ── Empty ── */}
      {!loading && !error && rows.length === 0 && (
        <div className="sv-empty-page glass-panel">
          La hoja no contiene registros todavía.
        </div>
      )}

    </div>
  );
}
