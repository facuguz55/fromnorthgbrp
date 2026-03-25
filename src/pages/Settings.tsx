import { useState, useEffect } from 'react';
import { Save, User, Palette, Database, Globe, Bell } from 'lucide-react';
import type { DashboardSettings } from '../services/dataService';
import './Settings.css';

const ACCENT_COLORS = [
  { label: 'Cyan',    value: '#06b6d4' },
  { label: 'Indigo',  value: '#818cf8' },
  { label: 'Verde',   value: '#10b981' },
  { label: 'Naranja', value: '#f97316' },
  { label: 'Rosa',    value: '#ec4899' },
  { label: 'Rojo',    value: '#ef4444' },
  { label: 'Violeta', value: '#a855f7' },
  { label: 'Amarillo',value: '#eab308' },
];

const DEFAULT_SETTINGS: DashboardSettings = {
  tiendanubeToken: '',
  tiendanubeStoreId: '',
  googleSheetsUrl: '',
  stockSheetsUrl: 'https://docs.google.com/spreadsheets/d/1gsib01GwMqM217pXzbQ7rRWh9xGaMSC0fXL2MDifxJ0/edit?gid=0#gid=0',
  customApiUrl: '',
  autoSync: true,
  displayName: '',
  accentColor: '#06b6d4',
  compactMode: false,
  currencySymbol: '$',
  language: 'es',
  dateFormat: 'DD/MM/YYYY',
  sidebarCollapsed: false,
};

