// ============================================================
// components/ui/Slider.tsx
// Accessible, styled range slider with live value display.
// ============================================================

import React from 'react';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  format?: (v: number) => string;
  onChange: (v: number) => void;
  accent?: string;
  hint?: string;
}

export const Slider: React.FC<SliderProps> = ({
  label, value, min, max, step, unit = '', format, onChange, hint
}) => {
  const display = format ? format(value) : value.toString();
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
        <span style={{ fontSize: 11, color: '#94a3b8', letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 500 }}>
          {label}
        </span>
        <span style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600, fontFamily: 'monospace' }}>
          {display}{unit}
        </span>
      </div>
      <div style={{ position: 'relative', height: 20, display: 'flex', alignItems: 'center' }}>
        {/* Track background */}
        <div style={{
          position: 'absolute', left: 0, right: 0, height: 4,
          background: '#1e3a5f', borderRadius: 2
        }} />
        {/* Filled portion */}
        <div style={{
          position: 'absolute', left: 0, width: `${pct}%`, height: 4,
          background: 'linear-gradient(90deg, #0ea5e9, #06b6d4)',
          borderRadius: 2, transition: 'width 0.05s'
        }} />
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          style={{
            position: 'absolute', left: 0, right: 0, width: '100%',
            opacity: 0, cursor: 'pointer', height: 20, margin: 0,
          }}
        />
        {/* Thumb dot */}
        <div style={{
          position: 'absolute', left: `calc(${pct}% - 7px)`,
          width: 14, height: 14, borderRadius: '50%',
          background: '#e2e8f0', border: '2px solid #06b6d4',
          boxShadow: '0 0 6px rgba(6,182,212,0.5)',
          pointerEvents: 'none', transition: 'left 0.05s',
        }} />
      </div>
      {hint && (
        <div style={{ fontSize: 10, color: '#475569', marginTop: 3, lineHeight: 1.4 }}>{hint}</div>
      )}
    </div>
  );
};
