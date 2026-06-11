// ============================================================
// core/KalmanFilter3D.ts
// 6-DOF linear Kalman filter with adaptive Q inflation.
// Implements IFilterPlugin interface for future hot-swapping.
// ============================================================

import {
  zeros, identity, matMul, transpose, matAdd, matSub, trace,
  invert3x3
} from '@/utils/matrix';
import type { Vec3, Vec6, Mat6x6, KalmanConfig, KalmanState, IFilterPlugin, PhysicsConfig } from '@/types';

export class KalmanFilter3D implements IFilterPlugin {
  readonly name = 'Linear Kalman Filter (6-DOF)';

  /** State vector: [x, y, z, vx, vy, vz] */
  public X: number[];
  /** State covariance 6×6 */
  public P: Mat6x6;

  private Q: Mat6x6;           // process noise
  private R: number[][];        // measurement noise 3×3
  private F: Mat6x6;            // state transition
  private H: number[][];        // observation 3×6
  private B: number[][];        // control matrix 6×3
  private U: number[];          // control input [0,0,-g]

  private config: KalmanConfig;

  constructor(config: KalmanConfig) {
    this.config = config;
    this.X = [0, 0, 0, 0, 0, 0];
    this.P = identity(6);
    this.Q = zeros(6);
    this.R = zeros(3);
    this.F = zeros(6);
    this.H = zeros(3).map(() => new Array(6).fill(0));
    this.B = zeros(6).map(() => new Array(3).fill(0));
    this.U = [0, 0, 0];
    this._buildStaticMatrices(1 / 60, 9.8, config.qNominal, config.rVariance);
  }

  // ── Public API ──────────────────────────────────────────────

  /** (Re)initialise all matrices when physics config changes */
  public configure(physics: PhysicsConfig, kalman: KalmanConfig): void {
    this.config = kalman;
    this._buildStaticMatrices(physics.dt, physics.gravity, kalman.qNominal, kalman.rVariance);
  }

  /** Hard-set ball state (used on simulation reset) */
  public reset(pos: Vec3, vel: Vec3): void {
    this.X = [...pos, ...vel];
    this.P = identity(6);
    for (let i = 0; i < 6; i++) this.P[i][i] = 100; // high initial uncertainty
  }

  /**
   * Prediction step: propagate state forward one dt.
   * hitWall triggers adaptive Q inflation to handle
   * the instantaneous velocity reversal at boundaries.
   */
  public predict(physics: PhysicsConfig, hitWall = false): void {
    // Update F/B/U for current physics config (handles live dt changes)
    this._buildStaticMatrices(physics.dt, physics.gravity, this.config.qNominal, this.config.rVariance);

    const qVal = hitWall ? this.config.qCollision : this.config.qNominal;
    this._setQDiagonal(qVal);

    // X_k = F * X_{k-1} + B * U
    const newX = new Array(6).fill(0);
    for (let i = 0; i < 6; i++) {
      let s = 0;
      for (let j = 0; j < 6; j++) s += this.F[i][j] * this.X[j];
      for (let j = 0; j < 3; j++) s += this.B[i][j] * this.U[j];
      newX[i] = s;
    }
    this.X = newX;

    // P_k = F * P_{k-1} * F^T + Q
    const FP = matMul(this.F, this.P);
    const Ft = transpose(this.F);
    const FPFt = matMul(FP, Ft);
    this.P = matAdd(FPFt, this.Q);
  }

  /**
   * Update step: incorporate a 3D position measurement.
   * Silently skips if S is singular (measurement arrives during divergence).
   */
  public update(z: Vec3): void {
    // Innovation: y = z - H * X
    const Hx = [this.X[0], this.X[1], this.X[2]];
    const y = [z[0] - Hx[0], z[1] - Hx[1], z[2] - Hx[2]];

    // S = H * P * H^T + R  (H selects top-3 rows/cols → S[i][j] = P[i][j] + R[i][j])
    const S: number[][] = [[0,0,0],[0,0,0],[0,0,0]];
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++)
        S[i][j] = this.P[i][j] + this.R[i][j];

    const invS = invert3x3(S);
    if (!invS) return; // singular — skip this measurement

    // K = P * H^T * S^{-1}  (H^T: top-3 cols of identity → K = first 3 cols of P * invS)
    const Pt = transpose(this.P);
    const PHt: number[][] = Pt.slice(0, 3).map((_, j) =>
      this.P.map(row => row[j])
    ).slice(0, 3);

    // PHt is 6×3: PHt[i][j] = P[i][j] for j<3
    const K: number[][] = Array.from({ length: 6 }, (_, i) =>
      [0, 1, 2].map(j =>
        [0, 1, 2].reduce((s, k) => s + this.P[i][k] * invS[k][j], 0)
      )
    );

    // X = X + K * y
    for (let i = 0; i < 6; i++)
      this.X[i] += K[i][0] * y[0] + K[i][1] * y[1] + K[i][2] * y[2];

    // P = (I - K*H) * P  — using Joseph form for numerical stability
    // KH[i][j] = K[i][0]*H[0][j] + ... ≈ K[i][j] for j<3, else 0
    const KH: Mat6x6 = zeros(6);
    for (let i = 0; i < 6; i++)
      for (let j = 0; j < 3; j++)
        KH[i][j] = K[i][j];

    const IminusKH: Mat6x6 = matSub(identity(6), KH);
    this.P = matMul(IminusKH, this.P);
  }

  /** Snapshot of current filter state (immutable copy) */
  public getState(): KalmanState {
    return {
      X: [...this.X] as Vec6,
      P: this.P.map(r => [...r]),
    };
  }

  /** Scalar uncertainty proxy = trace(P) */
  public getUncertainty(): number {
    return trace(this.P);
  }

  /** Mahalanobis distance of innovation (used for χ² outlier detection) */
  public mahalanobis(z: Vec3): number {
    const y = [z[0] - this.X[0], z[1] - this.X[1], z[2] - this.X[2]];
    const S: number[][] = [[0,0,0],[0,0,0],[0,0,0]];
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++)
        S[i][j] = this.P[i][j] + this.R[i][j];
    const invS = invert3x3(S);
    if (!invS) return Infinity;
    let d2 = 0;
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++)
        d2 += y[i] * invS[i][j] * y[j];
    return Math.sqrt(Math.max(0, d2));
  }

  // ── Private helpers ─────────────────────────────────────────

  private _buildStaticMatrices(dt: number, g: number, qVal: number, rVal: number): void {
    // State transition matrix
    this.F = [
      [1, 0, 0, dt, 0,  0 ],
      [0, 1, 0,  0, dt, 0 ],
      [0, 0, 1,  0, 0,  dt],
      [0, 0, 0,  1, 0,  0 ],
      [0, 0, 0,  0, 1,  0 ],
      [0, 0, 0,  0, 0,  1 ],
    ];
    // Control matrix (gravity acts on z)
    this.B = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0.5 * dt * dt],
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, dt],
    ];
    this.U = [0, 0, -g];
    // Observation matrix (position only)
    this.H = [
      [1, 0, 0, 0, 0, 0],
      [0, 1, 0, 0, 0, 0],
      [0, 0, 1, 0, 0, 0],
    ];
    this._setQDiagonal(qVal);
    // Measurement noise R (diagonal)
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++)
        this.R[i][j] = i === j ? rVal : 0;
  }

  private _setQDiagonal(qVal: number): void {
    for (let i = 0; i < 6; i++)
      for (let j = 0; j < 6; j++)
        this.Q[i][j] = i === j ? qVal : 0;
  }
}
