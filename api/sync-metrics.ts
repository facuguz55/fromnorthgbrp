export const config = { maxDuration: 60 };

const TN_TOKEN = '24cddf241e9dd8128a078572aeb7cc3da5a45f06';
const TN_STORE = '3349973';
const TN_BASE  = `https://api.tiendanube.com/v1/${TN_STORE}`;
const TN_HDR   = {
  Authentication: `bearer ${TN_TOKEN}`,
  'User-Agent': 'NovaDashboard (contact@fromnorthgb.com)',
};

const SB_URL = 'https://tnmmbfcbviowhunnrzix.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRubW1iZmNidmlvd2h1bm5yeml4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMTc4MzcsImV4cCI6MjA4OTc5MzgzN30.ZZD8evIrlfY_77-DEh47L-JJxFOxhH8L9xZ_NjHN6QU';

const simplify = (o: any) => ({
  id: o.id,
  number: o.number,
  status: o.status,
  payment_status: o.payment_status,
  total: o.total,
  subtotal: o.subtotal,
  total_shipping: o.total_shipping,
  discount: o.discount,
  created_at: o.created_at,
  customer: o.customer
    ? { id: o.customer.id, name: o.customer.name, email: o.customer.email }
    : null,
  products: (o.products ?? []).map((p: any) => ({
    name: p.name, quantity: p.quantity, price: p.price, sku: p.sku ?? null,
  })),
  payment_details: o.payment_details
    ? {
        method: o.payment_details.method,
        credit_card_company: o.payment_details.credit_card_company ?? null,
        installments: o.payment_details.installments ?? null,
      }
    : null,
  coupon: o.coupon ?? null,
});

async function doSync(full: boolean, all: boolean): Promise<{ mode: string; orders: number }> {
  const DAYS_BACK = 90;

  // Modo "all": sincroniza TODA la historia sin restricción de fechas a tn_orders_full
  if (all) {
    const allOrders: any[] = [];
    const BATCH = 5;
    for (let batch = 0; batch < 5; batch++) {
      const startPage = batch * BATCH + 1;
      const pages = Array.from({ length: BATCH }, (_, i) => startPage + i);
      const results = await Promise.all(pages.map(async page => {
        const res = await fetch(`${TN_BASE}/orders?per_page=200&page=${page}`, { headers: TN_HDR });
        if (!res.ok) return { orders: [], hasMore: false };
        const data = await res.json() as any[];
        const hasMore = (res.headers.get('Link') ?? '').includes('rel="next"');
        return { orders: Array.isArray(data) ? data.map(simplify) : [], hasMore };
      }));
      for (const r of results) allOrders.push(...r.orders);
      if (!results.some(r => r.hasMore)) break;
    }
    await upsertToOrdersFull(allOrders);
    return { mode: 'all', orders: allOrders.length };
  }

  if (full) {
    const since = new Date(Date.now() - DAYS_BACK * 86_400_000).toISOString();
    const allOrders: any[] = [];
    const BATCH = 10;

    for (let batch = 0; batch < 10; batch++) {
      const startPage = batch * BATCH + 1;
      const pages = Array.from({ length: BATCH }, (_, i) => startPage + i);
      const results = await Promise.all(pages.map(async page => {
        const res = await fetch(`${TN_BASE}/orders?per_page=200&page=${page}&created_at_min=${since}`, { headers: TN_HDR });
        if (!res.ok) return { orders: [], hasMore: false };
        const data = await res.json() as any[];
        const hasMore = (res.headers.get('Link') ?? '').includes('rel="next"');
        return { orders: Array.isArray(data) ? data.map(simplify) : [], hasMore };
      }));

      for (const r of results) allOrders.push(...r.orders);
      const lastWithMore = results[results.length - 1].hasMore;
      if (!lastWithMore) break;
    }

    if (allOrders.length > 0) await upsertRows(allOrders);
    return { mode: 'full', orders: allOrders.length };
  }

  // Incremental: últimas 24 horas para capturar nuevas órdenes y cambios de estado
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const tnRes = await fetch(`${TN_BASE}/orders?per_page=200&page=1&created_at_min=${since}`, { headers: TN_HDR });
  if (!tnRes.ok) {
    const body = await tnRes.text().catch(() => '');
    // TiendaNube devuelve 404 "Last page is 0" cuando no hay órdenes en el período — es resultado vacío, no error
    if (tnRes.status === 404 && body.includes('Last page is 0')) return { mode: 'incremental', orders: 0 };
    throw new Error(`TiendaNube ${tnRes.status}: ${body}`);
  }

  const orders = ((await tnRes.json()) as any[]).map(simplify);
  if (orders.length > 0) await upsertRows(orders);

  return { mode: 'incremental', orders: orders.length };
}

async function upsertToOrdersFull(orders: any[]): Promise<void> {
  if (orders.length === 0) return;
  const now = new Date().toISOString();
  const rows = orders.map(o => ({
    id:              o.id,
    number:          o.number,
    status:          o.status,
    payment_status:  o.payment_status,
    total:           parseFloat(o.total)          || 0,
    subtotal:        parseFloat(o.subtotal)        || 0,
    total_shipping:  parseFloat(o.total_shipping)  || 0,
    discount:        parseFloat(o.discount)        || 0,
    created_at:      o.created_at,
    customer:        o.customer,
    products:        o.products,
    payment_details: o.payment_details,
    coupon:          o.coupon,
    synced_at:       now,
  }));
  const BATCH = 200;
  for (let i = 0; i < rows.length; i += BATCH) {
    await fetch(`${SB_URL}/rest/v1/tn_orders_full`, {
      method: 'POST',
      headers: {
        apikey: SB_KEY,
        Authorization: `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(rows.slice(i, i + BATCH)),
    });
  }
}

async function upsertRows(newOrders: any[]): Promise<void> {
  if (newOrders.length === 0) return;

  // Escribir en tn_orders_full (tabla normalizada, carga rápida)
  await upsertToOrdersFull(newOrders);

  // Escribir en tn_orders_cache (blob, compatibilidad con dashboard 90d)
  let existing: any[] = [];
  try {
    const cacheRes = await fetch(
      `${SB_URL}/rest/v1/tn_orders_cache?select=orders&id=eq.main&limit=1`,
      { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
    );
    if (cacheRes.ok) {
      const rows = await cacheRes.json() as any[];
      if (rows?.length && rows[0]?.orders) {
        existing = typeof rows[0].orders === 'string' ? JSON.parse(rows[0].orders) : rows[0].orders;
      }
    }
  } catch { /* empieza con array vacío */ }

  const map: Record<number, any> = {};
  for (const o of existing) map[o.id] = o;
  for (const o of newOrders) map[o.id] = o;
  const merged = Object.values(map).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  await fetch(`${SB_URL}/rest/v1/tn_orders_cache`, {
    method: 'POST',
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify([{ id: 'main', orders: JSON.stringify(merged) }]),
  });
}

// Handler sincrónico: espera a que el sync termine antes de responder.
// El frontend espera este 200 para saber que tn_orders_cache está actualizado.
// Para cron-job.org: configurar timeout en 55 segundos.
export default async function handler(req: any, res: any): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const params = new URL(req.url, 'http://x').searchParams;
  const full = (req.query?.full ?? params.get('full')) === '1';
  const all  = (req.query?.all  ?? params.get('all'))  === '1';

  try {
    const result = await doSync(full, all);
    res.status(200).json({ ok: true, ...result });
  } catch (err: any) {
    console.error('[sync-metrics] Error:', err?.message ?? err);
    res.status(500).json({ ok: false, error: String(err?.message ?? err) });
  }
}
