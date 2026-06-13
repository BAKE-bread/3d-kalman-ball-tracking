// ============================================================
// App.tsx — Root layout assembler  (V1.2.0)
//
// Layout structure:
//   ┌────────────────── Header (48px) ──────────────────────┐
//   │ Logo  │  StatusPill  │  [Start/Pause] [Reset] [Kick]  │
//   │       │              │  [Randomise]   [›Panel]         │
//   ├──────────────── Main row ──────────────────────────────┤
//   │                              │  Sidebar (282px)        │
//   │   3D Canvas (flex-1)         │  ┌ Tab bar ─────────┐  │
//   │                              │  │ Physics Sensor    │  │
//   │   [Legend overlay]           │  │ Filter  About     │  │
//   │                              │  └──────────────────┘  │
//   │   [Metric cards — bottom]    │  Panel content          │
//   │                              │                         │
//   ├─────── Chart panel (130px) ──│  Velocity footer        │
//   │  [RMSE] [Cov]    frame count │                         │
//   └──────────────────────────────┴─────────────────────────┘
// ============================================================

import React, { useRef, useState } from 'react';
import { useSimulationLoop }  from '@/hooks/useSimulationLoop';
import { useSimStore }        from '@/store/simulationStore';
import { Button, MetricCard, StatusPill, Tab } from '@/components/ui/Controls';
import { PhysicsPanel }  from '@/components/panels/PhysicsPanel';
import { SensorPanel }   from '@/components/panels/SensorPanel';
import { KalmanPanel }   from '@/components/panels/KalmanPanel';
import { AboutPanel }    from '@/components/panels/AboutPanel';
import { RmseChart, CovarianceChart } from '@/components/overlays/RmseChart';

// ── Inline SVG icon set ───────────────────────────────────────
const IconPlay      = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>;
const IconPause     = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>;
const IconReset     = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg>;
const IconDice      = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="2" width="20" height="20" rx="3"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/><circle cx="16" cy="16" r="1.5" fill="currentColor"/><circle cx="16" cy="8" r="1.5" fill="currentColor"/><circle cx="8" cy="16" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>;
const IconKick      = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5,12 12,5 19,12"/></svg>;
const IconChevronL  = () => <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>;
const IconChevronR  = () => <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>;

const PANEL_TABS = [
  { id: 'physics' as const, label: 'Physics', icon: '⚙' },
  { id: 'sensor'  as const, label: 'Sensor',  icon: '📡' },
  { id: 'kalman'  as const, label: 'Filter',  icon: '∿' },
  { id: 'about'   as const, label: 'About',   icon: '?' },
] as const;

const LEGEND_ITEMS = [
  { color: '#22c55e', label: 'True State',       glow: true  },
  { color: '#06b6d4', label: 'Kalman Estimate',  glow: true  },
  { color: '#f43f5e', label: 'Sensor Reading',   glow: false },
  { color: '#f97316', label: 'Outlier Spike',    glow: false },
  { color: '#f59e0b', label: 'Forecast (1 s)',   glow: false },
] as const;

