import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { JsonTree } from './json-tree';
import { ActionMenu } from './action-menu';
import { get } from '@/services/http';
import type { RequestLog, LogSummary } from '@/types';

export function DetailPanel({ logId, summary }: { logId: string; summary: LogSummary }) {
  const [log, setLog] = useState<RequestLog | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    get<RequestLog>(`/api/logs/${logId}`)
      .then(setLog)
      .catch(() => setLog(null))
      .finally(() => setLoading(false));
  }, [logId]);

  return (
    <div className="px-4 pb-2 ml-[14px] border-l border-border min-h-[180px]">
      <Tabs defaultValue="request" className="mt-2">
        <div className="flex items-center justify-between">
          <TabsList variant="line">
            <TabsTrigger value="request">Request</TabsTrigger>
            <TabsTrigger value="response">Response</TabsTrigger>
            {summary.error_message && (
              <TabsTrigger value="error">Error</TabsTrigger>
            )}
          </TabsList>
          {log && <ActionMenu log={log} />}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : log ? (
          <>
            <TabsContent value="request">
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
            </TabsContent>

            <TabsContent value="response">
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
            </TabsContent>

            {log.error_message && (
              <TabsContent value="error">
                <div className="text-sm font-mono text-red-400 bg-red-950/30 rounded px-3 py-2 break-all">
                  {log.error_message}
                </div>
              </TabsContent>
            )}
          </>
        ) : (
          <div className="py-4 text-sm text-muted-foreground">Failed to load details</div>
        )}
      </Tabs>
    </div>
  );
}

function InlineField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-xs font-mono text-foreground">{value}</span>
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
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{title}</div>
          <div className="text-xs font-mono bg-card rounded px-3 py-2 max-h-48 overflow-y-auto">
            <JsonTree value={parsed} defaultOpen={rootOpen ?? false} />
          </div>
        </div>
      );
    }
  }

  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{title}</div>
      <div className="text-xs font-mono text-foreground bg-card rounded px-3 py-2 break-all">
        {content}
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
