import { useMemo } from 'react';
import {
  BarChart, Bar, ComposedChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import { X } from 'lucide-react';
import type { TNMetrics, TNOrder } from '../services/tiendanubeService';

const AR_OFFSET = -3 * 60 * 60 * 1000;
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DIAS_SEMANA = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

const fmtK = (v: number) =>
  v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M`
  : v >= 1000 ? `$${Math.round(v / 1000)}k`
  : `$${Math.round(v)}`;

function getARNow() {
  const nowAR = Date.now() + AR_OFFSET;
  const d = new Date(nowAR);
  return { day: d.getUTCDate(), hour: d.getUTCHours(), dow: d.getUTCDay() };
}

function getARBoundaries() {
  const nowAR = Date.now() + AR_OFFSET;
  const msPerDay = 86_400_000;
  const todayStartMS = Math.floor(nowAR / msPerDay) * msPerDay - AR_OFFSET;
  const arDow = new Date(nowAR).getUTCDay();
  const daysSinceMon = arDow === 0 ? 6 : arDow - 1;
  const weekStartMS = todayStartMS - daysSinceMon * msPerDay;
  return { todayStartMS, weekStartMS };
}

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const total = payload.find((p: any) => p.dataKey === 'total')?.value ?? 0;
  const ordenes = payload.find((p: any) => p.dataKey === 'ordenes')?.value;
  return (
    <div style={{
      background: 'var(--bg-surface, #12172b)',
      border: '1px solid var(--border-color)',
      borderRadius: 8,
      padding: '8px 12px',
      fontSize: '0.78rem',
    }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ color: '#10b981', fontWeight: 600 }}>
        ${Number(total).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
      </div>
      {ordenes !== undefined && (
        <div style={{ color: '#94a3b8', fontSize: '0.72rem', marginTop: 2 }}>
          {ordenes} {ordenes === 1 ? 'orden' : 'órdenes'}
        </div>
      )}
    </div>
  );
};

interface Props {
  activeChart: 'mes' | 'hoy' | 'semana';
  monthOrders: TNOrder[];
  metrics: TNMetrics;
  selectedMonthKey: string;
  onClose: () => void;
}

export default function ChartPanel({ activeChart, monthOrders, metrics, selectedMonthKey, onClose }: Props) {
  const arNow = useMemo(getARNow, []);
  const { todayStartMS, weekStartMS } = useMemo(getARBoundaries, []);

  const mesData = useMemo(() => {
    const [year, month] = selectedMonthKey.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const map: Record<number, { total: number; ordenes: number }> = {};
    for (const o of monthOrders) {
      const day = new Date(new Date(o.created_at).getTime() + AR_OFFSET).getUTCDate();
      if (!map[day]) map[day] = { total: 0, ordenes: 0 };
      map[day].total += parseFloat(o.total);
      map[day].ordenes += 1;
    }
    return Array.from({ length: daysInMonth }, (_, i) => ({
      dia: i + 1,
      label: String(i + 1),
      total: map[i + 1]?.total ?? 0,
      ordenes: map[i + 1]?.ordenes ?? 0,
    }));
  }, [monthOrders, selectedMonthKey]);

  const hoyData = useMemo(() => {
    const paidToday = metrics.orders.filter(o =>
      (o.payment_status === 'paid' || o.payment_status === 'authorized') &&
      new Date(o.created_at).getTime() >= todayStartMS
    );
    const map: Record<number, { total: number; ordenes: number }> = {};
    for (const o of paidToday) {
      const h = new Date(new Date(o.created_at).getTime() + AR_OFFSET).getUTCHours();
      if (!map[h]) map[h] = { total: 0, ordenes: 0 };
      map[h].total += parseFloat(o.total);
      map[h].ordenes += 1;
    }
    return Array.from({ length: arNow.hour + 1 }, (_, h) => ({
      hora: h,
      label: `${String(h).padStart(2, '0')}hs`,
      total: map[h]?.total ?? 0,
      ordenes: map[h]?.ordenes ?? 0,
    }));
  }, [metrics.orders, todayStartMS, arNow.hour]);

  const semanaData = useMemo(() => {
    const paidWeek = metrics.orders.filter(o =>
      (o.payment_status === 'paid' || o.payment_status === 'authorized') &&
      new Date(o.created_at).getTime() >= weekStartMS
    );
    const todayLun = arNow.dow === 0 ? 6 : arNow.dow - 1;
    const map: Record<number, { total: number; ordenes: number }> = {};
    for (const o of paidWeek) {
      const rawDow = new Date(new Date(o.created_at).getTime() + AR_OFFSET).getUTCDay();
      const lunIdx = rawDow === 0 ? 6 : rawDow - 1;
      if (!map[lunIdx]) map[lunIdx] = { total: 0, ordenes: 0 };
      map[lunIdx].total += parseFloat(o.total);
      map[lunIdx].ordenes += 1;
    }
    return Array.from({ length: todayLun + 1 }, (_, i) => ({
      lunIdx: i,
      label: DIAS_SEMANA[i],
      total: map[i]?.total ?? 0,
      ordenes: map[i]?.ordenes ?? 0,
    }));
  }, [metrics.orders, weekStartMS, arNow.dow]);

  const chartData = activeChart === 'mes' ? mesData : activeChart === 'hoy' ? hoyData : semanaData;

  const isHighlight = (entry: any) => {
    if (activeChart === 'mes') return entry.dia === arNow.day;
    if (activeChart === 'hoy') return entry.hora === arNow.hour;
    if (activeChart === 'semana') {
      const todayLun = arNow.dow === 0 ? 6 : arNow.dow - 1;
      return entry.lunIdx === todayLun;
    }
    return false;
  };

  const [selYear, selMonth] = selectedMonthKey.split('-').map(Number);
  const title =
    activeChart === 'mes' ? `Ventas por día — ${MESES[selMonth - 1]} ${selYear}`
    : activeChart === 'hoy' ? 'Ventas de hoy por hora'
    : 'Ventas esta semana';

  const xInterval = activeChart === 'mes' ? Math.floor(chartData.length / 7) : 0;

  return (
    <div className="fade-in" style={{
      background: 'rgba(255,255,255,0.025)',
      border: '1px solid var(--border-color)',
      borderRadius: 12,
      padding: '1rem 1.25rem 0.75rem',
      marginBottom: '1rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{title}</span>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', padding: '2px 6px', borderRadius: 4,
          display: 'flex', alignItems: 'center',
        }}>
          <X size={15} />
        </button>
      </div>

      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          {activeChart === 'hoy' ? (
            <ComposedChart data={chartData} margin={{ top: 4, right: 36, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#475569', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="left" tickFormatter={fmtK} tick={{ fill: '#475569', fontSize: 11 }} tickLine={false} axisLine={false} width={52} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#475569', fontSize: 11 }} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar yAxisId="left" dataKey="total" radius={[3,3,0,0]} maxBarSize={36}>
                {chartData.map((entry: any, i: number) => (
                  <Cell key={i} fill={isHighlight(entry) ? '#06b6d4' : '#10b981'} fillOpacity={isHighlight(entry) ? 1 : 0.7} />
                ))}
              </Bar>
              <Line yAxisId="right" type="monotone" dataKey="ordenes" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: '#f59e0b' }} activeDot={{ r: 4 }} />
            </ComposedChart>
          ) : (
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: '#475569', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                interval={xInterval}
              />
              <YAxis tickFormatter={fmtK} tick={{ fill: '#475569', fontSize: 11 }} tickLine={false} axisLine={false} width={52} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="total" radius={[3,3,0,0]} maxBarSize={activeChart === 'mes' ? 22 : 48}>
                {chartData.map((entry: any, i: number) => (
                  <Cell key={i} fill={isHighlight(entry) ? '#06b6d4' : '#10b981'} fillOpacity={isHighlight(entry) ? 1 : 0.7} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
