import { create } from 'zustand';

interface ConnectionState {
  connected: boolean;
  autoScroll: boolean;
  setConnected: (v: boolean) => void;
  setAutoScroll: (v: boolean) => void;
  toggleAutoScroll: () => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  connected: false,
  autoScroll: true,

  setConnected: (connected) => set({ connected }),
  setAutoScroll: (autoScroll) => set({ autoScroll }),
  toggleAutoScroll: () => set((s) => ({ autoScroll: !s.autoScroll })),
}));
