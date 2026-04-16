import { ArrowDown, BarChart3, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useStats } from '@/hooks/use-stats';
import { useConnectionStore } from '@/stores/use-connection-store';

const RANGES = [
  { value: '1800', label: '30m' },
  { value: '3600', label: '1h' },
  { value: '7200', label: '2h' },
  { value: '14400', label: '4h' },
  { value: '43200', label: '12h' },
  { value: '86400', label: '1d' },
  { value: '604800', label: '7d' },
  { value: '1209600', label: '14d' },
  { value: '2592000', label: '30d' },
];

export function StatsBar() {
  const stats = useStats();
  const autoScroll = useConnectionStore((s) => s.autoScroll);
  const toggleAutoScroll = useConnectionStore((s) => s.toggleAutoScroll);
  const chartsOpen = useConnectionStore((s) => s.chartsOpen);
  const toggleCharts = useConnectionStore((s) => s.toggleCharts);
  const chartRange = useConnectionStore((s) => s.chartRange);
  const setChartRange = useConnectionStore((s) => s.setChartRange);
  const manualPaused = useConnectionStore((s) => s.manualPaused);
  const toggleManualPaused = useConnectionStore((s) => s.toggleManualPaused);

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
      <div className="ml-auto flex items-center gap-2">
        {chartsOpen && (
          <Select
            value={String(chartRange)}
            onValueChange={(v) => setChartRange(Number(v))}
          >
            <SelectTrigger size="sm" className="w-[84px] text-sm shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGES.map((r) => (
                <SelectItem key={r.value} value={r.value} className="text-xs">
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button
          variant={chartsOpen ? 'default' : 'outline'}
          size="icon-sm"
          onClick={toggleCharts}
          title={chartsOpen ? 'Hide charts' : 'Show charts'}
        >
          <BarChart3 size={16} />
        </Button>
        <Button
          variant={manualPaused ? 'default' : 'outline'}
          size="icon-sm"
          onClick={toggleManualPaused}
          title={manualPaused ? 'Resume feed' : 'Pause feed'}
        >
          {manualPaused ? <Play size={16} /> : <Pause size={16} />}
        </Button>
        <Button
          variant={autoScroll ? 'default' : 'outline'}
          size="icon-sm"
          onClick={toggleAutoScroll}
          title={autoScroll ? 'Auto-scroll on' : 'Auto-scroll off'}
        >
          <ArrowDown size={16} />
        </Button>
      </div>
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
