import { useEffect, useState } from 'react';
import type { Stats } from '../types';

const POLL_INTERVAL = 5000;

const EMPTY_STATS: Stats = {
  total_requests: 0,
  success_count: 0,
  error_count: 0,
  avg_duration_ms: 0,
  methods: {},
  status_codes: {},
  requests_per_minute: 0,
};

export function useStats(serverUrl: string) {
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);

  useEffect(() => {
    const url = `${serverUrl.replace(/\/+$/, '')}/api/stats`;

    async function fetchStats() {
      try {
        const res = await fetch(url);
        if (res.ok) {
          setStats(await res.json());
        }
      } catch {
        // server unreachable, keep last stats
      }
    }

    fetchStats();
    const interval = setInterval(fetchStats, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [serverUrl]);

  return stats;
}
