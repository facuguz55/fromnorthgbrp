import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { getSettings, fetchGoogleSheetsMetrics } from '../services/dataService';
import SalesCalendarDetail from '../components/SalesCalendarDetail';

export default function Calendar() {
  const [loading, setLoading] = useState(true);
  const [ventasPorDia, setVentasPorDia] = useState<{ name: string; value: number }[]>([]);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchData = async () => {
    setLoading(true);
    try {
      const settings = getSettings();
      if (settings?.googleSheetsUrl) {
        const fetched = await fetchGoogleSheetsMetrics(settings.googleSheetsUrl);
        if (fetched) setVentasPorDia(fetched.ventasPorDia);
      }
    } catch (err) {
      console.error('Error fetching calendar data:', err);
    } finally {
      setLoading(false);
      setLastRefreshed(new Date());
    }
  };

  useEffect(() => { fetchData(); }, []);

  return (
    <div className="dashboard-page fade-in">
      <header className="dashboard-header">
        <div>
          <h1>Calendario de ventas</h1>
          <span className="text-muted" style={{ fontSize: '0.8rem' }}>
            Actualizado: {lastRefreshed.toLocaleTimeString('es-AR')}
          </span>
        </div>
        <button className="btn-secondary refresh-btn" onClick={fetchData} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spinning' : ''} />
          {loading ? 'Cargando...' : 'Actualizar'}
        </button>
      </header>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <div className="loading-spinner" />
        </div>
      ) : (
        <SalesCalendarDetail ventasPorDia={ventasPorDia} />
      )}
    </div>
  );
}
