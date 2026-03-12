import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { useConnectionStore } from '@/stores/use-connection-store';
import { useFilteredLogs } from '@/hooks/use-filtered-logs';
import { useChartData } from '@/hooks/use-chart-data';
import { useProxyChartData } from '@/hooks/use-proxy-chart-data';
import { RequestTimelineChart } from '@/components/charts/request-timeline-chart';
import { SuccessErrorChart } from '@/components/charts/success-error-chart';
import { LatencyChart } from '@/components/charts/latency-chart';
import { ProxyRequestChart } from '@/components/charts/proxy-request-chart';
import { ProxyResponseSizeChart } from '@/components/charts/proxy-response-size-chart';
import { ProxySuccessErrorChart } from '@/components/charts/proxy-success-error-chart';

export function ChartsPanel() {
  const chartsOpen = useConnectionStore((s) => s.chartsOpen);
  const { filteredLogs } = useFilteredLogs();
  const { timelineBuckets, successErrorBuckets, latencyBuckets, projectNames } =
    useChartData(filteredLogs);
  const { requestData, responseSizeData, successErrorData, projectNames: proxyProjectNames } =
    useProxyChartData(filteredLogs);

  return (
    <Collapsible open={chartsOpen}>
      <CollapsibleContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 p-3 border-b border-border bg-background">
          <RequestTimelineChart data={timelineBuckets} projectNames={projectNames} />
          <SuccessErrorChart data={successErrorBuckets} />
          <LatencyChart data={latencyBuckets} />
          <ProxyRequestChart data={requestData} projectNames={proxyProjectNames} />
          <ProxyResponseSizeChart data={responseSizeData} projectNames={proxyProjectNames} />
          <ProxySuccessErrorChart data={successErrorData} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
