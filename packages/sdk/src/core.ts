import type { ReqtraceConfig, ResolvedConfig, RequestLog, RequestStart, LogHandler, StartHandler } from './types.js';
import { createWsTransport, type WsTransport } from './transport.js';

const DEFAULT_CONFIG: ResolvedConfig = {
  enabled: true,
  serverUrl: null,
  projectName: 'default',
  captureBody: false,
  maxBodySize: 51200,
  filter: () => true,
};

function defaultLogHandler(log: RequestLog): void {
  const status = log.success ? `${log.status}` : `FAIL`;
  const line = `[reqtrace] ${log.method} ${log.url} ${status} ${log.duration_ms}ms`;
  console.log(line, log);
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
      this.logHandler = (log: RequestLog) => {
        defaultLogHandler(log);
        transport.sendEnd(log);
      };
    } else {
      this.logHandler = defaultLogHandler;
    }
  }

  handleStart(start: RequestStart): void {
    if (!this.config.enabled) return;
    this.startHandler?.(start);
  }

  handleLog(log: RequestLog): void {
    if (!this.config.enabled) return;
    this.logHandler(log);
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
  }
}
