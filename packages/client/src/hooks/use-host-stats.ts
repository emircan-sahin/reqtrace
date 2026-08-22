import { useMemo } from 'react';
import { useConnectionStore } from '@/stores/use-connection-store';
import { useServerFilters } from './use-server-filters';
import { usePolledGet } from './use-polled-get';

const REFETCH_INTERVAL = 10_000;

export interface HostBucket {
  host: string;
  count: number;
  success: number;
  errors: number;
  avg_duration: number;
  total_size: number;
}

/** Per-target-host rollup: which upstream API is slow or failing right now. */
export function useHostStats(): HostBucket[] {
  const chartRange = useConnectionStore((s) => s.chartRange);
  const { params: filterParams, pendingOnly } = useServerFilters();

  const params = useMemo(
    () => ({ ...filterParams, range: chartRange }),
    [filterParams, chartRange],
  );

  const { data } = usePolledGet<{ buckets: HostBucket[] }>(
    '/api/stats/hosts',
    params,
    REFETCH_INTERVAL,
    !pendingOnly,
  );

  return data?.buckets ?? [];
}
