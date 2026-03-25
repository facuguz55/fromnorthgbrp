// Base interface for the settings shape
export interface DashboardSettings {
  tiendanubeToken: string;
  tiendanubeStoreId: string;
  googleSheetsUrl: string;
  stockSheetsUrl: string;
  customApiUrl: string;
  autoSync: boolean;
  // Personalization
  displayName: string;
  accentColor: string;
  compactMode: boolean;
  currencySymbol: string;
  language: string;
  dateFormat: string;
  sidebarCollapsed: boolean;
}

// Get settings from local storage
export function getSettings(): DashboardSettings | null {
  const saved = localStorage.getItem('nova_dashboard_settings');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Utility to extract Google Sheet ID and format it as a CSV export URL
 * Expected format: https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
 */
export function getGoogleSheetCsvUrl(url: string): string | null {
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
  }
  // Try treating the input as raw ID if no /d/ is found
  if (url.length > 20 && !url.includes('/')) {
    return `https://docs.google.com/spreadsheets/d/${url}/export?format=csv`;
  }
  return null;
}

/**
 * Proper CSV line parser that handles quoted fields with commas inside.
 * e.g. `"14/3/2026, 19:45:07","Orden 1","Producto A"` → ['14/3/2026, 19:45:07', 'Orden 1', 'Producto A']
 */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // Handle escaped quotes ("")
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

// Parse simple CSV string into objects
export function parseCsv(csv: string) {
  const lines = csv.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase());
  return lines.slice(1).map(line => {
    const values = parseCsvLine(line);
    return headers.reduce((obj: Record<string, string>, header, index) => {
      obj[header] = values[index] ?? '';
      return obj;
    }, {});
  });
}

/** Returns today's midnight timestamp using Argentina timezone (UTC-3, no DST) */
function getArgentinaToday(): number {
  // toLocaleString gives us the wall-clock time in AR, re-parse to extract Y/M/D
  const arStr = new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' });
  const ar = new Date(arStr);
  // Build midnight in LOCAL JS time using AR date components
  return new Date(ar.getFullYear(), ar.getMonth(), ar.getDate()).getTime();
}

/**
 * Parses a date from CSV into a midnight-local timestamp.
 * Handles all common Google Sheets export formats:
 *   D/M/YYYY   → "14/3/2026"  or "14/03/2026"   (Argentine default)
 *   M/D/YYYY   → "3/14/2026"                     (US locale sheets)
 *   YYYY-MM-DD → "2026-03-14"                     (ISO format)
 *   YYYY/MM/DD → "2026/03/14"
 * Strips time component if present: "14/3/2026, 19:45:07" or "14/3/2026 19:45:07"
 */
function parseDateAR(raw: string): number | null {
  // Strip time component (anything after space or ", ")
  const datePart = raw.replace(/,?\s+\d{1,2}:\d{2}(:\d{2})?(\s*(AM|PM))?$/i, '').trim();

  // ISO format: YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = datePart.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    if (y >= 2000 && m >= 1 && m <= 12 && d >= 1 && d <= 31)
      return new Date(y, m - 1, d).getTime();
  }

  // Slash format: A/B/YYYY
  const slashMatch = datePart.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    let a = parseInt(slashMatch[1], 10);
    let b = parseInt(slashMatch[2], 10);
    const y = parseInt(slashMatch[3], 10);
    if (y < 2000 || y > 2100) return null;

    let d: number, m: number;
    if (a > 12)       { d = a; m = b; }  // D/M/YYYY confirmed
    else if (b > 12)  { d = b; m = a; }  // M/D/YYYY confirmed
    else              { d = a; m = b; }  // ambiguous → D/M/YYYY (AR default)

    if (d < 1 || d > 31 || m < 1 || m > 12) return null;
    return new Date(y, m - 1, d).getTime();
  }

  return null;
}

/**
 * Fetch generic custom API structure
 */
