import type { TNMetrics, TopProducto } from './tiendanubeService';

export type AlertSeverity = 'warning' | 'spike' | 'trending' | 'big_order' | 'zero';

export interface AlertItem {
  id: string;
  severity: AlertSeverity;
  emoji: string;
  title: string;
  metrics: { label: string; value: string }[];
  badge: string;
  badgePositive: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Strips variant/size suffixes from product names so all variants of the
 * same product collapse to a single base name.
 *
 * Real examples from the store:
 *   "2 BAGGYS X $65.000 – PROMO LIMITADA (BAGGY 2 - 42 , BAGGY 5 / 42)"
 *       → "2 BAGGYS X $65.000 – PROMO LIMITADA"
 *   "3 BAGGYS X $90.000 – PROMO LIMITADA"
 *       → "3 BAGGYS X $90.000 – PROMO LIMITADA"  (no change)
 *   "BAGGY OXIDO (38)"         → "BAGGY OXIDO"
 *   "CHOMBA OVER CEST (S, NEGRO)" → "CHOMBA OVER CEST"
 *   "Baggy Negro - Talle M"    → "Baggy Negro"
 *   "Remera Blanca XL"         → "Remera Blanca"
 */
function normalizeProductName(name: string): string {
  return name
    // PRIMARY: strip trailing parenthetical variant selector "(BAGGY 2 - 42, ...)", "(38)", "(S, NEGRO)"
    .replace(/\s*\([^)]*\)\s*$/, '')
    // FALLBACK: "Talle(s) XL", "Talle M + Talle L", "Talle M/L" (with any separator before)
    .replace(/[\s\-–_/|,]+talles?\s+\w+(\s*[+y/]\s*(?:talles?\s+)?\w+)*/gi, '')
    // FALLBACK: standalone size code at end: "- S", "/ XL", " M", etc.
    .replace(/[\s\-–_/|]+(?:xxs|xs|s|m|l|xl|xxl|xxxl)$/gi, '')
    // FALLBACK: numeric size at end: "- 38", " 40"
    .replace(/[\s\-–_]+ \d{2}$/, '')
    // Clean up trailing separators (–, -, spaces)
    .replace(/[\-–_\s]+$/, '')
    .trim();
}

// ── Product grouping ──────────────────────────────────────────────────────────

interface ProductGroup {
  baseName: string;
  variantes: string[];         // raw variant names that belong to this group
  totalHistorico: number;      // sum of all variants' total across all time
  cantidadHistorica: number;
  totalHoy: number;            // sum of all variants' sales today
}

function buildProductGroups(
  todosProductos: TopProducto[],
  productosHoy: Record<string, number>,
): ProductGroup[] {
  const groups: Record<string, ProductGroup> = {};

  // Build groups from historical product list
  for (const prod of todosProductos) {
    const base = normalizeProductName(prod.nombre);
    if (!groups[base]) {
      groups[base] = {
        baseName: base,
        variantes: [],
        totalHistorico: 0,
        cantidadHistorica: 0,
        totalHoy: 0,
      };
    }
    groups[base].variantes.push(prod.nombre);
    groups[base].totalHistorico  += prod.total;
    groups[base].cantidadHistorica += prod.cantidad;
  }

  // Fold today's sales into groups (normalize keys)
  for (const [rawName, amount] of Object.entries(productosHoy)) {
    const base = normalizeProductName(rawName);
    if (groups[base]) {
      groups[base].totalHoy += amount;
    }
  }

  return Object.values(groups);
}

// ── Main alert generator ──────────────────────────────────────────────────────

