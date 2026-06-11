// ============================================================
// components/panels/AboutPanel.tsx
// ============================================================

import React from 'react';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ fontSize: 10, color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
      {title}
    </div>
    <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.7 }}>
      {children}
    </div>
  </div>
);

const Code: React.FC<{ children: string }> = ({ children }) => (
  <code style={{
    background: '#0f172a', padding: '1px 5px', borderRadius: 3,
    fontFamily: 'monospace', fontSize: 10, color: '#94a3b8', display: 'inline-block'
  }}>
    {children}
  </code>
);

export const AboutPanel: React.FC = () => (
  <div>
    <Section title="State Space Model">
      State vector <Code>X = [x y z vx vy vz]ᵀ</Code>. Transition matrix <Code>F</Code> encodes constant-velocity kinematics with <Code>Δt</Code> coupling.
      Gravity enters as a deterministic control input <Code>B·U</Code> where <Code>U = [0 0 −g]ᵀ</Code>.
    </Section>

    <Section title="Predict Step">
      <Code>X̂ₖ = F·Xₖ₋₁ + B·U</Code><br />
      <Code>Pₖ = F·Pₖ₋₁·Fᵀ + Q</Code><br />
      Executed every frame regardless of sensor availability.
    </Section>

    <Section title="Update Step">
      <Code>y = Z − H·X̂</Code> (innovation)<br />
      <Code>S = H·P·Hᵀ + R</Code><br />
      <Code>K = P·Hᵀ·S⁻¹</Code> (Kalman gain)<br />
      <Code>X = X̂ + K·y</Code> | <Code>P = (I − K·H)·P</Code>
    </Section>

    <Section title="Adaptive Q Inflation">
      At wall collisions, true velocity undergoes an instantaneous reversal — a non-linearity the linear KF cannot predict. The system detects proximity to a boundary, inflates <Code>Q</Code> by ~250× for 1–2 frames, which spikes the Kalman gain <Code>K</Code> and forces the filter to heavily weight the incoming measurement over the (now wrong) prediction. This is a form of strong-tracking filtering.
    </Section>

    <Section title="R vs Q Tuning Law">
      <strong style={{ color: '#94a3b8' }}>R large</strong> → filter distrusts sensor → smooth but lagged.<br />
      <strong style={{ color: '#94a3b8' }}>Q large</strong> → filter distrusts model → responsive but noisy.<br />
      Optimal: <Code>Q/R ≈ σ_process² / σ_sensor²</Code>.
    </Section>

    <Section title="Evaluation Metric">
      RMSE = √(1/N · Σ ||Xₜᵣᵤₑ − X̂||²) accumulated across all frames. Kalman RMSE should be &lt; raw sensor RMSE by a factor of 2–4× under typical noise conditions.
    </Section>

    <div style={{ marginTop: 16, padding: '8px 10px', background: '#0f172a', borderRadius: 6, border: '1px solid #1e3a5f' }}>
      <div style={{ fontSize: 10, color: '#475569' }}>
        Architecture: React 18 + Zustand + Three.js (WebGL) + TypeScript 5 · Built to SW engineering standards per specification V1.0.0
      </div>
    </div>
  </div>
);
