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
    ? { method: o.payment_details.method, credit_card_company: o.payment_details.credit_card_company ?? null }
    : null,
  coupon: o.coupon ?? null,
});

async function doSync(full: boolean): Promise<{ mode: string; orders: number }> {
  const DAYS_BACK = 90;

  if (full) {
    const since = new Date(Date.now() - DAYS_BACK * 86_400_000).toISOString();
    const qs1 = new URLSearchParams({ per_page: '200', page: '1', created_at_min: since });
    const res1 = await fetch(`${TN_BASE}/orders?${qs1}`, { headers: TN_HDR });
    if (!res1.ok) throw new Error(`TiendaNube ${res1.status}`);

    const data1 = await res1.json() as any[];
    const hasMore = (res1.headers.get('Link') ?? '').includes('rel="next"');
    let allOrders = data1.map(simplify);

    if (hasMore) {
      const pages = await Promise.all([2, 3, 4, 5].map(async page => {
        const qs = new URLSearchParams({ per_page: '200', page: String(page), created_at_min: since });
        const res = await fetch(`${TN_BASE}/orders?${qs}`, { headers: TN_HDR });
        if (!res.ok) return [];
        const data = await res.json() as any[];
        return Array.isArray(data) ? data.map(simplify) : [];
      }));
      allOrders = allOrders.concat(...pages);
    }

    await upsertRows(allOrders);
    return { mode: 'full', orders: allOrders.length };
  }

  // Incremental: últimas 2 horas para capturar cambios de estado de pago
  const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const qs = new URLSearchParams({ per_page: '200', page: '1', created_at_min: since });
  const tnRes = await fetch(`${TN_BASE}/orders?${qs}`, { headers: TN_HDR });
  if (!tnRes.ok) throw new Error(`TiendaNube ${tnRes.status}`);

  const orders = ((await tnRes.json()) as any[]).map(simplify);
  if (orders.length > 0) await upsertRows(orders);

  return { mode: 'incremental', orders: orders.length };
}

async function upsertRows(orders: any[]): Promise<void> {
  const rows = orders.map(o => ({
    id: o.id,
    data: o,
    order_date: o.created_at,
  }));
  await fetch(`${SB_URL}/rest/v1/tn_order_rows`, {
    method: 'POST',
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(rows),
  });
}

// Handler estilo Node.js: responde 200 de inmediato para no dar timeout al cron,
// luego sigue ejecutando el sync en background hasta completar o llegar a maxDuration.
export default async function handler(req: any, res: any): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const full = (req.query?.full ?? new URL(req.url, 'http://x').searchParams.get('full')) === '1';

  // Responder inmediatamente — el cron ve 200 y no da timeout
  res.status(200).json({ ok: true, started: true, mode: full ? 'full' : 'incremental' });

  // Continuar el sync después de enviar la respuesta
  try {
    await doSync(full);
  } catch (err: any) {
    console.error('[sync-metrics] Error:', err?.message ?? err);
  }
}
