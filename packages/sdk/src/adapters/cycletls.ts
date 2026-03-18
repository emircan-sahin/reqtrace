import { randomUUID } from 'node:crypto';
import type {
  CycleTLSClient,
  CycleTLSRequestOptions,
  CycleTLSResponse,
} from 'cycletls';
import type { ReqtraceAdapter, RequestLog } from '../types.js';
import { ReqtraceCore } from '../core.js';
import { truncateBody, estimateSize, flattenHeaders } from '../utils.js';

type CycleTlsMethod = (url: string, options: CycleTLSRequestOptions) => Promise<CycleTLSResponse>;

const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace', 'connect'] as const;

export class CycleTlsAdapter implements ReqtraceAdapter {
  private core: ReqtraceCore;
  private client: CycleTLSClient;
  private originals = new Map<string, CycleTlsMethod>();

  constructor(client: CycleTLSClient, core: ReqtraceCore) {
    this.client = client;
    this.core = core;
  }

  install(): void {
    for (const method of HTTP_METHODS) {
      const original = this.client[method] as CycleTlsMethod;
      this.originals.set(method, original);

      (this.client as unknown as Record<string, unknown>)[method] = async (
        url: string,
        options: CycleTLSRequestOptions,
      ): Promise<CycleTLSResponse> => {
        const upperMethod = method.toUpperCase();

        if (!this.core.shouldLog(url, upperMethod)) {
          return original.call(this.client, url, options);
        }

        const id = randomUUID();
        const start = Date.now();
        const config = this.core.getConfig();

        this.core.handleStart({
          id,
          project: config.projectName,
          url,
          method: upperMethod,
          timestamp: new Date().toISOString(),
        });

        let requestBody: string | undefined;
        if (config.captureBody && options?.body !== undefined) {
          requestBody = truncateBody(options.body, config.maxBodySize);
        }

        let response: CycleTLSResponse | null = null;
        let error: Error | null = null;

        try {
          response = await original.call(this.client, url, options);
        } catch (err) {
          error = err instanceof Error ? err : new Error(String(err));
        }

        const endTime = Date.now();
        const responseStatus = response?.status ?? null;
        const responseHeaders = response?.headers ?? {};
        const responseSuccess = response !== null && response.status >= 200 && response.status < 400;
        const errorMessage = error?.message ?? null;
        const { host: proxyHost, port: proxyPort } = this.extractProxy(options?.proxy);

        // Normalize response data to string
        const rawData = response?.data;
        const dataStr = rawData == null
          ? ''
          : typeof rawData === 'string'
            ? rawData
            : JSON.stringify(rawData);

        setImmediate(() => {
          const duration_ms = endTime - start;
          const requestHeaders = flattenHeaders(options?.headers);

          const contentLength = responseHeaders['content-length'];
          let responseSize: number | null = null;
          if (contentLength) {
            const parsed = parseInt(contentLength, 10);
            if (!isNaN(parsed)) responseSize = parsed;
          }

          let responseBody: string | undefined;
          if (config.captureBody && dataStr) {
            responseBody = truncateBody(dataStr, config.maxBodySize);
            if (responseSize === null) {
              responseSize = estimateSize(dataStr);
            }
          } else if (responseSize === null && dataStr) {
            responseSize = estimateSize(dataStr);
          }

          const log: RequestLog = {
            id,
            project: config.projectName,
            url,
            method: upperMethod,
            status: responseStatus,
            duration_ms,
            proxy_host: proxyHost,
            proxy_port: proxyPort,
            response_size_bytes: responseSize,
            request_headers: requestHeaders,
            response_headers: flattenHeaders(responseHeaders),
            request_body: requestBody,
            response_body: responseBody,
            error_message: errorMessage,
            success: responseSuccess,
            timestamp: new Date().toISOString(),
          };

          this.core.handleLog(log);
        });

        if (error) throw error;
        return response!;
      };
    }
  }

  eject(): void {
    for (const [method, original] of this.originals) {
      (this.client as unknown as Record<string, unknown>)[method] = original;
    }
    this.originals.clear();
  }

  private extractProxy(proxyUrl?: string): { host: string | null; port: number | null } {
    if (!proxyUrl) return { host: null, port: null };
    try {
      const parsed = new URL(proxyUrl);
      return {
        host: parsed.hostname,
        port: parsed.port ? parseInt(parsed.port, 10) : null,
      };
    } catch {
      return { host: null, port: null };
    }
  }
}
