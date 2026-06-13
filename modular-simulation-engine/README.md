# KalmanTracker 3D

**Real-time 3D Kalman Filter State Estimation — Production Prototype**

A production-grade, browser-based simulation platform for 6-DOF Kalman filtering of a bouncing ball in a closed 3D space. Demonstrates non-ideal sensor data fusion, adaptive process-noise tuning, and live metric evaluation in a fully interactive WebGL environment.

---

## Recommended IDE & Environment

| Tool | Recommended | Notes |
|------|-------------|-------|
| **Editor** | [Visual Studio Code](https://code.visualstudio.com/) | Best-in-class TypeScript/React DX |
| **Runtime** | Node.js ≥ 18 LTS | `node -v` to verify |
| **Package manager** | `pnpm` (preferred) or `npm` | `npm i -g pnpm` |
| **Browser** | Chrome / Edge (latest) | WebGL2 required; hardware acceleration on |
| **Extensions** | ESLint, Prettier, Volar / TS Plugin | Listed in `.vscode/extensions.json` |

```
# Clone and install
git clone <repo>
cd kalman-tracker-3d
pnpm install        # or: npm install

# Development server (hot-reload)
pnpm dev            # Opens http://localhost:5173

# Type-check without building
pnpm type-check

# Production build
pnpm build          # Output → dist/

# Preview production build
pnpm preview
```

---

## File Architecture

```
kalman-tracker-3d/
│
├── index.html                      # HTML shell — single SPA entry point
├── package.json                    # Dependencies and scripts
├── tsconfig.json                   # TypeScript compiler config
├── vite.config.ts                  # Vite bundler config (path aliases, HMR)
│
└── src/
    │
    ├── main.tsx                    # React 18 root mount
    ├── App.tsx                     # Root layout: viewport + sidebar + chart
    │
    ├── types/
    │   └── index.ts                # ★ ALL domain types in one registry
    │                               #   Vec3, PhysicsConfig, SensorReading,
    │                               #   KalmanState, FrameMetrics, SimConfig
    │                               #   IFilterPlugin, ISensorPlugin (extension pts)
    │
    ├── constants/
    │   └── defaults.ts             # Single source of truth for default values
    │                               #   DEFAULT_CONFIG, COLORS, trail limits
    │
    ├── utils/
    │   └── matrix.ts               # Pure linear-algebra helpers (no side-effects)
    │                               #   zeros, identity, matMul, transpose, invert3x3
    │                               #   gaussianNoise, dist3, clamp
    │
    ├── core/
    │   ├── KalmanFilter3D.ts       # ★ 6-DOF linear KF with adaptive Q inflation
    │   │                           #   predict(physics, hitWall) / update(z: Vec3)
    │   │                           #   mahalanobis() for χ² outlier detection
    │   │                           #   Implements IFilterPlugin for hot-swap
    │   └── MetricsAccumulator.ts   # Rolling RMSE, chart history, snapshots
    │
    ├── physics/
    │   └── PhysicsEngine.ts        # ★ Deterministic Newtonian simulator
    │                               #   step() → {state, hitWall, events}
    │                               #   forecast(n) → Vec3[]  (ghost preview)
    │                               #   randomiseVelocity()
    │
    ├── sensors/
    │   └── SensorSimulator.ts      # Non-ideal sensor: downsample + noise + drop
    │                               #   Implements ISensorPlugin for multi-sensor ext.
    │                               #   NoiseSpikeInjector  (gross outlier injection)
    │
    ├── rendering/
    │   └── SceneBuilder.ts         # ★ Three.js scene ownership
    │                               #   updateTrueBall / updateKalmanBall / showSensorMarker
    │                               #   updateForecast / clearTrails
    │                               #   Built-in drag/zoom orbit camera
    │
    ├── store/
    │   └── simulationStore.ts      # Zustand global state (4 slices)
    │                               #   ConfigSlice / MetricsSlice
    │                               #   ControlSlice / UISlice
    │
    ├── hooks/
    │   └── useSimulationLoop.ts    # ★ Orchestration: wires ALL subsystems together
    │                               #   PhysicsEngine → Sensor → KalmanFilter
    │                               #   → Metrics → SceneBuilder → UI store
    │                               #   handleStart / handlePause / handleReset
    │
    └── components/
        ├── ui/
        │   ├── Slider.tsx          # Accessible range slider with live value
        │   └── Controls.tsx        # Button, Toggle, MetricCard, StatusPill, Tab
        │
        ├── panels/
        │   ├── PhysicsPanel.tsx    # g, restitution, air-resistance sliders
        │   ├── SensorPanel.tsx     # σ, interval, drop-rate + toggles
        │   ├── KalmanPanel.tsx     # Q, R tuning + visualisation toggles
        │   └── AboutPanel.tsx      # Algorithm reference documentation
        │
        └── overlays/
            └── RmseChart.tsx       # Recharts live RMSE + covariance chart
```

---

## Architecture Design Principles

### Separation of Concerns

Every module has **one responsibility** and **zero knowledge** of the others:

| Module | Knows about | Does NOT know about |
|--------|-------------|---------------------|
| `PhysicsEngine` | Newtonian kinematics | Kalman, sensor, rendering |
| `KalmanFilter3D` | Matrix algebra | Physics equations, 3D scene |
| `SensorSimulator` | Noise models | Filter, renderer |
| `SceneBuilder` | Three.js objects | Simulation, filter math |
| `useSimulationLoop` | All subsystems | React component tree |
| `App.tsx` | Layout, hooks | Filter/physics internals |

### Extension Points

#### Adding a new sensor type
Implement `ISensorPlugin` from `@/types`:
```ts
class GPSSensor implements ISensorPlugin {
  name = 'GPS';
  sample(truePos: Vec3, frame: number): SensorReading { ... }
  reset(): void { ... }
}
```
Drop into `useSimulationLoop.ts` — no other file changes needed.

#### Adding a new filter (e.g. UKF, EKF)
Implement `IFilterPlugin` from `@/types`:
```ts
class ExtendedKalmanFilter implements IFilterPlugin {
  name = 'EKF';
  predict(config: PhysicsConfig): void { ... }
  update(z: Vec3): void { ... }
  getState(): KalmanState { ... }
  reset(pos: Vec3, vel: Vec3): void { ... }
}
```
Register in store as active filter — the loop needs no changes.

#### Adding a new UI panel
1. Create `src/components/panels/MyPanel.tsx`
2. Add entry to `PANEL_TABS` array in `App.tsx`
3. Mount in panel switch block

---

## User Manual

### Getting Started

1. Press **Start** (top-right) — the green ball begins bouncing.
2. **Drag** the 3D viewport to orbit the camera.
3. **Scroll** to zoom in/out. Touch pinch also works.
4. Press **Pause** to freeze the simulation mid-flight.
5. Press **Reset** to return to initial conditions.
6. Press **Randomise** (while running) to inject a new random velocity vector.

### Reading the Visualisation

| Object | Meaning |
|--------|---------|
| 🟢 Green ball + trail | Ground-truth physics state (god-view) |
| 🔵 Cyan ball + trail | Kalman filter state estimate |
| 🔴 Red octahedra | Raw noisy sensor readings (appear at sample interval) |
| 🟡 Yellow dashed line | 1-second predictive forecast from physics model |

### Physics Panel

- **Gravity** — reduces to 0 for zero-G or increases to 25 for high-G experiments
- **Restitution** — 1.0 = perfect elastic bounce; 0.1 = near-inelastic collapse
- **Air Resistance** — 0 = vacuum; 0.3 = thick medium

### Sensor Panel

- **Noise σ** — standard deviation of Gaussian noise per axis. R = σ²
- **Sample Interval** — 1 = every frame; 10 = sparse sensor (harder for filter)
- **Packet Drop Rate** — 0% = reliable link; 80% = near-total blackout
- **Outlier Injection** — randomly injects 8σ spikes to stress-test filter robustness

### Filter Panel

- **Q Nominal** — process noise during free flight. Low = smooth; high = responsive
- **Q Collision** — Q during wall hits. Should be ≥10× Q Nominal for fast re-acquisition
- **Q/R Ratio** — the live balance indicator. Green range = well-tuned
- **Forecast Ghost** — toggle the 1-second lookahead from physics model

### Metrics Dashboard

| Metric | Meaning |
|--------|---------|
| **Kalman RMSE** | Cumulative RMS position error of filter vs ground truth |
| **Sensor RMSE** | Cumulative RMS of raw noisy readings vs ground truth |
| **Current Error** | Instantaneous Euclidean distance between filter and truth |
| **tr(P)** | Trace of covariance matrix — scalar uncertainty proxy |

A well-tuned system shows **Kalman RMSE ≤ 0.5× Sensor RMSE** under normal conditions.

### Evaluation Scenarios

| Scenario | Config | Expected Kalman RMSE |
|----------|--------|----------------------|
| Nominal | σ=1.5, interval=2, drop=10% | ≤ 0.45m |
| High noise | σ=3.0, interval=4, drop=40% | ≤ 1.0m |
| Rapid bounce | restitution=0.95, g=20 | ≤ 0.5m post-impact |
| Sparse sensor | interval=10, drop=60% | RMSE climbs, then reconverges |

---

## Extension Roadmap (Reserved Interfaces)

- [ ] **Multi-sensor fusion** — register multiple `ISensorPlugin` instances; weight by individual R matrices
- [ ] **EKF / UKF swap** — implement `IFilterPlugin`; plug into store's `activeFilter` field
- [ ] **Replay mode** — buffer `FrameMetrics[]` history; scrub with a timeline slider
- [ ] **Export** — download RMSE CSV from `MetricsAccumulator.getHistory()`
- [ ] **WebSocket live data** — replace `SensorSimulator` with a WebSocket `ISensorPlugin` for real hardware
- [ ] **ROS bridge** — Python micro-service → WebSocket → `ISensorPlugin` → filter pipeline

---

## Algorithm Reference

The filter solves the discrete-time linear state estimation problem:

```
State:      X = [x  y  z  vx  vy  vz]ᵀ
Transition: F — constant-velocity + gravity via B·U
Observation: H = [I₃ | 0₃] — position only, no velocity sensing

Predict:    X̂ = F·X + B·U        P̂ = F·P·Fᵀ + Q
Innovate:   y = Z − H·X̂          S = H·P̂·Hᵀ + R
Gain:       K = P̂·Hᵀ·S⁻¹
Update:     X = X̂ + K·y           P = (I − K·H)·P̂
```

**Adaptive Q:** At wall collisions, `Q` is inflated ×250 for 1–2 frames. This spikes `K`, forcing the filter to trust the measurement (which correctly reflects the post-bounce position) rather than the erroneous prediction (which would overshoot the wall).
