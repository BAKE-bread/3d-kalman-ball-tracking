// ============================================================
// App.tsx  — Root layout assembler
// Wires together: canvas, sidebar, metrics bar, chart panel.
// ============================================================

import React, { useRef, useState } from 'react';
import { useSimulationLoop } from '@/hooks/useSimulationLoop';
import { useSimStore } from '@/store/simulationStore';
import { Slider } from '@/components/ui/Slider';
import { Button, Toggle, MetricCard, StatusPill, Tab } from '@/components/ui/Controls';
import { PhysicsPanel } from '@/components/panels/PhysicsPanel';
import { SensorPanel } from '@/components/panels/SensorPanel';
import { KalmanPanel } from '@/components/panels/KalmanPanel';
import { AboutPanel } from '@/components/panels/AboutPanel';
import { RmseChart, CovarianceChart } from '@/components/overlays/RmseChart';

// Inline SVG icons (no external icon dep required at runtime)
const IconPlay = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>;
const IconPause = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>;
const IconReset = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg>;
const IconDice = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="3"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/><circle cx="16" cy="16" r="1.5" fill="currentColor"/><circle cx="16" cy="8" r="1.5" fill="currentColor"/><circle cx="8" cy="16" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>;

const PANEL_TABS = [
  { id: 'physics' as const, label: 'Physics', icon: '⚙' },
  { id: 'sensor' as const, label: 'Sensor', icon: '📡' },
  { id: 'kalman' as const, label: 'Filter', icon: '∿' },
  { id: 'about' as const, label: 'About', icon: '?' },
];

