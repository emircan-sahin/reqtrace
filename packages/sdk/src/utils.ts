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

  // Truncate by slicing until we're under the byte limit
  let truncated = str;
  while (Buffer.byteLength(truncated, 'utf-8') > maxBytes) {
    truncated = truncated.slice(0, truncated.length - 1);
  }

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
