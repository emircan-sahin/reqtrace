import type { LogSummary, RequestStart } from '@/types';
import type { ModeFilter, StatusRange } from '@/stores/use-filter-store';

export interface ClientFilters {
  selectedProject: string | null;
  search: string;
  selectedProxy: string | null;
  selectedHost: string | null;
  statusRange: StatusRange;
  mode: ModeFilter;
}

/** Target host of a request URL. Mirrors the server's HOST_EXPR. */
export function urlHost(url: string): string {
  const match = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/([^/?#]+)/.exec(url);
  return match ? match[1] : url;
}

/**
 * Canonical "host:port" label. Rows without a port must render and compare the
 * same way everywhere, or a bar in the proxy chart never matches the badge in
 * the feed that produced it.
 */
export function proxyLabel(host: string | null, port: number | null): string | null {
  if (!host) return null;
  return port === null || port === undefined ? host : `${host}:${port}`;
}

export function matchesLog(log: LogSummary, f: ClientFilters): boolean {
  if (f.selectedProject && log.project !== f.selectedProject) return false;

  if (f.search) {
    const q = f.search.toLowerCase();
    const hit =
      log.url.toLowerCase().includes(q) ||
      log.method.toLowerCase().includes(q) ||
      (log.status !== null && String(log.status).includes(q)) ||
      (!!log.error_message && log.error_message.toLowerCase().includes(q)) ||
      (!!log.proxy_host && log.proxy_host.toLowerCase().includes(q));
    if (!hit) return false;
  }

  if (f.selectedProxy && proxyLabel(log.proxy_host, log.proxy_port) !== f.selectedProxy) {
    return false;
  }

  if (f.selectedHost && urlHost(log.url) !== f.selectedHost) return false;

  if (f.statusRange !== 'all') {
    if (log.status === null) return false;
    // Same bounds as the SQL predicate: status >= n AND status < n + 100
    const start = parseInt(f.statusRange, 10) * 100;
    if (log.status < start || log.status >= start + 100) return false;
  }

  if (f.mode === 'pending') return false;
  if (f.mode === 'success' && !log.success) return false;
  if (f.mode === 'error' && log.success) return false;

  return true;
}

export function matchesPending(entry: RequestStart, f: ClientFilters): boolean {
  // A pending row has no status, proxy or outcome yet, so those filters exclude it.
  if (f.selectedProxy || f.statusRange !== 'all' || f.mode === 'success' || f.mode === 'error') {
    return false;
  }
  if (f.selectedProject && entry.project !== f.selectedProject) return false;
  if (f.selectedHost && urlHost(entry.url) !== f.selectedHost) return false;
  if (f.search) {
    const q = f.search.toLowerCase();
    if (!entry.url.toLowerCase().includes(q) && !entry.method.toLowerCase().includes(q)) {
      return false;
    }
  }
  return true;
}
