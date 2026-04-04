export const config = { runtime: 'edge' };

const TN_TOKEN = '24cddf241e9dd8128a078572aeb7cc3da5a45f06';
const TN_STORE = '3349973';
const TN_BASE  = `https://api.tiendanube.com/v1/${TN_STORE}`;
const TN_HDR: Record<string, string> = {
  Authentication: `bearer ${TN_TOKEN}`,
  'User-Agent': 'NovaDashboard (contact@fromnorthgb.com)',
};

const SUPABASE_URL = 'https://tnmmbfcbviowhunnrzix.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRubW1iZmNidmlvd2h1bm5yeml4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMTc4MzcsImV4cCI6MjA4OTc5MzgzN30.ZZD8evIrlfY_77-DEh47L-JJxFOxhH8L9xZ_NjHN6QU';
const N8N_SEND = 'https://devwebhookn8n.santafeia.shop/webhook/responder-mail';

const META_TOKEN = 'EAASjWUjyKg8BRKJfCaos5WiSfXCYgWKXdg9k87639eFMswozkMjACeViWyqlWJ4HlCGQogOwZAshgyDyHEw7Rkjm3CHsAOY1aIZBCxKo7CAjQjO9akrjEECdfISW76h3ZAiDYOMtmAtnmm01yZBQyBwYEDtYwRRMZA6HrZA5rRrjMCxr4B5hCFFIv1DHw7cZCIt8QZDZD';
const META_ACCOUNTS: Record<string, string> = {
  fromnorth: '1110831870748256',
  juan:      '1271182561590203',
};
const GRAPH_API = 'https://graph.facebook.com/v19.0';

function buildSystemPrompt(): string {
  const now = new Date();
  const argStr = now.toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const todayISO = now.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }); // YYYY-MM-DD
  const yesterdayISO = new Date(now.getTime() - 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });

  return `Sos el asistente IA del dashboard de FROMNORTH, una marca de indumentaria argentina.
Tenés acceso completo al sistema y podés consultar, analizar y ejecutar cambios en tiempo real.

## Fecha y hora actual (SIEMPRE usá estos valores, no los de tu entrenamiento)
- Ahora en Argentina: ${argStr}
- Hoy (ISO): ${todayISO}
- Ayer (ISO): ${yesterdayISO}
- Zona horaria: America/Argentina/Buenos_Aires (UTC-3)
- Cuando pregunten por "hoy": created_at_min="${todayISO}T00:00:00-03:00" y created_at_max="${todayISO}T23:59:59-03:00"
- Cuando pregunten por "ayer": created_at_min="${yesterdayISO}T00:00:00-03:00" y created_at_max="${yesterdayISO}T23:59:59-03:00"
- Para totales de ventas del día usá siempre per_page=200 para no perder órdenes
- Para "última venta" o "última orden": llamá get_orders con per_page=1 (trae solo la más reciente, que es la primera del resultado)
- Las órdenes siempre vienen ordenadas de más nueva a más vieja — la primera del array ES la más reciente

## Sobre el negocio y el dueño
- El dueño es Enzo Agustín Ribot. Lo llamás Enzo.
- Su email es enzoribot02@gmail.com
- La marca se llama FromNorth, vende ropa (indumentaria)
- Es de Santa Fe Capital, Argentina
- Hace envíos con Andreani
- La tienda online es fromnorth.store

## Capacidades

### Consultas y análisis
- Ventas: totales, por producto, por fecha, comparativas, tendencias
- Clientes: lista, historial de compras, frecuencia, valor promedio
- Productos: stock, precios, más/menos vendidos
- Órdenes: estado, pendientes, canceladas, pagadas
- Emails: bandeja de entrada, categorías urgentes, consultas
- **Meta Ads**: campañas, gasto, impresiones, clicks, CTR, ROAS, frecuencia, alertas — disponible para las cuentas FROMNORTH y JUAN

### Acciones directas
- Cupones: crear con código, tipo (%, monto, envío gratis), valor, usos máximos, vencimiento
- Cupones: eliminar por ID
- Emails: enviar a clientes

## Reglas de acción
- Ejecutá las acciones directamente sin pedir confirmación innecesaria
- Si falta información clave (ej: qué % de descuento), preguntá antes
- Para eliminar cupones: mencioná cuál vas a borrar y luego hacelo

### REGLA IMPORTANTE — Emails
Antes de enviar cualquier email SIEMPRE debés mostrar al usuario un preview con este formato exacto y esperar su confirmación:

---
📧 **Resumen del email a enviar:**
- **Para:** [email]
- **Asunto:** [asunto]
- **Mensaje:**
[cuerpo completo del email]

¿Lo envío?
---

Solo ejecutá send_email después de que el usuario confirme explícitamente (responda "sí", "envialo", "dale", "ok", "confirmado" o similar).
Si el usuario pide cambios, modificá el borrador y volvé a mostrar el preview antes de enviar.

## Análisis
- Siempre incluí contexto comparativo cuando das métricas
- Detectá anomalías aunque no te lo pidan
- Números en formato legible: $1.200, no 1200.00
- Para Meta Ads: cuando no se especifica cuenta, traé ambas (fromnorth y juan) y compará
- Si los datos son insuficientes, decilo

## Estilo
- Español rioplatense, tuteo, directo y sin vueltas
- Respuestas cortas cuando la pregunta es simple
- Tablas y listas cuando hay múltiples datos para comparar
- Confirmá brevemente cada acción ejecutada`;
}

