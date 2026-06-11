// ============================================================
// hooks/useSimulationLoop.ts
// Orchestrates: PhysicsEngine → SensorSimulator → KalmanFilter
//               → MetricsAccumulator → SceneBuilder → UI store
// The ONLY place that wires subsystems together.
// ============================================================

import { useEffect, useRef, useCallback } from 'react';
import { PhysicsEngine } from '@/physics/PhysicsEngine';
import { KalmanFilter3D } from '@/core/KalmanFilter3D';
import { SensorSimulator, NoiseSpikeInjector } from '@/sensors/SensorSimulator';
import { MetricsAccumulator } from '@/core/MetricsAccumulator';
import { SceneBuilder } from '@/rendering/SceneBuilder';
import { useSimStore } from '@/store/simulationStore';
import { INITIAL_BALL_POSITION, INITIAL_BALL_VELOCITY, CHART_THROTTLE_FRAMES, UI_UPDATE_THROTTLE_FRAMES } from '@/constants/defaults';
import type { Vec3 } from '@/types';

export function useSimulationLoop(canvasRef: React.RefObject<HTMLCanvasElement>) {
  const sceneRef = useRef<SceneBuilder | null>(null);
  const physicsRef = useRef<PhysicsEngine | null>(null);
  const filterRef = useRef<KalmanFilter3D | null>(null);
  const sensorRef = useRef<SensorSimulator | null>(null);
  const metricsRef = useRef<MetricsAccumulator | null>(null);
  const rafRef = useRef<number>(0);
  const frameRef = useRef(0);

  const { config, status, showTrueTrail, showKalmanTrail, showSensor, showForecast, spikeInjection, pushMetrics, setChartHistory, setStatus } = useSimStore();

  // ── Initialise subsystems ──────────────────────────────────
  const init = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const w = canvas.clientWidth || 900;
    const h = canvas.clientHeight || 560;

    sceneRef.current?.dispose();
    sceneRef.current = new SceneBuilder(canvas, w, h);

    physicsRef.current = new PhysicsEngine(
      [...INITIAL_BALL_POSITION] as Vec3,
      [...INITIAL_BALL_VELOCITY] as Vec3,
      config
    );

    filterRef.current = new KalmanFilter3D({
      qNominal: config.qNominal,
      qCollision: config.qCollision,
      rVariance: config.noiseStdDev * config.noiseStdDev,
    });
    filterRef.current.reset(
      [...INITIAL_BALL_POSITION] as Vec3,
      [...INITIAL_BALL_VELOCITY] as Vec3
    );

    sensorRef.current = new SensorSimulator(config);
    metricsRef.current = new MetricsAccumulator();
    frameRef.current = 0;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Hot-update config changes without restart ─────────────
  useEffect(() => {
    physicsRef.current?.setConfig(config);
    sensorRef.current?.setConfig(config);
    filterRef.current?.configure(config, {
      qNominal: config.qNominal,
      qCollision: config.qCollision,
      rVariance: config.noiseStdDev * config.noiseStdDev,
    });
  }, [config]);

  // ── Sync layer visibility ─────────────────────────────────
  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.setVisibility('trueTrail', showTrueTrail);
    sceneRef.current.setVisibility('kalmanTrail', showKalmanTrail);
    sceneRef.current.setVisibility('forecastLine', showForecast);
    if (!showSensor) sceneRef.current.hideSensorMarker();
  }, [showTrueTrail, showKalmanTrail, showSensor, showForecast]);

  // ── Animation loop ────────────────────────────────────────
  const startLoop = useCallback(() => {
    const physics = physicsRef.current!;
    const filter = filterRef.current!;
    const sensor = sensorRef.current!;
    const metrics = metricsRef.current!;
    const scene = sceneRef.current!;

    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      frameRef.current++;
      const frame = frameRef.current;

      // 1. Physics step
      const { state, hitWall } = physics.step();
      const truePos = state.position;

      // 2. Kalman predict
      filter.predict(config, hitWall);

      // 3. Sensor sample
      let rawReading = sensor.sample(truePos, frame);
      if (spikeInjection) rawReading = NoiseSpikeInjector.inject(rawReading, 0.03);

      let sensorPos: Vec3 | null = null;
      if (rawReading.available) {
        sensorPos = rawReading.noisy;
        filter.update(sensorPos);
        if (showSensor) scene.showSensorMarker(sensorPos);
      } else {
        scene.hideSensorMarker();
      }

      // 4. Get filter estimate
      const kState = filter.getState();
      const kalmanPos = [kState.X[0], kState.X[1], kState.X[2]] as Vec3;

      // 5. Update 3D scene
      scene.updateTrueBall(truePos);
      scene.updateKalmanBall(kalmanPos);

      if (showForecast && frame % 6 === 0) {
        scene.updateForecast(physics.forecast(60));
      }

      // 6. Metrics
      const covariance = filter.getUncertainty();
      const m = metrics.record(frame, truePos, kalmanPos, sensorPos, covariance);
      m.kalmanVelocity = [kState.X[3], kState.X[4], kState.X[5]] as Vec3;

      // 7. Throttled UI push
      if (frame % UI_UPDATE_THROTTLE_FRAMES === 0) {
        pushMetrics(m);
      }
      if (frame % CHART_THROTTLE_FRAMES === 0) {
        setChartHistory(metrics.getHistory());
      }

      // 8. Render
      scene.render();
    };

    tick();
  }, [config, showSensor, showForecast, spikeInjection, pushMetrics, setChartHistory]);

  // ── Lifecycle management ──────────────────────────────────
  useEffect(() => {
    if (status === 'running') {
      cancelAnimationFrame(rafRef.current);
      startLoop();
    } else {
      cancelAnimationFrame(rafRef.current);
    }
  }, [status, startLoop]);

  const handleStart = useCallback(() => {
    init();
    setStatus('running');
  }, [init, setStatus]);

  const handlePause = useCallback(() => {
    setStatus(status === 'running' ? 'paused' : 'running');
  }, [status, setStatus]);

  const handleReset = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setStatus('idle');
    init();
    sceneRef.current?.render();
    useSimStore.getState().clearMetrics();
  }, [init, setStatus]);

  const handleRandomise = useCallback(() => {
    physicsRef.current?.randomiseVelocity();
  }, []);

  // Resize observer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const obs = new ResizeObserver(() => {
      sceneRef.current?.resize(canvas.clientWidth, canvas.clientHeight);
    });
    obs.observe(canvas);
    return () => obs.disconnect();
  }, [canvasRef]);

  // Cleanup
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      sceneRef.current?.dispose();
    };
  }, []);

  return { handleStart, handlePause, handleReset, handleRandomise };
}
