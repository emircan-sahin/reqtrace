import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { LogSummary, RequestStart } from '@/types';
import { StatusBadge } from './status-badge';
import { MethodBadge } from './method-badge';
import { ProtocolBadge } from './protocol-badge';
import { ProxyBadge } from './proxy-badge';
import { DetailPanel } from './detail-panel';

export function PendingEntry({ entry }: { entry: RequestStart }) {
  return (
    <div className="px-4 py-3 border-b border-border/50 bg-muted/30 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-4 text-center">
          <span className="inline-block w-4 h-4 border-2 border-muted-foreground border-t-foreground rounded-full animate-spin" />
        </div>
        <span className="text-xs text-muted-foreground font-mono flex items-center gap-1.5 flex-shrink-0">
          <span className="text-foreground/60">{entry.project}</span>
          <span className="text-border">|</span>
          <span>{formatTime(entry.timestamp)}</span>
        </span>
        <MethodBadge method={entry.method} />
        <span className="font-mono text-sm text-muted-foreground truncate">
          {entry.url}
        </span>
        <ProtocolBadge protocol={getProtocol(entry.url)} />
        <span className="flex-1" />
        <Badge variant="outline" className="text-xs font-mono border-transparent text-muted-foreground">
          pending
        </Badge>
      </div>
    </div>
  );
}

export function CompletedEntry({ log }: { log: LogSummary }) {
  const [expanded, setExpanded] = useState(false);
  const protocol = getProtocol(log.url);
  const hasProxy = log.proxy_host !== null;
  const isError = !log.success || (log.status !== null && log.status >= 400);

  return (
    <div className={`group border-b transition-all ${expanded ? 'border-border' : 'border-border/50 hover:brightness-125'} ${isError && !expanded ? 'border-l-2 border-l-red-500/40 bg-red-500/[0.03]' : ''} ${isError && expanded ? 'border-l-2 border-l-red-500/60 bg-red-500/[0.06]' : ''}`}>
      <div
        className={`flex items-center gap-3 px-4 py-3 cursor-pointer select-none ${expanded ? (isError ? '' : 'bg-secondary/80') : ''}`}
        onClick={() => setExpanded(!expanded)}
      >
        <ChevronRight
          size={14}
          className={`transition-transform flex-shrink-0 ${expanded ? 'rotate-90 text-foreground' : 'text-muted-foreground'}`}
        />
        <span className="text-xs text-muted-foreground font-mono flex items-center gap-1.5 flex-shrink-0">
          <span className="text-foreground/60">{log.project}</span>
          <span className="text-border">|</span>
          <span>{formatTime(log.timestamp)}</span>
        </span>
        <StatusBadge status={log.status} success={log.success} />
        <MethodBadge method={log.method} />
        <span className="font-mono text-sm text-foreground truncate">
          {log.url}
        </span>
        <ProtocolBadge protocol={protocol} />
        {hasProxy && <ProxyBadge host={log.proxy_host!} port={log.proxy_port} />}
        <span className="flex-1" />
        <span className={`text-xs font-mono w-16 text-right ${durationColor(log.duration_ms)}`}>
          {log.duration_ms}ms
        </span>
      </div>

      {expanded && <DetailPanel logId={log.id} summary={log} />}
    </div>
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
