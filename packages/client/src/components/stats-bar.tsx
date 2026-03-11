import { ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStats } from '@/hooks/use-stats';
import { useConnectionStore } from '@/stores/use-connection-store';

export function StatsBar() {
  const stats = useStats();
  const autoScroll = useConnectionStore((s) => s.autoScroll);
  const toggleAutoScroll = useConnectionStore((s) => s.toggleAutoScroll);

  const successRate =
    stats.total_requests > 0
      ? Math.round((stats.success_count / stats.total_requests) * 100)
      : 0;

  return (
    <div className="flex items-center gap-6 px-4 py-3 bg-popover border-b border-border text-sm">
      <Stat label="Total" value={stats.total_requests} />
      <Stat label="Success" value={`${successRate}%`} color="text-emerald-400" />
      <Stat label="Errors" value={stats.error_count} color="text-red-400" />
      <Stat label="Avg" value={`${stats.avg_duration_ms}ms`} color="text-blue-400" />
      <Stat label="Req/min" value={stats.requests_per_minute} color="text-amber-400" />
      <Button
        variant={autoScroll ? 'default' : 'outline'}
        size="icon-xs"
        className="ml-auto"
        onClick={toggleAutoScroll}
        title={autoScroll ? 'Auto-scroll on' : 'Auto-scroll off'}
      >
        <ArrowDown size={14} />
      </Button>
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
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono font-medium ${color ?? 'text-foreground'}`}>
        {value}
      </span>
    </div>
  );
}
