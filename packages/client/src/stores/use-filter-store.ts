import { create } from 'zustand';

interface FilterState {
  selectedProject: string | null;
  search: string;
  projects: string[];
  setSelectedProject: (project: string | null) => void;
  setSearch: (search: string) => void;
  setProjects: (projects: string[]) => void;
  addProject: (project: string) => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  selectedProject: null,
  search: '',
  projects: [],

  setSelectedProject: (selectedProject) => set({ selectedProject }),
  setSearch: (search) => set({ search }),
  setProjects: (projects) => set({ projects }),
  addProject: (project) => set((s) => {
    if (s.projects.includes(project)) return s;
    return { projects: [...s.projects, project].sort() };
  }),
}));
