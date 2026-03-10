import { useState, useRef, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
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
  const [expanded, setExpanded] = useState(false);
  const protocol = getProtocol(log.url);
  const hasProxy = log.proxy_host !== null;
  const isError = !log.success || (log.status !== null && log.status >= 400);

  return (
    <div className={`group border-b transition-all ${expanded ? 'border-zinc-700' : 'border-zinc-800/50 hover:brightness-125'} ${isError && !expanded ? 'bg-red-950/20' : ''} ${isError && expanded ? 'border-red-900/50' : ''}`}>
      <div
        className={`flex items-center gap-3 px-4 py-3 cursor-pointer select-none ${expanded ? (isError ? 'bg-red-950/40' : 'bg-zinc-800/80') : ''}`}
        onClick={() => setExpanded(!expanded)}
      >
        <ChevronRight
          size={14}
          className={`transition-transform flex-shrink-0 ${expanded ? 'rotate-90 text-zinc-300' : 'text-zinc-600'}`}
        />
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

      {expanded && <DetailPanel log={log} />}
    </div>
  );
}

function DetailPanel({ log }: { log: RequestLog }) {
  const [tab, setTab] = useState<'request' | 'response' | 'error'>('request');

  return (
    <div className="px-4 pb-2 ml-[14px] border-l border-zinc-800">
      {/* Tabs */}
      <div className="flex gap-1 mt-2 mb-2">
        <TabButton label="Request" active={tab === 'request'} onClick={() => setTab('request')} />
        <TabButton label="Response" active={tab === 'response'} onClick={() => setTab('response')} />
        {log.error_message && (
          <TabButton label="Error" active={tab === 'error'} onClick={() => setTab('error')} />
        )}
      </div>

      {/* Content */}
      {tab === 'request' && (
        <div className="space-y-2">
          <div className="flex gap-4">
            <InlineField label="Method" value={log.method} />
            <InlineField label="URL" value={log.url} />
          </div>
          {Object.keys(log.request_headers).length > 0 && (
            <DetailSection title="Headers" content={JSON.stringify(log.request_headers)} json defaultOpen />
          )}
          {log.request_body && (
            <DetailSection title="Body" content={log.request_body} json defaultOpen />
          )}
        </div>
      )}

      {tab === 'response' && (
        <div className="space-y-2">
          <div className="flex gap-4">
            <InlineField label="Status" value={log.status !== null ? String(log.status) : 'N/A'} />
            <InlineField label="Duration" value={`${log.duration_ms}ms`} />
            {log.response_size_bytes !== null && (
              <InlineField label="Size" value={formatBytes(log.response_size_bytes)} />
            )}
          </div>
          {Object.keys(log.response_headers).length > 0 && (
            <DetailSection title="Headers" content={JSON.stringify(log.response_headers)} json defaultOpen />
          )}
          {log.response_body && (
            <DetailSection title="Body" content={log.response_body} json defaultOpen />
          )}
        </div>
      )}

      {tab === 'error' && log.error_message && (
        <div className="text-sm font-mono text-red-400 bg-red-950/30 rounded px-3 py-2 break-all">
          {log.error_message}
        </div>
      )}
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`text-xs px-2.5 py-1 rounded transition-colors ${
        active
          ? 'bg-zinc-700 text-zinc-100'
          : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
      }`}
    >
      {label}
    </button>
  );
}

function InlineField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</span>
      <span className="text-xs font-mono text-zinc-300">{value}</span>
    </div>
  );
}

function DetailSection({ title, content, json, defaultOpen: rootOpen }: { title: string; content: string; json?: boolean; defaultOpen?: boolean }) {
  if (json) {
    let parsed: unknown = content;
    try {
      parsed = JSON.parse(content);
    } catch {
      // not valid JSON, show raw
    }

    if (typeof parsed === 'object' && parsed !== null) {
      return (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">{title}</div>
          <div className="text-xs font-mono bg-zinc-900 rounded px-3 py-2 max-h-48 overflow-y-auto">
            <JsonTree value={parsed} defaultOpen={rootOpen ?? false} />
          </div>
        </div>
      );
    }
  }

  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">{title}</div>
      <div className="text-xs font-mono text-zinc-300 bg-zinc-900 rounded px-3 py-2 break-all">
        {content}
      </div>
    </div>
  );
}

function JsonTree({ value, name, defaultOpen = true }: { value: unknown; name?: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  if (value === null) {
    return (
      <div className="flex">
        {name !== undefined && <span className="text-zinc-400">{name}<span className="text-zinc-600">: </span></span>}
        <span className="text-red-400">null</span>
      </div>
    );
  }

  if (typeof value === 'boolean') {
    return (
      <div className="flex">
        {name !== undefined && <span className="text-zinc-400">{name}<span className="text-zinc-600">: </span></span>}
        <span className="text-blue-400">{String(value)}</span>
      </div>
    );
  }

  if (typeof value === 'number') {
    return (
      <div className="flex">
        {name !== undefined && <span className="text-zinc-400">{name}<span className="text-zinc-600">: </span></span>}
        <span className="text-amber-400">{value}</span>
      </div>
    );
  }

  if (typeof value === 'string') {
    return (
      <div className="flex">
        {name !== undefined && <span className="text-zinc-400">{name}<span className="text-zinc-600">: </span></span>}
        <span className="text-emerald-400 break-all">&quot;{value}&quot;</span>
      </div>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <div className="flex">
          {name !== undefined && <span className="text-zinc-400">{name}<span className="text-zinc-600">: </span></span>}
          <span className="text-zinc-600">[]</span>
        </div>
      );
    }

    return (
      <div>
        <div
          className="flex items-center gap-1 cursor-pointer hover:text-zinc-200"
          onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        >
          <ChevronRight size={12} className={`text-zinc-600 transition-transform flex-shrink-0 ${open ? 'rotate-90' : ''}`} />
          {name !== undefined && <span className="text-zinc-400">{name}</span>}
          <span className="text-zinc-600">Array[{value.length}]</span>
        </div>
        {open && (
          <div className="ml-4 border-l border-zinc-800 pl-2">
            {value.map((item, i) => (
              <JsonTree key={i} value={item} name={`[${i}]`} defaultOpen={false} />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);

    if (entries.length === 0) {
      return (
        <div className="flex">
          {name !== undefined && <span className="text-zinc-400">{name}<span className="text-zinc-600">: </span></span>}
          <span className="text-zinc-600">{'{}'}</span>
        </div>
      );
    }

    return (
      <div>
        <div
          className="flex items-center gap-1 cursor-pointer hover:text-zinc-200"
          onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        >
          <ChevronRight size={12} className={`text-zinc-600 transition-transform flex-shrink-0 ${open ? 'rotate-90' : ''}`} />
          {name !== undefined && <span className="text-zinc-400">{name}</span>}
          <span className="text-zinc-600">{`{${entries.length}}`}</span>
        </div>
        {open && (
          <div className="ml-4 border-l border-zinc-800 pl-2">
            {entries.map(([key, val]) => (
              <JsonTree key={key} value={val} name={key} defaultOpen={false} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return <span className="text-zinc-300">{String(value)}</span>;
}


function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
