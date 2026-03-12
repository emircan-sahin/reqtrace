import { create } from 'zustand';

interface ConnectionState {
  connected: boolean;
  autoScroll: boolean;
  chartsOpen: boolean;
  chartInterval: number;
  setConnected: (v: boolean) => void;
  setAutoScroll: (v: boolean) => void;
  toggleAutoScroll: () => void;
  toggleCharts: () => void;
  setChartInterval: (v: number) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  connected: false,
  autoScroll: true,
  chartsOpen: false,
  chartInterval: 60,

  setConnected: (connected) => set({ connected }),
  setAutoScroll: (autoScroll) => set({ autoScroll }),
  toggleAutoScroll: () => set((s) => ({ autoScroll: !s.autoScroll })),
  toggleCharts: () => set((s) => ({ chartsOpen: !s.chartsOpen })),
  setChartInterval: (chartInterval) => set({ chartInterval }),
}));
