import { useMemo, useState, useEffect } from 'react';
import { get } from '@/services/http';
import { useFilterStore } from '@/stores/use-filter-store';
import { useConnectionStore } from '@/stores/use-connection-store';
import type { LogSummary } from '@/types';

interface ChartBucket {
  time: string;
  project: string;
  total: number;
  success: number;
  errors: number;
  avg_duration: number;
}

export interface TimelineBucket {
  time: string;
  [project: string]: number | string;
}

export interface SuccessErrorBucket {
  time: string;
  success: number;
  errors: number;
}

export interface LatencyBucket {
  time: string;
  avg: number;
}

function bucketKey(timestamp: string, intervalMs: number): string {
  const epoch = new Date(timestamp).getTime();
  return new Date(Math.floor(epoch / intervalMs) * intervalMs).toISOString();
}

function formatTime(iso: string, intervalSec: number): string {
  const d = new Date(iso);
  if (intervalSec >= 3600) {
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function buildChartDatasets(bucketMap: Map<string, ChartBucket>, intervalSec: number) {
  const allBuckets = [...bucketMap.values()].sort((a, b) => a.time.localeCompare(b.time));

  const timeMap = new Map<string, ChartBucket[]>();
  const projectSet = new Set<string>();

  for (const b of allBuckets) {
    projectSet.add(b.project);
    if (!timeMap.has(b.time)) timeMap.set(b.time, []);
    timeMap.get(b.time)!.push(b);
  }

  const sortedTimes = [...timeMap.keys()].sort();

  const timelineBuckets: TimelineBucket[] = sortedTimes.map((time) => {
    const entry: TimelineBucket = { time: formatTime(time, intervalSec) };
    for (const b of timeMap.get(time)!) {
      entry[b.project] = ((entry[b.project] as number) ?? 0) + b.total;
    }
    return entry;
  });

  const successErrorBuckets: SuccessErrorBucket[] = sortedTimes.map((time) => {
    let success = 0;
    let errors = 0;
    for (const b of timeMap.get(time)!) {
      success += b.success;
      errors += b.errors;
    }
    return { time: formatTime(time, intervalSec), success, errors };
  });

  const latencyBuckets: LatencyBucket[] = sortedTimes.map((time) => {
    let totalDuration = 0;
    let totalCount = 0;
    for (const b of timeMap.get(time)!) {
      totalDuration += b.avg_duration * b.total;
      totalCount += b.total;
    }
    return {
      time: formatTime(time, intervalSec),
      avg: totalCount > 0 ? Math.round(totalDuration / totalCount) : 0,
    };
  });

  return {
    timelineBuckets,
    successErrorBuckets,
    latencyBuckets,
    projectNames: [...projectSet].sort(),
  };
}

export function useChartData(filteredLogs: LogSummary[]) {
  const selectedProject = useFilterStore((s) => s.selectedProject);
  const search = useFilterStore((s) => s.search);
  const chartInterval = useConnectionStore((s) => s.chartInterval);
  const [serverBuckets, setServerBuckets] = useState<ChartBucket[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  useEffect(() => {
    setFetchedAt(null);
    const params: Record<string, string | number> = { interval: chartInterval };
    if (selectedProject) params.project = selectedProject;
    if (search) params.search = search;

    const fetchTime = new Date().toISOString();

    get<{ buckets: ChartBucket[] }>('/api/stats/charts', params)
      .then((data) => {
        setServerBuckets(data.buckets);
        setFetchedAt(fetchTime);
      })
      .catch(() => {});
  }, [selectedProject, search, chartInterval]);

  return useMemo(() => {
    const intervalMs = chartInterval * 1000;
    const bucketMap = new Map<string, ChartBucket>();

    for (const b of serverBuckets) {
      bucketMap.set(`${b.time}|${b.project}`, { ...b });
    }

    // Only merge logs that arrived via WS after we fetched chart data
    if (fetchedAt) {
      for (const log of filteredLogs) {
        if (log.timestamp <= fetchedAt) continue;

        const time = bucketKey(log.timestamp, intervalMs);
        const key = `${time}|${log.project}`;
        const existing = bucketMap.get(key);

        if (existing) {
          const oldTotal = existing.total;
          existing.total++;
          if (log.success) existing.success++;
          else existing.errors++;
          existing.avg_duration = Math.round(
            (existing.avg_duration * oldTotal + log.duration_ms) / existing.total,
          );
        } else {
          bucketMap.set(key, {
            time,
            project: log.project,
            total: 1,
            success: log.success ? 1 : 0,
            errors: log.success ? 0 : 1,
            avg_duration: Math.round(log.duration_ms),
          });
        }
      }
    }

    return buildChartDatasets(bucketMap, chartInterval);
  }, [serverBuckets, fetchedAt, filteredLogs, chartInterval]);
}
