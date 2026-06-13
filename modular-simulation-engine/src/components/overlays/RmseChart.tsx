// ============================================================
// components/overlays/RmseChart.tsx — Recharts v3 compatible
// ============================================================

import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, CartesianGrid, ReferenceLine,
} from 'recharts';
import { useSimStore } from '@/store/simulationStore';
import type { ChartPoint } from '@/types';

// ── Tooltip ───────────────────────────────────────────────────
interface TPayload { color: string; name: string; value: number | null; }
const KFTooltip: React.FC<{ active?: boolean; payload?: TPayload[]; label?: number }> = (
  { active, payload, label },
) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#060d1a', border: '1px solid #2d4a6e',
      borderRadius: 6, padding: '7px 11px', fontSize: 11,
      boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
    }}>
      <div style={{ color: '#475569', marginBottom: 4, fontSize: 10 }}>Frame {label}</div>
      {payload.map((p) => p.value != null && (
        <div key={p.name} style={{ color: p.color, display: 'flex', justifyContent: 'space-between', gap: 14 }}>
          <span>{p.name}</span>
          <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{p.value.toFixed(3)}</span>
        </div>
      ))}
    </div>
  );
};

const EmptyState: React.FC = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#1e3a5f', fontSize: 11, gap: 6 }}>
    <span style={{ opacity: 0.5 }}>◌</span> Awaiting simulation data…
  </div>
);

const AXIS_TICK  = { fontSize: 9, fill: '#3b5c87' };
const AXIS_LINE  = { stroke: '#1e3a5f' };
const GRID_STYLE = { stroke: '#0d2035', strokeDasharray: '3 3' as const };
const CHART_MARGIN = { top: 5, right: 8, left: -18, bottom: 0 };

// ── RMSE chart ────────────────────────────────────────────────
export const RmseChart: React.FC = () => {
  const chartHistory = useSimStore((s) => s.chartHistory);
  if (chartHistory.length < 3) return <EmptyState />;
  const last = chartHistory[chartHistory.length - 1] as ChartPoint;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartHistory} margin={CHART_MARGIN}>
        <CartesianGrid {...GRID_STYLE} />
        <XAxis dataKey="frame" tick={AXIS_TICK} tickLine={false} axisLine={AXIS_LINE} interval="preserveStartEnd" />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={AXIS_LINE} tickFormatter={(v: number) => v.toFixed(1)} width={36} />
        <Tooltip content={<KFTooltip />} />
        <Legend wrapperStyle={{ fontSize: 9, paddingTop: 2 }} formatter={(v: string) => <span style={{ color: '#64748b' }}>{v}</span>} />
        {last.kalman > 0 && (
          <ReferenceLine y={last.kalman} stroke="#06b6d4" strokeDasharray="2 4" strokeOpacity={0.25} />
        )}
        {/* Sensor line behind Kalman */}
        <Line type="monotone" dataKey="sensor"  name="Sensor RMSE" stroke="#f43f5e" strokeWidth={1.2} dot={false} strokeDasharray="5 2" isAnimationActive={false} connectNulls={false} />
        <Line type="monotone" dataKey="kalman"  name="Kalman RMSE" stroke="#06b6d4" strokeWidth={2}   dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
};

// ── Covariance chart ──────────────────────────────────────────
export const CovarianceChart: React.FC = () => {
  const chartHistory = useSimStore((s) => s.chartHistory);
  if (chartHistory.length < 3) return <EmptyState />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartHistory} margin={CHART_MARGIN}>
        <CartesianGrid {...GRID_STYLE} />
        <XAxis dataKey="frame" tick={AXIS_TICK} tickLine={false} axisLine={AXIS_LINE} interval="preserveStartEnd" />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={AXIS_LINE} tickFormatter={(v: number) => v.toFixed(0)} width={36} />
        <Tooltip content={<KFTooltip />} />
        <Legend wrapperStyle={{ fontSize: 9, paddingTop: 2 }} formatter={(v: string) => <span style={{ color: '#64748b' }}>{v}</span>} />
        <Line type="monotone" dataKey="covariance" name="tr(P)" stroke="#a78bfa" strokeWidth={1.5} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
};