export function generateAlerts(data: TNMetrics): AlertItem[] {
  const alerts: AlertItem[] = [];
  const {
    ventasHoy, totalFacturado: gananciaTotal, diasConDatos,
    todosProductos, productosHoy, ordenesHoy, ticketPromedio,
  } = data;

  // Daily average EXCLUDING today (more accurate baseline)
  const avgDiario =
    diasConDatos > 1
      ? (gananciaTotal - ventasHoy) / (diasConDatos - 1)
      : gananciaTotal / Math.max(diasConDatos, 1);

  // Necesita al menos 5 días de historial para alertas confiables
  const hasEnoughHistory = diasConDatos >= 5 && avgDiario > 0;

  // ── 1. Caída de ventas ────────────────────────────────────────────────────
  // Solo alerta si las ventas de hoy están por debajo del 50% del promedio (antes 70%)
  if (hasEnoughHistory && ventasHoy < avgDiario * 0.5) {
    const pct = Math.round(((ventasHoy - avgDiario) / avgDiario) * 100);
    const diff = avgDiario - ventasHoy;
    alerts.push({
      id: 'sales-drop',
      severity: 'warning',
      emoji: '⚠️',
      title: 'Caída de ventas detectada',
      metrics: [
        { label: 'Ventas hoy',         value: `$${fmt(ventasHoy)}` },
        { label: 'Promedio diario',    value: `$${fmt(avgDiario)}` },
        { label: 'Diferencia',         value: `−$${fmt(diff)}` },
      ],
      badge: `${pct}%`,
      badgePositive: false,
    });
  }

  // ── 2. Pico de ventas ─────────────────────────────────────────────────────
  if (hasEnoughHistory && ventasHoy > avgDiario * 1.5) {
    const pct = Math.round(((ventasHoy - avgDiario) / avgDiario) * 100);
    const diff = ventasHoy - avgDiario;
    alerts.push({
      id: 'sales-spike',
      severity: 'spike',
      emoji: '🚀',
      title: 'Pico de ventas detectado',
      metrics: [
        { label: 'Ventas hoy',         value: `$${fmt(ventasHoy)}` },
        { label: 'Promedio diario',    value: `$${fmt(avgDiario)}` },
        { label: 'Diferencia',         value: `+$${fmt(diff)}` },
      ],
      badge: `+${pct}%`,
      badgePositive: true,
    });
  }

  // ── 3 & 4. Por producto agrupado (sin ventas / en tendencia) ──────────────
  if (diasConDatos >= 5) {
    const groups = buildProductGroups(todosProductos, productosHoy);

    for (const group of groups) {
      const avgGrupo = group.totalHistorico / diasConDatos;
      if (avgGrupo <= 0) continue;

      const variantesLabel =
        group.variantes.length > 1
          ? group.variantes.join(', ')
          : undefined;

      // ── Producto sin ventas hoy ──────────────────────────────────────────
      // Solo alerta si: hay ventas generales hoy, el producto representa al menos
      // 20% del ingreso diario promedio, y tiene historial sólido (≥7 días)
      if (group.totalHoy === 0 && ventasHoy > 0 &&
          diasConDatos >= 7 && avgGrupo >= avgDiario * 0.2) {
        const metricRows: { label: string; value: string }[] = [
          { label: 'Producto',        value: group.baseName },
          { label: 'Promedio diario', value: `$${fmt(avgGrupo)}` },
          { label: 'Ventas hoy',      value: '$0,00' },
        ];
        if (variantesLabel) {
          metricRows.push({ label: 'Talles / variantes', value: variantesLabel });
        }
        alerts.push({
          id: `zero-${group.baseName}`,
          severity: 'zero',
          emoji: '⚠️',
          title: 'Producto sin ventas hoy',
          metrics: metricRows,
          badge: '−100%',
          badgePositive: false,
        });
      }

      // ── Producto en tendencia ────────────────────────────────────────────
      // Solo alerta si supera 3x el promedio (antes 2x) para evitar falsos positivos
      if (group.totalHoy > avgGrupo * 3) {
        const pct = Math.round(((group.totalHoy - avgGrupo) / avgGrupo) * 100);
        const metricRows: { label: string; value: string }[] = [
          { label: 'Producto',        value: group.baseName },
          { label: 'Ventas hoy',      value: `$${fmt(group.totalHoy)}` },
          { label: 'Promedio diario', value: `$${fmt(avgGrupo)}` },
          { label: 'Diferencia',      value: `+$${fmt(group.totalHoy - avgGrupo)}` },
        ];
        if (variantesLabel) {
          metricRows.push({ label: 'Talles / variantes', value: variantesLabel });
        }
        alerts.push({
          id: `trending-${group.baseName}`,
          severity: 'trending',
          emoji: '🔥',
          title: 'Producto en tendencia',
          metrics: metricRows,
          badge: `+${pct}%`,
          badgePositive: true,
        });
      }
    }
  }

  // ── 5. Compra anormalmente grande ─────────────────────────────────────────
  // Requiere historial sólido y umbral más alto (5x en vez de 3x)
  if (ticketPromedio > 0 && diasConDatos >= 5) {
    const seen = new Set<string>();
    for (const orden of ordenesHoy) {
      if (orden <= ticketPromedio * 5) continue;
      const key = orden.toFixed(2);
      if (seen.has(key)) continue;
      seen.add(key);

      const pct  = Math.round(((orden - ticketPromedio) / ticketPromedio) * 100);
      const mult = (orden / ticketPromedio).toFixed(1);
      alerts.push({
        id: `big-order-${key}`,
        severity: 'big_order',
        emoji: '💰',
        title: 'Compra grande detectada',
        metrics: [
          { label: 'Pedido',              value: `$${fmt(orden)}` },
          { label: 'Ticket promedio',     value: `$${fmt(ticketPromedio)}` },
          { label: 'Diferencia',          value: `+$${fmt(orden - ticketPromedio)}` },
          { label: 'Veces el promedio',   value: `${mult}×` },
        ],
        badge: `+${pct}%`,
        badgePositive: true,
      });
    }
  }

  return alerts;
}
