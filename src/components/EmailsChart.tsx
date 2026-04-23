import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

import './Chart.css';

interface ChartDataPoint {
  name: string;
  value: number;
}

interface EmailsChartProps {
  data: ChartDataPoint[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="chart-tooltip">
        <p className="chart-tooltip-label">{label}</p>
        <p className="chart-tooltip-value" style={{ color: '#06b6d4' }}>
          {Number(payload[0].value).toLocaleString('es-AR')}
        </p>
        <p className="chart-tooltip-sub">seguimientos enviados</p>
      </div>
    );
  }
  return null;
};

const formatXTick = (value: string) => {
  if (!value) return '';
  // Format "10/3/2026" -> "10/3"
  const parts = value.split('/');
  if (parts.length >= 2) return `${parts[0]}/${parts[1]}`;
  return value;
};

export default function EmailsChart({ data }: EmailsChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="chart-container glass-panel">
        <div className="chart-header">
          <div className="chart-header-row">
            <span className="chart-title">Seguimientos por Día</span>
          </div>
          <span className="chart-subtitle">Seguimientos registrados por fecha</span>
        </div>
        <div className="chart-empty">
          <span>Sin datos disponibles</span>
        </div>
      </div>
    );
  }

  return (
    <div className="chart-container glass-panel fade-in" style={{ animationDelay: '0.1s' }}>
      <div className="chart-header">
        <div className="chart-header-row">
          <span className="chart-title">Seguimientos por Día</span>
          <span className="chart-badge">Actividad</span>
        </div>
        <span className="chart-subtitle">Evolución de seguimientos en el período</span>
      </div>

      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorEmails" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.45}/>
                <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.02}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis
              dataKey="name"
              tickFormatter={formatXTick}
              stroke="transparent"
              tick={{ fill: '#475569', fontSize: 11, fontFamily: 'Inter, sans-serif' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              stroke="transparent"
              tick={{ fill: '#475569', fontSize: 11, fontFamily: 'Inter, sans-serif' }}
              tickLine={false}
              axisLine={false}
              width={36}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(6,182,212,0.3)', strokeWidth: 1, strokeDasharray: '4 4' }} />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#06b6d4"
              strokeWidth={2.5}
              fill="url(#colorEmails)"
              dot={false}
              activeDot={{ r: 5, fill: '#06b6d4', stroke: '#0b0f19', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
