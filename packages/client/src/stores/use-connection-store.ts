import { create } from 'zustand';

interface ConnectionState {
  connected: boolean;
  autoScroll: boolean;
  setConnected: (v: boolean) => void;
  toggleAutoScroll: () => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  connected: false,
  autoScroll: true,

  setConnected: (connected) => set({ connected }),
  toggleAutoScroll: () => set((s) => ({ autoScroll: !s.autoScroll })),
}));
