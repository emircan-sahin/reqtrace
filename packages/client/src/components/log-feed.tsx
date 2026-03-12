import { useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useFilteredLogs } from '@/hooks/use-filtered-logs';
import { useLogStore } from '@/stores/use-log-store';
import { useConnectionStore } from '@/stores/use-connection-store';
import { PendingEntry, CompletedEntry } from './log-entry';
import type { LogSummary, RequestStart } from '@/types';

type FeedItem =
  | { kind: 'log'; data: LogSummary }
  | { kind: 'pending'; data: RequestStart };

const ROW_HEIGHT = 52;

export function LogFeed({ loadMore }: { loadMore: () => void }) {
  const { filteredLogs, filteredPending } = useFilteredLogs();
  const autoScroll = useConnectionStore((s) => s.autoScroll);
  const hoverPaused = useConnectionStore((s) => s.hoverPaused);
  const manualPaused = useConnectionStore((s) => s.manualPaused);
  const setHoverPaused = useConnectionStore((s) => s.setHoverPaused);
  const paused = hoverPaused || manualPaused;
  const hasMore = useLogStore((s) => s.hasMore);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevItemsLengthRef = useRef(0);
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

  // Auto-scroll to bottom when new items are appended
  useEffect(() => {
    if (autoScroll && items.length > 0) {
      virtualizer.scrollToIndex(items.length - 1, { align: 'end' });
    }
  }, [items.length, autoScroll, virtualizer]);

  // Preserve scroll position when items are prepended (loadMore)
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const prev = prevItemsLengthRef.current;
    const curr = items.length;
    prevItemsLengthRef.current = curr;

    if (!autoScroll && curr > prev && prev > 0 && el.scrollTop < ROW_HEIGHT * 20) {
      const delta = curr - prev;
      el.scrollTop += delta * ROW_HEIGHT;
    }
  }, [items.length, autoScroll]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    // Auto-manage autoScroll based on scroll position
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const conn = useConnectionStore.getState();
    if (distanceFromBottom > ROW_HEIGHT * 3) {
      if (conn.autoScroll) conn.setAutoScroll(false);
    } else {
      if (!conn.autoScroll) conn.setAutoScroll(true);
    }

    // Load more when scrolled near the top
    if (!useLogStore.getState().hasMore) return;
    if (el.scrollTop < ROW_HEIGHT * 10) {
      loadMore();
    }
  }, [loadMore]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  return (
    <div
      className="flex-1 relative"
      onMouseEnter={() => setHoverPaused(true)}
      onMouseLeave={() => setHoverPaused(false)}
    >
      {paused && (
        <div className="absolute top-2 left-0 right-0 z-10 flex justify-center pointer-events-none">
          <span className="bg-amber-500/90 text-white text-xs font-medium px-3 py-1 rounded-full shadow-sm">
            Paused
          </span>
        </div>
      )}
      <div
        ref={containerRef}
        className="h-full overflow-y-auto"
      >
      {isEmpty ? (
        <div className="h-full flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <p className="text-lg">No requests yet</p>
            <p className="text-sm mt-1">Waiting for incoming requests...</p>
          </div>
        </div>
      ) : (
        <>
          {!hasMore && (
            <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
              No more logs to load
            </div>
          )}
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
                    <CompletedEntry key={item.data.id} log={item.data} />
                  ) : (
                    <PendingEntry key={item.data.id} entry={item.data} />
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
      </div>
    </div>
  );
}
