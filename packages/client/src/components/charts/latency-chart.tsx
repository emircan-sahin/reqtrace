import { Area, AreaChart, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { LatencyBucket } from '@/hooks/use-chart-data';

const chartConfig = {
  avg: { label: 'Avg (ms)', color: 'var(--color-chart-1)' },
} satisfies ChartConfig;

export function LatencyChart({ data }: { data: LatencyBucket[] }) {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="px-4 py-3">
        <CardTitle className="text-sm">Avg Response Time</CardTitle>
      </CardHeader>
      <CardContent className="px-2 pb-3">
        <ChartContainer config={chartConfig} className="aspect-auto h-[160px] w-full">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="avgGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-avg)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--color-avg)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="time"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
              width={35}
              tickFormatter={(v: number) => `${v}ms`}
            />
            <ChartTooltip
              content={<ChartTooltipContent formatter={(value) => `${value}ms`} />}
            />
            <Area
              type="monotone"
              dataKey="avg"
              stroke="var(--color-avg)"
              fill="url(#avgGradient)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
