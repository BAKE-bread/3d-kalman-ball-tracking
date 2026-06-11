// ============================================================
// core/MetricsAccumulator.ts
// Rolling RMSE and telemetry accumulation.
// Pure computation — no side-effects.
// ============================================================

import { dist3 } from '@/utils/matrix';
import type { Vec3, FrameMetrics, ChartPoint } from '@/types';
import { METRICS_HISTORY_SIZE } from '@/constants/defaults';

export class MetricsAccumulator {
  private sumSqKalman = 0;
  private sumSqSensor = 0;
  private frameCount = 0;
  private sensorCount = 0;
  private history: ChartPoint[] = [];

  public record(
    frame: number,
    truePos: Vec3,
    kalmanPos: Vec3,
    sensorPos: Vec3 | null,
    covariance: number
  ): FrameMetrics {
    this.frameCount++;

    const errK = dist3(truePos, kalmanPos);
    this.sumSqKalman += errK * errK;

    let errS = NaN;
    if (sensorPos) {
      errS = dist3(truePos, sensorPos);
      this.sumSqSensor += errS * errS;
      this.sensorCount++;
    }

    const rmseK = Math.sqrt(this.sumSqKalman / this.frameCount);
    const rmseS = this.sensorCount > 0
      ? Math.sqrt(this.sumSqSensor / this.sensorCount)
      : 0;

    const point: ChartPoint = {
      frame,
      kalman: Number(rmseK.toFixed(4)),
      sensor: this.sensorCount > 0 ? Number(rmseS.toFixed(4)) : null,
      covariance: Number(covariance.toFixed(4)),
    };

    this.history.push(point);
    if (this.history.length > METRICS_HISTORY_SIZE) this.history.shift();

    return {
      frame,
      truePos,
      kalmanPos,
      sensorPos,
      errorKalman: errK,
      errorSensor: errS,
      rmseKalman: rmseK,
      rmseSensor: rmseS,
      kalmanVelocity: [0, 0, 0] as Vec3, // populated by caller
      covariance,
    };
  }

  public getHistory(): ChartPoint[] {
    return [...this.history];
  }

  public reset(): void {
    this.sumSqKalman = 0;
    this.sumSqSensor = 0;
    this.frameCount = 0;
    this.sensorCount = 0;
    this.history = [];
  }

  public getSnapshot() {
    return {
      frames: this.frameCount,
      sensorFrames: this.sensorCount,
      rmseKalman: this.frameCount > 0
        ? Math.sqrt(this.sumSqKalman / this.frameCount)
        : 0,
      rmseSensor: this.sensorCount > 0
        ? Math.sqrt(this.sumSqSensor / this.sensorCount)
        : 0,
    };
  }
}
