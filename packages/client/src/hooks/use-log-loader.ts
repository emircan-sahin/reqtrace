import { useEffect, useCallback, useRef } from 'react';
import { get } from '@/services/http';
import { useLogStore } from '@/stores/use-log-store';
import { useFilterStore } from '@/stores/use-filter-store';
import type { RequestLog } from '@/types';

const PAGE_SIZE = 200;

interface LogsResponse {
  logs: RequestLog[];
}

interface ProjectsResponse {
  projects: string[];
}

export function useLogLoader() {
  const selectedProject = useFilterStore((s) => s.selectedProject);
  const search = useFilterStore((s) => s.search);
  const loadingRef = useRef(false);

  // Fetch project list on mount
  useEffect(() => {
    get<ProjectsResponse>('/api/projects')
      .then((data) => useFilterStore.getState().setProjects(data.projects))
      .catch(() => {});
  }, []);

  // Reset and re-fetch when filters change
  useEffect(() => {
    const store = useLogStore.getState();
    store.reset();

    const params: Record<string, string | number> = { limit: PAGE_SIZE };
    if (selectedProject) params.project = selectedProject;
    if (search) params.search = search;

    get<LogsResponse>('/api/logs', params)
      .then((data) => {
        const s = useLogStore.getState();
        s.setLogs([...data.logs].reverse());
        s.setHasMore(data.logs.length >= PAGE_SIZE);
        s.setReady(true);
      })
      .catch(() => {});
  }, [selectedProject, search]);

  const loadMore = useCallback(async () => {
    const { hasMore, ready, logs } = useLogStore.getState();
    if (loadingRef.current || !hasMore || !ready) return;
    loadingRef.current = true;

    try {
      const params: Record<string, string | number> = {
        limit: PAGE_SIZE,
        offset: logs.length,
      };
      if (selectedProject) params.project = selectedProject;
      if (search) params.search = search;

      const data = await get<LogsResponse>('/api/logs', params);
      const older = [...data.logs].reverse();

      if (older.length === 0) {
        useLogStore.getState().setHasMore(false);
        return;
      }

      useLogStore.getState().prependLogs(older);
      if (older.length < PAGE_SIZE) useLogStore.getState().setHasMore(false);
    } catch {
      // ignore
    } finally {
      loadingRef.current = false;
    }
  }, [selectedProject, search]);

  return { loadMore };
}
