export interface DashboardSettings {
  tiendanubeToken: string;
  tiendanubeStoreId: string;
  googleSheetsUrl: string;
  displayName: string;
  accentColor: string;
  compactMode: boolean;
  currencySymbol: string;
  language: string;
  dateFormat: string;
  sidebarCollapsed: boolean;
}

export function getSettings(): DashboardSettings | null {
  const saved = localStorage.getItem('nova_dashboard_settings');
  if (!saved) return null;
  try { return JSON.parse(saved); } catch { return null; }
}

/** CSV parser que maneja campos entre comillas con comas internas */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
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

/** Descarga una hoja de Google Sheets por GID y devuelve headers + rows */
export async function fetchSheetByGid(
  googleSheetsUrl: string,
  gid: string,
): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const match = googleSheetsUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) return { headers: [], rows: [] };
  const sheetId = match[1];
  const res = await fetch(
    `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`,
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

/** Cuenta las filas de datos (sin header) en una hoja por GID */
export async function fetchSheetRowCount(
  googleSheetsUrl: string,
  gid: string,
): Promise<number> {
  try {
    const match = googleSheetsUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) return 0;
    const sheetId = match[1];
    const res = await fetch(
      `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`,
    );
    if (!res.ok) return 0;
    const csv = await res.text();
    const lines = csv.split('\n').filter(l => l.trim());
    // Si la primera línea contiene "email" es header → restar 1
    const hasHeader = lines.length > 0 && lines[0].toLowerCase().includes('email');
    return Math.max(0, hasHeader ? lines.length - 1 : lines.length);
  } catch {
    return 0;
  }
}
