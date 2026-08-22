import { create } from 'zustand';

interface ConnectionState {
  connected: boolean;
  autoScroll: boolean;
  chartsOpen: boolean;
  chartRange: number;
  hoverPaused: boolean;
  manualPaused: boolean;
  stale: boolean;
  /** Bumped whenever server-side data is wiped, to force every fetch to re-run. */
  dataEpoch: number;
  bumpDataEpoch: () => void;
  setConnected: (v: boolean) => void;
  setAutoScroll: (v: boolean) => void;
  toggleAutoScroll: () => void;
  toggleCharts: () => void;
  setChartRange: (v: number) => void;
  setHoverPaused: (v: boolean) => void;
  toggleManualPaused: () => void;
  setStale: (v: boolean) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  connected: false,
  autoScroll: true,
  chartsOpen: false,
  chartRange: 1800,
  hoverPaused: false,
  manualPaused: false,
  stale: false,
  dataEpoch: 0,

  bumpDataEpoch: () => set((s) => ({ dataEpoch: s.dataEpoch + 1 })),
  setConnected: (connected) => set({ connected }),
  setAutoScroll: (autoScroll) => set({ autoScroll }),
  toggleAutoScroll: () => set((s) => ({ autoScroll: !s.autoScroll })),
  toggleCharts: () => set((s) => ({ chartsOpen: !s.chartsOpen })),
  setChartRange: (chartRange) => set({ chartRange }),
  setHoverPaused: (hoverPaused) => set({ hoverPaused }),
  toggleManualPaused: () => set((s) => ({ manualPaused: !s.manualPaused })),
  setStale: (stale) => set({ stale }),
}));
