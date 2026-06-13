// ============================================================
// components/panels/PhysicsPanel.tsx
// ============================================================

import React from 'react';
import { Slider }                   from '@/components/ui/Slider';
import { SectionHead, InfoBox }     from '@/components/ui/Controls';
import { useSimStore }              from '@/store/simulationStore';

export const PhysicsPanel: React.FC = () => {
  const { config, setConfig } = useSimStore();

  return (
    <div>
      <div style={{ fontSize: 10, color: '#475569', marginBottom: 14, lineHeight: 1.7 }}>
        Newtonian dynamics: gravity acts on the <strong style={{color:'#64748b'}}>Z axis</strong> (vertical).
        Changes apply live to the running simulation.
      </div>

      <Slider
        label="Gravity"
        value={config.gravity}
        min={0} max={25} step={0.5}
        unit=" m/s²"
        onChange={(v) => setConfig({ gravity: v })}
        hint="Acts on −Z axis.  9.8 = Earth · 0 = zero-G · 25 = high-G"
        accentColor="#f59e0b"
      />
      <Slider
        label="Restitution (e)"
        value={config.restitution}
        min={0.1} max={1.0} step={0.05}
        format={(v) => v.toFixed(2)}
        onChange={(v) => setConfig({ restitution: v })}
        hint="Elastic coefficient on wall collisions. 1.0 = perfectly elastic"
        accentColor="#22c55e"
      />
      <Slider
        label="Air Resistance"
        value={config.airResistance}
        min={0} max={0.3} step={0.01}
        format={(v) => v.toFixed(2)}
        onChange={(v) => setConfig({ airResistance: v })}
        hint="Linear drag per second. 0 = vacuum · 0.3 = dense medium"
        accentColor="#94a3b8"
      />

      <SectionHead>Simulation constants</SectionHead>
      <div style={{ display: 'flex', gap: 7 }}>
        {[
          ['Box Size', `±${config.boxSize / 2} m`],
          ['Timestep dt', `${(config.dt * 1000).toFixed(1)} ms`],
          ['Coord. Z-up', 'phys→scene'],
        ].map(([l, v]) => (
          <div key={l} style={{
            flex: 1, background: '#060d1a',
            padding: '6px 8px', borderRadius: 5,
            border: '1px solid #1e3a5f',
          }}>
            <div style={{ fontSize: 9, color: '#475569', marginBottom: 2 }}>{l}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>{v}</div>
          </div>
        ))}
      </div>

      <InfoBox>
        <div style={{ fontSize: 9.5, color: '#475569', lineHeight: 1.6 }}>
          <span style={{ color: '#64748b', fontWeight: 600 }}>Coord convention:</span>{' '}
          Physics [x,y,<em>z</em>] → Three.js [x,<em>z</em>,−y].
          Z is vertical internally; Y is up in Three.js world space.
          The floor is at physics Z = −{config.boxSize / 2} m.
        </div>
      </InfoBox>
    </div>
  );
};
