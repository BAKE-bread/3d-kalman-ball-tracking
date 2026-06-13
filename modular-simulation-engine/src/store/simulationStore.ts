// ============================================================
// store/simulationStore.ts
// Global state via Zustand 5 — single source of truth for all UI.
// Sliced into logical sub-stores for maintainability.
// ============================================================

import { create } from 'zustand';
import type { SimConfig, FrameMetrics, SimStatus, ChartPoint } from '@/types';
import { DEFAULT_CONFIG } from '@/constants/defaults';

// ── Simulation config slice ──────────────────────────────────
interface ConfigSlice {
  config: SimConfig;
  setConfig: (patch: Partial<SimConfig>) => void;
  resetConfig: () => void;
}

// ── Runtime metrics slice ────────────────────────────────────
interface MetricsSlice {
  metrics: FrameMetrics | null;
  chartHistory: ChartPoint[];
  pushMetrics: (m: FrameMetrics) => void;
  setChartHistory: (h: ChartPoint[]) => void;
  clearMetrics: () => void;
}

// ── Control slice ────────────────────────────────────────────
interface ControlSlice {
  status: SimStatus;
  showTrueTrail:    boolean;
  showKalmanTrail:  boolean;
  showSensor:       boolean;
  showForecast:     boolean;
  spikeInjection:   boolean;
  /** Incremented each time the user presses Kick — loop watches this */
  kickCounter: number;
  setStatus:            (s: SimStatus) => void;
  toggleTrueTrail:      () => void;
  toggleKalmanTrail:    () => void;
  toggleSensor:         () => void;
  toggleForecast:       () => void;
  toggleSpikeInjection: () => void;
  requestKick:          () => void;
}

// ── Panel UI state ───────────────────────────────────────────
interface UISlice {
  activePanel: 'physics' | 'sensor' | 'kalman' | 'about';
  setActivePanel: (p: UISlice['activePanel']) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
}

// ── Combined store ───────────────────────────────────────────
type SimStore = ConfigSlice & MetricsSlice & ControlSlice & UISlice;

export const useSimStore = create<SimStore>((set) => ({
  // ── Config
  config: { ...DEFAULT_CONFIG },
  setConfig:   (patch) => set((s) => ({ config: { ...s.config, ...patch } })),
  resetConfig: ()      => set({ config: { ...DEFAULT_CONFIG } }),

  // ── Metrics
  metrics:       null,
  chartHistory:  [],
  pushMetrics:      (m) => set({ metrics: m }),
  setChartHistory:  (h) => set({ chartHistory: h }),
  clearMetrics:     ()  => set({ metrics: null, chartHistory: [] }),

  // ── Control
  status:           'idle',
  showTrueTrail:    true,
  showKalmanTrail:  true,
  showSensor:       true,
  showForecast:     false,
  spikeInjection:   false,
  kickCounter:      0,
  setStatus:            (status) => set({ status }),
  toggleTrueTrail:      () => set((s) => ({ showTrueTrail:    !s.showTrueTrail    })),
  toggleKalmanTrail:    () => set((s) => ({ showKalmanTrail:  !s.showKalmanTrail  })),
  toggleSensor:         () => set((s) => ({ showSensor:        !s.showSensor       })),
  toggleForecast:       () => set((s) => ({ showForecast:      !s.showForecast     })),
  toggleSpikeInjection: () => set((s) => ({ spikeInjection:    !s.spikeInjection   })),
  requestKick:          () => set((s) => ({ kickCounter: s.kickCounter + 1        })),

  // ── UI
  activePanel:  'physics',
  setActivePanel:  (activePanel)  => set({ activePanel }),
  sidebarOpen:     true,
  setSidebarOpen:  (sidebarOpen)  => set({ sidebarOpen }),
}));
