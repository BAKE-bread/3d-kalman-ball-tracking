// ============================================================
// types/index.ts  — Centralised type registry
// All domain types in one place; import from '@/types'
// ============================================================

// ─── Vector / Matrix primitives ──────────────────────────────
export type Vec3 = [number, number, number];
export type Vec6 = [number, number, number, number, number, number];
export type Mat3x3 = [[number,number,number],[number,number,number],[number,number,number]];
export type Mat6x6 = number[][];
export type Mat6x3 = number[][];
export type Mat3x6 = number[][];

// ─── Physics ─────────────────────────────────────────────────
export interface PhysicsConfig {
  gravity: number;          // m/s²
  restitution: number;      // 0–1  elastic coefficient
  airResistance: number;    // damping constant per axis per second
  boxSize: number;          // half-edge length of cube
  dt: number;               // fixed simulation timestep (s)
}

export interface PhysicsState {
  position: Vec3;
  velocity: Vec3;
}

export type CollisionEvent = {
  axis: 0 | 1 | 2;
  face: 'min' | 'max';
  time: number; // simulation frame index
};

// ─── Sensor ──────────────────────────────────────────────────
export interface SensorConfig {
  /** Gaussian noise std-dev injected per axis (metres) */
  noiseStdDev: number;
  /** Only emit a reading every N simulation frames */
  sampleInterval: number;
  /** Probability [0–1] that any given sample is dropped */
  dropRate: number;
}

export type SensorReading =
  | { available: true; position: Vec3; noisy: Vec3; frame: number }
  | { available: false; frame: number };

// ─── Kalman Filter ───────────────────────────────────────────
export interface KalmanConfig {
  /** Initial process noise diagonal value */
  qNominal: number;
  /** Inflated Q value injected when wall-hit detected */
  qCollision: number;
  /** Measurement noise variance (σ² per axis) */
  rVariance: number;
}

export interface KalmanState {
  /** State vector [x,y,z,vx,vy,vz] */
  X: Vec6;
  /** 6×6 covariance matrix */
  P: Mat6x6;
}

// ─── Metrics ─────────────────────────────────────────────────
export interface FrameMetrics {
  frame: number;
  truePos: Vec3;
  kalmanPos: Vec3;
  sensorPos: Vec3 | null;
  errorKalman: number;    // instantaneous 3-D distance
  errorSensor: number;    // instantaneous 3-D distance (NaN when dropped)
  rmseKalman: number;     // cumulative
  rmseSensor: number;     // cumulative (sensor frames only)
  kalmanVelocity: Vec3;
  covariance: number;     // trace(P) — scalar uncertainty proxy
}

// ─── Simulation control ──────────────────────────────────────
export type SimStatus = 'idle' | 'running' | 'paused';

export interface SimConfig extends PhysicsConfig, SensorConfig, KalmanConfig {}

// ─── Chart data ──────────────────────────────────────────────
export interface ChartPoint {
  frame: number;
  kalman: number;
  sensor: number | null;
  covariance: number;
}

// ─── Three.js scene handles (passed around without ref drilling) ──
export interface SceneHandles {
  renderer: unknown;
  scene: unknown;
  camera: unknown;
  controls: unknown;
}

// ─── Extension hook interfaces (reserved for future sensors) ─
export interface ISensorPlugin {
  name: string;
  sample(truePos: Vec3, frame: number): SensorReading;
  reset(): void;
}

export interface IFilterPlugin {
  name: string;
  predict(config: PhysicsConfig): void;
  update(z: Vec3): void;
  getState(): KalmanState;
  reset(pos: Vec3, vel: Vec3): void;
}
