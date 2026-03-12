import { useMemo, useState, useEffect } from 'react';
import { get } from '@/services/http';
import { useFilterStore } from '@/stores/use-filter-store';
import type { LogSummary } from '@/types';

interface ProxyBucket {
  proxy: string;
  project: string;
  count: number;
  success: number;
  errors: number;
  total_size: number;
}

export interface ProxyRequestData {
  proxy: string;
  [project: string]: number | string;
}

export interface ProxySuccessErrorData {
  proxy: string;
  success: number;
  errors: number;
}

export interface ProxyResponseSizeData {
  proxy: string;
  [project: string]: number | string;
}

function buildProxyDatasets(bucketMap: Map<string, ProxyBucket>) {
  const allBuckets = [...bucketMap.values()];
  const projectSet = new Set<string>();
  const proxyMap = new Map<string, ProxyBucket[]>();

  for (const b of allBuckets) {
    projectSet.add(b.project);
    if (!proxyMap.has(b.proxy)) proxyMap.set(b.proxy, []);
    proxyMap.get(b.proxy)!.push(b);
  }

  // Sort proxies by total count descending
  const sortedProxies = [...proxyMap.entries()]
    .sort((a, b) => {
      const totalA = a[1].reduce((s, x) => s + x.count, 0);
      const totalB = b[1].reduce((s, x) => s + x.count, 0);
      return totalB - totalA;
    })
    .map(([proxy]) => proxy);

  const requestData: ProxyRequestData[] = sortedProxies.map((proxy) => {
    const entry: ProxyRequestData = { proxy };
    for (const b of proxyMap.get(proxy)!) {
      entry[b.project] = ((entry[b.project] as number) ?? 0) + b.count;
    }
    return entry;
  });

  const responseSizeData: ProxyResponseSizeData[] = sortedProxies.map((proxy) => {
    const entry: ProxyResponseSizeData = { proxy };
    for (const b of proxyMap.get(proxy)!) {
      entry[b.project] = ((entry[b.project] as number) ?? 0) + b.total_size;
    }
    return entry;
  });

  const successErrorData: ProxySuccessErrorData[] = sortedProxies.map((proxy) => {
    let success = 0;
    let errors = 0;
    for (const b of proxyMap.get(proxy)!) {
      success += b.success;
      errors += b.errors;
    }
    return { proxy, success, errors };
  });

  return {
    requestData,
    responseSizeData,
    successErrorData,
    projectNames: [...projectSet].sort(),
  };
}

export function useProxyChartData(filteredLogs: LogSummary[]) {
  const selectedProject = useFilterStore((s) => s.selectedProject);
  const search = useFilterStore((s) => s.search);
  const [serverBuckets, setServerBuckets] = useState<ProxyBucket[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  useEffect(() => {
    setFetchedAt(null);
    const params: Record<string, string | number> = {};
    if (selectedProject) params.project = selectedProject;
    if (search) params.search = search;

    const fetchTime = new Date().toISOString();

    get<{ buckets: ProxyBucket[] }>('/api/stats/proxy', params)
      .then((data) => {
        setServerBuckets(data.buckets);
        setFetchedAt(fetchTime);
      })
      .catch(() => {});
  }, [selectedProject, search]);

  return useMemo(() => {
    const bucketMap = new Map<string, ProxyBucket>();

    for (const b of serverBuckets) {
      bucketMap.set(`${b.proxy}|${b.project}`, { ...b });
    }

    if (fetchedAt) {
      for (const log of filteredLogs) {
        if (log.timestamp <= fetchedAt || !log.proxy_host) continue;

        const proxy = `${log.proxy_host}:${log.proxy_port}`;
        const key = `${proxy}|${log.project}`;
        const size = log.response_size_bytes ?? 0;
        const existing = bucketMap.get(key);

        if (existing) {
          existing.count++;
          if (log.success) existing.success++;
          else existing.errors++;
          existing.total_size += size;
        } else {
          bucketMap.set(key, {
            proxy,
            project: log.project,
            count: 1,
            success: log.success ? 1 : 0,
            errors: log.success ? 0 : 1,
            total_size: size,
          });
        }
      }
    }

    return buildProxyDatasets(bucketMap);
  }, [serverBuckets, fetchedAt, filteredLogs]);
}
