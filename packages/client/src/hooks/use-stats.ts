import { useMemo } from 'react';
import { useFilteredLogs } from './use-filtered-logs';
import { useServerFilters } from './use-server-filters';
import { usePolledGet } from './use-polled-get';
import type { Stats } from '@/types';

const REFETCH_INTERVAL = 10_000;

const EMPTY_STATS: Stats = {
  total_requests: 0,
  success_count: 0,
  error_count: 0,
  avg_duration_ms: 0,
  methods: {},
  status_codes: {},
  requests_per_minute: 0,
};

export function useStats(): Stats {
  const { filteredLogs, filteredPending } = useFilteredLogs();
  // Same filters the feed uses, so these numbers describe the rows on screen.
  const { params, pendingOnly } = useServerFilters();

  // Polled, not fetched once: the live delta below is derived from a sliding
  // window of at most MAX_CLIENT_LOGS rows, so without refresh the totals drift.
  const { data: serverStats, fetchedAt } = usePolledGet<Stats>(
    '/api/stats',
    params,
    REFETCH_INTERVAL,
    !pendingOnly,
  );
  const pendingCount = filteredPending.size;

  return useMemo(() => {
    // Pending mode has no server-side rows at all — report what is in flight.
    if (pendingOnly) return { ...EMPTY_STATS, total_requests: pendingCount };
    if (!serverStats || !fetchedAt) return EMPTY_STATS;

    // Server-side count over the whole dataset, plus rows that arrived since.
    // Deriving it from the client window alone saturates at the window size.
    const cutoff = new Date(Date.now() - 60_000).toISOString();
    let recentSinceFetch = 0;
    for (let i = filteredLogs.length - 1; i >= 0; i--) {
      const ts = filteredLogs[i].timestamp;
      if (ts > fetchedAt && ts >= cutoff) recentSinceFetch++;
    }
    const recentCount = serverStats.requests_per_minute + recentSinceFetch;

    // Only merge logs that arrived via WS after we fetched stats
    const newLogs = filteredLogs.filter((l) => l.timestamp > fetchedAt);

    if (newLogs.length === 0) {
      return { ...serverStats, requests_per_minute: recentCount };
    }

    let newSuccess = 0;
    let newDuration = 0;
    const methods = { ...serverStats.methods };
    const statusCodes = { ...serverStats.status_codes };

    for (const log of newLogs) {
      if (log.success) newSuccess++;
      newDuration += log.duration_ms;
      methods[log.method] = (methods[log.method] ?? 0) + 1;
      if (log.status !== null) {
        const code = String(log.status);
        statusCodes[code] = (statusCodes[code] ?? 0) + 1;
      }
    }

    const total = serverStats.total_requests + newLogs.length;
    const serverTotalDuration = serverStats.avg_duration_ms * serverStats.total_requests;

    return {
      total_requests: total,
      success_count: serverStats.success_count + newSuccess,
      error_count: serverStats.error_count + (newLogs.length - newSuccess),
      avg_duration_ms: total > 0 ? Math.round((serverTotalDuration + newDuration) / total) : 0,
      methods,
      status_codes: statusCodes,
      requests_per_minute: recentCount,
    };
  }, [serverStats, fetchedAt, filteredLogs, pendingOnly, pendingCount]);
}
