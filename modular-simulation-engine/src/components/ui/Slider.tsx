// ============================================================
// components/ui/Slider.tsx
// Range slider with inline editable number input.
// Users can drag the track OR click the value badge to type.
// ============================================================

import React, { useState, useRef, useEffect } from 'react';

interface SliderProps {
  label:       string;
  value:       number;
  min:         number;
  max:         number;
  step:        number;
  unit?:       string;
  format?:     (v: number) => string;
  onChange:    (v: number) => void;
  hint?:       string;
  accentColor?: string;
}

export const Slider: React.FC<SliderProps> = ({
  label, value, min, max, step, unit = '',
  format, onChange, hint, accentColor = '#06b6d4',
}) => {
  const [editing, setEditing]   = useState(false);
  const [inputVal, setInputVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  const display = format
    ? format(value)
    : step < 0.01 ? value.toFixed(3)
    : step < 0.1  ? value.toFixed(2)
    : step < 1    ? value.toFixed(1)
    : String(value);

  const startEdit = () => {
    setInputVal(display);
    setEditing(true);
  };

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commitEdit = () => {
    const parsed = parseFloat(inputVal.replace(/[^0-9.\-]/g, ''));
    if (!isNaN(parsed)) {
      // Round to nearest step, then clamp to [min, max]
      const stepped = Math.round(parsed / step) * step;
      const clamped = Math.max(min, Math.min(max, stepped));
      onChange(parseFloat(clamped.toFixed(10)));
    }
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter')  { e.preventDefault(); commitEdit(); }
    if (e.key === 'Escape') { setEditing(false); }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      onChange(Math.min(max, parseFloat((value + step).toFixed(10))));
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      onChange(Math.max(min, parseFloat((value - step).toFixed(10))));
    }
  };

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Label + value badge */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 7, gap: 8,
      }}>
        <span style={{
          fontSize: 10, color: '#94a3b8',
          textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600,
          flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {label}
        </span>

        {/* Editable value badge — click to type a value */}
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            style={{
              fontSize: 12, fontWeight: 700, fontFamily: 'monospace',
              background: '#0d1f35',
              color: accentColor,
              border: `1px solid ${accentColor}`,
              borderRadius: 4,
              padding: '2px 7px',
              width: 72, textAlign: 'right',
              outline: 'none',
              boxShadow: `0 0 0 2px ${accentColor}33`,
            }}
          />
        ) : (
          <span
            onClick={startEdit}
            title="Click to type a value"
            style={{
              fontSize: 12, color: '#e2e8f0',
              fontWeight: 700, fontFamily: 'monospace',
              background: '#060d1a', padding: '2px 7px',
              borderRadius: 4, border: '1px solid #1e3a5f',
              cursor: 'text',
              whiteSpace: 'nowrap',
              transition: 'border-color 0.12s',
              userSelect: 'none',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = accentColor + '88')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#1e3a5f')}
          >
            {display}{unit}
          </span>
        )}
      </div>

      {/* Track */}
      <div style={{ position: 'relative', height: 20, display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, height: 3, background: '#162840', borderRadius: 2 }} />
        <div style={{
          position: 'absolute', left: 0, width: `${pct}%`, height: 3,
          background: `linear-gradient(90deg, ${accentColor}66, ${accentColor})`,
          borderRadius: 2, transition: 'width 0.04s',
        }} />
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          style={{ position: 'absolute', left: 0, right: 0, width: '100%', opacity: 0, cursor: 'pointer', height: 20, margin: 0 }}
        />
        {/* Visual thumb */}
        <div style={{
          position: 'absolute',
          left: `calc(${pct}% - 7px)`,
          width: 14, height: 14, borderRadius: '50%',
          background: '#e2e8f0',
          border: `2px solid ${accentColor}`,
          boxShadow: `0 0 7px ${accentColor}88`,
          pointerEvents: 'none',
          transition: 'left 0.04s',
        }} />
      </div>

      {/* Min/max indicators */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
        <span style={{ fontSize: 8.5, color: '#1e3a5f', fontFamily: 'monospace' }}>{min}</span>
        <span style={{ fontSize: 8.5, color: '#1e3a5f', fontFamily: 'monospace' }}>{max}</span>
      </div>

      {hint && (
        <div style={{ fontSize: 9.5, color: '#334155', marginTop: 3, lineHeight: 1.55 }}>{hint}</div>
      )}
    </div>
  );
};
