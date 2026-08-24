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

/**
 * Turn a CycleTLS response body into something worth logging.
 *
 * CycleTLS hands back whatever its `responseType` produced. Callers that ask for
 * `arraybuffer` — which is what a client does when it wants the bytes verbatim — get a
 * Buffer, and `JSON.stringify` turns that into `{"type":"Buffer","data":[123,34,...]}`.
 * That is unreadable in the dashboard, and it inflates the payload roughly sixfold, so
 * `maxBodySize` truncates away most of the real body and `estimateSize` reports a size
 * that has nothing to do with the response.
 *
 * Bytes are decoded as UTF-8 and kept only if they survive the round trip; anything else
 * is genuinely binary, where a byte array tells the reader nothing a length does not.
 */
export function normalizeData(raw: unknown): string {
  if (raw == null) return '';
  if (typeof raw === 'string') return raw;

  const bytes = toBytes(raw);
  if (!bytes) return JSON.stringify(raw);

  const text = bytes.toString('utf-8');
  return Buffer.from(text, 'utf-8').equals(bytes) ? text : `[binary ${bytes.length} bytes]`;
}

/** Any of the byte-ish shapes CycleTLS can return, as a Buffer. Null if it is not one. */
function toBytes(raw: unknown): Buffer | null {
  if (Buffer.isBuffer(raw)) return raw;
  if (raw instanceof ArrayBuffer) return Buffer.from(raw);
  if (ArrayBuffer.isView(raw)) return Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength);
  return null;
}

export class CycleTlsAdapter implements ReqtraceAdapter {
  private core: ReqtraceCore;
  private client: CycleTLSClient;
  private originals = new Map<string, CycleTlsMethod>();

  constructor(client: CycleTLSClient, core: ReqtraceCore) {
    this.client = client;
    this.core = core;
  }

  install(): void {
    if (this.originals.size > 0) return;

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

        const rawData = response?.data;

        setImmediate(() => {
         try {
          // Normalized here, not on the caller's await path: for large payloads
          // this conversion used to run even when captureBody was off.
          const dataStr = normalizeData(rawData);

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
         } catch {
          // A throw in a setImmediate callback has no caller frame — it would
          // crash the host application.
         }
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
