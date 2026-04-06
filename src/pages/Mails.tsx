import { useState, useEffect, useCallback, useRef } from 'react';
import {
  RefreshCw, Mail, Send, Sparkles, AlertCircle,
  CheckCircle2, Inbox, Copy, X, Search,
} from 'lucide-react';
import { fetchMailsFromDB, fetchMailDetail, markMailRespondido } from '../services/supabaseService';
import './Mails.css';

// ── Types ───────────────────────────────────────────────────────────────────

type Categoria = 'urgente' | 'reclamo' | 'consulta' | 'positivo' | 'info' | 'spam';
type Filtro    = 'todos' | Categoria;

interface MailItem {
  id: string;
  threadId: string;
  de: string;
  nombre: string;
  asunto: string;
  cuerpo: string;
  fecha: string;
  leido: boolean;
  categoria: Categoria;
  resumen: string;
  respuestaSugerida: string;
}

// ── Config ────────────────────────────────────────────────────────────────────

const FROMNORTH_EMAIL = 'enzoribot02@gmail.com';

function resolverRemitente(mail: MailItem): 'FromNorth' | 'Cliente' {
  const esEmailPropio = mail.de.toLowerCase().trim() === FROMNORTH_EMAIL;
  const esRespuesta   = /^re\s*:/i.test(mail.asunto.trim());
  if (esEmailPropio && esRespuesta) return 'FromNorth';
  if (esEmailPropio)                return 'FromNorth';
  return 'Cliente';
}

// Colores de badges en la lista de mails
const CAT: Record<Categoria, { label: string; color: string; bg: string }> = {
  urgente:  { label: 'Urgente',  color: '#ef4444', bg: 'rgba(239,68,68,0.13)' },
  reclamo:  { label: 'Reclamo',  color: '#f59e0b', bg: 'rgba(245,158,11,0.13)' },
  consulta: { label: 'Consulta', color: '#eab308', bg: 'rgba(234,179,8,0.13)' },
  positivo: { label: 'Positivo', color: '#10b981', bg: 'rgba(16,185,129,0.13)' },
  info:     { label: 'Info',     color: '#06b6d4', bg: 'rgba(6,182,212,0.13)' },
  spam:     { label: 'Spam',     color: '#64748b', bg: 'rgba(100,116,139,0.13)' },
};

// Colores semánticos de los chips de filtro
const CHIP: Record<Filtro, { color: string; activeBg: string }> = {
  todos:    { color: '#06b6d4', activeBg: 'rgba(6,182,212,0.14)' },
  urgente:  { color: '#c0392b', activeBg: 'rgba(192,57,43,0.14)' },
  reclamo:  { color: '#e07b00', activeBg: 'rgba(224,123,0,0.14)' },
  consulta: { color: '#1565C0', activeBg: 'rgba(21,101,192,0.14)' },
  positivo: { color: '#2e7d32', activeBg: 'rgba(46,125,50,0.14)' },
  info:     { color: '#64748b', activeBg: 'rgba(100,116,139,0.14)' },
  spam:     { color: '#64748b', activeBg: 'rgba(100,116,139,0.14)' },
};

const FILTROS: { key: Filtro; label: string }[] = [
  { key: 'todos',    label: 'Todos' },
  { key: 'urgente',  label: 'Urgente' },
  { key: 'reclamo',  label: 'Reclamo' },
  { key: 'consulta', label: 'Consulta' },
  { key: 'positivo', label: 'Positivo' },
  { key: 'info',     label: 'Info' },
  { key: 'spam',     label: 'Spam' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'ayer';
  if (d < 7) return `hace ${d}d`;
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
}

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });
}

function formatHora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-AR', {
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Mail body parser ───────────────────────────────────────────────────────────

interface MailSegment {
  type: 'main' | 'quote';
  header?: string;
  text: string;
}

