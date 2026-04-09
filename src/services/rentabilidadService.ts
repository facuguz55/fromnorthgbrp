import { fetchMetaInsightsByDateRange } from './metaAdsService';
import { getSettings, META_ACCOUNTS } from './dataService';

// ── Constantes de negocio ───────────────────────────────────────────────

export const PRECIO_PROMO_A       = 69_000;
export const PRECIO_PROMO_B       = 99_000;
const PANTALONES_PROMO_A          = 2;
const PANTALONES_PROMO_B          = 3;
const COSTO_UNIDAD_PROMO_A        = 16_800;
const COSTO_UNIDAD_PROMO_B        = 18_471;
const COSTO_ENVIO_POR_PROMO       = 9_000;
const COSTO_AGENCIA_POR_PROMO     = 2_000;
export const TICKET_PROMEDIO_REF  = 84_000;

const COSTO_MERCH_PROMO_A = PANTALONES_PROMO_A * COSTO_UNIDAD_PROMO_A; // 33600
const COSTO_MERCH_PROMO_B = PANTALONES_PROMO_B * COSTO_UNIDAD_PROMO_B; // 55413

// ── Types ─────────────────────────────────────────────────────────

export interface DiaRentabilidad {
  fecha: string;
  fechaISO: string;
  promoA: number;
  promoB: number;
  totalPromos: number;
  facturado: number;
  costoMercaderia: number;
  costoEnvio: number;
  costoAgencia: number;
  inversionMetaARS: number;
  inversionMetaUSD: number;
  totalCostos: number;
  gananciaNeta: number;
  margenPct: number;
  cpa: number;
  roas: number;
  metodoPago: {
    mercadoPago: number;
    pagoNube: number;
    otros: number;
  };
}

export interface ResumenRentabilidad {
  facturadoTotal: number;
  costoMercaderiaTotal: number;
  costoEnvioTotal: number;
  costoAgenciaTotal: number;
  inversionMetaARSTotal: number;
  inversionMetaUSDTotal: number;
  totalCostosTotal: number;
  gananciaNeta: number;
  margenPct: number;
  promoATotal: number;
  promoBTotal: number;
  totalPromos: number;
  cpaPromedio: number;
  roasPromedio: number;
  ticketPromedioRef: number;
}

// ── Helpers ─────────────────────────────────────────────────────────

const AR_OFFSET = -3 * 60 * 60 * 1000;

