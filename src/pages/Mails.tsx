import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, Mail, Send, Sparkles, AlertCircle,
  CheckCircle2, Inbox, Copy, EyeOff,
} from 'lucide-react';
import { fetchMailsCache, saveMailsCache } from '../services/supabaseService';
import './Mails.css';

// ── Types ─────────────────────────────────────────────────────────────────────

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

const WEBHOOK_GET     = 'https://devwebhookn8n.santafeia.shop/webhook/get-mails';
const WEBHOOK_SEND    = 'https://devwebhookn8n.santafeia.shop/webhook/responder-mail';
const FROMNORTH_EMAIL = 'enzoribot02@gmail.com';

// Determina si el mail es de FromNorth:
// - Primario: el remitente coincide exactamente con el email de FromNorth
// - Secundario: el asunto empieza con "Re:" (respuesta enviada desde Gmail)
// Ambas condiciones se evalúan para evitar falsos positivos.
function resolverRemitente(mail: MailItem): 'FromNorth' | 'Cliente' {
  const esEmailPropio  = mail.de.toLowerCase().trim() === FROMNORTH_EMAIL;
  const esRespuesta    = /^re\s*:/i.test(mail.asunto.trim());
  // Es FromNorth solo si el email coincide (con Re: como confirmación extra)
  // Un Re: de otra dirección sigue siendo un Cliente respondiendo
  if (esEmailPropio && esRespuesta) return 'FromNorth'; // certeza máxima
  if (esEmailPropio)                return 'FromNorth'; // email coincide solo
  return 'Cliente';
}

// ── Response normalizer ───────────────────────────────────────────────────────
// n8n puede devolver el array directo, wrapeado en objeto, o con formato
// interno [{json: {...}}]. Esta función maneja todos los casos.
function normalizeMails(raw: unknown): MailItem[] {
  if (Array.isArray(raw)) {
    // Formato interno n8n: [{ json: { ...mailItem } }]
    if (raw.length > 0 && raw[0] !== null && typeof raw[0] === 'object' && 'json' in (raw[0] as object)) {
      return (raw as { json: MailItem }[]).map(item => item.json);
    }
    return raw as MailItem[];
  }
  // Objeto con claves de mail directo (n8n devuelve 1 solo item sin array)
  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    // Si tiene campos propios de un mail, lo envolvemos en array
    if ('id' in obj || 'threadId' in obj || 'de' in obj) {
      return [obj as unknown as MailItem];
    }
    // Wrapeado en objeto: { data: [...] } | { mails: [...] } | etc.
    for (const key of ['data', 'mails', 'items', 'response', 'result']) {
      if (Array.isArray(obj[key])) return obj[key] as MailItem[];
    }
  }
  // JSON string
  if (typeof raw === 'string') {
    try { return normalizeMails(JSON.parse(raw)); } catch { /* fall through */ }
  }
  return [];
}

