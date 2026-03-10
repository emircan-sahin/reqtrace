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
        this.buildAndSendLog(response.config, response);
        return response;
      },
      (error: AxiosError) => {
        if (error.config) {
          this.buildAndSendLog(
            error.config as InternalAxiosRequestConfig,
            error.response ?? null,
            error,
          );
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
  ): void {
    const url = reqConfig.url ?? '';
    const method = (reqConfig.method ?? 'GET').toUpperCase();

    if (!this.core.shouldLog(url, method)) return;

    const start = reqConfig.__reqtrace_start ?? Date.now();
    const duration_ms = Date.now() - start;

    const rawProxy = reqConfig.proxy;
    const proxy = rawProxy && typeof rawProxy === 'object' ? rawProxy : null;
    const coreConfig = this.core.getConfig();

    const log: RequestLog = {
      id: reqConfig.__reqtrace_id ?? randomUUID(),
      url,
      method,
      status: response?.status ?? null,
      duration_ms,
      proxy_host: proxy ? proxy.host : null,
      proxy_port: proxy ? proxy.port : null,
      response_size_bytes: response
        ? this.getResponseSize(response)
        : null,
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
      if (response?.data !== undefined) {
        log.response_body = truncateBody(response.data, coreConfig.maxBodySize);
      }
    }

    this.core.handleLog(log);
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
