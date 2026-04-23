// ── Types ─────────────────────────────────────────────────────────────────────

export interface TNProduct {
  id: number;
  name: string;
  quantity: number;
  price: string;
  sku: string | null;
}

export interface TNOrderCoupon {
  id: number;
  code: string;
  type: 'percentage' | 'absolute' | 'shipping';
  value: string | number;
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
  created_at: string;
  customer: { id: number; name: string; email: string } | null;
  products: TNProduct[];
  payment_details: { method: string; credit_card_company?: string; installments?: number | null } | null;
  coupon: TNOrderCoupon[] | null;
}

export interface TopProducto {
  nombre: string;
  cantidad: number;
  total: number;
}

export interface MejorComprador {
  nombre: string;
  email: string;
  total: number;
  pedidos: number;
}

export interface StockItem {
  nombre: string;
  sku: string;
  stock: number;
  precio: number;
  fechaActualizacion: string;
}

export interface StockItemWithIds extends StockItem {
  productId: number;
  variantId: number;
}

export interface TNCustomer {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  total_spent: string;
  orders_count: number;
  created_at: string;
  last_order_id: number | null;
}

export interface TNCategory {
  id: number;
  name: { es?: string; en?: string; [k: string]: string | undefined };
  parent: { id: number } | null;
  subcategories: { id: number }[];
  handle: { es?: string; [k: string]: string | undefined };
  created_at: string;
}

export interface TNMetrics {
  orders: TNOrder[];
  // Revenue
  totalFacturado: number;
  gananciaTotal: number;    // alias de totalFacturado para compatibilidad
  ventasHoy: number;
  ventasSemana: number;
  ventasMes: number;
  // Orders
  totalOrdenes: number;
  ordenesPagadas: number;
  ordenesPendientes: number;
  ordenesCanceladas: number;
  ticketPromedio: number;
  // Products
  topProductos: TopProducto[];
  todosProductos: TopProducto[];
  metodosPago: { name: string; value: number; porcentaje: number }[];
  ventasPorDia: { name: string; value: number }[];
  ventasPorHora: { name: string; value: number }[];
  // Customers
  topCompradores: MejorComprador[];
  clientesNuevos: number;
  clientesRecurrentes: number;
  // Alerts
  productosHoy: Record<string, number>;
  ordenesHoy: number[];
  diasConDatos: number;
  // Latest
  ultimaOrden: TNOrder | null;
  ultimaVenta: { monto: number; producto: string; hora: string; cliente: string; fecha: string } | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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
    day: '2-digit', month: '2-digit', year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}

export function humanizePaymentMethod(method: string, brand?: string): string {
  const map: Record<string, string> = {
    credit_card:   brand ? `Crédito ${brand}` : 'Tarjeta crédito',
    debit_card:    'Tarjeta débito',
    mercado_pago:  'Mercado Pago',
    paypal:        'PayPal',
    bank_transfer: 'Transferencia',
    cash:          'Efectivo',
    boleto:        'Boleto',
    account_money: 'Dinero en cuenta',
    pix:           'PIX',
  };
  return map[method] ?? method;
}

export function paymentStatusLabel(s: TNOrder['payment_status']): string {
  const map: Record<string, string> = {
    paid:           'Pagado',
    authorized:     'Autorizado',
    pending:        'Pendiente',
    unpaid:         'Sin pagar',
    partially_paid: 'Pago parcial',
    refunded:       'Reembolsado',
    voided:         'Anulado',
  };
  return map[s] ?? s;
}

export function paymentStatusClass(s: TNOrder['payment_status']): string {
  if (s === 'paid' || s === 'authorized')  return 'badge-green';
  if (s === 'pending' || s === 'unpaid')   return 'badge-amber';
  if (s === 'partially_paid')              return 'badge-indigo';
  return 'badge-muted';
}

// ── Cache (memoria + localStorage) ───────────────────────────────────────────

const CACHE_KEY = 'tn_metrics_cache';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutos — datos frescos

let metricsCache: { data: TNMetrics; ts: number } | null = null;

