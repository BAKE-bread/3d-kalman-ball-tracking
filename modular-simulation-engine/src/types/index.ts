// ============================================================
// types/index.ts  — Centralised type registry
// All domain types in one place; import from '@/types'
// ============================================================

// ─── Vector / Matrix primitives ──────────────────────────────
export type Vec3   = [number, number, number];
export type Vec6   = [number, number, number, number, number, number];
export type Mat3x3 = [[number,number,number],[number,number,number],[number,number,number]];
export type Mat6x6 = number[][];
export type Mat6x3 = number[][];
export type Mat3x6 = number[][];

// ─── Physics ─────────────────────────────────────────────────
export interface PhysicsConfig {
  gravity:       number;   // m/s²  — acts on internal Z axis
  restitution:   number;   // 0–1   elastic coefficient
  airResistance: number;   // linear drag constant per second
  boxSize:       number;   // full edge length of cube (metres)
  dt:            number;   // fixed simulation timestep (s)
}

export interface PhysicsState {
  position: Vec3;
  velocity: Vec3;
}

export type CollisionEvent = {
  axis: 0 | 1 | 2;
  face: 'min' | 'max';
  time: number;  // simulation frame index
};

// ─── Sensor ──────────────────────────────────────────────────
export interface SensorConfig {
  /** Gaussian noise std-dev injected per axis (metres) */
  noiseStdDev:    number;
  /** Only emit a reading every N simulation frames */
  sampleInterval: number;
  /** Probability [0–1] that any given sample is dropped */
  dropRate:       number;
}

export type SensorReading =
  | { available: true;  position: Vec3; noisy: Vec3; frame: number }
  | { available: false; frame: number };

// ─── Kalman Filter ───────────────────────────────────────────
export interface KalmanConfig {
  qNominal:   number;  // process noise diagonal (nominal)
  qCollision: number;  // inflated Q at wall-hit / kick events
  rVariance:  number;  // measurement noise variance (σ² per axis)
}

export interface KalmanState {
  X: Vec6;    // state vector [x,y,z,vx,vy,vz]
  P: Mat6x6;  // 6×6 covariance matrix
}

// ─── Metrics ─────────────────────────────────────────────────
export interface FrameMetrics {
  frame:          number;
  truePos:        Vec3;
  kalmanPos:      Vec3;
  sensorPos:      Vec3 | null;
  errorKalman:    number;   // instantaneous 3-D Euclidean distance
  errorSensor:    number;   // instantaneous 3-D distance (NaN when dropped)
  rmseKalman:     number;   // cumulative
  rmseSensor:     number;   // cumulative (sensor frames only)
  kalmanVelocity: Vec3;
  covariance:     number;   // trace(P) — scalar uncertainty proxy
}

// ─── Simulation control ──────────────────────────────────────
export type SimStatus = 'idle' | 'running' | 'paused';

export interface SimConfig extends PhysicsConfig, SensorConfig, KalmanConfig {}

// ─── Chart data ──────────────────────────────────────────────
export interface ChartPoint {
  frame:      number;
  kalman:     number;
  sensor:     number | null;
  covariance: number;
}

// ─── Extension hook interfaces (reserved for future sensors / filters) ─
export interface ISensorPlugin {
  name:   string;
  sample(truePos: Vec3, frame: number): SensorReading;
  reset(): void;
}

export interface IFilterPlugin {
  name: string;
  /**
   * Predict step.
   * @param physics — current physics config (provides dt, gravity)
   * @param hitWall — true when a wall collision was detected this frame
   */
  predict(physics: PhysicsConfig, hitWall?: boolean): void;
  update(z: Vec3): void;
  getState(): KalmanState;
  reset(pos: Vec3, vel: Vec3): void;
  applyKickHint(frames?: number): void;
}