const CAT: Record<Categoria, { label: string; color: string; bg: string }> = {
  urgente:  { label: 'Urgente',  color: '#ef4444', bg: 'rgba(239,68,68,0.13)' },
  reclamo:  { label: 'Reclamo',  color: '#f59e0b', bg: 'rgba(245,158,11,0.13)' },
  consulta: { label: 'Consulta', color: '#eab308', bg: 'rgba(234,179,8,0.13)' },
  positivo: { label: 'Positivo', color: '#10b981', bg: 'rgba(16,185,129,0.13)' },
  info:     { label: 'Info',     color: '#06b6d4', bg: 'rgba(6,182,212,0.13)' },
  spam:     { label: 'Spam',     color: '#64748b', bg: 'rgba(100,116,139,0.13)' },
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

// ── Mail body parser ──────────────────────────────────────────────────────────
// Detecta el bloque citado (empieza con "El ... escribió:" o líneas con ">")
// y lo separa del texto principal. El contenido citado NO se modifica.

interface MailSegment {
  type: 'main' | 'quote';
  header?: string;   // solo para type === 'quote'
  text: string;
}

function parseMailBody(cuerpo: string): MailSegment[] {
  // Normaliza saltos de línea
  const normalized = cuerpo.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');

  // Patrones que identifican inicio de bloque citado
  const QUOTE_HEADER_RE = /^(El\s+.+escribi[oó][:：]|On\s+.+wrote[:：])\s*$/i;
  const QUOTE_LINE_RE   = /^>\s*/;

  let quoteStart = -1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (QUOTE_HEADER_RE.test(trimmed)) { quoteStart = i; break; }
    // Si no hay header pero hay líneas con ">", tomamos desde ahí
    if (QUOTE_LINE_RE.test(lines[i]) && i > 0) { quoteStart = i; break; }
  }

  if (quoteStart === -1) {
    return [{ type: 'main', text: normalized.trim() }];
  }

  const segments: MailSegment[] = [];
  const mainText = lines.slice(0, quoteStart).join('\n').trimEnd();
  if (mainText) segments.push({ type: 'main', text: mainText });

  // Detecta si la línea de quoteStart es un header o ya es contenido
  const firstLine = lines[quoteStart].trim();
  const isHeader  = QUOTE_HEADER_RE.test(firstLine);
  const contentStart = isHeader ? quoteStart + 1 : quoteStart;
  const quoteText = lines
    .slice(contentStart)
    .map(l => l.replace(QUOTE_LINE_RE, ''))   // quita "> " pero mantiene el texto
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

  // Quien escribió el texto principal es el remitente del mail.
  // El bloque citado es el mensaje anterior → la otra parte.
  const mainLabel  = remitente === 'FromNorth' ? 'ENZO' : 'CLIENTE';
  const quoteLabel = remitente === 'FromNorth' ? 'CLIENTE' : 'ENZO';

  return (
    <div className="detail-mail-body">
      {segments.map((seg, i) => {
        const label    = seg.type === 'main' ? mainLabel  : quoteLabel;
        const isEnzo   = label === 'ENZO';
        return (
          <div key={i} className={`mail-conv-block ${seg.type}`}>
            <span className={`mail-conv-label ${isEnzo ? 'enzo' : 'cliente'}`}>
              {label}:
            </span>
            <p className="mail-conv-text">{seg.text}</p>
          </div>
        );
      })}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

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

// ── Main Component ────────────────────────────────────────────────────────────

export default function Mails() {
  const [mails,         setMails]         = useState<MailItem[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [fromCache,     setFromCache]     = useState(false);
  const [error,         setError]         = useState(false);
  const [filtro,        setFiltro]        = useState<Filtro>('todos');
  const [ocultarSpam,   setOcultarSpam]   = useState(true);
  const [selected,      setSelected]      = useState<MailItem | null>(null);
  const [respuesta,     setRespuesta]     = useState('');
  const [enviando,      setEnviando]      = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [toast,         setToast]         = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [debugRaw,      setDebugRaw]      = useState<string | null>(null);

  const showToast = (type: 'ok' | 'err', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchMails = useCallback(async (withCache = false) => {
    setLoading(true);
    setError(false);
    setDebugRaw(null);

    // 1. Cargar cache de Supabase primero (instantáneo)
    let cachedMails: MailItem[] = [];
    if (withCache) {
      const cached = await fetchMailsCache();
      if (cached.length > 0) {
        cachedMails = cached as MailItem[];
        setMails(cachedMails);
        setFromCache(true);
      }
    }

    try {
      const res = await fetch(WEBHOOK_GET, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
      });

      const text = await res.text();
      console.log('[Mails] status:', res.status, '| body:', text.slice(0, 400));

      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      if (!text.trim()) throw new Error('El webhook devolvió una respuesta vacía');

      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        throw new Error(`No es JSON válido. Recibido: ${text.slice(0, 200)}`);
      }

      const freshMails = normalizeMails(raw);
      console.log('[Mails] normalizados:', freshMails.length, 'items');

      if (freshMails.length === 0) {
        setDebugRaw(text.slice(0, 800));
      }

      // 2. Merge: nuevos + cache, sin duplicados por id
      const freshIds = new Set(freshMails.map((m: MailItem) => m.id));
      const oldOnly  = cachedMails.filter(m => !freshIds.has(m.id));
      const merged   = [...freshMails, ...oldOnly];

      setMails(merged);
      setFromCache(false);
      setLastRefreshed(new Date());

      // 3. Guardar todo en Supabase
      if (merged.length > 0) saveMailsCache(merged);
    } catch (err) {
      console.error('[Mails] error:', err);
      setDebugRaw(String(err));
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMails(true); }, []);

  const sendMail = async () => {
    if (!selected || !respuesta.trim()) return;
    setEnviando(true);
    try {
      const res = await fetch(WEBHOOK_SEND, {
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
    } catch {
      showToast('err', 'No se pudo enviar. Intentá de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  const handleSelectMail = (mail: MailItem) => {
    setSelected(mail);
    setRespuesta('');
  };

  // Guards: si por algún motivo el estado no es array, el render no crashea
  const safeMails = Array.isArray(mails) ? mails : [];

  const counts = safeMails.reduce((acc, m) => {
    acc[m.categoria] = (acc[m.categoria] ?? 0) + 1;
    return acc;
  }, {} as Partial<Record<Categoria, number>>);

  const visibleMails = ocultarSpam && filtro === 'todos'
    ? safeMails.filter(m => m.categoria !== 'spam')
    : safeMails;

  const filtered = filtro === 'todos' ? visibleMails : safeMails.filter(m => m.categoria === filtro);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="mails-page">

      {/* ══ PANEL IZQUIERDO ═════════════════════════════════════════════════ */}
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
          <button
            className={`filter-spam-toggle ${ocultarSpam ? 'active' : ''}`}
            onClick={() => setOcultarSpam(v => !v)}
            title={ocultarSpam ? 'El spam está oculto — click para mostrarlo' : 'Mostrando spam — click para ocultar'}
          >
            <EyeOff size={12} />
            {ocultarSpam ? 'Spam oculto' : 'Mostrar spam'}
          </button>
        </div>

        {/* Filtros */}
        <div className="mails-filters">
          {FILTROS.map(f => (
            <button
              key={f.key}
              className={`filter-btn ${filtro === f.key ? 'active' : ''}`}
              onClick={() => setFiltro(f.key)}
              style={
                filtro === f.key && f.key !== 'todos'
                  ? { color: CAT[f.key as Categoria].color, borderColor: CAT[f.key as Categoria].color + '55', background: CAT[f.key as Categoria].bg }
                  : undefined
              }
            >
              {f.label}
              {f.key === 'todos'
                ? <span className="filter-count">{safeMails.length}</span>
                : counts[f.key as Categoria]
                  ? <span className="filter-count">{counts[f.key as Categoria]}</span>
                  : null}
            </button>
          ))}
        </div>

        {/* Lista */}
        <div className="mails-list">
          {loading && <MailSkeleton />}

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
              {filtro === 'todos'
                ? 'No hay mails disponibles'
                : `No hay mails en la categoría "${CAT[filtro as Categoria]?.label ?? filtro}"`}
              {/* Panel de debug: muestra la respuesta cruda del webhook */}
              {debugRaw && filtro === 'todos' && (
                <details className="debug-panel">
                  <summary>Ver respuesta del webhook (debug)</summary>
                  <pre>{debugRaw}</pre>
                </details>
              )}
            </div>
          )}

          {!loading && !error && filtered.map(mail => (
            <div
              key={mail.id}
              className={`mail-item ${selected?.id === mail.id ? 'active' : ''}`}
              onClick={() => handleSelectMail(mail)}
            >
              <div className="mail-item-top">
                <span className={`mail-item-sender ${!mail.leido ? 'unread' : ''}`}>
                  {mail.nombre || mail.de}
                </span>
                <span className="mail-item-time">{timeAgo(mail.fecha)}</span>
              </div>
              <div className="mail-item-meta">
                <CatBadge cat={mail.categoria} />
                {!mail.leido && <span className="mail-unread-dot" />}
              </div>
              <p className="mail-item-summary">{mail.resumen}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ══ PANEL DERECHO ═══════════════════════════════════════════════════ */}
      <div className={`mails-right ${!selected ? 'mails-right-empty' : ''}`}>
        {!selected ? (
          <div className="mails-empty-state">
            <Inbox size={40} className="mails-empty-icon" />
            <p className="mails-empty-title">Seleccioná un mail para ver el detalle</p>
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

      {/* ══ TOAST ═══════════════════════════════════════════════════════════ */}
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