export default function Settings() {
  const [formData, setFormData] = useState<DashboardSettings>(DEFAULT_SETTINGS);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('nova_dashboard_settings');
    if (saved) {
      try {
        setFormData({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
      } catch { /* ignore */ }
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const target = e.target as HTMLInputElement;
    const { name, value, type } = target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? target.checked : value,
    }));
    setIsSaved(false);
  };

  const setAccentColor = (color: string) => {
    setFormData(prev => ({ ...prev, accentColor: color }));
    setIsSaved(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('nova_dashboard_settings', JSON.stringify(formData));
    // Apply theme immediately
    document.documentElement.style.setProperty('--accent-primary', formData.accentColor);
    if (formData.compactMode) {
      document.documentElement.classList.add('compact');
    } else {
      document.documentElement.classList.remove('compact');
    }
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="settings-page fade-in">
      <header className="page-header">
        <h1>Configuración</h1>
        <p className="text-muted">Personaliza tu dashboard y gestiona tus integraciones.</p>
      </header>

      <div className="settings-content">
        <form className="settings-form" onSubmit={handleSubmit}>

          {/* ── Perfil ─────────────────────────── */}
          <section className="settings-section glass-panel">
            <h2 className="section-title"><User size={18} /> Perfil</h2>
            <div className="section-body">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="displayName">Nombre de usuario</label>
                  <input
                    type="text"
                    id="displayName"
                    name="displayName"
                    value={formData.displayName}
                    onChange={handleChange}
                    placeholder="Tu nombre"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* ── Apariencia ─────────────────────── */}
          <section className="settings-section glass-panel">
            <h2 className="section-title"><Palette size={18} /> Apariencia</h2>
            <div className="section-body">
              <div className="form-group">
                <label>Color de acento</label>
                <div className="color-swatches">
                  {ACCENT_COLORS.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      className={`color-swatch ${formData.accentColor === c.value ? 'selected' : ''}`}
                      style={{ '--swatch-color': c.value } as React.CSSProperties}
                      onClick={() => setAccentColor(c.value)}
                      title={c.label}
                      aria-label={c.label}
                    />
                  ))}
                </div>
                <div className="color-preview-row">
                  <div
                    className="color-preview-dot"
                    style={{ background: formData.accentColor }}
                  />
                  <span className="help-text" style={{ marginTop: 0 }}>
                    Color activo: {ACCENT_COLORS.find(c => c.value === formData.accentColor)?.label ?? 'Personalizado'}
                  </span>
                  <input
                    type="color"
                    value={formData.accentColor}
                    onChange={e => setAccentColor(e.target.value)}
                    className="color-picker-input"
                    title="Color personalizado"
                  />
                </div>
              </div>

              <div className="toggle-group">
                <div className="toggle-info">
                  <span className="toggle-label">Modo compacto</span>
                  <span className="toggle-desc">Reduce el espaciado para ver más información</span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    name="compactMode"
                    checked={formData.compactMode}
                    onChange={handleChange}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>
            </div>
          </section>

          {/* ── Región e idioma ────────────────── */}
          <section className="settings-section glass-panel">
            <h2 className="section-title"><Globe size={18} /> Región e idioma</h2>
            <div className="section-body">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="currencySymbol">Símbolo de moneda</label>
                  <select id="currencySymbol" name="currencySymbol" value={formData.currencySymbol} onChange={handleChange}>
                    <option value="$">$ (Dólar / Peso)</option>
                    <option value="€">€ (Euro)</option>
                    <option value="£">£ (Libra)</option>
                    <option value="R$">R$ (Real)</option>
                    <option value="CLP">CLP (Peso chileno)</option>
                    <option value="ARS">ARS (Peso argentino)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="dateFormat">Formato de fecha</label>
                  <select id="dateFormat" name="dateFormat" value={formData.dateFormat} onChange={handleChange}>
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="language">Idioma</label>
                  <select id="language" name="language" value={formData.language} onChange={handleChange}>
                    <option value="es">Español</option>
                    <option value="en">English</option>
                    <option value="pt">Português</option>
                  </select>
                </div>
              </div>
            </div>
          </section>

          {/* ── Google Sheets ──────────────────── */}
          <section className="settings-section glass-panel">
            <h2 className="section-title"><Bell size={18} /> Sincronización</h2>
            <div className="section-body">
              <div className="toggle-group">
                <div className="toggle-info">
                  <span className="toggle-label">Auto-sync con Google Sheets</span>
                  <span className="toggle-desc">Actualiza métricas automáticamente al cargar</span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    name="autoSync"
                    checked={formData.autoSync}
                    onChange={handleChange}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>
              <div className="form-group">
                <label htmlFor="googleSheetsUrl">URL o ID de la hoja de cálculo (ventas)</label>
                <input
                  type="text"
                  id="googleSheetsUrl"
                  name="googleSheetsUrl"
                  value={formData.googleSheetsUrl}
                  onChange={handleChange}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                />
                <span className="help-text">La hoja debe estar en modo "Cualquier persona con el enlace puede ver".</span>
              </div>
              <div className="form-group">
                <label htmlFor="stockSheetsUrl">URL de la hoja de stock</label>
                <input
                  type="text"
                  id="stockSheetsUrl"
                  name="stockSheetsUrl"
                  value={formData.stockSheetsUrl}
                  onChange={handleChange}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                />
                <span className="help-text">Sheet con columnas: Nombre, SKU, Stock, Precio, Fecha_Actualizacion.</span>
              </div>
            </div>
          </section>


          {/* ── Tiendanube API ─────────────────── */}
          <section className="settings-section glass-panel">
            <h2 className="section-title"><Database size={18} /> Tiendanube API</h2>
            <div className="section-body">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="tiendanubeStoreId">Store ID</label>
                  <input
                    type="text"
                    id="tiendanubeStoreId"
                    name="tiendanubeStoreId"
                    value={formData.tiendanubeStoreId}
                    onChange={handleChange}
                    placeholder="ej. 123456"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="tiendanubeToken">Access Token</label>
                  <input
                    type="password"
                    id="tiendanubeToken"
                    name="tiendanubeToken"
                    value={formData.tiendanubeToken}
                    onChange={handleChange}
                    placeholder="Bearer token"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* ── Custom API ─────────────────────── */}
          <section className="settings-section glass-panel">
            <h2 className="section-title"><Database size={18} /> API Personalizada</h2>
            <div className="section-body">
              <div className="form-group">
                <label htmlFor="customApiUrl">URL Base del endpoint</label>
                <input
                  type="url"
                  id="customApiUrl"
                  name="customApiUrl"
                  value={formData.customApiUrl}
                  onChange={handleChange}
                  placeholder="https://api.ejemplo.com/v1"
                />
              </div>
            </div>
          </section>

          <div className="form-actions">
            <button type="submit" className={`btn-primary ${isSaved ? 'btn-saved' : ''}`}>
              <Save size={18} />
              {isSaved ? '¡Guardado!' : 'Guardar configuración'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
