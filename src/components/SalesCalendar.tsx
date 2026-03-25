import { useMemo, useState } from 'react';
import './SalesCalendar.css';

interface Props {
  ventasPorDia: { name: string; value: number }[];
}

const DAYS_ES   = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                   'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const fmtMoney = (v: number) =>
  '$' + v.toLocaleString('es-AR', { maximumFractionDigits: 0 });

/** Monday-based day of week: Mon=0 … Sun=6 */
function dowAR(date: Date) {
  return (date.getDay() + 6) % 7;
}

function toKey(d: number, m: number, y: number) {
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

export default function SalesCalendar({ ventasPorDia }: Props) {
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  // Build date → sales map — handles "YYYY-MM-DD" (ISO) and "D/M/YYYY"
  const salesMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const { name, value } of ventasPorDia) {
      let key: string | null = null;
      const iso = name.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (iso) {
        key = `${iso[1]}-${iso[2]}-${iso[3]}`;
      } else {
        const p = name.split('/');
        if (p.length === 3) {
          const d = parseInt(p[0]), m = parseInt(p[1]), y = parseInt(p[2]);
          if (!isNaN(d) && !isNaN(m) && !isNaN(y)) key = toKey(d, m, y);
        }
      }
      if (key) map.set(key, (map.get(key) ?? 0) + value);
    }
    return map;
  }, [ventasPorDia]);

  const maxValue = useMemo(() => Math.max(0, ...salesMap.values()), [salesMap]);

  // Last 3 months
  const today = new Date();
  const months = useMemo(() => {
    return Array.from({ length: 3 }, (_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth() - (2 - i), 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }, []);

  function level(value: number) {
    if (!value || !maxValue) return 0;
    const r = value / maxValue;
    if (r < 0.2)  return 1;
    if (r < 0.45) return 2;
    if (r < 0.7)  return 3;
    return 4;
  }

  function renderMonth(year: number, month: number) {
    const firstDay    = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startDow    = dowAR(firstDay);

    const cells: (number | null)[] = [
      ...Array(startDow).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);

    return (
      <div key={`${year}-${month}`} className="cal-month">
        <div className="cal-month-title">{MONTHS_ES[month]} {year}</div>
        <div className="cal-grid">
          {DAYS_ES.map((d, i) => (
            <div key={i} className="cal-day-label">{d}</div>
          ))}
          {cells.map((day, i) => {
            if (day === null) return <div key={i} className="cal-cell cal-empty" />;

            const key = toKey(day, month + 1, year);
            const val = salesMap.get(key) ?? 0;
            const lv  = level(val);
            const isToday =
              day === today.getDate() &&
              month === today.getMonth() &&
              year === today.getFullYear();
            const isFuture =
              new Date(year, month, day) > today;

            return (
              <div
                key={i}
                className={[
                  'cal-cell',
                  `cal-l${lv}`,
                  isToday  ? 'cal-today'  : '',
                  isFuture ? 'cal-future' : '',
                ].join(' ')}
                onMouseEnter={e => {
                  if (isFuture) return;
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setTooltip({
                    text: val > 0
                      ? `${day}/${month + 1}: ${fmtMoney(val)}`
                      : `${day}/${month + 1}: Sin ventas`,
                    x: r.left + r.width / 2,
                    y: r.top,
                  });
                }}
                onMouseLeave={() => setTooltip(null)}
              >
                <span className="cal-day-num">{day}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="sales-calendar glass-panel">
      <div className="cal-header">
        <h3>Calendario de ventas</h3>
        <div className="cal-legend">
          <span className="cal-legend-label">Menos</span>
          {[0, 1, 2, 3, 4].map(l => <div key={l} className={`cal-legend-dot cal-l${l}`} />)}
          <span className="cal-legend-label">Más</span>
        </div>
      </div>
      <div className="cal-months">
        {months.map(({ year, month }) => renderMonth(year, month))}
      </div>
      {tooltip && (
        <div
          className="cal-tooltip"
          style={{ left: tooltip.x, top: tooltip.y - 8 }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
