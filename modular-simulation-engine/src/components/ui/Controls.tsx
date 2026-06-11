// ============================================================
// components/ui/Controls.tsx
// Button, Toggle, Badge, StatusPill components.
// ============================================================

import React from 'react';

// ── Button ────────────────────────────────────────────────────
interface ButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
  disabled?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

const BUTTON_STYLES: Record<NonNullable<ButtonProps['variant']>, React.CSSProperties> = {
  primary: { background: 'linear-gradient(135deg, #0ea5e9, #06b6d4)', color: '#fff', border: 'none' },
  secondary: { background: '#1e3a5f', color: '#94a3b8', border: '1px solid #2d4a6e' },
  danger: { background: 'linear-gradient(135deg, #dc2626, #f43f5e)', color: '#fff', border: 'none' },
  ghost: { background: 'transparent', color: '#64748b', border: '1px solid #1e3a5f' },
};

export const Button: React.FC<ButtonProps> = ({
  children, onClick, variant = 'secondary', size = 'md', disabled, icon, fullWidth
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      ...BUTTON_STYLES[variant],
      padding: size === 'sm' ? '5px 10px' : '8px 16px',
      borderRadius: 6,
      fontSize: size === 'sm' ? 11 : 12,
      fontWeight: 600,
      letterSpacing: '0.04em',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.4 : 1,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      width: fullWidth ? '100%' : 'auto',
      justifyContent: 'center',
      transition: 'all 0.15s ease',
      textTransform: 'uppercase' as const,
    }}
    onMouseEnter={(e) => !disabled && (e.currentTarget.style.opacity = '0.85')}
    onMouseLeave={(e) => !disabled && (e.currentTarget.style.opacity = '1')}
  >
    {icon && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
    {children}
  </button>
);

// ── Toggle ────────────────────────────────────────────────────
interface ToggleProps {
  label: string;
  value: boolean;
  onChange: () => void;
  color?: string;
  sublabel?: string;
}

export const Toggle: React.FC<ToggleProps> = ({ label, value, onChange, color = '#06b6d4', sublabel }) => (
  <div
    onClick={onChange}
    style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '6px 0', userSelect: 'none' }}
  >
    <div style={{
      width: 34, height: 18, borderRadius: 9,
      background: value ? color : '#1e3a5f',
      position: 'relative', transition: 'background 0.2s',
      border: value ? 'none' : '1px solid #334155',
      flexShrink: 0,
    }}>
      <div style={{
        position: 'absolute', top: value ? 2 : 1, left: value ? 17 : 1,
        width: 14, height: 14, borderRadius: '50%',
        background: '#e2e8f0',
        transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
      }} />
    </div>
    <div>
      <div style={{ fontSize: 12, color: value ? '#e2e8f0' : '#64748b', fontWeight: 500 }}>{label}</div>
      {sublabel && <div style={{ fontSize: 10, color: '#475569', marginTop: 1 }}>{sublabel}</div>}
    </div>
  </div>
);

// ── Metric Card ───────────────────────────────────────────────
interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  dim?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({ label, value, sub, color = '#06b6d4', dim }) => (
  <div style={{
    background: '#0f172a', borderRadius: 8, padding: '10px 12px',
    border: `1px solid ${dim ? '#1e3a5f' : color + '33'}`,
    opacity: dim ? 0.5 : 1,
  }}>
    <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>
      {label}
    </div>
    <div style={{ fontSize: 20, fontWeight: 700, color, fontFamily: 'monospace', marginTop: 2, lineHeight: 1.2 }}>
      {value}
    </div>
    {sub && <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{sub}</div>}
  </div>
);

// ── Status Pill ───────────────────────────────────────────────
interface StatusPillProps {
  status: 'idle' | 'running' | 'paused';
}
const STATUS_MAP = {
  idle: { color: '#64748b', dot: '#475569', label: 'IDLE' },
  running: { color: '#22c55e', dot: '#22c55e', label: 'LIVE' },
  paused: { color: '#f59e0b', dot: '#f59e0b', label: 'PAUSED' },
};
export const StatusPill: React.FC<StatusPillProps> = ({ status }) => {
  const s = STATUS_MAP[status];
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: s.color + '18', border: `1px solid ${s.color}44`,
      padding: '3px 9px', borderRadius: 12,
    }}>
      <div style={{
        width: 6, height: 6, borderRadius: '50%', background: s.dot,
        boxShadow: status === 'running' ? `0 0 5px ${s.dot}` : 'none',
        animation: status === 'running' ? 'pulse 1.2s ease-in-out infinite' : 'none',
      }} />
      <span style={{ fontSize: 10, fontWeight: 700, color: s.color, letterSpacing: '0.08em' }}>
        {s.label}
      </span>
    </div>
  );
};

// ── Panel Tab ─────────────────────────────────────────────────
interface TabProps {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}
export const Tab: React.FC<TabProps> = ({ label, icon, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
      padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
      background: active ? '#1e3a5f' : 'transparent',
      border: active ? '1px solid #2d4a6e' : '1px solid transparent',
      color: active ? '#38bdf8' : '#64748b',
      transition: 'all 0.15s',
      fontSize: 9, fontWeight: 600, letterSpacing: '0.04em',
      textTransform: 'uppercase' as const,
      minWidth: 52,
    }}
    onMouseEnter={(e) => !active && (e.currentTarget.style.color = '#94a3b8')}
    onMouseLeave={(e) => !active && (e.currentTarget.style.color = '#64748b')}
  >
    <span style={{ fontSize: 14 }}>{icon}</span>
    {label}
  </button>
);
