import { create } from 'zustand';

interface ConnectionState {
  connected: boolean;
  autoScroll: boolean;
  chartsOpen: boolean;
  chartInterval: number;
  hoverPaused: boolean;
  manualPaused: boolean;
  setConnected: (v: boolean) => void;
  setAutoScroll: (v: boolean) => void;
  toggleAutoScroll: () => void;
  toggleCharts: () => void;
  setChartInterval: (v: number) => void;
  setHoverPaused: (v: boolean) => void;
  toggleManualPaused: () => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  connected: false,
  autoScroll: true,
  chartsOpen: false,
  chartInterval: 60,
  hoverPaused: false,
  manualPaused: false,

  setConnected: (connected) => set({ connected }),
  setAutoScroll: (autoScroll) => set({ autoScroll }),
  toggleAutoScroll: () => set((s) => ({ autoScroll: !s.autoScroll })),
  toggleCharts: () => set((s) => ({ chartsOpen: !s.chartsOpen })),
  setChartInterval: (chartInterval) => set({ chartInterval }),
  setHoverPaused: (hoverPaused) => set({ hoverPaused }),
  toggleManualPaused: () => set((s) => ({ manualPaused: !s.manualPaused })),
}));
