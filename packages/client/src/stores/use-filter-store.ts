import { create } from 'zustand';

export type StatusRange = 'all' | '2xx' | '3xx' | '4xx' | '5xx';
export type ModeFilter = 'all' | 'success' | 'error' | 'pending';

interface FilterState {
  selectedProject: string | null;
  search: string;
  projects: string[];
  selectedProxy: string | null;
  statusRange: StatusRange;
  mode: ModeFilter;
  setSelectedProject: (project: string | null) => void;
  setSearch: (search: string) => void;
  setProjects: (projects: string[]) => void;
  addProject: (project: string) => void;
  setSelectedProxy: (proxy: string | null) => void;
  setStatusRange: (range: StatusRange) => void;
  setMode: (mode: ModeFilter) => void;
  clearFilters: () => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  selectedProject: null,
  search: '',
  projects: [],
  selectedProxy: null,
  statusRange: 'all',
  mode: 'all',

  setSelectedProject: (selectedProject) => set({ selectedProject }),
  setSearch: (search) => set({ search }),
  setProjects: (projects) => set({ projects }),
  addProject: (project) => set((s) => {
    if (s.projects.includes(project)) return s;
    return { projects: [...s.projects, project].sort() };
  }),
  setSelectedProxy: (selectedProxy) => set({ selectedProxy }),
  setStatusRange: (statusRange) => set({ statusRange }),
  setMode: (mode) => set({ mode }),
  clearFilters: () => set({ selectedProxy: null, statusRange: 'all', mode: 'all' }),
}));