/** Lee el cache persistido en localStorage al iniciar */
function todayLabelAR(): string {
  return new Date().toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}

function loadPersistedCache(): { data: TNMetrics; ts: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: TNMetrics; ts: number };
    if (!parsed?.data || !parsed?.ts) return null;
    // Invalidar cache viejo donde las fechas no tienen año (formato DD/MM sin año)
    const sample = parsed.data.ventasPorDia?.[0]?.name ?? '';
    if (sample && sample.split('/').length < 3) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    // Invalidar si el cache es de un día anterior (hora Argentina)
    const cacheDay = new Date(parsed.ts).toLocaleDateString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      timeZone: 'America/Argentina/Buenos_Aires',
    });
    if (cacheDay !== todayLabelAR()) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function persistCache(entry: { data: TNMetrics; ts: number }) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // localStorage lleno o bloqueado — ignorar
  }
}

export function clearTNCache() {
  metricsCache = null;
  try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
}

// ── Supabase orders cache ─────────────────────────────────────────────────────

const SB_URL = 'https://tnmmbfcbviowhunnrzix.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRubW1iZmNidmlvd2h1bm5yeml4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMTc4MzcsImV4cCI6MjA4OTc5MzgzN30.ZZD8evIrlfY_77-DEh47L-JJxFOxhH8L9xZ_NjHN6QU';

