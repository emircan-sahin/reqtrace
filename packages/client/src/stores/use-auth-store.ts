import { create } from 'zustand';

interface AuthState {
  token: string | null;
  registered: boolean | null;
  setToken: (token: string | null) => void;
  setRegistered: (registered: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('reqtrace_token'),
  registered: null,
  setToken: (token) => {
    if (token) {
      localStorage.setItem('reqtrace_token', token);
    } else {
      localStorage.removeItem('reqtrace_token');
    }
    set({ token });
  },
  setRegistered: (registered) => set({ registered }),
  logout: () => {
    localStorage.removeItem('reqtrace_token');
    set({ token: null });
  },
}));

// Cross-tab sync: when another tab logs out, sync here
window.addEventListener('storage', (e) => {
  if (e.key === 'reqtrace_token') {
    useAuthStore.setState({ token: e.newValue });
  }
});
