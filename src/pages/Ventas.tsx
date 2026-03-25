import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Search, SlidersHorizontal, X, ChevronDown } from 'lucide-react';
import { getSettings, fetchSheetByGid } from '../services/dataService';
import './SheetViewer.css';
import './Ventas.css';

type SortOption = 'recientes' | 'antiguas' | 'mayor-total' | 'menor-total' | 'mayor-precio' | 'mayor-cantidad';

const SORT_OPTIONS: { id: SortOption; label: string }[] = [
  { id: 'recientes',      label: 'Más recientes'  },
  { id: 'antiguas',       label: 'Más antiguas'   },
  { id: 'mayor-total',    label: 'Mayor total'    },
  { id: 'menor-total',    label: 'Menor total'    },
  { id: 'mayor-precio',   label: 'Mayor precio'   },
  { id: 'mayor-cantidad', label: 'Mayor cantidad' },
];

function parseDateMs(raw: string): number {
  if (!raw) return 0;
  const datePart = raw.replace(/,?\s+\d{1,2}:\d{2}(:\d{2})?(\s*(AM|PM))?$/i, '').trim();
  const timeMatch = raw.match(/(\d{1,2}):(\d{2})/);
  const h = timeMatch ? parseInt(timeMatch[1], 10) : 0;
  const m = timeMatch ? parseInt(timeMatch[2], 10) : 0;

  const iso = datePart.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3], h, m).getTime();

  const slash = datePart.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const a = +slash[1], b = +slash[2], y = +slash[3];
    let d: number, mo: number;
    if (a > 12)      { d = a; mo = b; }
    else if (b > 12) { d = b; mo = a; }
    else             { d = a; mo = b; }
    return new Date(y, mo - 1, d, h, m).getTime();
  }
  return 0;
}

function cleanCell(val: string): string {
  return val.replace(/\bPAID\b/gi, '').trim();
}

const GID = '1317535551';

