// ============================================================
// components/panels/SensorPanel.tsx
// ============================================================

import React from 'react';
import { Slider }                           from '@/components/ui/Slider';
import { Toggle, SectionHead, InfoBox }     from '@/components/ui/Controls';
import { useSimStore }                      from '@/store/simulationStore';
import { BALL_RADIUS }                      from '@/constants/defaults';

export const SensorPanel: React.FC = () => {
  const { config, setConfig, showSensor, toggleSensor, spikeInjection, toggleSpikeInjection } = useSimStore();

  const sigmaRatio    = config.noiseStdDev / BALL_RADIUS;
  const outlierRadius = config.noiseStdDev * 8;

  return (
    <div>
      <div style={{ fontSize: 10, color: '#475569', marginBottom: 14, lineHeight: 1.7 }}>
        Emulates non-ideal hardware: downsampling, Gaussian noise injection, and random packet loss.
      </div>

      {/* Noise σ — range calibrated to ball size */}
      <Slider
        label="Noise σ"
        value={config.noiseStdDev}
        min={0.05}
        max={2.0}
        step={0.05}
        unit=" m"
        format={(v) => v.toFixed(2)}
        onChange={(v) => setConfig({ noiseStdDev: v, rVariance: parseFloat((v * v).toFixed(6)) })}
        hint={`${sigmaRatio.toFixed(2)}× ball radius  ·  R = σ² = ${(config.noiseStdDev**2).toFixed(4)}`}
        accentColor="#f43f5e"
      />

      {/* σ / ball-size ratio indicator */}
      <div style={{ marginTop: -8, marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {[
            { label: 'Ideal',   lo: 0,    hi: 0.3,  color: '#22c55e' },
            { label: 'Good',    lo: 0.3,  hi: 0.75, color: '#38bdf8' },
            { label: 'Noisy',   lo: 0.75, hi: 1.5,  color: '#f59e0b' },
            { label: 'Extreme', lo: 1.5,  hi: Infinity, color: '#f43f5e' },
          ].map(({ label, lo, hi, color }) => {
            const active = sigmaRatio >= lo && sigmaRatio < hi;
            return (
              <div key={label} style={{
                flex: 1, textAlign: 'center', fontSize: 9, fontWeight: 600,
                padding: '2px 0', borderRadius: 3,
                background: active ? color + '30' : '#0d1f35',
                color: active ? color : '#334155',
                border: `1px solid ${active ? color + '55' : '#1e3a5f'}`,
                transition: 'all 0.2s',
              }}>
                {label}
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 9, color: '#334155', marginTop: 3 }}>
          σ / ball radius = {sigmaRatio.toFixed(2)}×
        </div>
      </div>

      <Slider
        label="Sample Interval"
        value={config.sampleInterval}
        min={1} max={12} step={1}
        unit=" frames"
        onChange={(v) => setConfig({ sampleInterval: Math.round(v) })}
        hint="1 = every frame (full-rate)  ·  12 = sparse sensor"
        accentColor="#94a3b8"
      />
      <Slider
        label="Packet Drop Rate"
        value={config.dropRate}
        min={0} max={0.85} step={0.05}
        format={(v) => `${(v * 100).toFixed(0)}%`}
        onChange={(v) => setConfig({ dropRate: v })}
        hint="Probability a scheduled sample is silently discarded"
        accentColor="#f97316"
      />

      <SectionHead>Visual toggles</SectionHead>
      <Toggle
        label="Show Sensor Markers"
        value={showSensor}
        onChange={toggleSensor}
        color="#f43f5e"
        sublabel="Red octahedra — rendered on top of all objects"
      />
      <Toggle
        label="Gross Outlier Injection"
        value={spikeInjection}
        onChange={toggleSpikeInjection}
        color="#f97316"
        sublabel="3 % chance per sample — 8σ spike, orange ring persists ~0.75 s"
      />

      {/* Spike explanation when enabled */}
      {spikeInjection && (
        <InfoBox accent="#f9741655">
          <div style={{ fontSize: 9, color: '#f97316', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>
            ⬡ Outlier injection active
          </div>
          <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.65 }}>
            When a spike fires, an <strong style={{ color: '#f97316' }}>orange ring marker</strong> appears
            at the outlier position and fades over ~0.75 s.
            Current 8σ radius ≈ <strong style={{ color: '#94a3b8' }}>{outlierRadius.toFixed(1)} m</strong>.
            The Kalman filter should absorb the spike with minimal state error.
          </div>
        </InfoBox>
      )}

      <InfoBox accent="#f43f5e22">
        <div style={{ fontSize: 9, color: '#64748b', marginBottom: 4, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Configured R Matrix
        </div>
        <code style={{ fontFamily: 'monospace', fontSize: 10.5, color: '#94a3b8', lineHeight: 1.8 }}>
          diag([σ², σ², σ²]) = diag([{(config.noiseStdDev**2).toFixed(4)},{' '}
          {(config.noiseStdDev**2).toFixed(4)},{' '}
          {(config.noiseStdDev**2).toFixed(4)}])
        </code>
      </InfoBox>
    </div>
  );
};
