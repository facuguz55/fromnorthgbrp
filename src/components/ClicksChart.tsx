import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

import './Chart.css';

interface ChartDataPoint {
  name: string;
  value: number;
}

interface ClicksChartProps {
  data: ChartDataPoint[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="chart-tooltip">
        <p className="chart-tooltip-label">{label}</p>
        <p className="chart-tooltip-value" style={{ color: '#818cf8' }}>
          {Number(payload[0].value).toLocaleString('es-AR')}
        </p>
        <p className="chart-tooltip-sub">clicks registrados</p>
      </div>
    );
  }
  return null;
};

const formatXTick = (value: string) => {
  if (!value) return '';
  const parts = value.split('/');
  if (parts.length >= 2) return `${parts[0]}/${parts[1]}`;
  const timeParts = value.split(' ');
  if (timeParts.length === 2) {
    const t = timeParts[1].split(':');
    return `${t[0]}:${t[1]}`;
  }
  return value;
};

export default function ClicksChart({ data }: ClicksChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="chart-container glass-panel">
        <div className="chart-header">
          <div className="chart-header-row">
            <span className="chart-title">Clicks de seguimiento por Día</span>
          </div>
          <span className="chart-subtitle">Actividad de clics registrada</span>
        </div>
        <div className="chart-empty">
          <span>Sin datos disponibles</span>
        </div>
      </div>
    );
  }

  const maxVal = Math.max(...data.map(d => d.value));

  return (
    <div className="chart-container glass-panel fade-in" style={{ animationDelay: '0.2s' }}>
      <div className="chart-header">
        <div className="chart-header-row">
          <span className="chart-title">Clicks de seguimiento por Día</span>
          <span className="chart-badge bg-indigo">Rendimiento</span>
        </div>
        <span className="chart-subtitle">Actividad de clics en el período atual</span>
      </div>

      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} barSize={20}>
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
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: 'rgba(99,102,241,0.07)', radius: 6 } as any}
            />
            <Bar dataKey="value" radius={[5, 5, 0, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.value === maxVal ? '#818cf8' : 'rgba(99,102,241,0.55)'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
