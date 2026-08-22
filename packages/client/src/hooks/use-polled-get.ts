import { useEffect, useRef, useState } from 'react';
import { get } from '@/services/http';
import { useConnectionStore } from '@/stores/use-connection-store';

interface PolledResult<T> {
  data: T | null;
  /** Server-fetch start time, used as the boundary for merging live WS rows. */
  fetchedAt: string | null;
}

/**
 * Polls a REST endpoint. Aborts the in-flight request before starting the next
 * one (so a slow aggregate cannot land after a newer response), pauses while the
 * tab is hidden, and refetches when the data set is wiped.
 */
export function usePolledGet<T>(
  path: string,
  params: Record<string, string | number>,
  intervalMs: number,
  enabled = true,
): PolledResult<T> {
  const [state, setState] = useState<PolledResult<T>>({ data: null, fetchedAt: null });
  const dataEpoch = useConnectionStore((s) => s.dataEpoch);
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const paramsKey = JSON.stringify(params);

  useEffect(() => {
    let cancelled = false;
    let controller: AbortController | null = null;

    setState({ data: null, fetchedAt: null });
    if (!enabled) return;

    // force: the first load must happen even in a background tab, otherwise a
    // dashboard opened in one shows empty stats until it is focused.
    const run = (force = false) => {
      if (!force && document.visibilityState === 'hidden') return;

      controller?.abort();
      const current = new AbortController();
      controller = current;
      const at = new Date().toISOString();

      get<T>(path, paramsRef.current, current.signal)
        .then((data) => {
          if (!cancelled && !current.signal.aborted) setState({ data, fetchedAt: at });
        })
        .catch(() => {});
    };

    run(true);
    const timer = setInterval(() => run(), intervalMs);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') run(true);
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      controller?.abort();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [path, paramsKey, intervalMs, dataEpoch, enabled]);

  return state;
}
