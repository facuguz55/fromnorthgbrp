import React, { useEffect, useRef, useState } from 'react';
import './MetricCard.css';

interface MetricCardProps {
  title: string;
  value: string | number;
  trend?: number;
  icon: React.ReactNode;
  subtitle?: string;
}

function useCountUp(target: number, duration = 800): number {
  const [current, setCurrent] = useState(0);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const prevTargetRef = useRef<number>(0);

  useEffect(() => {
    if (target === prevTargetRef.current) return;
    prevTargetRef.current = target;
    const from = current;
    startRef.current = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(from + (target - from) * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return current;
}

function AnimatedValue({ raw }: { raw: string }) {
  const arsMatch = raw.match(/^\$\s?([\d.,]+)/);
  const numMatch = !arsMatch && raw.match(/^[\d.,]+$/);

  if (arsMatch) {
    const num = parseFloat(arsMatch[1].replace(/\./g, '').replace(',', '.'));
    const animated = useCountUp(isNaN(num) ? 0 : num);
    return <>{raw.replace(arsMatch[1], animated.toLocaleString('es-AR'))}</>;
  }

  if (numMatch) {
    const num = parseFloat(raw.replace(/\./g, '').replace(',', '.'));
    const animated = useCountUp(isNaN(num) ? 0 : num);
    return <>{animated.toLocaleString('es-AR')}</>;
  }

  return <>{raw}</>;
}

export default function MetricCard({ title, value, trend, icon, subtitle }: MetricCardProps) {
  const isPositive = trend !== undefined && trend > 0;
  const isNegative = trend !== undefined && trend < 0;
  const strValue = String(value);

  return (
    <div className="metric-card glass-panel">
      <div className="metric-header">
        <h3 className="metric-title">{title}</h3>
        <div className="metric-icon">{icon}</div>
      </div>
      <div className="metric-body">
        <div className="metric-value">
          <AnimatedValue raw={strValue} />
        </div>
        {subtitle && <div className="metric-subtitle">{subtitle}</div>}
        {trend !== undefined && (
          <div className={`metric-trend ${isPositive ? 'trend-up' : isNegative ? 'trend-down' : 'trend-neutral'}`}>
            {isPositive ? '+' : ''}{trend}%
            <span className="trend-label"> from last month</span>
          </div>
        )}
      </div>
    </div>
  );
}