function parseMailBody(cuerpo: string): MailSegment[] {
  const normalized = cuerpo.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');

  const QUOTE_HEADER_RE = /^(El\s+.+escribi[oó][:：]|On\s+.+wrote[:：])\s*$/i;
  const QUOTE_LINE_RE   = /^>\s*/;

  let quoteStart = -1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (QUOTE_HEADER_RE.test(trimmed)) { quoteStart = i; break; }
    if (QUOTE_LINE_RE.test(lines[i]) && i > 0) { quoteStart = i; break; }
  }

  if (quoteStart === -1) {
    return [{ type: 'main', text: normalized.trim() }];
  }

  const segments: MailSegment[] = [];
  const mainText = lines.slice(0, quoteStart).join('\n').trimEnd();
  if (mainText) segments.push({ type: 'main', text: mainText });

  const firstLine   = lines[quoteStart].trim();
  const isHeader    = QUOTE_HEADER_RE.test(firstLine);
  const contentStart = isHeader ? quoteStart + 1 : quoteStart;
  const quoteText   = lines
    .slice(contentStart)
    .map(l => l.replace(QUOTE_LINE_RE, ''))
    .join('\n')
    .trim();

  segments.push({
    type: 'quote',
    header: isHeader ? firstLine : undefined,
    text: quoteText,
  });

  return segments;
}

