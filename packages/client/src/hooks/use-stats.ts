import { useMemo } from 'react';
import type { RequestLog, Stats } from '../types';

const EMPTY_STATS: Stats = {
  total_requests: 0,
  success_count: 0,
  error_count: 0,
  avg_duration_ms: 0,
  methods: {},
  status_codes: {},
  requests_per_minute: 0,
};

export function useStats(logs: RequestLog[]): Stats {
  return useMemo(() => {
    if (logs.length === 0) return EMPTY_STATS;

    let successCount = 0;
    let errorCount = 0;
    let totalDuration = 0;
    const methods: Record<string, number> = {};
    const statusCodes: Record<string, number> = {};

    for (const log of logs) {
      if (log.success) successCount++;
      else errorCount++;

      totalDuration += log.duration_ms;
      methods[log.method] = (methods[log.method] ?? 0) + 1;

      if (log.status !== null) {
        const code = String(log.status);
        statusCodes[code] = (statusCodes[code] ?? 0) + 1;
      }
    }

    const now = Date.now();
    const oneMinuteAgo = now - 60_000;
    const recentCount = logs.filter(
      (l) => new Date(l.timestamp).getTime() >= oneMinuteAgo,
    ).length;

    return {
      total_requests: logs.length,
      success_count: successCount,
      error_count: errorCount,
      avg_duration_ms: Math.round(totalDuration / logs.length),
      methods,
      status_codes: statusCodes,
      requests_per_minute: recentCount,
    };
  }, [logs]);
}
