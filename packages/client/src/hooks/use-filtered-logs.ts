import { useMemo, useCallback } from 'react';
import { useLogStore } from '@/stores/use-log-store';
import { useFilterStore } from '@/stores/use-filter-store';
import type { LogSummary, RequestStart } from '@/types';

export function useFilteredLogs(): { filteredLogs: LogSummary[]; filteredPending: Map<string, RequestStart> } {
  const logs = useLogStore((s) => s.logs);
  const pending = useLogStore((s) => s.pending);
  const selectedProject = useFilterStore((s) => s.selectedProject);
  const search = useFilterStore((s) => s.search);
  const selectedProxy = useFilterStore((s) => s.selectedProxy);
  const statusRange = useFilterStore((s) => s.statusRange);
  const mode = useFilterStore((s) => s.mode);

  const matchesSearch = useCallback((text: string) => {
    if (!search) return true;
    return text.toLowerCase().includes(search.toLowerCase());
  }, [search]);

  const matchesStatusRange = useCallback((status: number | null): boolean => {
    if (statusRange === 'all') return true;
    if (status === null) return false;
    const range = statusRange.replace('xx', '00');
    const start = parseInt(range);
    const end = start + 99;
    return status >= start && status <= end;
  }, [statusRange]);

  const matchesMode = useCallback((log: LogSummary): boolean => {
    if (mode === 'all') return true;
    if (mode === 'pending') return false;
    if (mode === 'success') return log.success;
    if (mode === 'error') return !log.success;
    return true;
  }, [mode]);

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
    if (selectedProxy) {
      result = result.filter((l) => l.proxy_host === selectedProxy);
    }
    if (statusRange !== 'all') {
      result = result.filter((l) => matchesStatusRange(l.status));
    }
    if (mode !== 'all') {
      result = result.filter((l) => matchesMode(l));
    }
    return result;
  }, [logs, selectedProject, search, selectedProxy, statusRange, mode, matchesSearch, matchesStatusRange, matchesMode]);

  const filteredPending = useMemo(() => {
    const hasFilters = selectedProject || search || selectedProxy || statusRange !== 'all' || mode !== 'all';
    if (!hasFilters) return pending;
    
    const filtered = new Map(pending);
    for (const [id, entry] of filtered) {
      const projectMatch = !selectedProject || entry.project === selectedProject;
      const searchMatch = !search || matchesSearch(entry.url) || matchesSearch(entry.method);
      const proxyMatch = !selectedProxy || false;
      if (!projectMatch || !searchMatch || !proxyMatch) filtered.delete(id);
    }
    return filtered;
  }, [pending, selectedProject, search, selectedProxy, matchesSearch]);

  return { filteredLogs, filteredPending };
}
