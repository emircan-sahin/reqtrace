export interface RequestStart {
  type: 'request_start';
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

export interface RequestEnd extends RequestLog {
  type: 'request_end';
}

export type WsMessage = RequestStart | RequestEnd;

export interface Stats {
  total_requests: number;
  success_count: number;
  error_count: number;
  avg_duration_ms: number;
  methods: Record<string, number>;
  status_codes: Record<string, number>;
  requests_per_minute: number;
}
