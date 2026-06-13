// ============================================================
// components/panels/AboutPanel.tsx
// ============================================================

import React from 'react';
import { InfoBox, SectionHead } from '@/components/ui/Controls';

const Eq: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <code style={{
    background: '#060d1a', padding: '1px 6px', borderRadius: 4,
    fontFamily: '"JetBrains Mono","Fira Mono",monospace',
    fontSize: 10.5, color: '#94a3b8',
    border: '1px solid #1e3a5f',
    display: 'inline-block', lineHeight: 1.6,
  }}>
    {children}
  </code>
);

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ marginBottom: 12 }}>
    <div style={{ fontSize: 9.5, color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
      {label}
    </div>
    <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.75 }}>
      {children}
    </div>
  </div>
);

export const AboutPanel: React.FC = () => (
  <div>
    <SectionHead color="#38bdf8">Algorithm</SectionHead>

    <Row label="State Space">
      <Eq>X = [x  y  z  vx  vy  vz]ᵀ</Eq><br />
      Gravity as control input: <Eq>U = [0 0 −g]ᵀ</Eq>.
      Observation matrix <Eq>H = [I₃ | 0₃]</Eq> — position-only sensing, no velocity measurement.
    </Row>

    <Row label="Predict">
      <Eq>X̂ = F·X + B·U</Eq><br />
      <Eq>P̂ = F·P·Fᵀ + Q</Eq><br />
      Runs every frame regardless of sensor availability.
    </Row>

    <Row label="Update">
      <Eq>y = Z − H·X̂</Eq>&nbsp; (innovation)<br />
      <Eq>K = P̂·Hᵀ·S⁻¹</Eq>&nbsp; (Kalman gain)<br />
      <Eq>X = X̂ + K·y</Eq>&nbsp;&nbsp; <Eq>P = (I − KH)·P̂</Eq>
    </Row>

    <Row label="Adaptive Q — walls">
      At collisions the true velocity inverts instantly — a non-linearity the linear KF cannot model.
      Q is inflated <strong style={{ color: '#94a3b8' }}>×250</strong> for 1–2 frames,
      spiking the gain K so the filter trusts the measurement over the stale prediction.
      Re-acquisition completes within 2 frames.
    </Row>

    <Row label="Adaptive Q — kick">
      The <strong style={{ color: '#f59e0b' }}>Kick</strong> button injects a large Z-axis impulse
      (re-energises a resting ball) and simultaneously calls <Eq>applyKickHint()</Eq> on the filter,
      inflating Q for ~10 frames to ensure rapid state re-acquisition after the manoeuvre.
    </Row>

    <Row label="RMSE metric">
      <Eq>RMSE = √(1/N · Σ ||X_true − X̂||²)</Eq><br />
      Well-tuned: Kalman RMSE ≤ 0.5× Sensor RMSE under nominal noise.
    </Row>

    <SectionHead color="#38bdf8">Coordinate convention</SectionHead>
    <Row label="Physics → Three.js remap">
      Physics uses <strong style={{color:'#94a3b8'}}>Z-up</strong> internally (gravity on −Z).
      Three.js uses <strong style={{color:'#94a3b8'}}>Y-up</strong>.
      The <Eq>SceneBuilder.toThree()</Eq> helper remaps:
      <br />
      <Eq>[x, y, z] → (x,  z, −y)</Eq>
      <br />
      This ensures the grid and floor render correctly at the bottom of the box, and the ball falls downward visually.
    </Row>

    <InfoBox accent="#2d4a6e">
      <div style={{ fontSize: 9.5, color: '#475569', lineHeight: 1.65 }}>
        <strong style={{ color: '#64748b' }}>Stack:</strong> React 18 · Zustand 5 ·
        Three.js r177 · TypeScript 5.8 · Vite 8 (Rolldown) · Recharts 2<br />
        Spec: V1.0.0 → V1.2.0 — modular refactor with coordinate fix, kick interaction,
        ESLint 9 flat config, Vite 8 tsconfigPaths.
      </div>
    </InfoBox>
  </div>
);
