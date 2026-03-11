import { useRef, useEffect, useMemo, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useFilteredLogs } from '@/hooks/use-filtered-logs';
import { useLogStore } from '@/stores/use-log-store';
import { useConnectionStore } from '@/stores/use-connection-store';
import { PendingEntry, CompletedEntry } from './log-entry';
import type { RequestLog, RequestStart } from '@/types';

type FeedItem =
  | { kind: 'log'; data: RequestLog }
  | { kind: 'pending'; data: RequestStart };

const ROW_HEIGHT = 52;

export function LogFeed({ loadMore }: { loadMore: () => void }) {
  const { filteredLogs, filteredPending } = useFilteredLogs();
  const autoScroll = useConnectionStore((s) => s.autoScroll);
  const hasMore = useLogStore((s) => s.hasMore);
  const containerRef = useRef<HTMLDivElement>(null);
  const pendingEntries = Array.from(filteredPending.values());
  const isEmpty = pendingEntries.length === 0 && filteredLogs.length === 0;

  const items: FeedItem[] = useMemo(() => {
    const result: FeedItem[] = filteredLogs.map((data) => ({ kind: 'log', data }));
    for (const data of pendingEntries) {
      result.push({ kind: 'pending', data });
    }
    return result;
  }, [filteredLogs, pendingEntries]);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20,
  });

  useEffect(() => {
    if (autoScroll && items.length > 0) {
      virtualizer.scrollToIndex(items.length - 1, { align: 'end' });
    }
  }, [items.length, autoScroll, virtualizer]);

  const handleScroll = useCallback(() => {
    if (!hasMore) return;
    const virtualItems = virtualizer.getVirtualItems();
    if (virtualItems.length === 0) return;
    if (virtualItems[0].index < 10) {
      loadMore();
    }
  }, [hasMore, loadMore, virtualizer]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  if (isEmpty) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-lg">No requests yet</p>
          <p className="text-sm mt-1">Waiting for incoming requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto">
      <div
        className="relative w-full"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const item = items[virtualRow.index];
          return (
            <div
              key={virtualRow.key}
              className="absolute top-0 left-0 w-full"
              style={{ transform: `translateY(${virtualRow.start}px)` }}
              ref={virtualizer.measureElement}
              data-index={virtualRow.index}
            >
              {item.kind === 'log' ? (
                <CompletedEntry log={item.data} />
              ) : (
                <PendingEntry entry={item.data} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