const tools = [
  {
    name: 'get_orders',
    description: `Obtiene órdenes de la tienda ordenadas de la MÁS NUEVA a la más vieja (descendente por fecha).
REGLAS OBLIGATORIAS:
- "última venta" / "última orden": per_page=1 (trae solo la más reciente)
- "ventas de hoy": created_at_min=HOY_ISO+"T00:00:00-03:00", created_at_max=HOY_ISO+"T23:59:59-03:00", per_page=200
- "ventas de ayer": created_at_min=AYER_ISO+"T00:00:00-03:00", created_at_max=AYER_ISO+"T23:59:59-03:00", per_page=200
- "total de ventas": siempre usá per_page=200 y filtrá por fecha para no perder órdenes
- Nunca uses per_page<200 cuando calculás totales o sumas`,
    input_schema: {
      type: 'object',
      properties: {
        payment_status: { type: 'string', enum: ['paid', 'pending', 'unpaid', 'authorized', 'refunded', 'voided', 'partially_paid'], description: 'Filtrar por estado de pago' },
        status: { type: 'string', enum: ['open', 'closed', 'cancelled'], description: 'Filtrar por estado de orden' },
        per_page: { type: 'number', description: 'Resultados (max 200). Usá 1 para la última venta, 200 para totales.' },
        page: { type: 'number', description: 'Página' },
        created_at_min: { type: 'string', description: 'Fecha mínima ISO 8601 con timezone, ej: 2026-04-03T00:00:00-03:00' },
        created_at_max: { type: 'string', description: 'Fecha máxima ISO 8601 con timezone, ej: 2026-04-03T23:59:59-03:00' },
      },
    },
  },
  {
    name: 'get_products',
    description: 'Obtiene productos de la tienda con stock, precio y variantes.',
    input_schema: {
      type: 'object',
      properties: {
        per_page: { type: 'number', description: 'Resultados (max 200, default 50)' },
        q: { type: 'string', description: 'Búsqueda por nombre' },
      },
    },
  },
  {
    name: 'get_customers',
    description: 'Obtiene clientes con historial de compras y datos de contacto.',
    input_schema: {
      type: 'object',
      properties: {
        q: { type: 'string', description: 'Búsqueda por nombre o email' },
        per_page: { type: 'number', description: 'Resultados (default 30)' },
      },
    },
  },
  {
    name: 'get_coupons',
    description: 'Obtiene cupones de descuento existentes (activos e inactivos). Usalo antes de eliminar un cupón para obtener el ID.',
    input_schema: {
      type: 'object',
      properties: {
        per_page: { type: 'number', description: 'Resultados (default 50)' },
      },
    },
  },
  {
    name: 'create_coupon',
    description: 'Crea un nuevo cupón de descuento en la tienda.',
    input_schema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Código del cupón (ej: PROMO20)' },
        type: { type: 'string', enum: ['percentage', 'absolute', 'shipping'], description: 'percentage=% de descuento, absolute=monto fijo ARS, shipping=envío gratis' },
        value: { type: 'number', description: 'Valor del descuento (porcentaje o monto ARS)' },
        max_uses: { type: 'number', description: 'Usos máximos totales (omitir para ilimitado)' },
        min_price: { type: 'string', description: 'Monto mínimo de compra en ARS (como string, ej: "5000")' },
        valid_until: { type: 'string', description: 'Vencimiento: YYYY-MM-DD HH:MM:SS' },
      },
      required: ['code', 'type', 'value'],
    },
  },
  {
    name: 'delete_coupon',
    description: 'Elimina un cupón por su ID. Si no sabés el ID, usá get_coupons primero.',
    input_schema: {
      type: 'object',
      properties: {
        coupon_id: { type: 'number', description: 'ID numérico del cupón' },
      },
      required: ['coupon_id'],
    },
  },
  {
    name: 'send_email',
    description: 'Envía un email a un cliente. IMPORTANTE: solo llamar este tool después de que el usuario haya confirmado el preview del email.',
    input_schema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Email del destinatario' },
        subject: { type: 'string', description: 'Asunto' },
        body: { type: 'string', description: 'Cuerpo del email en texto plano' },
        thread_id: { type: 'string', description: 'ID del hilo si es una respuesta (opcional)' },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  {
    name: 'get_emails',
    description: 'Obtiene emails de la bandeja de entrada.',
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Cantidad (default 20, max 60)' },
        categoria: { type: 'string', enum: ['urgente', 'reclamo', 'consulta', 'positivo', 'info', 'spam'], description: 'Filtrar por categoría' },
        leido: { type: 'boolean', description: 'true=leídos, false=no leídos' },
      },
    },
  },
  {
    name: 'get_meta_insights',
    description: 'Obtiene métricas de Meta Ads (Facebook/Instagram): gasto, impresiones, clicks, CTR, alcance, frecuencia, compras, ROAS. Usalo para cualquier consulta sobre campañas publicitarias.',
    input_schema: {
      type: 'object',
      properties: {
        account: {
          type: 'string',
          enum: ['fromnorth', 'juan', 'ambas'],
          description: 'Cuenta publicitaria. "fromnorth" = cuenta principal FROMNORTH, "juan" = cuenta JUAN, "ambas" = trae las dos',
        },
        date_preset: {
          type: 'string',
          enum: ['today', 'yesterday', 'last_7d', 'last_14d', 'last_30d', 'this_month', 'last_month'],
          description: 'Período de tiempo (default: last_7d)',
        },
        level: {
          type: 'string',
          enum: ['campaign', 'adset', 'ad'],
          description: 'Nivel de desglose (default: campaign)',
        },
      },
    },
  },
  {
    name: 'get_meta_campaigns',
    description: 'Obtiene la lista de campañas de Meta Ads con su estado (activa, pausada) y presupuesto.',
    input_schema: {
      type: 'object',
      properties: {
        account: {
          type: 'string',
          enum: ['fromnorth', 'juan', 'ambas'],
          description: 'Cuenta publicitaria (default: ambas)',
        },
      },
    },
  },
];

