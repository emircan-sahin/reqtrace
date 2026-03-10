import { useRef, useEffect } from 'react';
import type { RequestLog, RequestStart } from '../types';
import { PendingEntry, CompletedEntry } from './log-entry';

interface LogFeedProps {
  logs: RequestLog[];
  pending: Map<string, RequestStart>;
  autoScroll: boolean;
}

export function LogFeed({ logs, pending, autoScroll }: LogFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pendingEntries = Array.from(pending.values());
  const isEmpty = pendingEntries.length === 0 && logs.length === 0;

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, pendingEntries, autoScroll]);

  if (isEmpty) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-600">
        <div className="text-center">
          <p className="text-lg">No requests yet</p>
          <p className="text-sm mt-1">Waiting for incoming requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto">
      {logs.map((log) => (
        <CompletedEntry key={log.id} log={log} />
      ))}
      {pendingEntries.map((entry) => (
        <PendingEntry key={entry.id} entry={entry} />
      ))}
    </div>
  );
}
