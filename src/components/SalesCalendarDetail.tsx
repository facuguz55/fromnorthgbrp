import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, TrendingUp, Calendar, BarChart2, Award } from 'lucide-react';
import './SalesCalendarDetail.css';

interface Props {
  ventasPorDia: { name: string; value: number }[];
}

const DAYS_ES   = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                   'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const fmtMoney = (v: number) =>
  '$' + v.toLocaleString('es-AR', { maximumFractionDigits: 0 });

function dowAR(date: Date) { return (date.getDay() + 6) % 7; }

function toKey(d: number, m: number, y: number) {
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

function parseSalesMap(data: { name: string; value: number }[]) {
  const map = new Map<string, number>();
  for (const { name, value } of data) {
    let key: string | null = null;
    const iso = name.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) { key = `${iso[1]}-${iso[2]}-${iso[3]}`; }
    else {
      const p = name.split('/');
      if (p.length === 3) {
        const d = parseInt(p[0]), m = parseInt(p[1]), y = parseInt(p[2]);
        if (!isNaN(d) && !isNaN(m) && !isNaN(y)) key = toKey(d, m, y);
      }
    }
    if (key) map.set(key, (map.get(key) ?? 0) + value);
  }
  return map;
}

function buildCells(year: number, month: number) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDow = dowAR(new Date(year, month, 1));
  const cells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return { cells, daysInMonth };
}

interface MonthGridProps {
  year: number;
  month: number;
  salesMap: Map<string, number>;
  maxValue: number;
  today: Date;
}

function level(value: number, maxValue: number) {
  if (!value || !maxValue) return 0;
  const r = value / maxValue;
  if (r < 0.15) return 1;
  if (r < 0.4)  return 2;
  if (r < 0.7)  return 3;
  return 4;
}

