export interface RequestStart {
  id: string;
  url: string;
  method: string;
  timestamp: string;
}

export interface RequestLog {
  id: string;
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
  method?: string;
  status?: number;
  success?: boolean;
  url?: string;
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

export interface LogStore {
  add(log: RequestLog): void;
  list(filter: LogFilter): { logs: RequestLog[]; total: number };
  stats(): StatsResult;
  count(): number;
  clear(): void;
}
