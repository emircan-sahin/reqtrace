import type { Stats } from '../types';

export function StatsBar({ stats }: { stats: Stats }) {
  const successRate =
    stats.total_requests > 0
      ? Math.round((stats.success_count / stats.total_requests) * 100)
      : 0;

  return (
    <div className="flex items-center gap-6 px-4 py-3 bg-zinc-900 border-b border-zinc-800 text-sm">
      <Stat label="Total" value={stats.total_requests} />
      <Stat label="Success" value={`${successRate}%`} color="text-emerald-400" />
      <Stat label="Errors" value={stats.error_count} color="text-red-400" />
      <Stat label="Avg" value={`${stats.avg_duration_ms}ms`} color="text-blue-400" />
      <Stat label="Req/min" value={stats.requests_per_minute} color="text-amber-400" />
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-zinc-500">{label}</span>
      <span className={`font-mono font-medium ${color ?? 'text-zinc-100'}`}>
        {value}
      </span>
    </div>
  );
}
