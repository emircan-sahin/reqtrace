import { useMemo, useCallback } from 'react';
import { useLogStore } from '@/stores/use-log-store';
import { useFilterStore } from '@/stores/use-filter-store';
import type { RequestLog, RequestStart } from '@/types';

export function useFilteredLogs(): { filteredLogs: RequestLog[]; filteredPending: Map<string, RequestStart> } {
  const logs = useLogStore((s) => s.logs);
  const pending = useLogStore((s) => s.pending);
  const selectedProject = useFilterStore((s) => s.selectedProject);
  const search = useFilterStore((s) => s.search);

  const matchesSearch = useCallback((text: string) => {
    if (!search) return true;
    return text.toLowerCase().includes(search.toLowerCase());
  }, [search]);

  const filteredLogs = useMemo(() => {
    let result = logs;
    if (selectedProject) {
      result = result.filter((l) => l.project === selectedProject);
    }
    if (search) {
      result = result.filter((l) =>
        matchesSearch(l.url) ||
        matchesSearch(l.method) ||
        (l.status !== null && String(l.status).includes(search)) ||
        (l.error_message && matchesSearch(l.error_message)) ||
        (l.proxy_host && matchesSearch(l.proxy_host)),
      );
    }
    return result;
  }, [logs, selectedProject, search, matchesSearch]);

  const filteredPending = useMemo(() => {
    if (!selectedProject && !search) return pending;
    const filtered = new Map(pending);
    for (const [id, entry] of filtered) {
      const projectMatch = !selectedProject || entry.project === selectedProject;
      const searchMatch = !search || matchesSearch(entry.url) || matchesSearch(entry.method);
      if (!projectMatch || !searchMatch) filtered.delete(id);
    }
    return filtered;
  }, [pending, selectedProject, search, matchesSearch]);

  return { filteredLogs, filteredPending };
}