// ── Meta Ads helpers ──────────────────────────────────────────────────────────

async function metaGet(path: string, params: Record<string, string> = {}) {
  const qs = new URLSearchParams({ ...params, access_token: META_TOKEN });
  const res = await fetch(`${GRAPH_API}${path}?${qs}`);
  const json = await res.json() as any;
  if (json.error) throw new Error(`Meta API: ${json.error.message} (code ${json.error.code})`);
  return json;
}

function extractAction(actions: { action_type: string; value: string }[] | undefined, type: string): number {
  return parseFloat(actions?.find(a => a.action_type === type)?.value ?? '0') || 0;
}

async function fetchMetaInsightsForAccount(accountId: string, datePreset: string, level: string) {
  const accountFmt = `act_${accountId}`;
  const result = await metaGet(`/${accountFmt}/insights`, {
    fields: 'campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,impressions,clicks,ctr,spend,reach,frequency,actions,action_values',
    date_preset: datePreset,
    level,
    effective_status: '["ACTIVE","PAUSED","ARCHIVED"]',
    limit: '200',
  });
  return (result.data ?? []).map((r: any) => ({
    name: r.campaign_name ?? r.adset_name ?? r.ad_name ?? '—',
    impressions: parseInt(r.impressions ?? '0') || 0,
    clicks: parseInt(r.clicks ?? '0') || 0,
    ctr: parseFloat(r.ctr ?? '0') || 0,
    spend: parseFloat(r.spend ?? '0') || 0,
    reach: parseInt(r.reach ?? '0') || 0,
    frequency: parseFloat(r.frequency ?? '0') || 0,
    purchases: extractAction(r.actions, 'purchase'),
    revenue: extractAction(r.action_values, 'purchase'),
    roas: parseFloat(r.spend ?? '0') > 0
      ? (extractAction(r.action_values, 'purchase') / parseFloat(r.spend ?? '1'))
      : 0,
  }));
}

