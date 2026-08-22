import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useFilterStore } from '@/stores/use-filter-store';
import type { HostBucket } from '@/hooks/use-host-stats';

function errorRate(bucket: HostBucket): number {
  return bucket.count > 0 ? Math.round((bucket.errors / bucket.count) * 100) : 0;
}

function rateColor(rate: number): string {
  if (rate >= 25) return 'text-red-400';
  if (rate >= 5) return 'text-amber-400';
  return 'text-emerald-400';
}

/**
 * Answers "which upstream API is failing" without scrolling the feed — the
 * mirror image of the proxy charts, for the other end of the connection.
 */
export function HostPanel({ data }: { data: HostBucket[] }) {
  const selectedHost = useFilterStore((s) => s.selectedHost);
  const setSelectedHost = useFilterStore((s) => s.setSelectedHost);

  return (
    <Card className="gap-0 py-0 lg:col-span-3">
      <CardHeader className="px-4 py-3">
        <CardTitle className="text-sm">Target Hosts</CardTitle>
      </CardHeader>
      <CardContent className="px-2 pb-3">
        {data.length === 0 ? (
          <div className="h-[120px] flex items-center justify-center text-xs text-muted-foreground">
            No requests in this range
          </div>
        ) : (
          <div className="max-h-[180px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="text-left">
                  <th className="font-normal px-2 py-1">Host</th>
                  <th className="font-normal px-2 py-1 text-right">Requests</th>
                  <th className="font-normal px-2 py-1 text-right">Errors</th>
                  <th className="font-normal px-2 py-1 text-right">Error rate</th>
                  <th className="font-normal px-2 py-1 text-right">Avg</th>
                </tr>
              </thead>
              <tbody>
                {data.map((bucket) => {
                  const rate = errorRate(bucket);
                  const active = bucket.host === selectedHost;
                  return (
                    <tr
                      key={bucket.host}
                      onClick={() => setSelectedHost(active ? null : bucket.host)}
                      className={`cursor-pointer hover:bg-accent/50 ${active ? 'bg-accent' : ''}`}
                    >
                      <td className="px-2 py-1 font-mono truncate max-w-[280px]">{bucket.host}</td>
                      <td className="px-2 py-1 text-right font-mono">{bucket.count}</td>
                      <td className="px-2 py-1 text-right font-mono">{bucket.errors}</td>
                      <td className={`px-2 py-1 text-right font-mono ${rateColor(rate)}`}>{rate}%</td>
                      <td className="px-2 py-1 text-right font-mono text-blue-400">
                        {bucket.avg_duration}ms
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
