import { useMemo } from 'react';
import { useLogStore } from '@/stores/use-log-store';
import { useFilterStore } from '@/stores/use-filter-store';
import { matchesLog, matchesPending, type ClientFilters } from '@/lib/log-filter';
import type { LogSummary, RequestStart } from '@/types';

export function useFilteredLogs(): { filteredLogs: LogSummary[]; filteredPending: Map<string, RequestStart> } {
  const logs = useLogStore((s) => s.logs);
  const pending = useLogStore((s) => s.pending);
  const selectedProject = useFilterStore((s) => s.selectedProject);
  const search = useFilterStore((s) => s.search);
  const selectedProxy = useFilterStore((s) => s.selectedProxy);
  const selectedHost = useFilterStore((s) => s.selectedHost);
  const statusRange = useFilterStore((s) => s.statusRange);
  const mode = useFilterStore((s) => s.mode);

  const filters: ClientFilters = useMemo(
    () => ({ selectedProject, search, selectedProxy, selectedHost, statusRange, mode }),
    [selectedProject, search, selectedProxy, selectedHost, statusRange, mode],
  );

  const hasFilters =
    !!selectedProject || !!search || !!selectedProxy || !!selectedHost ||
    statusRange !== 'all' || mode !== 'all';

  const filteredLogs = useMemo(
    () => (hasFilters ? logs.filter((l) => matchesLog(l, filters)) : logs),
    [logs, filters, hasFilters],
  );

  const filteredPending = useMemo(() => {
    if (!hasFilters) return pending;
    const result = new Map<string, RequestStart>();
    for (const [id, entry] of pending) {
      if (matchesPending(entry, filters)) result.set(id, entry);
    }
    return result;
  }, [pending, filters, hasFilters]);

  return { filteredLogs, filteredPending };
}
