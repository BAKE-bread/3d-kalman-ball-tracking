// ============================================================
// components/overlays/RmseChart.tsx
// Live RMSE chart rendered over the viewport via Recharts.
// ============================================================

import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, CartesianGrid
} from 'recharts';
import { useSimStore } from '@/store/simulationStore';

const CustomTooltip: React.FC<{ active?: boolean; payload?: Array<{ color: string; name: string; value: number | null }>; label?: number }> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#0f172a', border: '1px solid #1e3a5f', borderRadius: 6,
      padding: '6px 10px', fontSize: 11
    }}>
      <div style={{ color: '#64748b', marginBottom: 3 }}>Frame {label}</div>
      {payload.map((p) => p.value != null && (
        <div key={p.name} style={{ color: p.color }}>
          {p.name}: {p.value.toFixed(3)} m
        </div>
      ))}
    </div>
  );
};

export const RmseChart: React.FC = () => {
  const chartHistory = useSimStore((s) => s.chartHistory);

  if (chartHistory.length < 3) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: '#334155', fontSize: 11
      }}>
        Awaiting data…
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartHistory} margin={{ top: 4, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid stroke="#1e3a5f" strokeDasharray="3 3" />
        <XAxis
          dataKey="frame"
          tick={{ fontSize: 9, fill: '#475569' }}
          tickLine={false}
          axisLine={{ stroke: '#1e3a5f' }}
        />
        <YAxis
          tick={{ fontSize: 9, fill: '#475569' }}
          tickLine={false}
          axisLine={{ stroke: '#1e3a5f' }}
          tickFormatter={(v) => v.toFixed(1)}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 10, color: '#64748b' }}
          formatter={(v) => <span style={{ color: '#94a3b8' }}>{v}</span>}
        />
        <Line
          type="monotone" dataKey="kalman" name="Kalman RMSE"
          stroke="#06b6d4" strokeWidth={2} dot={false}
          isAnimationActive={false}
        />
        <Line
          type="monotone" dataKey="sensor" name="Sensor RMSE"
          stroke="#f43f5e" strokeWidth={1.5} dot={false}
          strokeDasharray="4 2"
          isAnimationActive={false}
          connectNulls={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

// ── Covariance trace chart ──────────────────────────────────
export const CovarianceChart: React.FC = () => {
  const chartHistory = useSimStore((s) => s.chartHistory);

  if (chartHistory.length < 3) return null;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartHistory} margin={{ top: 4, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid stroke="#1e3a5f" strokeDasharray="3 3" />
        <XAxis dataKey="frame" tick={{ fontSize: 9, fill: '#475569' }} tickLine={false} axisLine={{ stroke: '#1e3a5f' }} />
        <YAxis tick={{ fontSize: 9, fill: '#475569' }} tickLine={false} axisLine={{ stroke: '#1e3a5f' }} tickFormatter={(v) => v.toFixed(0)} />
        <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e3a5f', borderRadius: 6, fontSize: 11 }} />
        <Line type="monotone" dataKey="covariance" name="tr(P)" stroke="#a78bfa" strokeWidth={1.5} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
};
