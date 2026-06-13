// ============================================================
// components/ui/Controls.tsx
// Design tokens:
//   Surface levels: ambient(#060d1a) → base(#0d1f35) → raised(#162840) → float(#1e3a5f)
//   Borders: subtle(#1e3a5f) → visible(#2d4a6e) → bright(#3b5c87)
//   Text:    body(#e2e8f0) → secondary(#94a3b8) → muted(#64748b) → faint(#475569)
// ============================================================

import React from 'react';

// ── Button ────────────────────────────────────────────────────
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'kick';

interface ButtonProps {
  children:  React.ReactNode;
  onClick:   () => void;
  variant?:  ButtonVariant;
  size?:     'sm' | 'md';
  disabled?: boolean;
  icon?:     React.ReactNode;
  fullWidth?: boolean;
  title?:    string;
}

const BTN_BASE: React.CSSProperties = {
  borderRadius: 7,
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  transition: 'opacity 0.12s, box-shadow 0.12s',
  cursor: 'pointer',
  whiteSpace: 'nowrap' as const,
};

const BTN_VARIANTS: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: 'linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%)',
    color: '#fff',
    border: 'none',
    boxShadow: '0 0 0 0 rgba(6,182,212,0)',
  },
  secondary: {
    background: '#0d1f35',
    color: '#94a3b8',
    border: '1px solid #2d4a6e',
  },
  danger: {
    background: 'linear-gradient(135deg, #dc2626 0%, #f43f5e 100%)',
    color: '#fff',
    border: 'none',
  },
  ghost: {
    background: 'transparent',
    color: '#64748b',
    border: '1px solid #1e3a5f',
  },
  kick: {
    background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
    color: '#fff',
    border: 'none',
    boxShadow: '0 0 8px rgba(245,158,11,0.3)',
  },
};

export const Button: React.FC<ButtonProps> = ({
  children, onClick, variant = 'secondary', size = 'md',
  disabled, icon, fullWidth, title,
}) => {
  const pad = size === 'sm' ? '5px 10px' : '7px 14px';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        ...BTN_BASE,
        ...BTN_VARIANTS[variant],
        padding: pad,
        fontSize: size === 'sm' ? 10 : 11,
        width: fullWidth ? '100%' : 'auto',
        opacity: disabled ? 0.38 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.opacity = '0.8'; }}
      onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.opacity = '1'; }}
    >
      {icon && <span style={{ display: 'flex', alignItems: 'center', lineHeight: 1 }}>{icon}</span>}
      {children}
    </button>
  );
};

// ── Toggle ────────────────────────────────────────────────────
interface ToggleProps {
  label:     string;
  value:     boolean;
  onChange:  () => void;
  color?:    string;
  sublabel?: string;
}

export const Toggle: React.FC<ToggleProps> = ({
  label, value, onChange, color = '#06b6d4', sublabel,
}) => (
  <div
    onClick={onChange}
    role="switch"
    aria-checked={value}
    style={{
      display: 'flex', alignItems: 'center', gap: 10,
      cursor: 'pointer', padding: '5px 0', userSelect: 'none',
    }}
  >
    {/* Track */}
    <div style={{
      width: 34, height: 18, borderRadius: 9, flexShrink: 0, position: 'relative',
      background:  value ? color  : '#162840',
      border:      value ? 'none' : '1px solid #2d4a6e',
      transition: 'background 0.18s',
      boxShadow:   value ? `0 0 6px ${color}55` : 'none',
    }}>
      {/* Knob */}
      <div style={{
        position: 'absolute',
        top:  value ? 2 : 1.5,
        left: value ? 17 : 1.5,
        width: 13, height: 13, borderRadius: '50%',
        background: value ? '#fff' : '#475569',
        transition: 'left 0.18s, background 0.18s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
      }} />
    </div>
    <div>
      <div style={{ fontSize: 12, color: value ? '#e2e8f0' : '#64748b', fontWeight: 500, lineHeight: 1.3 }}>
        {label}
      </div>
      {sublabel && (
        <div style={{ fontSize: 9.5, color: '#475569', marginTop: 1, lineHeight: 1.3 }}>{sublabel}</div>
      )}
    </div>
  </div>
);

