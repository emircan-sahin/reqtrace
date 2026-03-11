import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const COLORS: Record<string, string> = {
  GET: 'bg-emerald-950 text-emerald-400',
  POST: 'bg-blue-950 text-blue-400',
  PUT: 'bg-amber-950 text-amber-400',
  PATCH: 'bg-orange-950 text-orange-400',
  DELETE: 'bg-red-950 text-red-400',
};

export function MethodBadge({ method }: { method: string }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        'w-12 justify-center font-mono text-xs rounded border-transparent',
        COLORS[method] ?? 'bg-zinc-800 text-zinc-400',
      )}
    >
      {method}
    </Badge>
  );
}
