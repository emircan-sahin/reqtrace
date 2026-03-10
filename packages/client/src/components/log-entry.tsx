import { useState, useRef, useEffect } from 'react';
import type { RequestLog, RequestStart } from '../types';

export function PendingEntry({ entry }: { entry: RequestStart }) {
  const protocol = getProtocol(entry.url);

  return (
    <div className="px-4 py-3 border-b border-zinc-800/50 bg-zinc-900/50 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-12 text-center">
          <span className="inline-block w-4 h-4 border-2 border-zinc-500 border-t-zinc-200 rounded-full animate-spin" />
        </div>
        <MethodBadge method={entry.method} />
        <span className="font-mono text-sm text-zinc-400 truncate">
          {entry.url}
        </span>
        <ProtocolBadge protocol={protocol} />
        <span className="flex-1" />
        <span className="text-xs text-zinc-600 font-mono">pending</span>
      </div>
    </div>
  );
}

export function CompletedEntry({ log }: { log: RequestLog }) {
  const protocol = getProtocol(log.url);
  const hasProxy = log.proxy_host !== null;

  const isError = !log.success || (log.status !== null && log.status >= 400);

  return (
    <div className={`group px-4 py-3 border-b border-zinc-800/50 transition-all hover:brightness-125 ${isError ? 'bg-red-950/20' : ''}`}>
      <div className="flex items-center gap-3">
        <span className="text-xs text-zinc-600 font-mono">
          {formatTime(log.timestamp)}
        </span>
        <StatusBadge status={log.status} success={log.success} />
        <MethodBadge method={log.method} />
        <span className="font-mono text-sm text-zinc-300 truncate">
          {log.url}
        </span>
        <ProtocolBadge protocol={protocol} />
        {hasProxy && <ProxyBadge host={log.proxy_host!} port={log.proxy_port} />}
        <span className="flex-1" />
        <span className={`text-xs font-mono w-16 text-right ${durationColor(log.duration_ms)}`}>
          {log.duration_ms}ms
        </span>
        <ActionMenu log={log} />
      </div>
    </div>
  );
}

function StatusBadge({ status, success }: { status: number | null; success: boolean }) {
  if (status === null) {
    return (
      <span className="w-12 text-center text-xs font-mono font-medium px-1.5 py-0.5 rounded bg-red-950 text-red-400">
        ERR
      </span>
    );
  }

  let color = 'bg-emerald-950 text-emerald-400';
  if (status >= 300 && status < 400) color = 'bg-blue-950 text-blue-400';
  if (status >= 400 && status < 500) color = 'bg-amber-950 text-amber-400';
  if (status >= 500 || !success) color = 'bg-red-950 text-red-400';

  return (
    <span className={`w-12 text-center text-xs font-mono font-medium px-1.5 py-0.5 rounded ${color}`}>
      {status}
    </span>
  );
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: 'text-emerald-400',
    POST: 'text-blue-400',
    PUT: 'text-amber-400',
    PATCH: 'text-orange-400',
    DELETE: 'text-red-400',
  };

  return (
    <span className={`text-xs font-mono font-medium w-12 ${colors[method] ?? 'text-zinc-400'}`}>
      {method}
    </span>
  );
}

function ProtocolBadge({ protocol }: { protocol: string }) {
  const isSecure = protocol === 'HTTPS';
  return (
    <span
      className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${
        isSecure
          ? 'bg-emerald-950 text-emerald-400'
          : 'bg-zinc-800 text-zinc-400'
      }`}
    >
      {protocol}
    </span>
  );
}

function ProxyBadge({ host, port }: { host: string; port: number | null }) {
  const label = port ? `${host}:${port}` : host;

  return (
    <span
      className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 cursor-default"
      title={`Proxy: ${label}`}
    >
      Proxy {label}
    </span>
  );
}

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3100';

function ActionMenu({ log }: { log: RequestLog }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  function resend() {
    fetch(`${SERVER_URL.replace(/\/+$/, '')}/api/resend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: log.url,
        method: log.method,
        headers: log.request_headers,
        body: log.request_body,
      }),
    }).catch(() => {});
    setOpen(false);
  }

  function copyCurl() {
    const headers = Object.entries(log.request_headers)
      .map(([k, v]) => `-H '${k}: ${v}'`)
      .join(' ');
    const body = log.request_body ? ` -d '${log.request_body}'` : '';
    const cmd = `curl -X ${log.method} '${log.url}' ${headers}${body}`;
    navigator.clipboard.writeText(cmd);
    setOpen(false);
  }

  function copyRequest() {
    navigator.clipboard.writeText(JSON.stringify({
      url: log.url,
      method: log.method,
      headers: log.request_headers,
      body: log.request_body,
    }, null, 2));
    setOpen(false);
  }

  function copyResponse() {
    navigator.clipboard.writeText(JSON.stringify({
      status: log.status,
      headers: log.response_headers,
      body: log.response_body,
    }, null, 2));
    setOpen(false);
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="p-1 rounded hover:bg-zinc-700 text-zinc-600 hover:text-white transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="3" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="8" cy="13" r="1.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-50 w-44 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1">
          <MenuItem label="Resend" onClick={resend} />
          <MenuItem label="Copy Request" onClick={copyRequest} />
          <MenuItem label="Copy as cURL" onClick={copyCurl} />
          <MenuItem label="Copy Response" onClick={copyResponse} />
        </div>
      )}
    </div>
  );
}

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors"
    >
      {label}
    </button>
  );
}

function getProtocol(url: string): string {
  if (url.startsWith('https://') || url.startsWith('HTTPS://')) return 'HTTPS';
  return 'HTTP';
}

function durationColor(ms: number): string {
  if (ms < 200) return 'text-emerald-400';
  if (ms < 500) return 'text-amber-400';
  return 'text-red-400';
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
