import { memo } from 'react';
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

const MemoRequestTimeline = memo(RequestTimelineChart);
const MemoSuccessError = memo(SuccessErrorChart);
const MemoLatency = memo(LatencyChart);
const MemoProxyRequest = memo(ProxyRequestChart);
const MemoProxySuccessError = memo(ProxySuccessErrorChart);
const MemoProxyResponseSize = memo(ProxyResponseSizeChart);

function ChartsPanelContent() {
  const { filteredLogs } = useFilteredLogs();
  const { timelineBuckets, successErrorBuckets, latencyBuckets, projectNames } =
    useChartData(filteredLogs);
  const { requestData, responseSizeData, successErrorData, projectNames: proxyProjectNames } =
    useProxyChartData(filteredLogs);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 p-3 border-b border-border bg-background">
      <MemoRequestTimeline data={timelineBuckets} projectNames={projectNames} />
      <MemoSuccessError data={successErrorBuckets} />
      <MemoLatency data={latencyBuckets} />
      <MemoProxyRequest data={requestData} projectNames={proxyProjectNames} />
      <MemoProxySuccessError data={successErrorData} />
      <MemoProxyResponseSize data={responseSizeData} projectNames={proxyProjectNames} />
    </div>
  );
}

export function ChartsPanel() {
  const chartsOpen = useConnectionStore((s) => s.chartsOpen);

  if (!chartsOpen) return null;

  return <ChartsPanelContent />;
}
