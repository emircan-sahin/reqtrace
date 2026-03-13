import { randomUUID } from 'node:crypto';
import type {
  AxiosInstance,
  InternalAxiosRequestConfig,
  AxiosResponse,
  AxiosError,
} from 'axios';
import type { ReqtraceAdapter, RequestLog } from '../types.js';
import { ReqtraceCore } from '../core.js';
import { truncateBody, estimateSize, flattenHeaders } from '../utils.js';

declare module 'axios' {
  interface InternalAxiosRequestConfig {
    __reqtrace_id?: string;
    __reqtrace_start?: number;
    __reqtrace_request_body?: string;
  }
}

export class AxiosAdapter implements ReqtraceAdapter {
  private core: ReqtraceCore;
  private axiosInstance: AxiosInstance;
  private requestInterceptorId: number | null = null;
  private responseInterceptorId: number | null = null;

  constructor(axiosInstance: AxiosInstance, core: ReqtraceCore) {
    this.axiosInstance = axiosInstance;
    this.core = core;
  }

  install(): void {
    const config = this.core.getConfig();

    this.requestInterceptorId = this.axiosInstance.interceptors.request.use(
      (reqConfig: InternalAxiosRequestConfig) => {
        const url = reqConfig.url ?? '';
        const method = (reqConfig.method ?? 'GET').toUpperCase();

        if (!this.core.shouldLog(url, method)) return reqConfig;

        const id = randomUUID();
        reqConfig.__reqtrace_id = id;
        reqConfig.__reqtrace_start = Date.now();

        this.core.handleStart({
          id,
          project: this.core.getConfig().projectName,
          url,
          method,
          timestamp: new Date().toISOString(),
        });

        if (config.captureBody && reqConfig.data !== undefined) {
          reqConfig.__reqtrace_request_body = truncateBody(
            reqConfig.data,
            config.maxBodySize,
          );
        }

        return reqConfig;
      },
    );

    this.responseInterceptorId = this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => {
        const endTime = Date.now();
        setImmediate(() => this.buildAndSendLog(response.config, response, undefined, endTime));
        return response;
      },
      (error: AxiosError) => {
        if (error.config) {
          const endTime = Date.now();
          setImmediate(() => this.buildAndSendLog(
            error.config as InternalAxiosRequestConfig,
            error.response ?? null,
            error,
            endTime,
          ));
        }
        return Promise.reject(error);
      },
    );
  }

  eject(): void {
    if (this.requestInterceptorId !== null) {
      this.axiosInstance.interceptors.request.eject(this.requestInterceptorId);
      this.requestInterceptorId = null;
    }
    if (this.responseInterceptorId !== null) {
      this.axiosInstance.interceptors.response.eject(this.responseInterceptorId);
      this.responseInterceptorId = null;
    }
  }

  private buildAndSendLog(
    reqConfig: InternalAxiosRequestConfig,
    response: AxiosResponse | null,
    error?: AxiosError,
    endTime?: number,
  ): void {
    const url = reqConfig.url ?? '';
    const method = (reqConfig.method ?? 'GET').toUpperCase();

    if (!this.core.shouldLog(url, method)) return;

    const end = endTime ?? Date.now();
    const start = reqConfig.__reqtrace_start ?? end;
    const duration_ms = end - start;

    const { host: proxyHost, port: proxyPort } = this.extractProxy(reqConfig);
    const coreConfig = this.core.getConfig();

    // When captureBody is enabled, reuse the serialized body for size calculation
    // to avoid double JSON.stringify on large response objects
    let responseSizeBytes: number | null = null;
    let responseBodyStr: string | undefined;

    if (response) {
      if (coreConfig.captureBody && response.data !== undefined) {
        responseBodyStr = truncateBody(response.data, coreConfig.maxBodySize);
        // Prefer content-length header for accurate size, fall back to serialized body length
        const contentLength = response.headers?.['content-length'];
        if (contentLength) {
          const parsed = parseInt(contentLength, 10);
          responseSizeBytes = isNaN(parsed) ? Buffer.byteLength(responseBodyStr, 'utf-8') : parsed;
        } else {
          responseSizeBytes = Buffer.byteLength(responseBodyStr, 'utf-8');
        }
      } else {
        responseSizeBytes = this.getResponseSize(response);
      }
    }

    const log: RequestLog = {
      id: reqConfig.__reqtrace_id ?? randomUUID(),
      project: coreConfig.projectName,
      url,
      method,
      status: response?.status ?? null,
      duration_ms,
      proxy_host: proxyHost,
      proxy_port: proxyPort,
      response_size_bytes: responseSizeBytes,
      request_headers: flattenHeaders(reqConfig.headers),
      response_headers: response ? flattenHeaders(response.headers) : {},
      error_message: error?.message ?? null,
      success: response !== null && response.status >= 200 && response.status < 400,
      timestamp: new Date().toISOString(),
    };

    if (coreConfig.captureBody) {
      if (reqConfig.__reqtrace_request_body) {
        log.request_body = reqConfig.__reqtrace_request_body;
      }
      if (responseBodyStr !== undefined) {
        log.response_body = responseBodyStr;
      }
    }

    this.core.handleLog(log);
  }

  private extractProxy(reqConfig: InternalAxiosRequestConfig): { host: string | null; port: number | null } {
    // 1. Native axios proxy config
    const rawProxy = reqConfig.proxy;
    if (rawProxy && typeof rawProxy === 'object') {
      return { host: rawProxy.host, port: rawProxy.port };
    }

    // 2. httpsAgent/httpAgent with proxy (e.g. HttpsProxyAgent, HttpProxyAgent)
    const agent = (reqConfig as any).httpsAgent ?? (reqConfig as any).httpAgent;
    const proxyUrl = agent?.proxy;
    if (proxyUrl && typeof proxyUrl === 'object' && 'hostname' in proxyUrl) {
      const port = proxyUrl.port ? Number(proxyUrl.port) : null;
      return { host: proxyUrl.hostname, port };
    }

    return { host: null, port: null };
  }

  private getResponseSize(response: AxiosResponse): number {
    const contentLength = response.headers?.['content-length'];
    if (contentLength) {
      const parsed = parseInt(contentLength, 10);
      if (!isNaN(parsed)) return parsed;
    }
    return estimateSize(response.data);
  }
}
