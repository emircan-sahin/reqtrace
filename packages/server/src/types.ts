export interface RequestStart {
  id: string;
  project: string;
  url: string;
  method: string;
  timestamp: string;
}

export interface RequestLog {
  id: string;
  project: string;
  url: string;
  method: string;
  status: number | null;
  duration_ms: number;
  proxy_host: string | null;
  proxy_port: number | null;
  response_size_bytes: number | null;
  request_headers: Record<string, string>;
  response_headers: Record<string, string>;
  request_body?: string;
  response_body?: string;
  error_message: string | null;
  success: boolean;
  timestamp: string;
}

export interface WsMessage {
  type: 'request_start' | 'request_end';
}

export interface WsRequestStart extends WsMessage, RequestStart {
  type: 'request_start';
}

export interface WsRequestEnd extends WsMessage, RequestLog {
  type: 'request_end';
}

export interface LogFilter {
  project?: string;
  method?: string;
  status?: number;
  /** Lower bound of a status class: 200 matches 2xx, 500 matches 5xx, etc. */
  statusRange?: number;
  success?: boolean;
  /** "host:port" of the proxy the request went through. */
  proxy?: string;
  /** Target host of the request URL, e.g. "api.stripe.com". */
  host?: string;
  url?: string;
  search?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
  cursor?: string;
}

/**
 * Every filter dimension the dashboard offers, minus paging. Aggregate
 * endpoints take exactly the same set as the log list so the numbers on screen
 * always describe the rows on screen.
 */
export type AggregateFilter = Pick<
  LogFilter,
  'project' | 'method' | 'status' | 'statusRange' | 'success' | 'proxy' | 'host' | 'url' | 'search' | 'from' | 'to'
>;

export interface StatsResult {
  total_requests: number;
  success_count: number;
  error_count: number;
  avg_duration_ms: number;
  methods: Record<string, number>;
  status_codes: Record<string, number>;
  requests_per_minute: number;
}

export interface ChartBucket {
  time: string;
  project: string;
  total: number;
  success: number;
  errors: number;
  avg_duration: number;
}

export interface HostBucket {
  host: string;
  count: number;
  success: number;
  errors: number;
  avg_duration: number;
  total_size: number;
}

export interface ProxyBucket {
  proxy: string;
  project: string;
  count: number;
  success: number;
  errors: number;
  total_size: number;
}

export type LogSummary = Omit<RequestLog, 'request_headers' | 'response_headers' | 'request_body' | 'response_body'>;

export interface LogStore {
  add(log: RequestLog): Promise<void>;
  getById(id: string): Promise<RequestLog | null>;
  list(filter: LogFilter): Promise<{ logs: LogSummary[]; total: number }>;
  /** Full rows (headers + bodies) for export; paged with the same cursor as list(). */
  listFull(filter: LogFilter): Promise<RequestLog[]>;
  projects(): Promise<string[]>;
  stats(filter?: AggregateFilter): Promise<StatsResult>;
  chartStats(filter?: AggregateFilter & { range?: number }): Promise<ChartBucket[]>;
  proxyStats(filter?: AggregateFilter): Promise<ProxyBucket[]>;
  hostStats(filter?: AggregateFilter & { range?: number }): Promise<HostBucket[]>;
  count(): Promise<number>;
  clear(filter?: { project?: string; before?: string }): Promise<number>;
  close(): Promise<void>;
}
