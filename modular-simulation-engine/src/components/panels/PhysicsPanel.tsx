// ============================================================
// components/panels/PhysicsPanel.tsx
// ============================================================

import React from 'react';
import { Slider } from '@/components/ui/Slider';
import { useSimStore } from '@/store/simulationStore';

export const PhysicsPanel: React.FC = () => {
  const { config, setConfig } = useSimStore();

  return (
    <div>
      <div style={{ fontSize: 10, color: '#475569', marginBottom: 14, lineHeight: 1.6 }}>
        Configure the Newtonian dynamics of the simulation. Changes take effect immediately on the running sim.
      </div>

      <Slider
        label="Gravity"
        value={config.gravity}
        min={0} max={25} step={0.5}
        unit=" m/s²"
        onChange={(v) => setConfig({ gravity: v })}
        hint="Acts on −Z axis. 9.8 = Earth, 0 = zero-g, 25 = high-G"
      />
      <Slider
        label="Restitution (e)"
        value={config.restitution}
        min={0.1} max={1.0} step={0.05}
        format={(v) => v.toFixed(2)}
        onChange={(v) => setConfig({ restitution: v })}
        hint="Elastic coefficient at wall collisions. 1.0 = perfectly elastic"
      />
      <Slider
        label="Air Resistance"
        value={config.airResistance}
        min={0} max={0.3} step={0.01}
        format={(v) => v.toFixed(2)}
        onChange={(v) => setConfig({ airResistance: v })}
        hint="Velocity damping per second. 0 = vacuum, 0.3 = dense medium"
      />

      <div style={{ borderTop: '1px solid #1e3a5f', paddingTop: 12, marginTop: 4 }}>
        <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Simulation Parameters
        </div>
        <div style={{ display: 'flex', gap: 8, fontSize: 10, color: '#475569' }}>
          <div style={{ flex: 1, background: '#0f172a', padding: '6px 8px', borderRadius: 5 }}>
            <div style={{ color: '#64748b', marginBottom: 2 }}>Box Size</div>
            <div style={{ color: '#94a3b8', fontFamily: 'monospace' }}>±{config.boxSize / 2} m</div>
          </div>
          <div style={{ flex: 1, background: '#0f172a', padding: '6px 8px', borderRadius: 5 }}>
            <div style={{ color: '#64748b', marginBottom: 2 }}>Timestep dt</div>
            <div style={{ color: '#94a3b8', fontFamily: 'monospace' }}>{(config.dt * 1000).toFixed(1)} ms</div>
          </div>
        </div>
      </div>
    </div>
  );
};
