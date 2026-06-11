// ============================================================
// components/panels/SensorPanel.tsx
// ============================================================

import React from 'react';
import { Slider } from '@/components/ui/Slider';
import { Toggle } from '@/components/ui/Controls';
import { useSimStore } from '@/store/simulationStore';

export const SensorPanel: React.FC = () => {
  const { config, setConfig, showSensor, toggleSensor, spikeInjection, toggleSpikeInjection } = useSimStore();

  return (
    <div>
      <div style={{ fontSize: 10, color: '#475569', marginBottom: 14, lineHeight: 1.6 }}>
        Emulates non-ideal sensor hardware: downsampling, Gaussian noise injection and random packet loss.
      </div>

      <Slider
        label="Noise σ"
        value={config.noiseStdDev}
        min={0.1} max={5.0} step={0.1}
        unit=" m"
        format={(v) => v.toFixed(1)}
        onChange={(v) => setConfig({ noiseStdDev: v, rVariance: v * v })}
        hint="Std-dev of Gaussian noise injected per axis (σ). R = σ²"
      />
      <Slider
        label="Sample Interval"
        value={config.sampleInterval}
        min={1} max={12} step={1}
        unit=" frames"
        onChange={(v) => setConfig({ sampleInterval: Math.round(v) })}
        hint="1 = full-rate. Higher = slower sensor / heavier compute load"
      />
      <Slider
        label="Packet Drop Rate"
        value={config.dropRate}
        min={0} max={0.85} step={0.05}
        format={(v) => `${(v * 100).toFixed(0)}%`}
        onChange={(v) => setConfig({ dropRate: v })}
        hint="Probability of a scheduled sample being silently discarded"
      />

      <div style={{ borderTop: '1px solid #1e3a5f', paddingTop: 12, marginTop: 2 }}>
        <Toggle
          label="Show Sensor Markers"
          value={showSensor}
          onChange={toggleSensor}
          color="#f43f5e"
          sublabel="Red octahedra mark raw noisy observations"
        />
        <Toggle
          label="Gross Outlier Injection"
          value={spikeInjection}
          onChange={toggleSpikeInjection}
          color="#f97316"
          sublabel="3% chance of 8σ spike — tests filter robustness"
        />
      </div>

      {/* Live sensor variance indicator */}
      <div style={{ marginTop: 12, background: '#0f172a', borderRadius: 6, padding: '8px 10px' }}>
        <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Configured R Matrix
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#94a3b8' }}>
          diag([{config.noiseStdDev.toFixed(1)}², {config.noiseStdDev.toFixed(1)}², {config.noiseStdDev.toFixed(1)}²])<br />
          = diag([{(config.noiseStdDev ** 2).toFixed(2)}, {(config.noiseStdDev ** 2).toFixed(2)}, {(config.noiseStdDev ** 2).toFixed(2)}])
        </div>
      </div>
    </div>
  );
};
