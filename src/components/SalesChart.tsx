import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

import './Chart.css';

interface ChartDataPoint {
  name: string;
  value: number;
  inversion?: number;
}

interface SalesChartProps {
  data: ChartDataPoint[];
}

const formatMoney = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n}`;

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-label">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="chart-tooltip-value" style={{ color: p.color }}>
          {p.dataKey === 'value' ? 'Ventas' : 'Inversión Meta'}:{' '}
          ${Number(p.value).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
        </p>
      ))}
    </div>
  );
};

export default function SalesChart({ data }: SalesChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="chart-container glass-panel">
        <div className="chart-header">
          <div className="chart-header-row">
            <span className="chart-title">Ventas por Día</span>
          </div>
          <span className="chart-subtitle">Ingresos diarios registrados</span>
        </div>
        <div className="chart-empty">
          <span>Sin datos disponibles</span>
        </div>
      </div>
    );
  }

  const hasMetaData = data.some(d => d.inversion !== undefined && d.inversion > 0);

  return (
    <div className="chart-container glass-panel fade-in" style={{ animationDelay: '0.3s' }}>
      <div className="chart-header">
        <div className="chart-header-row">
          <span className="chart-title">Ventas por Día</span>
          <span className="chart-badge">Ingresos</span>
        </div>
        <span className="chart-subtitle">
          {hasMetaData ? 'Ventas vs Inversión Meta Ads' : 'Evolución de ventas en el período actual'}
        </span>
      </div>

      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: hasMetaData ? 48 : 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.5}/>
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.02}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis
              dataKey="name"
              stroke="transparent"
              tick={{ fill: '#475569', fontSize: 11, fontFamily: 'Inter, sans-serif' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            {/* Eje izquierdo: ventas */}
            <YAxis
              yAxisId="ventas"
              tickFormatter={formatMoney}
              stroke="transparent"
              tick={{ fill: '#475569', fontSize: 11, fontFamily: 'Inter, sans-serif' }}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            {/* Eje derecho: inversión Meta (solo si hay datos) */}
            {hasMetaData && (
              <YAxis
                yAxisId="meta"
                orientation="right"
                tickFormatter={formatMoney}
                stroke="transparent"
                tick={{ fill: '#475569', fontSize: 11, fontFamily: 'Inter, sans-serif' }}
                tickLine={false}
                axisLine={false}
                width={48}
              />
            )}
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(16,185,129,0.3)', strokeWidth: 1, strokeDasharray: '4 4' }} />
            {hasMetaData && (
              <Legend
                wrapperStyle={{ fontSize: '11px', color: '#475569', paddingTop: '8px' }}
                formatter={(value) => value === 'value' ? 'Ventas' : 'Inversión Meta'}
              />
            )}
            <Area
              yAxisId="ventas"
              type="monotone"
              dataKey="value"
              stroke="#10b981"
              strokeWidth={2.5}
              fill="url(#colorSales)"
              dot={false}
              activeDot={{ r: 5, fill: '#10b981', stroke: '#0b0f19', strokeWidth: 2 }}
            />
            {hasMetaData && (
              <Line
                yAxisId="meta"
                type="monotone"
                dataKey="inversion"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: '#f59e0b', stroke: '#0b0f19', strokeWidth: 2 }}
                strokeDasharray="5 3"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