export default function Ventas() {
  const navigate = useNavigate();

  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(false);
  const [headers, setHeaders]             = useState<string[]>([]);
  const [rows, setRows]                   = useState<Record<string, string>[]>([]);
  const [search, setSearch]               = useState('');
  const [sort, setSort]                   = useState<SortOption>('recientes');
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Panel de filtros abierto/cerrado
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Filtros de resaltado
  const [filterMultiPrenda, setFilterMultiPrenda] = useState(false);
  const [filterProducto, setFilterProducto]       = useState('');
  const [filterMetodoPago, setFilterMetodoPago]   = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError(false);
    try {
      const settings = getSettings();
      if (!settings?.googleSheetsUrl) { setError(true); return; }
      const data = await fetchSheetByGid(settings.googleSheetsUrl, GID);
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

  useEffect(() => { fetchData(); }, []);

  const findCol = (kw: string) =>
    headers.find(h =>
      h.toLowerCase().replace(/[\s_-]/g, '').includes(kw.toLowerCase().replace(/[\s_-]/g, ''))
    ) ?? '';

  const fechaCol      = findCol('fecha');
  const totalCol      = findCol('total');
  const precioCol     = findCol('precio');
  const cantidadCol   = findCol('cantidad');
  const productoCol   = findCol('producto');
  const metodoPagoCol = useMemo(() =>
    findCol('medio') || findCol('metodo') || findCol('payment'),
  [headers]);

  // Columnas ocultas
  const isHiddenCol = (h: string) => {
    const n = h.toLowerCase().replace(/[\s_-]/g, '');
    return n.includes('estadoenvio') || n.includes('estadopago') ||
           n === 'estadodelenvio' || n === 'estadodelpago';
  };

  const visibleHeaders = headers.filter(h => !isHiddenCol(h));

  const productosUnicos = useMemo(() =>
    [...new Set(rows.map(r => cleanCell(r[productoCol] ?? '')).filter(Boolean))].sort(),
  [rows, productoCol]);

  const metodosPagoUnicos = useMemo(() =>
    [...new Set(rows.map(r => cleanCell(r[metodoPagoCol] ?? '')).filter(Boolean))].sort(),
  [rows, metodoPagoCol]);

  const hasActiveFilter = filterMultiPrenda || !!filterProducto || !!filterMetodoPago;

  // Cuenta cuántos filtros están activos (para mostrar en el botón)
  const activeFilterCount = [filterMultiPrenda, !!filterProducto, !!filterMetodoPago].filter(Boolean).length;

  const rowHighlighted = (row: Record<string, string>): boolean => {
    if (filterMultiPrenda && (parseFloat(row[cantidadCol] ?? '0') || 0) < 2) return false;
    if (filterProducto && cleanCell(row[productoCol] ?? '') !== filterProducto) return false;
    if (filterMetodoPago && cleanCell(row[metodoPagoCol] ?? '') !== filterMetodoPago) return false;
    return true;
  };

  const clearFilters = () => {
    setFilterMultiPrenda(false);
    setFilterProducto('');
    setFilterMetodoPago('');
  };

  // 1. Ordenar — por defecto más recientes primero
  const sortedRows = useMemo(() => [...rows].sort((a, b) => {
    switch (sort) {
      case 'recientes':
        return parseDateMs(b[fechaCol] ?? '') - parseDateMs(a[fechaCol] ?? '');
      case 'antiguas':
        return parseDateMs(a[fechaCol] ?? '') - parseDateMs(b[fechaCol] ?? '');
      case 'mayor-total':
        return (parseFloat(b[totalCol] ?? '0') || 0) - (parseFloat(a[totalCol] ?? '0') || 0);
      case 'menor-total':
        return (parseFloat(a[totalCol] ?? '0') || 0) - (parseFloat(b[totalCol] ?? '0') || 0);
      case 'mayor-precio':
        return (parseFloat(b[precioCol] ?? '0') || 0) - (parseFloat(a[precioCol] ?? '0') || 0);
      case 'mayor-cantidad':
        return (parseFloat(b[cantidadCol] ?? '0') || 0) - (parseFloat(a[cantidadCol] ?? '0') || 0);
      default:
        return 0;
    }
  }), [rows, sort, fechaCol, totalCol, precioCol, cantidadCol]);

  // 2. Búsqueda
  const searchFiltered = useMemo(() =>
    sortedRows.filter(row =>
      Object.values(row).some(v => cleanCell(v).toLowerCase().includes(search.toLowerCase()))
    ),
  [sortedRows, search]);

  // 3. Filtros activos → resaltados arriba, resto abajo
  const finalRows = useMemo(() =>
    hasActiveFilter
      ? [
          ...searchFiltered.filter(r => rowHighlighted(r)),
          ...searchFiltered.filter(r => !rowHighlighted(r)),
        ]
      : searchFiltered,
  [searchFiltered, hasActiveFilter, filterMultiPrenda, filterProducto, filterMetodoPago]);

  const highlightedCount = hasActiveFilter ? finalRows.filter(r => rowHighlighted(r)).length : 0;

  return (
    <div className="sv-page fade-in">

      {/* ── Header ── */}
      <header className="sv-header">
        <div className="sv-header-left">
          <button className="sv-back-btn" onClick={() => navigate(-1)} title="Volver">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1>Ventas Todas</h1>
            <span className="text-muted sv-meta">
              Historial completo · Actualizado: {lastRefreshed.toLocaleTimeString('es-AR')}
            </span>
          </div>
        </div>
        <button className="btn-secondary refresh-btn" onClick={fetchData} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spinning' : ''} />
          {loading ? 'Cargando...' : 'Actualizar'}
        </button>
      </header>

      {error && (
        <div className="sv-error glass-panel">
          No se pudo cargar la hoja. Verificá la configuración de Google Sheets en Ajustes.
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <>
          {/* ── Toolbar: buscador + botón Filtros ── */}
          <div className="sv-toolbar">
            <span className="sv-count glass-panel">
              {hasActiveFilter
                ? <><span className="ventas-hl-count">{highlightedCount}</span>&nbsp;resaltados · {finalRows.length} de {rows.length}</>
                : <>{search ? `${finalRows.length} de ${rows.length}` : rows.length}&nbsp;registros</>
              }
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

            {/* Botón Filtros */}
            <button
              className={`ventas-toggle-btn${filtersOpen ? ' open' : ''}${activeFilterCount > 0 ? ' has-active' : ''}`}
              onClick={() => setFiltersOpen(v => !v)}
            >
              <SlidersHorizontal size={14} />
              Filtros
              {activeFilterCount > 0 && (
                <span className="ventas-badge">{activeFilterCount}</span>
              )}
              <ChevronDown size={12} className={`ventas-chevron${filtersOpen ? ' up' : ''}`} />
            </button>
          </div>

          {/* ── Panel de filtros (colapsable) ── */}
          {filtersOpen && (
            <div className="ventas-panel glass-panel">

              {/* Ordenar */}
              <div className="ventas-panel-row">
                <span className="ventas-panel-label">Ordenar por</span>
                <div className="ventas-chip-group">
                  {SORT_OPTIONS.map(opt => (
                    <button
                      key={opt.id}
                      className={`ventas-chip${sort === opt.id ? ' active' : ''}`}
                      onClick={() => setSort(opt.id)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Separador */}
              <div className="ventas-panel-sep" />

              {/* Resaltar */}
              <div className="ventas-panel-row">
                <span className="ventas-panel-label">Resaltar y subir</span>
                <div className="ventas-chip-group">

                  {/* 2+ prendas */}
                  <button
                    className={`ventas-chip ventas-chip-hl${filterMultiPrenda ? ' active' : ''}`}
                    onClick={() => setFilterMultiPrenda(v => !v)}
                  >
                    2+ prendas
                  </button>

                  {/* Por producto */}
                  {productosUnicos.length > 0 && (
                    <div className="ventas-select-wrap">
                      <select
                        className={`ventas-chip ventas-chip-select${filterProducto ? ' active' : ''}`}
                        value={filterProducto}
                        onChange={e => setFilterProducto(e.target.value)}
                      >
                        <option value="">Producto…</option>
                        {productosUnicos.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                      {filterProducto && (
                        <button className="ventas-chip-x" onClick={() => setFilterProducto('')}>
                          <X size={11} />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Por método de pago */}
                  {metodosPagoUnicos.length > 0 && (
                    <div className="ventas-select-wrap">
                      <select
                        className={`ventas-chip ventas-chip-select${filterMetodoPago ? ' active' : ''}`}
                        value={filterMetodoPago}
                        onChange={e => setFilterMetodoPago(e.target.value)}
                      >
                        <option value="">Medio de pago…</option>
                        {metodosPagoUnicos.map(mp => (
                          <option key={mp} value={mp}>{mp}</option>
                        ))}
                      </select>
                      {filterMetodoPago && (
                        <button className="ventas-chip-x" onClick={() => setFilterMetodoPago('')}>
                          <X size={11} />
                        </button>
                      )}
                    </div>
                  )}

                  {hasActiveFilter && (
                    <button className="ventas-chip ventas-chip-clear" onClick={clearFilters}>
                      <X size={11} /> Limpiar
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Tabla ── */}
          <div className="sv-table-wrapper glass-panel">
            <table className="sv-table">
              <thead>
                <tr>
                  <th>#</th>
                  {visibleHeaders.map(h => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {finalRows.map((row, i) => {
                  const hl = hasActiveFilter && rowHighlighted(row);
                  return (
                    <tr key={i} className={hl ? 'ventas-row-hl' : ''}>
                      <td className="sv-td-num">{i + 1}</td>
                      {visibleHeaders.map(h => {
                        const val = cleanCell(row[h] ?? '');
                        return (
                          <td
                            key={h}
                            className={h.toLowerCase().includes('email') ? 'sv-td-email' : 'sv-td-cell'}
                          >
                            {h.toLowerCase().includes('email') && val
                              ? <a href={`mailto:${val}`} className="sv-email-link">{val}</a>
                              : val || <span className="sv-empty">—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {finalRows.length === 0 && (
              <div className="sv-empty-msg">
                {search ? `No hay resultados para "${search}"` : 'Sin resultados para los filtros aplicados'}
              </div>
            )}
          </div>
        </>
      )}

      {loading && (
        <div className="sv-loading">
          <RefreshCw size={22} className="spinning" />
          <span>Cargando ventas...</span>
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="sv-empty-page glass-panel">
          La hoja no contiene registros todavía.
        </div>
      )}
    </div>
  );
}
