import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function ProtocolBadge({ protocol }: { protocol: string }) {
  const isSecure = protocol === 'HTTPS';
  return (
    <Badge
      variant="secondary"
      className={cn(
        'font-mono text-[10px] rounded border-transparent',
        isSecure
          ? 'bg-emerald-950 text-emerald-400'
          : 'bg-secondary text-muted-foreground',
      )}
    >
      {protocol}
    </Badge>
  );
}
