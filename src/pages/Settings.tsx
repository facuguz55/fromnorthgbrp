import { useState, useEffect } from 'react';
import { Save, User, Palette, Globe, LogOut } from 'lucide-react';
import type { DashboardSettings } from '../services/dataService';
import { DEFAULT_SETTINGS } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
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

export default function Settings() {
  const { user, logout } = useAuth();
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

          {/* ── Cuenta ─────────────────────────── */}
          <section className="settings-section glass-panel">
            <h2 className="section-title"><User size={18} /> Cuenta</h2>
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
                <div className="form-group">
                  <label>Email de sesión</label>
                  <input type="text" value={user?.email ?? ''} readOnly style={{ opacity: 0.6, cursor: 'default' }} />
                </div>
              </div>
              <div style={{ marginTop: '0.5rem' }}>
                <button type="button" className="btn-secondary" onClick={logout} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                  <LogOut size={15} />
                  Cerrar sesión
                </button>
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
                  <label htmlFor="dateFormat">Formato de fecha</label>
                  <select id="dateFormat" name="dateFormat" value={formData.dateFormat} onChange={handleChange}>
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </div>
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
