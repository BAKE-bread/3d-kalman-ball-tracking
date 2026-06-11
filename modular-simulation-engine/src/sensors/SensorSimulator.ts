// ============================================================
// sensors/SensorSimulator.ts
// Non-ideal sensor emulation: downsampling + Gaussian noise + drop.
// Implements ISensorPlugin for future multi-sensor extension.
// ============================================================

import { gaussianNoise } from '@/utils/matrix';
import type { Vec3, SensorConfig, SensorReading, ISensorPlugin } from '@/types';

export class SensorSimulator implements ISensorPlugin {
  readonly name = 'Simulated Lidar/CV Sensor';
  private config: SensorConfig;
  private totalDropped = 0;
  private totalEmitted = 0;
  private totalSampled = 0;

  constructor(config: SensorConfig) {
    this.config = { ...config };
  }

  // ── Public API ──────────────────────────────────────────────

  public setConfig(config: Partial<SensorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Attempt a sample at the given frame.
   * Returns { available: false } when:
   *   (a) frame is not on the sample-interval boundary, or
   *   (b) packet is randomly dropped
   */
  public sample(truePos: Vec3, frame: number): SensorReading {
    // Gate 1: sample interval
    if (frame % this.config.sampleInterval !== 0) {
      return { available: false, frame };
    }

    this.totalSampled++;

    // Gate 2: random packet drop
    if (Math.random() < this.config.dropRate) {
      this.totalDropped++;
      return { available: false, frame };
    }

    this.totalEmitted++;
    const σ = this.config.noiseStdDev;
    const noisy: Vec3 = [
      truePos[0] + gaussianNoise(0, σ),
      truePos[1] + gaussianNoise(0, σ),
      truePos[2] + gaussianNoise(0, σ),
    ];

    return { available: true, position: [...truePos] as Vec3, noisy, frame };
  }

  public reset(): void {
    this.totalDropped = 0;
    this.totalEmitted = 0;
    this.totalSampled = 0;
  }

  public getStats(): {
    emitted: number;
    dropped: number;
    sampled: number;
    effectiveDropRate: number;
  } {
    return {
      emitted: this.totalEmitted,
      dropped: this.totalDropped,
      sampled: this.totalSampled,
      effectiveDropRate: this.totalSampled > 0
        ? this.totalDropped / this.totalSampled
        : 0,
    };
  }
}

// ── Future extension: add GPS, Radar, Ultrasonic sensors ────
// Each can implement ISensorPlugin and be hot-swapped in the store.
export class NoiseSpikeInjector {
  /** Randomly corrupt a reading with a gross outlier */
  static inject(reading: SensorReading, probability = 0.02): SensorReading {
    if (!reading.available) return reading;
    if (Math.random() > probability) return reading;
    const spike = 8;
    const noisy: Vec3 = [
      reading.noisy[0] + gaussianNoise(0, spike),
      reading.noisy[1] + gaussianNoise(0, spike),
      reading.noisy[2] + gaussianNoise(0, spike),
    ];
    return { ...reading, noisy };
  }
}
