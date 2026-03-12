import { useMemo, useState, useEffect } from 'react';
import { get } from '@/services/http';
import { useFilteredLogs } from './use-filtered-logs';
import { useFilterStore } from '@/stores/use-filter-store';
import type { Stats } from '@/types';

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
  const { filteredLogs } = useFilteredLogs();
  const selectedProject = useFilterStore((s) => s.selectedProject);
  const search = useFilterStore((s) => s.search);
  const [serverStats, setServerStats] = useState<Stats | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  useEffect(() => {
    setFetchedAt(null);
    const params: Record<string, string | number> = {};
    if (selectedProject) params.project = selectedProject;
    if (search) params.search = search;

    const fetchTime = new Date().toISOString();

    get<Stats>('/api/stats', params)
      .then((data) => {
        setServerStats(data);
        setFetchedAt(fetchTime);
      })
      .catch(() => {});
  }, [selectedProject, search]);

  return useMemo(() => {
    if (!serverStats || !fetchedAt) return EMPTY_STATS;

    // Only merge logs that arrived via WS after we fetched stats
    const newLogs = filteredLogs.filter((l) => l.timestamp > fetchedAt);

    if (newLogs.length === 0) {
      // Requests per minute: always compute client-side for freshness
      const now = Date.now();
      const oneMinuteAgo = now - 60_000;
      const recentCount = filteredLogs.filter(
        (l) => new Date(l.timestamp).getTime() >= oneMinuteAgo,
      ).length;

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

    const now = Date.now();
    const oneMinuteAgo = now - 60_000;
    const recentCount = filteredLogs.filter(
      (l) => new Date(l.timestamp).getTime() >= oneMinuteAgo,
    ).length;

    return {
      total_requests: total,
      success_count: serverStats.success_count + newSuccess,
      error_count: serverStats.error_count + (newLogs.length - newSuccess),
      avg_duration_ms: total > 0 ? Math.round((serverTotalDuration + newDuration) / total) : 0,
      methods,
      status_codes: statusCodes,
      requests_per_minute: recentCount,
    };
  }, [serverStats, fetchedAt, filteredLogs]);
}
