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
  success?: boolean;
  url?: string;
  search?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

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

export interface ProxyBucket {
  proxy: string;
  project: string;
  count: number;
  success: number;
  errors: number;
  total_size: number;
  avg_size: number;
}

export interface LogStore {
  add(log: RequestLog): Promise<void>;
  list(filter: LogFilter): Promise<{ logs: RequestLog[]; total: number }>;
  projects(): Promise<string[]>;
  stats(filter?: { project?: string; search?: string }): Promise<StatsResult>;
  chartStats(filter?: { project?: string; search?: string }): Promise<ChartBucket[]>;
  proxyStats(filter?: { project?: string; search?: string }): Promise<ProxyBucket[]>;
  count(): Promise<number>;
  clear(): Promise<void>;
  close(): Promise<void>;
}
