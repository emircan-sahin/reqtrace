import { create } from 'zustand';

interface ConnectionState {
  connected: boolean;
  autoScroll: boolean;
  chartsOpen: boolean;
  setConnected: (v: boolean) => void;
  setAutoScroll: (v: boolean) => void;
  toggleAutoScroll: () => void;
  toggleCharts: () => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  connected: false,
  autoScroll: true,
  chartsOpen: false,

  setConnected: (connected) => set({ connected }),
  setAutoScroll: (autoScroll) => set({ autoScroll }),
  toggleAutoScroll: () => set((s) => ({ autoScroll: !s.autoScroll })),
  toggleCharts: () => set((s) => ({ chartsOpen: !s.chartsOpen })),
}));
