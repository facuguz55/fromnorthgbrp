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

export default async function handler(req: Request): Promise<Response> {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  try {
    const url = new URL(req.url);
    const full = url.searchParams.get('full') === '1';
    const DAYS_BACK = 90;

    // Sync completo (?full=1): fetchea 90 días en paralelo
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
      return new Response(JSON.stringify({ ok: true, mode: 'full', orders: allOrders.length }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Sync incremental (cron): solo órdenes de los últimos 30 min
    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const qs = new URLSearchParams({ per_page: '50', page: '1', created_at_min: since });
    const tnRes = await fetch(`${TN_BASE}/orders?${qs}`, { headers: TN_HDR });
    if (!tnRes.ok) throw new Error(`TiendaNube ${tnRes.status}`);

    const orders = ((await tnRes.json()) as any[]).map(simplify);
    if (orders.length > 0) await upsertRows(orders);

    return new Response(JSON.stringify({ ok: true, mode: 'incremental', new: orders.length }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
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
