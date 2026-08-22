export function truncateBody(body: unknown, maxBytes: number): string {
  let str: string;

  if (body === undefined || body === null) {
    return '';
  }

  if (typeof body === 'string') {
    str = body;
  } else {
    try {
      str = JSON.stringify(body);
    } catch {
      return '[unserializable]';
    }
  }

  if (Buffer.byteLength(str, 'utf-8') <= maxBytes) {
    return str;
  }

  // Truncate by slicing buffer directly — O(1) instead of O(n²)
  const truncated = Buffer.from(str, 'utf-8').subarray(0, maxBytes).toString('utf-8');
  return truncated + '…';
}

export function estimateSize(data: unknown): number {
  if (data === undefined || data === null) {
    return 0;
  }

  if (typeof data === 'string') {
    return Buffer.byteLength(data, 'utf-8');
  }

  if (Buffer.isBuffer(data)) {
    return data.length;
  }

  try {
    return Buffer.byteLength(JSON.stringify(data), 'utf-8');
  } catch {
    return 0;
  }
}

export function flattenHeaders(headers: unknown): Record<string, string> {
  if (!headers || typeof headers !== 'object') {
    return {};
  }

  const result: Record<string, string> = {};

  // Handle AxiosHeaders (has toJSON method) or plain objects
  const plain =
    typeof (headers as Record<string, unknown>).toJSON === 'function'
      ? (headers as { toJSON(): Record<string, unknown> }).toJSON()
      : (headers as Record<string, unknown>);

  for (const [key, value] of Object.entries(plain)) {
    if (value !== undefined && value !== null) {
      result[key] = String(value);
    }
  }

  return result;
}

/** Content types that are never worth buffering (endless or binary). */
const UNCAPTURABLE_TYPES = [
  'text/event-stream',
  'application/octet-stream',
  'video/',
  'audio/',
  'image/',
];

/**
 * True when the response body is safe to read for logging. Without this check a
 * multi-megabyte download — or an SSE stream that never ends — would be buffered
 * whole in memory just to keep the first few KB.
 */
export function isCapturableBody(
  headers: Record<string, string>,
  maxBytes: number,
): boolean {
  const type = (headers['content-type'] ?? '').toLowerCase();
  if (UNCAPTURABLE_TYPES.some((t) => type.startsWith(t))) return false;

  const length = parseInt(headers['content-length'] ?? '', 10);
  // Allow some slack over maxBytes so bodies that are only slightly over still
  // get a useful truncated preview.
  if (!isNaN(length) && length > maxBytes * 8) return false;

  return true;
}

/**
 * Reads at most maxBytes from a response, then cancels the stream. Unlike
 * response.text() this never buffers an unbounded body.
 */
export async function readCappedText(response: Response, maxBytes: number): Promise<string> {
  const body = response.body;
  if (!body || typeof body.getReader !== 'function') {
    return await response.text();
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let out = '';
  let total = 0;

  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      out += decoder.decode(value, { stream: true });
    }
    out += decoder.decode();
  } finally {
    // Not awaited: on a clone()'d (teed) stream, cancelling one branch only
    // settles once the other branch is cancelled too — awaiting it hangs forever.
    void reader.cancel().catch(() => {});
  }

  return out;
}

/** Headers that carry credentials — including the proxy ones this SDK exists to track. */
export const DEFAULT_REDACTED_HEADERS = [
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
];

const REDACTED = '[redacted]';

export function redactHeaderMap(
  headers: Record<string, string> | undefined,
  names: string[],
): Record<string, string> | undefined {
  if (!headers) return headers;

  let result: Record<string, string> | undefined;
  for (const key of Object.keys(headers)) {
    if (names.includes(key.toLowerCase())) {
      if (!result) result = { ...headers };
      result[key] = REDACTED;
    }
  }
  return result ?? headers;
}
