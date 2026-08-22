import { z } from 'zod';
import type { RequestLog } from './types.js';

/** Hard ceiling on stored bodies; the SDK truncates too, but never trust the wire. */
const MAX_BODY_CHARS = 256 * 1024;

const headers = z.record(z.string(), z.string()).catch({});
const body = z.string().transform((v) => (v.length > MAX_BODY_CHARS ? v.slice(0, MAX_BODY_CHARS) : v));

export const requestLogSchema = z.object({
  id: z.string().min(1).max(200),
  project: z.string().min(1).max(200),
  url: z.string().min(1).max(8192),
  method: z.string().min(1).max(20),
  status: z.number().int().nullish().transform((v) => v ?? null),
  duration_ms: z.number().int().min(0).max(2_147_483_647),
  proxy_host: z.string().max(255).nullish().transform((v) => v ?? null),
  proxy_port: z.number().int().nullish().transform((v) => v ?? null),
  response_size_bytes: z.number().int().nullish().transform((v) => v ?? null),
  request_headers: headers.optional().transform((v) => v ?? {}),
  response_headers: headers.optional().transform((v) => v ?? {}),
  request_body: body.optional(),
  response_body: body.optional(),
  error_message: z.string().max(4096).nullish().transform((v) => v ?? null),
  success: z.boolean(),
  timestamp: z.string().min(1).refine((v) => !Number.isNaN(Date.parse(v)), 'invalid timestamp'),
});

export const requestStartSchema = z.object({
  id: z.string().min(1).max(200),
  project: z.string().min(1).max(200),
  url: z.string().min(1).max(8192),
  method: z.string().min(1).max(20),
  timestamp: z.string().min(1),
});

export function parseRequestLog(input: unknown): RequestLog | null {
  const result = requestLogSchema.safeParse(input);
  return result.success ? (result.data as RequestLog) : null;
}