async function fetchSupabaseOrders(): Promise<TNOrder[] | null> {
  try {
    // Leer órdenes desde tn_orders_cache (fila "main" con el JSON de todas las órdenes)
    const res = await fetch(
      `${SB_URL}/rest/v1/tn_orders_cache?select=orders&id=eq.main&limit=1`,
      { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
    );
    if (!res.ok) return null;
    const rows = await res.json() as any[];
    if (!rows?.length || !rows[0]?.orders) return null;
    const orders = typeof rows[0].orders === 'string' ? JSON.parse(rows[0].orders) : rows[0].orders;
    return Array.isArray(orders) ? orders as TNOrder[] : null;
  } catch {
    return null;
  }
}

function saveOrdersToSupabase(orders: TNOrder[]): Promise<void> {
  return fetch(`${SB_URL}/rest/v1/tn_orders_cache`, {
    method: 'POST',
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify([{ id: 'main', orders: JSON.stringify(orders) }]),
  }).then(() => {});
}

/**
 * Devuelve datos persistidos de localStorage aunque estén viejos.
 * Útil para mostrar datos instantáneamente al cargar la página.
 */
export function getPersistedMetrics(): TNMetrics | null {
  if (metricsCache) return metricsCache.data;
  const persisted = loadPersistedCache();
  return persisted?.data ?? null;
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────

const TN_BASE = 'https://api.tiendanube.com/v1';

function tnHeaders(token: string): HeadersInit {
  return {
    Authentication: `bearer ${token}`,
    'User-Agent': 'NovaDashboard (contact@fromnorthgb.com)',
  };
}

async function handleTNResponse(res: Response): Promise<{ data: any; hasMore: boolean }> {
  if (!res.ok) {
    let detail = '';
    try { detail = JSON.stringify(await res.json()); } catch { /* ignore */ }
    if (res.status === 401) throw new Error(`TOKEN_INVALID: ${detail}`);
    if (res.status === 404) throw new Error(`STORE_INVALID: ${detail}`);
    throw new Error(`API_ERROR_${res.status}: ${detail}`);
  }
  const data = await res.json();
  const hasMore = (res.headers.get('Link') ?? '').includes('rel="next"');
  return { data, hasMore };
}

async function tnFetch(
  storeId: string,
  token: string,
  path: string,
  params: Record<string, string>,
): Promise<{ data: any; hasMore: boolean }> {
  const qs = new URLSearchParams(params).toString();

  // Intentar directo primero (TiendaNube soporta CORS)
  try {
    const res = await fetch(`${TN_BASE}/${storeId}/${path}?${qs}`, { headers: tnHeaders(token) });
    return await handleTNResponse(res);
  } catch (err: any) {
    if (err.message?.startsWith('TOKEN_INVALID') ||
        err.message?.startsWith('STORE_INVALID') ||
        err.message?.startsWith('API_ERROR')) throw err;
    // CORS o network error → usar proxy Vercel
  }

  const proxyParams = new URLSearchParams({ storeId, token, path, ...params });
  const proxyRes = await fetch(`/api/tiendanube?${proxyParams}`);
  return await handleTNResponse(proxyRes);
}

// ── Orders fetch ──────────────────────────────────────────────────────────────

const MAX_PAGES = 5;
const DAYS_BACK = 90;

const ALL_ORDERS_CACHE_KEY = 'tn_all_orders_cache';
const ALL_ORDERS_TTL = 30 * 60 * 1000;

export async function fetchAllTNOrders(
  storeId: string,
  token: string,
  onProgress?: (n: number) => void,
  forceRefresh = false,
): Promise<TNOrder[]> {
  if (!forceRefresh) {
    try {
      const raw = localStorage.getItem(ALL_ORDERS_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { data: TNOrder[]; ts: number };
        if (Date.now() - parsed.ts < ALL_ORDERS_TTL && Array.isArray(parsed.data)) {
          return parsed.data;
        }
      }
    } catch {}
  }

  const all: TNOrder[] = [];
  for (let page = 1; page <= 25; page++) {
    const { data, hasMore } = await tnFetch(storeId, token, 'orders', {
      per_page: '200',
      page: String(page),
    });
    all.push(...(data as TNOrder[]));
    onProgress?.(all.length);
    if (!hasMore) break;
  }

  try {
    localStorage.setItem(ALL_ORDERS_CACHE_KEY, JSON.stringify({ data: all, ts: Date.now() }));
  } catch {}

  return all;
}

async function fetchOrdersAll(
  storeId: string,
  token: string,
  onProgress?: (n: number) => void,
): Promise<TNOrder[]> {
  const all: TNOrder[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, hasMore } = await tnFetch(storeId, token, 'orders', {
      per_page: '200',
      page: String(page),
      created_at_min: new Date(Date.now() - DAYS_BACK * 86_400_000).toISOString(),
    });
    all.push(...(data as TNOrder[]));
    onProgress?.(all.length);
    if (!hasMore) break;
  }
  return all;
}

// ── Products fetch ────────────────────────────────────────────────────────────

interface TNRawProduct {
  id: number;
  name: Record<string, string>;
  variants: {
    id: number;
    sku: string | null;
    price: string;
    stock: number | null;
    values: { es?: string; en?: string; pt?: string; [k: string]: string | undefined }[];
    updated_at: string;
  }[];
  updated_at: string;
}

export async function fetchTNProducts(storeId: string, token: string): Promise<StockItem[]> {
  const allProducts: TNRawProduct[] = [];

  for (let page = 1; page <= 10; page++) {
    const { data, hasMore } = await tnFetch(storeId, token, 'products', {
      per_page: '200',
      page: String(page),
    });
    allProducts.push(...(data as TNRawProduct[]));
    if (!hasMore) break;
  }

  const items: StockItem[] = [];

  for (const prod of allProducts) {
    const baseName = prod.name.es ?? prod.name.en ?? Object.values(prod.name)[0] ?? String(prod.id);

    for (const v of prod.variants) {
      const variantLabel = v.values
        .map(val => val.es ?? val.en ?? Object.values(val).find(x => x) ?? '')
        .filter(Boolean)
        .join(' / ');

      const nombre = variantLabel ? `${baseName} — ${variantLabel}` : baseName;
      const sku    = v.sku ?? `${prod.id}-${v.id}`;

      items.push({
        nombre,
        sku,
        stock:  v.stock ?? 0,
        precio: parseAmount(v.price),
        fechaActualizacion: v.updated_at
          ? new Date(v.updated_at).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })
          : '',
      });
    }
  }

  return items;
}