function MonthGrid({ year, month, salesMap, maxValue, today }: MonthGridProps) {
  const { cells } = buildCells(year, month);
  return (
    <div className="cal-detail-grid">
      {DAYS_ES.map((d, i) => (
        <div key={i} className="cal-detail-day-label">{d}</div>
      ))}
      {cells.map((day, i) => {
        if (day === null) return <div key={i} className="cal-detail-cell cal-detail-empty" />;
        const key     = toKey(day, month + 1, year);
        const val     = salesMap.get(key) ?? 0;
        const lv      = level(val, maxValue);
        const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
        const isFuture = new Date(year, month, day) > today;
        return (
          <div
            key={i}
            className={['cal-detail-cell', `cal-dl${lv}`,
              isToday ? 'cal-detail-today' : '',
              isFuture ? 'cal-detail-future' : '',
            ].filter(Boolean).join(' ')}
            title={isFuture ? '' : val > 0 ? fmtMoney(val) : 'Sin ventas'}
          >
            <span className="cal-detail-num">{day}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function SalesCalendarDetail({ ventasPorDia }: Props) {
  const today = new Date();
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  // Previous month
  const prevYear  = viewMonth === 0 ? viewYear - 1 : viewYear;
  const prevMonthIdx = viewMonth === 0 ? 11 : viewMonth - 1;

  const salesMap = useMemo(() => parseSalesMap(ventasPorDia), [ventasPorDia]);
  const maxValue = useMemo(() => Math.max(0, ...salesMap.values()), [salesMap]);
  const { daysInMonth } = buildCells(viewYear, viewMonth);

  // Stats for current (right) month
  const stats = useMemo(() => {
    const days: { day: number; val: number }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const val = salesMap.get(toKey(d, viewMonth + 1, viewYear)) ?? 0;
      days.push({ day: d, val });
    }
    const withSales = days.filter(d => d.val > 0);
    const total     = days.reduce((s, d) => s + d.val, 0);
    const avgActive = withSales.length > 0 ? total / withSales.length : 0;
    const best      = days.reduce((a, b) => b.val > a.val ? b : a, { day: 0, val: 0 });
    const top5      = [...days].sort((a, b) => b.val - a.val).slice(0, 5).filter(d => d.val > 0);
    return { total, avgActive, best, activeDays: withSales.length, top5, totalDays: daysInMonth };
  }, [salesMap, viewYear, viewMonth, daysInMonth]);

  function goPrev() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function goNext() {
    if (viewYear * 12 + viewMonth >= today.getFullYear() * 12 + today.getMonth()) return;
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();

  return (
    <div className="cal-detail">
      <div className="cal-detail-layout">

        {/* ── Calendars ── */}
        <div className="cal-detail-calendars">

          {/* Nav header spanning both months */}
          <div className="cal-detail-header">
            <button className="cal-nav-btn" onClick={goPrev}>
              <ChevronLeft size={18} />
            </button>
            <div className="cal-detail-titles">
              <h3 className="cal-detail-title cal-title-muted">
                {MONTHS_ES[prevMonthIdx]} {prevYear}
              </h3>
              <h3 className="cal-detail-title">
                {MONTHS_ES[viewMonth]} {viewYear}
              </h3>
            </div>
            <button className="cal-nav-btn" onClick={goNext} disabled={isCurrentMonth}>
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="cal-detail-legend">
            <span className="cal-legend-label">Sin ventas</span>
            {[1,2,3,4].map(l => <div key={l} className={`cal-detail-legend-dot cal-dl${l}`} />)}
            <span className="cal-legend-label">Máximo</span>
          </div>

          <div className="cal-two-months">
            <div className="cal-month-block glass-panel">
              <MonthGrid year={prevYear} month={prevMonthIdx} salesMap={salesMap} maxValue={maxValue} today={today} />
            </div>
            <div className="cal-month-block glass-panel">
              <MonthGrid year={viewYear} month={viewMonth} salesMap={salesMap} maxValue={maxValue} today={today} />
            </div>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="cal-detail-right">

          <div className="cal-stat-card">
            <div className="cal-stat-icon"><TrendingUp size={15} /></div>
            <div>
              <div className="cal-stat-label">Total del mes</div>
              <div className="cal-stat-value">{fmtMoney(stats.total)}</div>
            </div>
          </div>

          <div className="cal-stat-card">
            <div className="cal-stat-icon"><BarChart2 size={15} /></div>
            <div>
              <div className="cal-stat-label">Promedio por día activo</div>
              <div className="cal-stat-value">{fmtMoney(stats.avgActive)}</div>
            </div>
          </div>

          <div className="cal-stat-card">
            <div className="cal-stat-icon"><Calendar size={15} /></div>
            <div>
              <div className="cal-stat-label">Días con ventas</div>
              <div className="cal-stat-value">
                {stats.activeDays} <span className="cal-stat-sub">/ {stats.totalDays}</span>
              </div>
            </div>
          </div>

          {stats.best.val > 0 && (
            <div className="cal-stat-card cal-stat-highlight">
              <div className="cal-stat-icon cal-stat-icon--gold"><Award size={15} /></div>
              <div>
                <div className="cal-stat-label">Mejor día</div>
                <div className="cal-stat-value">{fmtMoney(stats.best.val)}</div>
                <div className="cal-stat-date">
                  {stats.best.day}/{viewMonth + 1}/{viewYear}
                </div>
              </div>
            </div>
          )}

          {stats.top5.length > 0 && (
            <div className="cal-top5">
              <div className="cal-top5-title">Top días</div>
              {stats.top5.map((d, i) => (
                <div key={d.day} className="cal-top5-row">
                  <span className={`cal-top5-pos pos-${i + 1}`}>{i + 1}</span>
                  <span className="cal-top5-date">
                    {String(d.day).padStart(2,'0')}/{String(viewMonth+1).padStart(2,'0')}
                  </span>
                  <div className="cal-top5-bar-wrap">
                    <div
                      className="cal-top5-bar"
                      style={{ width: `${Math.round((d.val / stats.best.val) * 100)}%` }}
                    />
                  </div>
                  <span className="cal-top5-val">{fmtMoney(d.val)}</span>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
