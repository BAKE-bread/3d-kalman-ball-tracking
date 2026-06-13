// ============================================================
// core/KalmanFilter3D.ts
// 6-DOF linear Kalman filter with adaptive Q inflation.
// Implements IFilterPlugin interface for future hot-swapping.
// ============================================================

import {
  zeros, identity, matMul, transpose, matAdd, matSub, trace,
  invert3x3,
} from '@/utils/matrix';
import type {
  Vec3, Vec6, Mat6x6,
  KalmanConfig, KalmanState, IFilterPlugin, PhysicsConfig,
} from '@/types';

export class KalmanFilter3D implements IFilterPlugin {
  readonly name = 'Linear Kalman Filter (6-DOF)';

  public X: number[];   // state vector [x,y,z,vx,vy,vz]
  public P: Mat6x6;     // state covariance 6×6

  private Q: Mat6x6;
  private R: number[][];
  private F: Mat6x6;
  private H: number[][];
  private B: number[][];
  private U: number[];

  private config: KalmanConfig;
  /** Frames remaining for kick-hint Q inflation */
  private _kickInflateFrames = 0;

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

  public configure(physics: PhysicsConfig, kalman: KalmanConfig): void {
    this.config = kalman;
    this._buildStaticMatrices(physics.dt, physics.gravity, kalman.qNominal, kalman.rVariance);
  }

  public reset(pos: Vec3, vel: Vec3): void {
    this.X = [...pos, ...vel];
    this.P = identity(6);
    for (let i = 0; i < 6; i++) this.P[i][i] = 100;
    this._kickInflateFrames = 0;
  }

  /**
   * Notify the filter that an external impulse was applied to the ball.
   * Inflates Q for several frames so the filter rapidly re-tracks.
   */
  public applyKickHint(frames = 10): void {
    this._kickInflateFrames = frames;
  }

  public predict(physics: PhysicsConfig, hitWall = false): void {
    this._buildStaticMatrices(
      physics.dt, physics.gravity,
      this.config.qNominal, this.config.rVariance,
    );

    let qVal = this.config.qNominal;
    if (hitWall) {
      qVal = this.config.qCollision;
    } else if (this._kickInflateFrames > 0) {
      qVal = this.config.qCollision; // same large Q for kick re-acquisition
      this._kickInflateFrames--;
    }
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
    const FP   = matMul(this.F, this.P);
    const FPFt = matMul(FP, transpose(this.F));
    this.P = matAdd(FPFt, this.Q);
  }

  public update(z: Vec3): void {
    const y = [z[0] - this.X[0], z[1] - this.X[1], z[2] - this.X[2]];

    // S = H*P*H^T + R  (H picks top-3 rows → S[i][j] = P[i][j] + R[i][j])
    const S: number[][] = [[0,0,0],[0,0,0],[0,0,0]];
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++)
        S[i][j] = this.P[i][j] + this.R[i][j];

    const invS = invert3x3(S);
    if (!invS) return;

    // K = P * H^T * S^{-1}
    const K: number[][] = Array.from({ length: 6 }, (_, i) =>
      [0, 1, 2].map(j =>
        [0, 1, 2].reduce((s, k) => s + this.P[i][k] * invS[k][j], 0),
      )
    );

    // X = X + K * y
    for (let i = 0; i < 6; i++)
      this.X[i] += K[i][0] * y[0] + K[i][1] * y[1] + K[i][2] * y[2];

    // P = (I - K*H) * P
    const KH: Mat6x6 = zeros(6);
    for (let i = 0; i < 6; i++)
      for (let j = 0; j < 3; j++)
        KH[i][j] = K[i][j];

    this.P = matMul(matSub(identity(6), KH), this.P);
  }

  public getState(): KalmanState {
    return {
      X: [...this.X] as Vec6,
      P: this.P.map(r => [...r]),
    };
  }

  public getUncertainty(): number {
    return trace(this.P);
  }

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
    this.F = [
      [1, 0, 0, dt, 0,  0 ],
      [0, 1, 0,  0, dt, 0 ],
      [0, 0, 1,  0, 0,  dt],
      [0, 0, 0,  1, 0,  0 ],
      [0, 0, 0,  0, 1,  0 ],
      [0, 0, 0,  0, 0,  1 ],
    ];
    // Gravity acts on Z axis (index 2)
    this.B = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0.5 * dt * dt],
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, dt],
    ];
    this.U = [0, 0, -g];
    this.H = [
      [1, 0, 0, 0, 0, 0],
      [0, 1, 0, 0, 0, 0],
      [0, 0, 1, 0, 0, 0],
    ];
    this._setQDiagonal(qVal);
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
