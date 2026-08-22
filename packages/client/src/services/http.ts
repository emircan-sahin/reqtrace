import { useAuthStore } from '@/stores/use-auth-store';

const BASE_URL = (import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3100').replace(/\/+$/, '') || window.location.origin;

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('reqtrace_token');
  if (token) return { Authorization: `Bearer ${token}` };
  return {};
}

function handleUnauthorized(res: Response) {
  if (res.status === 401) {
    useAuthStore.getState().logout();
  }
}

export async function get<T>(path: string, params?: Record<string, string | number>, signal?: AbortSignal): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }
  const res = await fetch(url.toString(), { headers: authHeaders(), signal });
  handleUnauthorized(res);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  handleUnauthorized(res);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  handleUnauthorized(res);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export { BASE_URL };

/**
 * Opens an authenticated download. The export endpoint streams, so the token
 * cannot ride in a header on a plain link — fetch it and hand the browser a blob.
 */
export async function download(path: string, params?: Record<string, string | number>): Promise<void> {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const res = await fetch(url.toString(), { headers: authHeaders() });
  handleUnauthorized(res);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const disposition = res.headers.get('content-disposition') ?? '';
  const match = /filename="?([^";]+)"?/.exec(disposition);
  const filename = match ? match[1] : 'reqtrace-export';

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
