import { Bar, BarChart, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SuccessErrorBucket } from '@/hooks/use-chart-data';

const chartConfig = {
  success: { label: 'Success', color: 'oklch(0.696 0.17 162.48)' },
  errors: { label: 'Errors', color: 'oklch(0.637 0.237 25.331)' },
} satisfies ChartConfig;

export function SuccessErrorChart({ data }: { data: SuccessErrorBucket[] }) {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="px-4 py-3">
        <CardTitle className="text-sm">Success vs Errors</CardTitle>
      </CardHeader>
      <CardContent className="px-2 pb-3">
        <ChartContainer config={chartConfig} className="aspect-auto h-[160px] w-full">
          <BarChart data={data}>
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
              width={30}
              allowDecimals={false}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="success" fill="var(--color-success)" radius={[2, 2, 0, 0]} />
            <Bar dataKey="errors" fill="var(--color-errors)" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
