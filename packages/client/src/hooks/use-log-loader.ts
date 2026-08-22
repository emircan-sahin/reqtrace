import { useEffect, useCallback, useRef } from 'react';
import { get } from '@/services/http';
import { useLogStore } from '@/stores/use-log-store';
import { useFilterStore } from '@/stores/use-filter-store';
import { useConnectionStore } from '@/stores/use-connection-store';
import { buildServerFilters, useServerFilters } from './use-server-filters';
import type { LogSummary } from '@/types';

const PAGE_SIZE = 200;

interface LogsResponse {
  logs: LogSummary[];
}

interface ProjectsResponse {
  projects: string[];
}

/** Page params for the log feed, from the same filter source the aggregates use. */
export function logPageParams(): Record<string, string | number> {
  return { limit: PAGE_SIZE, ...buildServerFilters().params };
}

export function useLogLoader() {
  const { params: filterParams, pendingOnly } = useServerFilters();
  const dataEpoch = useConnectionStore((s) => s.dataEpoch);
  const filterKey = JSON.stringify(filterParams);

  const loadingRef = useRef(false);
  const lastCursorRef = useRef<string | null>(null);
  // Incremented on every filter change so a page that resolves late cannot be
  // merged into the list it no longer belongs to.
  const generationRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  // Fetch project list on mount and whenever the data set is wiped
  useEffect(() => {
    get<ProjectsResponse>('/api/projects')
      .then((data) => useFilterStore.getState().setProjects(data.projects))
      .catch(() => {});
  }, [dataEpoch]);

  // Reset and re-fetch when filters change
  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const generation = ++generationRef.current;
    lastCursorRef.current = null;
    useLogStore.getState().reset();

    if (pendingOnly) {
      // In-flight requests only exist in the client's pending map; there is no
      // server query for them, so do not fetch a page just to discard it.
      const s = useLogStore.getState();
      s.setLogs([]);
      s.setHasMore(false);
      s.setReady(true);
      return;
    }

    get<LogsResponse>('/api/logs', logPageParams(), controller.signal)
      .then((data) => {
        if (controller.signal.aborted || generation !== generationRef.current) return;
        const s = useLogStore.getState();
        s.setLogs([...data.logs].reverse());
        s.setHasMore(data.logs.length >= PAGE_SIZE);
      })
      .catch(() => {})
      .finally(() => {
        // Must run even on failure, otherwise infinite scroll stays disabled forever.
        if (!controller.signal.aborted && generation === generationRef.current) {
          useLogStore.getState().setReady(true);
        }
      });

    return () => controller.abort();
  }, [filterKey, pendingOnly, dataEpoch]);

  const loadMore = useCallback(async () => {
    const { hasMore, ready, logs } = useLogStore.getState();
    if (loadingRef.current || !hasMore || !ready) return;

    // Keyset cursor: oldest loaded log (logs stored oldest-first in store)
    const oldest = logs[0];
    const cursor = oldest ? btoa(`${oldest.timestamp}|${oldest.id}`) : null;
    // The cursor has not moved since the last page, so this would re-request
    // exactly the same rows — a loop the scroll handler can otherwise sustain.
    if (cursor && cursor === lastCursorRef.current) return;

    loadingRef.current = true;
    const generation = generationRef.current;

    try {
      const params = logPageParams();
      if (cursor) params.cursor = cursor;

      const data = await get<LogsResponse>('/api/logs', params);
      if (generation !== generationRef.current) return;

      lastCursorRef.current = cursor;
      const older = [...data.logs].reverse();

      if (older.length === 0) {
        useLogStore.getState().setHasMore(false);
        return;
      }

      useLogStore.getState().prependLogs(older);
      if (older.length < PAGE_SIZE) useLogStore.getState().setHasMore(false);
    } catch {
      // ignore
    } finally {
      loadingRef.current = false;
    }
  }, []);

  return { loadMore };
}
