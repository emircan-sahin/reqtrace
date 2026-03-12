import { Bar, BarChart, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ProxyResponseSizeData } from '@/hooks/use-proxy-chart-data';

const CHART_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
];

function formatBytes(value: number): string {
  if (value < 1024) return `${value}B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)}KB`;
  return `${(value / (1024 * 1024)).toFixed(1)}MB`;
}

export function ProxyResponseSizeChart({
  data,
  projectNames,
}: {
  data: ProxyResponseSizeData[];
  projectNames: string[];
}) {
  const chartConfig = projectNames.reduce<ChartConfig>((acc, name, i) => {
    acc[name] = {
      label: name,
      color: CHART_COLORS[i % CHART_COLORS.length],
    };
    return acc;
  }, {});

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="px-4 py-3">
        <CardTitle className="text-sm">Proxy Total Response Size</CardTitle>
      </CardHeader>
      <CardContent className="px-2 pb-3">
        <ChartContainer config={chartConfig} className="aspect-auto h-[160px] w-full">
          <BarChart data={data}>
            <XAxis
              dataKey="proxy"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
              interval="preserveStartEnd"
              tickFormatter={(v: string) => v.split(':').pop() ?? v}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
              width={40}
              tickFormatter={formatBytes}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => formatBytes(value as number)}
                />
              }
            />
            {projectNames.map((name, i) => (
              <Bar
                key={name}
                dataKey={name}
                fill={CHART_COLORS[i % CHART_COLORS.length]}
                radius={[2, 2, 0, 0]}
              />
            ))}
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
