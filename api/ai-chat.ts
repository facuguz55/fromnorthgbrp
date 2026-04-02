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

const SYSTEM = `Sos el asistente IA del dashboard de FROMNORTH, una marca de indumentaria argentina.
Tenés acceso completo al sistema y podés consultar, analizar y ejecutar cambios en tiempo real.

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

const tools = [
  {
    name: 'get_orders',
    description: 'Obtiene órdenes recientes de la tienda. Usá este tool para consultas de ventas, pagos, órdenes o clientes que compraron.',
    input_schema: {
      type: 'object',
      properties: {
        payment_status: { type: 'string', enum: ['paid', 'pending', 'unpaid', 'authorized', 'refunded', 'voided', 'partially_paid'], description: 'Filtrar por estado de pago' },
        status: { type: 'string', enum: ['open', 'closed', 'cancelled'], description: 'Filtrar por estado de orden' },
        per_page: { type: 'number', description: 'Resultados (max 200, default 50)' },
        page: { type: 'number', description: 'Página' },
        created_at_min: { type: 'string', description: 'Fecha mínima ISO 8601' },
        created_at_max: { type: 'string', description: 'Fecha máxima ISO 8601' },
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
        const p: Record<string, string> = { per_page: String(input.per_page ?? 50), page: String(input.page ?? 1) };
        if (input.payment_status) p.payment_status = input.payment_status;
        if (input.status) p.status = input.status;
        if (input.created_at_min) p.created_at_min = input.created_at_min;
        if (input.created_at_max) p.created_at_max = input.created_at_max;
        const res = await tnFetch('orders', p);
        const data = await res.json() as any[];
        const simplified = (Array.isArray(data) ? data : []).map(simplifyOrder);
        return JSON.stringify({ total: simplified.length, orders: simplified });
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
  let finalText = '';

  for (let i = 0; i < 4; i++) {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: SYSTEM,
        tools,
        messages: allMessages,
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      return new Response(JSON.stringify({ error: `Claude API error ${claudeRes.status}: ${err.slice(0, 300)}` }), {
        status: 502, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const claude = await claudeRes.json() as any;

    if (claude.stop_reason === 'end_turn') {
      finalText = (claude.content as any[]).find((b: any) => b.type === 'text')?.text ?? '';
      break;
    }

    if (claude.stop_reason === 'tool_use') {
      allMessages.push({ role: 'assistant', content: claude.content });
      const results: any[] = [];
      for (const block of claude.content as any[]) {
        if (block.type === 'tool_use') {
          const result = await executeTool(block.name, block.input ?? {});
          results.push({ type: 'tool_result', tool_use_id: block.id, content: result });
        }
      }
      allMessages.push({ role: 'user', content: results });
      continue;
    }

    finalText = (claude.content as any[])?.find((b: any) => b.type === 'text')?.text ?? 'Sin respuesta.';
    break;
  }

  return new Response(JSON.stringify({ response: finalText || 'No pude generar una respuesta.' }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
