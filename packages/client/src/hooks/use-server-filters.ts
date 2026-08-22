import { useMemo } from 'react';
import { useFilterStore } from '@/stores/use-filter-store';

export interface ServerFilters {
  /** Query params understood by /api/logs and every /api/stats* endpoint. */
  params: Record<string, string | number>;
  /**
   * "Pending" is a feed-only mode: in-flight requests exist solely in the
   * client's pending map, so no server query can describe them.
   */
  pendingOnly: boolean;
}

/**
 * The one place filters turn into query params. The log list and the aggregates
 * both read it, so the stats bar and charts always describe the same rows the
 * feed is showing — a filter can never silently apply to just the loaded window.
 */
export function buildServerFilters(): ServerFilters {
  const { selectedProject, search, selectedProxy, selectedHost, statusRange, mode } = useFilterStore.getState();
  const params: Record<string, string | number> = {};

  if (selectedProject) params.project = selectedProject;
  if (search) params.search = search;
  if (selectedProxy) params.proxy = selectedProxy;
  if (selectedHost) params.host = selectedHost;
  if (statusRange !== 'all') params.statusRange = parseInt(statusRange, 10) * 100;
  if (mode === 'success') params.success = 'true';
  if (mode === 'error') params.success = 'false';

  return { params, pendingOnly: mode === 'pending' };
}

export function useServerFilters(): ServerFilters {
  const selectedProject = useFilterStore((s) => s.selectedProject);
  const search = useFilterStore((s) => s.search);
  const selectedProxy = useFilterStore((s) => s.selectedProxy);
  const selectedHost = useFilterStore((s) => s.selectedHost);
  const statusRange = useFilterStore((s) => s.statusRange);
  const mode = useFilterStore((s) => s.mode);

  return useMemo(
    () => buildServerFilters(),
    [selectedProject, search, selectedProxy, selectedHost, statusRange, mode],
  );
}
