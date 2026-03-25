// ── Types ─────────────────────────────────────────────────────────────────────

export interface TNProduct {
  id: number;
  name: string;
  quantity: number;
  price: string;
  sku: string | null;
}

export interface TNOrder {
  id: number;
  number: number;
  status: 'open' | 'closed' | 'cancelled';
  payment_status: 'pending' | 'authorized' | 'paid' | 'voided' | 'refunded' | 'unpaid' | 'partially_paid';
  total: string;
  subtotal: string;
  total_shipping: string;
  discount: string;
  created_at: string; // ISO 8601
  customer: { id: number; name: string; email: string } | null;
  products: TNProduct[];
  payment_details: { method: string; credit_card_company?: string } | null;
}

export interface TNMetrics {
  orders: TNOrder[];
  totalFacturado: number;
  ventasHoy: number;
  ventasSemana: number;
  ventasMes: number;
  totalOrdenes: number;
  ordenesPagadas: number;
  ordenesPendientes: number;
  ordenesCanceladas: number;
  ticketPromedio: number;
  topProductos: { nombre: string; cantidad: number; total: number }[];
  metodosPago:  { name: string; value: number; porcentaje: number }[];
  ventasPorDia: { name: string; value: number }[];
  ultimaOrden: TNOrder | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Buenos Aires = UTC-3, sin DST */
function getARBoundaries() {
  const AR_OFFSET = -3 * 60 * 60 * 1000;
  const nowMS     = Date.now();
  const nowAR     = nowMS + AR_OFFSET;
  const msPerDay  = 86_400_000;

  const todayStartMS  = Math.floor(nowAR / msPerDay) * msPerDay - AR_OFFSET;
  const arDow         = new Date(nowAR).getUTCDay();
  const daysSinceMon  = arDow === 0 ? 6 : arDow - 1;
  const weekStartMS   = todayStartMS - daysSinceMon * msPerDay;
  const arDayOfMonth  = new Date(nowAR).getUTCDate();
  const monthStartMS  = todayStartMS - (arDayOfMonth - 1) * msPerDay;

  return { todayStartMS, weekStartMS, monthStartMS };
}

function parseAmount(s: string | null | undefined): number {
  return parseFloat(s ?? '0') || 0;
}

function dayLabel(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}

export function humanizePaymentMethod(method: string, brand?: string): string {
  const map: Record<string, string> = {
    credit_card:    brand ? `Crédito ${brand}` : 'Tarjeta crédito',
    debit_card:     'Tarjeta débito',
    mercado_pago:   'Mercado Pago',
    paypal:         'PayPal',
    bank_transfer:  'Transferencia',
    cash:           'Efectivo',
    boleto:         'Boleto',
    account_money:  'Dinero en cuenta',
    pix:            'PIX',
  };
  return map[method] ?? method;
}

export function paymentStatusLabel(s: TNOrder['payment_status']): string {
  const map: Record<string, string> = {
    paid:            'Pagado',
    authorized:      'Autorizado',
    pending:         'Pendiente',
    unpaid:          'Sin pagar',
    partially_paid:  'Pago parcial',
    refunded:        'Reembolsado',
    voided:          'Anulado',
  };
  return map[s] ?? s;
}

export function paymentStatusClass(s: TNOrder['payment_status']): string {
  if (s === 'paid' || s === 'authorized')  return 'badge-green';
  if (s === 'pending' || s === 'unpaid')   return 'badge-amber';
  if (s === 'partially_paid')              return 'badge-indigo';
  return 'badge-muted';
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

const TN_BASE = 'https://api.tiendanube.com/v1';
const TN_HEADERS = (token: string) => ({
  Authentication: `bearer ${token}`,
  'User-Agent': 'NovaDashboard (contact@fromnorthgb.com)',
  'Content-Type': 'application/json',
});

async function handleTNResponse(res: Response): Promise<{ orders: TNOrder[]; hasMore: boolean }> {
  if (!res.ok) {
    let detail = '';
    try { detail = JSON.stringify(await res.json()); } catch { /* ignore */ }
    if (res.status === 401) throw new Error(`TOKEN_INVALID: ${detail}`);
    if (res.status === 404) throw new Error(`STORE_INVALID: ${detail}`);
    throw new Error(`API_ERROR_${res.status}: ${detail}`);
  }
  const orders: TNOrder[] = await res.json();
  const hasMore = (res.headers.get('Link') ?? '').includes('rel="next"');
  return { orders, hasMore };
}

async function fetchPage(
  storeId: string,
  token: string,
  page: number,
  createdAtMin: string,
): Promise<{ orders: TNOrder[]; hasMore: boolean }> {
  const qs = new URLSearchParams({
    per_page: '200',
    page: String(page),
    created_at_min: createdAtMin,
  }).toString();

  // Intentar llamada directa primero (TiendaNube soporta CORS)
  try {
    const res = await fetch(`${TN_BASE}/${storeId}/orders?${qs}`, {
      headers: TN_HEADERS(token),
    });
    return await handleTNResponse(res);
  } catch (err: any) {
    // Si fue un error de API (no CORS) lo relanzamos directo
    if (err.message?.startsWith('TOKEN_INVALID') ||
        err.message?.startsWith('STORE_INVALID') ||
        err.message?.startsWith('API_ERROR')) {
      throw err;
    }
    // Si fue CORS o network error, usar proxy Vercel
  }

  const proxyParams = new URLSearchParams({
    storeId,
    token,
    path: 'orders',
    per_page: '200',
    page: String(page),
    created_at_min: createdAtMin,
  });
  const proxyRes = await fetch(`/api/tiendanube?${proxyParams}`);
  return await handleTNResponse(proxyRes);
}

// ── Main export ───────────────────────────────────────────────────────────────

const MAX_PAGES = 5; // 1 000 órdenes máximo
const DAYS_BACK = 90;

export async function fetchTNMetrics(
  storeId: string,
  token: string,
  onProgress?: (loaded: number) => void,
): Promise<TNMetrics> {
  const since = new Date(Date.now() - DAYS_BACK * 86_400_000).toISOString();
  const allOrders: TNOrder[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const { orders, hasMore } = await fetchPage(storeId, token, page, since);
    allOrders.push(...orders);
    onProgress?.(allOrders.length);
    if (!hasMore) break;
  }

  // ── Compute ──────────────────────────────────────────────────────────────
  const { todayStartMS, weekStartMS, monthStartMS } = getARBoundaries();

  let totalFacturado   = 0;
  let ventasHoy        = 0;
  let ventasSemana     = 0;
  let ventasMes        = 0;
  let ordenesPagadas   = 0;
  let ordenesPendientes = 0;
  let ordenesCanceladas = 0;

  const productoMap: Record<string, { nombre: string; cantidad: number; total: number }> = {};
  const metodoMap:   Record<string, number> = {};
  const diaMap:      Record<string, number> = {};

  for (const order of allOrders) {
    const ts    = new Date(order.created_at).getTime();
    const total = parseAmount(order.total);

    // Status buckets
    if (order.status === 'cancelled') {
      ordenesCanceladas++;
      continue; // no contar canceladas en facturación
    }
    const isPaid = order.payment_status === 'paid' || order.payment_status === 'authorized';
    if (isPaid) ordenesPagadas++;
    else        ordenesPendientes++;

    if (!isPaid) continue; // solo pagadas cuentan en ingresos

    totalFacturado += total;
    if (ts >= todayStartMS) ventasHoy     += total;
    if (ts >= weekStartMS)  ventasSemana  += total;
    if (ts >= monthStartMS) ventasMes     += total;

    // Ventas por día
    const dl = dayLabel(order.created_at);
    diaMap[dl] = (diaMap[dl] ?? 0) + total;

    // Método de pago
    const method = humanizePaymentMethod(
      order.payment_details?.method ?? 'other',
      order.payment_details?.credit_card_company,
    );
    metodoMap[method] = (metodoMap[method] ?? 0) + 1;

    // Top productos
    for (const p of order.products) {
      if (!productoMap[p.name])
        productoMap[p.name] = { nombre: p.name, cantidad: 0, total: 0 };
      productoMap[p.name].cantidad += p.quantity;
      productoMap[p.name].total   += parseAmount(p.price) * p.quantity;
    }
  }

  const ticketPromedio = ordenesPagadas > 0 ? totalFacturado / ordenesPagadas : 0;

  const topProductos = Object.values(productoMap)
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, 10);

  const totalMetodos = Object.values(metodoMap).reduce((s, v) => s + v, 0);
  const metodosPago = Object.entries(metodoMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({
      name,
      value,
      porcentaje: totalMetodos > 0 ? Math.round((value / totalMetodos) * 100) : 0,
    }));

  // Días en orden cronológico (las órdenes vienen desc de la API, invertimos el mapa)
  const ventasPorDia = Object.entries(diaMap)
    .map(([name, value]) => ({ name, value }))
    .reverse();

  return {
    orders:           allOrders,
    totalFacturado,
    ventasHoy,
    ventasSemana,
    ventasMes,
    totalOrdenes:     allOrders.length,
    ordenesPagadas,
    ordenesPendientes,
    ordenesCanceladas,
    ticketPromedio,
    topProductos,
    metodosPago,
    ventasPorDia,
    ultimaOrden:      allOrders[0] ?? null,
  };
}
