import type { RequestLog, RequestStart } from '../types';
import { PendingEntry, CompletedEntry } from './log-entry';

interface LogFeedProps {
  logs: RequestLog[];
  pending: Map<string, RequestStart>;
}

export function LogFeed({ logs, pending }: LogFeedProps) {
  const pendingEntries = Array.from(pending.values()).reverse();
  const isEmpty = pendingEntries.length === 0 && logs.length === 0;

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
    <div className="flex-1 overflow-y-auto">
      {pendingEntries.map((entry) => (
        <PendingEntry key={entry.id} entry={entry} />
      ))}
      {logs.map((log) => (
        <CompletedEntry key={log.id} log={log} />
      ))}
    </div>
  );
}
