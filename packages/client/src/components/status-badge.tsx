import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function StatusBadge({ status, success }: { status: number | null; success: boolean }) {
  if (status === null) {
    return (
      <Badge variant="secondary" className={cn('w-12 justify-center font-mono text-xs rounded bg-red-950 text-red-400 border-transparent')}>
        ERR
      </Badge>
    );
  }

  let color = 'bg-emerald-950 text-emerald-400';
  if (status >= 300 && status < 400) color = 'bg-blue-950 text-blue-400';
  if (status >= 400 && status < 500) color = 'bg-amber-950 text-amber-400';
  if (status >= 500 || !success) color = 'bg-red-950 text-red-400';

  return (
    <Badge variant="secondary" className={cn('w-12 justify-center font-mono text-xs rounded border-transparent', color)}>
      {status}
    </Badge>
  );
}
