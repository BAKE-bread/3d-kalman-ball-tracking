// ============================================================
// physics/PhysicsEngine.ts
// Deterministic kinematic simulator for the bouncing ball.
// Zero coupling to rendering or filter — easy to unit-test.
// ============================================================

import type { Vec3, PhysicsConfig, PhysicsState, CollisionEvent } from '@/types';
import { clamp } from '@/utils/matrix';

export class PhysicsEngine {
  private pos: Vec3;
  private vel: Vec3;
  private config: PhysicsConfig;
  private frameIndex = 0;
  private collisionLog: CollisionEvent[] = [];

  constructor(
    initialPos: Vec3,
    initialVel: Vec3,
    config: PhysicsConfig
  ) {
    this.pos = [...initialPos] as Vec3;
    this.vel = [...initialVel] as Vec3;
    this.config = { ...config };
  }

  // ── Public API ──────────────────────────────────────────────

  /** Update physics config live (e.g. slider changes) */
  public setConfig(config: Partial<PhysicsConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /** Advance simulation by one fixed dt. Returns collision info. */
  public step(): { state: PhysicsState; hitWall: boolean; events: CollisionEvent[] } {
    const { dt, gravity, airResistance, restitution, boxSize } = this.config;
    this.frameIndex++;
    this.collisionLog = [];

    // ── Gravity ───────────────────────────────────────────────
    this.vel[2] -= gravity * dt;

    // ── Air resistance (exponential decay approx) ─────────────
    const drag = 1 - clamp(airResistance * dt, 0, 0.99);
    this.vel[0] *= drag;
    this.vel[1] *= drag;
    this.vel[2] *= drag;

    // ── Integrate position ────────────────────────────────────
    this.pos[0] += this.vel[0] * dt;
    this.pos[1] += this.vel[1] * dt;
    this.pos[2] += this.vel[2] * dt;

    // ── Elastic boundary collisions ───────────────────────────
    const half = boxSize / 2;
    let hitWall = false;

    for (let i = 0; i < 3; i++) {
      if (this.pos[i] > half) {
        this.pos[i] = half;
        this.vel[i] = -Math.abs(this.vel[i]) * restitution;
        hitWall = true;
        this.collisionLog.push({ axis: i as 0|1|2, face: 'max', time: this.frameIndex });
      } else if (this.pos[i] < -half) {
        this.pos[i] = -half;
        this.vel[i] = Math.abs(this.vel[i]) * restitution;
        hitWall = true;
        this.collisionLog.push({ axis: i as 0|1|2, face: 'min', time: this.frameIndex });
      }
    }

    return {
      state: this.getState(),
      hitWall,
      events: [...this.collisionLog],
    };
  }

  /** Full reset to given initial conditions */
  public reset(pos: Vec3, vel: Vec3): void {
    this.pos = [...pos] as Vec3;
    this.vel = [...vel] as Vec3;
    this.frameIndex = 0;
    this.collisionLog = [];
  }

  /** Randomise initial velocity within a range */
  public randomiseVelocity(speed = 14): void {
    // Random unit vector * speed
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    this.vel = [
      speed * Math.sin(phi) * Math.cos(theta),
      speed * Math.sin(phi) * Math.sin(theta),
      speed * Math.cos(phi),
    ];
  }

  /** Immutable snapshot */
  public getState(): PhysicsState {
    return {
      position: [...this.pos] as Vec3,
      velocity: [...this.vel] as Vec3,
    };
  }

  public getFrame(): number {
    return this.frameIndex;
  }

  /** Predict future trajectory for N steps (used by renderer for ghost trail) */
  public forecast(steps: number): Vec3[] {
    const { dt, gravity, airResistance, restitution, boxSize } = this.config;
    const half = boxSize / 2;
    let p = [...this.pos] as Vec3;
    let v = [...this.vel] as Vec3;
    const path: Vec3[] = [];

    for (let s = 0; s < steps; s++) {
      v[2] -= gravity * dt;
      const drag = 1 - clamp(airResistance * dt, 0, 0.99);
      for (let i = 0; i < 3; i++) v[i] *= drag;
      for (let i = 0; i < 3; i++) {
        p[i] += v[i] * dt;
        if (p[i] > half) { p[i] = half; v[i] = -Math.abs(v[i]) * restitution; }
        else if (p[i] < -half) { p[i] = -half; v[i] = Math.abs(v[i]) * restitution; }
      }
      path.push([...p] as Vec3);
    }
    return path;
  }
}
