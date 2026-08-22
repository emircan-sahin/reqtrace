import { useMemo } from 'react';
import { useConnectionStore } from '@/stores/use-connection-store';
import { useServerFilters } from './use-server-filters';
import { usePolledGet } from './use-polled-get';
import { proxyLabel } from '@/lib/log-filter';
import type { LogSummary } from '@/types';

const REFETCH_INTERVAL = 10_000;

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

function sortProxyEntries(
  proxyEntries: Array<[string, ProxyBucket[]]>,
  getTotal: (bucket: ProxyBucket) => number,
) {
  return [...proxyEntries].sort((a, b) => {
    const totalA = a[1].reduce((sum, bucket) => sum + getTotal(bucket), 0);
    const totalB = b[1].reduce((sum, bucket) => sum + getTotal(bucket), 0);

    if (totalA !== totalB) return totalB - totalA;

    return a[0].localeCompare(b[0]);
  });
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

  const proxyEntries = [...proxyMap.entries()];
  const requestSortedProxies = sortProxyEntries(proxyEntries, (bucket) => bucket.count).map(
    ([proxy]) => proxy,
  );
  const responseSizeSortedProxies = sortProxyEntries(
    proxyEntries,
    (bucket) => bucket.total_size,
  ).map(([proxy]) => proxy);

  const requestData: ProxyRequestData[] = requestSortedProxies.map((proxy) => {
    const entry: ProxyRequestData = { proxy };
    for (const b of proxyMap.get(proxy)!) {
      entry[b.project] = ((entry[b.project] as number) ?? 0) + b.count;
    }
    return entry;
  });

  const responseSizeData: ProxyResponseSizeData[] = responseSizeSortedProxies.map((proxy) => {
    const entry: ProxyResponseSizeData = { proxy };
    for (const b of proxyMap.get(proxy)!) {
      entry[b.project] = ((entry[b.project] as number) ?? 0) + b.total_size;
    }
    return entry;
  });

  const successErrorData: ProxySuccessErrorData[] = requestSortedProxies.map((proxy) => {
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
  const chartRange = useConnectionStore((s) => s.chartRange);
  const { params: filterParams, pendingOnly } = useServerFilters();

  // The proxy charts live in the charts panel, so they follow the same range
  // picker — and bounding them by time keeps the aggregate off the whole table.
  const params = useMemo(
    () => ({ ...filterParams, range: chartRange }),
    [filterParams, chartRange],
  );

  const { data, fetchedAt } = usePolledGet<{ buckets: ProxyBucket[] }>(
    '/api/stats/proxy',
    params,
    REFETCH_INTERVAL,
    !pendingOnly,
  );
  const serverBuckets = data?.buckets;

  return useMemo(() => {
    const bucketMap = new Map<string, ProxyBucket>();

    for (const b of serverBuckets ?? []) {
      bucketMap.set(`${b.proxy}|${b.project}`, { ...b });
    }

    if (fetchedAt) {
      for (const log of filteredLogs) {
        if (log.timestamp <= fetchedAt || !log.proxy_host) continue;

        const proxy = proxyLabel(log.proxy_host, log.proxy_port);
        if (!proxy) continue;
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
