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

const INTERVALS = [
  { value: '60', label: '1m' },
  { value: '300', label: '5m' },
  { value: '900', label: '15m' },
  { value: '1800', label: '30m' },
  { value: '3600', label: '1h' },
  { value: '14400', label: '4h' },
];

export function StatsBar() {
  const stats = useStats();
  const autoScroll = useConnectionStore((s) => s.autoScroll);
  const toggleAutoScroll = useConnectionStore((s) => s.toggleAutoScroll);
  const chartsOpen = useConnectionStore((s) => s.chartsOpen);
  const toggleCharts = useConnectionStore((s) => s.toggleCharts);
  const chartInterval = useConnectionStore((s) => s.chartInterval);
  const setChartInterval = useConnectionStore((s) => s.setChartInterval);
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
            value={String(chartInterval)}
            onValueChange={(v) => setChartInterval(Number(v))}
          >
            <SelectTrigger size="sm" className="w-[62px] text-xs shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INTERVALS.map((i) => (
                <SelectItem key={i.value} value={i.value} className="text-xs">
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button
          variant={chartsOpen ? 'default' : 'outline'}
          size="icon-xs"
          onClick={toggleCharts}
          title={chartsOpen ? 'Hide charts' : 'Show charts'}
        >
          <BarChart3 size={14} />
        </Button>
        <Button
          variant={manualPaused ? 'default' : 'outline'}
          size="icon-xs"
          onClick={toggleManualPaused}
          title={manualPaused ? 'Resume feed' : 'Pause feed'}
        >
          {manualPaused ? <Play size={14} /> : <Pause size={14} />}
        </Button>
        <Button
          variant={autoScroll ? 'default' : 'outline'}
          size="icon-xs"
          onClick={toggleAutoScroll}
          title={autoScroll ? 'Auto-scroll on' : 'Auto-scroll off'}
        >
          <ArrowDown size={14} />
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