export async function fetchCustomApi(url: string) {
  try {
    const res = await fetch(url, { headers: { 'Accept': 'application/json' }});
    if (!res.ok) throw new Error(`Custom API Error: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(err);
    throw err;
  }
}

/**
 * Aggregates dates into an array suitable for Recharts.
 * Uses proper CSV parser to handle quoted date fields with commas.
 */
function aggregateDatesForChart(lines: string[]) {
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase());
  // Find date column (second column typically, or column named 'fecha'/'date')
  const dateIdx = headers.findIndex(h => h.includes('fecha') || h.includes('date')) !== -1
    ? headers.findIndex(h => h.includes('fecha') || h.includes('date'))
    : 1;

  const counts: Record<string, number> = {};

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const fields = parseCsvLine(line);
    const raw = fields[dateIdx] ?? '';
    if (!raw) continue;
    // Get just the date part D/M/YYYY (strip time)
    const day = raw.split(',')[0].split(' ')[0].trim();
    if (day) {
      counts[day] = (counts[day] ?? 0) + 1;
    }
  }

  return Object.keys(counts).map(date => ({ name: date, value: counts[date] }));
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

export interface MetodoPago {
  name: string;
  value: number;
  porcentaje: number;
}

export interface SalesData {
  gananciaTotal: number;
  ventasHoy: number;
  ventasSemana: number;
  ventasPorDia: { name: string; value: number }[];
  topProductos: TopProducto[];       // Top 6 para el dashboard
  todosProductos: TopProducto[];     // Todos los productos (para alertas)
  topCompradores: MejorComprador[];
  metodoPagoTop: string;
  ventasPorHora: { name: string; value: number }[];
  metodosPago: MetodoPago[];
  clientesNuevos: number;
  clientesRecurrentes: number;
  // Alert-related fields
  productosHoy: Record<string, number>;
  ordenesHoy: number[];
  ticketPromedio: number;
  diasConDatos: number;
  ultimaVenta: { monto: number; producto: string; hora: string; cliente: string; fecha: string } | null;
}

/**
 * Processes the "Ventas(todas)" CSV using a proper parser.
 * Handles quoted fields that contain commas (e.g. "14/3/2026, 19:45:07").
 * All dates interpreted in America/Argentina/Buenos_Aires (UTC-3).
 *
 * Expected headers (case-insensitive):
 *   fecha, orden_id, cliente, email, producto, sku, precio, cantidad, total_producto, [metodo_pago]
 */
function processSalesData(lines: string[]): SalesData {
  const empty: SalesData = {
    gananciaTotal: 0, ventasHoy: 0, ventasSemana: 0,
    ventasPorDia: [], topProductos: [], todosProductos: [], topCompradores: [], metodoPagoTop: '',
    ventasPorHora: [], metodosPago: [], clientesNuevos: 0, clientesRecurrentes: 0,
    productosHoy: {}, ordenesHoy: [], ticketPromedio: 0, diasConDatos: 0, ultimaVenta: null,
  };

  if (lines.length <= 1) return empty;

  const headers = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));

  const idx = (name: string) => headers.indexOf(name);
  const dateIdx    = idx('fecha');
  const totalIdx   = idx('total_producto');
  const productoIdx = idx('producto');
  const clienteIdx  = idx('cliente');
  const emailIdx    = idx('email');
  const metodoPagoIdx = idx('medio_pago');
  const cantidadIdx = idx('cantidad');

  if (dateIdx === -1 || totalIdx === -1) {
    console.warn('[Sales] Columnas no encontradas. Headers detectados:', headers);
    return empty;
  }

  const today   = getArgentinaToday();
  // Start of current week: Monday 00:00 Argentina time
  const arStr = new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' });
  const ar = new Date(arStr);
  const dow = ar.getDay(); // 0=Sun, 1=Mon...
  const daysSinceMon = dow === 0 ? 6 : dow - 1;
  const weekStart = new Date(ar.getFullYear(), ar.getMonth(), ar.getDate() - daysSinceMon).getTime();

  console.log('[Sales] Hoy (AR):', new Date(today).toLocaleDateString('es-AR'));
  console.log('[Sales] Headers:', headers);
  // Log first 5 data rows for debugging
  for (let dbg = 1; dbg <= Math.min(5, lines.length - 1); dbg++) {
    const f = parseCsvLine(lines[dbg]);
    const rawDate = f[dateIdx] ?? '';
    const ts = parseDateAR(rawDate);
    console.log(`[Sales] Fila ${dbg}:`, {
      fecha_raw: rawDate,
      fecha_parseada: ts ? new Date(ts).toLocaleDateString('es-AR') : 'ERROR',
      es_hoy: ts === today,
      total_raw: f[totalIdx],
      total_parsed: parseFloat(f[totalIdx] ?? '0'),
    });
  }

  let gananciaTotal = 0;
  let ventasHoy     = 0;
  let ventasSemana  = 0;
  const ventasPorDia: Record<string, number>          = {};
  const productoCounts: Record<string, TopProducto>   = {};
  const compradorMap: Record<string, MejorComprador>  = {};
  const metodoPagoCounts: Record<string, number>      = {};
  const ventasPorHoraMap: Record<number, number>      = {};
  const productosHoyMap: Record<string, number>       = {};
  const ordenesHoyList: number[]                      = [];
  let totalOrdenes = 0;
  let countOrdenes = 0;
  let ultimaVenta: { monto: number; producto: string; hora: string; cliente: string; fecha: string } | null = null;
  let ultimaVentaTs = -1;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const fields = parseCsvLine(line);
    const dateRaw  = fields[dateIdx]  ?? '';
    const totalRaw = parseFloat(fields[totalIdx] ?? '0') || 0;

    if (!dateRaw) continue;

    gananciaTotal += totalRaw;

    // Date comparison (Argentina midnight)
    const rowTs = parseDateAR(dateRaw);
    if (rowTs !== null) {
      if (rowTs === today)        ventasHoy    += totalRaw;
      if (rowTs >= weekStart)     ventasSemana += totalRaw;

      // Chart: D/M/YYYY label
      const dayLabel = dateRaw.split(',')[0].split(' ')[0].trim();
      ventasPorDia[dayLabel] = (ventasPorDia[dayLabel] ?? 0) + totalRaw;
    }

    // Hour extraction for ventas por hora
    const timeMatch = dateRaw.match(/,?\s+(\d{1,2}):\d{2}/);
    if (timeMatch) {
      const hour = parseInt(timeMatch[1], 10);
      if (!isNaN(hour) && hour >= 0 && hour <= 23) {
        ventasPorHoraMap[hour] = (ventasPorHoraMap[hour] ?? 0) + 1;
      }
    }

    // Track individual order amounts (for ticket promedio + big order alerts)
    totalOrdenes += totalRaw;
    countOrdenes++;
    if (rowTs === today) ordenesHoyList.push(totalRaw);

    // Última venta: keep the row with the most recent raw date string
    const timeMatch2 = dateRaw.match(/(\d{1,2}:\d{2})/);
    const horaStr = timeMatch2 ? timeMatch2[1] : '';
    const rowOrder = (rowTs ?? 0) * 10000 + (horaStr ? parseInt(horaStr.replace(':','')) : 0);
    if (rowTs !== null && rowOrder > ultimaVentaTs) {
      ultimaVentaTs = rowOrder;
      const prod = productoIdx !== -1 ? (fields[productoIdx] ?? '') : '';
      const cli  = clienteIdx  !== -1 ? (fields[clienteIdx]  ?? '') : '';
      const fechaLabel = dateRaw.split(',')[0].split(' ')[0].trim();
      ultimaVenta = { monto: totalRaw, producto: prod, hora: horaStr, cliente: cli, fecha: fechaLabel };
    }

    // Top productos
    if (productoIdx !== -1) {
      const prod = fields[productoIdx] ?? '';
      if (prod) {
        const cant = parseFloat(fields[cantidadIdx] ?? '1') || 1;
        if (!productoCounts[prod]) productoCounts[prod] = { nombre: prod, cantidad: 0, total: 0 };
        productoCounts[prod].cantidad += cant;
        productoCounts[prod].total    += totalRaw;
        // Track product sales today for alert detection
        if (rowTs === today) {
          productosHoyMap[prod] = (productosHoyMap[prod] ?? 0) + totalRaw;
        }
      }
    }

    // Mejor comprador
    const email   = emailIdx   !== -1 ? (fields[emailIdx]   ?? '') : '';
    const cliente = clienteIdx !== -1 ? (fields[clienteIdx] ?? '') : '';
    const key = email || cliente;
    if (key) {
      if (!compradorMap[key]) compradorMap[key] = { nombre: cliente, email, total: 0, pedidos: 0 };
      compradorMap[key].total   += totalRaw;
      compradorMap[key].pedidos += 1;
    }

    // Método de pago
    if (metodoPagoIdx !== -1) {
      const metodo = fields[metodoPagoIdx] ?? '';
      if (metodo) metodoPagoCounts[metodo] = (metodoPagoCounts[metodo] ?? 0) + 1;
    }
  }

  const todosProductosSorted = Object.values(productoCounts)
    .sort((a, b) => b.cantidad - a.cantidad);
  const topProductos = todosProductosSorted.slice(0, 6);

  const topCompradores = Object.values(compradorMap)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const metodoPagoTop = Object.entries(metodoPagoCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';

  // Ventas por hora: full 24-hour array
  const ventasPorHora = Array.from({ length: 24 }, (_, h) => ({
    name: `${String(h).padStart(2, '0')}:00`,
    value: ventasPorHoraMap[h] ?? 0,
  }));

  // Métodos de pago con porcentaje
  const totalMetodos = Object.values(metodoPagoCounts).reduce((sum, v) => sum + v, 0);
  const metodosPago: MetodoPago[] = Object.entries(metodoPagoCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({
      name,
      value,
      porcentaje: totalMetodos > 0 ? Math.round((value / totalMetodos) * 100) : 0,
    }));

  // Clientes nuevos vs recurrentes (basado en pedidos por cliente)
  let clientesNuevos = 0;
  let clientesRecurrentes = 0;
  for (const client of Object.values(compradorMap)) {
    if (client.pedidos === 1) clientesNuevos++;
    else clientesRecurrentes++;
  }

  const diasConDatos = Object.keys(ventasPorDia).length;
  const ticketPromedio = countOrdenes > 0 ? totalOrdenes / countOrdenes : 0;

  return {
    gananciaTotal, ventasHoy, ventasSemana,
    ventasPorDia: Object.keys(ventasPorDia).map(d => ({ name: d, value: ventasPorDia[d] })),
    topProductos, todosProductos: todosProductosSorted, topCompradores, metodoPagoTop,
    ventasPorHora, metodosPago, clientesNuevos, clientesRecurrentes,
    productosHoy: productosHoyMap, ordenesHoy: ordenesHoyList, ticketPromedio, diasConDatos, ultimaVenta,
  };
}

/**
 * Fetch and count rows from Google Sheets for specific metrics.
 * 
 * Hoja 1 (gid=0) -> "Correos Enviados"
 * Clicks (gid=1982854970) -> "Clicks"
 * Seguimiento Exitoso (gid=11747759) -> "Seguimientos"
 * Ventas(todas) (gid=1317535551) -> "Ventas"
 */
export async function fetchGoogleSheetsMetrics(baseUrl: string) {
  const baseMatch = baseUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!baseMatch) return null;
  
  const sheetId = baseMatch[1];
  
  const metrics = {
    correosEnviados: 0,
    clicks: 0,
    seguimientos: 0,
    gananciaTotal: 0,
    ventasHoy: 0,
    ventasSemana: 0,
    correosPorDia: [] as { name: string, value: number }[],
    clicksPorDia:  [] as { name: string, value: number }[],
    ventasPorDia:  [] as { name: string, value: number }[],
    topProductos:    [] as TopProducto[],
    todosProductos:  [] as TopProducto[],
    topCompradores:  [] as MejorComprador[],
    metodoPagoTop:  '',
    ventasPorHora:  [] as { name: string; value: number }[],
    metodosPago:    [] as MetodoPago[],
    clientesNuevos: 0,
    clientesRecurrentes: 0,
    productosHoy:   {} as Record<string, number>,
    ordenesHoy:     [] as number[],
    ticketPromedio: 0,
    diasConDatos:   0,
    ultimaVenta:    null as { monto: number; producto: string; hora: string; cliente: string; fecha: string } | null,
  };

  try {
    // Hoja etapa2_enviada (Seguimientos Enviados)
    const res1 = await fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&sheet=etapa2_enviada`);
    if (res1.ok) {
      const csv1 = await res1.text();
      const lines = csv1.split('\n').filter(line => line.trim().length > 0);
      metrics.correosEnviados = Math.max(0, lines.length - 1);
      metrics.correosPorDia = aggregateDatesForChart(lines);
    }

    // Clicks - gid=1982854970
    const res2 = await fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=1982854970`);
    if (res2.ok) {
      const csv2 = await res2.text();
      const lines = csv2.split('\n').filter(line => line.trim().length > 0);
      metrics.clicks = Math.max(0, lines.length > 0 && lines[0].toLowerCase().includes('email') ? lines.length - 1 : lines.length);
      metrics.clicksPorDia = aggregateDatesForChart(lines);
    }

    // Hoja 3 (Seguimientos) - gid=11747759
    const res3 = await fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=11747759`);
    if (res3.ok) {
      const csv3 = await res3.text();
      const lines = csv3.split('\n').filter(line => line.trim().length > 0);
      metrics.seguimientos = Math.max(0, lines.length > 0 && lines[0].toLowerCase().includes('email') ? lines.length - 1 : lines.length);
    }

    // Ventas(todas) - gid=1317535551
    const res4 = await fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=1317535551`);
    if (res4.ok) {
      const csv4 = await res4.text();
      const lines = csv4.split(/\r?\n/);
      const salesData = processSalesData(lines);
      metrics.gananciaTotal       = salesData.gananciaTotal;
      metrics.ventasHoy           = salesData.ventasHoy;
      metrics.ventasSemana        = salesData.ventasSemana;
      metrics.ventasPorDia        = salesData.ventasPorDia;
      metrics.topProductos        = salesData.topProductos;
      metrics.todosProductos      = salesData.todosProductos;
      metrics.topCompradores      = salesData.topCompradores;
      metrics.metodoPagoTop       = salesData.metodoPagoTop;
      metrics.ventasPorHora       = salesData.ventasPorHora;
      metrics.metodosPago         = salesData.metodosPago;
      metrics.clientesNuevos      = salesData.clientesNuevos;
      metrics.clientesRecurrentes = salesData.clientesRecurrentes;
      metrics.productosHoy        = salesData.productosHoy;
      metrics.ordenesHoy          = salesData.ordenesHoy;
      metrics.ticketPromedio      = salesData.ticketPromedio;
      metrics.diasConDatos        = salesData.diasConDatos;
      metrics.ultimaVenta         = salesData.ultimaVenta;
    }

    return metrics;
  } catch (err) {
    console.error("Error fetching specific metrics", err);
    return null;
  }
}

/**
 * Fetch genérico: trae todas las filas y columnas de una hoja por GID.
 * Devuelve headers + rows como array de objetos.
 */
export async function fetchSheetByGid(
  googleSheetsUrl: string,
  gid: string
): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const match = googleSheetsUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) return { headers: [], rows: [] };
  const sheetId = match[1];

  const res = await fetch(
    `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`
  );
  if (!res.ok) return { headers: [], rows: [] };

  const csv = await res.text();
  const lines = csv.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = parseCsvLine(lines[0]).map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    const fields = parseCsvLine(line);
    return headers.reduce((obj: Record<string, string>, h, i) => {
      obj[h] = fields[i]?.trim() ?? '';
      return obj;
    }, {});
  }).filter(row => Object.values(row).some(v => v !== ''));

  return { headers, rows };
}

export interface SeguimientoCliente {
  nombre: string;
  email: string;
  fecha: string;
  extra: Record<string, string>; // columnas adicionales que pueda tener la hoja
}

/**
 * Fetch lista de clientes en seguimiento desde la hoja etapa2_enviada.
 * Detecta automáticamente columnas de nombre, email y fecha.
 */
export async function fetchSeguimientosEnviados(googleSheetsUrl: string): Promise<SeguimientoCliente[]> {
  const match = googleSheetsUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) return [];
  const sheetId = match[1];

  const res = await fetch(
    `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&sheet=etapa2_enviada`
  );
  if (!res.ok) return [];

  const csv = await res.text();
  const lines = csv.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase());

  const emailIdx  = headers.findIndex(h => h.includes('email') || h.includes('correo'));
  const nombreIdx = headers.findIndex(h =>
    h.includes('nombre') || h.includes('cliente') || h.includes('name')
  );
  const fechaIdx  = headers.findIndex(h => h.includes('fecha') || h.includes('date'));

  return lines.slice(1).map(line => {
    const fields = parseCsvLine(line);
    const extra: Record<string, string> = {};
    headers.forEach((h, i) => {
      if (i !== emailIdx && i !== nombreIdx && i !== fechaIdx) {
        extra[h] = fields[i] ?? '';
      }
    });
    return {
      nombre: nombreIdx !== -1 ? (fields[nombreIdx] ?? '').trim() : '',
      email:  emailIdx  !== -1 ? (fields[emailIdx]  ?? '').trim() : '',
      fecha:  fechaIdx  !== -1 ? (fields[fechaIdx]  ?? '').trim() : '',
      extra,
    };
  }).filter(c => c.email || c.nombre);
}

export interface StockItem {
  nombre: string;
  sku: string;
  stock: number;
  precio: number;
  fechaActualizacion: string;
}

/**
 * Fetches stock data from a Google Sheet with headers:
 * Nombre | SKU | Stock | Precio | Fecha_Actualizacion
 */
export async function fetchStockData(stockSheetsUrl: string): Promise<StockItem[]> {
  const match = stockSheetsUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) return [];

  const sheetId = match[1];
  const gidMatch = stockSheetsUrl.match(/[#?&]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : '0';

  const res = await fetch(
    `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`
  );
  if (!res.ok) throw new Error(`Error fetching stock: ${res.status}`);

  const csv = await res.text();
  const lines = csv.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map(h =>
    h.trim().toLowerCase().replace(/[\s_-]+/g, '_')
  );

  const nombreIdx = headers.findIndex(h => h.includes('nombre'));
  const skuIdx    = headers.findIndex(h => h.includes('sku'));
  const stockIdx  = headers.findIndex(h => h.includes('stock'));
  const precioIdx = headers.findIndex(h => h.includes('precio'));
  const fechaIdx  = headers.findIndex(h => h.includes('fecha'));

  return lines.slice(1).map(line => {
    const f = parseCsvLine(line);
    return {
      nombre:             nombreIdx !== -1 ? (f[nombreIdx] ?? '').trim() : '',
      sku:                skuIdx    !== -1 ? (f[skuIdx]    ?? '').trim() : '',
      stock:              stockIdx  !== -1 ? (parseFloat(f[stockIdx]  ?? '0') || 0) : 0,
      precio:             precioIdx !== -1 ? (parseFloat(f[precioIdx] ?? '0') || 0) : 0,
      fechaActualizacion: fechaIdx  !== -1 ? (f[fechaIdx]  ?? '').trim() : '',
    };
  }).filter(item => item.nombre.length > 0);
}


/**
 * Fetch Tiendanube. Note: Tiendanube API usually requires server-side integration due to CORS.
 * We attempt direct fetch here, but in production a proxy might be needed.
 */
export async function fetchTiendanubeProducts(storeId: string, token: string) {
  try {
    const res = await fetch(`https://api.tiendanube.com/v1/${storeId}/products`, {
      headers: {
        'Authentication': `bearer ${token}`,
        'User-Agent': 'NovaDashboard (contact@example.com)'
      }
    });
    if (!res.ok) throw new Error(`Tiendanube Error: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("Tiendanube fetch failed (CORS or Invalid config). Falling back to mock data.", err);
    throw err;
  }
}