function MailBody({ cuerpo, mail }: { cuerpo: string; mail: MailItem }) {
  const segments  = parseMailBody(cuerpo);
  const remitente = resolverRemitente(mail);
  const mainLabel  = remitente === 'FromNorth' ? 'ENZO' : 'CLIENTE';
  const quoteLabel = remitente === 'FromNorth' ? 'CLIENTE' : 'ENZO';

  return (
    <div className="detail-mail-body">
      {segments.map((seg, i) => {
        const label  = seg.type === 'main' ? mainLabel : quoteLabel;
        const isEnzo = label === 'ENZO';
        return (
          <div key={i} className={`mail-conv-block ${seg.type}`}>
            <span className={`mail-conv-label ${isEnzo ? 'enzo' : 'cliente'}`}>{label}:</span>
            <p className="mail-conv-text">{seg.text}</p>
          </div>
        );
      })}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function CatBadge({ cat }: { cat: Categoria }) {
  const c = CAT[cat];
  return (
    <span
      className="cat-badge"
      style={{ color: c.color, background: c.bg, borderColor: c.color + '33' }}
    >
      {c.label}
    </span>
  );
}

function MailSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="mail-skeleton">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <div className="skel" style={{ height: 12, width: '45%' }} />
            <div className="skel" style={{ height: 10, width: '18%' }} />
          </div>
          <div className="skel" style={{ height: 10, width: '30%', marginBottom: '0.4rem' }} />
          <div className="skel" style={{ height: 10, width: '85%' }} />
        </div>
      ))}
    </>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function Mails() {
  const [mails,         setMails]         = useState<MailItem[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [fromCache,     setFromCache]     = useState(false);
  const [error,         setError]         = useState(false);
  const [filtro,        setFiltro]        = useState<Filtro>('todos');
  const [searchQuery,   setSearchQuery]   = useState('');
  const [selected,      setSelected]      = useState<MailItem | null>(null);
  const [respuesta,     setRespuesta]     = useState('');
  const [enviando,      setEnviando]      = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [toast,         setToast]         = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [atendidos,     setAtendidos]     = useState<Set<string>>(new Set());
  const [localRead,     setLocalRead]     = useState<Set<string>>(new Set());
  const [debugRaw,      setDebugRaw]      = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (type: 'ok' | 'err', msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, msg });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };

  const fetchMails = useCallback(async (withCache = false) => {
    setLoading(true);
    setError(false);
    setDebugRaw(null);

    if (withCache) {
      const rows = await fetchMailsFromDB();
      if (rows.length > 0) {
        setMails(rows.map(r => ({
          id: r.id, threadId: r.thread_id, de: r.de, nombre: r.nombre,
          asunto: r.asunto, cuerpo: r.cuerpo, fecha: r.fecha, leido: r.leido,
          categoria: r.categoria as MailItem['categoria'],
          resumen: r.resumen, respuestaSugerida: r.respuesta_sugerida,
        })));
        setAtendidos(new Set(rows.filter(r => r.respondido).map(r => r.id)));
        setFromCache(true);
      }
    }

    try {
      const res = await fetch('/api/gmail-sync', { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const rows = await fetchMailsFromDB();
      const freshMails: MailItem[] = rows.map(r => ({
        id: r.id, threadId: r.thread_id, de: r.de, nombre: r.nombre,
        asunto: r.asunto, cuerpo: r.cuerpo, fecha: r.fecha, leido: r.leido,
        categoria: r.categoria as MailItem['categoria'],
        resumen: r.resumen, respuestaSugerida: r.respuesta_sugerida,
      }));

      setMails(freshMails);
      setAtendidos(new Set(rows.filter(r => r.respondido).map(r => r.id)));
      setFromCache(false);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('[Mails] error:', err);
      setDebugRaw(String(err));
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMails(true); }, [fetchMails]);

  const sendMail = async () => {
    if (!selected || !respuesta.trim()) return;
    setEnviando(true);
    try {
      const res = await fetch('/api/gmail-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId: selected.threadId,
          to:       selected.de,
          asunto:   `Re: ${selected.asunto}`,
          mensaje:  respuesta,
        }),
      });
      if (!res.ok) throw new Error();
      showToast('ok', '¡Respuesta enviada correctamente!');
      setRespuesta('');
      markMailRespondido(selected.id);
      setAtendidos(prev => new Set([...prev, selected.id]));
    } catch {
      showToast('err', 'No se pudo enviar. Intentá de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  const handleSelectMail = async (mail: MailItem) => {
    setRespuesta('');
    setLocalRead(prev => new Set([...prev, mail.id]));
    if (!mail.cuerpo) {
      const detail = await fetchMailDetail(mail.id);
      if (detail) {
        setSelected({ ...mail, cuerpo: detail.cuerpo, respuestaSugerida: detail.respuesta_sugerida });
        return;
      }
    }
    setSelected(mail);
  };

  const safeMails = Array.isArray(mails) ? mails : [];

  const counts = safeMails.reduce((acc, m) => {
    acc[m.categoria] = (acc[m.categoria] ?? 0) + 1;
    return acc;
  }, {} as Partial<Record<Categoria, number>>);

  // Todos oculta spam; el chip Spam muestra solo spam
  const baseFiltered = filtro === 'todos'
    ? safeMails.filter(m => m.categoria !== 'spam')
    : safeMails.filter(m => m.categoria === filtro);

  const filtered = searchQuery.trim()
    ? baseFiltered.filter(m => {
        const q = searchQuery.toLowerCase();
        return (
          (m.nombre || m.de).toLowerCase().includes(q) ||
          m.asunto.toLowerCase().includes(q) ||
          m.resumen.toLowerCase().includes(q)
        );
      })
    : baseFiltered;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="mails-page">

      {/* ══ PANEL IZQUIERDO ══════════════════════════════════════════════════ */}
      <div className="mails-left">

        {/* Header */}
        <div className="mails-list-header">
          <div className="mails-list-header-row">
            <div className="mails-list-title">
              <Mail size={16} className="mails-title-icon" />
              <span>Bandeja de entrada</span>
            </div>
            <button
              className="btn-secondary mails-refresh-btn"
              onClick={() => fetchMails(false)}
              disabled={loading}
              title="Actualizar"
            >
              <RefreshCw size={14} className={loading ? 'spinning' : ''} />
              {loading ? 'Cargando...' : 'Actualizar'}
            </button>
          </div>
          {fromCache && loading && (
            <p className="mails-last-update" style={{ color: '#f59e0b' }}>
              Actualizando bandeja...
            </p>
          )}
          {lastRefreshed && !fromCache && (
            <p className="mails-last-update">
              Actualizado: {lastRefreshed.toLocaleTimeString('es-AR')}
            </p>
          )}
        </div>

        {/* Buscador */}
        <div style={{ padding: '0 0.75rem 0.5rem' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search
              size={13}
              style={{
                position: 'absolute', left: '0.6rem',
                color: 'var(--text-muted)', pointerEvents: 'none', flexShrink: 0,
              }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar por remitente o asunto..."
              style={{
                width: '100%',
                padding: '0.42rem 1.8rem 0.42rem 1.9rem',
                background: 'var(--bg-secondary, rgba(255,255,255,0.04))',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                fontSize: '0.78rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute', right: '0.45rem',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: '0.1rem',
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Filtros */}
        <div className="mails-filters">
          {FILTROS.map(f => {
            const isActive   = filtro === f.key;
            const chipColor  = CHIP[f.key];
            return (
              <button
                key={f.key}
                className={`filter-btn ${isActive ? 'active' : ''}`}
                onClick={() => setFiltro(f.key)}
                style={{
                  borderColor: isActive ? chipColor.color : chipColor.color + '50',
                  color: chipColor.color,
                  background: isActive ? chipColor.activeBg : 'transparent',
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                {f.label}
                {f.key === 'todos'
                  ? <span className="filter-count">{safeMails.filter(m => m.categoria !== 'spam').length}</span>
                  : counts[f.key as Categoria]
                    ? <span className="filter-count">{counts[f.key as Categoria]}</span>
                    : null}
              </button>
            );
          })}
        </div>

        {/* Lista */}
        <div className="mails-list">
          {loading && filtered.length === 0 && <MailSkeleton />}

          {!loading && error && (
            <div className="list-error">
              <AlertCircle size={18} />
              <span>Error al cargar mails</span>
              <button className="btn-secondary" onClick={() => fetchMails(false)} style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}>
                Reintentar
              </button>
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="list-empty">
              {searchQuery.trim()
                ? `Sin resultados para “${searchQuery}”`
                : filtro === 'todos'
                  ? 'No hay mails disponibles'
                  : `No hay mails en la categoría “${CAT[filtro as Categoria]?.label ?? filtro}”`}
              {debugRaw && filtro === 'todos' && !searchQuery && (
                <details className="debug-panel">
                  <summary>Ver respuesta del webhook (debug)</summary>
                  <pre>{debugRaw}</pre>
                </details>
              )}
            </div>
          )}

          {filtered.map(mail => {
            const isUnread  = !mail.leido && !localRead.has(mail.id);
            const isActive  = selected?.id === mail.id;
            return (
              <div
                key={mail.id}
                className={`mail-item ${isActive ? 'active' : ''}`}
                onClick={() => handleSelectMail(mail)}
                style={{
                  borderLeft: isActive
                    ? '2px solid var(--accent-primary)'
                    : '2px solid transparent',
                  background: isActive
                    ? 'var(--bg-secondary, rgba(255,255,255,0.05))'
                    : undefined,
                }}
              >
                {/* Fila 1: remitente + tiempo */}
                <div className="mail-item-top">
                  <span
                    className="mail-item-sender"
                    style={{ fontWeight: isUnread ? 500 : 400 }}
                  >
                    {mail.nombre || mail.de}
                  </span>
                  <span className="mail-item-time">{timeAgo(mail.fecha)}</span>
                </div>

                {/* Fila 2: punto de no leído + tag + atendido */}
                <div className="mail-item-meta" style={{ alignItems: 'center' }}>
                  {isUnread && (
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: CAT[mail.categoria].color,
                      flexShrink: 0, display: 'inline-block', marginRight: 2,
                    }} />
                  )}
                  <CatBadge cat={mail.categoria} />
                  {atendidos.has(mail.id) && (
                    <span className="cat-badge" style={{ color: '#10b981', background: 'rgba(16,185,129,0.13)', borderColor: '#10b98133' }}>
                      Atendido
                    </span>
                  )}
                </div>

                {/* Fila 3: preview con ellipsis */}
                <p
                  className="mail-item-summary"
                  style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                  {mail.resumen || mail.asunto}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ══ PANEL DERECHO ══════════════════════════════════════════════════ */}
      <div className={`mails-right ${!selected ? 'mails-right-empty' : ''}`}>
        {!selected ? (
          <div className="mails-empty-state">
            <Inbox size={40} className="mails-empty-icon" />
            <p className="mails-empty-title">Selecioná un mail para ver el detalle</p>
            <p className="mails-empty-sub">
              {safeMails.length > 0
                ? `${safeMails.length} mails cargados`
                : loading ? 'Cargando bandeja...' : 'La bandeja está vacía'}
            </p>
          </div>
        ) : (
          <div className="mails-detail">

            {/* Header del mail */}
            <div className="detail-header">
              <button className="mail-detail-close-btn" onClick={() => setSelected(null)} aria-label="Cerrar">
                <X size={18} />
              </button>
              <div className="detail-sender-info">
                <div className="detail-sender-name">{selected.nombre || selected.de}</div>
                <div className="detail-sender-email">{selected.de}</div>
              </div>
              <CatBadge cat={selected.categoria} />
            </div>

            {/* Cuerpo scrolleable */}
            <div className="detail-scroll">

              {/* Asunto + meta */}
              <div className="detail-subject-row">
                <h2 className="detail-subject">{selected.asunto}</h2>
                <div className="detail-meta-row">
                  <span className={`detail-remitente-badge ${resolverRemitente(selected) === 'FromNorth' ? 'fromnorth' : 'cliente'}`}>
                    {resolverRemitente(selected)}
                  </span>
                  <span className="detail-meta-item">
                    <span className="detail-meta-label">Enviado:</span>
                    {formatFecha(selected.fecha)}
                  </span>
                  <span className="detail-meta-sep">·</span>
                  <span className="detail-meta-item">
                    <span className="detail-meta-label">Hora:</span>
                    {formatHora(selected.fecha)}
                  </span>
                </div>
              </div>

              {/* Cuerpo del mail */}
              <div className="detail-section">
                <MailBody cuerpo={selected.cuerpo} mail={selected} />
              </div>

              <div className="detail-separator" />

              {/* Respuesta sugerida por IA */}
              <div className="detail-section">
                <div className="detail-section-title">
                  <Sparkles size={14} className="ai-icon" />
                  Respuesta sugerida por IA
                </div>
                <div className="suggestion-text">{selected.respuestaSugerida}</div>
                <button
                  className="use-suggestion-btn"
                  onClick={() => setRespuesta(selected.respuestaSugerida)}
                >
                  <Copy size={12} />
                  Usar sugerencia
                </button>
              </div>

              <div className="detail-separator" />

              {/* Editor de respuesta */}
              <div className="detail-section detail-response-section">
                <div className="detail-section-title">
                  <Send size={14} />
                  Tu respuesta
                </div>
                <p className="response-subject">Re: {selected.asunto}</p>
                <textarea
                  className="response-textarea"
                  placeholder="Escribí tu respuesta acá..."
                  value={respuesta}
                  onChange={e => setRespuesta(e.target.value)}
                  rows={6}
                />
                <button
                  className="send-btn"
                  onClick={sendMail}
                  disabled={enviando || !respuesta.trim()}
                >
                  {enviando
                    ? <><RefreshCw size={15} className="spinning" /> Enviando...</>
                    : <><Send size={15} /> Enviar respuesta</>}
                </button>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* ══ TOAST ═══════════════════════════════════════════════════════════════════════ */}
      {toast && (
        <div className={`mail-toast ${toast.type}`}>
          {toast.type === 'ok'
            ? <CheckCircle2 size={16} />
            : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

    </div>
  );
}