// ── Metric Card ───────────────────────────────────────────────
interface MetricCardProps {
  label: string;
  value: string;
  sub?:  string;
  color?: string;
  dim?:  boolean;
  glow?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label, value, sub, color = '#06b6d4', dim, glow,
}) => (
  <div style={{
    background: '#0d1f35',
    borderRadius: 8,
    padding: '9px 12px',
    border: `1px solid ${dim ? '#1e3a5f' : color + '44'}`,
    boxShadow: glow && !dim ? `0 0 12px ${color}22` : 'none',
    opacity: dim ? 0.45 : 1,
    minWidth: 88,
    transition: 'border-color 0.3s, box-shadow 0.3s',
  }}>
    <div style={{
      fontSize: 9, color: '#64748b',
      textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600,
    }}>
      {label}
    </div>
    <div style={{
      fontSize: 18, fontWeight: 700, color, fontFamily: 'monospace',
      marginTop: 2, lineHeight: 1.2, letterSpacing: '-0.02em',
    }}>
      {value}
    </div>
    {sub && (
      <div style={{ fontSize: 9, color: '#475569', marginTop: 2 }}>{sub}</div>
    )}
  </div>
);

// ── Status Pill ───────────────────────────────────────────────
interface StatusPillProps { status: 'idle' | 'running' | 'paused'; }

const STATUS_CFG = {
  idle:    { fg: '#64748b', bg: '#64748b18', border: '#64748b30', label: 'IDLE'   },
  running: { fg: '#22c55e', bg: '#22c55e18', border: '#22c55e40', label: 'LIVE'   },
  paused:  { fg: '#f59e0b', bg: '#f59e0b18', border: '#f59e0b40', label: 'PAUSED' },
} as const;

export const StatusPill: React.FC<StatusPillProps> = ({ status }) => {
  const c = STATUS_CFG[status];
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: c.bg, border: `1px solid ${c.border}`,
      padding: '3px 9px', borderRadius: 12,
    }}>
      <div style={{
        width: 6, height: 6, borderRadius: '50%', background: c.fg,
        boxShadow: status === 'running' ? `0 0 6px ${c.fg}` : 'none',
        animation: status === 'running' ? 'kfPulse 1.4s ease-in-out infinite' : 'none',
      }} />
      <span style={{ fontSize: 10, fontWeight: 700, color: c.fg, letterSpacing: '0.09em' }}>
        {c.label}
      </span>
    </div>
  );
};

// ── Panel Tab ─────────────────────────────────────────────────
interface TabProps {
  label:   string;
  icon:    React.ReactNode;
  active:  boolean;
  onClick: () => void;
}

export const Tab: React.FC<TabProps> = ({ label, icon, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
      padding: '7px 10px', borderRadius: 6, cursor: 'pointer',
      background: active ? '#162840' : 'transparent',
      border:     active ? '1px solid #2d4a6e' : '1px solid transparent',
      color:      active ? '#38bdf8'  : '#64748b',
      transition: 'all 0.15s',
      fontSize: 9, fontWeight: 600, letterSpacing: '0.04em',
      textTransform: 'uppercase',
      minWidth: 50,
      boxShadow: active ? '0 0 10px rgba(56,189,248,0.12)' : 'none',
    }}
    onMouseEnter={(e) => {
      if (!active) e.currentTarget.style.color = '#94a3b8';
    }}
    onMouseLeave={(e) => {
      if (!active) e.currentTarget.style.color = '#64748b';
    }}
  >
    <span style={{ fontSize: 14, lineHeight: 1 }}>{icon}</span>
    {label}
  </button>
);

// ── Info Box (used in panels) ─────────────────────────────────
interface InfoBoxProps {
  children: React.ReactNode;
  accent?:  string;
}

export const InfoBox: React.FC<InfoBoxProps> = ({ children, accent = '#1e3a5f' }) => (
  <div style={{
    background: '#060d1a', border: `1px solid ${accent}`,
    borderRadius: 6, padding: '8px 10px', marginTop: 8,
  }}>
    {children}
  </div>
);

// ── Section heading ───────────────────────────────────────────
export const SectionHead: React.FC<{ children: React.ReactNode; color?: string }> = ({
  children, color = '#64748b',
}) => (
  <div style={{
    fontSize: 9.5, color, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.07em',
    marginBottom: 7, marginTop: 2,
    borderBottom: `1px solid #1e3a5f`, paddingBottom: 4,
  }}>
    {children}
  </div>
);
