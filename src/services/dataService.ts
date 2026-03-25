export interface DashboardSettings {
  tiendanubeToken: string;
  tiendanubeStoreId: string;
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
