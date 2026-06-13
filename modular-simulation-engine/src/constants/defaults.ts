// ============================================================
// constants/defaults.ts — Single source of truth for config
//
// Calibration rationale (all derived from BALL_RADIUS = 0.55 m):
//
//   noiseStdDev default = 0.30 m  →  0.55× ball radius
//     • Sensor error visible but smaller than the ball — physically plausible
//     • rVariance = 0.09 m²
//     • 8σ outlier = 2.4 m — well outside ball but within box — visible
//
//   qNominal default = 0.005
//     • Q/R ratio = 0.005 / 0.09 ≈ 0.056 — lightly sensor-dominant
//     • Filter responds to real motion while rejecting noise on flat ground
//     • Avoids jitter when ball rolls slowly (previous 0.02 was too high)
//
//   qCollision = 5.0 — unchanged; 100× qNominal ensures snap re-acquisition
//
//   noiseStdDev max = 2.0 m  (≈ 3.6× ball radius, < 10× → spec compliant)
//   noiseStdDev min = 0.05 m (sub-ball, nearly ideal sensor)
// ============================================================

import type { SimConfig } from '@/types';

export const BALL_RADIUS = 0.55; // metres — used by physics, renderer, and sensor sizing

export const DEFAULT_CONFIG: SimConfig = {
  // Physics (internal coord: X=right, Y=depth, Z=up/gravity axis)
  gravity:       9.8,
  restitution:   0.85,
  airResistance: 0.05,
  boxSize:       20,
  dt:            1 / 60,

  // Sensor — calibrated so noise < ball diameter (1.1 m) at default
  noiseStdDev:    0.30,   // 0.55× BALL_RADIUS → clear but sub-ball noise
  sampleInterval: 2,
  dropRate:       0.10,

  // Kalman — Q/R ≈ 0.056: lightly sensor-dominant; no jitter on flat ground
  qNominal:   0.005,
  qCollision: 5.0,
  rVariance:  0.09,   // = 0.30²  — kept in sync with noiseStdDev
};

// Initial conditions: ball slightly above centre, strong upward+lateral velocity
// Physics Z=up: floor at Z = -(boxSize/2 - BALL_RADIUS) = -9.45
export const INITIAL_BALL_POSITION: [number, number, number] = [0, 0, -2];
export const INITIAL_BALL_VELOCITY:  [number, number, number] = [8, 5, 12];

export const TRAIL_MAX_POINTS          = 400;
export const METRICS_HISTORY_SIZE      = 200;
export const CHART_THROTTLE_FRAMES     = 4;
export const UI_UPDATE_THROTTLE_FRAMES = 8;

// Spike event display: how many frames to keep an outlier marker visible
export const SPIKE_DISPLAY_FRAMES = 45; // ~0.75 s at 60 fps

export const COLORS = {
  trueBall:     '#22c55e',
  kalmanBall:   '#06b6d4',
  sensorMarker: '#f43f5e',
  spikeMarker:  '#f97316',  // distinct orange for outlier — matches toggle colour
  trueTrail:    'rgba(34,197,94,0.45)',
  kalmanTrail:  'rgba(6,182,212,0.85)',
  boxEdge:      '#2d4a6e',
  ambient:      '#060d1a',
  surface:      '#0f1f35',
  surfaceHigh:  '#162840',
  border:       '#1e3a5f',
  borderBright: '#2d4a6e',
  accent:       '#38bdf8',
  accentGreen:  '#22c55e',
  accentAmber:  '#f59e0b',
  accentRed:    '#f43f5e',
  accentOrange: '#f97316',
  muted:        '#64748b',
  text:         '#e2e8f0',
  textDim:      '#94a3b8',
  textMuted:    '#64748b',
} as const;