export async function fetchTNProductsForManagement(storeId: string, token: string): Promise<StockItemWithIds[]> {
  const allProducts: TNRawProduct[] = [];

  for (let page = 1; page <= 10; page++) {
    const { data, hasMore } = await tnFetch(storeId, token, 'products', {
      per_page: '200',
      page: String(page),
    });
    allProducts.push(...(data as TNRawProduct[]));
    if (!hasMore) break;
  }

  const items: StockItemWithIds[] = [];

  for (const prod of allProducts) {
    const baseName = prod.name.es ?? prod.name.en ?? Object.values(prod.name)[0] ?? String(prod.id);

    for (const v of prod.variants) {
      const variantLabel = v.values
        .map(val => val.es ?? val.en ?? Object.values(val).find(x => x) ?? '')
        .filter(Boolean)
        .join(' / ');

      const nombre = variantLabel ? `${baseName} — ${variantLabel}` : baseName;
      const sku    = v.sku ?? `${prod.id}-${v.id}`;

      items.push({
        nombre,
        sku,
        stock:  v.stock ?? 0,
        precio: parseAmount(v.price),
        fechaActualizacion: v.updated_at
          ? new Date(v.updated_at).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })
          : '',
        productId: prod.id,
        variantId: v.id,
      });
    }
  }

  return items;
}

export async function fetchTNCustomers(storeId: string, token: string): Promise<TNCustomer[]> {
  const all: TNCustomer[] = [];

  for (let page = 1; page <= 10; page++) {
    const { data, hasMore } = await tnFetch(storeId, token, 'customers', {
      per_page: '200',
      page: String(page),
    });
    all.push(...(data as TNCustomer[]));
    if (!hasMore) break;
  }

  return all.sort((a, b) => parseFloat(b.total_spent) - parseFloat(a.total_spent));
}

