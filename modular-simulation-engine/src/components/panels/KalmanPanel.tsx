// ============================================================
// components/panels/KalmanPanel.tsx
// ============================================================

import React from 'react';
import { Slider }                           from '@/components/ui/Slider';
import { Toggle, SectionHead, InfoBox }     from '@/components/ui/Controls';
import { useSimStore }                      from '@/store/simulationStore';

export const KalmanPanel: React.FC = () => {
  const {
    config, setConfig,
    showTrueTrail,   toggleTrueTrail,
    showKalmanTrail, toggleKalmanTrail,
    showForecast,    toggleForecast,
  } = useSimStore();

  const rVar   = config.rVariance > 0 ? config.rVariance : 0.0001;
  const ratio  = config.qNominal / rVar;
  const pct    = Math.min(100, ratio * 1000); // 0.1 → 100%
  const jitter = ratio > 0.15;
  const lag    = ratio < 0.005;

  const balance =
    lag    ? 'Sensor-dominant: very smooth but slow to follow manoeuvres'
    : jitter ? 'Model-dominant: may jitter when ball is nearly stationary'
    : 'Balanced: good steady-state convergence';
  const barColor =
    jitter ? '#f43f5e' : lag ? '#06b6d4' : '#22c55e';

  return (
    <div>
      <div style={{ fontSize: 10, color: '#475569', marginBottom: 14, lineHeight: 1.7 }}>
        Tune process noise Q and measurement noise R. The Q/R ratio controls the trust balance
        between the physics model and sensor observations.
      </div>

      <Slider
        label="Q Nominal (process noise)"
        value={config.qNominal}
        min={0.001} max={0.2} step={0.001}
        format={(v) => v.toFixed(3)}
        onChange={(v) => setConfig({ qNominal: v })}
        hint="Low Q → smoother, slower · High Q → responsive, may jitter at rest"
        accentColor="#a78bfa"
      />

      {/* Jitter warning */}
      {jitter && (
        <div style={{
          background: '#f43f5e12', border: '1px solid #f43f5e44',
          borderRadius: 5, padding: '6px 9px', marginTop: -6, marginBottom: 12,
          fontSize: 9.5, color: '#f43f5e', lineHeight: 1.5,
        }}>
          ⚠ Q/R &gt; 0.15 — filter may jitter when ball rolls slowly.
          Reduce Q or increase Noise σ on the Sensor tab.
        </div>
      )}

      <Slider
        label="Q Collision boost"
        value={config.qCollision}
        min={0.5} max={20} step={0.5}
        format={(v) => v.toFixed(1)}
        onChange={(v) => setConfig({ qCollision: v })}
        hint="Q inflated to this at wall-hit and Kick — forces fast re-acquisition"
        accentColor="#f59e0b"
      />

      {/* Q/R ratio bar */}
      <InfoBox accent={barColor + '44'}>
        <div style={{ fontSize: 9, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
          Q / R Ratio
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, height: 5, background: '#162840', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${pct}%`,
              background: `linear-gradient(90deg, #0ea5e9, ${barColor})`,
              borderRadius: 3, transition: 'width 0.2s',
            }} />
          </div>
          <code style={{ fontSize: 11, color: '#94a3b8', minWidth: 58, fontFamily: 'monospace' }}>
            {ratio.toFixed(4)}
          </code>
        </div>
        <div style={{ fontSize: 9.5, color: '#475569', marginTop: 5 }}>{balance}</div>
      </InfoBox>

      <SectionHead color="#06b6d4">Visualisation layers</SectionHead>
      <Toggle
        label="True Trajectory"
        value={showTrueTrail}
        onChange={toggleTrueTrail}
        color="#22c55e"
        sublabel="Green — ground-truth physics path (click to toggle)"
      />
      <Toggle
        label="Kalman Trajectory"
        value={showKalmanTrail}
        onChange={toggleKalmanTrail}
        color="#06b6d4"
        sublabel="Cyan — filter state estimate path (click to toggle)"
      />
      <Toggle
        label="Forecast Ghost"
        value={showForecast}
        onChange={toggleForecast}
        color="#f59e0b"
        sublabel="Amber dashed — 1-second predictive lookahead"
      />

      {/* Visual confirmation of current layer states */}
      <div style={{ display: 'flex', gap: 5, marginTop: 8 }}>
        {[
          { label: 'True', color: '#22c55e',  on: showTrueTrail   },
          { label: 'KF',   color: '#06b6d4',  on: showKalmanTrail },
          { label: 'Fcst', color: '#f59e0b',  on: showForecast    },
        ].map(({ label, color, on }) => (
          <div key={label} style={{
            flex: 1, textAlign: 'center', fontSize: 9, fontWeight: 700,
            padding: '3px 0', borderRadius: 4,
            background: on ? color + '22' : '#0d1f35',
            color: on ? color : '#334155',
            border: `1px solid ${on ? color + '55' : '#1e3a5f'}`,
            transition: 'all 0.18s',
          }}>
            {on ? '● ' : '○ '}{label}
          </div>
        ))}
      </div>
    </div>
  );
};
