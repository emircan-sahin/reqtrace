export interface ReqtraceConfig {
  /** Enable/disable logging (default: true) */
  enabled?: boolean;
  /** Server URL to send logs to (e.g. 'http://localhost:3100') */
  serverUrl?: string;
  /** API key for authenticating with the server */
  apiKey?: string;
  /** Project name for filtering in the dashboard (default: 'default') */
  projectName?: string;
  /** Capture request/response bodies up to maxBodySize (default: true) */
  captureBody?: boolean;
  /** Maximum body size in bytes to capture (default: 51200 = 50KB) */
  maxBodySize?: number;
  /** Return false to skip logging a request */
  filter?: (url: string, method: string) => boolean;
  /**
   * Mask header values before a log leaves the process. Default: no redaction —
   * the dashboard is self-hosted and the developer owns the data.
   *
   * - `true` — mask anything that looks like a credential (name contains auth,
   *   token, key, secret, sign, cookie, credential, password, session). Catches
   *   headers nobody thought to list, including ones added later.
   * - `string[]` — the same detection, plus these exact names.
   * - `{ only: [...] }` — mask exactly these names and nothing else.
   */
  redactHeaders?: boolean | string[] | { only: string[] };
  /** Last chance to rewrite or drop a log. Return null to discard it. */
  beforeSend?: (log: RequestLog) => RequestLog | null;
}

export interface ResolvedConfig {
  enabled: boolean;
  serverUrl: string | null;
  projectName: string;
  captureBody: boolean;
  maxBodySize: number;
  filter: (url: string, method: string) => boolean;
  redactHeaders: boolean | string[] | { only: string[] };
  beforeSend: ((log: RequestLog) => RequestLog | null) | null;
}

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

export interface ReqtraceAdapter {
  install(): void;
  eject(): void;
}

export type LogHandler = (log: RequestLog) => void;
export type StartHandler = (start: RequestStart) => void;
