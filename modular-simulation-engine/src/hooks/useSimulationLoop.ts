// ============================================================
// hooks/useSimulationLoop.ts
// Orchestrates all subsystems per animation frame.
//
// Key design: visibility toggles and spike injection are read
// from useSimStore.getState() INSIDE tick() — not captured in
// the startLoop closure — so toggle changes take effect
// immediately without restarting the loop.
// ============================================================

import { useEffect, useRef, useCallback } from 'react';
import { PhysicsEngine }     from '@/physics/PhysicsEngine';
import { KalmanFilter3D }    from '@/core/KalmanFilter3D';
import { SensorSimulator, NoiseSpikeInjector } from '@/sensors/SensorSimulator';
import { MetricsAccumulator} from '@/core/MetricsAccumulator';
import { SceneBuilder }      from '@/rendering/SceneBuilder';
import { useSimStore }       from '@/store/simulationStore';
import {
  INITIAL_BALL_POSITION, INITIAL_BALL_VELOCITY,
  CHART_THROTTLE_FRAMES, UI_UPDATE_THROTTLE_FRAMES,
} from '@/constants/defaults';
import type { Vec3 } from '@/types';

export function useSimulationLoop(canvasRef: React.RefObject<HTMLCanvasElement>) {
  const sceneRef   = useRef<SceneBuilder | null>(null);
  const physicsRef = useRef<PhysicsEngine | null>(null);
  const filterRef  = useRef<KalmanFilter3D | null>(null);
  const sensorRef  = useRef<SensorSimulator | null>(null);
  const metricsRef = useRef<MetricsAccumulator | null>(null);
  const rafRef     = useRef<number>(0);
  const frameRef   = useRef(0);
  const lastKickRef = useRef(0);

  // Only subscribe to config+status — visibility/spike flags read fresh each tick
  const { config, status, pushMetrics, setChartHistory, setStatus } = useSimStore();

  // ── Initialise subsystems ──────────────────────────────────
  const init = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.clientWidth  || 900;
    const h = canvas.clientHeight || 560;

    sceneRef.current?.dispose();
    sceneRef.current = new SceneBuilder(canvas, w, h);

    physicsRef.current = new PhysicsEngine(
      [...INITIAL_BALL_POSITION] as Vec3,
      [...INITIAL_BALL_VELOCITY]  as Vec3,
      config,
    );

    filterRef.current = new KalmanFilter3D({
      qNominal:   config.qNominal,
      qCollision: config.qCollision,
      rVariance:  config.noiseStdDev * config.noiseStdDev,
    });
    filterRef.current.reset(
      [...INITIAL_BALL_POSITION] as Vec3,
      [...INITIAL_BALL_VELOCITY]  as Vec3,
    );

    sensorRef.current  = new SensorSimulator(config);
    metricsRef.current = new MetricsAccumulator();
    frameRef.current   = 0;
    lastKickRef.current = useSimStore.getState().kickCounter;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Hot-update config on slider changes ───────────────────
  useEffect(() => {
    physicsRef.current?.setConfig(config);
    sensorRef.current?.setConfig(config);
    filterRef.current?.configure(config, {
      qNominal:   config.qNominal,
      qCollision: config.qCollision,
      rVariance:  config.noiseStdDev * config.noiseStdDev,
    });
  }, [config]);

  // ── Animation loop ────────────────────────────────────────
  const startLoop = useCallback(() => {
    const physics = physicsRef.current!;
    const filter  = filterRef.current!;
    const sensor  = sensorRef.current!;
    const metrics = metricsRef.current!;
    const scene   = sceneRef.current!;

    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      frameRef.current++;
      const frame = frameRef.current;

      // Read ALL toggle state fresh each tick — no stale closures
      const {
        showTrueTrail, showKalmanTrail, showSensor, showForecast,
        spikeInjection, kickCounter, config: liveConfig,
      } = useSimStore.getState();

      // Apply config changes live (physics/sensor/filter hot-update handled by useEffect,
      // but we use liveConfig here for the filter predict call)
      const cfg = liveConfig;

      // ── Kick ────────────────────────────────────────────────
      if (kickCounter > lastKickRef.current) {
        lastKickRef.current = kickCounter;
        const angle = Math.random() * Math.PI * 2;
        const hSpd  = 8 + Math.random() * 6;
        physics.applyImpulse([
          hSpd * Math.cos(angle),
          hSpd * Math.sin(angle),
          16 + Math.random() * 4,
        ]);
        filter.applyKickHint();
      }

      // 1. Physics
      const { state, hitWall } = physics.step();
      const truePos = state.position;

      // 2. Kalman predict
      filter.predict(cfg, hitWall);

      // 3. Sensor sample
      let rawReading = sensor.sample(truePos, frame);
      let isSpike = false;
      if (spikeInjection) {
        const before = rawReading.available ? [...rawReading.noisy] : null;
        rawReading = NoiseSpikeInjector.inject(rawReading, 0.03);
        if (rawReading.available && before) {
          // Detect if inject changed the position significantly
          const dx = rawReading.noisy[0] - before[0];
          const dy = rawReading.noisy[1] - before[1];
          const dz = rawReading.noisy[2] - before[2];
          isSpike = Math.sqrt(dx*dx + dy*dy + dz*dz) > 2.0;
        }
      }

      let sensorPos: Vec3 | null = null;
      if (rawReading.available) {
        sensorPos = rawReading.noisy;
        filter.update(sensorPos);

        if (isSpike) {
          // Show large persistent orange spike marker
          scene.showSpikeMarker(sensorPos);
          // Normal sensor marker still shown briefly at spike location
          if (showSensor) scene.showSensorMarker(sensorPos);
        } else {
          if (showSensor) scene.showSensorMarker(sensorPos);
          else scene.hideSensorMarker();
        }
      } else {
        scene.hideSensorMarker();
      }

      // Tick spike marker countdown every frame
      scene.tickSpikeMarker();

      // 4. Kalman estimate
      const kState    = filter.getState();
      const kalmanPos = [kState.X[0], kState.X[1], kState.X[2]] as Vec3;

      // 5. Scene update — pass current toggle state directly
      scene.updateTrueBall(truePos, showTrueTrail);
      scene.updateKalmanBall(kalmanPos, showKalmanTrail);

      if (showForecast && frame % 6 === 0) {
        scene.updateForecast(physics.forecast(60));
      } else if (!showForecast) {
        scene.hideForecast();
      }

      // 6. Metrics
      const covariance = filter.getUncertainty();
      const m          = metrics.record(frame, truePos, kalmanPos, sensorPos, covariance);
      m.kalmanVelocity = [kState.X[3], kState.X[4], kState.X[5]] as Vec3;

      // 7. Throttled UI push
      if (frame % UI_UPDATE_THROTTLE_FRAMES === 0) pushMetrics(m);
      if (frame % CHART_THROTTLE_FRAMES      === 0) setChartHistory(metrics.getHistory());

      // 8. Render
      scene.render();
    };

    tick();
  }, [pushMetrics, setChartHistory]); // minimal deps — config/toggles read fresh inside tick

  // ── Lifecycle ─────────────────────────────────────────────
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const obs = new ResizeObserver(() => {
      sceneRef.current?.resize(canvas.clientWidth, canvas.clientHeight);
    });
    obs.observe(canvas);
    return () => obs.disconnect();
  }, [canvasRef]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      sceneRef.current?.dispose();
    };
  }, []);

  return { handleStart, handlePause, handleReset, handleRandomise };
}
