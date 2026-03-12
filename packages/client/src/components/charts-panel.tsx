import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { useConnectionStore } from '@/stores/use-connection-store';
import { useFilteredLogs } from '@/hooks/use-filtered-logs';
import { useChartData } from '@/hooks/use-chart-data';
import { RequestTimelineChart } from '@/components/charts/request-timeline-chart';
import { SuccessErrorChart } from '@/components/charts/success-error-chart';
import { LatencyChart } from '@/components/charts/latency-chart';

export function ChartsPanel() {
  const chartsOpen = useConnectionStore((s) => s.chartsOpen);
  const { filteredLogs } = useFilteredLogs();
  const { timelineBuckets, successErrorBuckets, latencyBuckets, projectNames } =
    useChartData(filteredLogs);

  return (
    <Collapsible open={chartsOpen}>
      <CollapsibleContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 p-3 border-b border-border bg-background">
          <RequestTimelineChart data={timelineBuckets} projectNames={projectNames} />
          <SuccessErrorChart data={successErrorBuckets} />
          <LatencyChart data={latencyBuckets} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