async function fetchMetaCampaignsForAccount(accountId: string) {
  const accountFmt = `act_${accountId}`;
  const result = await metaGet(`/${accountFmt}/campaigns`, {
    fields: 'id,name,status,objective,daily_budget,lifetime_budget',
    effective_status: '["ACTIVE","PAUSED","ARCHIVED"]',
    limit: '100',
  });
  return (result.data ?? []).map((c: any) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    objective: c.objective,
    daily_budget: c.daily_budget ? `$${(parseInt(c.daily_budget) / 100).toFixed(2)}` : null,
    lifetime_budget: c.lifetime_budget ? `$${(parseInt(c.lifetime_budget) / 100).toFixed(2)}` : null,
  }));
}

// ── TiendaNube helpers ────────────────────────────────────────────────────────

function simplifyOrder(o: any) {
  return {
    id: o.id, number: o.number, status: o.status, payment_status: o.payment_status,
    total: o.total, discount: o.discount, created_at: o.created_at,
    customer: o.customer ? { id: o.customer.id, name: o.customer.name, email: o.customer.email } : null,
    products: (o.products ?? []).map((p: any) => ({ name: p.name, quantity: p.quantity, price: p.price })),
    payment_method: o.payment_details?.method ?? null,
    coupon: (o.coupon ?? []).map((c: any) => ({ code: c.code, type: c.type, value: c.value })),
  };
}

function simplifyProduct(p: any) {
  const name = p.name?.es ?? p.name?.en ?? Object.values(p.name ?? {})[0] ?? String(p.id);
  return {
    id: p.id, name,
    variants: (p.variants ?? []).map((v: any) => ({
      id: v.id, sku: v.sku, price: v.price, stock: v.stock,
      label: v.values?.map((val: any) => val.es ?? val.en ?? '').join(' / '),
    })),
  };
}

function tnFetch(path: string, params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString();
  return fetch(`${TN_BASE}/${path}${qs ? '?' + qs : ''}`, { headers: TN_HDR });
}

// ── Tool executor ─────────────────────────────────────────────────────────────