export async function fetchTNCustomerOrders(
  storeId: string,
  token: string,
  customerId: number,
): Promise<TNOrder[]> {
  const all: TNOrder[] = [];
  for (let page = 1; page <= 5; page++) {
    const { data, hasMore } = await tnFetch(storeId, token, 'orders', {
      customer_id: String(customerId),
      per_page: '50',
      page: String(page),
    });
    all.push(...(data as TNOrder[]));
    if (!hasMore) break;
  }
  return all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export interface FNCouponConversion {
  orderId: number;
  orderNumber: number;
  couponCode: string;
  total: number;
  subtotal: number;
  discount: number;
  products: string[];
  createdAt: string;
  customerName: string;
  customerEmail: string;
}

/** Obtiene todas las órdenes pagadas que usaron cupones que empiezan con "FN" */
export async function fetchFNCouponOrders(
  storeId: string,
  token: string,
): Promise<FNCouponConversion[]> {
  // Fast path: usar cache en memoria o Supabase antes de ir a TiendaNube
  let all: TNOrder[] =
    metricsCache?.data.orders ??
    (await fetchSupabaseOrders()) ??
    [];

  if (all.length === 0) {
    for (let page = 1; page <= 20; page++) {
      const { data, hasMore } = await tnFetch(storeId, token, 'orders', {
        payment_status: 'paid',
        per_page: '200',
        page: String(page),
      });
      all.push(...(data as TNOrder[]));
      if (!hasMore) break;
    }
  }

  const result: FNCouponConversion[] = [];

  for (const order of all) {
    if (order.payment_status !== 'paid' && order.payment_status !== 'authorized') continue;
    if (!order.coupon || order.coupon.length === 0) continue;
    const fnCoupon = order.coupon.find(c => c.code.toUpperCase().startsWith('FN'));
    if (!fnCoupon) continue;
    result.push({
      orderId:       order.id,
      orderNumber:   order.number,
      couponCode:    fnCoupon.code,
      total:         parseFloat(order.total),
      subtotal:      parseFloat(order.subtotal),
      discount:      parseFloat(order.discount),
      products:      order.products.map(p => p.name),
      createdAt:     order.created_at,
      customerName:  order.customer?.name  ?? '—',
      customerEmail: order.customer?.email ?? '—',
    });
  }

  return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function fetchTNCategories(storeId: string, token: string): Promise<TNCategory[]> {
  const { data } = await tnFetch(storeId, token, 'categories', { per_page: '200' });
  return data as TNCategory[];
}

export async function updateTNCategory(
  storeId: string,
  token: string,
  categoryId: number,
  data: { name: Record<string, string> },
): Promise<void> {
  const TN_BASE_URL = 'https://api.tiendanube.com/v1';
  const headers: Record<string, string> = {
    Authentication: `bearer ${token}`,
    'User-Agent': 'NovaDashboard (contact@fromnorthgb.com)',
    'Content-Type': 'application/json',
  };

  let res: Response;
  try {
    res = await fetch(`${TN_BASE_URL}/${storeId}/categories/${categoryId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });
  } catch {
    const qs = new URLSearchParams({ storeId, token, path: `categories/${categoryId}` });
    res = await fetch(`/api/tiendanube?${qs}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function updateTNProductVariant(
  storeId: string,
  token: string,
  productId: number,
  variantId: number,
  data: { price?: string; stock?: number },
): Promise<void> {
  const TN_BASE_URL = 'https://api.tiendanube.com/v1';
  const headers: Record<string, string> = {
    Authentication: `bearer ${token}`,
    'User-Agent': 'NovaDashboard (contact@fromnorthgb.com)',
    'Content-Type': 'application/json',
  };

  let res: Response;
  try {
    res = await fetch(`${TN_BASE_URL}/${storeId}/products/${productId}/variants/${variantId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });
  } catch {
    const qs = new URLSearchParams({ storeId, token, path: `products/${productId}/variants/${variantId}` });
    res = await fetch(`/api/tiendanube?${qs}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

// ── Metrics computation ───────────────────────────────────────────────────────

export async function fetchTNMetrics(
  storeId: string,
  token: string,
  onProgress?: (loaded: number) => void,
  forceRefresh = false,
): Promise<TNMetrics> {
  // Usar cache en memoria si está fresco
  if (!forceRefresh && metricsCache && Date.now() - metricsCache.ts < CACHE_TTL) {
    return metricsCache.data;
  }
  // Usar localStorage si está fresco (sobrevive al refresh)
  if (!forceRefresh && !metricsCache) {
    const persisted = loadPersistedCache();
    if (persisted && Date.now() - persisted.ts < CACHE_TTL) {
      metricsCache = persisted;
      return persisted.data;
    }
  }

  const sbOrders = forceRefresh ? null : await fetchSupabaseOrders();
  const allOrders = sbOrders ?? await fetchOrdersAll(storeId, token, onProgress);
  if (!sbOrders) saveOrdersToSupabase(allOrders).catch(() => {});

  const { todayStartMS, weekStartMS, monthStartMS } = getARBoundaries();

  let totalFacturado    = 0;
  let ventasHoy         = 0;
  let ventasSemana      = 0;
  let ventasMes         = 0;
  let ordenesPagadas    = 0;
  let ordenesPendientes = 0;
  let ordenesCanceladas = 0;

  const productoMap:  Record<string, TopProducto>     = {};
  const compradorMap: Record<string, MejorComprador>  = {};
  const metodoMap:    Record<string, number>          = {};
  const diaMap:       Record<string, number>          = {};
  const horaMap:      Record<number, number>          = {};
  const productosHoyMap: Record<string, number>       = {};
  const ordenesHoyList:  number[]                     = [];

  let ultimaVentaTs = -1;
  let ultimaVenta: TNMetrics['ultimaVenta'] = null;

  for (const order of allOrders) {
    const ts    = new Date(order.created_at).getTime();
    const total = parseAmount(order.total);

    if (order.status === 'cancelled') { ordenesCanceladas++; continue; }

    const isPaid = order.payment_status === 'paid' || order.payment_status === 'authorized';
    if (isPaid) ordenesPagadas++;
    else { ordenesPendientes++; continue; }

    totalFacturado += total;
    if (ts >= todayStartMS) { ventasHoy += total; ordenesHoyList.push(total); }
    if (ts >= weekStartMS)  ventasSemana += total;
    if (ts >= monthStartMS) ventasMes    += total;

    // Día
    const dl = dayLabel(order.created_at);
    diaMap[dl] = (diaMap[dl] ?? 0) + total;

    // Hora (AR timezone)
    const horaAR = new Date(new Date(order.created_at).toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' })).getHours();
    horaMap[horaAR] = (horaMap[horaAR] ?? 0) + 1;

    // Método
    const method = humanizePaymentMethod(
      order.payment_details?.method ?? 'other',
      order.payment_details?.credit_card_company,
    );
    metodoMap[method] = (metodoMap[method] ?? 0) + 1;

    // Productos
    for (const p of order.products) {
      if (!productoMap[p.name]) productoMap[p.name] = { nombre: p.name, cantidad: 0, total: 0 };
      productoMap[p.name].cantidad += p.quantity;
      productoMap[p.name].total   += parseAmount(p.price) * p.quantity;
      if (ts >= todayStartMS) {
        productosHoyMap[p.name] = (productosHoyMap[p.name] ?? 0) + parseAmount(p.price) * p.quantity;
      }
    }

    // Compradores
    const email   = order.customer?.email   ?? '';
    const cliente = order.customer?.name    ?? '';
    const key = email || cliente;
    if (key) {
      if (!compradorMap[key]) compradorMap[key] = { nombre: cliente, email, total: 0, pedidos: 0 };
      compradorMap[key].total   += total;
      compradorMap[key].pedidos += 1;
    }

    // Última venta
    const timeStr = new Date(order.created_at)
      .toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' });
    if (ts > ultimaVentaTs) {
      ultimaVentaTs = ts;
      ultimaVenta = {
        monto:    total,
        producto: order.products[0]?.name ?? '',
        hora:     timeStr,
        cliente,
        fecha:    dayLabel(order.created_at),
      };
    }
  }

  const todosProductosSorted = Object.values(productoMap).sort((a, b) => b.cantidad - a.cantidad);
  const topProductos = todosProductosSorted.slice(0, 6);

  const topCompradores = Object.values(compradorMap)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  let clientesNuevos = 0, clientesRecurrentes = 0;
  for (const c of Object.values(compradorMap)) {
    if (c.pedidos === 1) clientesNuevos++; else clientesRecurrentes++;
  }

  const totalMetodos = Object.values(metodoMap).reduce((s, v) => s + v, 0);
  const metodosPago = Object.entries(metodoMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({
      name, value,
      porcentaje: totalMetodos > 0 ? Math.round((value / totalMetodos) * 100) : 0,
    }));

  const ventasPorDia = Object.entries(diaMap)
    .map(([name, value]) => ({ name, value }))
    .reverse();

  const ventasPorHora = Array.from({ length: 24 }, (_, h) => ({
    name: `${String(h).padStart(2, '0')}:00`,
    value: horaMap[h] ?? 0,
  }));

  const diasConDatos = Object.keys(diaMap).length;
  const ticketPromedio = ordenesPagadas > 0 ? totalFacturado / ordenesPagadas : 0;

  const metrics: TNMetrics = {
    orders: allOrders,
    totalFacturado,
    gananciaTotal: totalFacturado,
    ventasHoy,
    ventasSemana,
    ventasMes,
    totalOrdenes: allOrders.length,
    ordenesPagadas,
    ordenesPendientes,
    ordenesCanceladas,
    ticketPromedio,
    topProductos,
    todosProductos: todosProductosSorted,
    metodosPago,
    ventasPorDia,
    ventasPorHora,
    topCompradores,
    clientesNuevos,
    clientesRecurrentes,
    productosHoy: productosHoyMap,
    ordenesHoy: ordenesHoyList,
    diasConDatos,
    ultimaOrden: allOrders[0] ?? null,
    ultimaVenta,
  };

  metricsCache = { data: metrics, ts: Date.now() };
  persistCache(metricsCache);
  return metrics;
}
