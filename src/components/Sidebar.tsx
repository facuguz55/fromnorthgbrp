import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Settings, PieChart, BarChart2, Bell, Lock, CalendarDays, Package, Dices, Inbox, Tag, Users, Store } from 'lucide-react';
import './Sidebar.css';

export default function Sidebar() {
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
          <li className="nav-item">
            <NavLink to="/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <LayoutDashboard size={20} />
              <span>Dashboard</span>
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
          <li className="nav-item">
            <NavLink to="/calendar" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <CalendarDays size={20} />
              <span>Calendario</span>
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink to="/stock" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Package size={20} />
              <span>Stock</span>
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink to="/tienda" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Store size={20} />
              <span>Tienda</span>
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink to="/clientes" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Users size={20} />
              <span>Clientes</span>
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink to="/cupones" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Tag size={20} />
              <span>Cupones</span>
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink to="/mails" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Inbox size={20} />
              <span>Mails</span>
            </NavLink>
          </li>
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
