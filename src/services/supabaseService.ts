const SUPABASE_URL = 'https://tnmmbfcbviowhunnrzix.supabase.co';

// ── mails ─────────────────────────────────────────────────────────────────────

export interface MailRow {
  id: string;
  thread_id: string;
  de: string;
  nombre: string;
  asunto: string;
  cuerpo: string;
  fecha: string;
  leido: boolean;
  categoria: string;
  resumen: string;
  respuesta_sugerida: string;
}

export async function fetchMailsFromDB(): Promise<MailRow[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/mails?select=*&order=fecha.desc&limit=60`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function upsertMails(mails: MailRow[]): Promise<void> {
  if (mails.length === 0) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/mails`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(mails),
    });
  } catch {
    // silencioso
  }
}
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRubW1iZmNidmlvd2h1bm5yeml4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMTc4MzcsImV4cCI6MjA4OTc5MzgzN30.ZZD8evIrlfY_77-DEh47L-JJxFOxhH8L9xZ_NjHN6QU';

// ── productos_ocultos ─────────────────────────────────────────────────────────

export async function fetchProductosOcultos(): Promise<{ sku: string; nombre: string }[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/productos_ocultos?select=sku,nombre`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    }
  );
  if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
  return res.json();
}

export async function insertProductoOculto(sku: string, nombre: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/productos_ocultos`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ sku, nombre }),
  });
  if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
}

export async function insertProductosOcultosBulk(
  items: { sku: string; nombre: string }[]
): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/productos_ocultos`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(items),
  });
  if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
}

export async function deleteProductoOculto(sku: string): Promise<void> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/productos_ocultos?sku=eq.${encodeURIComponent(sku)}`,
    {
      method: 'DELETE',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    }
  );
  if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
}

export async function deleteAllProductosOcultos(): Promise<void> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/productos_ocultos?id=gt.0`,
    {
      method: 'DELETE',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    }
  );
  if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
}

export interface RuletaGirada {
  id: number;
  created_at: string;
  premio: string;
  codigo: string | null;
  mensaje: string;
  fecha: string;
  email: string;
}

export interface RuletaMetrics {
  registros: RuletaGirada[];
  totalGiros: number;
  premiosOtorgados: number;
  participantesUnicos: number;
  tasaGanadores: number;
  distribucionPremios: { name: string; value: number; color: string }[];
  girosPorDia: { name: string; value: number }[];
}

const PREMIO_COLORS: Record<string, string> = {
  'Envio gratis':       '#06b6d4',
  '10% de descuento':   '#6366f1',
  '5% de descuento':    '#10b981',
  '1 Camisa gratis':    '#f59e0b',
  '30% de descuento':   '#ef4444',
  'Segui participando': '#475569',
};

export const PREMIO_COLOR_MAP = PREMIO_COLORS;

export async function fetchRuletaMetrics(): Promise<RuletaMetrics | null> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/ruleta_girada?select=*&order=created_at.asc`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );
    if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
    const data: RuletaGirada[] = await res.json();

    const totalGiros = data.length;
    const premiosOtorgados = data.filter(r => r.premio !== 'Segui participando').length;
    const participantesUnicos = new Set(data.map(r => r.email)).size;
    const tasaGanadores =
      totalGiros > 0 ? Math.round((premiosOtorgados / totalGiros) * 100) : 0;

    // Distribución de premios
    const premioCount: Record<string, number> = {};
    for (const r of data) {
      premioCount[r.premio] = (premioCount[r.premio] || 0) + 1;
    }
    const distribucionPremios = Object.entries(premioCount).map(([name, value]) => ({
      name,
      value,
      color: PREMIO_COLORS[name] ?? '#8b5cf6',
    }));

    // Giros por día (orden cronológico)
    const diaCount: Record<string, number> = {};
    for (const r of data) {
      const day = new Date(r.created_at).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
      });
      diaCount[day] = (diaCount[day] || 0) + 1;
    }
    const girosPorDia = Object.entries(diaCount).map(([name, value]) => ({ name, value }));

    return {
      registros: [...data].reverse(), // más recientes primero
      totalGiros,
      premiosOtorgados,
      participantesUnicos,
      tasaGanadores,
      distribucionPremios,
      girosPorDia,
    };
  } catch (err) {
    console.error('Error fetching ruleta metrics:', err);
    return null;
  }
}