export const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { handleStart, handlePause, handleReset, handleRandomise } = useSimulationLoop(canvasRef);
  const { status, metrics, activePanel, setActivePanel, sidebarOpen, setSidebarOpen } = useSimStore();
  const [chartTab, setChartTab] = useState<'rmse' | 'cov'>('rmse');

  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const hasData = metrics != null;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100vh', background: '#0b1426',
      fontFamily: '"Inter", "SF Pro Display", system-ui, sans-serif',
      overflow: 'hidden',
    }}>
      {/* ── Top bar ─────────────────────────────────────── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', height: 52, flexShrink: 0,
        background: '#0f172a', borderBottom: '1px solid #1e3a5f',
        boxShadow: '0 1px 0 #1e3a5f',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: 'linear-gradient(135deg, #0ea5e9, #06b6d4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, boxShadow: '0 0 10px rgba(6,182,212,0.4)',
          }}>∿</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', letterSpacing: '-0.01em' }}>
              KalmanTracker 3D
            </div>
            <div style={{ fontSize: 10, color: '#475569' }}>
              Real-time 6-DOF State Estimation · WebGL
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <StatusPill status={status} />

          {/* Control buttons */}
          <div style={{ display: 'flex', gap: 6 }}>
            {!isRunning && !isPaused ? (
              <Button variant="primary" onClick={handleStart} icon={<IconPlay />}>
                Start
              </Button>
            ) : (
              <Button variant="primary" onClick={handlePause} icon={isRunning ? <IconPause /> : <IconPlay />}>
                {isRunning ? 'Pause' : 'Resume'}
              </Button>
            )}
            <Button variant="secondary" onClick={handleReset} icon={<IconReset />}>Reset</Button>
            <Button variant="ghost" onClick={handleRandomise} icon={<IconDice />} disabled={!isRunning}>
              Randomise
            </Button>
          </div>

          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              marginLeft: 4, background: 'transparent', border: '1px solid #1e3a5f',
              color: '#64748b', borderRadius: 5, padding: '5px 8px', cursor: 'pointer',
              fontSize: 12,
            }}
          >
            {sidebarOpen ? '‹ Hide' : '› Panel'}
          </button>
        </div>
      </header>

      {/* ── Main area ───────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── 3D Viewport ──────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', minWidth: 0 }}>

          {/* Canvas */}
          <canvas
            ref={canvasRef}
            style={{ flex: 1, display: 'block', width: '100%', cursor: 'grab' }}
          />

          {/* Viewport overlay — legend */}
          <div style={{
            position: 'absolute', top: 12, left: 12,
            display: 'flex', flexDirection: 'column', gap: 5,
          }}>
            {[
              { color: '#22c55e', label: 'True State' },
              { color: '#06b6d4', label: 'Kalman Estimate' },
              { color: '#f43f5e', label: 'Sensor Reading' },
              { color: '#f59e0b', label: 'Forecast (1s)' },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 5px ${color}88` }} />
                <span style={{ fontSize: 10, color: '#64748b' }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Viewport hint */}
          {status === 'idle' && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
            }}>
              <div style={{
                background: 'rgba(15,23,42,0.9)', border: '1px solid #1e3a5f',
                borderRadius: 10, padding: '16px 24px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>∿</div>
                <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 14 }}>3D Kalman Filter Simulation</div>
                <div style={{ color: '#475569', fontSize: 11, marginTop: 4 }}>Drag to orbit · Scroll to zoom · Press Start</div>
              </div>
            </div>
          )}

          {/* Bottom chart panel */}
          <div style={{
            height: 140, borderTop: '1px solid #1e3a5f', background: '#0b1426',
            padding: '8px 16px 6px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['rmse', 'cov'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setChartTab(t)}
                    style={{
                      fontSize: 10, padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
                      background: chartTab === t ? '#1e3a5f' : 'transparent',
                      color: chartTab === t ? '#38bdf8' : '#475569',
                      border: chartTab === t ? '1px solid #2d4a6e' : '1px solid transparent',
                      textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em',
                    }}
                  >
                    {t === 'rmse' ? 'RMSE Error' : 'Covariance tr(P)'}
                  </button>
                ))}
              </div>
              {hasData && (
                <div style={{ fontSize: 10, color: '#334155' }}>
                  Frame {metrics.frame.toLocaleString()}
                </div>
              )}
            </div>
            {chartTab === 'rmse' ? <RmseChart /> : <CovarianceChart />}
          </div>

          {/* Floating metric bar */}
          <div style={{
            position: 'absolute', bottom: 158, left: 0, right: 0,
            padding: '0 12px',
            display: 'flex', gap: 8,
            pointerEvents: 'none',
          }}>
            <div style={{ pointerEvents: 'all', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <MetricCard
                label="Kalman RMSE"
                value={hasData ? `${metrics.rmseKalman.toFixed(3)}m` : '—'}
                sub="Cumulative"
                color="#06b6d4"
                dim={!hasData}
              />
              <MetricCard
                label="Sensor RMSE"
                value={hasData ? `${metrics.rmseSensor.toFixed(3)}m` : '—'}
                sub="Sensor frames only"
                color="#f43f5e"
                dim={!hasData}
              />
              <MetricCard
                label="Current Error"
                value={hasData ? `${metrics.errorKalman.toFixed(3)}m` : '—'}
                sub="Instantaneous 3D dist"
                color="#22c55e"
                dim={!hasData}
              />
              <MetricCard
                label="tr(P)"
                value={hasData ? metrics.covariance.toFixed(2) : '—'}
                sub="Filter uncertainty"
                color="#a78bfa"
                dim={!hasData}
              />
            </div>
          </div>
        </div>

        {/* ── Sidebar ──────────────────────────────────── */}
        {sidebarOpen && (
          <aside style={{
            width: 280, flexShrink: 0,
            background: '#0f172a', borderLeft: '1px solid #1e3a5f',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            {/* Tab bar */}
            <div style={{
              display: 'flex', gap: 4, padding: '8px 10px 0',
              borderBottom: '1px solid #1e3a5f', flexShrink: 0,
              flexWrap: 'wrap',
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

            {/* Panel content */}
            <div style={{ flex: 1, overflow: 'auto', padding: '14px 14px 20px' }}>
              {activePanel === 'physics' && <PhysicsPanel />}
              {activePanel === 'sensor' && <SensorPanel />}
              {activePanel === 'kalman' && <KalmanPanel />}
              {activePanel === 'about' && <AboutPanel />}
            </div>

            {/* Sidebar footer — velocity readout */}
            {hasData && (
              <div style={{
                borderTop: '1px solid #1e3a5f', padding: '8px 14px',
                flexShrink: 0, background: '#0b1426',
              }}>
                <div style={{ fontSize: 10, color: '#334155', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Estimated Velocity
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['X', 'Y', 'Z'] as const).map((axis, i) => (
                    <div key={axis} style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: '#475569' }}>{axis}</div>
                      <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#64748b' }}>
                        {metrics.kalmanVelocity[i].toFixed(1)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Global styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { overflow: hidden; background: #0b1426; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: #0b1426; }
        ::-webkit-scrollbar-thumb { background: #1e3a5f; border-radius: 3px; }
        canvas { user-select: none; -webkit-user-select: none; }
        @keyframes pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 5px currentColor; }
          50% { opacity: 0.5; box-shadow: 0 0 2px currentColor; }
        }
      `}</style>
    </div>
  );
};
