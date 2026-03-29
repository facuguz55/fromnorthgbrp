import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Settings, PieChart, BarChart2, Bell, Lock, CalendarDays, Dices, Inbox, Store, Megaphone } from 'lucide-react';
import {
  META_ACCOUNTS, getActiveMetaAccount, setActiveMetaAccount,
} from '../services/dataService';
import type { MetaAccountKey } from '../services/dataService';
import './Sidebar.css';

export default function Sidebar() {
  const navigate = useNavigate();
  const [activeAcct, setActiveAcct] = useState<MetaAccountKey>(getActiveMetaAccount);

  // Sincroniza cuando Meta.tsx cambia la cuenta desde su header
  useEffect(() => {
    const handler = (e: Event) => {
      setActiveAcct((e as CustomEvent<MetaAccountKey>).detail);
    };
    window.addEventListener('meta-account-changed', handler);
    return () => window.removeEventListener('meta-account-changed', handler);
  }, []);

  const handleMetaAccount = (key: MetaAccountKey) => {
    setActiveMetaAccount(key);
    setActiveAcct(key);
    navigate('/meta');
  };

  return (
    <aside className="sidebar glass-panel">
      <div className="sidebar-header">
        <div className="logo">
          <PieChart className="logo-icon" size={26} />
          <span className="logo-text">Nova SaaS</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <ul className="nav-list">

          {/* ── General ── */}
          <li className="nav-group-label">General</li>
          <li className="nav-item">
            <NavLink to="/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <LayoutDashboard size={20} />
              <span className="nav-label-full">Tienda Web</span>
              <span className="nav-label-short">Tienda</span>
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink to="/analytics" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <BarChart2 size={20} />
              <span>Análisis</span>
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink to="/alerts" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Bell size={20} />
              <span>Alertas</span>
            </NavLink>
          </li>

          {/* ── Operación ── */}
          <li className="nav-group-label">Operación</li>
          <li className="nav-item">
            <NavLink to="/tienda" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Store size={20} />
              <span className="nav-label-full">Gestión de Tienda</span>
              <span className="nav-label-short">Gestión</span>
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink to="/meta" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Megaphone size={20} />
              <span>Meta Ads</span>
            </NavLink>
            <ul className="nav-sub-list">
              {META_ACCOUNTS.map(acct => (
                <li key={acct.key}>
                  <button
                    className={`nav-sub-link ${activeAcct === acct.key ? 'active' : ''}`}
                    onClick={() => handleMetaAccount(acct.key)}
                  >
                    <span className="nav-sub-dot" />
                    {acct.label}
                  </button>
                </li>
              ))}
            </ul>
          </li>

          {/* ── Gestión ── */}
          <li className="nav-group-label">Gestión</li>
          <li className="nav-item">
            <NavLink to="/calendar" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <CalendarDays size={20} />
              <span>Calendario</span>
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink to="/mails" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Inbox size={20} />
              <span>Mails</span>
            </NavLink>
          </li>

          {/* ── Ruleta ── */}
          <li className="nav-group-label">Extra</li>
          <li className="nav-item">
            <NavLink to="/ruleta" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Dices size={20} />
              <span>Ruleta</span>
            </NavLink>
          </li>

        </ul>

        <div className="sidebar-bottom">
          <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Settings size={20} />
            <span>Configuración</span>
          </NavLink>
          <NavLink to="/workflows" className={({ isActive }) => `nav-link nav-link-discrete ${isActive ? 'active' : ''}`}>
            <Lock size={15} />
            <span>Notas privadas</span>
          </NavLink>
        </div>
      </nav>

      <p className="sidebar-credit">developed for facu</p>
    </aside>
  );
}
