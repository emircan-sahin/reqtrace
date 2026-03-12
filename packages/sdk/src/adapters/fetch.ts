import { randomUUID } from 'node:crypto';
import type { ReqtraceAdapter, RequestLog } from '../types.js';
import { ReqtraceCore } from '../core.js';
import { truncateBody, estimateSize, flattenHeaders } from '../utils.js';

export class FetchAdapter implements ReqtraceAdapter {
  private core: ReqtraceCore;
  private originalFetch: typeof globalThis.fetch | null = null;

  constructor(core: ReqtraceCore) {
    this.core = core;
  }

  install(): void {
    this.originalFetch = globalThis.fetch;
    const self = this;

    globalThis.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const url = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

      const method = (init?.method ?? 'GET').toUpperCase();

      if (!self.core.shouldLog(url, method)) {
        return self.originalFetch!.call(globalThis, input, init);
      }

      const id = randomUUID();
      const start = Date.now();
      const config = self.core.getConfig();

      self.core.handleStart({
        id,
        project: config.projectName,
        url,
        method,
        timestamp: new Date().toISOString(),
      });

      let requestBody: string | undefined;
      if (config.captureBody && init?.body !== undefined && init.body !== null) {
        requestBody = truncateBody(init.body, config.maxBodySize);
      }

      let response: Response | null = null;
      let error: Error | null = null;

      try {
        response = await self.originalFetch!.call(globalThis, input, init);
      } catch (err) {
        error = err instanceof Error ? err : new Error(String(err));
      }

      const duration_ms = Date.now() - start;
      const requestHeaders = flattenHeaders(init?.headers);
      const responseHeaders: Record<string, string> = {};

      if (response) {
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });
      }

      const contentLength = responseHeaders['content-length'];
      let responseSize: number | null = null;
      if (contentLength) {
        const parsed = parseInt(contentLength, 10);
        if (!isNaN(parsed)) responseSize = parsed;
      }

      let responseBody: string | undefined;
      if (response && config.captureBody) {
        try {
          const cloned = response.clone();
          const text = await cloned.text();
          responseBody = truncateBody(text, config.maxBodySize);
          if (responseSize === null) {
            responseSize = estimateSize(text);
          }
        } catch {
          // body may not be readable
        }
      }

      const log: RequestLog = {
        id,
        project: config.projectName,
        url,
        method,
        status: response?.status ?? null,
        duration_ms,
        proxy_host: null,
        proxy_port: null,
        response_size_bytes: responseSize,
        request_headers: requestHeaders,
        response_headers: responseHeaders,
        request_body: requestBody,
        response_body: responseBody,
        error_message: error?.message ?? null,
        success: response !== null && response.status >= 200 && response.status < 400,
        timestamp: new Date().toISOString(),
      };

      self.core.handleLog(log);

      if (error) throw error;
      return response!;
    };
  }

  eject(): void {
    if (this.originalFetch) {
      globalThis.fetch = this.originalFetch;
      this.originalFetch = null;
    }
  }
}
