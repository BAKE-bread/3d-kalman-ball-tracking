// ============================================================
// components/panels/KalmanPanel.tsx
// ============================================================

import React from 'react';
import { Slider } from '@/components/ui/Slider';
import { Toggle } from '@/components/ui/Controls';
import { useSimStore } from '@/store/simulationStore';

export const KalmanPanel: React.FC = () => {
  const { config, setConfig, showTrueTrail, toggleTrueTrail, showKalmanTrail, toggleKalmanTrail, showForecast, toggleForecast } = useSimStore();

  return (
    <div>
      <div style={{ fontSize: 10, color: '#475569', marginBottom: 14, lineHeight: 1.6 }}>
        Tune the Kalman filter covariance matrices. These govern the trust balance between physics model and sensor observations.
      </div>

      <Slider
        label="Q Nominal (process noise)"
        value={config.qNominal}
        min={0.001} max={0.5} step={0.005}
        format={(v) => v.toFixed(3)}
        onChange={(v) => setConfig({ qNominal: v })}
        hint="Low Q → smooth trajectory, slow response. High Q → responsive, noisier"
      />
      <Slider
        label="Q Collision (adaptive boost)"
        value={config.qCollision}
        min={0.5} max={20} step={0.5}
        format={(v) => v.toFixed(1)}
        onChange={(v) => setConfig({ qCollision: v })}
        hint="Q inflated to this when wall-hit detected — forces fast re-acquisition"
      />

      {/* Live Q/R ratio indicator */}
      <div style={{
        background: '#0f172a', borderRadius: 6, padding: '8px 10px',
        marginBottom: 14, border: '1px solid #1e3a5f'
      }}>
        <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Q/R Ratio
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            flex: 1, height: 6, background: '#1e3a5f', borderRadius: 3, overflow: 'hidden'
          }}>
            <div style={{
              height: '100%', borderRadius: 3,
              width: `${Math.min(100, (config.qNominal / config.rVariance) * 500)}%`,
              background: 'linear-gradient(90deg, #0ea5e9, #22c55e)',
              transition: 'width 0.2s',
            }} />
          </div>
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#94a3b8', minWidth: 50 }}>
            {(config.qNominal / config.rVariance).toFixed(4)}
          </span>
        </div>
        <div style={{ fontSize: 10, color: '#475569', marginTop: 3 }}>
          {config.qNominal / config.rVariance < 0.01
            ? 'Sensor-dominant: tight tracking, lag on manoeuvres'
            : config.qNominal / config.rVariance > 0.2
            ? 'Model-dominant: responsive but noisy estimate'
            : 'Balanced: good steady-state convergence'}
        </div>
      </div>

      <div style={{ borderTop: '1px solid #1e3a5f', paddingTop: 12 }}>
        <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Visualisation Layers
        </div>
        <Toggle label="True Trajectory" value={showTrueTrail} onChange={toggleTrueTrail} color="#22c55e" sublabel="Green — ground-truth physics path" />
        <Toggle label="Kalman Trajectory" value={showKalmanTrail} onChange={toggleKalmanTrail} color="#06b6d4" sublabel="Cyan — filter state estimate path" />
        <Toggle label="Forecast Ghost" value={showForecast} onChange={toggleForecast} color="#f59e0b" sublabel="Yellow dashed — 1-second predictive lookahead" />
      </div>
    </div>
  );
};