async function executeTool(name: string, input: Record<string, any>): Promise<string> {
  try {
    switch (name) {

      case 'get_orders': {
        const perPage = Math.min(Number(input.per_page ?? 50), 200);
        const fixedPage = input.page ? Number(input.page) : null;
        const baseParams: Record<string, string> = { per_page: String(perPage) };
        if (input.payment_status) baseParams.payment_status = input.payment_status;
        if (input.status) baseParams.status = input.status;
        if (input.created_at_min) baseParams.created_at_min = input.created_at_min;
        if (input.created_at_max) baseParams.created_at_max = input.created_at_max;

        // Si piden una página específica o per_page=1, no paginar
        if (fixedPage !== null || perPage === 1) {
          baseParams.page = String(fixedPage ?? 1);
          const res = await tnFetch('orders', baseParams);
          const data = await res.json() as any[];
          const simplified = (Array.isArray(data) ? data : []).map(simplifyOrder);
          return JSON.stringify({ total: simplified.length, orders: simplified });
        }

        // Paginación automática: seguir pidiendo hasta que una página devuelva menos de 200
        const allOrders: any[] = [];
        let page = 1;
        while (page <= 20) { // máx 20 páginas = 4000 órdenes
          const res = await tnFetch('orders', { ...baseParams, page: String(page) });
          const data = await res.json() as any[];
          if (!Array.isArray(data) || data.length === 0) break;
          allOrders.push(...data.map(simplifyOrder));
          if (data.length < perPage) break; // última página
          page++;
        }
        return JSON.stringify({ total: allOrders.length, orders: allOrders });
      }

      case 'get_products': {
        const p: Record<string, string> = { per_page: String(input.per_page ?? 50) };
        if (input.q) p.q = input.q;
        const res = await tnFetch('products', p);
        const data = await res.json() as any[];
        const simplified = (Array.isArray(data) ? data : []).map(simplifyProduct);
        return JSON.stringify({ total: simplified.length, products: simplified });
      }

      case 'get_customers': {
        const p: Record<string, string> = { per_page: String(input.per_page ?? 30) };
        if (input.q) p.q = input.q;
        const res = await tnFetch('customers', p);
        const data = await res.json() as any[];
        const simplified = (Array.isArray(data) ? data : []).map((c: any) => ({
          id: c.id, name: c.name, email: c.email, phone: c.phone,
          total_spent: c.total_spent, orders_count: c.orders_count, created_at: c.created_at,
        }));
        return JSON.stringify({ total: simplified.length, customers: simplified });
      }

      case 'get_coupons': {
        const res = await tnFetch('coupons', { per_page: String(input.per_page ?? 50) });
        return JSON.stringify(await res.json());
      }

      case 'create_coupon': {
        const body: Record<string, any> = { code: input.code, type: input.type, value: input.value, valid: true };
        if (input.max_uses != null) body.max_uses = input.max_uses;
        if (input.min_price != null) body.min_price = input.min_price;
        if (input.valid_until) body.valid_until = input.valid_until;
        const res = await fetch(`${TN_BASE}/coupons`, {
          method: 'POST',
          headers: { ...TN_HDR, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) return `Error ${res.status}: ${JSON.stringify(data)}`;
        return `Cupón creado: ID ${data.id}, código "${data.code}", tipo ${data.type}, valor ${data.value}`;
      }

      case 'delete_coupon': {
        const res = await fetch(`${TN_BASE}/coupons/${input.coupon_id}`, { method: 'DELETE', headers: TN_HDR });
        if (res.ok || res.status === 204) return `Cupón ${input.coupon_id} eliminado correctamente`;
        return `Error ${res.status}: ${await res.text()}`;
      }

      case 'send_email': {
        const res = await fetch(N8N_SEND, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ threadId: input.thread_id ?? null, to: input.to, asunto: input.subject, mensaje: input.body }),
        });
        if (res.ok) return `Email enviado a ${input.to} — Asunto: "${input.subject}"`;
        return `Error enviando email: HTTP ${res.status}`;
      }

      case 'get_emails': {
        let url = `${SUPABASE_URL}/rest/v1/mails?select=id,thread_id,de,nombre,asunto,fecha,leido,categoria,resumen&order=fecha.desc&limit=${Math.min(input.limit ?? 20, 60)}`;
        if (input.categoria) url += `&categoria=eq.${input.categoria}`;
        if (input.leido != null) url += `&leido=eq.${input.leido}`;
        const res = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
        return JSON.stringify(await res.json());
      }

      case 'get_meta_insights': {
        const account  = input.account ?? 'ambas';
        const preset   = input.date_preset ?? 'last_7d';
        const level    = input.level ?? 'campaign';
        const results: Record<string, any> = {};

        if (account === 'fromnorth' || account === 'ambas') {
          results.fromnorth = await fetchMetaInsightsForAccount(META_ACCOUNTS.fromnorth, preset, level);
        }
        if (account === 'juan' || account === 'ambas') {
          results.juan = await fetchMetaInsightsForAccount(META_ACCOUNTS.juan, preset, level);
        }
        return JSON.stringify({ period: preset, level, data: results });
      }

      case 'get_meta_campaigns': {
        const account = input.account ?? 'ambas';
        const results: Record<string, any> = {};

        if (account === 'fromnorth' || account === 'ambas') {
          results.fromnorth = await fetchMetaCampaignsForAccount(META_ACCOUNTS.fromnorth);
        }
        if (account === 'juan' || account === 'ambas') {
          results.juan = await fetchMetaCampaignsForAccount(META_ACCOUNTS.juan);
        }
        return JSON.stringify(results);
      }

      default:
        return `Tool desconocido: ${name}`;
    }
  } catch (err) {
    return `Error en ${name}: ${String(err)}`;
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req: Request): Promise<Response> {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const apiKey = (process.env.ANTHROPIC_API_KEY ?? '').trim();
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY no configurada. Agregala en Vercel → Settings → Environment Variables.' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  let body: { messages: { role: string; content: string }[] };
  try { body = await req.json(); }
  catch {
    return new Response(JSON.stringify({ error: 'JSON inválido' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const allMessages: any[] = [...body.messages];

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (chunk: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));

      try {
        for (let i = 0; i < 4; i++) {
          const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 1024,
              system: buildSystemPrompt(),
              tools,
              messages: allMessages,
              stream: true,
            }),
          });

          if (!claudeRes.ok) {
            const err = await claudeRes.text();
            send({ error: `Claude API error ${claudeRes.status}: ${err.slice(0, 200)}` });
            break;
          }

          const reader = claudeRes.body!.getReader();
          const decoder = new TextDecoder();

          let stopReason = '';
          let assistantContent: any[] = [];
          let currentTextBlock: any = null;
          let currentToolBlock: any = null;
          let inputJsonAccum = '';
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6).trim();
              if (!data || data === '[DONE]') continue;

              try {
                const event = JSON.parse(data);
                switch (event.type) {
                  case 'content_block_start':
                    if (event.content_block.type === 'text') {
                      currentTextBlock = { type: 'text', text: '' };
                      assistantContent.push(currentTextBlock);
                    } else if (event.content_block.type === 'tool_use') {
                      currentToolBlock = { type: 'tool_use', id: event.content_block.id, name: event.content_block.name, input: {} };
                      assistantContent.push(currentToolBlock);
                      inputJsonAccum = '';
                    }
                    break;
                  case 'content_block_delta':
                    if (event.delta.type === 'text_delta') {
                      const text = event.delta.text;
                      if (currentTextBlock) currentTextBlock.text += text;
                      send({ text });
                    } else if (event.delta.type === 'input_json_delta') {
                      inputJsonAccum += event.delta.partial_json;
                    }
                    break;
                  case 'content_block_stop':
                    if (currentToolBlock) {
                      try { currentToolBlock.input = JSON.parse(inputJsonAccum || '{}'); } catch {}
                      currentToolBlock = null;
                      inputJsonAccum = '';
                    }
                    currentTextBlock = null;
                    break;
                  case 'message_delta':
                    stopReason = event.delta.stop_reason ?? '';
                    break;
                }
              } catch {}
            }
          }

          if (stopReason === 'end_turn') break;

          if (stopReason === 'tool_use') {
            allMessages.push({ role: 'assistant', content: assistantContent });
            const toolUseBlocks = assistantContent.filter(b => b.type === 'tool_use');
            const results: any[] = [];
            for (const tool of toolUseBlocks) {
              const result = await executeTool(tool.name, tool.input ?? {});
              results.push({ type: 'tool_result', tool_use_id: tool.id, content: result });
            }
            allMessages.push({ role: 'user', content: results });
            assistantContent = [];
          } else {
            break;
          }
        }
      } catch (err) {
        send({ error: `Error interno: ${String(err).slice(0, 200)}` });
      }

      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      ...CORS,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      'Transfer-Encoding': 'chunked',
    },
  });
}
