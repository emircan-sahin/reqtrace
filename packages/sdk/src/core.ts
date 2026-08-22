import type { ReqtraceConfig, ResolvedConfig, RequestLog, RequestStart, LogHandler, StartHandler } from './types.js';
import { createWsTransport, type WsTransport } from './transport.js';
import { looksLikeCredential, redactHeaderMap } from './utils.js';

const DEFAULT_CONFIG: ResolvedConfig = {
  enabled: true,
  serverUrl: null,
  projectName: 'default',
  captureBody: true,
  maxBodySize: 51200,
  filter: () => true,
  redactHeaders: false,
  beforeSend: null,
};

/**
 * An array extends the built-in detection rather than replacing it: a consumer
 * naming one extra header should not silently lose coverage of authorization,
 * and should not have to re-list the defaults every time the SDK learns a new one.
 */
function buildRedactor(
  setting: true | string[] | { only: string[] },
): (name: string) => boolean {
  if (setting === true) return looksLikeCredential;

  if (Array.isArray(setting)) {
    const extra = new Set(setting.map((n) => n.toLowerCase()));
    return (name) => looksLikeCredential(name) || extra.has(name.toLowerCase());
  }

  const only = new Set(setting.only.map((n) => n.toLowerCase()));
  return (name) => only.has(name.toLowerCase());
}

export class ReqtraceCore {
  private config: ResolvedConfig;
  private logHandler: LogHandler;
  private startHandler: StartHandler | null = null;
  private transport: WsTransport | null = null;

  constructor(config?: ReqtraceConfig, logHandler?: LogHandler) {
    this.config = { ...DEFAULT_CONFIG, ...config, serverUrl: config?.serverUrl ?? null };

    if (logHandler) {
      this.logHandler = logHandler;
    } else if (this.config.serverUrl) {
      this.transport = createWsTransport(this.config.serverUrl, config?.apiKey);
      const transport = this.transport;
      this.startHandler = (start) => transport.sendStart(start);
      this.logHandler = (log: RequestLog) => transport.sendEnd(log);
    } else {
      this.logHandler = () => {};
    }
  }

  handleStart(start: RequestStart): void {
    if (!this.config.enabled) return;
    this.startHandler?.(start);
  }

  handleLog(log: RequestLog): void {
    if (!this.config.enabled) return;

    const prepared = this.prepare(log);
    if (prepared) this.logHandler(prepared);
  }

  /** Single chokepoint every adapter goes through: redact, then hand to beforeSend. */
  private prepare(log: RequestLog): RequestLog | null {
    const { redactHeaders, beforeSend } = this.config;
    let result = log;

    if (redactHeaders !== false && redactHeaders !== undefined) {
      const shouldRedact = buildRedactor(redactHeaders);
      result = {
        ...result,
        request_headers: redactHeaderMap(result.request_headers, shouldRedact) ?? {},
        response_headers: redactHeaderMap(result.response_headers, shouldRedact) ?? {},
      };
    }

    if (beforeSend) {
      try {
        return beforeSend(result);
      } catch {
        // A throwing hook must not lose the log or break the caller.
        return result;
      }
    }

    return result;
  }

  shouldLog(url: string, method: string): boolean {
    if (!this.config.enabled) return false;
    return this.config.filter(url, method);
  }

  getConfig(): ResolvedConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<ReqtraceConfig>): void {
    this.config = { ...this.config, ...config };
  }

  destroy(): void {
    this.transport?.close();
    this.transport = null;
    this.startHandler = null;
    // Otherwise the closure keeps feeding the closed transport (and keeps it alive).
    this.logHandler = () => {};
  }
}