export const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { handleStart, handlePause, handleReset, handleRandomise } = useSimulationLoop(canvasRef);

  const {
    status, metrics,
    activePanel, setActivePanel,
    sidebarOpen, setSidebarOpen,
    requestKick,
  } = useSimStore();

  const [chartTab, setChartTab] = useState<'rmse' | 'cov'>('rmse');

  const isActive = status === 'running' || status === 'paused';
  const isRunning = status === 'running';
  const hasData   = metrics != null;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100vh',
      background: '#060d1a',
      fontFamily: '"Inter","SF Pro Display",system-ui,sans-serif',
      overflow: 'hidden',
      color: '#e2e8f0',
    }}>

      {/* ══ GLOBAL STYLES ════════════════════════════════════ */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; overflow: hidden; background: #060d1a; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e3a5f; border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: #2d4a6e; }
        canvas { user-select: none; -webkit-user-select: none; }

        @keyframes kfPulse {
          0%, 100% { opacity: 1;   box-shadow: 0 0 6px currentColor; }
          50%       { opacity: 0.4; box-shadow: 0 0 2px currentColor; }
        }

        /* Chart container subtle gradient border */
        .kf-chart-panel {
          background: linear-gradient(180deg, #060d1a 0%, #060d1a 100%);
          border-top: 1px solid #1a3050;
        }

        /* Metric card hover lift */
        .kf-metric:hover {
          border-color: var(--kf-accent, #2d4a6e) !important;
          transform: translateY(-1px);
          transition: transform 0.15s, border-color 0.15s;
        }

        /* Sidebar panel scroll */
        .kf-panel-scroll {
          scrollbar-gutter: stable;
        }

        /* Button active press */
        button:active:not(:disabled) { transform: scale(0.97); }
      `}</style>

      {/* ══ HEADER ═══════════════════════════════════════════ */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 18px',
        height: 50,
        flexShrink: 0,
        background: '#0b1730',
        borderBottom: '1px solid #1a3050',
        boxShadow: '0 1px 12px rgba(0,0,0,0.4)',
        zIndex: 10,
      }}>
        {/* ── Logo ─── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 7,
            background: 'linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 700, color: '#fff',
            boxShadow: '0 0 14px rgba(6,182,212,0.45)',
            flexShrink: 0,
          }}>
            ∿
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.015em', color: '#e2e8f0', lineHeight: 1.2 }}>
              KalmanTracker 3D
            </div>
            <div style={{ fontSize: 9.5, color: '#3b5c87', letterSpacing: '0.02em' }}>
              Real-time 6-DOF State Estimation · WebGL
            </div>
          </div>
        </div>

        {/* ── Controls ─── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <StatusPill status={status} />

          {/* Divider */}
          <div style={{ width: 1, height: 22, background: '#1e3a5f', margin: '0 2px' }} />

          {/* Primary flow: Start / Pause+Resume */}
          {!isActive ? (
            <Button variant="primary" onClick={handleStart} icon={<IconPlay />}>
              Start
            </Button>
          ) : (
            <Button variant="primary" onClick={handlePause} icon={isRunning ? <IconPause /> : <IconPlay />}>
              {isRunning ? 'Pause' : 'Resume'}
            </Button>
          )}

          {/* Secondary actions */}
          <Button variant="secondary" onClick={handleReset} icon={<IconReset />}>
            Reset
          </Button>

          {/* Divider */}
          <div style={{ width: 1, height: 22, background: '#1e3a5f', margin: '0 1px' }} />

          {/* Kick — separated visually from reset/start because it's a physics action */}
          <Button
            variant="kick"
            onClick={requestKick}
            disabled={!isRunning}
            icon={<IconKick />}
            title="Apply a strong upward impulse to re-energise the ball"
          >
            Kick
          </Button>

          <Button
            variant="ghost"
            onClick={handleRandomise}
            disabled={!isRunning}
            icon={<IconDice />}
            title="Randomise ball velocity direction"
          >
            Randomise
          </Button>

          {/* Divider */}
          <div style={{ width: 1, height: 22, background: '#1e3a5f', margin: '0 1px' }} />

          {/* Sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={sidebarOpen ? 'Hide panel' : 'Show panel'}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: sidebarOpen ? '#162840' : 'transparent',
              border: '1px solid #1e3a5f',
              color: sidebarOpen ? '#94a3b8' : '#475569',
              borderRadius: 6,
              padding: '5px 8px',
              cursor: 'pointer',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#2d4a6e'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1e3a5f'; }}
          >
            {sidebarOpen ? <IconChevronR /> : <IconChevronL />}
            {sidebarOpen ? 'Hide' : 'Panel'}
          </button>
        </div>
      </header>

      {/* ══ MAIN ROW ═════════════════════════════════════════ */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

        {/* ── VIEWPORT COLUMN ──────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', minWidth: 0 }}>

          {/* 3D Canvas — takes all remaining vertical space */}
          <canvas
            ref={canvasRef}
            style={{ flex: 1, display: 'block', width: '100%', minHeight: 0, cursor: 'grab' }}
          />

          {/* ── Legend overlay (top-left) ── */}
          <div style={{
            position: 'absolute', top: 12, left: 12,
            display: 'flex', flexDirection: 'column', gap: 5,
            pointerEvents: 'none',
          }}>
            <div style={{
              background: 'rgba(6,13,26,0.72)',
              backdropFilter: 'blur(6px)',
              border: '1px solid #1a3050',
              borderRadius: 7,
              padding: '7px 10px',
              display: 'flex', flexDirection: 'column', gap: 5,
            }}>
              {LEGEND_ITEMS.map(({ color, label, glow }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: color,
                    boxShadow: glow ? `0 0 6px ${color}aa` : 'none',
                    flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 10, color: '#64748b', whiteSpace: 'nowrap' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Idle state overlay ── */}
          {status === 'idle' && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
            }}>
              <div style={{
                background: 'rgba(6,13,26,0.88)',
                border: '1px solid #1e3a5f',
                borderRadius: 12,
                padding: '22px 32px',
                textAlign: 'center',
                backdropFilter: 'blur(8px)',
              }}>
                <div style={{ fontSize: 36, marginBottom: 8, lineHeight: 1, color: '#06b6d4', textShadow: '0 0 20px rgba(6,182,212,0.5)' }}>∿</div>
                <div style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
                  3D Kalman Filter Simulation
                </div>
                <div style={{ color: '#3b5c87', fontSize: 11, lineHeight: 1.6 }}>
                  Drag to orbit · Scroll to zoom<br />
                  Press <strong style={{ color: '#06b6d4' }}>Start</strong> to begin
                </div>
              </div>
            </div>
          )}

          {/* ── Metric cards — floating above chart panel ── */}
          <div style={{
            position: 'absolute',
            bottom: 138,   // chart panel height (130) + 8px gap
            left: 10,
            right: 10,
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            pointerEvents: 'none',
          }}>
            {[
              { label: 'Kalman RMSE', value: hasData ? `${metrics.rmseKalman.toFixed(3)}m`  : '—', color: '#06b6d4', sub: 'Cumulative',       glow: true  },
              { label: 'Sensor RMSE', value: hasData ? `${metrics.rmseSensor.toFixed(3)}m`  : '—', color: '#f43f5e', sub: 'Sensor frames',    glow: false },
              { label: 'Current Err', value: hasData ? `${metrics.errorKalman.toFixed(3)}m` : '—', color: '#22c55e', sub: 'Instantaneous',    glow: false },
              { label: 'tr(P)',       value: hasData ? metrics.covariance.toFixed(1)         : '—', color: '#a78bfa', sub: 'Uncertainty',      glow: false },
            ].map(({ label, value, color, sub, glow }) => (
              <div key={label} style={{ pointerEvents: 'all' }}>
                <MetricCard label={label} value={value} color={color} sub={sub} dim={!hasData} glow={glow && hasData} />
              </div>
            ))}
          </div>

          {/* ── Chart panel ── */}
          <div className="kf-chart-panel" style={{ height: 130, padding: '7px 14px 5px', flexShrink: 0 }}>
            {/* Chart tab bar */}
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 5,
            }}>
              <div style={{ display: 'flex', gap: 5 }}>
                {(['rmse', 'cov'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setChartTab(t)}
                    style={{
                      fontSize: 9.5, padding: '2px 9px', borderRadius: 4,
                      cursor: 'pointer', fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                      background:    chartTab === t ? '#162840' : 'transparent',
                      color:         chartTab === t ? '#38bdf8' : '#334155',
                      border:        chartTab === t ? '1px solid #2d4a6e' : '1px solid transparent',
                      transition: 'all 0.15s',
                    }}
                  >
                    {t === 'rmse' ? 'RMSE Error' : 'Covariance tr(P)'}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 9.5, color: '#1e3a5f', fontFamily: 'monospace' }}>
                {hasData && `F ${metrics.frame.toLocaleString()}`}
              </div>
            </div>

            {/* Chart */}
            <div style={{ height: 90 }}>
              {chartTab === 'rmse' ? <RmseChart /> : <CovarianceChart />}
            </div>
          </div>
        </div>

        {/* ══ SIDEBAR ══════════════════════════════════════════ */}
        {sidebarOpen && (
          <aside style={{
            width: 282,
            flexShrink: 0,
            background: '#0b1730',
            borderLeft: '1px solid #1a3050',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '-4px 0 16px rgba(0,0,0,0.25)',
          }}>

            {/* ── Tab bar ── */}
            <div style={{
              display: 'flex',
              gap: 3,
              padding: '8px 8px 0',
              borderBottom: '1px solid #1a3050',
              flexShrink: 0,
              background: '#080f1f',
            }}>
              {PANEL_TABS.map((t) => (
                <Tab
                  key={t.id}
                  label={t.label}
                  icon={t.icon}
                  active={activePanel === t.id}
                  onClick={() => setActivePanel(t.id)}
                />
              ))}
            </div>

            {/* ── Panel content ── */}
            <div
              className="kf-panel-scroll"
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '13px 13px 20px',
              }}
            >
              {activePanel === 'physics' && <PhysicsPanel />}
              {activePanel === 'sensor'  && <SensorPanel />}
              {activePanel === 'kalman'  && <KalmanPanel />}
              {activePanel === 'about'   && <AboutPanel />}
            </div>

            {/* ── Velocity footer ── */}
            <div style={{
              borderTop: '1px solid #1a3050',
              padding: '8px 13px 10px',
              flexShrink: 0,
              background: '#080f1f',
            }}>
              <div style={{
                fontSize: 9, color: '#1e3a5f',
                textTransform: 'uppercase', letterSpacing: '0.08em',
                marginBottom: 5, fontWeight: 700,
              }}>
                Estimated Velocity (m/s)
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['X', 'Y', 'Z'] as const).map((axis, i) => (
                  <div key={axis} style={{
                    flex: 1, textAlign: 'center',
                    background: '#0d1f35',
                    border: '1px solid #1e3a5f',
                    borderRadius: 5,
                    padding: '5px 4px',
                  }}>
                    <div style={{ fontSize: 9, color: '#334155', marginBottom: 2, fontWeight: 600 }}>{axis}</div>
                    <div style={{
                      fontSize: 12,
                      fontFamily: '"JetBrains Mono","Fira Mono",monospace',
                      color: hasData ? '#64748b' : '#1e3a5f',
                      letterSpacing: '-0.02em',
                    }}>
                      {hasData ? metrics.kalmanVelocity[i].toFixed(1) : '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};
