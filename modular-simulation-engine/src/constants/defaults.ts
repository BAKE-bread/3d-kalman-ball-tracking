// ============================================================
// constants/defaults.ts — Single source of truth for config
// ============================================================

import type { SimConfig } from '@/types';

export const DEFAULT_CONFIG: SimConfig = {
  // Physics
  gravity: 9.8,
  restitution: 0.85,
  airResistance: 0.05,
  boxSize: 20,
  dt: 1 / 60,

  // Sensor
  noiseStdDev: 1.5,
  sampleInterval: 2,
  dropRate: 0.15,

  // Kalman
  qNominal: 0.02,
  qCollision: 5.0,
  rVariance: 2.25,   // = 1.5²
};

export const INITIAL_BALL_POSITION: [number, number, number] = [0, 6, 2];
export const INITIAL_BALL_VELOCITY: [number, number, number] = [8, 12, 5];

export const TRAIL_MAX_POINTS = 400;
export const METRICS_HISTORY_SIZE = 200;
export const CHART_THROTTLE_FRAMES = 4;
export const UI_UPDATE_THROTTLE_FRAMES = 10;

export const COLORS = {
  trueBall: '#22c55e',
  kalmanBall: '#06b6d4',
  sensorMarker: '#f43f5e',
  trueTrail: 'rgba(34,197,94,0.45)',
  kalmanTrail: 'rgba(6,182,212,0.85)',
  boxEdge: '#334155',
  ambient: '#0f172a',
  surface: '#1e293b',
  surfaceHighlight: '#273549',
  border: '#334155',
  accent: '#38bdf8',
  accentGreen: '#22c55e',
  accentRed: '#f43f5e',
  muted: '#64748b',
  text: '#e2e8f0',
  textDim: '#94a3b8',
} as const;