export function toARDateISO(ms: number): string {
  const arMs = ms + AR_OFFSET;
  const d = new Date(arMs);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function toARDateLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

export function todayARISO(): string {
  return toARDateISO(Date.now());
}

function getWeekRange(refISO: string): { since: string; until: string } {
  const [y, m, d] = refISO.split('-').map(Number);
  const ref = new Date(Date.UTC(y, m - 1, d));
  const dow = ref.getUTCDay();
  const daysSinceMon = dow === 0 ? 6 : dow - 1;
  const monMs = ref.getTime() - daysSinceMon * 86_400_000;
  const sunMs = monMs + 6 * 86_400_000;
  return {
    since: toARDateISO(monMs - AR_OFFSET),
    until: toARDateISO(sunMs - AR_OFFSET),
  };
}

function getMonthRange(refISO: string): { since: string; until: string } {
  const [y, m] = refISO.split('-').map(Number);
  const since = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const until = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { since, until };
}

import type { TNOrder, TNProduct } from './tiendanubeService';

function detectPromo(products: TNProduct[]): 'A' | 'B' | null {
  for (const p of products) {
    const name = p.name.toUpperCase();
    if (name.includes('2 BAGGY')) return 'A';
    if (name.includes('3 BAGGY')) return 'B';
  }
  return null;
}

function detectMetodoPago(method: string | undefined): 'mercadoPago' | 'pagoNube' | 'otros' {
  if (!method) return 'otros';
  const m = method.toLowerCase();
  if (m === 'mercado_pago' || m === 'account_money') return 'mercadoPago';
  if (m.includes('nube')) return 'pagoNube';
  return 'otros';
}

function daysInRange(since: string, until: string): string[] {
  const [sy, sm, sd] = since.split('-').map(Number);
  const [uy, um, ud] = until.split('-').map(Number);
  const start = Date.UTC(sy, sm - 1, sd);
  const end   = Date.UTC(uy, um - 1, ud);
  const days: string[] = [];
  for (let ms = start; ms <= end; ms += 86_400_000) {
    days.push(toARDateISO(ms - AR_OFFSET));
  }
  return days;
}

// ── USDT price ──────────────────────────────────────────────────────

const USDT_CACHE_KEY = 'usdt_price_cache';

export async function fetchUSDTPrice(): Promise<{ price: number; error: boolean }> {
  try {
    const res = await fetch('/api/usdt-price');
    const json = await res.json() as { price: number; error?: string };
    if (json.price > 0) {
      localStorage.setItem(USDT_CACHE_KEY, String(json.price));
      return { price: json.price, error: false };
    }
    throw new Error('zero_price');
  } catch {
    const cached = parseFloat(localStorage.getItem(USDT_CACHE_KEY) ?? '0');
    return { price: cached, error: true };
  }
}

// ── Meta Ads aggregation ────────────────────────────────────────────
//
// Cada cuenta tiene su moneda definida en META_ACCOUNTS.currency:
//   'ARS' → el spend que reporta Meta ya está en ARS, se usa directo
//   'USD' → el spend está en USD, se convierte a ARS multiplicando por usdtPrice
//
// El resultado spendByDay[fecha] está siempre en ARS.

async function fetchMetaSpendByDay(
  since: string,
  until: string,
  usdtPrice: number,
): Promise<Record<string, number>> {
  const settings = getSettings();
  const token    = settings.metaAccessToken.trim();
  if (!token) return {};

  const spendByDay: Record<string, number> = {};

  await Promise.all(
    META_ACCOUNTS.map(async acct => {
      const accountId = (settings[acct.settingsKey] as string).trim();
      if (!accountId) return;
      try {
        const insights = await fetchMetaInsightsByDateRange(token, accountId, since, until);
        for (const ins of insights) {
          const day = ins.date_start;
          if (!day) continue;
          const arsValue = acct.currency === 'USD'
            ? ins.spend * usdtPrice
            : ins.spend;
          spendByDay[day] = (spendByDay[day] ?? 0) + arsValue;
        }
      } catch { /* fallo silencioso por cuenta */ }
    }),
  );

  return spendByDay;
}

// ── Main computation ────────────────────────────────────────────────

function buildDia(
  fechaISO: string,
  orders: TNOrder[],
  metaARS: number,
  usdtPrice: number,
): DiaRentabilidad {
  let promoA = 0, promoB = 0;
  const mp = { mercadoPago: 0, pagoNube: 0, otros: 0 };

  for (const o of orders) {
    if (o.payment_status !== 'paid' && o.payment_status !== 'authorized') continue;
    const promo = detectPromo(o.products);
    if (!promo) continue;
    if (promo === 'A') promoA++;
    else promoB++;
    const canal = detectMetodoPago(o.payment_details?.method);
    mp[canal]++;
  }

  const totalPromos     = promoA + promoB;
  const facturado       = promoA * PRECIO_PROMO_A + promoB * PRECIO_PROMO_B;
  const costoMercaderia = promoA * COSTO_MERCH_PROMO_A + promoB * COSTO_MERCH_PROMO_B;
  const costoEnvio      = totalPromos * COSTO_ENVIO_POR_PROMO;
  const costoAgencia    = totalPromos * COSTO_AGENCIA_POR_PROMO;
  const inversionMetaARS = metaARS;
  const inversionMetaUSD = usdtPrice > 0 ? metaARS / usdtPrice : 0;
  const totalCostos     = costoMercaderia + costoEnvio + costoAgencia + inversionMetaARS;
  const gananciaNeta    = facturado - totalCostos;
  const margenPct       = facturado > 0 ? (gananciaNeta / facturado) * 100 : 0;
  const cpa             = totalPromos > 0 ? inversionMetaARS / totalPromos : 0;
  const roas            = inversionMetaARS > 0 ? facturado / inversionMetaARS : 0;

  return {
    fecha: toARDateLabel(fechaISO),
    fechaISO,
    promoA,
    promoB,
    totalPromos,
    facturado,
    costoMercaderia,
    costoEnvio,
    costoAgencia,
    inversionMetaARS,
    inversionMetaUSD,
    totalCostos,
    gananciaNeta,
    margenPct,
    cpa,
    roas,
    metodoPago: mp,
  };
}

function buildResumen(dias: DiaRentabilidad[]): ResumenRentabilidad {
  const facturadoTotal        = dias.reduce((s, d) => s + d.facturado, 0);
  const costoMercaderiaTotal  = dias.reduce((s, d) => s + d.costoMercaderia, 0);
  const costoEnvioTotal       = dias.reduce((s, d) => s + d.costoEnvio, 0);
  const costoAgenciaTotal     = dias.reduce((s, d) => s + d.costoAgencia, 0);
  const inversionMetaARSTotal = dias.reduce((s, d) => s + d.inversionMetaARS, 0);
  const inversionMetaUSDTotal = dias.reduce((s, d) => s + d.inversionMetaUSD, 0);
  const totalCostosTotal      = dias.reduce((s, d) => s + d.totalCostos, 0);
  const gananciaNeta          = facturadoTotal - totalCostosTotal;
  const margenPct             = facturadoTotal > 0 ? (gananciaNeta / facturadoTotal) * 100 : 0;
  const promoATotal           = dias.reduce((s, d) => s + d.promoA, 0);
  const promoBTotal           = dias.reduce((s, d) => s + d.promoB, 0);
  const totalPromos           = promoATotal + promoBTotal;
  const cpaPromedio           = totalPromos > 0 ? inversionMetaARSTotal / totalPromos : 0;
  const roasPromedio          = inversionMetaARSTotal > 0 ? facturadoTotal / inversionMetaARSTotal : 0;

  return {
    facturadoTotal,
    costoMercaderiaTotal,
    costoEnvioTotal,
    costoAgenciaTotal,
    inversionMetaARSTotal,
    inversionMetaUSDTotal,
    totalCostosTotal,
    gananciaNeta,
    margenPct,
    promoATotal,
    promoBTotal,
    totalPromos,
    cpaPromedio,
    roasPromedio,
    ticketPromedioRef: TICKET_PROMEDIO_REF,
  };
}

// ── Exported fetch functions ────────────────────────────────────────────

function filterOrdersByDay(orders: TNOrder[], fechaISO: string): TNOrder[] {
  const [y, m, d] = fechaISO.split('-').map(Number);
  const dayStartUTC = Date.UTC(y, m - 1, d) - AR_OFFSET;
  const dayEndUTC   = dayStartUTC + 86_400_000;
  return orders.filter(o => {
    const ts = new Date(o.created_at).getTime();
    return ts >= dayStartUTC && ts < dayEndUTC;
  });
}

export async function fetchRentabilidadRange(
  orders: TNOrder[],
  since: string,
  until: string,
  usdtPrice: number,
): Promise<{ dias: DiaRentabilidad[]; resumen: ResumenRentabilidad; metaError: boolean }> {
  let metaSpendByDay: Record<string, number> = {};
  let metaError = false;

  try {
    metaSpendByDay = await fetchMetaSpendByDay(since, until, usdtPrice);
  } catch {
    metaError = true;
  }

  const allDays = daysInRange(since, until);
  const dias = allDays.map(fechaISO => {
    const dayOrders = filterOrdersByDay(orders, fechaISO);
    const metaARS   = metaSpendByDay[fechaISO] ?? 0;
    return buildDia(fechaISO, dayOrders, metaARS, usdtPrice);
  });

  return { dias, resumen: buildResumen(dias), metaError };
}

export function getRangeForPeriodo(
  periodo: 'diario' | 'semanal' | 'mensual',
  fecha: string,
): { since: string; until: string } {
  if (periodo === 'diario')   return { since: fecha, until: fecha };
  if (periodo === 'semanal')  return getWeekRange(fecha);
  return getMonthRange(fecha);
}
